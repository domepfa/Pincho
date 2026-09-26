/* ================================================================
   firebase.js — REST-Anbindung an Firebase Realtime Database + Auth.
   Kein SDK, kein Build-Step (gleiches Prinzip wie bei Firnspur/Fixseil).

   WICHTIG NACH DEM ERSTELLEN DES FIREBASE-PROJEKTS:
   FIREBASE_URL und FIREBASE_API_KEY unten durch die echten Werte ersetzen.
   Siehe README.md für die kompletten Setup-Schritte inkl. Security Rules.

   AUTH-MODELL: Jede Person hat ein eigenes Firebase-Auth-Konto (E-Mail +
   Passwort). Die Datenbank-Regeln (database.rules.json) geben private
   Daten nur der Person selbst frei und Crew-Daten nur den Mitgliedern der
   Crew. Registrieren geht nur mit Einladungscode einer Crew (die Regeln
   prüfen das, nicht nur die App). Welches Profil (members/{id}) zu einem
   Konto gehört, steht unter users/{uid}/memberId.
   ================================================================= */

const FIREBASE_URL = 'https://pincho-crew-default-rtdb.europe-west1.firebasedatabase.app';
const FIREBASE_API_KEY = 'AIzaSyDFwqI1f2o03DLM3I8oPXWFQw3nH9ZrQdA';
const AUTH_STORAGE_KEY = 'pincho_uauth'; // bewusst nicht "…_auth": das war der alte Team-Login

let authState = { idToken: null, refreshToken: null, expiresAt: 0, uid: null, email: null };

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) authState = JSON.parse(raw);
  } catch (e) {
    authState = { idToken: null, refreshToken: null, expiresAt: 0, uid: null, email: null };
  }
}
function saveAuthToStorage() {
  try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState)); } catch (e) { /* ignorieren */ }
}
function clearAuth() {
  authState = { idToken: null, refreshToken: null, expiresAt: 0, uid: null, email: null };
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) { /* ignorieren */ }
}
function authUid() { return authState.uid; }
function authEmail() { return authState.email; }

/* Inhalt des ID-Tokens (JWT) — nur zum Anzeigen (z. B. ob die E-Mail schon
   bestätigt ist). Die echte Prüfung machen die Datenbank-Regeln. */
function authClaims() {
  try {
    const part = authState.idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch (e) { return {}; }
}

async function identityCall(endpoint, body) {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, code: (data.error && data.error.message) || 'UNKNOWN' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}

function storeSignIn(data) {
  authState = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000 - 60000,
    uid: data.localId,
    email: data.email,
  };
  saveAuthToStorage();
}

/* Anmelden. {ok:true} oder {ok:false, code} — code z. B.
   "INVALID_LOGIN_CREDENTIALS" (E-Mail/Passwort falsch). */
async function signInEmail(email, password) {
  const r = await identityCall('signInWithPassword', { email, password, returnSecureToken: true });
  if (r.ok) storeSignIn(r.data);
  return r.ok ? { ok: true } : r;
}

/* Neues Konto. code z. B. "EMAIL_EXISTS", "WEAK_PASSWORD : …". Schickt
   gleich die Bestätigungs-Mail mit. */
async function signUpEmail(email, password) {
  const r = await identityCall('signUp', { email, password, returnSecureToken: true });
  if (!r.ok) return r;
  storeSignIn(r.data);
  sendVerifyEmail();
  return { ok: true };
}

async function sendVerifyEmail() {
  if (!authState.idToken) return { ok: false, code: 'NO_TOKEN' };
  return identityCall('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: authState.idToken });
}

async function sendPasswordReset(email) {
  return identityCall('sendOobCode', { requestType: 'PASSWORD_RESET', email });
}

/* Löscht das Login-Konto selbst (die Daten in der Datenbank löscht app.js
   vorher). Firebase verlangt dafür eine frische Anmeldung. */
async function deleteAuthAccount() {
  if (!(await ensureValidAuthToken())) return { ok: false, code: 'NO_TOKEN' };
  return identityCall('delete', { idToken: authState.idToken });
}

/* ---------- Netzwerk mit Zeitlimit ----------
   Bei schlechtem Empfang (z. B. im Gym) hängt ein normaler fetch() gerne
   minutenlang, statt sauber zu scheitern. Darum bekommt jede Anfrage ein
   Zeitlimit; scheitert eine, gilt das Netz für NET_DOWN_MS als "weg" und
   Lesezugriffe gehen solange direkt an die lokale Kopie, statt jedes Mal
   erneut auf das Zeitlimit zu warten. */
const NET_TIMEOUT_MS = 8000;
const NET_DOWN_MS = 20000;
let netDownUntil = 0;

function netLooksDown() {
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || Date.now() < netDownUntil;
}
function markNetDown() { netDownUntil = Date.now() + NET_DOWN_MS; }
function markNetUp() { netDownUntil = 0; }

async function fetchWithTimeout(url, opts = {}, ms = NET_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    markNetUp();
    return res;
  } catch (e) {
    markNetDown();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshAuthToken() {
  if (!authState.refreshToken) return false;
  try {
    const res = await fetchWithTimeout(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(authState.refreshToken),
    });
    // Nur ein echtes "Token ungültig" (400) meldet ab — ein Server-/Proxy-
    // Fehler bei wackligem Netz soll nicht zum erneuten Anmelden zwingen.
    if (res.status === 400) { clearAuth(); return false; }
    if (!res.ok) return false;
    const data = await res.json();
    authState = {
      ...authState,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Number(data.expires_in) * 1000 - 60000,
      uid: data.user_id || authState.uid,
    };
    saveAuthToStorage();
    return true;
  } catch (e) {
    return false;
  }
}

let refreshInFlight = null;
async function ensureValidAuthToken() {
  if (authState.idToken && Date.now() < authState.expiresAt) return true;
  if (!authState.refreshToken || netLooksDown()) return false;
  // Mehrere gleichzeitige Anfragen teilen sich EINE Erneuerung.
  if (!refreshInFlight) refreshInFlight = refreshAuthToken().finally(() => { refreshInFlight = null; });
  return await refreshInFlight;
}

/* Ist dieses Gerät schon einmal angemeldet worden? Dann
   startet die App auch offline direkt — das Token wird im Hintergrund
   erneuert, sobald wieder Netz da ist (siehe boot() in app.js). */
function hasStoredAuth() {
  return !!(authState.idToken || authState.refreshToken);
}

function authQuery() {
  return authState.idToken ? `?auth=${authState.idToken}` : '';
}

/* ---------- Offline: lokale Kopie + Warteschlange ----------
   Jeder gelesene Pfad wird in localStorage gespiegelt (Präfix CACHE_PREFIX)
   und steht so auch ohne Netz zur Verfügung. Schreibzugriffe landen zuerst
   in der lokalen Kopie und in einer Warteschlange (QUEUE_KEY), die der
   Reihe nach an Firebase geschickt wird, sobald Netz da ist — ein offline
   gespeichertes Training geht so nicht verloren. Solange etwas in der
   Warteschlange steckt, werden frisch geladene Daten damit überlagert,
   damit ein noch nicht hochgeladener Eintrag nicht kurz "verschwindet". */
const CACHE_PREFIX = 'pincho_c:';
const QUEUE_KEY = 'pincho_queue';

function pathSegs(path) { return String(path).split('/').filter(Boolean); }
function startsWithSegs(a, b) { return b.length <= a.length && b.every((seg, i) => a[i] === seg); }
function cloneJson(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function getIn(v, segs) {
  for (const seg of segs) {
    if (v == null || typeof v !== 'object') return null;
    v = v[seg];
  }
  return v === undefined ? null : v;
}
function normalizeEmpty(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) return null;
  return v;
}
/* Wert an einer Stelle unterhalb eines Objekts setzen (null = löschen). */
function setIn(obj, segs, value) {
  if (!segs.length) return value;
  const o = obj && typeof obj === 'object' ? (Array.isArray(obj) ? Object.assign({}, obj) : { ...obj }) : {};
  const child = setIn(o[segs[0]] ?? null, segs.slice(1), value);
  if (child == null) delete o[segs[0]]; else o[segs[0]] = child;
  return normalizeEmpty(o);
}
/* Wendet einen Schreibzugriff (op) auf den Wert an Pfad basePath an. */
function applyOp(basePath, baseValue, op) {
  if (op.m === 'patch') {
    // Ein Patch = mehrere PUTs auf die (ggf. mehrstufigen) Unterpfade.
    let v = baseValue;
    Object.entries(op.data || {}).forEach(([k, d]) => {
      v = applyOp(basePath, v, { m: 'put', path: [...pathSegs(op.path), ...pathSegs(k)].join('/'), data: d });
    });
    return v;
  }
  const bp = pathSegs(basePath);
  const wp = pathSegs(op.path);
  if (startsWithSegs(wp, bp)) {
    // Schreibzugriff liegt an/unter dem gelesenen Pfad.
    const rel = wp.slice(bp.length);
    return setIn(baseValue, rel, op.m === 'delete' ? null : cloneJson(op.data));
  }
  if (startsWithSegs(bp, wp)) {
    // Gelesener Pfad liegt unterhalb des Schreibzugriffs.
    const rel = bp.slice(wp.length);
    if (op.m === 'delete') return null;
    return cloneJson(getIn(op.data, rel));
  }
  return baseValue;
}

function readCache(path) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + pathSegs(path).join('/'));
    return raw == null ? undefined : JSON.parse(raw);
  } catch (e) { return undefined; }
}
function writeCache(path, value) {
  try { localStorage.setItem(CACHE_PREFIX + pathSegs(path).join('/'), JSON.stringify(value)); } catch (e) { /* Speicher voll — dann eben ohne Kopie */ }
}
function applyOpToCache(op) {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => {
      const path = k.slice(CACHE_PREFIX.length);
      const bp = pathSegs(path);
      const wp = pathSegs(op.path);
      if (!startsWithSegs(wp, bp) && !startsWithSegs(bp, wp)) return;
      writeCache(path, applyOp(path, readCache(path) ?? null, op));
    });
  } catch (e) { /* ignorieren */ }
}

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* ignorieren */ }
}
function pendingWriteCount() { return loadQueue().length; }

function notify(message, kind) {
  if (typeof toast === 'function') toast(message, kind);
}
let lastOfflineNotice = 0;
let hadOfflineWrites = false;

function queueWrite(op) {
  applyOpToCache(op);
  const q = loadQueue();
  q.push(op);
  saveQueue(q);
  if (netLooksDown()) {
    hadOfflineWrites = true;
    if (Date.now() - lastOfflineNotice > 60000) {
      lastOfflineNotice = Date.now();
      notify('Offline gespeichert — wird hochgeladen, sobald wieder Netz da ist.');
    }
  }
  flushQueue();
  return true;
}

async function sendOp(op) {
  const method = op.m === 'put' ? 'PUT' : op.m === 'patch' ? 'PATCH' : 'DELETE';
  const opts = { method };
  if (op.m !== 'delete') opts.body = JSON.stringify(op.data);
  const res = await fetchWithTimeout(`${FIREBASE_URL}/${op.path}.json${authQuery()}`, opts, 15000);
  return res;
}

/* Kürzlich hochgeladene Schreibzugriffe (nur im Speicher): Eine Lese-
   Anfrage, die schon lief, BEVOR ein Schreibzugriff beim Server ankam, kann
   noch den alten Stand liefern — und die Warteschlange ist zu dem Zeitpunkt
   schon leer, also würde nichts mehr darübergelegt. Solche Zugriffe werden
   darum zusätzlich über jede Antwort gelegt, die vor ihrem Upload gestartet
   wurde (siehe fetchFresh). */
let recentOps = [];
function recentOpsSince(startedAt) {
  recentOps = recentOps.filter((r) => Date.now() - r.sentAt < 120000);
  return recentOps.filter((r) => r.sentAt >= startedAt).map((r) => r.op);
}

let flushing = false;
async function flushQueue() {
  if (flushing) return;
  flushing = true;
  let sentAny = false;
  try {
    let q = loadQueue();
    while (q.length) {
      if (netLooksDown()) break;
      await ensureValidAuthToken();
      let res;
      try { res = await sendOp(q[0]); } catch (e) { break; } // kein Netz — später nochmal
      if (res.status === 401 || res.status === 403) {
        // Token abgelaufen o. Ä. — einmal erneuern und nochmal; klappt das
        // Erneuern nicht, bleibt der Eintrag in der Warteschlange (Daten nie
        // verwerfen). Lehnt Firebase auch mit frischem Token ab, verbieten
        // es die Regeln — dann verwerfen, sonst blockiert der Eintrag alle
        // folgenden für immer.
        authState.expiresAt = 0;
        if (!(await ensureValidAuthToken())) break;
        try { res = await sendOp(q[0]); } catch (e) { break; }
      }
      if (res.status >= 500) break;
      if (!res.ok) console.error('Firebase: Schreibzugriff abgelehnt, verworfen', q[0].path, res.status);
      q = loadQueue();
      recentOps.push({ op: q.shift(), sentAt: Date.now() });
      saveQueue(q);
      sentAny = true;
    }
    if (sentAny && !q.length && hadOfflineWrites) {
      hadOfflineWrites = false;
      notify('Offline-Daten hochgeladen.', 'ok');
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { markNetUp(); flushQueue(); });
  setInterval(() => { if (pendingWriteCount()) flushQueue(); }, 20000);
}

/* ---------- Lesen/Schreiben ----------
   fbGet gibt bei Erfolg den Wert zurück (kann selbst `null` sein —
   Firebase liefert das für einen leeren, aber existierenden Pfad). Ohne
   Netz kommt die lokale Kopie zurück; nur wenn es davon auch keine gibt,
   `undefined` — Aufrufer können so weiterhin "wirklich leer" von "konnte
   nicht laden" unterscheiden. Mit lokaler Kopie wartet fbGet höchstens
   CACHE_GRACE_MS aufs Netz und zeigt sonst die Kopie; die Antwort aus dem
   Netz aktualisiert die Kopie dann im Hintergrund fürs nächste Mal. */
const CACHE_GRACE_MS = 2500;

async function fetchFresh(path) {
  const startedAt = Date.now();
  await ensureValidAuthToken();
  const res = await fetchWithTimeout(`${FIREBASE_URL}/${path}.json${authQuery()}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let value = await res.json();
  [...recentOpsSince(startedAt), ...loadQueue()].forEach((op) => { value = applyOp(path, value, op); });
  // Inzwischen abgemeldet? Dann nichts mehr lokal ablegen (sonst läge nach
  // dem Abmelden wieder eine Kopie auf dem Gerät).
  if (!hasStoredAuth()) return value;
  writeCache(path, value);
  if (pendingWriteCount()) flushQueue();
  return value;
}

async function fbGet(path) {
  const cached = readCache(path);
  if (cached !== undefined && netLooksDown()) return cached;
  const fresh = fetchFresh(path);
  if (cached === undefined) {
    try { return await fresh; } catch (e) {
      console.error('Firebase GET fehlgeschlagen', path, e);
      return undefined;
    }
  }
  fresh.catch((e) => console.warn('Firebase GET (Hintergrund) fehlgeschlagen', path, e));
  const grace = new Promise((resolve) => setTimeout(() => resolve(cached), CACHE_GRACE_MS));
  return Promise.race([fresh.catch(() => cached), grace]);
}

/* Direkt ans Netz, ohne lokale Kopie/Warteschlange — für Schritte, die
   sofort Bescheid brauchen, ob Firebase sie erlaubt (Registrieren, Crew
   beitreten, …). fbGetNow: {ok, value} bzw. {ok:false, status}. */
async function fbGetNow(path) {
  try {
    await ensureValidAuthToken();
    const res = await fetchWithTimeout(`${FIREBASE_URL}/${path}.json${authQuery()}`);
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, value: await res.json() };
  } catch (e) {
    return { ok: false, status: 0 };
  }
}

/* Mehrere Pfade auf einmal (Schlüssel relativ zu `path`, z. B.
   "members/abc/uid") — Firebase schreibt alles oder nichts. */
async function fbUpdateNow(path, data) {
  try {
    await ensureValidAuthToken();
    const res = await fetchWithTimeout(`${FIREBASE_URL}/${path}.json${authQuery()}`, { method: 'PATCH', body: JSON.stringify(data) }, 15000);
    if (!res.ok) return { ok: false, status: res.status };
    applyOpToCache({ m: 'patch', path, data });
    return { ok: true };
  } catch (e) {
    return { ok: false, status: 0 };
  }
}

/* Beim Abmelden: lokale Kopie und Warteschlange dieses Kontos vergessen
   (sonst sähe die nächste Person am selben Gerät die Daten offline). */
function clearLocalData() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(QUEUE_KEY);
  } catch (e) { /* ignorieren */ }
}

async function fbPut(path, data) {
  return queueWrite({ m: 'put', path, data: cloneJson(data) ?? null, t: Date.now() });
}

async function fbPatch(path, data) {
  return queueWrite({ m: 'patch', path, data: cloneJson(data) || {}, t: Date.now() });
}

async function fbDelete(path) {
  return queueWrite({ m: 'delete', path, t: Date.now() });
}

/* Push = neuer Eintrag mit eindeutiger, zeitlich sortierbarer ID — hier
   lokal erzeugt (gleiches Format wie Firebase selbst), damit auch offline
   sofort eine ID feststeht; geschrieben wird dann per PUT an diese ID. */
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPushTime = 0;
const lastRandChars = [];
function generatePushId() {
  let now = Date.now();
  const duplicateTime = now === lastPushTime;
  lastPushTime = now;
  const timeChars = new Array(8);
  for (let i = 7; i >= 0; i--) {
    timeChars[i] = PUSH_CHARS.charAt(now % 64);
    now = Math.floor(now / 64);
  }
  let id = timeChars.join('');
  if (!duplicateTime) {
    for (let i = 0; i < 12; i++) lastRandChars[i] = Math.floor(Math.random() * 64);
  } else {
    let i = 11;
    for (; i >= 0 && lastRandChars[i] === 63; i--) lastRandChars[i] = 0;
    lastRandChars[i]++;
  }
  for (let i = 0; i < 12; i++) id += PUSH_CHARS.charAt(lastRandChars[i]);
  return id;
}

async function fbPush(path, data) {
  const id = generatePushId();
  queueWrite({ m: 'put', path: `${pathSegs(path).join('/')}/${id}`, data: cloneJson(data) ?? null, t: Date.now() });
  return id;
}

loadAuthFromStorage();

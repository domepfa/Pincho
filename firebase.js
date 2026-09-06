/* ================================================================
   firebase.js — REST-Anbindung an Firebase Realtime Database + Auth.
   Kein SDK, kein Build-Step (gleiches Prinzip wie bei Firnspur/Fixseil).

   WICHTIG NACH DEM ERSTELLEN DES FIREBASE-PROJEKTS:
   FIREBASE_URL und FIREBASE_API_KEY unten durch die echten Werte ersetzen.
   Siehe README.md für die kompletten Setup-Schritte inkl. Security Rules.

   AUTH-MODELL (identisch zu Firnspur/Fixseil):
   Ein einziger, gemeinsamer Firebase-Auth-Account fürs ganze Team
   (AUTH_EMAIL ist nur ein technischer Platzhalter, keine echte Adresse).
   Das "Passwort" dafür ist der Team-Code, den ihr euch teilt. Beim
   allerersten Login richtet die App diesen Account automatisch ein
   (signUp), danach genügt signIn. Die Datenbank-Regeln verlangen
   "auth != null" — wer den Team-Code nicht kennt, kommt nicht rein.
   Wer welche Person ist (Name), ist davon unabhängig und wird separat
   pro Gerät gespeichert (siehe app.js).
   ================================================================= */

const FIREBASE_URL = 'https://pincho-crew-default-rtdb.europe-west1.firebasedatabase.app';
const FIREBASE_API_KEY = 'AIzaSyDFwqI1f2o03DLM3I8oPXWFQw3nH9ZrQdA';
const AUTH_EMAIL = 'crew@pincho.app'; // technischer Platzhalter, keine echte Mailadresse

let authState = { idToken: null, refreshToken: null, expiresAt: 0 };

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem('pincho_auth');
    if (raw) authState = JSON.parse(raw);
  } catch (e) {
    authState = { idToken: null, refreshToken: null, expiresAt: 0 };
  }
}
function saveAuthToStorage() {
  try { localStorage.setItem('pincho_auth', JSON.stringify(authState)); } catch (e) { /* ignorieren */ }
}
function clearAuth() {
  authState = { idToken: null, refreshToken: null, expiresAt: 0 };
  try { localStorage.removeItem('pincho_auth'); } catch (e) { /* ignorieren */ }
}

/* Meldet den Team-Account an. Gibt bei Erfolg {ok:true} zurück, sonst
   {ok:false, code} — code z. B. "EMAIL_NOT_FOUND" (Account existiert noch
   nicht → signUpTeam versuchen) oder "INVALID_LOGIN_CREDENTIALS" (falsches
   Passwort/Code). */
async function signInTeam(password) {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: AUTH_EMAIL, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, code: (data.error && data.error.message) || 'UNKNOWN' };
    authState = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + Number(data.expiresIn) * 1000 - 60000,
    };
    saveAuthToStorage();
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}

/* Richtet den gemeinsamen Team-Account einmalig ein (erster Login überhaupt:
   das eingegebene Passwort wird zum neuen Team-Code). */
async function signUpTeam(password) {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: AUTH_EMAIL, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, code: (data.error && data.error.message) || 'UNKNOWN' };
    authState = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + Number(data.expiresIn) * 1000 - 60000,
    };
    saveAuthToStorage();
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}

async function refreshAuthToken() {
  if (!authState.refreshToken) return false;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(authState.refreshToken),
    });
    if (!res.ok) { clearAuth(); return false; }
    const data = await res.json();
    authState = {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Number(data.expires_in) * 1000 - 60000,
    };
    saveAuthToStorage();
    return true;
  } catch (e) {
    return false;
  }
}

async function ensureValidAuthToken() {
  if (authState.idToken && Date.now() < authState.expiresAt) return true;
  if (authState.refreshToken) return await refreshAuthToken();
  return false;
}

function authQuery() {
  return authState.idToken ? `?auth=${authState.idToken}` : '';
}

/* Gibt bei Erfolg den Wert zurück (kann selbst `null` sein — Firebase liefert
   das für einen leeren, aber existierenden Pfad). Bei einem echten Fehler
   (Netzwerk, Server) wird stattdessen `undefined` zurückgegeben — Aufrufer
   können so "wirklich leer" von "Anfrage fehlgeschlagen" unterscheiden und
   müssen im Fehlerfall nicht fälschlich Default-Daten zurückschreiben. */
async function fbGet(path) {
  try {
    await ensureValidAuthToken();
    const res = await fetch(`${FIREBASE_URL}/${path}.json${authQuery()}`);
    if (!res.ok) {
      console.error('Firebase GET fehlgeschlagen', path, res.status);
      return undefined;
    }
    return await res.json();
  } catch (e) {
    console.error('Firebase GET Fehler', path, e);
    return undefined;
  }
}

async function fbPut(path, data) {
  try {
    await ensureValidAuthToken();
    const res = await fetch(`${FIREBASE_URL}/${path}.json${authQuery()}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.error('Firebase PUT Fehler', path, e);
    return false;
  }
}

async function fbPatch(path, data) {
  try {
    await ensureValidAuthToken();
    const res = await fetch(`${FIREBASE_URL}/${path}.json${authQuery()}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.error('Firebase PATCH Fehler', path, e);
    return false;
  }
}

/* Push = neuer Eintrag mit von Firebase generierter, eindeutiger ID.
   Gibt die generierte ID zurück (oder null bei Fehler). */
async function fbPush(path, data) {
  try {
    await ensureValidAuthToken();
    const res = await fetch(`${FIREBASE_URL}/${path}.json${authQuery()}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.name;
  } catch (e) {
    console.error('Firebase POST Fehler', path, e);
    return null;
  }
}

async function fbDelete(path) {
  try {
    await ensureValidAuthToken();
    const res = await fetch(`${FIREBASE_URL}/${path}.json${authQuery()}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('Firebase DELETE Fehler', path, e);
    return false;
  }
}

loadAuthFromStorage();

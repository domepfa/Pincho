/* js/core.js — Kern: Helfer (esc, Formate, Entwürfe, toast), globaler state, boot(), Crews laden */
const APP_ROOT = document.getElementById('app');
const TOAST_ROOT = document.getElementById('toast-root');
const APP_TAGLINE = 'Poco a poco.';
// Insider für Salomon: am Hangboard darf's beim letzten Griff auch mal laut werden
const APP_TAGLINE_SALOMON = 'PINCHIBOY, come make me scream!';
function appTagline() {
  const name = state.member && state.member.name ? state.member.name.trim().toLowerCase() : '';
  return name === 'salomon' ? APP_TAGLINE_SALOMON : APP_TAGLINE;
}
let appTaglineTyped = false; // Buchstabe-für-Buchstabe-Effekt läuft nur einmal pro App-Öffnung, nicht bei jeder Navigation

/* Buchstaben-für-Buchstaben-Aufploppen, schnell statt gemächlich — reine
   textContent-Updates, kein Re-Render, damit es nicht mit dem sonstigen
   Rendering kollidiert. */
function typeTagline(el) {
  if (!el) return;
  let i = 0;
  const step = () => {
    const text = appTagline();
    el.textContent = text.slice(0, i);
    i++;
    if (i <= text.length) setTimeout(step, 16);
  };
  step();
}

/* ---------- Helfer ---------- */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* Unfertige Eingaben (eigener Fingerboard-Ablauf, Log-/Freestyle-Sätze) nur
   im Speicher zu halten hiess: Seite neu laden (oder Handy sperrt sich,
   PWA wird vom System beendet) → alles weg. Deshalb hier zusätzlich in
   localStorage gespiegelt und beim Start wiederhergestellt — bis der
   Nutzer aktiv speichert oder zurücksetzt. */
function saveDraft(key, data) {
  try { localStorage.setItem(STORAGE_PREFIX + 'draft_' + key, JSON.stringify(data)); } catch (e) { /* ignorieren */ }
}
function loadDraft(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'draft_' + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/* Beim Fokussieren eines Zahlenfelds den vorbelegten Wert markieren statt
   den Cursor davor zu platzieren — sonst muss man beim Weiterspringen
   übers Tastatur-"Weiter" (z. B. nach der Griff-Eingabe im Board) erst
   manuell über die alte Zahl drüber navigieren, um sie zu ersetzen. */
function selectOnFocus(id) {
  const el = document.getElementById(id);
  if (el) el.onfocus = (e) => e.target.select();
}
function toast(message, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = message;
  TOAST_ROOT.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function fmtDate(d) {
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
/* Gespeichertes Datum (JJJJ-MM-TT) für die Anzeige: 22.09.2026 */
function fmtDayKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (key || '');
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function pad2(n) { return String(n).padStart(2, '0'); }

/* ---------- State ---------- */
const PROFILE_KEY = STORAGE_PREFIX + 'profile';
const ACTIVE_CREW_KEY = STORAGE_PREFIX + 'active_crew';
function loadStoredProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; }
}
const state = {
  member: loadStoredProfile(), // {id, name, uid} — eigenes Profil (members/{id})
  route: location.hash ? location.hash.replace('#', '') : null, // null: Start-Tab aus den Nav-Einstellungen (boot)
  members: {},        // {id: {name}} — alle Leute aus den eigenen Crews (für Namen)
  memberDoc: null,    // eigenes Profil aus Firebase (board, crews, …)
  crews: {},          // {crewId: {name, owner, members}}
  crewId: (() => { try { return localStorage.getItem(ACTIVE_CREW_KEY); } catch (e) { return null; } })(),
  logs: [],           // eigene Logs, neueste zuerst
  challenges: {},      // {id: {...}} der aktiven Crew
  weekPlan: null,      // Array von 7 Tagen
};

/* ---------- Boot ---------- */
async function boot() {
  if (!state.route) state.route = defaultRoute();
  if (state.route === 'datenschutz') { renderPrivacy(); return; }
  // Einmal angemeldete Geräte starten sofort, auch ohne Netz (z. B. im
  // Gym) — das Token wird im Hintergrund erneuert, Daten kommen bis dahin
  // aus der lokalen Kopie (siehe fbGet in firebase.js).
  if (!hasStoredAuth()) { renderAuthScreen(inviteCodeFromUrl() ? 'signup' : 'login'); return; }
  ensureValidAuthToken();
  if (!state.member || state.member.uid !== authUid()) {
    state.member = null;
    await resolveProfile();
    return;
  }

  // Sofort rendern statt auf eine (ggf. langsame/wacklige) Firebase-Antwort
  // zu warten — Crews/Namen werden im Hintergrund nachgeladen und lösen
  // bei Bedarf ein Nachrendern aus (Fingerboard/Challenges nutzen sie).
  render();
  const [, customsLoaded] = await Promise.all([loadCrews(), loadCustomExercises()]);
  importDuelInbox();
  if (['fingerboard', 'challenges', 'konto'].includes(state.route) || (customsLoaded && Object.keys(customExercises).length && ['log', 'progress'].includes(state.route))) render();
  refreshChallengeUnseen();
  refreshWishDot();
}

/* Welches Profil gehört zu diesem Konto? Ohne Profil geht's in den
   Einstieg (Einladungscode). */
async function resolveProfile() {
  renderLoginMessage('Profil wird geladen…');
  const u = await fbGetNow(`users/${authUid()}`);
  if (!u.ok) {
    if (u.status === 401 || u.status === 403) { clearAuth(); renderAuthScreen('login'); return; }
    renderLoginMessage('Keine Verbindung — bitte später nochmal versuchen.', true);
    return;
  }
  const memberId = u.value && u.value.memberId;
  if (!memberId) { renderOnboarding(); return; }
  const m = await fbGetNow(`members/${memberId}`);
  if (!m.ok || !m.value) { renderLoginMessage('Profil konnte nicht geladen werden.', true); return; }
  enterWithProfile(memberId, m.value.name);
}

function enterWithProfile(id, name, crewId) {
  state.member = { id, name, uid: authUid() };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(state.member)); } catch (e) { /* ignorieren */ }
  if (crewId) setActiveCrew(crewId);
  boot();
}

function setActiveCrew(id) {
  state.crewId = id;
  try {
    if (id) localStorage.setItem(ACTIVE_CREW_KEY, id); else localStorage.removeItem(ACTIVE_CREW_KEY);
  } catch (e) { /* ignorieren */ }
}

/* Eigene Crews laden (members/{id}/crews → crews/{crewId}). Die Namen der
   Mitglieder kommen aus den Crew-Listen — fremde Profile sind privat. */
async function loadCrews() {
  const doc = await fbGet(`members/${state.member.id}`);
  if (doc === undefined) return;
  state.memberDoc = doc || {};
  if (state.memberDoc.nav) { try { localStorage.setItem(NAV_PREF_KEY, JSON.stringify(state.memberDoc.nav)); } catch (e) { /* ignorieren */ } }
  const ids = Object.keys(state.memberDoc.crews || {});
  const crews = {};
  await Promise.all(ids.map(async (id) => {
    const c = await fbGet(`crews/${id}`);
    if (c) crews[id] = c;
  }));
  // Aus einer Crew entfernt? Dann verweigert Firebase das Lesen — den
  // eigenen Verweis darauf aufräumen (nur wenn das Netz sicher da ist).
  ids.forEach((id) => {
    fbGetNow(`crews/${id}`).then((r) => {
      if (!r.ok && (r.status === 401 || r.status === 403)) {
        fbDelete(`members/${state.member.id}/crews/${id}`);
        delete state.crews[id];
        if (state.crewId === id) setActiveCrew(Object.keys(state.crews)[0] || null);
      }
    });
  });
  state.crews = crews;
  if (!state.crewId || !crews[state.crewId]) setActiveCrew(Object.keys(crews)[0] || null);
  const members = {};
  Object.values(crews).forEach((c) => {
    Object.entries(c.members || {}).forEach(([mid, m]) => { members[mid] = { name: m.name }; });
  });
  members[state.member.id] = { name: state.member.name };
  state.members = members;
}

function activeCrew() {
  return state.crewId ? state.crews[state.crewId] : null;
}

function currentMemberBoard() {
  return (state.memberDoc && state.memberDoc.board) || 'bm2000';
}

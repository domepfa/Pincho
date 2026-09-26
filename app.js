/* ================================================================
   app.js — Pincho: Login, Routing, Views, Fingerboard-Timer, Challenges.
   Vanilla JS, kein Framework, kein Build-Step.
   ================================================================= */

const APP_ROOT = document.getElementById('app');
const TOAST_ROOT = document.getElementById('toast-root');
const APP_TAGLINE = 'PINCHIBOY, come make me scream!';
let appTaglineTyped = false; // Buchstabe-für-Buchstabe-Effekt läuft nur einmal pro App-Öffnung, nicht bei jeder Navigation

/* Buchstaben-für-Buchstaben-Aufploppen, schnell statt gemächlich — reine
   textContent-Updates, kein Re-Render, damit es nicht mit dem sonstigen
   Rendering kollidiert. */
function typeTagline(el) {
  if (!el) return;
  let i = 0;
  const step = () => {
    el.textContent = APP_TAGLINE.slice(0, i);
    i++;
    if (i <= APP_TAGLINE.length) setTimeout(step, 16);
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
  try { localStorage.setItem('pincho_draft_' + key, JSON.stringify(data)); } catch (e) { /* ignorieren */ }
}
function loadDraft(key) {
  try {
    const raw = localStorage.getItem('pincho_draft_' + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/* Übungsraster als Körperbild statt langer, nach Trainingskategorie
   sortierter Liste: erst eine grobe Körperregion antippen (am Bild oder als
   Chip), dann erst erscheinen die Übungen dafür — kürzer als die alte Liste
   mit 6 Trainingskategorien. Ordnet jede Übung anhand ihres primären
   Zielmuskels (siehe MUSCLE_ZONES_SVG) automatisch einer von 5 Ober-
   gruppen zu, keine separate Pflege pro Übung nötig. Mobilität/Stretch-
   Übungen (category: 'mobility') bekommen stattdessen IMMER die eigene
   "Stretch"-Gruppe, unabhängig vom Zielmuskel — sonst würden sie mit
   Kraftübungen derselben Körperregion vermischt (z. B. Katze-Kuh unter
   "Rücken" neben Rudern), was Kraft und Dehnen visuell nicht trennt. */
const EX_SUPERGROUP_LABEL = { arm: 'Arm', brust: 'Brust', ruecken: 'Rücken', rumpf: 'Rumpf', huefte_beine: 'Beine', stretch: 'Stretch', agility: 'Agilität' };
const MUSCLE_SUPERGROUP = {
  shoulders: 'arm', biceps: 'arm', forearms_front: 'arm', triceps: 'arm', forearms_back: 'arm',
  chest: 'brust',
  neck_traps: 'ruecken', traps: 'ruecken', rear_delts: 'ruecken', lats: 'ruecken', lower_back: 'ruecken',
  abs: 'rumpf', obliques: 'rumpf',
  quads: 'huefte_beine', shins: 'huefte_beine', glutes: 'huefte_beine', hamstrings: 'huefte_beine', calves: 'huefte_beine',
};
function exerciseSupergroup(ex) {
  if (ex.category === 'mobility') return 'stretch';
  if (ex.category === 'agility') return 'agility';
  return MUSCLE_SUPERGROUP[ex.muscles.primary[0]] || 'rumpf';
}

/* Dieselbe anatomische Körperkarte wie bei der Zielmuskel-Anzeige
   (bodyMapSvg), hier aber pro Muskel antippbar. Der gewählte Muskel
   leuchtet voll, die übrigen Muskeln derselben Körperregion schwächer. */
function clickableBodyMapSvg(activeSupergroup, activeMuscle) {
  const zoneEl = (id, shape) => {
    const sg = MUSCLE_SUPERGROUP[id];
    const cls = id === activeMuscle ? 'active' : sg === activeSupergroup ? 'in-group' : '';
    return `<g class="body-zone ${cls}" data-supergroup="${sg}" data-muscle="${id}">${shape}</g>`;
  };
  const zones = Object.entries(MUSCLE_ZONES_SVG).map(([id, shape]) => zoneEl(id, shape)).join('');
  return `
    <div class="ex-body-wrap">
      <svg viewBox="${BODY_VIEWBOX}" class="muscle-map ex-body-map" role="group" aria-label="Muskel antippen">
        ${BODY_BASE_SVG}
        ${zones}
        ${BODY_DECO_SVG}
      </svg>
      <div class="ex-body-labels"><span>VORNE</span><span>HINTEN</span></div>
    </div>
  `;
}

/* Die letzten 10 TATSÄCHLICH geloggten Übungen dieser Körperregion (aus
   state.logs, das ist schon neueste zuerst sortiert), ohne Duplikate —
   Grundlage für die kompakte Vorauswahl unter dem Körperbild. */
function recentExerciseIdsForSupergroup(sg, limit) {
  const seen = new Set();
  const ids = [];
  for (const entry of state.logs) {
    if (!entry.exercises) continue;
    for (const ex of entry.exercises) {
      if (seen.has(ex.exerciseId)) continue;
      const libEx = EXERCISE_LIBRARY.find((e) => e.id === ex.exerciseId);
      if (!libEx || exerciseSupergroup(libEx) !== sg) continue;
      seen.add(ex.exerciseId);
      ids.push(ex.exerciseId);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

/* Welche Übungen zeigt die Auswahl gerade? Suche schlägt alles (über alle
   Regionen hinweg), sonst der angetippte Muskel (Hauptmuskel zuerst, dann
   Übungen, die ihn nur mittrainieren), sonst die Körperregion mit
   Kurzliste (Favoriten + zuletzt geloggte) und "Alle anzeigen". */
/* Die zuletzt geloggten Übungen über alle Regionen (neueste zuerst). */
function recentExerciseIds(limit) {
  const ids = [];
  for (const entry of state.logs) {
    for (const ex of entry.exercises || []) {
      if (!ids.includes(ex.exerciseId)) ids.push(ex.exerciseId);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

function exercisePickerSelection(list, sg, muscle, query, useRecents, showAll) {
  // Zuletzt gemachte Übungen (max. 5) stehen in jeder Auswahl zuoberst,
  // in Reihenfolge der letzten Nutzung — danach alphabetisch.
  const recent = useRecents ? recentExerciseIds(5) : [];
  const rank = (e) => { const i = recent.indexOf(e.id); return i === -1 ? 99 : i; };
  const byName = (a, b) => (rank(a) - rank(b)) || a.name.localeCompare(b.name, 'de');
  const q = (query || '').trim().toLowerCase();
  if (q) return { visible: list.filter((e) => e.name.toLowerCase().includes(q)).sort(byName), total: 0 };
  if (muscle) {
    const prim = list.filter((e) => e.muscles && e.muscles.primary.includes(muscle));
    const sec = list.filter((e) => e.muscles && !e.muscles.primary.includes(muscle) && e.muscles.secondary.includes(muscle));
    // Zuletzt gemachte zuerst, dann Hauptmuskel vor Nebenmuskel.
    const isPrim = (e) => (prim.includes(e) ? 0 : 1);
    return { visible: [...prim, ...sec].sort((a, b) => (rank(a) - rank(b)) || (isPrim(a) - isPrim(b)) || a.name.localeCompare(b.name, 'de')), total: 0 };
  }
  if (!sg) {
    // Noch nichts gewählt: direkt die zuletzt gemachten Übungen anbieten.
    return { visible: recent.map((id) => list.find((e) => e.id === id)).filter(Boolean), total: 0, recentOnly: true };
  }
  const groupList = list.filter((e) => exerciseSupergroup(e) === sg);
  let visible = groupList;
  if (useRecents && !showAll) {
    const recentIds = recentExerciseIdsForSupergroup(sg, 10);
    // Favoriten IMMER mit in die Kurzliste, auch ohne kürzlich geloggten
    // Satz — sonst müsste man sie trotz Sternchen jedes Mal unter "Alle
    // anzeigen" neu suchen.
    const favIds = groupList.filter((e) => isExerciseFavorite(e.id)).map((e) => e.id);
    const shortlistIds = Array.from(new Set([...favIds, ...recentIds]));
    if (shortlistIds.length) visible = groupList.filter((e) => shortlistIds.includes(e.id));
  }
  return { visible: visible.slice().sort(byName), total: visible.length < groupList.length ? groupList.length : 0 };
}

function exerciseCardHtml(e, selectedId) {
  const last = lastValueForExercise(e.id);
  const lastText = last && last.reps !== '' && last.reps != null
    ? `${last.weight !== '' && last.weight != null ? esc(String(last.weight)) + ' kg × ' : ''}${esc(String(last.reps))}`
    : '';
  const tags = (e.muscles ? e.muscles.primary : []).map((m) => `<span class="ex-card-tag">${esc(MUSCLE_ZONE_LABEL[m] || m)}</span>`).join('');
  const active = e.id === selectedId ? 'active' : '';
  const isRecent = recentExerciseIds(5).includes(e.id);
  return `
    <div class="ex-card ${active} ${isRecent ? 'recent' : ''}">
      <button type="button" class="ex-pick-btn ex-card-main ${active}" data-exercise="${e.id}">
        <span class="ex-card-text">
          <span class="ex-card-name">${isExerciseFavorite(e.id) ? '<span class="ex-card-star">★</span> ' : ''}${esc(e.name)}</span>
          ${tags ? `<span class="ex-card-tags">${tags}</span>` : ''}
        </span>
        ${lastText ? `<span class="ex-card-last"><strong>${lastText}</strong><small>zuletzt</small></span>` : ''}
      </button>
      <button type="button" class="ex-pick-info" data-info-exercise="${e.id}" title="Info zur Übung" aria-label="Info zu ${esc(e.name)}">i</button>
    </div>
  `;
}

function exercisePickerListHtml(list, selectedId, sg, muscle, query, useRecents, showAll) {
  const { visible, total, recentOnly } = exercisePickerSelection(list, sg, muscle, query, useRecents, showAll);
  const hasFilter = sg || muscle || (query || '').trim();
  if (!hasFilter && !visible.length) return '<p class="login-hint ex-pick-hint">Muskel antippen, Bereich wählen oder oben suchen.</p>';
  if (recentOnly) {
    return `
      <div class="ex-recent-label">Zuletzt gemacht</div>
      <div class="ex-card-list">${visible.map((e) => exerciseCardHtml(e, selectedId)).join('')}</div>
      <p class="login-hint ex-pick-hint">Oder Muskel antippen, Bereich wählen bzw. suchen.</p>
    `;
  }
  if (!visible.length) return '<p class="login-hint ex-pick-hint">Keine Übung gefunden.</p>';
  return `
    <div class="ex-card-list">${visible.map((e) => exerciseCardHtml(e, selectedId)).join('')}</div>
    ${total ? `<button type="button" class="btn ghost small" id="ex-show-all" style="width:100%;margin-top:8px;">Alle anzeigen (${total})</button>` : ''}
  `;
}

function exercisePickerBodyHtml(list, selectedId, sg, muscle, query, useRecents, showAll) {
  const muscleLabel = muscle ? (MUSCLE_ZONE_LABEL[muscle] || muscle) : '';
  return `
    <label class="ex-search">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" class="ex-search-input" placeholder="Übung suchen …" aria-label="Übung suchen" value="${esc(query || '')}">
    </label>
    ${clickableBodyMapSvg(sg, muscle)}
    ${muscle ? `<div class="ex-muscle-row"><span class="ex-muscle-pill">${esc(muscleLabel)}</span><button type="button" class="ex-muscle-clear" id="ex-muscle-clear">ganzer Bereich</button></div>` : ''}
    <div class="chip-row ex-supergroup-row">
      ${Object.entries(EX_SUPERGROUP_LABEL).filter(([key]) => list.some((e) => exerciseSupergroup(e) === key)).map(([key, label]) => `
        <button type="button" class="chip ${key === sg && !muscle ? 'active' : ''}" data-supergroup-btn="${key}">${esc(label)}</button>
      `).join('')}
    </div>
    <div class="ex-pick-list">${exercisePickerListHtml(list, selectedId, sg, muscle, query, useRecents, showAll)}</div>
  `;
}
function ensureExerciseInfoSheet() {
  let el = document.getElementById('exercise-info-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'exercise-info-sheet';
    el.className = 'info-sheet-backdrop hidden';
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el) el.classList.add('hidden'); };
  }
  return el;
}

function showExerciseInfoSheet(exerciseId, onChange) {
  const el = ensureExerciseInfoSheet();
  const muscles = exerciseMuscles(exerciseId);
  const muscleText = muscleLabelsText(muscles.primary, muscles.secondary);
  const howTo = exerciseHowTo(exerciseId);
  const isFav = isExerciseFavorite(exerciseId);
  // Dasselbe animierte Strichmännchen wie im Ablauf-Vollbild (siehe
  // exerciseFigureSvg) — bisher zeigte die Info nur den Text und die
  // Zielmuskeln, nicht die Bewegung selbst. Nur bei Übungen mit einer
  // echten Animation zeigen (EXERCISE_FIGURES), sonst bliebe nur der
  // generische 💪-Platzhalter übrig, der hier nichts beiträgt.
  const hasFigure = !!EXERCISE_FIGURES[exerciseId];
  el.innerHTML = `
    <div class="info-sheet-card">
      <button type="button" class="info-sheet-close" id="info-sheet-close">✕</button>
      <div class="info-sheet-title">${esc(exerciseName(exerciseId))}</div>
      <button type="button" class="btn ghost small" id="info-sheet-fav" style="margin-bottom:10px;">${isFav ? '★ Favorit' : '☆ Zu Favoriten hinzufügen'}</button>
      ${hasFigure ? `<div class="info-sheet-figure">${exerciseFigureSvg(exerciseId)}</div>` : ''}
      ${howTo ? `<div class="ex-howto">${esc(howTo)}</div>` : ''}
      ${muscleText ? `<div class="fb-muscle-block">${bodyMapSvg(muscles.primary, muscles.secondary)}<div class="fb-muscle-label mono">${esc(muscleText)}</div></div>` : ''}
    </div>
  `;
  el.classList.remove('hidden');
  document.getElementById('info-sheet-close').onclick = () => el.classList.add('hidden');
  document.getElementById('info-sheet-fav').onclick = () => {
    toggleExerciseFavorite(exerciseId);
    showExerciseInfoSheet(exerciseId, onChange);
    if (onChange) onChange();
  };
}

/* Rendert das Übungsraster IN den Container UND verdrahtet es — anders als
   früher (getrennte HTML-Erzeugung + Verdrahtung) muss diese Funktion beim
   Wechsel der Körperregion sich selbst neu aufrufen können, da sich dabei
   die sichtbare Übungsliste komplett ändert. */
function wireExercisePickerGrid(containerId, list, initialSelectedId, onSelect, scrollTargetId, useRecents = true) {
  const holder = document.getElementById(containerId);
  if (!holder) return;
  let selectedId = initialSelectedId;
  // Bewusst immer geschlossen starten — man soll erst bewusst einen Muskel
  // oder Bereich antippen (initialSelectedId ist oft nur ein Default).
  let sg = '';
  let muscle = '';
  let query = '';
  let showAll = false;

  // Nur die Liste neu zeichnen (z. B. beim Tippen in der Suche) — sonst
  // würde das Suchfeld bei jedem Buchstaben neu erzeugt und die Tastatur
  // ginge zu.
  const wireList = () => {
    const listHolder = holder.querySelector('.ex-pick-list');
    const showAllBtn = listHolder.querySelector('#ex-show-all');
    if (showAllBtn) showAllBtn.onclick = () => { showAll = true; renderList(); };
    listHolder.querySelectorAll('.ex-pick-btn').forEach((btn) => {
      btn.onclick = () => {
        selectedId = btn.dataset.exercise;
        listHolder.querySelectorAll('.ex-card').forEach((c) => c.classList.toggle('active', c.contains(btn)));
        listHolder.querySelectorAll('.ex-pick-btn').forEach((b) => b.classList.toggle('active', b === btn));
        onSelect(selectedId);
        if (scrollTargetId) {
          document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    });
    // Info-Button NEBEN der Übung, nicht Teil ihres Auswahl-Buttons — so
    // kann man Ausführung/Zielmuskeln nachschauen, ohne sie auszuwählen.
    listHolder.querySelectorAll('.ex-pick-info').forEach((btn) => {
      btn.onclick = () => showExerciseInfoSheet(btn.dataset.infoExercise, renderList);
    });
  };
  const renderList = () => {
    holder.querySelector('.ex-pick-list').innerHTML = exercisePickerListHtml(list, selectedId, sg, muscle, query, useRecents, showAll);
    wireList();
  };
  const render = () => {
    holder.innerHTML = exercisePickerBodyHtml(list, selectedId, sg, muscle, query, useRecents, showAll);
    holder.querySelectorAll('.body-zone').forEach((el) => {
      el.onclick = () => {
        const m = el.dataset.muscle;
        muscle = muscle === m ? '' : m;
        sg = el.dataset.supergroup;
        query = '';
        showAll = false;
        render();
      };
    });
    holder.querySelectorAll('[data-supergroup-btn]').forEach((el) => {
      el.onclick = () => { sg = el.dataset.supergroupBtn; muscle = ''; query = ''; showAll = false; render(); };
    });
    const clearBtn = holder.querySelector('#ex-muscle-clear');
    if (clearBtn) clearBtn.onclick = () => { muscle = ''; showAll = false; render(); };
    const search = holder.querySelector('.ex-search-input');
    search.oninput = () => { query = search.value; renderList(); };
    wireList();
  };
  render();
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
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function pad2(n) { return String(n).padStart(2, '0'); }

/* ---------- State ---------- */
const PROFILE_KEY = 'pincho_profile';
const ACTIVE_CREW_KEY = 'pincho_active_crew';
function loadStoredProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; }
}
const state = {
  member: loadStoredProfile(), // {id, name, uid} — eigenes Profil (members/{id})
  route: (location.hash || '#fingerboard').replace('#', ''),
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
  await loadCrews();
  if (['fingerboard', 'challenges', 'konto'].includes(state.route)) render();
  refreshChallengeUnseen();
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

/* ================================================================
   LOGIN — eigenes Konto pro Person (E-Mail + Passwort). Neu dabei nur
   mit Einladungscode einer Crew; die drei bisherigen Profile (Team-Login-
   Zeit) werden beim ersten Anmelden per "Das bin ich" übernommen.
   ================================================================= */
const AUTH_ERRORS = {
  INVALID_LOGIN_CREDENTIALS: 'E-Mail oder Passwort stimmt nicht.',
  INVALID_PASSWORD: 'E-Mail oder Passwort stimmt nicht.',
  EMAIL_NOT_FOUND: 'E-Mail oder Passwort stimmt nicht.',
  EMAIL_EXISTS: 'Zu dieser E-Mail gibt es schon ein Konto — bitte anmelden.',
  INVALID_EMAIL: 'Das ist keine gültige E-Mail-Adresse.',
  MISSING_PASSWORD: 'Bitte Passwort eingeben.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Zu viele Versuche — bitte später nochmal.',
  USER_DISABLED: 'Dieses Konto ist gesperrt.',
  NETWORK_ERROR: 'Keine Verbindung — bitte später nochmal versuchen.',
};
function authErrorText(code) {
  if (String(code).startsWith('WEAK_PASSWORD')) return 'Passwort zu kurz — mindestens 6 Zeichen.';
  return AUTH_ERRORS[code] || `Hat nicht geklappt (${code}).`;
}

function loginShell(inner) {
  APP_ROOT.innerHTML = `
    <div class="login-shell">
      <img class="login-logo" src="./assets/icon-512-any.png" alt="Pincho">
      ${inner}
    </div>
  `;
}

function renderLoginMessage(text, withRetry) {
  loginShell(`
    <p class="login-tag">${esc(text)}</p>
    ${withRetry ? '<button class="btn" id="login-retry">NOCHMAL</button><button type="button" class="link-btn" id="login-signout">Abmelden</button>' : ''}
  `);
  if (withRetry) {
    document.getElementById('login-retry').onclick = boot;
    document.getElementById('login-signout').onclick = () => logout(true);
  }
}

function renderAuthScreen(mode) {
  const isSignup = mode === 'signup';
  loginShell(`
    <p class="login-tag">${APP_TAGLINE}</p>
    <div class="chip-row auth-tabs">
      <button type="button" class="chip ${isSignup ? '' : 'active'}" data-mode="login">Anmelden</button>
      <button type="button" class="chip ${isSignup ? 'active' : ''}" data-mode="signup">Neu registrieren</button>
    </div>
    <div class="field"><label>E-Mail</label><input type="email" id="auth-email" autocomplete="email" autocapitalize="off"></div>
    <div class="field"><label>Passwort</label><input type="password" id="auth-password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${isSignup ? 'mindestens 6 Zeichen' : ''}"></div>
    ${isSignup ? `<div class="field"><label>Einladungscode</label><input type="text" id="auth-code" autocapitalize="characters" autocomplete="off" placeholder="z. B. K7P2QX" value="${esc(inviteCodeFromUrl())}"></div>` : ''}
    <button class="btn" id="auth-submit">${isSignup ? 'KONTO ERSTELLEN' : 'REIN AN DIE WAND'}</button>
    <p class="login-hint" id="auth-hint">${isSignup ? 'Den Code bekommst du von der Person, die dich einlädt. Deine Trainings sieht nur du; die Crew sieht nur, was du mit ihr teilst.' : ''}</p>
    ${isSignup ? '' : '<button type="button" class="link-btn" id="auth-forgot">Passwort vergessen?</button>'}
  `);
  document.querySelectorAll('.auth-tabs .chip').forEach((b) => { b.onclick = () => renderAuthScreen(b.dataset.mode); });
  const submit = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const codeEl = document.getElementById('auth-code');
    const code = codeEl ? normalizeInviteCode(codeEl.value) : '';
    const hint = document.getElementById('auth-hint');
    const fail = (t) => { hint.textContent = t; hint.style.color = 'var(--danger)'; };
    if (!email) { fail('Bitte E-Mail eingeben.'); return; }
    const btn = document.getElementById('auth-submit');
    btn.disabled = true;
    const r = isSignup ? await signUpEmail(email, password) : await signInEmail(email, password);
    btn.disabled = false;
    if (!r.ok) { fail(authErrorText(r.code)); return; }
    if (isSignup) { if (code) submitInviteCode(code); else renderOnboarding(); return; }
    boot();
  };
  document.getElementById('auth-submit').onclick = submit;
  APP_ROOT.querySelectorAll('input').forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
  const forgot = document.getElementById('auth-forgot');
  if (forgot) forgot.onclick = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const hint = document.getElementById('auth-hint');
    if (!email) { hint.textContent = 'Zuerst oben die E-Mail eingeben.'; hint.style.color = 'var(--danger)'; return; }
    const r = await sendPasswordReset(email);
    hint.style.color = '';
    hint.textContent = r.ok || r.code === 'EMAIL_NOT_FOUND'
      ? 'Falls es zu dieser E-Mail ein Konto gibt, ist ein Link zum Zurücksetzen unterwegs.'
      : authErrorText(r.code);
  };
}

/* Einladungslink …/?code=K7P2QX: Code vorausfüllen. */
function inviteCodeFromUrl() {
  try { return normalizeInviteCode(new URLSearchParams(location.search).get('code')); } catch (e) { return ''; }
}

/* ---------- Einstieg: Einladungscode → "Das bin ich" oder neues Profil ---------- */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O, 1/I
function normalizeInviteCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function randomInviteCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
}
async function uniqueInviteCode() {
  for (let i = 0; i < 5; i++) {
    const code = randomInviteCode();
    const r = await fbGetNow(`invites/${code}`);
    if (r.ok && r.value === null) return code;
  }
  return null;
}
/* Schlüssel für die Namensliste (names/…): jeder Name nur einmal,
   Gross/Klein egal. Firebase-Schlüssel dürfen . # $ [ ] / nicht enthalten. */
function nameKey(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]/]/g, '_');
}

/* Admin = die in den Datenbank-Regeln eingetragene E-Mail (bestätigt).
   Die App fragt einfach, ob sie die alte Mitgliederliste lesen darf. */
async function probeAdmin() {
  const r = await fbGetNow('members');
  return r.ok ? r.value || {} : null;
}

async function renderOnboarding(errorText) {
  const verified = authClaims().email_verified === true;
  loginShell(`
    <p class="login-tag">Willkommen! Gib den Einladungscode deiner Crew ein.</p>
    <div class="field"><label>Einladungscode</label><input type="text" id="onb-code" autocapitalize="characters" autocomplete="off" placeholder="z. B. K7P2QX" value="${esc(inviteCodeFromUrl())}"></div>
    <button class="btn" id="onb-submit">WEITER</button>
    <p class="login-hint" id="onb-hint" ${errorText ? 'style="color:var(--danger)"' : ''}>${esc(errorText || `Angemeldet als ${authEmail() || ''}`)}</p>
    <div id="onb-admin"></div>
    ${verified ? '' : '<p class="login-hint">E-Mail noch nicht bestätigt — Link im Postfach antippen. <button type="button" class="link-btn inline" id="onb-verify">Nochmal senden</button> · <button type="button" class="link-btn inline" id="onb-recheck">Neu prüfen</button></p>'}
    <button type="button" class="link-btn" id="onb-signout">Abmelden</button>
  `);
  const submit = () => submitInviteCode(normalizeInviteCode(document.getElementById('onb-code').value));
  document.getElementById('onb-submit').onclick = submit;
  document.getElementById('onb-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  document.getElementById('onb-signout').onclick = () => logout(true);
  const recheck = document.getElementById('onb-recheck');
  if (recheck) recheck.onclick = () => renderOnboarding();
  const verifyBtn = document.getElementById('onb-verify');
  if (verifyBtn) verifyBtn.onclick = async () => {
    const r = await sendVerifyEmail();
    toast(r.ok ? 'Bestätigungs-Mail gesendet.' : 'Konnte keine Mail senden.', r.ok ? 'ok' : 'err');
  };

  // Admin-Einstieg: bestehende Crew aus der Team-Login-Zeit übernehmen.
  // Das Token frisch holen, damit eine eben bestätigte E-Mail zählt.
  authState.expiresAt = 0;
  await ensureValidAuthToken();
  const legacy = await probeAdmin();
  const holder = document.getElementById('onb-admin');
  if (!holder || legacy === null) return;
  const mig = await fbGetNow('migration');
  const done = mig.ok && mig.value && mig.value.crewId;
  const unclaimed = Object.entries(legacy).filter(([, m]) => !m.uid);
  holder.innerHTML = `
    <div class="card onb-admin-card">
      <p class="card-title">Admin</p>
      ${!done && unclaimed.length ? '<button class="btn ghost small" id="onb-migrate">Bestehende Crew übernehmen</button>' : ''}
      <button class="btn ghost small" id="onb-admin-new">Ohne Code starten</button>
    </div>
  `;
  const migBtn = document.getElementById('onb-migrate');
  if (migBtn) migBtn.onclick = () => renderMigration(legacy);
  document.getElementById('onb-admin-new').onclick = () => renderNewProfile(null);
}

/* Code prüfen: users/{uid}/joinCode setzen (erst dann darf man die Crew
   sehen), Einladung lesen, dann "Das bin ich"-Liste bzw. neues Profil. */
async function submitInviteCode(code) {
  if (!code) { renderOnboarding('Bitte Einladungscode eingeben.'); return; }
  renderLoginMessage('Code wird geprüft…');
  const set = await fbUpdateNow(`users/${authUid()}`, { joinCode: code });
  const inv = set.ok ? await fbGetNow(`invites/${code}`) : { ok: false };
  if (!set.ok || !inv.ok) { renderOnboarding('Keine Verbindung — bitte nochmal versuchen.'); return; }
  if (!inv.value || !inv.value.crewId) { renderOnboarding('Diesen Code gibt es nicht (mehr).'); return; }
  const crew = await fbGetNow(`crews/${inv.value.crewId}`);
  if (!crew.ok || !crew.value) { renderOnboarding('Crew konnte nicht geladen werden.'); return; }
  renderJoinChoice(code, inv.value.crewId, crew.value);
}

function renderJoinChoice(code, crewId, crew) {
  const legacy = Object.entries(crew.members || {}).filter(([, m]) => m.legacy);
  if (!legacy.length) { renderNewProfile({ code, crewId, crew }); return; }
  loginShell(`
    <p class="login-tag">Crew <b>${esc(crew.name)}</b>. Hast du schon vorher mit Pincho trainiert?</p>
    <div class="chip-row" id="join-legacy">
      ${legacy.map(([mid, m]) => `<button type="button" class="chip" data-mid="${esc(mid)}">Das bin ich: ${esc(m.name)}</button>`).join('')}
    </div>
    <button class="btn ghost" id="join-new">Ich bin neu</button>
    <p class="login-hint">"Das bin ich" übernimmt das bisherige Profil mit allen Trainings.</p>
  `);
  document.querySelectorAll('#join-legacy .chip').forEach((b) => {
    b.onclick = async () => {
      const mid = b.dataset.mid;
      const name = crew.members[mid].name;
      if (!confirm(`Profil "${name}" mit deinem Konto verbinden?`)) return;
      const r = await fbUpdateNow('', {
        [`members/${mid}/uid`]: authUid(),
        [`members/${mid}/crews/${crewId}`]: true,
        [`users/${authUid()}/memberId`]: mid,
        [`crews/${crewId}/members/${mid}`]: { name, joinedAt: Date.now() },
      });
      if (!r.ok) { toast('Hat nicht geklappt — ist das Profil schon vergeben?', 'err'); return; }
      fbUpdateNow(`users/${authUid()}`, { joinCode: null });
      enterWithProfile(mid, name, crewId);
    };
  });
  document.getElementById('join-new').onclick = () => renderNewProfile({ code, crewId, crew });
}

/* Neues Profil (join = {code, crewId, crew}; null = Admin ohne Code). */
function renderNewProfile(join) {
  loginShell(`
    <p class="login-tag">${join ? `Crew <b>${esc(join.crew.name)}</b> — ` : ''}Wie sollen dich die anderen sehen?</p>
    <div class="field"><label>Name</label><input type="text" id="new-name" maxlength="30" autocomplete="nickname"></div>
    <button class="btn" id="new-submit">LOS GEHT'S</button>
    <p class="login-hint" id="new-hint">Jeder Name gibt es nur einmal.</p>
    <button type="button" class="link-btn" id="new-back">Zurück</button>
  `);
  document.getElementById('new-back').onclick = () => renderOnboarding();
  const submit = async () => {
    const name = document.getElementById('new-name').value.trim();
    const hint = document.getElementById('new-hint');
    const fail = (t) => { hint.textContent = t; hint.style.color = 'var(--danger)'; };
    if (!name) { fail('Bitte einen Namen eingeben.'); return; }
    const taken = await fbGetNow(`names/${nameKey(name)}`);
    if (!taken.ok) { fail('Keine Verbindung — bitte nochmal versuchen.'); return; }
    if (taken.value) { fail(`"${name}" gibt es schon — bitte einen anderen Namen.`); return; }
    const mid = generatePushId();
    const updates = {
      [`members/${mid}`]: { name, board: 'bm2000', uid: authUid(), createdAt: Date.now(), ...(join ? { crews: { [join.crewId]: true } } : {}) },
      [`users/${authUid()}/memberId`]: mid,
      [`names/${nameKey(name)}`]: mid,
    };
    if (join) updates[`crews/${join.crewId}/members/${mid}`] = { name, joinedAt: Date.now(), code: join.code };
    const r = await fbUpdateNow('', updates);
    if (!r.ok) { fail('Hat nicht geklappt — ist der Code noch gültig?'); return; }
    fbUpdateNow(`users/${authUid()}`, { joinCode: null });
    enterWithProfile(mid, name, join && join.crewId);
  };
  document.getElementById('new-submit').onclick = submit;
  document.getElementById('new-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

/* Admin, einmalig: die Crew aus der Team-Login-Zeit wird zur ersten Crew.
   Alle bisherigen Profile kommen als "noch nicht übernommen" hinein,
   Challenges und geteilte Vorlagen werden in die Crew kopiert. */
function renderMigration(legacy) {
  const unclaimed = Object.entries(legacy).filter(([, m]) => !m.uid);
  loginShell(`
    <p class="login-tag">Bestehende Crew übernehmen. Welches Profil bist du?</p>
    <div class="field"><label>Name der Crew</label><input type="text" id="mig-name" value="Pincho Crew" maxlength="40"></div>
    <div class="chip-row" id="mig-pick">
      ${unclaimed.map(([mid, m]) => `<button type="button" class="chip" data-mid="${esc(mid)}">${esc(m.name)}</button>`).join('')}
    </div>
    <p class="login-hint" id="mig-hint">Die anderen übernehmen ihr Profil später selbst mit dem Einladungscode.</p>
    <button type="button" class="link-btn" id="mig-back">Zurück</button>
  `);
  document.getElementById('mig-back').onclick = () => renderOnboarding();
  document.querySelectorAll('#mig-pick .chip').forEach((b) => {
    b.onclick = async () => {
      const me = b.dataset.mid;
      const crewName = document.getElementById('mig-name').value.trim() || 'Pincho Crew';
      const hint = document.getElementById('mig-hint');
      if (!confirm(`Du bist "${legacy[me].name}" — Crew "${crewName}" anlegen?`)) return;
      hint.textContent = 'Wird übernommen…';
      const code = await uniqueInviteCode();
      if (!code) { hint.textContent = 'Keine Verbindung — bitte nochmal versuchen.'; return; }
      const crewId = generatePushId();
      const now = Date.now();
      const crewMembers = {};
      const updates = {};
      unclaimed.forEach(([mid, m]) => {
        crewMembers[mid] = mid === me ? { name: m.name, joinedAt: now } : { name: m.name, legacy: true };
        const key = `names/${nameKey(m.name)}`;
        if (!(key in updates)) updates[key] = mid; // doppelte Namen: nur der erste bekommt den Eintrag
      });
      Object.assign(updates, {
        [`members/${me}/uid`]: authUid(),
        [`members/${me}/crews/${crewId}`]: true,
        [`users/${authUid()}/memberId`]: me,
        [`crews/${crewId}`]: { name: crewName, owner: me, createdAt: now, members: crewMembers },
        [`crewSecrets/${crewId}`]: { inviteCode: code },
        [`invites/${code}`]: { crewId, crewName },
        migration: { crewId, at: now },
      });
      const r = await fbUpdateNow('', updates);
      if (!r.ok) { hint.textContent = 'Hat nicht geklappt (Admin-E-Mail bestätigt?).'; return; }
      const [ch, st] = await Promise.all([fbGetNow('challenges'), fbGetNow('sharedTemplates')]);
      const copy = {};
      if (ch.ok && ch.value) copy.challenges = ch.value;
      if (st.ok && st.value) copy.sharedTemplates = st.value;
      if (Object.keys(copy).length && !(await fbUpdateNow(`crewData/${crewId}`, copy)).ok) {
        toast('Challenges/Vorlagen konnten nicht kopiert werden.', 'err');
      }
      toast(`Crew angelegt — Einladungscode ${code}`, 'ok');
      enterWithProfile(me, legacy[me].name, crewId);
    };
  });
}

/* Abmelden: Konto, lokale Kopie und Warteschlange dieses Geräts vergessen. */
function logout(skipConfirm) {
  const pending = pendingWriteCount();
  if (!skipConfirm) {
    const msg = pending
      ? `${pending} Änderung(en) sind noch nicht hochgeladen und gehen beim Abmelden verloren. Trotzdem abmelden?`
      : 'Abmelden?';
    if (!confirm(msg)) return;
  }
  clearLocalData();
  clearAuth();
  try { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(ACTIVE_CREW_KEY); } catch (e) { /* ignorieren */ }
  state.member = null;
  state.memberDoc = null;
  state.crews = {};
  state.members = {};
  state.crewId = null;
  setChallengeUnseenCount(0);
  renderAuthScreen('login');
}

/* ================================================================
   BENACHRICHTIGUNGSPUNKT (Challenges)
   Echtes Push (auch bei geschlossener App) bräuchte einen eigenen Server,
   der bei einer neuen Challenge aktiv etwas an alle Geräte schickt — das
   hat diese App (rein statisch, direkt gegen Firebase) nicht. Was ohne
   Server geht: sobald die App geöffnet wird, im Hintergrund nachsehen, ob
   es neue Challenges von anderen gibt, und dafür sowohl einen Punkt im
   Tab-Menü als auch — wo vom Betriebssystem unterstützt (Badging API,
   z. B. installierte PWA auf Android/Desktop) — einen Zähler direkt auf
   dem App-Icon setzen. Kein Echtzeit-Push bei gesperrtem Handy, aber
   sichtbar, sobald man die App das nächste Mal öffnet. */
let challengeUnseenCount = 0;

function getChallengesSeenAt() {
  return Number(localStorage.getItem('pincho_challenges_seen_at') || 0);
}
/* Zählt neue Challenges über alle eigenen Crews (nicht nur die aktive). */
async function refreshChallengeUnseen() {
  let n = 0;
  await Promise.all(Object.keys(state.crews).map(async (id) => {
    const raw = await fbGet(`crewData/${id}/challenges`);
    if (raw) n += countUnseenChallenges(raw);
  }));
  if (state.member) setChallengeUnseenCount(n);
}
function countUnseenChallenges(challengesObj) {
  const seenAt = getChallengesSeenAt();
  const now = Date.now();
  return Object.values(challengesObj || {})
    .filter((c) => c.createdBy !== state.member.id && c.createdAt > seenAt && now < c.expiresAt)
    .length;
}
function setChallengeUnseenCount(n) {
  challengeUnseenCount = n;
  const dot = document.getElementById('nav-challenge-dot');
  if (dot) dot.hidden = n === 0;
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
    else if (n === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch (e) { /* Badging API evtl. nicht unterstützt */ }
}
function markChallengesSeenNow() {
  try { localStorage.setItem('pincho_challenges_seen_at', String(Date.now())); } catch (e) { /* ignorieren */ }
  setChallengeUnseenCount(0);
}

/* ================================================================
   SHELL + ROUTER
   ================================================================= */
/* icon = Pfad-Daten eines 24er-Strich-Icons (stroke, kein fill). */
const NAV_ITEMS = [
  { route: 'fingerboard', label: 'Board', icon: 'M3 8a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2z M7 10h.01 M12 10h.01 M17 10h.01' },
  { route: 'log', label: 'Gym', icon: 'M6 8v8 M3 10v4 M18 8v8 M21 10v4 M6 12h12' },
  { route: 'plan', label: 'Agenda', icon: 'M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z M3 10h18 M8 3v4 M16 3v4' },
  { route: 'progress', label: 'Fortschritt', icon: 'M4 19h16 M5 15l4-5 4 3 6-8' },
  { route: 'challenges', label: 'Challenges', icon: 'M5 21V4 M5 4h11l-2 4 2 4H5' },
];
function navIconSvg(d) {
  return `<svg class="nav-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Beta läuft unter /beta/ — dort das BETA-Schild zeigen, sonst nicht.
const IS_BETA = location.pathname.includes('/beta/');
function renderShell(contentHtml) {
  const memberName = state.member ? esc(state.member.name) : '';
  APP_ROOT.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <span class="mark">PIN<em>CHO</em>${IS_BETA ? ' <span class="beta-badge">BETA</span>' : ''}</span>
        <p class="app-tagline mono" id="app-tagline">${appTaglineTyped ? esc(APP_TAGLINE) : ''}</p>
      </div>
      <a class="who" href="#konto" title="Konto &amp; Crews">
        <span class="name mono">${memberName}</span>
        <span class="logout ${state.route === 'konto' ? 'active' : ''}">KONTO</span>
      </a>
    </div>
    <div class="shell">${contentHtml}</div>
    <nav class="bottomnav">
      ${NAV_ITEMS.map((n) => `<a href="#${n.route}" class="${state.route === n.route ? 'active' : ''}"><span class="nav-pill">${navIconSvg(n.icon)}</span><span class="nav-label">${n.label}</span>${n.route === 'challenges' ? `<span class="nav-dot" id="nav-challenge-dot" ${challengeUnseenCount ? '' : 'hidden'}></span>` : ''}</a>`).join('')}
      <span class="nav-indicator" id="nav-indicator"></span>
    </nav>
  `;
  positionNavIndicator();
  if (!appTaglineTyped) {
    appTaglineTyped = true;
    typeTagline(document.getElementById('app-tagline'));
  }
}

/* Schiebt die kleine Leuchtleiste unter dem aktiven Tab an die richtige
   Stelle — per JS statt reinem CSS, weil die Tab-Breiten durch die
   Textlänge variieren (flex:1 macht sie zwar gleich breit, aber nur zur
   Laufzeit messbar). Ein zweiter Aufruf nach Resize hält es bei
   Bildschirmdrehung synchron. */
function positionNavIndicator() {
  const nav = document.querySelector('.bottomnav');
  const active = nav && nav.querySelector('a.active');
  const indicator = document.getElementById('nav-indicator');
  if (!nav || !indicator) return;
  if (!active) { indicator.style.width = '0'; return; } // z. B. Konto-Seite, nicht in der Navigation
  indicator.style.left = active.offsetLeft + 'px';
  indicator.style.width = active.offsetWidth + 'px';
}
window.addEventListener('resize', positionNavIndicator);

/* Fliegender "Starten"-Button — bleibt beim Scrollen sichtbar, damit ein
   fertig gebauter Plan (Gym) oder Ablauf (Fingerboard) auch ohne
   Runterscrollen zum echten Start-Button gestartet werden kann. Reine
   Sichtbarkeits-/Positions-Hülle: klickt beim Antippen immer nur den
   schon vorhandenen, echten Start-Button an (z. B. #plan-start,
   #fb-start-ablauf) — der eigentliche Start-Vorgang bleibt dadurch exakt
   derselbe wie vorher. */
function ensureFabStart() {
  let el = document.getElementById('fab-start');
  if (!el) {
    el = document.createElement('button');
    el.id = 'fab-start';
    el.type = 'button';
    el.className = 'hidden';
    document.body.appendChild(el);
  }
  return el;
}
function hideFabStart() {
  const el = document.getElementById('fab-start');
  if (el) el.classList.add('hidden');
}
function showFabStart(label, targetId) {
  const el = ensureFabStart();
  const target = document.getElementById(targetId);
  // Ohne startbaren Inhalt (z. B. leerer Ablauf) gar nicht erst zeigen —
  // ein ausgegrauter, schwebender Knopf wirkte nur kaputt.
  if (!target || target.disabled) { hideFabStart(); return; }
  el.textContent = label;
  el.disabled = target.disabled;
  el.classList.remove('hidden');
  el.onclick = () => {
    const t = document.getElementById(targetId);
    if (t && !t.disabled) t.click();
  };
}

/* Grosse Trainings-Leiste unten (ersetzt während einer laufenden Freestyle-
   Session/Plan-Ausführung den fliegenden Start-Button): zeigt Satz- bzw.
   Pausenzeit gross und EINEN breiten Knopf für den nächsten Schritt
   (Start → Satz beenden → Nächster Satz) — immer an derselben Stelle
   unter dem Daumen, statt die kleine Box in der Liste suchen zu müssen.
   Nur die Eingabe von Gewicht/Wdh. bleibt in der Karte der Übung (unten
   würde die Tastatur sie verdecken). Inhalt baut renderFsPanel(). */
function ensureFsDock() {
  let el = document.getElementById('fs-dock');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fs-dock';
    el.className = 'hidden';
    document.body.appendChild(el);
  }
  return el;
}
function hideFsDock() {
  const el = document.getElementById('fs-dock');
  if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
  document.body.classList.remove('has-fs-dock');
}

function render() {
  if (!state.member) { boot(); return; }
  hideFabStart(); // jede Route entscheidet selbst, ob/wofür sie ihn zeigt
  hideFsDock();
  switch (state.route) {
    case 'log': renderLog(); break;
    case 'fingerboard': renderFingerboard(); break;
    case 'challenges': renderChallenges(); break;
    case 'progress': renderProgress(); break;
    case 'konto': renderKonto(); break;
    case 'plan':
    default: renderPlan(); break;
  }
}

/* ================================================================
   PLAN
   ================================================================= */
async function renderPlan() {
  renderShell(`<div class="sec-head"><h2 class="sec-title">Wochenplan</h2><div class="sec-rule"></div></div>
    <div class="list" id="plan-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>`);

  let plan = await fbGet(`plans/${state.member.id}`);
  if (plan === undefined) {
    // Anfrage fehlgeschlagen (z. B. kein Netz) — Default nur lokal anzeigen,
    // NICHT zurückschreiben, sonst würde ein evtl. schon angepasster Plan
    // beim nächsten erfolgreichen Laden überschrieben.
    plan = DEFAULT_WEEK_PLAN;
  } else if (plan === null) {
    // Wirklich noch kein Plan für dieses Mitglied vorhanden — einmalig anlegen.
    plan = DEFAULT_WEEK_PLAN;
    await fbPut(`plans/${state.member.id}`, plan);
  }
  state.weekPlan = plan;

  const jsToday = new Date().getDay(); // 0=So
  const todayIdx = jsToday === 0 ? 6 : jsToday - 1; // Mo=0 ... So=6

  const list = document.getElementById('plan-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = plan.map((d, i) => `
    <div class="day-row ${i === todayIdx ? 'today' : ''}">
      <span class="d mono">${d.day}</span>
      <div class="fields">
        <input type="text" value="${esc(d.title)}" data-idx="${i}" data-field="title" placeholder="Titel">
        <select data-idx="${i}" data-field="tag">
          ${Object.keys(TAG_LABEL).map((t) => `<option value="${t}" ${d.tag === t ? 'selected' : ''}>${TAG_LABEL[t]}</option>`).join('')}
        </select>
      </div>
      ${i === todayIdx ? '<span class="tag-pill">HEUTE</span>' : ''}
    </div>
  `).join('');

  list.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', async () => {
      const idx = Number(el.dataset.idx);
      state.weekPlan[idx][el.dataset.field] = el.value;
      await fbPut(`plans/${state.member.id}`, state.weekPlan);
      toast('Gespeichert.', 'ok');
    });
  });
}

/* ================================================================
   LOG
   ================================================================= */
const LOG_TYPE_LABEL = { klettern: 'Klettern', gym: 'Gym', fingerboard: 'Fingerboard', mobility: 'Mobility', yoga: 'Yoga', jogging: 'Jogging', velo: 'Velo', pilates: 'Pilates', warmup: 'Warm-up', flow: 'Flow', sonstiges: 'Sonstiges' };
/* logBuilder ist jetzt der PLAN-EDITOR (Ziel-Sätze/Wdh./Gewicht, kein
   Ergebnis) — siehe sessionPlans weiter unten fürs Speichern/Laden/
   Ausführen. */
let logBuilder = { exercises: loadDraft('log_exercises') || [] };
let logMode = 'planned'; // 'planned' | 'freestyle' | 'execute' | 'wall' | 'flow' — 'execute' nur über "Plan starten" erreichbar
let logPickerExerciseId = EXERCISE_LIBRARY[0].id;
/* Freestyle: kein fester Plan — Übung wählen, Satz für Satz mit Gewicht/Wdh
   erfassen (auch mehrfach dieselbe Übung, z. B. Aufwärm- vs. Arbeitssätze),
   erst beim Speichern wird daraus ein Log-Eintrag. exercises: Liste von
   {exerciseId, sets: [{weight, reps}, ...]} in der Reihenfolge, in der die
   Übungen zum ersten Mal gewählt wurden. */
let freestyleBuilder = loadDraft('freestyle') || { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id, sessionStartedAt: null };

/* Eigene, in Firebase gespeicherte Trainingspläne (Name + Ziel-Übungen) —
   dasselbe Vorlagen-Muster wie fb.templates beim Fingerboard: bleiben nach
   dem Ausführen erhalten, damit man denselben Plan immer wieder starten
   kann, statt ihn jedes Mal neu zusammenzustellen. */
let sessionPlans = [];
async function loadSessionPlans() {
  const raw = await fbGet(`sessionPlans/${state.member.id}`);
  sessionPlans = raw ? Object.entries(raw).map(([key, p]) => ({ ...p, id: key })) : [];
}

/* Freitext-Notiz pro Übung, z. B. Maschineneinstellungen (Sitzhöhe, ROM,
   Polsterposition) — an Geräten muss man sich das sonst jedes Mal neu
   merken/erraten. Pro Mitglied und Übung, nicht pro Session. */
let exerciseSettings = {};
async function loadExerciseSettings() {
  const raw = await fbGet(`exerciseSettings/${state.member.id}`);
  exerciseSettings = raw || {};
}

/* Favoriten: per Sternchen in der Info-Ansicht markierbar, damit man
   häufig gebrauchte Übungen (an mehreren Trainingsorten, unterschiedliche
   Geräte) im Auswahlraster schnell wiederfindet, statt sie jedes Mal neu
   unter "Alle anzeigen" zu suchen. Pro Mitglied, nicht pro Übungsliste. */
let exerciseFavorites = {};
async function loadExerciseFavorites() {
  const raw = await fbGet(`exerciseFavorites/${state.member.id}`);
  exerciseFavorites = raw || {};
}
function isExerciseFavorite(id) {
  return !!exerciseFavorites[id];
}
function toggleExerciseFavorite(id) {
  if (exerciseFavorites[id]) {
    delete exerciseFavorites[id];
    fbDelete(`exerciseFavorites/${state.member.id}/${id}`);
  } else {
    exerciseFavorites[id] = true;
    fbPut(`exerciseFavorites/${state.member.id}/${id}`, true);
  }
}

/* Wdh./Zeit-Wahl pro Übung — standardmässig entscheidet die feste
   isHold-Eigenschaft aus der Übungsbibliothek (Plank, Wall Sit, ...), aber
   jede Übung soll umschaltbar sein (z. B. Schulterkreisen zeitbasiert
   loggen). Einmal umgeschaltet bleibt das dauerhaft gemerkt (pro Mitglied
   und Übung), bis man es wieder ändert — bereits geloggte Sätze tragen ihr
   Zeit/Wdh.-Merkmal aber direkt am Satz selbst (siehe set.unit), damit ein
   späteres Umschalten der Übungs-Voreinstellung alte Sätze NIE rückwirkend
   umdeutet. */
let exerciseUnitPrefs = {};
async function loadExerciseUnitPrefs() {
  const raw = await fbGet(`exerciseUnitPrefs/${state.member.id}`);
  exerciseUnitPrefs = raw || {};
}
function exerciseUnit(id) {
  return exerciseUnitPrefs[id] || (exerciseIsHold(id) ? 'time' : 'reps');
}
function setExerciseUnit(id, unit) {
  exerciseUnitPrefs[id] = unit;
  fbPut(`exerciseUnitPrefs/${state.member.id}/${id}`, unit);
}
/* Anzeige-Einheit EINES bereits geloggten Satzes: der Satz selbst entscheidet
   (set.unit), falls vorhanden — nur bei älteren, vor diesem Feature
   geloggten Sätzen (kein set.unit gespeichert) fällt es auf die feste
   isHold-Eigenschaft zurück, damit die Anzeige für die identisch bleibt. */
function setUnitSuffix(exerciseId, set) {
  const unit = (set && set.unit) || (exerciseIsHold(exerciseId) ? 'time' : 'reps');
  return unit === 'time' ? 's' : '';
}

/* Geteilte Vorlagen — EINE flache, member-übergreifende Liste (statt eigener
   Collection pro Feature), sichtbar für die ganze Crew, nicht nur den, der
   sie gespeichert hat (anders als fingerboardTemplates/sessionPlans/
   wallTemplates, die pro Mitglied liegen). `kind` unterscheidet Fingerboard-
   Abläufe, Geplant-Pläne und Ausdauer-Blockabläufe innerhalb derselben
   Liste. */
let sharedTemplates = [];
async function loadSharedTemplates() {
  const raw = state.crewId ? await fbGet(`crewData/${state.crewId}/sharedTemplates`) : null;
  sharedTemplates = raw ? Object.entries(raw).map(([key, t]) => ({ ...t, id: key })) : [];
}
async function shareTemplate(kind, name, data) {
  if (!state.crewId) { toast('Du bist in keiner Crew — unter KONTO beitreten.', 'err'); return false; }
  const key = await fbPush(`crewData/${state.crewId}/sharedTemplates`, {
    kind, name, ...data,
    createdBy: state.member.id,
    createdByName: state.member.name,
    createdAt: Date.now(),
  });
  return !!key;
}
function sharedTemplatesOfKind(kind) {
  return sharedTemplates.filter((t) => t.kind === kind);
}

/* Laufende Ausführung eines Plans: gleiche Form wie freestyleBuilder
   (exercises: [{exerciseId, sets:[...]}], activeIndex), zusätzlich die
   Ziel-Werte aus dem Plan pro Übung fürs "Ziel: ..."-Label. Wird nur über
   "Plan starten" gesetzt; null, solange keine Ausführung läuft. */
let planExecution = null;

/* Der für den aktuellen logMode "aktive" Satz-Builder — Freestyle und
   Plan-Ausführung sehen UI-seitig identisch aus (Übung wählen/aktivieren,
   Satz für Satz erfassen), deshalb teilen sie sich dieselben Render-
   Funktion (renderFsPanel) statt doppelten Code. */
function activeSetBuilder() {
  return logMode === 'execute' ? planExecution : freestyleBuilder;
}

/* Letzter bekannter Wert für eine Übung — über die komplette Session-
   Historie (state.logs, neueste zuerst), egal ob geplant oder freestyle
   geloggt. Zeigt "wo man beim letzten Mal stand", damit man beim
   Freestyle-Training nicht raten muss. */
function lastValueForExercise(exerciseId) {
  for (const entry of state.logs) {
    if (!entry.exercises) continue;
    for (const ex of entry.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      if (Array.isArray(ex.sets)) {
        if (ex.sets.length) {
          const last = ex.sets[ex.sets.length - 1];
          return { weight: last.weight, reps: last.reps };
        }
      } else if (ex.reps !== '' && ex.reps != null) {
        return { weight: ex.weight, reps: ex.reps };
      }
    }
  }
  return null;
}

/* Kurzdatum für die Verlaufs-Tabelle (TT.MM.) statt des vollen Datums —
   dort steht es als Spaltenkopf, da reicht Tag/Monat zur Unterscheidung. */
function fmtShortDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

/* Die letzten `limit` Sessions, in denen diese Übung mit echten Einzel-
   sätzen (Array, nicht der alte feste Zielwert) vorkam — neueste zuerst,
   da state.logs schon so sortiert ist. Grundlage für die Vergleichs-
   tabelle: "was habe ich bei Satz 1/2/3 in den letzten Trainings gemacht". */
function historyForExercise(exerciseId, limit) {
  const sessions = [];
  for (const entry of state.logs) {
    if (!entry.exercises || sessions.length >= limit) break;
    const ex = entry.exercises.find((e) => e.exerciseId === exerciseId && Array.isArray(e.sets) && e.sets.length);
    if (ex) sessions.push({ date: entry.date, sets: ex.sets });
  }
  return sessions;
}

/* "Volumen" eines Satzes (Gewicht × Wdh./Zeit) statt nur der reinen
   Wiederholungszahl — sonst sähe mehr Gewicht bei bewusst weniger
   Wiederholungen (ein schwererer, nicht schwächerer Satz!) fälschlich nach
   einer Verschlechterung aus. Kein Gewicht hinterlegt (Bodyweight-Übungen
   wie Klimmzug/Liegestütz) heisst Faktor 1 — dann zählt wieder einfach die
   Wiederholungszahl selbst, es gibt ja nichts zum Multiplizieren. */
function setVolume(s) {
  const weight = (s.weight !== '' && s.weight != null) ? Number(s.weight) : 1;
  const reps = Number(s.reps);
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  return weight * reps;
}

/* Trend-Pfeil pro Übung: vergleicht Satz für Satz (gleicher Index) mit der
   Vorgänger-Session dieser Übung, summiert die Volumen-Differenzen —
   Grundlage ist dieselbe Wdh./Zeit-Logik wie beim einzelnen Satz-Delta
   (siehe setUnitSuffix), nur pro Übung statt pro Satz aggregiert. `null`,
   wenn es nichts Vergleichbares gibt (erstes Mal, oder nur Einheitswechsel). */
function exerciseTrend(exerciseId, sets, priorSets) {
  if (!Array.isArray(sets) || !Array.isArray(priorSets) || !priorSets.length) return null;
  let sum = 0;
  let compared = 0;
  sets.forEach((s, i) => {
    const prev = priorSets[i];
    if (!prev) return;
    if (setUnitSuffix(exerciseId, prev) !== setUnitSuffix(exerciseId, s)) return;
    const curVol = setVolume(s);
    const prevVol = setVolume(prev);
    if (curVol != null && prevVol != null) { sum += curVol - prevVol; compared++; }
  });
  if (!compared) return null;
  if (sum > 0) return { symbol: '↑', cls: 'fs-trend-up' };
  if (sum < 0) return { symbol: '↓', cls: 'fs-trend-down' };
  return { symbol: '→', cls: 'fs-trend-flat' };
}

/* Vergleichstabelle über die letzten 3 Sessions: Zeilen = Satz 1/2/3...,
   Spalten = Datum je Session (neuste links) — zeigt die Tendenz auf einen
   Blick, nicht nur einen einzelnen "letzten Wert". */
function exerciseHistoryTableHtml(exerciseId) {
  const sessions = historyForExercise(exerciseId, 3);
  if (!sessions.length) return '';
  const maxSets = Math.max(...sessions.map((s) => s.sets.length));
  let rows = '';
  for (let i = 0; i < maxSets; i++) {
    rows += `<tr><td class="hist-row-label mono">Satz ${i + 1}</td>${sessions.map((s) => {
      const set = s.sets[i];
      if (!set) return '<td class="mono">–</td>';
      const w = set.weight !== '' && set.weight != null ? esc(String(set.weight)) + 'kg × ' : '';
      return `<td class="mono">${w}${esc(String(set.reps))}${setUnitSuffix(exerciseId, set)}</td>`;
    }).join('')}</tr>`;
  }
  return `
    <div class="hist-table-label mono">Letzte Trainings im Vergleich</div>
    <table class="hist-table">
      <thead><tr><th></th>${sessions.map((s) => `<th class="mono">${esc(fmtShortDate(s.date))}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function renderLog() {
  // "Geplant" ist jetzt reine Plan-Verwaltung (bauen/speichern/laden), keine
  // direkte Session — Datum/Typ/Notiz/RPE/Speichern gehören erst zu einer
  // tatsächlichen Session (Freestyle, Plan-Ausführung, Ausdauer).
  const hideSessionFields = logMode === 'wall' || logMode === 'planned' || logMode === 'flow';
  // Freestyle/Plan-Ausführung sind als Gym-Session gedacht — die Typ-Auswahl
  // (Klettern/Fingerboard/Jogging/...) ergibt dort keinen Sinn, ist immer
  // "Gym". Datum bleibt trotzdem sichtbar, nur Typ fällt weg.
  const hideTypeField = logMode === 'freestyle' || logMode === 'execute';
  // Freestyle läuft live mit — Start-/Endzeit trackt die App ohnehin schon
  // (sessionStartedAt/totalSessionSec) — eine manuelle Datumsauswahl bringt
  // dort nur unnötiges Rätselraten/Fehlerpotenzial, wird beim Speichern
  // einfach automatisch auf heute gesetzt (siehe log-save unten).
  const hideDateField = logMode === 'freestyle';
  // Direkt nach dem Speichern zeigt die Karte NUR die Trend-Übersicht (siehe
  // fsRecap) — Datum/Typ/Chips/Notiz/RPE wären in diesem Moment nur
  // ablenkende Reste einer bereits abgeschlossenen Session.
  const showingRecap = !!fsRecap;
  await Promise.all([loadSessionPlans(), loadExerciseSettings(), loadExerciseUnitPrefs(), loadExerciseFavorites(), loadSharedTemplates(), loadWallTemplates(), loadFlowTemplates()]);
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Neue Session</h2><div class="sec-rule"></div></div>
    <div class="card">
      ${hideSessionFields || showingRecap || hideDateField ? '' : hideTypeField ? `
      <div class="field"><label>Datum</label><input type="date" id="log-date" value="${todayKey()}"></div>
      ` : `
      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" id="log-date" value="${todayKey()}"></div>
        <div class="field"><label>Typ</label>
          <select id="log-type">
            ${Object.entries(LOG_TYPE_LABEL).map(([v, label]) => `<option value="${v}" ${v === 'gym' ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>`}

      ${logMode === 'execute' || showingRecap ? '' : `
      <div class="chip-row log-mode-row">
        <button type="button" class="chip ${logMode === 'planned' ? 'active' : ''}" data-log-mode="planned">Plan</button>
        <button type="button" class="chip ${logMode === 'freestyle' ? 'active' : ''}" data-log-mode="freestyle">Freestyle</button>
        <button type="button" class="chip ${logMode === 'wall' ? 'active' : ''}" data-log-mode="wall">Ausdauer</button>
        <button type="button" class="chip ${logMode === 'flow' ? 'active' : ''}" data-log-mode="flow">Flow</button>
      </div>`}

      <div id="log-builder-panel"></div>

      ${hideSessionFields || showingRecap ? '' : `
      <div class="field"><label>Notiz (optional)</label><textarea id="log-note" placeholder="Befinden, Bedingungen, Sonstiges…"></textarea></div>
      <div class="field"><label>RPE (1–10, optional)</label><input type="number" id="log-rpe" min="1" max="10"></div>
      <button class="btn" id="log-save">FERTIG &amp; SPEICHERN</button>`}
    </div>

    <div class="sec-head"><h2 class="sec-title">Verlauf</h2><div class="sec-rule"></div></div>
    <div class="list" id="log-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  renderLogBuilderPanel();

  document.querySelectorAll('[data-log-mode]').forEach((btn) => {
    btn.onclick = () => {
      // fsPhase bewusst mit zurücksetzen, nicht nur die Stoppuhr stoppen —
      // sonst dachte der Screen beim nächsten Öffnen von Freestyle noch
      // "läuft gerade" (fsPhase blieb 'working'), obwohl kein Intervall mehr
      // lief, und startete die Arbeits-Stoppuhr der zuletzt aktiven Übung
      // von selbst neu, ohne dass "Start" gedrückt wurde.
      if (logMode === 'freestyle' || logMode === 'execute') { stopAllFsTimers(); fsPhase = 'idle'; }
      logMode = btn.dataset.logMode;
      renderLog();
    };
  });

  if (hideSessionFields || showingRecap) { renderLogHistory(); return; }

  document.getElementById('log-save').onclick = async () => {
    const builder = logMode === 'execute' ? planExecution : freestyleBuilder;
    const rawExercises = builder.exercises.filter((g) => g.sets.length);
    if (!rawExercises.length) { toast('Noch keine Sätze erfasst.', 'err'); return; }
    // Gesamtdauer/Arbeitszeit werden auf dem Eintrag selbst gespeichert
    // (nicht nur kurz als Toast gezeigt), damit sie später auch auf der
    // Verlaufskarte sichtbar bleiben.
    const totalWorkSec = rawExercises.reduce((sum, g) => sum + g.sets.reduce((s, set) => s + (set.elapsedSec || 0), 0), 0);
    const totalSessionSec = builder.sessionStartedAt ? Math.round((Date.now() - builder.sessionStartedAt) / 1000) : totalWorkSec;
    const dateInput = document.getElementById('log-date');
    const entry = {
      date: (dateInput && dateInput.value) || todayKey(),
      type: hideTypeField ? 'gym' : document.getElementById('log-type').value,
      exercises: rawExercises.map((g) => ({ exerciseId: g.exerciseId, sets: g.sets })),
      note: document.getElementById('log-note').value.trim(),
      rpe: document.getElementById('log-rpe').value || null,
      totalWorkSec,
      totalSessionSec,
      createdAt: Date.now(),
    };
    const id = await fbPush(`logs/${state.member.id}`, entry);
    if (id) {
      stopAllFsTimers();
      toast('Session gespeichert.', 'ok');
      // Trend JE Übung (↑/↓/→) gegenüber der letzten Session damit — Basis
      // ist state.logs VOR diesem Speichern (wird erst gleich neu geladen).
      fsRecap = rawExercises
        .filter((g) => g.exerciseId !== 'warmup_general' && g.exerciseId !== 'cooldown_general')
        .map((g) => {
          const prevSession = historyForExercise(g.exerciseId, 1)[0];
          const trend = prevSession ? exerciseTrend(g.exerciseId, g.sets, prevSession.sets) : null;
          return { name: exerciseName(g.exerciseId), symbol: trend ? trend.symbol : '–', cls: trend ? trend.cls : 'fs-trend-none' };
        });
      if (logMode === 'execute') {
        // Der Plan selbst bleibt erhalten (wie eine Fingerboard-Vorlage) —
        // nur die gerade laufende Ausführung wird zurückgesetzt.
        planExecution = null;
        logMode = 'planned';
      } else {
        freestyleBuilder = { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id, sessionStartedAt: null };
        saveDraft('freestyle', freestyleBuilder);
      }
      renderLog();
    } else toast('Konnte nicht speichern.', 'err');
  };

  await renderLogHistory();
  // Vergleichstabelle/"Letztes Mal" erst jetzt (nach)rendern, wenn state.logs
  // aus renderLogHistory() frisch geladen ist — sonst wäre sie beim ersten
  // Aufbau des Panels noch leer/veraltet.
  if (logMode === 'freestyle' || logMode === 'execute') renderFsPanel();
}

/* Verlauf-Liste — eigene Funktion, weil sie sowohl vom normalen
   Geplant/Freestyle-Zweig als auch vom "An die Wand"-Zweig (der die
   übrigen Formularfelder gar nicht erst anzeigt) gebraucht wird. */
async function renderLogHistory() {
  const raw = await fbGet(`logs/${state.member.id}`);
  const entries = Object.entries(raw || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  state.logs = entries.map(([, e]) => e);
  const list = document.getElementById('log-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  // Trend-Vergleich braucht die NÄCHSTÄLTERE Session mit derselben Übung —
  // also relativ zur eigenen Position in der (neueste-zuerst) Liste, nicht
  // immer die global letzte (sonst würde eine ältere Karte gegen eine noch
  // neuere verglichen, was rückwärts wäre).
  const priorSetsForExercise = (exerciseId, fromIdx) => {
    for (let i = fromIdx + 1; i < entries.length; i++) {
      const ex = entries[i][1].exercises && entries[i][1].exercises.find((e) => e.exerciseId === exerciseId && Array.isArray(e.sets) && e.sets.length);
      if (ex) return ex.sets;
    }
    return null;
  };
  list.innerHTML = entries.length ? entries.map(([id, e], idx) => `
    <div class="log-item">
      <div class="top"><span>${esc(e.date)}</span><span class="type">${esc((e.type || '').toUpperCase())}</span></div>
      ${e.durationMin ? `<div class="ex-log-list"><div class="ex-log-row"><span>${sessionTypeIconLabel(e.type)}</span><span class="mono">${e.durationMin} Min.</span></div></div>` : ''}
      ${e.totalSessionSec ? `<div class="ex-log-list"><div class="ex-log-row"><span>⏱ Zeit</span><span class="mono">${fmtMinSec(e.totalSessionSec)} gesamt · ${fmtMinSec(e.totalWorkSec || 0)} Arbeit</span></div></div>` : ''}
      ${(e.exercises && e.exercises.length) ? `<div class="ex-log-list">${e.exercises.map((ex) => {
        const priorSets = Array.isArray(ex.sets) ? priorSetsForExercise(ex.exerciseId, idx) : null;
        const trend = priorSets ? exerciseTrend(ex.exerciseId, ex.sets, priorSets) : null;
        return `<div class="ex-log-row"><span>${esc(exerciseName(ex.exerciseId))}${trend ? ` <span class="fs-trend ${trend.cls}">${trend.symbol}</span>` : ''}</span><span class="mono">${esc(fbExerciseSetsText(ex))}</span></div>`;
      }).join('')}</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      ${(e.exercises && e.exercises.length) ? `<button type="button" class="btn ghost small" data-save-plan="${id}" style="width:100%;margin-top:6px;">Als Plan speichern</button>` : ''}
      ${challengeDurationChipsHtml(`log-share-${id}`, CHALLENGE_WINDOW_H)}
      <div class="field-row" style="margin-top:6px;">
        <button type="button" class="btn ghost small" data-share-log="${id}">Als Challenge teilen</button>
        <button type="button" class="btn ghost small" data-delete-log="${id}">Löschen</button>
      </div>
    </div>
  `).join('') : '<div class="list-empty">Noch keine Einträge.</div>';

  entries.forEach(([id]) => wireChallengeDurationChips(`log-share-${id}`));
  list.querySelectorAll('[data-save-plan]').forEach((btn) => {
    btn.onclick = async () => {
      const found = entries.find(([id2]) => id2 === btn.dataset.savePlan);
      if (!found) return;
      const entry = found[1];
      // Warm-up/Cooldown sind Aufwärm-/Ausklang-Pseudoübungen, kein
      // trainingswirksamer Satz — gehören nicht in eine wiederverwendbare
      // Plan-Vorlage.
      const exercises = entry.exercises
        .filter((ex) => Array.isArray(ex.sets) && ex.sets.length && ex.exerciseId !== 'warmup_general' && ex.exerciseId !== 'cooldown_general')
        .map((ex) => {
          // Ein Plan kennt pro Übung nur EINEN Zielwert (Sätze × Wdh. @ Gewicht),
          // ein geloggter Satz aber oft unterschiedliche Werte je Satz (z. B.
          // absteigende Pyramide) — der letzte Satz ist meist der, auf den man
          // hingearbeitet hat, und dient hier als sinnvoller Startwert.
          const last = ex.sets[ex.sets.length - 1];
          return {
            exerciseId: ex.exerciseId,
            sets: ex.sets.length,
            reps: String(last.reps),
            weight: last.weight !== '' && last.weight != null ? last.weight : '',
          };
        });
      if (!exercises.length) { toast('Keine Übungen zum Speichern gefunden.', 'err'); return; }
      const name = prompt('Name für diesen Plan:', entry.date);
      if (!name) return;
      const key = await fbPush(`sessionPlans/${state.member.id}`, { name, exercises, createdAt: Date.now() });
      if (!key) { toast('Speichern fehlgeschlagen.', 'err'); return; }
      await loadSessionPlans();
      if (confirm('Plan auch mit der Crew teilen?')) {
        const shared = await shareTemplate('plan', name, { exercises });
        if (shared) await loadSharedTemplates();
      }
      toast('Plan gespeichert.', 'ok');
    };
  });
  list.querySelectorAll('[data-share-log]').forEach((btn) => {
    btn.onclick = async () => {
      const found = entries.find(([id2]) => id2 === btn.dataset.shareLog);
      if (!found) return;
      btn.disabled = true;
      await shareLogEntryAsChallenge(found[1], selectedChallengeHours(`log-share-${btn.dataset.shareLog}`));
      btn.disabled = false;
    };
  });
  list.querySelectorAll('[data-delete-log]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Diesen Eintrag wirklich löschen?')) return;
      await fbDelete(`logs/${state.member.id}/${btn.dataset.deleteLog}`);
      toast('Eintrag gelöscht.', 'ok');
      renderLogHistory();
    };
  });
}

/* ================================================================
   AUSDAUER — zwei Untermodi:
   - "Frei": einfache Start/Stopp-Stoppuhr mit wählbarer Sportart
     (Klettern/Joggen/Velo/Sonstiges) für spontanes Training ohne Plan.
   - "Geplant": strukturierter Block-Ablauf aus Wand-/Pause-Minuten mit
     Vollbild-Timer, für strukturiertes Klettertraining — als eigene
     Vorlage speicherbar (pro Mitglied, `wallTemplates/{member}`) und mit
     der ganzen Crew teilbar (`sharedTemplates`, wie bei Fingerboard-
     Abläufen und Geplant-Plänen). Beide Wege speichern direkt in
     logs/{member} und sind über "Als Challenge teilen" genauso teilbar
     wie jede andere Session. */
const AUSDAUER_TYPES = [
  { id: 'klettern', label: 'Klettern', icon: '🧗' },
  { id: 'jogging', label: 'Joggen', icon: '🏃' },
  { id: 'velo', label: 'Velo', icon: '🚴' },
  { id: 'sonstiges', label: 'Sonstiges', icon: '🔥' },
];
let ausdauer = { type: 'klettern', running: false, seconds: 0, intervalId: null, note: '' };
let ausdauerSubMode = 'frei'; // 'frei' | 'geplant'

function sessionTypeIconLabel(type) {
  if (type === 'warmup') return '🔥 Warm-up';
  if (type === 'flow') return '🧘 Flow';
  const t = AUSDAUER_TYPES.find((x) => x.id === type);
  return t ? `${t.icon} ${t.label}` : '🧗 Ausdauer';
}

function renderWallBuilder(holder) {
  holder.innerHTML = `
    <div class="chip-row" id="ausdauer-submode-toggle">
      <button type="button" class="chip ${ausdauerSubMode === 'frei' ? 'active' : ''}" data-ausdauer-submode="frei">Frei</button>
      <button type="button" class="chip ${ausdauerSubMode === 'geplant' ? 'active' : ''}" data-ausdauer-submode="geplant">Geplant</button>
    </div>
    <div id="ausdauer-submode-panel"></div>
  `;
  document.getElementById('ausdauer-submode-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { ausdauerSubMode = btn.dataset.ausdauerSubmode; renderWallBuilder(holder); };
  });
  const panel = document.getElementById('ausdauer-submode-panel');
  if (ausdauerSubMode === 'frei') renderAusdauerFrei(panel);
  else renderAusdauerGeplant(panel);
}

function renderAusdauerFrei(holder) {
  const canSave = !ausdauer.running && ausdauer.seconds > 0;
  holder.innerHTML = `
    <div class="chip-row" id="ausdauer-type-toggle">
      ${AUSDAUER_TYPES.map((t) => `<button type="button" class="chip ${ausdauer.type === t.id ? 'active' : ''}" data-ausdauer-type="${t.id}" ${ausdauer.running ? 'disabled' : ''}>${t.icon} ${esc(t.label)}</button>`).join('')}
    </div>
    <div class="timer-box">
      <div class="big" id="ausdauer-big">${fmtMinSec(ausdauer.seconds)}</div>
    </div>
    <button type="button" class="btn" id="ausdauer-toggle" style="width:100%;margin-bottom:14px;">${ausdauer.running ? 'STOPP' : 'START'}</button>
    ${canSave ? `
      <div class="field"><label>Notiz (optional)</label><textarea id="ausdauer-note" placeholder="Strecke, Route, Bedingungen…">${esc(ausdauer.note)}</textarea></div>
      <button type="button" class="btn" id="ausdauer-save" style="width:100%;">SPEICHERN</button>
    ` : ''}
  `;
  holder.querySelectorAll('[data-ausdauer-type]').forEach((btn) => {
    btn.onclick = () => {
      if (ausdauer.running) return;
      ausdauer.type = btn.dataset.ausdauerType;
      renderAusdauerFrei(holder);
    };
  });
  document.getElementById('ausdauer-toggle').onclick = () => {
    if (ausdauer.running) {
      clearInterval(ausdauer.intervalId);
      ausdauer.intervalId = null;
      ausdauer.running = false;
    } else {
      ausdauer.running = true;
      ausdauer.seconds = 0;
      ausdauer.intervalId = setInterval(() => {
        ausdauer.seconds++;
        const big = document.getElementById('ausdauer-big');
        if (big) big.textContent = fmtMinSec(ausdauer.seconds);
      }, 1000);
    }
    renderAusdauerFrei(holder);
  };
  const noteEl = document.getElementById('ausdauer-note');
  if (noteEl) noteEl.oninput = (e) => { ausdauer.note = e.target.value; };
  const saveBtn = document.getElementById('ausdauer-save');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const elapsedMin = Math.max(1, Math.round(ausdauer.seconds / 60));
      const entry = { date: todayKey(), type: ausdauer.type, durationMin: elapsedMin, exercises: [], note: ausdauer.note.trim(), rpe: null, createdAt: Date.now() };
      const id = await fbPush(`logs/${state.member.id}`, entry);
      if (id) {
        toast('Ausdauer-Session gespeichert 💪', 'ok');
        ausdauer = { type: ausdauer.type, running: false, seconds: 0, intervalId: null, note: '' };
        renderLog();
      } else toast('Konnte nicht speichern.', 'err');
    };
  }
}

/* ---------- Ausdauer: "Geplant" (strukturierter Wand-/Pause-Block-Ablauf) ---------- */
let wallBlocks = loadDraft('wall_blocks') || []; // [{type:'wand'|'pause', minutes}]
let wallNewType = 'wand';
let wallNewMinutes = 3;
let wallTemplates = []; // eigene, in Firebase gespeicherte Vorlagen (fingerboardTemplates-Muster)
const wall = { blockIndex: 0, running: false, secondsLeft: 0, totalSeconds: 0, intervalId: null, wandSecondsDone: 0 };

async function loadWallTemplates() {
  const raw = await fbGet(`wallTemplates/${state.member.id}`);
  wallTemplates = raw ? Object.entries(raw).map(([key, t]) => ({ ...t, id: key })) : [];
}

function wallFigureSvg() { return `<div class="ex-figure-emoji">🧗</div>`; }

function renderAusdauerGeplant(holder) {
  holder.innerHTML = `
    <div class="field">
      <label>Vorlage laden</label>
      <select id="wall-template-picker">
        <option value="">— eigener Ablauf —</option>
        ${wallTemplates.length ? `<optgroup label="Eigene Vorlagen">
          ${wallTemplates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
        </optgroup>` : ''}
        ${sharedTemplatesOfKind('wall').length ? `<optgroup label="Geteilte Vorlagen">
          ${sharedTemplatesOfKind('wall').map((t) => `<option value="shared:${t.id}">${esc(t.name)} (${esc(t.createdByName)})</option>`).join('')}
        </optgroup>` : ''}
      </select>
    </div>
    <div class="chip-row" id="wall-type-toggle">
      <button type="button" class="chip ${wallNewType === 'wand' ? 'active' : ''}" data-wall-type="wand">Wand</button>
      <button type="button" class="chip ${wallNewType === 'pause' ? 'active' : ''}" data-wall-type="pause">Pause</button>
    </div>
    <div class="field"><label>Minuten</label><input type="number" inputmode="numeric" id="wall-new-minutes" value="${wallNewMinutes}" min="1"></div>
    <button type="button" class="btn" id="wall-add-block" style="width:100%;margin-bottom:14px;">+ Hinzufügen</button>
    <div id="wall-blocks-list"></div>
    <div class="chip-row" style="margin-bottom:14px;">
      <button type="button" class="chip" id="wall-template-save">Als Vorlage speichern</button>
    </div>
    <button type="button" class="btn" id="wall-start" style="width:100%;" ${wallBlocks.length ? '' : 'disabled'}>TIMER STARTEN</button>
  `;
  document.getElementById('wall-template-picker').onchange = (e) => {
    const val = e.target.value;
    if (!val) return;
    const t = val.startsWith('shared:')
      ? sharedTemplatesOfKind('wall').find((r) => r.id === val.slice(7))
      : wallTemplates.find((r) => r.id === val);
    if (!t) return;
    if (wallBlocks.length && !confirm(`Aktuelle Blöcke durch "${t.name}" ersetzen?`)) { e.target.value = ''; return; }
    wallBlocks = t.blocks.map((b) => ({ ...b }));
    saveDraft('wall_blocks', wallBlocks);
    renderWallBlocksList();
  };
  document.getElementById('wall-template-save').onclick = async () => {
    if (!wallBlocks.length) { toast('Erst Blöcke zusammenstellen.', 'err'); return; }
    const name = prompt('Name für diese Vorlage:');
    if (!name) return;
    const key = await fbPush(`wallTemplates/${state.member.id}`, { name, blocks: wallBlocks, createdAt: Date.now() });
    if (!key) { toast('Speichern fehlgeschlagen.', 'err'); return; }
    await loadWallTemplates();
    if (confirm('Vorlage auch mit der Crew teilen?')) {
      const shared = await shareTemplate('wall', name, { blocks: wallBlocks });
      if (shared) await loadSharedTemplates();
    }
    renderAusdauerGeplant(holder);
    toast('Vorlage gespeichert.', 'ok');
  };
  document.getElementById('wall-type-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      wallNewType = btn.dataset.wallType;
      document.getElementById('wall-type-toggle').querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
    };
  });
  document.getElementById('wall-new-minutes').oninput = (e) => { wallNewMinutes = Number(e.target.value) || 1; };
  document.getElementById('wall-add-block').onclick = () => {
    wallBlocks.push({ type: wallNewType, minutes: wallNewMinutes });
    saveDraft('wall_blocks', wallBlocks);
    renderWallBlocksList();
  };
  document.getElementById('wall-start').onclick = startWallSession;
  renderWallBlocksList();
}

function renderWallBlocksList() {
  const holder = document.getElementById('wall-blocks-list');
  if (!holder) return;
  holder.innerHTML = wallBlocks.length ? wallBlocks.map((b, i) => `
    <div class="timeline-item anim-in" style="animation-delay:${Math.min(i, 14) * 30}ms">
      <div class="timeline-badge ${b.type === 'wand' ? '' : 'exercise'}">${i + 1}</div>
      <div class="timeline-card">
        <div class="timeline-thumb timeline-thumb-emoji">${b.type === 'wand' ? '🧗' : '💤'}</div>
        <div class="info">
          <div class="title">${b.type === 'wand' ? 'Wand' : 'Pause'}</div>
          <div class="timeline-edit"><input type="number" data-i="${i}" value="${b.minutes}" class="ex-row-input" title="Minuten"><span class="mono" style="align-self:center;color:var(--ink-faint);font-size:12px;">Min.</span></div>
        </div>
      </div>
      <button type="button" class="timeline-remove" data-remove="${i}">×</button>
    </div>
  `).join('') : '<div class="list-empty" style="margin-bottom:14px;">Noch keine Blöcke — oben hinzufügen.</div>';
  holder.querySelectorAll('input[data-i]').forEach((inp) => {
    inp.oninput = () => {
      wallBlocks[Number(inp.dataset.i)].minutes = Number(inp.value) || 1;
      saveDraft('wall_blocks', wallBlocks);
    };
  });
  holder.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => {
      wallBlocks.splice(Number(btn.dataset.remove), 1);
      saveDraft('wall_blocks', wallBlocks);
      renderWallBlocksList();
    };
  });
  const startBtn = document.getElementById('wall-start');
  if (startBtn) startBtn.disabled = !wallBlocks.length;
}

function ensureWallOverlay() {
  let el = document.getElementById('wall-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wall-overlay';
    el.className = 'fb-overlay hidden';
    document.body.appendChild(el);
  }
  return el;
}

function startWallSession() {
  if (!wallBlocks.length) return;
  wall.blockIndex = 0;
  wall.running = true;
  wall.wandSecondsDone = 0;
  beginWallBlock();
}

async function beginWallBlock() {
  const block = wallBlocks[wall.blockIndex];
  if (!block) { finishWallSession(); return; }
  wall.totalSeconds = block.minutes * 60;
  wall.secondsLeft = wall.totalSeconds;
  const el = ensureWallOverlay();
  el.classList.remove('hidden');
  if (el.requestFullscreen && !document.fullscreenElement) {
    try { await el.requestFullscreen(); } catch (e) { /* z.B. iOS Safari — CSS-Vollbild reicht als Fallback */ }
  }
  wall.intervalId = setInterval(tickWall, 1000);
  renderWallOverlay();
  beepStart();
}

function tickWall() {
  wall.secondsLeft--;
  if (wallBlocks[wall.blockIndex].type === 'wand') wall.wandSecondsDone++;
  if (wall.secondsLeft <= 0) {
    clearInterval(wall.intervalId);
    wall.intervalId = null;
    beep(1318, 300);
    wall.blockIndex++;
    if (wall.blockIndex >= wallBlocks.length) { finishWallSession(); return; }
    // Ring der EBEN beendeten Phase soll sich noch sichtbar ganz schliessen,
    // statt (wie bisher) direkt vom nächsten Block mit frischem, offenem
    // Ring überschrieben zu werden — zwei Animationsframes Vorlauf geben
    // dem Browser die Chance, den geschlossenen Ring tatsächlich zu malen,
    // bevor renderWallOverlay() alles neu aufbaut.
    const ring = document.getElementById('wall-ring-fg');
    if (ring) {
      ring.style.strokeDashoffset = '0';
      requestAnimationFrame(() => requestAnimationFrame(beginWallBlock));
      return;
    }
    beginWallBlock();
    return;
  }
  if (wall.secondsLeft <= 3) beepTick();
  updateWallUI();
}

function toggleWallPause() {
  if (!wall.running) return;
  if (wall.intervalId) { clearInterval(wall.intervalId); wall.intervalId = null; }
  else { wall.intervalId = setInterval(tickWall, 1000); }
  renderWallOverlay();
}

function cancelWall() {
  clearInterval(wall.intervalId);
  wall.intervalId = null;
  wall.running = false;
  const el = document.getElementById('wall-overlay');
  if (el) el.classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function renderWallOverlay() {
  const el = ensureWallOverlay();
  const block = wallBlocks[wall.blockIndex];
  const working = block.type === 'wand';
  const isPausedNow = wall.running && !wall.intervalId;
  const frac = wall.totalSeconds ? 1 - wall.secondsLeft / wall.totalSeconds : 0;
  const ringOffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
  const mm = Math.floor(wall.secondsLeft / 60);
  const ss = wall.secondsLeft % 60;
  const next = wallBlocks[wall.blockIndex + 1];
  const nextText = next ? `Danach: ${next.type === 'wand' ? 'Wand' : 'Pause'} ${next.minutes} Min.` : 'Letzter Block — gleich geschafft!';
  el.innerHTML = `
    <button type="button" class="fb-overlay-close" id="wall-close" title="Abbrechen">✕</button>
    <div class="fb-overlay-inner">
      <div class="fb-stage-label mono">SATZ ${wall.blockIndex + 1}/${wallBlocks.length} · ${working ? 'WAND' : 'PAUSE'}</div>
      <div class="fb-stage-figure" id="wall-figure">${working ? wallFigureSvg() : FB_REST_FIGURE_SVG}</div>
      <div class="fb-hang-visual ${isPausedNow ? 'fb-paused' : ''}">
        <div class="fb-timer-ring">
          <svg viewBox="0 0 120 120">
            <circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-fg ${working ? '' : 'rest'}" id="wall-ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${ringOffset}"/>
          </svg>
          <div class="big ${working ? '' : 'rest'}" id="wall-big">${pad2(mm)}:${pad2(ss)}</div>
        </div>
      </div>
      <div class="phase mono">${isPausedNow ? 'PAUSIERT' : working ? 'Wand' : 'Pause'}</div>
      <div class="fb-stage-next mono">${esc(nextText)}</div>
      <div class="fb-transport">
        <button type="button" class="fb-transport-btn fb-play" id="wall-playpause" title="${isPausedNow ? 'Weiter' : 'Pause'}">${isPausedNow ? TRANSPORT_ICON.play : TRANSPORT_ICON.pause}</button>
      </div>
      <button class="btn fb-stage-btn" id="wall-done-btn">FERTIG</button>
      <button class="btn ghost fb-stage-btn" id="wall-cancel-btn">ABBRECHEN</button>
    </div>
  `;
  document.getElementById('wall-close').onclick = cancelWall;
  document.getElementById('wall-cancel-btn').onclick = cancelWall;
  document.getElementById('wall-playpause').onclick = toggleWallPause;
  document.getElementById('wall-done-btn').onclick = () => finishWallSession();
}

function updateWallUI() {
  const big = document.getElementById('wall-big');
  const ring = document.getElementById('wall-ring-fg');
  const mm = Math.floor(wall.secondsLeft / 60);
  const ss = wall.secondsLeft % 60;
  if (big) big.textContent = `${pad2(mm)}:${pad2(ss)}`;
  if (ring) {
    const frac = wall.totalSeconds ? 1 - wall.secondsLeft / wall.totalSeconds : 0;
    ring.style.strokeDashoffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
  }
}

/* Läuft die ganze Blockliste durch ODER wird "FERTIG" früher angetippt —
   in beiden Fällen wird die tatsächlich an der Wand verbrachte Zeit
   geloggt (nur die Wand-Blöcke, nicht die Pausen), nicht die ursprünglich
   geplante Gesamtdauer. */
async function finishWallSession() {
  clearInterval(wall.intervalId);
  wall.intervalId = null;
  wall.running = false;
  const elapsedMin = Math.max(1, Math.round(wall.wandSecondsDone / 60));
  beep(1568, 400);

  const el = ensureWallOverlay();
  el.innerHTML = `
    <div class="fb-overlay-inner fb-overlay-done">
      <div class="fb-done-emoji">🎉</div>
      <div class="fb-stage-title">Ausdauer geschafft!</div>
      <div class="fb-stage-sub mono">${elapsedMin} ${elapsedMin === 1 ? 'Minute' : 'Minuten'} Ausdauer</div>
      ${challengeDurationChipsHtml('wall-share', CHALLENGE_WINDOW_H)}
      <button class="btn fb-stage-btn ghost" id="wall-share-btn">Als Challenge teilen</button>
      <button class="btn fb-stage-btn" id="wall-finish-btn">Schliessen</button>
    </div>
  `;
  wireChallengeDurationChips('wall-share');
  spawnConfetti(document.querySelector('#wall-overlay .fb-overlay-done'));

  const entry = { date: todayKey(), type: 'klettern', durationMin: elapsedMin, exercises: [], note: '', rpe: null, createdAt: Date.now() };
  const id = await fbPush(`logs/${state.member.id}`, entry);
  if (id) toast('Ausdauer-Session gespeichert 💪', 'ok'); else toast('Konnte nicht speichern.', 'err');

  document.getElementById('wall-finish-btn').onclick = () => {
    const overlay = document.getElementById('wall-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    renderLogHistory();
  };
  document.getElementById('wall-share-btn').onclick = async (e) => {
    e.target.disabled = true;
    await shareLogEntryAsChallenge(entry, selectedChallengeHours('wall-share'));
    e.target.textContent = 'Geteilt ✓';
  };
}

/* Kompakte Satz-Anzeige fürs Verlauf: geplante Einträge (fester Wert für
   alle Sätze) und Freestyle-Einträge (jeder Satz einzeln erfasst) sehen
   unterschiedlich aus, laufen aber in derselben Liste zusammen. */
/* ---------- Flow (Yoga/Pilates) ----------
   Selbst zusammengestellte Abfolge von Posen (POSE_LIBRARY in data.js),
   jede mit Haltezeit + Wechselpause danach — läuft automatisch durch,
   wie ein Fingerboard-Ablauf, aber ohne Board/Griff-Komplexität und ohne
   Checkin (eine Pose hat kein variables Ergebnis wie Wdh./Gewicht, man
   "fliesst" einfach durch). Struktur bewusst eng an renderAusdauerGeplant/
   wall angelehnt (gleiches Muster: Blockliste + eigenes Vollbild-Timer-
   Overlay + Speichern in logs), nur mit zwei Phasen pro Block (Halten +
   Wechsel) statt einer. Landet wie Ausdauer-Sessions in logs/{member} —
   erscheint dadurch automatisch im normalen Gym-Verlauf und ist über
   shareLogEntryAsChallenge() genauso teilbar, ohne eigene Verlauf-/
   Challenge-Sonderlogik. */
let flowBlocks = loadDraft('flow_blocks') || []; // [{poseId, holdSec, restSec}]
let flowNewCategory = 'yoga'; // 'yoga' | 'pilates' — welche Kategorie im Posen-Raster offen ist
let flowNewPoseId = POSE_LIBRARY[0].id;
let flowNewHoldSec = 30;
let flowNewRestSec = 5;
let flowTemplates = []; // eigene, in Firebase gespeicherte Flows
let flowImportOpen = false;
const flow = { blockIndex: 0, running: false, sequence: [], stepIndex: 0, secondsLeft: 0, intervalId: null };

async function loadFlowTemplates() {
  const raw = await fbGet(`flowTemplates/${state.member.id}`);
  flowTemplates = raw ? Object.entries(raw).map(([key, t]) => ({ ...t, id: key })) : [];
}

function showPoseInfoSheet(poseId) {
  const el = ensureExerciseInfoSheet();
  el.innerHTML = `
    <div class="info-sheet-card">
      <button type="button" class="info-sheet-close" id="info-sheet-close">✕</button>
      <div class="info-sheet-title">${esc(poseName(poseId))}</div>
      <div class="ex-howto">${esc(poseHowTo(poseId))}</div>
    </div>
  `;
  el.classList.remove('hidden');
  document.getElementById('info-sheet-close').onclick = () => el.classList.add('hidden');
}

function renderFlowPoseGrid() {
  const holder = document.getElementById('flow-pose-grid');
  if (!holder) return;
  const list = POSE_LIBRARY.filter((p) => p.category === flowNewCategory).slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
  holder.innerHTML = `<div class="ex-pick-grid">${list.map((p) => `
    <div class="ex-pick-cell">
      <button type="button" class="ex-pick-btn ${p.id === flowNewPoseId ? 'active' : ''}" data-pose="${p.id}">${esc(p.name)}</button>
      <button type="button" class="ex-pick-info" data-pose-info="${p.id}" title="Info zur Pose">ℹ</button>
    </div>
  `).join('')}</div>`;
  holder.querySelectorAll('.ex-pick-btn').forEach((btn) => {
    btn.onclick = () => {
      flowNewPoseId = btn.dataset.pose;
      holder.querySelectorAll('.ex-pick-btn').forEach((b) => b.classList.toggle('active', b === btn));
    };
  });
  holder.querySelectorAll('.ex-pick-info').forEach((btn) => {
    btn.onclick = () => showPoseInfoSheet(btn.dataset.poseInfo);
  });
}

function renderFlowBuilderPanel(holder) {
  const customOptions = flowTemplates.length ? `<optgroup label="Eigene Flows">
    ${flowTemplates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
  </optgroup>` : '';
  const sharedFlows = sharedTemplatesOfKind('flow');
  const sharedOptions = sharedFlows.length ? `<optgroup label="Geteilte Flows">
    ${sharedFlows.map((t) => `<option value="shared:${t.id}">${esc(t.name)} (${esc(t.createdByName)})</option>`).join('')}
  </optgroup>` : '';
  holder.innerHTML = `
    <button type="button" class="btn ghost small" id="flow-new" style="width:100%;margin-bottom:12px;">Neue Session</button>
    <div class="field">
      <label>Vorlage laden</label>
      <div class="field-row">
        <select id="flow-template-picker" style="flex:2;">
          <option value="">— eigener Flow —</option>
          ${customOptions}
          ${sharedOptions}
        </select>
        <button type="button" class="btn small ghost" id="flow-template-delete" style="flex:0 0 auto;" title="Eigenen Flow endgültig löschen" hidden>🗑 Löschen</button>
      </div>
    </div>

    <div class="sec-head" style="margin-top:0;"><h2 class="sec-title" style="font-size:15px;">Pose hinzufügen</h2><div class="sec-rule"></div></div>
    <div class="chip-row" id="flow-category-toggle">
      ${Object.entries(POSE_CATEGORY_LABEL).map(([id, label]) => `<button type="button" class="chip ${flowNewCategory === id ? 'active' : ''}" data-flow-cat="${id}">${esc(label)}</button>`).join('')}
    </div>
    <div id="flow-pose-grid" style="margin-bottom:10px;"></div>
    <div class="field-row">
      <div class="field"><label>Halten (s)</label><input type="number" id="flow-new-holdsec" value="${flowNewHoldSec}" min="1"></div>
      <div class="field"><label>Wechsel danach (s)</label><input type="number" id="flow-new-restsec" value="${flowNewRestSec}" min="0"></div>
    </div>
    <button type="button" class="btn" id="flow-add-pose" style="width:100%;margin-bottom:16px;">+ Pose hinzufügen</button>

    <div class="sec-head" id="flow-import-toggle" style="cursor:pointer;margin-top:0;">
      <h2 class="sec-title" style="font-size:15px;">Flow aus JSON importieren</h2><div class="sec-rule"></div>
      <span class="sec-chevron" id="flow-import-chevron">${flowImportOpen ? '▾' : '▸'}</span>
    </div>
    <div id="flow-import-panel" ${flowImportOpen ? '' : 'hidden'} style="margin-bottom:16px;">
      <div class="field-row" style="margin-bottom:10px;">
        <a href="./assets/ki-anleitung-flow-json.md" download class="btn ghost small" style="flex:1;text-decoration:none;box-sizing:border-box;">📄 Herunterladen</a>
        <button type="button" class="btn ghost small" id="flow-import-guide-copy" style="flex:1;">📋 Kopieren</button>
      </div>
      <div class="field">
        <label>JSON einfügen</label>
        <textarea id="flow-import-textarea" rows="6" placeholder='[{"poseId":"downward_dog","holdSec":30,"restSec":5}]'></textarea>
      </div>
      <button type="button" class="btn small" id="flow-import-btn">Importieren</button>
      <p class="login-hint" id="flow-import-status" style="margin-top:8px;white-space:pre-line;"></p>
    </div>

    <div id="flow-blocks-list"></div>

    <div class="chip-row" style="margin-bottom:16px;">
      <button type="button" class="chip" id="flow-template-save">Aktuellen Flow als Vorlage speichern</button>
    </div>
    <button type="button" class="btn" id="flow-start" style="width:100%;" ${flowBlocks.length ? '' : 'disabled'}>FLOW STARTEN</button>
  `;
  renderFlowPoseGrid();
  renderFlowBlocksList();

  document.getElementById('flow-new').onclick = () => {
    if (!confirm('Aktuellen Flow verwerfen und ganz neu (leer) beginnen?')) return;
    flowBlocks = [];
    renderFlowBlocksList();
  };
  document.getElementById('flow-category-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      flowNewCategory = btn.dataset.flowCat;
      flowNewPoseId = POSE_LIBRARY.find((p) => p.category === flowNewCategory).id;
      document.getElementById('flow-category-toggle').querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
      renderFlowPoseGrid();
    };
  });
  document.getElementById('flow-new-holdsec').oninput = (e) => { flowNewHoldSec = Number(e.target.value) || 1; };
  document.getElementById('flow-new-restsec').oninput = (e) => { flowNewRestSec = Number(e.target.value) || 0; };
  ['flow-new-holdsec', 'flow-new-restsec'].forEach(selectOnFocus);
  document.getElementById('flow-add-pose').onclick = () => {
    flowBlocks.push({ poseId: flowNewPoseId, holdSec: flowNewHoldSec, restSec: flowNewRestSec });
    renderFlowBlocksList();
  };

  const updateFlowDeleteBtnVisibility = () => {
    const btn = document.getElementById('flow-template-delete');
    if (btn) btn.hidden = !flowTemplates.some((t) => t.id === document.getElementById('flow-template-picker').value);
  };
  document.getElementById('flow-template-picker').onchange = (e) => {
    const val = e.target.value;
    if (!val) { updateFlowDeleteBtnVisibility(); return; }
    const t = val.startsWith('shared:')
      ? sharedTemplatesOfKind('flow').find((r) => r.id === val.slice(7))
      : flowTemplates.find((r) => r.id === val);
    if (!t) { updateFlowDeleteBtnVisibility(); return; }
    if (flowBlocks.length && !confirm(`Aktuellen Flow durch "${t.name}" ersetzen?`)) { e.target.value = ''; updateFlowDeleteBtnVisibility(); return; }
    flowBlocks = t.blocks.map((b) => ({ ...b }));
    renderFlowBlocksList();
    updateFlowDeleteBtnVisibility();
  };
  document.getElementById('flow-template-delete').onclick = async () => {
    const select = document.getElementById('flow-template-picker');
    const t = flowTemplates.find((r) => r.id === select.value);
    if (!t) { toast('Nur eigene Flows lassen sich löschen.', 'err'); return; }
    if (!confirm(`Gespeicherten Flow "${t.name}" unwiderruflich löschen? Das entfernt ihn dauerhaft, nicht nur den aktuell angezeigten Ablauf.`)) return;
    await fbDelete(`flowTemplates/${state.member.id}/${t.id}`);
    await loadFlowTemplates();
    renderFlowBuilderPanel(holder);
    toast('Flow gelöscht.', 'ok');
  };
  document.getElementById('flow-template-save').onclick = async () => {
    if (!flowBlocks.length) { toast('Erst Posen zusammenstellen.', 'err'); return; }
    const name = prompt('Name für diesen Flow:');
    if (!name) return;
    const key = await fbPush(`flowTemplates/${state.member.id}`, { name, blocks: flowBlocks, createdAt: Date.now() });
    if (!key) { toast('Speichern fehlgeschlagen.', 'err'); return; }
    await loadFlowTemplates();
    if (confirm('Flow auch mit der Crew teilen?')) {
      const shared = await shareTemplate('flow', name, { blocks: flowBlocks });
      if (shared) await loadSharedTemplates();
    }
    renderFlowBuilderPanel(holder);
    document.getElementById('flow-template-picker').value = key;
    updateFlowDeleteBtnVisibility();
    toast('Flow gespeichert.', 'ok');
  };

  document.getElementById('flow-import-toggle').onclick = () => {
    flowImportOpen = !flowImportOpen;
    document.getElementById('flow-import-panel').hidden = !flowImportOpen;
    document.getElementById('flow-import-chevron').textContent = flowImportOpen ? '▾' : '▸';
  };
  document.getElementById('flow-import-guide-copy').onclick = async () => {
    try {
      const res = await fetch('./assets/ki-anleitung-flow-json.md');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast('Anleitung kopiert.', 'ok');
    } catch {
      toast('Kopieren nicht möglich.', 'err');
    }
  };
  document.getElementById('flow-import-btn').onclick = () => {
    const text = document.getElementById('flow-import-textarea').value.trim();
    const statusEl = document.getElementById('flow-import-status');
    if (!text) { statusEl.textContent = 'Erst JSON einfügen.'; statusEl.style.color = 'var(--danger)'; return; }
    const result = parseImportedFlow(text);
    if (result.errors) {
      statusEl.textContent = result.errors.join('\n');
      statusEl.style.color = 'var(--danger)';
      return;
    }
    if (flowBlocks.length && !confirm(`${result.blocks.length} Posen importieren und aktuellen Flow ersetzen?`)) return;
    flowBlocks = result.blocks;
    const picker = document.getElementById('flow-template-picker');
    if (picker) picker.value = '';
    renderFlowBlocksList();
    statusEl.textContent = `${result.blocks.length} Posen importiert.`;
    statusEl.style.color = 'var(--accent)';
  };

  document.getElementById('flow-start').onclick = startFlowSession;
}

function renderFlowBlocksList() {
  saveDraft('flow_blocks', flowBlocks);
  const holder = document.getElementById('flow-blocks-list');
  if (!holder) return;
  holder.innerHTML = flowBlocks.length ? flowBlocks.map((b, i) => `
    <div class="timeline-item anim-in" style="animation-delay:${Math.min(i, 14) * 30}ms">
      <div class="timeline-badge">${i + 1}</div>
      <div class="timeline-card">
        <div class="timeline-thumb timeline-thumb-emoji">🧘</div>
        <div class="info">
          <div class="title">${esc(poseName(b.poseId))}</div>
          <div class="sub" id="flow-sub-${i}">${b.holdSec}s Halten${b.restSec ? ' · ' + b.restSec + 's Wechsel' : ''}</div>
          <div class="timeline-edit">
            <input type="number" data-i="${i}" data-f="holdSec" value="${b.holdSec}" class="ex-row-input" title="Halten (s)">
            <input type="number" data-i="${i}" data-f="restSec" value="${b.restSec}" class="ex-row-input" title="Wechsel danach (s)">
          </div>
        </div>
        <div class="timeline-move">
          <button type="button" class="timeline-move-btn" data-fb-info="${i}" title="Info zur Pose">ℹ</button>
          <button type="button" class="timeline-move-btn" data-move-up="${i}" ${i === 0 ? 'disabled' : ''} title="Nach oben verschieben">▲</button>
          <button type="button" class="timeline-move-btn" data-move-down="${i}" ${i === flowBlocks.length - 1 ? 'disabled' : ''} title="Nach unten verschieben">▼</button>
        </div>
        <button type="button" class="timeline-remove" data-remove="${i}">×</button>
      </div>
    </div>
  `).join('') : '<div class="list-empty" style="margin-bottom:14px;">Noch keine Posen — oben hinzufügen.</div>';
  holder.querySelectorAll('.timeline-edit input').forEach((inp) => {
    inp.oninput = () => {
      const i = Number(inp.dataset.i);
      flowBlocks[i][inp.dataset.f] = Number(inp.value) || 0;
      saveDraft('flow_blocks', flowBlocks);
      const subEl = document.getElementById(`flow-sub-${i}`);
      if (subEl) subEl.textContent = `${flowBlocks[i].holdSec}s Halten${flowBlocks[i].restSec ? ' · ' + flowBlocks[i].restSec + 's Wechsel' : ''}`;
    };
  });
  holder.querySelectorAll('[data-fb-info]').forEach((btn) => {
    btn.onclick = () => showPoseInfoSheet(flowBlocks[Number(btn.dataset.fbInfo)].poseId);
  });
  holder.querySelectorAll('[data-move-up]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.moveUp);
      if (i > 0) { [flowBlocks[i - 1], flowBlocks[i]] = [flowBlocks[i], flowBlocks[i - 1]]; renderFlowBlocksList(); }
    };
  });
  holder.querySelectorAll('[data-move-down]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.moveDown);
      if (i < flowBlocks.length - 1) { [flowBlocks[i + 1], flowBlocks[i]] = [flowBlocks[i], flowBlocks[i + 1]]; renderFlowBlocksList(); }
    };
  });
  holder.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => { flowBlocks.splice(Number(btn.dataset.remove), 1); renderFlowBlocksList(); };
  });
  const startBtn = document.getElementById('flow-start');
  if (startBtn) startBtn.disabled = !flowBlocks.length;
}

/* JSON-Import fürs Flow-Ablauf — dasselbe Muster wie parseImportedAblauf
   fürs Board, aber nur ein einziger, viel einfacherer Blocktyp (kein
   type-Feld nötig, da es nur Posen gibt). */
function parseImportedFlow(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return { errors: ['Ungültiges JSON: ' + e.message] }; }
  if (!Array.isArray(raw)) return { errors: ['Erwartet ein JSON-Array von Posen, z. B. [ {...}, {...} ].'] };
  if (!raw.length) return { errors: ['Das Array ist leer.'] };
  const errors = [];
  const blocks = [];
  raw.forEach((b, i) => {
    const n = i + 1;
    if (!b || typeof b !== 'object' || Array.isArray(b)) { errors.push(`Pose ${n}: kein Objekt.`); return; }
    if (!POSE_LIBRARY.some((p) => p.id === b.poseId)) { errors.push(`Pose ${n}: unbekannte poseId "${b.poseId}".`); return; }
    const holdSec = Number(b.holdSec);
    const restSec = b.restSec != null ? Number(b.restSec) : 5;
    if (!(holdSec > 0)) { errors.push(`Pose ${n}: holdSec muss eine Zahl > 0 sein.`); return; }
    if (!(restSec >= 0)) { errors.push(`Pose ${n}: restSec muss eine Zahl >= 0 sein.`); return; }
    blocks.push({ poseId: b.poseId, holdSec, restSec });
  });
  if (errors.length) return { errors };
  return { blocks };
}

function ensureFlowOverlay() {
  let el = document.getElementById('flow-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flow-overlay';
    el.className = 'fb-overlay hidden';
    document.body.appendChild(el);
  }
  return el;
}

function flowSequenceFor(block) {
  const seq = [{ phase: 'Halten', seconds: block.holdSec }];
  if (block.restSec > 0) seq.push({ phase: 'Wechsel', seconds: block.restSec });
  return seq;
}

function startFlowSession() {
  if (!flowBlocks.length) return;
  flow.blockIndex = 0;
  flow.running = true;
  requestWakeLock();
  beginFlowBlock();
}

async function beginFlowBlock() {
  const block = flowBlocks[flow.blockIndex];
  if (!block) { finishFlowSession(); return; }
  flow.sequence = flowSequenceFor(block);
  flow.stepIndex = 0;
  flow.secondsLeft = flow.sequence[0].seconds;
  const el = ensureFlowOverlay();
  el.classList.remove('hidden');
  if (el.requestFullscreen && !document.fullscreenElement) {
    try { await el.requestFullscreen(); } catch (e) { /* z. B. iOS Safari — CSS-Vollbild reicht als Fallback */ }
  }
  flow.intervalId = setInterval(tickFlow, 1000);
  renderFlowOverlay();
  // Flow bewusst ruhig: nur ein Gong zum Einstieg in die erste Pose —
  // danach kommt der Gong jeweils am Ende einer Haltephase (Signal zum
  // Wechseln, siehe tickFlow), nicht nochmal beim Beginn der nächsten.
  if (flow.blockIndex === 0) gong();
}

function tickFlow() {
  flow.secondsLeft--;
  if (flow.secondsLeft <= 0) {
    const endedPhase = flow.sequence[flow.stepIndex].phase;
    flow.stepIndex++;
    const sequenceDone = flow.stepIndex >= flow.sequence.length;
    // Ein Gong, sobald eine Pose fertig gehalten ist (= jetzt in die
    // nächste wechseln) — keine Countdown-Pieps, kein Ton am Ende der
    // Wechselzeit. Ausnahme: endet mit dieser Pose der ganze Flow, gibt
    // finishFlowSession() den Abschluss-Gong (2×) statt eines einzelnen.
    const isFinalStep = sequenceDone && flow.blockIndex === flowBlocks.length - 1;
    if (endedPhase === 'Halten' && !isFinalStep) gong();
    if (sequenceDone) {
      clearInterval(flow.intervalId);
      flow.intervalId = null;
      flow.blockIndex++;
      // Ring der eben beendeten Phase soll sich noch sichtbar ganz
      // schliessen, bevor die nächste Pose ihn mit offenem Ring
      // überschreibt (gleicher Kniff wie bei tickWall/tickBlock).
      const ring = document.getElementById('flow-ring-fg');
      if (ring) {
        ring.style.strokeDashoffset = '0';
        requestAnimationFrame(() => requestAnimationFrame(beginFlowBlock));
        return;
      }
      beginFlowBlock();
      return;
    }
    flow.secondsLeft = flow.sequence[flow.stepIndex].seconds;
  }
  updateFlowUI();
}

function toggleFlowPause() {
  if (!flow.running) return;
  if (flow.intervalId) { clearInterval(flow.intervalId); flow.intervalId = null; }
  else { flow.intervalId = setInterval(tickFlow, 1000); }
  renderFlowOverlay();
}

function cancelFlowSession() {
  clearInterval(flow.intervalId);
  flow.intervalId = null;
  flow.running = false;
  releaseWakeLock();
  const el = document.getElementById('flow-overlay');
  if (el) el.classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/* Vorzeitiges Beenden (analog zum Board): speichert nur die tatsächlich
   fertig gehaltenen Posen (blockIndex), nicht die ganze geplante Liste. */
function finishFlowEarly() {
  if (flow.blockIndex <= 0) { toast('Noch keine Pose abgeschlossen zum Speichern.', 'err'); return; }
  clearInterval(flow.intervalId);
  flow.intervalId = null;
  finishFlowSession(flowBlocks.slice(0, flow.blockIndex));
}

function renderFlowOverlay() {
  const el = ensureFlowOverlay();
  const block = flowBlocks[flow.blockIndex];
  const step = flow.sequence[flow.stepIndex];
  const working = step.phase === 'Halten';
  const isPausedNow = flow.running && !flow.intervalId;
  const frac = step.seconds ? 1 - flow.secondsLeft / step.seconds : 0;
  const ringOffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
  const next = flowBlocks[flow.blockIndex + 1];
  const nextText = working && block.restSec > 0
    ? `Danach: Wechsel ${block.restSec}s`
    : next ? `Danach: ${esc(poseName(next.poseId))}` : 'Letzte Pose — gleich geschafft!';
  el.innerHTML = `
    <button type="button" class="fb-overlay-close" id="flow-close" title="Abbrechen">✕</button>
    <div class="fb-overlay-inner">
      <div class="fb-stage-label mono">POSE ${flow.blockIndex + 1}/${flowBlocks.length} · ${esc(poseName(block.poseId))}</div>
      <div class="fb-stage-figure" id="flow-figure">${working ? '<div class="ex-figure-emoji">🧘</div>' : FB_REST_FIGURE_SVG}</div>
      <div class="fb-hang-visual ${isPausedNow ? 'fb-paused' : ''}">
        <div class="fb-timer-ring">
          <svg viewBox="0 0 120 120">
            <circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-fg ${working ? '' : 'rest'}" id="flow-ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${ringOffset}"/>
          </svg>
          <div class="big ${working ? '' : 'rest'}" id="flow-big">${pad2(flow.secondsLeft)}</div>
        </div>
      </div>
      <div class="phase mono" id="flow-phase">${isPausedNow ? 'PAUSIERT' : working ? 'Halten' : 'Wechsel'}</div>
      <div class="fb-stage-next mono">${nextText}</div>
      <div class="fb-transport">
        <button type="button" class="fb-transport-btn fb-play" id="flow-playpause" title="${isPausedNow ? 'Weiter' : 'Pause'}">${isPausedNow ? TRANSPORT_ICON.play : TRANSPORT_ICON.pause}</button>
      </div>
      ${flow.blockIndex > 0 ? '<button class="btn ghost fb-stage-btn" id="flow-finish-early">Vorzeitig beenden & speichern</button>' : ''}
      <button class="btn ghost fb-stage-btn" id="flow-cancel-btn">ABBRECHEN</button>
    </div>
  `;
  document.getElementById('flow-close').onclick = cancelFlowSession;
  document.getElementById('flow-cancel-btn').onclick = cancelFlowSession;
  document.getElementById('flow-playpause').onclick = toggleFlowPause;
  const finishEarlyBtn = document.getElementById('flow-finish-early');
  if (finishEarlyBtn) finishEarlyBtn.onclick = finishFlowEarly;
}

function updateFlowUI() {
  const big = document.getElementById('flow-big');
  const ring = document.getElementById('flow-ring-fg');
  const step = flow.sequence[flow.stepIndex];
  const working = step.phase === 'Halten';
  if (big) big.textContent = pad2(flow.secondsLeft);
  if (ring) {
    const frac = step.seconds ? 1 - flow.secondsLeft / step.seconds : 0;
    ring.style.strokeDashoffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
    ring.classList.toggle('rest', !working);
  }
  const phaseEl = document.getElementById('flow-phase');
  if (phaseEl) phaseEl.textContent = working ? 'Halten' : 'Wechsel';
  const figureHolder = document.getElementById('flow-figure');
  if (figureHolder) figureHolder.innerHTML = working ? '<div class="ex-figure-emoji">🧘</div>' : FB_REST_FIGURE_SVG;
}

/* Läuft die ganze Liste durch ODER wird vorzeitig beendet — landet wie
   eine Ausdauer-Session direkt in logs/{member}, damit Verlauf und
   Challenge-Teilen ohne eigene Sonderlogik funktionieren (siehe
   shareLogEntryAsChallenge/renderLogHistory). */
async function finishFlowSession(blocksOverride) {
  clearInterval(flow.intervalId);
  flow.intervalId = null;
  flow.running = false;
  releaseWakeLock();
  if (!blocksOverride) gongStrikes(2); // Flow komplett durch — Abschluss-Gong

  const blocksDone = blocksOverride || flowBlocks;
  const isPartial = !!blocksOverride;
  const totalSec = blocksDone.reduce((s, b) => s + b.holdSec + (b.restSec || 0), 0);

  const el = ensureFlowOverlay();
  el.innerHTML = `
    <div class="fb-overlay-inner fb-overlay-done">
      <div class="fb-done-emoji">${isPartial ? '💪' : '🎉'}</div>
      <div class="fb-stage-title">${isPartial ? 'Vorzeitig beendet & gespeichert' : 'Flow geschafft!'}</div>
      <div class="fb-stage-sub mono">${blocksDone.length} Posen · ${fmtMinSec(totalSec)}</div>
      <div class="fb-summary-list">${blocksDone.map((b) => `<div class="fb-summary-row"><span>${esc(poseName(b.poseId))}</span><span class="mono">${b.holdSec}s</span></div>`).join('')}</div>
      ${challengeDurationChipsHtml('flow-share', CHALLENGE_WINDOW_H)}
      <button class="btn fb-stage-btn ghost" id="flow-share-btn">Als Challenge teilen</button>
      <button class="btn fb-stage-btn" id="flow-finish-btn">Schliessen</button>
    </div>
  `;
  wireChallengeDurationChips('flow-share');
  if (!isPartial) spawnConfetti(document.querySelector('#flow-overlay .fb-overlay-done'));

  const entry = {
    date: todayKey(),
    type: 'flow',
    durationMin: Math.max(1, Math.round(totalSec / 60)),
    exercises: [],
    note: blocksDone.map((b) => poseName(b.poseId)).join(', '),
    rpe: null,
    createdAt: Date.now(),
  };
  const id = await fbPush(`logs/${state.member.id}`, entry);
  if (id) toast('Flow gespeichert 🧘', 'ok'); else toast('Konnte nicht speichern.', 'err');

  document.getElementById('flow-finish-btn').onclick = () => {
    const overlay = document.getElementById('flow-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    renderLogHistory();
  };
  document.getElementById('flow-share-btn').onclick = async (e) => {
    e.target.disabled = true;
    await shareLogEntryAsChallenge(entry, selectedChallengeHours('flow-share'));
    e.target.textContent = 'Geteilt ✓';
  };
}

function fbExerciseSetsText(ex) {
  if (Array.isArray(ex.sets)) {
    return ex.sets.map((s) => {
      const suffix = setUnitSuffix(ex.exerciseId, s);
      return s.weight !== '' && s.weight != null ? `${s.weight}kg×${s.reps}${suffix}` : `${s.reps}${suffix}`;
    }).join(', ');
  }
  const suffix = exerciseIsHold(ex.exerciseId) ? 's' : '';
  return `${ex.sets}×${ex.reps}${suffix}${ex.weight ? ' @ ' + ex.weight + 'kg' : ''}`;
}

function renderLogBuilderPanel() {
  const holder = document.getElementById('log-builder-panel');
  if (!holder) return;
  // Wechsel zwischen den Unter-Modi (Plan/Freestyle/...) läuft nicht über
  // render() — ohne das blieb der "▶ STARTEN"-Button vom Plan-Tab z. B. im
  // Freestyle stehen. Der jeweilige Modus zeigt ihn/die Leiste selbst wieder.
  hideFabStart();
  hideFsDock();

  if (fsRecap) {
    holder.innerHTML = `
      <div class="fs-recap">
        <div class="fs-recap-title">Session gespeichert</div>
        ${fsRecap.map((r) => `<div class="fs-recap-row"><span>${esc(r.name)}</span><span class="fs-trend ${r.cls}">${r.symbol}</span></div>`).join('')}
        <button type="button" class="btn" id="fs-recap-close" style="width:100%;margin-top:12px;">Weiter</button>
      </div>
    `;
    document.getElementById('fs-recap-close').onclick = () => { fsRecap = null; renderLog(); };
    return;
  }

  if (logMode === 'wall') {
    renderWallBuilder(holder);
  } else if (logMode === 'flow') {
    renderFlowBuilderPanel(holder);
  } else if (logMode === 'freestyle') {
    // Warm-up ist keine eigene Kategorie mehr, sondern eine zeitbasierte
    // Pseudo-Übung innerhalb von Freestyle (siehe exerciseIsHold in data.js)
    // — landet dadurch automatisch in derselben Session/demselben
    // Verlaufseintrag wie die Übungen danach, statt in einem eigenen.
    const hasWarmup = freestyleBuilder.exercises.some((g) => g.exerciseId === 'warmup_general');
    const hasCooldown = freestyleBuilder.exercises.some((g) => g.exerciseId === 'cooldown_general');
    holder.innerHTML = `
      <div class="field-row" style="margin-bottom:12px;">
        ${hasWarmup ? '' : `<button type="button" class="btn ghost small" id="fs-add-warmup" style="flex:1;">🔥 Warm-up hinzufügen</button>`}
        ${hasCooldown ? '' : `<button type="button" class="btn ghost small" id="fs-add-cooldown" style="flex:1;">🧘 Cooldown hinzufügen</button>`}
      </div>
      <div class="field">
        <label>Übung</label>
        <div id="fs-exercise-grid"></div>
      </div>
      <div id="fs-panel"></div>
      <div id="fs-discard-holder"></div>
    `;
    const addPseudoExercise = (exerciseId) => {
      if (!freestyleBuilder.exercises.length) freestyleBuilder.sessionStartedAt = Date.now();
      freestyleBuilder.exercises.push({ exerciseId, sets: [] });
      freestyleBuilder.activeIndex = freestyleBuilder.exercises.length - 1;
      fsPhase = 'idle';
      stopFsRestTimer();
      stopFsWorkTimer();
      renderLogBuilderPanel();
    };
    const addWarmupBtn = document.getElementById('fs-add-warmup');
    if (addWarmupBtn) addWarmupBtn.onclick = () => addPseudoExercise('warmup_general');
    const addCooldownBtn = document.getElementById('fs-add-cooldown');
    if (addCooldownBtn) addCooldownBtn.onclick = () => addPseudoExercise('cooldown_general');
    wireExercisePickerGrid('fs-exercise-grid', EXERCISE_LIBRARY, freestyleBuilder.pickerExerciseId, (id) => {
      freestyleBuilder.pickerExerciseId = id;
      if (!freestyleBuilder.exercises.length) freestyleBuilder.sessionStartedAt = Date.now();
      let idx = freestyleBuilder.exercises.findIndex((g) => g.exerciseId === id);
      if (idx === -1) {
        freestyleBuilder.exercises.push({ exerciseId: id, sets: [] });
        idx = freestyleBuilder.exercises.length - 1;
      }
      if (idx === freestyleBuilder.activeIndex) { renderFsPanel(); }
      else activateFsGroup(freestyleBuilder, idx);
      // Zur aktiven Übung scrollen statt zu einer festen Stelle — das
      // Eingabefeld steht jetzt direkt bei ihr, nicht mehr fest oben.
      document.getElementById(`fs-group-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, null);
    renderFsPanel();
  } else if (logMode === 'execute') {
    holder.innerHTML = `
      <div class="sec-head" style="margin-top:0;"><h2 class="sec-title" style="font-size:16px;">${esc(planExecution.planName)}</h2><div class="sec-rule"></div></div>
      <div id="fs-panel"></div>
      <button type="button" class="btn ghost accent-outline small" id="plan-execute-cancel" style="width:100%;margin-top:8px;">Ausführung abbrechen</button>
    `;
    hideFabStart(); // Ausführung läuft schon, kein Start-Button mehr nötig
    renderFsPanel();
    document.getElementById('plan-execute-cancel').onclick = () => {
      if (!confirm('Ausführung abbrechen? Noch nicht gespeicherte Sätze gehen verloren.')) return;
      stopAllFsTimers();
      planExecution = null;
      logMode = 'planned';
      renderLog();
    };
  } else {
    const customOptions = sessionPlans.length ? `<optgroup label="Eigene Pläne">
      ${sessionPlans.map((p) => `<option value="plan:${p.id}">${esc(p.name)}</option>`).join('')}
    </optgroup>` : '';
    const sharedPlans = sharedTemplatesOfKind('plan');
    const sharedOptions = sharedPlans.length ? `<optgroup label="Geteilte Pläne">
      ${sharedPlans.map((p) => `<option value="sharedplan:${p.id}">${esc(p.name)} (${esc(p.createdByName)})</option>`).join('')}
    </optgroup>` : '';
    holder.innerHTML = `
      <div class="field">
        <label>Plan laden</label>
        <div class="field-row">
          <select id="log-template" style="flex:2;">
            <option value="">— eigener Ablauf —</option>
            ${ROUTINE_TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
            ${customOptions}
            ${sharedOptions}
          </select>
          <button type="button" class="btn small ghost" id="plan-delete" style="flex:0 0 auto;" title="Eigenen Plan endgültig löschen" hidden>🗑 Löschen</button>
        </div>
      </div>

      <div class="field">
        <label>Übung hinzufügen</label>
        <div id="log-exercise-grid"></div>
        <button type="button" class="btn" id="log-exercise-add" style="width:100%;margin-top:8px;">+ Hinzufügen</button>
      </div>

      <div id="log-exercise-rows"></div>

      <div class="chip-row" style="margin-top:14px;">
        <button type="button" class="chip" id="plan-save">Als Plan speichern</button>
      </div>
      <button type="button" class="btn" id="plan-start" ${logBuilder.exercises.length ? '' : 'disabled'} style="width:100%;">PLAN STARTEN</button>
    `;
    renderLogExerciseRows();
    showFabStart('▶ STARTEN', 'plan-start');
    wireExercisePickerGrid('log-exercise-grid', EXERCISE_LIBRARY, logPickerExerciseId, (id) => { logPickerExerciseId = id; }, 'log-exercise-add');
    document.getElementById('log-template').onchange = (e) => {
      const val = e.target.value;
      let exercises = null;
      if (val.startsWith('plan:')) {
        const p = sessionPlans.find((pl) => pl.id === val.slice(5));
        if (p) exercises = p.exercises.map((ex) => ({ ...ex }));
      } else if (val.startsWith('sharedplan:')) {
        const p = sharedTemplatesOfKind('plan').find((pl) => pl.id === val.slice(11));
        if (p) exercises = p.exercises.map((ex) => ({ ...ex }));
      } else {
        const t = ROUTINE_TEMPLATES.find((r) => r.id === val);
        if (t) exercises = t.exercises.map((ex) => ({ ...ex, weight: '' }));
      }
      logBuilder.exercises = exercises || [];
      renderLogExerciseRows();
      const startBtn = document.getElementById('plan-start');
      if (startBtn) startBtn.disabled = !logBuilder.exercises.length;
      showFabStart('▶ STARTEN', 'plan-start');
      // Löschen-Button nur zeigen, wenn wirklich ein EIGENER Plan geladen ist
      // (nicht bei einer Fertig-Vorlage oder einem geteilten Plan der Crew,
      // die man ohnehin nicht löschen kann) — sonst sieht der Button wie ein
      // harmloser "Ablauf leeren"-Button aus, löscht aber die gespeicherte
      // Vorlage unwiderruflich, nicht nur die aktuell angezeigten Übungen.
      const deleteBtn = document.getElementById('plan-delete');
      if (deleteBtn) deleteBtn.hidden = !val.startsWith('plan:');
    };
    document.getElementById('log-exercise-add').onclick = () => {
      logBuilder.exercises.push({ exerciseId: logPickerExerciseId, sets: 3, reps: '', weight: '' });
      renderLogExerciseRows();
      // Direkt zur neu hinzugefügten Zeile scrollen, damit man das Gewicht/
      // die Wiederholungen sofort eintragen kann, ohne zurückscrollen zu
      // müssen — die Zeile landet sonst ausserhalb des sichtbaren Bereichs.
      document.getElementById(`log-exercise-row-${logBuilder.exercises.length - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const startBtn = document.getElementById('plan-start');
      if (startBtn) startBtn.disabled = !logBuilder.exercises.length;
      showFabStart('▶ STARTEN', 'plan-start');
    };
    document.getElementById('plan-save').onclick = async () => {
      if (!logBuilder.exercises.length) { toast('Erst Übungen zusammenstellen.', 'err'); return; }
      const name = prompt('Name für diesen Plan:');
      if (!name) return;
      const key = await fbPush(`sessionPlans/${state.member.id}`, { name, exercises: logBuilder.exercises, createdAt: Date.now() });
      if (!key) { toast('Speichern fehlgeschlagen.', 'err'); return; }
      await loadSessionPlans();
      if (confirm('Plan auch mit der Crew teilen?')) {
        const shared = await shareTemplate('plan', name, { exercises: logBuilder.exercises });
        if (shared) await loadSharedTemplates();
      }
      renderLogBuilderPanel();
      document.getElementById('log-template').value = `plan:${key}`;
      // .value direkt setzen löst kein change-Event aus — Löschen-Button
      // hier explizit einblenden (siehe onchange-Handler oben).
      const deleteBtnAfterSave = document.getElementById('plan-delete');
      if (deleteBtnAfterSave) deleteBtnAfterSave.hidden = false;
      toast('Plan gespeichert.', 'ok');
    };
    document.getElementById('plan-delete').onclick = async () => {
      const val = document.getElementById('log-template').value;
      const p = val.startsWith('plan:') && sessionPlans.find((pl) => pl.id === val.slice(5));
      if (!p) { toast('Nur eigene Pläne lassen sich löschen.', 'err'); return; }
      if (!confirm(`Gespeicherten Plan "${p.name}" unwiderruflich löschen? Das entfernt die Vorlage dauerhaft, nicht nur die aktuell angezeigten Übungen.`)) return;
      await fbDelete(`sessionPlans/${state.member.id}/${p.id}`);
      await loadSessionPlans();
      logBuilder.exercises = [];
      renderLogBuilderPanel();
      toast('Plan gelöscht.', 'ok');
    };
    document.getElementById('plan-start').onclick = () => {
      if (!logBuilder.exercises.length) return;
      const currentVal = document.getElementById('log-template').value;
      const loadedPlan = currentVal.startsWith('plan:')
        ? sessionPlans.find((pl) => pl.id === currentVal.slice(5))
        : currentVal.startsWith('sharedplan:')
          ? sharedTemplatesOfKind('plan').find((pl) => pl.id === currentVal.slice(11))
          : null;
      planExecution = {
        planName: loadedPlan ? loadedPlan.name : 'Eigener Plan',
        activeIndex: 0,
        sessionStartedAt: Date.now(),
        exercises: logBuilder.exercises.map((ex) => ({
          exerciseId: ex.exerciseId, sets: [],
          targetSets: ex.sets, targetReps: ex.reps, targetWeight: ex.weight,
        })),
      };
      logMode = 'execute';
      fsPhase = 'idle';
      stopFsRestTimer();
      stopFsWorkTimer();
      renderLog();
    };
  }
}

/* Übungsliste (Freestyle ODER Plan-Ausführung, siehe activeSetBuilder) mit
   dem Eingabefeld DIREKT bei der gerade aktiven Übung eingebettet, statt
   fest oben zu stehen — tippt man eine andere (bereits erfasste) Übung an,
   wandert das Eingabefeld mit an ihre Stelle, statt dass man zwischen der
   angetippten Übung weiter unten und dem Feld ganz oben hin- und
   herscrollen muss. Zeigt bei der aktiven Übung die Vergleichstabelle der
   letzten 3 Sessions plus (bei Plan-Ausführung) das geplante Ziel als
   Vorschlag in den Feldern an. */
/* Satz-Ablauf als kleine Phasenmaschine, für JEDE Übung gleich (nicht nur
   Isoholds — auch ein normaler Reps-Satz hat eine Dauer, die man
   nebenbei sehen kann; bei Halte-Übungen IST die gestoppte Zeit direkt
   der Wdh.-Wert, nicht extra einzutippen):
   'idle' → Übung ist gewählt, Uhr steht noch — erst "Start" antippen
            startet die Arbeits-Stoppuhr (Zeit zum Einrichten an der
            Übung, bevor die Zeit mitläuft).
   'working' → Arbeits-Stoppuhr läuft, "Satz beenden" stoppt sie
   'entering' → Gewicht/Wdh. eintragen (gestoppte Dauer wird angezeigt und
                bei Halte-Übungen direkt als Wdh.-Wert vorausgefüllt),
                "Satz speichern"
   'resting' → Pausenstoppuhr läuft (30s-Piepton), "Nächster Satz" startet
               direkt wieder die Arbeits-Stoppuhr (kein erneuter Start-
               Knopf nötig, man bleibt ja an derselben Übung).
   Eine einzige, modul-globale Phase/Uhr reicht, da jeweils nur eine
   Übung gleichzeitig aktiv ist. */
let fsPhase = 'idle';
let fsWorkTimer = { seconds: 0, intervalId: null };
let fsRestTimer = { seconds: 0, intervalId: null };
let fsCapturedElapsed = 0;

function updateFsWorkTimerUI() {
  const el = document.getElementById('fs-work-timer');
  if (el) el.textContent = fmtMinSec(fsWorkTimer.seconds);
}
function startFsWorkTimer() {
  requestWakeLock(); // Bildschirm soll während einer laufenden Session nicht ausgehen (dieselbe Sperre wie im Fingerboard-Ablauf)
  clearInterval(fsWorkTimer.intervalId);
  fsWorkTimer.seconds = 0;
  updateFsWorkTimerUI();
  fsWorkTimer.intervalId = setInterval(() => {
    fsWorkTimer.seconds++;
    updateFsWorkTimerUI();
  }, 1000);
}
function stopFsWorkTimer() {
  clearInterval(fsWorkTimer.intervalId);
  fsWorkTimer.intervalId = null;
}

function updateFsRestTimerUI() {
  const el = document.getElementById('fs-rest-timer');
  if (!el) return;
  el.textContent = `PAUSE ${fmtMinSec(fsRestTimer.seconds)}`;
}
function startFsRestTimer() {
  requestWakeLock();
  clearInterval(fsRestTimer.intervalId);
  fsRestTimer.seconds = 0;
  updateFsRestTimerUI();
  fsRestTimer.intervalId = setInterval(() => {
    fsRestTimer.seconds++;
    updateFsRestTimerUI();
    // Gong je 30s: 0:30 → 1×, 1:00 → 2×, 1:30 → 3×, ab 2:00 → 4× (Obergrenze).
    if (fsRestTimer.seconds % 30 === 0) gongStrikes(Math.min(4, fsRestTimer.seconds / 30));
  }, 1000);
}
// Ohne explizites Stoppen lief die Pausenuhr bisher im Hintergrund einfach
// weiter (auch nach dem Speichern/Verlassen der Session) — piepste also
// munter weiter, obwohl gar keine Pause mehr lief.
function stopFsRestTimer() {
  clearInterval(fsRestTimer.intervalId);
  fsRestTimer.intervalId = null;
}
function stopAllFsTimers() {
  stopFsWorkTimer();
  stopFsRestTimer();
  releaseWakeLock();
}

/* Plan-Ausführung in abgeänderter Reihenfolge: eine Übung gilt als
   "erledigt", sobald sie ihr Satz-Ziel erreicht hat (ohne Ziel schon ab
   einem Satz) — unabhängig davon, ob sie in der ursprünglichen Plan-
   Reihenfolge dran war. So kann man z. B. bei besetztem Gerät zur
   nächsten NOCH OFFENEN Übung springen (data-activate erlaubt das Antippen
   jeder Übung schon länger) und eine übersprungene später nachholen —
   nur der Fortschritt (erledigt/offen) zählt, nicht die Position. */
function fsExerciseDone(g) {
  return g.targetSets != null ? g.sets.length >= g.targetSets : g.sets.length > 0;
}
/* Sucht ab fromIndex vorwärts (mit Umlauf ans Ende der Liste) die nächste
   noch offene Übung — nicht einfach fromIndex+1, sonst würde "Nächste
   Übung" nach einem Sprung ausser der Reihe eine bereits erledigte Übung
   nochmal vorschlagen, statt eine wirklich noch offene. null, wenn schon
   alles erledigt ist. */
function findNextUnfinishedExerciseIndex(builder, fromIndex) {
  const n = builder.exercises.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (!fsExerciseDone(builder.exercises[idx])) return idx;
  }
  return null;
}

/* Eine neue oder bereits vorhandene Übung wird aktiv: normalerweise erstmal
   nur die Phase auf 'idle' setzen (Stoppuhr steht still) — die Uhr läuft
   nicht automatisch los, sondern erst nachdem man bewusst "Start" antippt.
   Läuft aber gerade die Pause zwischen zwei Sätzen, soll die über einen
   Übungswechsel hinweg WEITERLAUFEN (die Erholung pausiert ja nicht, nur
   weil man sich eine andere Übung anschaut) — erst ein bewusstes "Start"
   für die neue Übung beendet sie dann wirklich. */
function activateFsGroup(builder, idx) {
  builder.activeIndex = idx;
  fsNoteEditing = false;
  if (fsPhase !== 'resting') {
    fsPhase = 'idle';
    stopFsWorkTimer();
  }
  renderFsPanel();
}

/* Sichtbar sobald mindestens eine Übung im Freestyle-Aufbau steckt — ohne
   das gäbe es keinen offensichtlichen Weg, eine begonnene Freestyle-Session
   wieder zu verwerfen (anders als die Plan-Ausführung, die schon einen
   "Ausführung abbrechen"-Knopf hat). Eigene Funktion statt Teil des
   statischen renderLogBuilderPanel()-Templates, weil sie bei jeder
   Änderung an freestyleBuilder.exercises (Übung hinzufügen/entfernen) neu
   auswerten muss, nicht nur beim einmaligen Öffnen des Freestyle-Tabs. */
function renderFsDiscardButton() {
  const holder = document.getElementById('fs-discard-holder');
  if (!holder) return;
  if (logMode !== 'freestyle' || !freestyleBuilder.exercises.length) { holder.innerHTML = ''; return; }
  holder.innerHTML = `<button type="button" class="btn ghost small" id="fs-discard" style="width:100%;margin-top:10px;">🗑 Freestyle verwerfen</button>`;
  document.getElementById('fs-discard').onclick = () => {
    if (!confirm('Freestyle-Session verwerfen? Alle noch nicht gespeicherten Sätze gehen verloren.')) return;
    stopAllFsTimers();
    freestyleBuilder = { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id, sessionStartedAt: null };
    saveDraft('freestyle', freestyleBuilder);
    renderLog();
  };
}

function renderFsPanel() {
  const holder = document.getElementById('fs-panel');
  if (!holder) return;
  const builder = activeSetBuilder();
  if (logMode === 'freestyle') saveDraft('freestyle', builder);
  renderFsDiscardButton();

  if (!builder.exercises.length) {
    hideFsDock();
    holder.innerHTML = '<p class="login-hint">Übung wählen und "+ Übung" antippen, um Sätze zu erfassen.</p>';
    return;
  }

  // Satz-Steuerung (Start / Satz beenden / Nächster Satz) sitzt in der
  // grossen Leiste unten (#fs-dock, siehe ensureFsDock) — nur die Eingabe
  // von Gewicht/Wdh. ('entering') steht in der Karte der aktiven Übung.
  // Kleine Phasenmaschine je Übung (siehe activateFsGroup/fsPhase):
  // 'idle' → 'working' (Arbeits-Stoppuhr) → 'entering' (Gewicht/Wdh.
  // eintragen) → 'resting' (Pausenstoppuhr) → zurück zu 'working'.
  const dockHtml = (g) => {
    const head = `
      <div class="fs-dock-head mono">
        <span class="fs-dock-name">▸ ${esc(exerciseName(g.exerciseId))}</span>
        ${logMode === 'freestyle' ? `<button type="button" class="btn ghost small" id="fs-dock-add">+ Übung</button>` : ''}
      </div>`;
    if (fsPhase === 'idle') {
      return `${head}
        <button type="button" class="btn fs-dock-btn" id="fs-start-set">▶ Satz starten</button>`;
    }
    if (fsPhase === 'working') {
      return `${head}
        <div class="fs-work-timer mono" id="fs-work-timer">${fmtMinSec(fsWorkTimer.seconds)}</div>
        <button type="button" class="btn fs-dock-btn" id="fs-end-set">■ Satz beenden</button>`;
    }
    // 'resting' — während der Pause zur Übung gewechselt (siehe
    // activateFsGroup): für die noch satzlose neue Übung ist es der ERSTE
    // Satz, nicht der "nächste" einer schon begonnenen.
    const isExecute = logMode === 'execute';
    const reachedTarget = isExecute && g.targetSets != null && g.sets.length >= g.targetSets;
    // Nächste NOCH OFFENE Übung, nicht einfach die nächste im Array —
    // sonst würde ein Sprung ausser der Reihe (z. B. Gerät besetzt, erst
    // eine andere gemacht) hier eine bereits erledigte Übung nochmal
    // vorschlagen statt eine wirklich offene.
    const nextUnfinishedIdx = isExecute ? findNextUnfinishedExerciseIndex(builder, builder.activeIndex) : null;
    const restHtml = `<div class="fs-rest-timer mono" id="fs-rest-timer">PAUSE ${fmtMinSec(fsRestTimer.seconds)}</div>`;
    if (reachedTarget && nextUnfinishedIdx != null) {
      // Plan-Ziel für diese Übung erreicht — automatisch die nächste offene
      // Übung vorschlagen. Ein Extra-Satz bleibt trotzdem manuell möglich;
      // das ändert nur DIESE Ausführung, nicht den gespeicherten Plan.
      return `${head}${restHtml}
        <div class="fs-dock-row">
          <button type="button" class="btn ghost fs-dock-btn fs-dock-secondary" id="fs-next-set">+ Extra</button>
          <button type="button" class="btn fs-dock-btn" id="fs-next-exercise" data-next-idx="${nextUnfinishedIdx}">▶ ${esc(exerciseName(builder.exercises[nextUnfinishedIdx].exerciseId))}</button>
        </div>`;
    }
    const label = g.sets.length ? (reachedTarget ? '+ Extra-Satz' : '▶ Nächster Satz') : '▶ Satz starten';
    return `${head}${restHtml}
      <button type="button" class="btn fs-dock-btn" id="fs-next-set">${label}</button>`;
  };

  const enteringHtml = (g) => {
    const unit = exerciseUnit(g.exerciseId);
    const isHold = unit === 'time';
    // 'entering': Vorschlag fürs Gewicht-Feld zuerst der zuletzt in DIESER
    // Session geloggte Satz (damit ein zweiter, dritter... Satz nicht
    // wieder den alten Session-übergreifenden Wert zeigt), erst wenn noch
    // keiner erfasst wurde die Historie als Ausgangspunkt. Wdh. kommt nur
    // vom Vorsatz DIESER Session (gleiche Einheit) — beim ersten Satz
    // bleibt sie leer. Vorausgefüllt wird sie beim Fokussieren markiert,
    // eine neue Zahl ersetzt sie also direkt.
    const last = g.sets.length ? g.sets[g.sets.length - 1] : lastValueForExercise(g.exerciseId);
    const prevSessionSet = g.sets.length ? g.sets[g.sets.length - 1] : null;
    const prevReps = prevSessionSet && (prevSessionSet.unit || 'reps') === 'reps' ? String(prevSessionSet.reps ?? '') : '';
    // Bei Isohold-Übungen IST die gestoppte Dauer die Angabe — die wird
    // direkt übernommen statt sie erst manuell als "Wiederholung" abtippen
    // oder per Extra-Knopf umdeuten zu müssen. Sekunden sind eine Zeit,
    // keine Wiederholung.
    return `
      <div class="fs-captured-duration mono">Dauer: ${fmtMinSec(fsCapturedElapsed)}</div>
      <div class="chip-row" id="fs-unit-toggle" style="margin-bottom:8px;">
        <button type="button" class="chip ${!isHold ? 'active' : ''}" data-unit="reps">Wdh.</button>
        <button type="button" class="chip ${isHold ? 'active' : ''}" data-unit="time">Zeit</button>
      </div>
      <div class="field-row">
        <div class="field"><label>Gewicht (kg)</label><input type="number" inputmode="decimal" enterkeyhint="next" id="fs-weight" value="${last && last.weight != null ? esc(String(last.weight)) : ''}" step="0.5"></div>
        <div class="field"><label>${isHold ? 'Dauer (s)' : 'Wdh.'}</label><input type="text" inputmode="numeric" enterkeyhint="done" id="fs-reps" value="${isHold ? fsCapturedElapsed : esc(prevReps)}"></div>
      </div>
      <button type="button" class="btn small" id="fs-add-set" style="width:100%;">Satz speichern</button>
    `;
  };

  // Plan-Ausführung zeigt die Übungen in fester Plan-Reihenfolge,
  // Freestyle die neueste ganz oben (Übungen kommen nach und nach dazu).
  const isExecute = logMode === 'execute';
  const activeGroup = builder.exercises[builder.activeIndex];
  const orderedExercises = builder.exercises.map((g, gi) => ({ g, gi }));
  if (!isExecute) orderedExercises.reverse();
  holder.innerHTML = `
    ${orderedExercises.map(({ g, gi }) => {
      const isActive = gi === builder.activeIndex;
      const isDone = isExecute && fsExerciseDone(g);
      const targetText = g.targetReps != null
        ? `Ziel: ${g.targetSets}×${g.targetReps}${g.targetWeight ? ' @ ' + g.targetWeight + 'kg' : ''}`
        : '';
      return `
    <div class="fs-group ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}" id="fs-group-${gi}">
      <div class="fs-group-head">
        <span data-activate="${gi}" style="cursor:pointer;">${isDone ? '<span class="fs-done-check">✓</span> ' : ''}${esc(exerciseName(g.exerciseId))}</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="ex-row-remove" data-info="${gi}" title="Info zur Übung">ℹ</button>
          ${logMode === 'freestyle' ? `<button type="button" class="ex-row-remove" data-remove-group="${gi}" title="Übung entfernen">×</button>` : ''}
        </div>
      </div>
      ${isActive && fsPhase === 'entering' ? `<div class="fs-inline-input" id="fs-entry-box">${enteringHtml(g)}</div>` : ''}
      ${g.infoOpen ? fsExerciseInfoHtml(g.exerciseId) : ''}
      ${isActive ? fsMachineNoteHtml(g.exerciseId) : ''}
      ${isActive && targetText ? `<div class="fs-target-value mono">${esc(targetText)}</div>` : ''}
      ${isActive ? exerciseHistoryTableHtml(g.exerciseId) : ''}
      ${(() => {
        // Vergleich mit demselben Satz (gleicher Index) der letzten Session
        // mit dieser Übung — zeigt sofort, ob man sich gegenüber letztem
        // Mal gesteigert hat, statt das erst in der Verlaufstabelle
        // nachrechnen zu müssen. Nur bei gleicher Einheit (Wdh. vs. Zeit)
        // vergleichbar — sonst stünden Sekunden gegen Wiederholungen. Basis
        // ist das Volumen (Gewicht × Wdh./Zeit), nicht die reine
        // Wiederholungszahl — sonst hätte mehr Gewicht bei bewusst weniger
        // Wiederholungen (ein schwererer, kein schwächerer Satz) fälschlich
        // als Verschlechterung gegolten.
        const prevSession = historyForExercise(g.exerciseId, 1)[0];
        return g.sets.length ? g.sets.map((s, si) => ({ s, si })).reverse().map(({ s, si }) => {
          const setIsHold = setUnitSuffix(g.exerciseId, s) === 's';
          const prevSet = prevSession && prevSession.sets[si];
          let deltaHtml = '';
          if (prevSet && setUnitSuffix(g.exerciseId, prevSet) === (setIsHold ? 's' : '')) {
            const curVol = setVolume(s);
            const prevVol = setVolume(prevSet);
            if (curVol != null && prevVol != null && prevVol > 0) {
              const pct = Math.round(((curVol - prevVol) / prevVol) * 100);
              if (pct !== 0) {
                deltaHtml = `<span class="fs-set-delta ${pct > 0 ? 'fs-delta-up' : 'fs-delta-down'}">${pct > 0 ? '+' : ''}${pct}%</span>`;
              }
            }
          }
          return `
        <div class="fs-set-row mono">
          <span>Satz ${si + 1}</span>
          ${deltaHtml}
          <input type="number" inputmode="decimal" step="0.5" class="ex-row-input" data-edit="${gi}:${si}:weight" value="${s.weight !== '' && s.weight != null ? esc(String(s.weight)) : ''}" placeholder="kg" title="Gewicht">
          <input type="text" inputmode="numeric" class="ex-row-input" data-edit="${gi}:${si}:reps" value="${esc(String(s.reps))}" placeholder="${setIsHold ? 's' : 'Wdh'}" title="${setIsHold ? 'Dauer (s)' : 'Wiederholungen'}">
          <button type="button" class="ex-row-remove" data-remove-set="${gi}:${si}" title="Satz entfernen">×</button>
        </div>
      `;
        }).join('') : '<div class="fs-set-row mono" style="color:var(--ink-faint);">noch keine Sätze</div>';
      })()}
    </div>
  `;
    }).join('')}`;
  if (activeGroup && fsPhase !== 'entering') {
    const dock = ensureFsDock();
    dock.innerHTML = dockHtml(activeGroup);
    dock.classList.toggle('resting', fsPhase === 'resting');
    dock.classList.remove('hidden');
    document.body.classList.add('has-fs-dock');
  } else {
    hideFsDock();
  }
  updateFsWorkTimerUI();
  updateFsRestTimerUI();

  const dockAdd = document.getElementById('fs-dock-add');
  if (dockAdd) {
    dockAdd.onclick = () => {
      // Hoch zur Übungsauswahl — Topbar-Höhe abziehen, sonst läge der obere
      // Teil (Körperbild + Regionen-Chips) unter der fixen Topbar.
      const grid = document.getElementById('fs-exercise-grid');
      if (!grid) return;
      const topbarH = document.querySelector('.topbar')?.getBoundingClientRect().height || 0;
      const targetTop = grid.getBoundingClientRect().top + window.scrollY - topbarH - 8;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    };
  }
  const startSetBtn = document.getElementById('fs-start-set');
  if (startSetBtn) {
    startSetBtn.onclick = () => {
      fsPhase = 'working';
      startFsWorkTimer();
      renderFsPanel();
    };
  }
  const endSetBtn = document.getElementById('fs-end-set');
  if (endSetBtn) {
    endSetBtn.onclick = () => {
      stopFsWorkTimer();
      fsCapturedElapsed = fsWorkTimer.seconds;
      fsPhase = 'entering';
      renderFsPanel();
      // Direkt in die Zahleneingabe springen, Ziffern-Tastatur gleich
      // offen — sonst müsste man nach "Satz beenden" erst nochmal aufs
      // Gewicht-Feld tippen, obwohl man da eh sofort hinwill. Funktioniert
      // nur zuverlässig, weil das noch im selben Klick-Handler (also
      // innerhalb der Nutzer-Geste) passiert.
      document.getElementById('fs-weight')?.focus();
      // Die Eingabe steht in der Karte der Übung, nicht unten in der
      // Leiste — dorthin scrollen, sobald die Tastatur aufgegangen ist
      // (vorher stimmt die sichtbare Höhe noch nicht), damit das Feld
      // oben im Bild steht und nicht von der Tastatur verdeckt wird.
      setTimeout(() => {
        const box = document.getElementById('fs-entry-box');
        if (!box) return;
        const topbarH = document.querySelector('.topbar')?.getBoundingClientRect().height || 0;
        box.style.scrollMarginTop = `${topbarH + 8}px`;
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    };
  }
  const nextSetBtn = document.getElementById('fs-next-set');
  if (nextSetBtn) {
    nextSetBtn.onclick = () => {
      stopFsRestTimer();
      fsPhase = 'working';
      startFsWorkTimer();
      renderFsPanel();
    };
  }
  const nextExerciseBtn = document.getElementById('fs-next-exercise');
  if (nextExerciseBtn) {
    // Anders als ein blosser Übungswechsel (z. B. über den Picker mitten in
    // der Pause, siehe activateFsGroup): "Nächste Übung" im Plan ist eine
    // bewusste "ich bin bereit"-Entscheidung, kein zufälliges Hinschauen —
    // deshalb hier direkt die Arbeits-Stoppuhr für die neue Übung starten,
    // ohne nochmal "Start" verlangen zu müssen.
    nextExerciseBtn.onclick = () => {
      builder.activeIndex = Number(nextExerciseBtn.dataset.nextIdx);
      fsNoteEditing = false;
      stopFsRestTimer();
      fsPhase = 'working';
      startFsWorkTimer();
      renderFsPanel();
    };
  }

  holder.querySelectorAll('[data-activate]').forEach((el) => {
    el.onclick = () => {
      const idx = Number(el.dataset.activate);
      if (idx === builder.activeIndex) return;
      activateFsGroup(builder, idx);
    };
  });
  holder.querySelectorAll('[data-info]').forEach((btn) => {
    btn.onclick = () => {
      const g = builder.exercises[Number(btn.dataset.info)];
      g.infoOpen = !g.infoOpen;
      renderFsPanel();
    };
  });
  holder.querySelectorAll('[data-remove-group]').forEach((btn) => {
    btn.onclick = () => {
      const gi = Number(btn.dataset.removeGroup);
      builder.exercises.splice(gi, 1);
      if (builder.activeIndex >= builder.exercises.length) builder.activeIndex = builder.exercises.length - 1;
      renderFsPanel();
    };
  });
  holder.querySelectorAll('[data-remove-set]').forEach((btn) => {
    btn.onclick = () => {
      const [gi, si] = btn.dataset.removeSet.split(':').map(Number);
      builder.exercises[gi].sets.splice(si, 1);
      renderFsPanel();
    };
  });
  holder.querySelectorAll('[data-edit]').forEach((inp) => {
    inp.oninput = () => {
      const [gi, si, f] = inp.dataset.edit.split(':');
      const set = builder.exercises[Number(gi)].sets[Number(si)];
      set[f] = f === 'weight' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
      if (logMode === 'freestyle') saveDraft('freestyle', builder);
    };
  });
  holder.querySelectorAll('[data-machine-note]').forEach((ta) => {
    ta.onchange = () => {
      const id = ta.dataset.machineNote;
      exerciseSettings[id] = ta.value;
      fbPut(`exerciseSettings/${state.member.id}/${id}`, ta.value);
    };
    // Zurück zur kompakten Textanzeige, sobald man das Feld verlässt —
    // ändert nichts an "change" oben, das feuert unabhängig davon vorher.
    ta.onblur = () => { fsNoteEditing = false; renderFsPanel(); };
  });
  const noteEditBtn = document.getElementById('fs-machine-note-edit');
  if (noteEditBtn) {
    noteEditBtn.onclick = () => { fsNoteEditing = true; renderFsPanel(); };
  }
  const noteInput = document.getElementById('fs-machine-note-input');
  if (noteInput) {
    noteInput.focus();
    noteInput.setSelectionRange(noteInput.value.length, noteInput.value.length);
  }
  holder.querySelectorAll('#fs-unit-toggle .chip').forEach((btn) => {
    btn.onclick = () => {
      setExerciseUnit(activeGroup.exerciseId, btn.dataset.unit);
      renderFsPanel();
    };
  });
  const weightEl = document.getElementById('fs-weight');
  const repsEl = document.getElementById('fs-reps');
  if (weightEl) {
    // Beim Fokussieren den Wert markieren statt zu löschen — Tippen
    // ersetzt eine markierte Auswahl automatisch, aber man sieht den
    // vorgeschlagenen Wert noch kurz, bevor man drüberschreibt. Wichtig
    // seit "Satz beenden" das Feld selbst fokussiert (siehe fs-end-set):
    // ein Leeren beim Fokus hätte den hilfreichen Vorschlag sofort wieder
    // gelöscht, bevor man ihn überhaupt sieht.
    weightEl.onfocus = (e) => { e.target.select(); };
    repsEl.onfocus = (e) => { e.target.select(); };
    const submitSet = () => {
      const reps = repsEl.value.trim();
      if (!reps) { toast('Wiederholungen eingeben.', 'err'); return; }
      const weightRaw = weightEl.value;
      // Feld VOR dem Neu-Rendern aktiv verlassen (Tastatur zu) — sonst
      // entscheidet auf Android manchmal die virtuelle Tastatur selbst,
      // wohin der Fokus springt, sobald das fokussierte Element beim
      // Re-Render verschwindet (z. B. zurück auf einen älteren Satz). Das
      // Neu-Rendern (das den Fokus zerstört) erst einen Tick später, damit
      // der Blur zuverlässig zuerst durchläuft, bevor Android reagiert.
      weightEl.blur();
      repsEl.blur();
      setTimeout(() => {
        const unit = exerciseUnit(builder.exercises[builder.activeIndex].exerciseId);
        builder.exercises[builder.activeIndex].sets.push({ weight: weightRaw === '' ? '' : Number(weightRaw), reps, elapsedSec: fsCapturedElapsed, unit });
        fsPhase = 'resting';
        startFsRestTimer();
        renderFsPanel();
      }, 0);
    };
    // Enter im Gewicht-Feld springt nur weiter zu Wdh. (wie Tab) — Enter im
    // Wdh.-Feld loggt den Satz direkt und schliesst die Tastatur, ohne dass
    // man extra den Button antippen muss.
    weightEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); repsEl.focus(); } };
    repsEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitSet(); } };
    document.getElementById('fs-add-set').onclick = submitSet;
  }
}

function renderLogExerciseRows() {
  saveDraft('log_exercises', logBuilder.exercises);
  const holder = document.getElementById('log-exercise-rows');
  if (!holder) return;
  holder.innerHTML = logBuilder.exercises.length ? logBuilder.exercises.map((ex, i) => `
    <div class="ex-row" id="log-exercise-row-${i}">
      <span class="ex-row-name">${esc(exerciseName(ex.exerciseId))}</span>
      <input type="number" data-i="${i}" data-f="sets" value="${ex.sets}" placeholder="Sätze" class="ex-row-input" title="Sätze">
      <button type="button" class="ex-row-step" data-step="${i}" title="Zusätzlicher Satz">+</button>
      <input type="text" inputmode="numeric" data-i="${i}" data-f="reps" value="${esc(String(ex.reps))}" placeholder="Wdh" class="ex-row-input" title="Wiederholungen">
      <input type="number" data-i="${i}" data-f="weight" value="${ex.weight}" placeholder="kg" step="0.5" class="ex-row-input" title="Gewicht">
      <button type="button" class="ex-row-remove" data-remove="${i}">×</button>
    </div>
  `).join('') : '<div class="list-empty" style="margin-bottom:14px;">Noch keine Übungen — Vorlage laden oder unten hinzufügen.</div>';

  holder.querySelectorAll('input').forEach((inp) => {
    inp.oninput = () => {
      const i = Number(inp.dataset.i);
      const f = inp.dataset.f;
      logBuilder.exercises[i][f] = f === 'reps' ? inp.value : (Number(inp.value) || 0);
      saveDraft('log_exercises', logBuilder.exercises);
    };
  });
  holder.querySelectorAll('[data-step]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.step);
      logBuilder.exercises[i].sets = (Number(logBuilder.exercises[i].sets) || 0) + 1;
      renderLogExerciseRows();
    };
  });
  holder.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => {
      logBuilder.exercises.splice(Number(btn.dataset.remove), 1);
      renderLogExerciseRows();
      const startBtn = document.getElementById('plan-start');
      if (startBtn) startBtn.disabled = !logBuilder.exercises.length;
      showFabStart('▶ STARTEN', 'plan-start');
    };
  });
}

/* ================================================================
   FINGERBOARD
   ================================================================= */
let fbQuickstartOpen = false; // Schnelltraining-Karten sind standardmässig eingeklappt
/* Schnelltraining: 'own' = eigene Vorlagen, 'crew' = von anderen geteilte.
   Tab-Wahl pro Gerät gemerkt; Ersteller-Filter/"Ausgeblendete zeigen" nur
   für die aktuelle Ansicht. */
let fbQsTab = (() => { try { return localStorage.getItem('pincho_fb_qs_tab') || 'own'; } catch (e) { return 'own'; } })();
let fbQsCreator = 'all';
let fbQsShowHidden = false;
/* Pro Mitglied ausgeblendete Crew-Vorlagen ({sharedTemplateId: true}) —
   nur für einen selbst unsichtbar, die Vorlage bleibt für alle anderen. */
let hiddenTemplates = {};
async function loadHiddenTemplates() {
  const raw = await fbGet(`hiddenTemplates/${state.member.id}`);
  hiddenTemplates = raw || {};
}
let fbCheckinTyping = false; // während der Wdh./Gewicht-Eingabe im Check-in steht der Countdown still
let fbCheckinPausedAt = null; // Date.now() seit wann (siehe fbCheckinTyping) — verschiebt fb.stepStartedAt beim Verlassen des Felds um die getippte Dauer (Ring-Sync)
let fbImportOpen = false; // JSON-Import-Panel ist standardmässig eingeklappt

/* Ablauf aus JSON importieren — z. B. von einer anderen KI generiert (siehe
   Vorlagen-Dokument). Alles-oder-nichts: bei auch nur einem ungültigen Satz
   wird NICHTS übernommen und stattdessen die genaue Fehlerliste gezeigt —
   lieber klar nachfragen/korrigieren lassen, als eine kaputte Zeile still
   zu überspringen oder mit einem Rateweg zu füllen. */
function parseImportedAblauf(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return { errors: ['Ungültiges JSON: ' + e.message] }; }
  if (!Array.isArray(raw)) return { errors: ['Erwartet ein JSON-Array von Sätzen, z. B. [ {...}, {...} ].'] };
  if (!raw.length) return { errors: ['Das Array ist leer.'] };

  const errors = [];
  const blocks = [];
  raw.forEach((b, i) => {
    const n = i + 1;
    if (!b || typeof b !== 'object' || Array.isArray(b)) { errors.push(`Satz ${n}: kein Objekt.`); return; }
    if (b.type === 'hang') {
      const board = BOARDS[b.board];
      if (!board) { errors.push(`Satz ${n}: unbekanntes board "${b.board}" (erlaubt: bm1000, bm2000).`); return; }
      const isAsym = b.gripLeft != null || b.gripRight != null;
      let gripFields = {};
      if (isAsym) {
        if (!board.grips.some((g) => g.id === b.gripLeft)) { errors.push(`Satz ${n}: unbekannter gripLeft "${b.gripLeft}" für ${b.board}.`); return; }
        if (!board.grips.some((g) => g.id === b.gripRight)) { errors.push(`Satz ${n}: unbekannter gripRight "${b.gripRight}" für ${b.board}.`); return; }
        gripFields = { gripLeft: b.gripLeft, gripRight: b.gripRight };
      } else {
        if (!board.grips.some((g) => g.id === b.grip)) { errors.push(`Satz ${n}: unbekannter grip "${b.grip}" für ${b.board}.`); return; }
        gripFields = { grip: b.grip };
      }
      const reps = Number(b.reps);
      const hangSec = Number(b.hangSec);
      const restSec = Number(b.restSec);
      const blockRestSec = b.blockRestSec != null ? Number(b.blockRestSec) : null;
      if (!(reps > 0)) { errors.push(`Satz ${n}: reps muss eine Zahl > 0 sein.`); return; }
      if (!(hangSec > 0)) { errors.push(`Satz ${n}: hangSec muss eine Zahl > 0 sein.`); return; }
      if (!(restSec >= 0)) { errors.push(`Satz ${n}: restSec muss eine Zahl >= 0 sein.`); return; }
      if (blockRestSec != null && !(blockRestSec >= 0)) { errors.push(`Satz ${n}: blockRestSec muss eine Zahl >= 0 sein.`); return; }
      blocks.push({ type: 'hang', board: b.board, ...gripFields, reps, hangSec, restSec, ...(blockRestSec != null ? { blockRestSec } : {}) });
    } else if (b.type === 'block') {
      if (typeof b.grip !== 'string' || !b.grip.trim()) { errors.push(`Satz ${n}: grip muss ein nicht-leerer Text sein (z. B. "Leiste 1" oder "Pinch").`); return; }
      const fingers = Number(b.fingers);
      if (![1, 2, 3, 4].includes(fingers)) { errors.push(`Satz ${n}: fingers muss 1, 2, 3 oder 4 sein.`); return; }
      const weight = b.weight != null ? Number(b.weight) : 0;
      if (!Number.isFinite(weight)) { errors.push(`Satz ${n}: weight muss eine Zahl sein.`); return; }
      const mode = b.mode === 'reps' ? 'reps' : 'hold';
      const reps = Number(b.reps);
      const restSec = Number(b.restSec);
      if (!(reps > 0)) { errors.push(`Satz ${n}: reps muss eine Zahl > 0 sein.`); return; }
      if (!(restSec >= 0)) { errors.push(`Satz ${n}: restSec muss eine Zahl >= 0 sein.`); return; }
      if (mode === 'reps') {
        const workSec = Number(b.workSec != null ? b.workSec : 40);
        if (!(workSec > 0)) { errors.push(`Satz ${n}: workSec muss eine Zahl > 0 sein.`); return; }
        blocks.push({ type: 'block', grip: b.grip.trim(), fingers, weight, mode, reps, workSec, restSec });
      } else {
        const hangSec = Number(b.hangSec);
        const blockRestSec = b.blockRestSec != null ? Number(b.blockRestSec) : null;
        if (!(hangSec > 0)) { errors.push(`Satz ${n}: hangSec muss eine Zahl > 0 sein.`); return; }
        if (blockRestSec != null && !(blockRestSec >= 0)) { errors.push(`Satz ${n}: blockRestSec muss eine Zahl >= 0 sein.`); return; }
        // handMode/startHand nur im Halten-Modus (dort ist jede Wiederholung
        // ein eigener, klar abgegrenzter Satz — im Wiederholungen-Modus läuft
        // alles in einem durchgehenden Timer, ein Handwechsel liesse sich
        // dort nicht sauber verorten). Fehlen sie im Import, "fixed"/"left"
        // als rückwärtskompatibler Standard (ältere Sätze kannten das noch
        // nicht, waren aber implizit immer einarmig-fixiert).
        const handMode = b.handMode != null ? b.handMode : 'fixed';
        if (!['fixed', 'alternate', 'block'].includes(handMode)) { errors.push(`Satz ${n}: handMode muss "fixed", "alternate" oder "block" sein.`); return; }
        const startHand = b.startHand != null ? b.startHand : 'left';
        if (startHand !== 'left' && startHand !== 'right') { errors.push(`Satz ${n}: startHand muss "left" oder "right" sein.`); return; }
        blocks.push({ type: 'block', grip: b.grip.trim(), fingers, weight, mode, reps, hangSec, restSec, ...(blockRestSec != null ? { blockRestSec } : {}), handMode, startHand });
      }
    } else if (b.type === 'exercise') {
      const isPseudoExercise = b.exerciseId === 'warmup_general' || b.exerciseId === 'cooldown_general';
      if (!isPseudoExercise && !EXERCISE_LIBRARY.some((e) => e.id === b.exerciseId)) { errors.push(`Satz ${n}: unbekannte exerciseId "${b.exerciseId}".`); return; }
      const reps = Number(b.reps);
      const workSec = Number(b.workSec != null ? b.workSec : 40);
      const restSec = Number(b.restSec != null ? b.restSec : 0);
      if (!(reps > 0)) { errors.push(`Satz ${n}: reps muss eine Zahl > 0 sein.`); return; }
      if (!(workSec > 0)) { errors.push(`Satz ${n}: workSec muss eine Zahl > 0 sein.`); return; }
      if (!(restSec >= 0)) { errors.push(`Satz ${n}: restSec muss eine Zahl >= 0 sein.`); return; }
      blocks.push({ type: 'exercise', exerciseId: b.exerciseId, reps, workSec, restSec });
    } else if (b.type === 'campus') {
      if (!CAMPUS_RUNG_TYPES.some((t) => t.id === b.rungType)) { errors.push(`Satz ${n}: unbekannter rungType "${b.rungType}".`); return; }
      if (b.moveMode !== 'direct' && b.moveMode !== 'pattern') { errors.push(`Satz ${n}: moveMode muss "direct" oder "pattern" sein.`); return; }
      const reps = Number(b.reps);
      const workSec = Number(b.workSec);
      const restSec = Number(b.restSec != null ? b.restSec : 0);
      const blockRestSec = b.blockRestSec != null ? Number(b.blockRestSec) : null;
      if (!(reps > 0)) { errors.push(`Satz ${n}: reps muss eine Zahl > 0 sein.`); return; }
      if (!(workSec > 0)) { errors.push(`Satz ${n}: workSec muss eine Zahl > 0 sein.`); return; }
      if (!(restSec >= 0)) { errors.push(`Satz ${n}: restSec muss eine Zahl >= 0 sein.`); return; }
      if (blockRestSec != null && !(blockRestSec >= 0)) { errors.push(`Satz ${n}: blockRestSec muss eine Zahl >= 0 sein.`); return; }
      const armMode = b.armMode != null ? b.armMode : 'both';
      if (armMode !== 'both' && armMode !== 'match' && armMode !== 'skip') { errors.push(`Satz ${n}: armMode muss "both", "match" oder "skip" sein.`); return; }
      const startHand = b.startHand != null ? b.startHand : 'left';
      if (startHand !== 'left' && startHand !== 'right') { errors.push(`Satz ${n}: startHand muss "left" oder "right" sein.`); return; }
      const common = { type: 'campus', rungType: b.rungType, moveMode: b.moveMode, reps, workSec, restSec, armMode, ...(armMode !== 'both' ? { startHand } : {}), ...(blockRestSec != null ? { blockRestSec } : {}) };
      if (b.moveMode === 'direct') {
        const fromRung = Number(b.fromRung);
        const toRung = Number(b.toRung);
        if (!(fromRung > 0)) { errors.push(`Satz ${n}: fromRung muss eine Zahl > 0 sein.`); return; }
        if (!(toRung > 0)) { errors.push(`Satz ${n}: toRung muss eine Zahl > 0 sein.`); return; }
        blocks.push({ ...common, fromRung, toRung });
      } else {
        const startRung = Number(b.startRung);
        if (!(startRung > 0)) { errors.push(`Satz ${n}: startRung muss eine Zahl > 0 sein.`); return; }
        if (!Array.isArray(b.pattern) || !b.pattern.length || !b.pattern.every((p) => Number.isFinite(Number(p)) && Number(p) !== 0)) {
          errors.push(`Satz ${n}: pattern muss ein nicht-leeres Array von Zahlen ungleich 0 sein, z. B. [2, -1].`);
          return;
        }
        blocks.push({ ...common, startRung, pattern: b.pattern.map(Number) });
      }
    } else if (b.type === 'pause') {
      const seconds = Number(b.seconds);
      if (!(seconds > 0)) { errors.push(`Satz ${n}: seconds muss eine Zahl > 0 sein.`); return; }
      blocks.push({ type: 'pause', seconds });
    } else {
      errors.push(`Satz ${n}: "type" muss "hang", "block", "exercise", "campus" oder "pause" sein (war "${b.type}").`);
    }
  });

  if (errors.length) return { errors };
  return { blocks };
}

const fb = {
  board: null,
  selectedGrip: null,   // am grafischen Board gewählter Griff, fürs Hinzufügen eines Hang-Satzes
  gripMode: 'same',     // 'same' | 'different' — ein Griff für beide Hände, oder pro Hand ein eigener
  pickingHand: 'left',  // 'left' | 'right' — welche Hand gerade am Board gewählt wird, wenn gripMode==='different'
  selectedGripLeft: null,
  selectedGripRight: null,
  addType: 'hang',       // 'hang' | 'block' | 'exercise' | 'campus' | 'pause' — welches Add-Panel gerade offen ist
  newHang: { reps: 3, hangSec: 7, restSec: 30, blockRestSec: 60 },      // Werte fürs nächste Hinzufügen, direkt im Add-Panel editierbar
  newBlock: { gripType: 'leiste', leisteWidth: 15, fingers: 4, weight: 0, mode: 'hold', reps: 3, hangSec: 7, restSec: 30, blockRestSec: 60, workSec: 40, handMode: 'fixed', startHand: 'left' },
  newExercise: { exerciseId: ACCESSORY_EXERCISES[0].id, reps: 15, workSec: 40, restSec: 30 },
  newCampus: {
    rungType: CAMPUS_RUNG_TYPES[0].id, moveMode: 'direct',
    fromRung: 1, toRung: 4, stepSize: 3, startRung: 1, pattern: [],
    // stepSize: Schrittweite für "Von → Zu" — Default = volle Distanz (ein
    // einziger Sprung, wie bisher); kleiner ergibt Zwischenstopps
    // (Leiter mit Sprossen überspringen, z. B. Von 1/Zu 9/Schrittweite 2
    // -> 1-3-5-7-9). Wird beim Ändern von Von/Zu automatisch auf die neue
    // volle Distanz zurückgesetzt (siehe data-step-Handler), bleibt aber
    // erhalten, solange nur die Schrittweite selbst geändert wird.
    returnEnabled: false, returnTo: 1, returnStepSize: 3,
    // returnEnabled: optionaler Rückweg nach "Zu Sprosse" (z. B. Von 1,
    // Zu 9, dann zurück zu Sprosse 4 — der klassische "1→9→4"-Satz).
    // returnStepSize eigenständig, nicht an stepSize gekoppelt: rauf in
    // 2er-Schritten, aber einzeln wieder runter soll möglich sein.
    reps: 4, workSec: 3, restSec: 15, blockRestSec: 90,
    armMode: 'both', startHand: 'left', // armMode: 'both' | 'match' | 'skip' — 'match'/'skip' zeigen zusätzlich startHand
  },
  newPause: { seconds: 60 },
  blocks: loadDraft('fb_blocks') || [], // Ablauf: {type:'hang', board, grip, reps, hangSec, restSec, blockRestSec} | {type:'block', grip, fingers, weight, reps, hangSec, restSec, blockRestSec} | {type:'exercise', exerciseId, reps, workSec, restSec} | {type:'campus', rungType, moveMode, reps, workSec, restSec, blockRestSec, fromRung/toRung ODER startRung/pattern, armMode, startHand} | {type:'pause', seconds}
  templates: [],         // eigene, in Firebase gespeicherte Abläufe
  weight: '',
  blockIndex: 0,
  running: false,
  awaitingNext: false,   // Satz fertig, wartet auf "Los" für den nächsten
  preCount: null,        // 5..1 während des Vorbereitungs-Countdowns vor einem Hang-Satz, sonst null
  sequence: [],          // flache Phasenliste NUR für den gerade laufenden Hang-Satz
  stepIndex: 0,
  secondsLeft: 0,
  stepStartedAt: 0,      // Date.now() bei Start des aktuellen Schritts — Basis für den Ring (siehe syncFbRingAnimation)
  pausedAt: null,        // Date.now() seit wann pausiert (fbTogglePause), sonst null — verschiebt stepStartedAt beim Fortsetzen um die Pausendauer
  intervalId: null,
  wakeLock: null,
  runResults: [],        // pro Blockindex: {type:'hang', doneReps:[bool,...]} | {type:'exercise', reps, weight} — was beim Durchlauf tatsächlich geschafft wurde
  showOverview: false,   // Restprogramm-Übersicht (siehe toggleFbOverview) gerade über dem laufenden Timer eingeblendet
  showLos: false,        // "LOS!" blitzt kurz statt der Zahl auf, siehe advanceToNextStep
  losTimeoutId: null,
};

/* Echtes Board-Bild (eigene Illustration/eigenes Foto, siehe assets/) mit
   unsichtbaren, antippbaren Kreiszonen über den Griffen (Positionen aus
   data.js, in % von Bildbreite/-höhe — funktioniert responsiv). Da es sich
   bislang um eine Illustration handelt, ist die Zuordnung Zone↔Kategorie
   nach bestem Augenmass gewählt, nicht pixelgenau vermessen. */
/* Welche Seite des Boards ein Loch ist — bei "pro Hand unterschiedlich"
   gehört das linke Loch zur linken Hand, das rechte zur rechten (mittige
   Griffe wie die grosse Kante zu beiden). */
function hotspotSide(h) {
  const x = h.hx != null ? h.hx : h.x;
  return x < 47 ? 'left' : x > 53 ? 'right' : 'center';
}
function hotspotHandClass(gripState, h) {
  const side = hotspotSide(h);
  return [
    h.grip === gripState.selectedGripLeft && side !== 'right' ? 'active-left' : '',
    h.grip === gripState.selectedGripRight && side !== 'left' ? 'active-right' : '',
  ].filter(Boolean).join(' ');
}
function holeStyle(h) {
  if (h.hw == null) return `left:${h.x}%;top:${h.y}%;`;
  return `left:${h.hx}%;top:${h.hy}%;width:${h.hw}%;height:${h.hh}%;`;
}
function renderBoardImage(gripState = fb, photoId = 'fb-board-photo') {
  const board = BOARDS[gripState.board];
  const spots = board.hotspots.map((h) => {
    const grip = board.grips.find((g) => g.id === h.grip);
    const cls = gripState.gripMode === 'different'
      ? hotspotHandClass(gripState, h)
      : (gripState.selectedGrip === h.grip ? 'active' : '');
    // Form des echten Lochs (hx/hy/hw/hh in % des Bildes, siehe data.js);
    // Sloper oben sind Flächen statt Löcher (surface).
    return `<button type="button" class="board-hotspot hole ${h.surface ? 'surface' : ''} ${cls}" style="${holeStyle(h)}" data-grip="${h.grip}" data-side="${hotspotSide(h)}" data-hx="${h.hx != null ? h.hx : h.x}" title="${esc(grip.label)}${grip.note ? ' · ' + esc(grip.note) : ''}" aria-label="${esc(grip.label)}"></button>`;
  }).join('');
  return `<div class="board-photo-wrap" id="${photoId}">
    <img src="${board.image}" alt="${esc(board.label)}">
    ${spots}
  </div>`;
}

/* Kalibrierhilfe: bei Klick irgendwo auf dem Bild (ausserhalb der
   Hotspot-Kreise) die exakte %-Position anzeigen — damit sich die
   hotspots-Koordinaten in data.js an den echten Löchern ausrichten lassen,
   egal welches Bild verwendet wird. */
function wireCalibration() {
  const wrap = document.getElementById('fb-board-photo');
  const readout = document.getElementById('fb-calib-readout');
  if (!wrap || !readout) return;
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('.board-hotspot')) return;
    const rect = wrap.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const line = `{ grip: '???', x: ${x}, y: ${y} },`;
    readout.textContent = line;
    if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
  });
}

function fbSelectedGripHint(gripState = fb) {
  if (gripState.gripMode === 'different') {
    const left = gripState.selectedGripLeft ? esc(gripLabel(gripState.board, gripState.selectedGripLeft)) : '—';
    const right = gripState.selectedGripRight ? esc(gripLabel(gripState.board, gripState.selectedGripRight)) : '—';
    return `<span class="hand-l">Links: ${left}</span> · <span class="hand-r">Rechts: ${right}</span>`;
  }
  return gripState.selectedGrip
    ? 'Gewählt: ' + esc(gripLabel(gripState.board, gripState.selectedGrip))
    : 'Griff am Board antippen (oder unten aus der Liste wählen).';
}

/* Nur die betroffenen Elemente aktualisieren statt renderFingerboard()
   komplett neu aufzurufen — ein voller Re-Render ersetzt #app und wirft
   den Scroll dabei zurück nach oben. Beim wiederholten Antippen mehrerer
   Griffe beim Ablauf-Bauen war das der eigentliche Grund fürs ständige
   Hoch-/Runterscrollen, nicht nur die Reihenfolge der Abschnitte. Bei
   gripMode==='different' schreibt ein Tap auf die gerade aktive Hand
   (fb.pickingHand), beide Hände bleiben gleichzeitig am Board sichtbar
   (unterschiedlich eingefärbt), damit man den Unterschied sofort sieht. */
function selectFbGrip(gripId, side) {
  // Loch links/rechts am Board angetippt: bestimmt direkt die Hand. Nur bei
  // mittigen Griffen oder Auswahl aus der Liste zählt die gerade aktive
  // Hand — dann nach links automatisch zu rechts weiterschalten.
  const bySide = fb.gripMode === 'different' && (side === 'left' || side === 'right');
  if (bySide) fb.pickingHand = side;
  const advanceToRight = fb.gripMode === 'different' && !bySide && fb.pickingHand === 'left';
  if (fb.gripMode === 'different') {
    if (fb.pickingHand === 'left') fb.selectedGripLeft = gripId;
    else fb.selectedGripRight = gripId;
    if (advanceToRight) fb.pickingHand = 'right';
  } else {
    fb.selectedGrip = gripId;
  }
  const hint = document.getElementById('fb-selected-hint');
  if (hint) hint.innerHTML = fbSelectedGripHint();
  document.querySelectorAll('#fb-board-visual .board-hotspot').forEach((el) => {
    if (fb.gripMode === 'different') {
      const h = { grip: el.dataset.grip, hx: Number(el.dataset.hx) };
      el.classList.remove('active-left', 'active-right');
      hotspotHandClass(fb, h).split(' ').filter(Boolean).forEach((c) => el.classList.add(c));
    } else {
      el.classList.toggle('active', el.dataset.grip === gripId);
    }
  });
  const select = document.getElementById('fb-grip-select');
  const selectValue = fb.gripMode === 'different' ? (fb.pickingHand === 'left' ? fb.selectedGripLeft : fb.selectedGripRight) : gripId;
  if (select) select.value = selectValue || '';
  const handLabels = document.getElementById('fb-hand-toggle');
  if (handLabels) {
    const leftBtn = handLabels.querySelector('[data-hand="left"]');
    const rightBtn = handLabels.querySelector('[data-hand="right"]');
    if (leftBtn) leftBtn.textContent = 'Links' + (fb.selectedGripLeft ? ': ' + gripLabel(fb.board, fb.selectedGripLeft) : ' wählen');
    if (rightBtn) rightBtn.textContent = 'Rechts' + (fb.selectedGripRight ? ': ' + gripLabel(fb.board, fb.selectedGripRight) : ' wählen');
    leftBtn.classList.toggle('active', fb.pickingHand === 'left');
    rightBtn.classList.toggle('active', fb.pickingHand === 'right');
    const label = document.querySelector('#fb-add-panel .field label');
    if (label) label.textContent = `Oder aus der Liste wählen (für ${fb.pickingHand === 'left' ? 'links' : 'rechts'})`;
  }
}

/* ---------- Griff eines bestehenden Satzes nachträglich ändern ----------
   Antippen des Board-Thumbnails in der Ablauf-Liste (siehe renderFbBlocksList)
   statt den Satz löschen und neu anlegen zu müssen, nur um den Griff zu
   korrigieren. Eigener State (fbGripEditor) statt der fb.*-Felder von oben,
   die für den "neuen Satz hinzufügen"-Baukasten reserviert sind — beide
   könnten sonst gleichzeitig offen sein (Baukasten unten auf der Seite,
   Editor als Overlay darüber) und sich gegenseitig überschreiben. Volles
   Neu-Rendern des Sheets bei jedem Tap statt der Teil-Updates von
   selectFbGrip() — hier unkritisch, da es sich (anders als der oft
   mehrfach hintereinander genutzte Baukasten) um ein selten geöffnetes
   Overlay handelt. */
let fbGripEditor = null; // { blockIndex, board, gripMode, pickingHand, selectedGrip, selectedGripLeft, selectedGripRight }

function ensureFbGripEditorSheet() {
  let el = document.getElementById('fb-grip-editor-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fb-grip-editor-sheet';
    el.className = 'info-sheet-backdrop hidden';
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el) closeFbGripEditor(); };
  }
  return el;
}
function closeFbGripEditor() {
  fbGripEditor = null;
  const el = document.getElementById('fb-grip-editor-sheet');
  if (el) el.classList.add('hidden');
}
function openFbGripEditor(index) {
  const b = fb.blocks[index];
  if (!b) return;
  if (b.type === 'block') { openFbBlockGripEditor(index); return; } // Lifting Pin: Chips statt Board-Bild
  fbGripEditor = {
    blockIndex: index,
    board: b.board,
    gripMode: hangIsAsymmetric(b) ? 'different' : 'same',
    pickingHand: 'left',
    selectedGrip: hangIsAsymmetric(b) ? null : b.grip,
    selectedGripLeft: hangIsAsymmetric(b) ? b.gripLeft : null,
    selectedGripRight: hangIsAsymmetric(b) ? b.gripRight : null,
  };
  renderFbGripEditorSheet();
}
function selectFbEditorGrip(gripId, side) {
  const st = fbGripEditor;
  if (!st) return;
  const bySide = st.gripMode === 'different' && (side === 'left' || side === 'right');
  if (bySide) st.pickingHand = side;
  const advanceToRight = st.gripMode === 'different' && !bySide && st.pickingHand === 'left';
  if (st.gripMode === 'different') {
    if (st.pickingHand === 'left') st.selectedGripLeft = gripId;
    else st.selectedGripRight = gripId;
    if (advanceToRight) st.pickingHand = 'right';
  } else {
    st.selectedGrip = gripId;
  }
  renderFbGripEditorSheet();
}
function renderFbGripEditorSheet() {
  const st = fbGripEditor;
  if (!st) return;
  const el = ensureFbGripEditorSheet();
  el.innerHTML = `
    <div class="info-sheet-card">
      <button type="button" class="info-sheet-close" id="fbge-close">✕</button>
      <div class="info-sheet-title">Griff bearbeiten</div>
      <div class="chip-row" id="fbge-board-toggle">
        <button type="button" class="chip ${st.board === 'bm1000' ? 'active' : ''}" data-board="bm1000">BM 1000</button>
        <button type="button" class="chip ${st.board === 'bm2000' ? 'active' : ''}" data-board="bm2000">BM 2000</button>
      </div>
      <div class="chip-row" id="fbge-gripmode-toggle">
        <button type="button" class="chip ${st.gripMode === 'same' ? 'active' : ''}" data-grip-mode="same">Beide Hände gleich</button>
        <button type="button" class="chip ${st.gripMode === 'different' ? 'active' : ''}" data-grip-mode="different">Unterschiedlich</button>
      </div>
      ${st.gripMode === 'different' ? `
        <div class="chip-row" id="fbge-hand-toggle">
          <button type="button" class="chip ${st.pickingHand === 'left' ? 'active' : ''}" data-hand="left" data-hand-color="l">Links${st.selectedGripLeft ? ': ' + esc(gripLabel(st.board, st.selectedGripLeft)) : ' wählen'}</button>
          <button type="button" class="chip ${st.pickingHand === 'right' ? 'active' : ''}" data-hand="right" data-hand-color="r">Rechts${st.selectedGripRight ? ': ' + esc(gripLabel(st.board, st.selectedGripRight)) : ' wählen'}</button>
        </div>
      ` : ''}
      <div class="board-visual">${renderBoardImage(st, 'fbge-board-photo')}</div>
      <p class="login-hint" style="margin:8px 0;">${fbSelectedGripHint(st)}</p>
      <div class="field">
        <label>${st.gripMode === 'different' ? `Oder aus der Liste wählen (für ${st.pickingHand === 'left' ? 'links' : 'rechts'})` : 'Oder aus der Liste wählen'}</label>
        <select id="fbge-grip-select">
          <option value="">— Griff wählen —</option>
          ${BOARDS[st.board].grips.map((g) => `<option value="${g.id}" ${(st.gripMode === 'different' ? (st.pickingHand === 'left' ? st.selectedGripLeft : st.selectedGripRight) : st.selectedGrip) === g.id ? 'selected' : ''}>${esc(g.label)}${g.note ? ' · ' + esc(g.note) : ''}${gripArmNote(st.board, g.id) ? ' · ' + gripArmNote(st.board, g.id) : ''}</option>`).join('')}
        </select>
      </div>
      <button type="button" class="btn" id="fbge-save" style="width:100%;margin-top:12px;">Übernehmen</button>
    </div>
  `;
  el.classList.remove('hidden');
  document.getElementById('fbge-close').onclick = closeFbGripEditor;
  document.getElementById('fbge-board-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      st.board = btn.dataset.board;
      st.selectedGrip = null;
      st.selectedGripLeft = null;
      st.selectedGripRight = null;
      renderFbGripEditorSheet();
    };
  });
  document.getElementById('fbge-gripmode-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { st.gripMode = btn.dataset.gripMode; st.pickingHand = 'left'; renderFbGripEditorSheet(); };
  });
  const handToggle = document.getElementById('fbge-hand-toggle');
  if (handToggle) {
    handToggle.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => { st.pickingHand = btn.dataset.hand; renderFbGripEditorSheet(); };
    });
  }
  el.querySelectorAll('.board-hotspot').forEach((btn) => {
    btn.onclick = () => selectFbEditorGrip(btn.dataset.grip, btn.dataset.side);
  });
  document.getElementById('fbge-grip-select').onchange = (e) => selectFbEditorGrip(e.target.value || null);
  document.getElementById('fbge-save').onclick = () => {
    const b = fb.blocks[st.blockIndex];
    if (!b) { closeFbGripEditor(); return; }
    if (st.gripMode === 'different') {
      if (!st.selectedGripLeft || !st.selectedGripRight) { toast('Zuerst Griff für links UND rechts wählen.', 'err'); return; }
      b.board = st.board;
      b.gripLeft = st.selectedGripLeft;
      b.gripRight = st.selectedGripRight;
      delete b.grip;
    } else {
      if (!st.selectedGrip) { toast('Zuerst einen Griff wählen.', 'err'); return; }
      b.board = st.board;
      b.grip = st.selectedGrip;
      delete b.gripLeft;
      delete b.gripRight;
    }
    renderFbBlocksList();
    closeFbGripEditor();
    toast('Griff aktualisiert.', 'ok');
  };
}

/* Lifting-Pin-Pendant: kein Board-Bild, sondern dieselben Leiste/Pinch- +
   mm-Preset-Chips wie im "neuen Satz hinzufügen"-Baukasten (siehe
   renderBlockAddPanel/blockGripFromSelection), nur eben zum Nachbearbeiten
   eines bereits angelegten Satzes statt zum Neuanlegen. */
let fbBlockGripEditor = null; // { blockIndex, gripType, leisteWidth }

function ensureFbBlockGripEditorSheet() {
  let el = document.getElementById('fb-block-grip-editor-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fb-block-grip-editor-sheet';
    el.className = 'info-sheet-backdrop hidden';
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el) closeFbBlockGripEditor(); };
  }
  return el;
}
function closeFbBlockGripEditor() {
  fbBlockGripEditor = null;
  const el = document.getElementById('fb-block-grip-editor-sheet');
  if (el) el.classList.add('hidden');
}
function openFbBlockGripEditor(index) {
  const b = fb.blocks[index];
  if (!b || b.type !== 'block') return;
  // Bestehenden Freitext-Grip so gut wie möglich in gripType/leisteWidth
  // zurückübersetzen (auch bei älterem/importiertem Freitext, der nicht
  // exakt "Leiste Xmm" lautet — dann Default 15mm als Startpunkt).
  const m = /^Leiste (\d+)mm$/.exec(b.grip || '');
  fbBlockGripEditor = {
    blockIndex: index,
    gripType: b.grip === 'Pinch' ? 'pinch' : 'leiste',
    leisteWidth: m ? Number(m[1]) : 15,
  };
  renderFbBlockGripEditorSheet();
}
function renderFbBlockGripEditorSheet() {
  const st = fbBlockGripEditor;
  if (!st) return;
  const el = ensureFbBlockGripEditorSheet();
  const isLeiste = st.gripType === 'leiste';
  el.innerHTML = `
    <div class="info-sheet-card">
      <button type="button" class="info-sheet-close" id="fbbge-close">✕</button>
      <div class="info-sheet-title">Griff bearbeiten</div>
      <div class="chip-row" id="fbbge-griptype-row">
        <button type="button" class="chip ${isLeiste ? 'active' : ''}" data-grip-type="leiste">Leiste</button>
        <button type="button" class="chip ${!isLeiste ? 'active' : ''}" data-grip-type="pinch">Pinch</button>
      </div>
      ${isLeiste ? `
        <div class="chip-row" id="fbbge-width-row">
          ${LEISTE_WIDTHS_MM.map((mm) => `<button type="button" class="chip ${st.leisteWidth === mm ? 'active' : ''}" data-leiste-width="${mm}">${mm}mm</button>`).join('')}
        </div>
      ` : ''}
      <button type="button" class="btn" id="fbbge-save" style="width:100%;margin-top:12px;">Übernehmen</button>
    </div>
  `;
  el.classList.remove('hidden');
  document.getElementById('fbbge-close').onclick = closeFbBlockGripEditor;
  document.getElementById('fbbge-griptype-row').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { st.gripType = btn.dataset.gripType; renderFbBlockGripEditorSheet(); };
  });
  const widthRow = document.getElementById('fbbge-width-row');
  if (widthRow) {
    widthRow.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        st.leisteWidth = Number(btn.dataset.leisteWidth);
        widthRow.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
  }
  document.getElementById('fbbge-save').onclick = () => {
    const b = fb.blocks[st.blockIndex];
    if (!b) { closeFbBlockGripEditor(); return; }
    b.grip = blockGripFromSelection(st);
    renderFbBlocksList();
    closeFbBlockGripEditor();
    toast('Griff aktualisiert.', 'ok');
  };
}

/* ---------- "Eigenen Ablauf bauen": ein Satz nach dem anderen ----------
   Ein einziges, kompaktes Add-Panel statt über die Seite verteilter
   Abschnitte — Board (klein) + Namens-Liste als zweiter Auswahlweg direkt
   darunter, dann Sätze/Zeiten, dann der Hinzufügen-Button. Nach dem
   Hinzufügen bleibt man auf derselben Stelle stehen (kein Re-Render der
   ganzen Seite) und kann direkt den nächsten Satz konfigurieren. */
function renderFbAddPanel() {
  const holder = document.getElementById('fb-add-panel');
  if (!holder) return;

  if (fb.addType === 'hang') {
    holder.innerHTML = `
      <div class="chip-row" id="fb-board-toggle">
        <button class="chip ${fb.board === 'bm1000' ? 'active' : ''}" data-board="bm1000">BM 1000</button>
        <button class="chip ${fb.board === 'bm2000' ? 'active' : ''}" data-board="bm2000">BM 2000</button>
      </div>
      <div class="chip-row" id="fb-gripmode-toggle">
        <button class="chip ${fb.gripMode === 'same' ? 'active' : ''}" data-grip-mode="same">Beide Hände gleich</button>
        <button class="chip ${fb.gripMode === 'different' ? 'active' : ''}" data-grip-mode="different">Unterschiedlich</button>
      </div>
      ${fb.gripMode === 'different' ? `
        <div class="chip-row" id="fb-hand-toggle">
          <button class="chip ${fb.pickingHand === 'left' ? 'active' : ''}" data-hand="left" data-hand-color="l">Links${fb.selectedGripLeft ? ': ' + esc(gripLabel(fb.board, fb.selectedGripLeft)) : ' wählen'}</button>
          <button class="chip ${fb.pickingHand === 'right' ? 'active' : ''}" data-hand="right" data-hand-color="r">Rechts${fb.selectedGripRight ? ': ' + esc(gripLabel(fb.board, fb.selectedGripRight)) : ' wählen'}</button>
        </div>
      ` : ''}
      <div class="board-visual" id="fb-board-visual">${renderBoardImage()}</div>
      <p class="mono" id="fb-calib-readout" style="text-align:center;font-size:11px;color:var(--ink-faint);margin:6px 0;min-height:14px;"></p>
      <p class="login-hint" id="fb-selected-hint" style="margin:0 0 8px;">${fbSelectedGripHint()}</p>
      <div class="field">
        <label>${fb.gripMode === 'different' ? `Oder aus der Liste wählen (für ${fb.pickingHand === 'left' ? 'links' : 'rechts'})` : 'Oder aus der Liste wählen'}</label>
        <select id="fb-grip-select">
          <option value="">— Griff wählen —</option>
          ${BOARDS[fb.board].grips.map((g) => `<option value="${g.id}" ${(fb.gripMode === 'different' ? (fb.pickingHand === 'left' ? fb.selectedGripLeft : fb.selectedGripRight) : fb.selectedGrip) === g.id ? 'selected' : ''}>${esc(g.label)}${g.note ? ' · ' + esc(g.note) : ''}${gripArmNote(fb.board, g.id) ? ' · ' + gripArmNote(fb.board, g.id) : ''}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Sätze</label><input type="number" id="fb-new-reps" value="${fb.newHang.reps}" min="1"></div>
        <div class="field"><label>Hang (s)</label><input type="number" id="fb-new-hangsec" value="${fb.newHang.hangSec}" min="1"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Pause zw. Sätzen (s)</label><input type="number" id="fb-new-restsec" value="${fb.newHang.restSec}" min="0"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-new-blockrestsec" value="${fb.newHang.blockRestSec}" min="0"></div>
      </div>
      <button type="button" class="btn" id="fb-add-hang" style="width:100%;">+ Hang-Satz hinzufügen</button>
    `;
    wireCalibration();
    document.getElementById('fb-board-toggle').querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.board = btn.dataset.board;
        fb.selectedGrip = null;
        fb.selectedGripLeft = null;
        fb.selectedGripRight = null;
        state.memberDoc = { ...(state.memberDoc || {}), board: fb.board };
        fbPatch(`members/${state.member.id}`, { board: fb.board });
        renderFbAddPanel();
      };
    });
    document.getElementById('fb-gripmode-toggle').querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.gripMode = btn.dataset.gripMode;
        fb.pickingHand = 'left';
        renderFbAddPanel();
      };
    });
    const handToggle = document.getElementById('fb-hand-toggle');
    if (handToggle) {
      handToggle.querySelectorAll('.chip').forEach((btn) => {
        btn.onclick = () => {
          fb.pickingHand = btn.dataset.hand;
          handToggle.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
          const select = document.getElementById('fb-grip-select');
          if (select) select.value = (fb.pickingHand === 'left' ? fb.selectedGripLeft : fb.selectedGripRight) || '';
          const label = document.querySelector('#fb-add-panel .field label');
          if (label) label.textContent = `Oder aus der Liste wählen (für ${fb.pickingHand === 'left' ? 'links' : 'rechts'})`;
        };
      });
    }
    document.getElementById('fb-board-visual').querySelectorAll('.board-hotspot').forEach((el) => {
      el.onclick = () => selectFbGrip(el.dataset.grip, el.dataset.side);
    });
    document.getElementById('fb-grip-select').onchange = (e) => selectFbGrip(e.target.value || null);
    document.getElementById('fb-new-reps').oninput = (e) => { fb.newHang.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-hangsec').oninput = (e) => { fb.newHang.hangSec = Number(e.target.value) || 1; };
    document.getElementById('fb-new-restsec').oninput = (e) => { fb.newHang.restSec = Number(e.target.value) || 0; };
    document.getElementById('fb-new-blockrestsec').oninput = (e) => { fb.newHang.blockRestSec = Number(e.target.value) || 0; };
    ['fb-new-reps', 'fb-new-hangsec', 'fb-new-restsec', 'fb-new-blockrestsec'].forEach(selectOnFocus);
    document.getElementById('fb-add-hang').onclick = () => {
      if (fb.gripMode === 'different') {
        if (!fb.selectedGripLeft || !fb.selectedGripRight) { toast('Zuerst Griff für links UND rechts wählen.', 'err'); return; }
        fb.blocks.push({ type: 'hang', board: fb.board, gripLeft: fb.selectedGripLeft, gripRight: fb.selectedGripRight, ...fb.newHang });
      } else {
        if (!fb.selectedGrip) { toast('Zuerst einen Griff wählen.', 'err'); return; }
        fb.blocks.push({ type: 'hang', board: fb.board, grip: fb.selectedGrip, ...fb.newHang });
      }
      renderFbBlocksList();
    };
  } else if (fb.addType === 'block') {
    renderBlockAddPanel(holder);
  } else if (fb.addType === 'exercise') {
    holder.innerHTML = `
      <div class="chip-row" id="fb-pseudo-exercise-row" style="margin-bottom:10px;">
        <button type="button" class="chip ${fb.newExercise.exerciseId === 'warmup_general' ? 'active' : ''}" data-pseudo-exercise="warmup_general">🔥 Warm-up</button>
        <button type="button" class="chip ${fb.newExercise.exerciseId === 'cooldown_general' ? 'active' : ''}" data-pseudo-exercise="cooldown_general">🧘 Cooldown</button>
      </div>
      <div class="field">
        <label>Übung</label>
        <div id="fb-exercise-grid"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Ziel-Wdh.</label><input type="number" id="fb-new-exreps" value="${fb.newExercise.reps}" min="1"></div>
        <div class="field"><label>Dauer (s)</label><input type="number" id="fb-new-exwork" value="${fb.newExercise.workSec}" min="5"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-new-exrest" value="${fb.newExercise.restSec}" min="0"></div>
      </div>
      <button type="button" class="btn" id="fb-add-exercise" style="width:100%;">+ Übung hinzufügen</button>
    `;
    holder.querySelectorAll('[data-pseudo-exercise]').forEach((btn) => {
      btn.onclick = () => { fb.newExercise.exerciseId = btn.dataset.pseudoExercise; renderFbAddPanel(); };
    });
    wireExercisePickerGrid('fb-exercise-grid', EXERCISE_LIBRARY, fb.newExercise.exerciseId, (id) => { fb.newExercise.exerciseId = id; }, 'fb-add-exercise', false);
    document.getElementById('fb-new-exreps').oninput = (e) => { fb.newExercise.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-exwork').oninput = (e) => { fb.newExercise.workSec = Number(e.target.value) || 5; };
    document.getElementById('fb-new-exrest').oninput = (e) => { fb.newExercise.restSec = Number(e.target.value) || 0; };
    ['fb-new-exreps', 'fb-new-exwork', 'fb-new-exrest'].forEach(selectOnFocus);
    document.getElementById('fb-add-exercise').onclick = () => {
      fb.blocks.push({ type: 'exercise', ...fb.newExercise });
      renderFbBlocksList();
    };
  } else if (fb.addType === 'campus') {
    renderCampusAddPanel(holder);
  } else {
    renderPauseAddPanel(holder);
  }
}

/* Griffblock/Lifting Pin: ein Trainingsblock mit mehreren Leisten (oder
   ein Lifting Pin), der über die Querseite auch als Pinch nutzbar ist.
   Kein Foto/Hotspots wie beim Fingerboard — Griff/Leiste ist deshalb
   freier Text (z. B. "Leiste 1" oder "Pinch"), dazu Fingerzahl (1-4, gilt
   für Leisten UND Pinch) und Gewicht. Anders als beim Hang-Satz ist das
   Gewicht hier das TATSÄCHLICHE geladene Gesamtgewicht (z. B. eine
   angesteckte Scheibe), kein "Zusatzgewicht" oben auf das Körpergewicht.
   Immer einarmig (nur eine Hand gleichzeitig), deshalb kein Links/Rechts-
   Umschalter wie beim Hang-Satz. Wahlweise als Halten (Sekundentimer wie
   ein Hang-Satz) ODER als Wiederholungen (heben/ablassen zählen, wie eine
   Fixübung) — ein Lifting Pin wird nicht nur statisch gehalten, sondern
   auch für Wiederholungen genutzt. */
const LEISTE_WIDTHS_MM = [5, 10, 15, 20, 25, 30];
/* Baut den freien Griff-Anzeigetext aus der strukturierten Auswahl statt
   ihn frei eintippen zu lassen — Pinch braucht keine Breite (über die
   Querseite), eine Leiste schon (feste Auswahl in 5mm-Schritten). */
function blockGripFromSelection(b) {
  return b.gripType === 'pinch' ? 'Pinch' : `Leiste ${b.leisteWidth}mm`;
}
function renderBlockAddPanel(holder) {
  const isReps = fb.newBlock.mode === 'reps';
  const isLeiste = fb.newBlock.gripType === 'leiste';
  holder.innerHTML = `
    <div class="field">
      <label>Griff</label>
      <div class="chip-row" id="fb-block-griptype-row">
        <button type="button" class="chip ${isLeiste ? 'active' : ''}" data-grip-type="leiste">Leiste</button>
        <button type="button" class="chip ${!isLeiste ? 'active' : ''}" data-grip-type="pinch">Pinch</button>
      </div>
    </div>
    <div id="fb-block-leiste-width-field" ${isLeiste ? '' : 'hidden'}>
      <div class="field">
        <label>Leisten-Breite</label>
        <div class="chip-row" id="fb-block-leistewidth-row">
          ${LEISTE_WIDTHS_MM.map((mm) => `<button type="button" class="chip ${fb.newBlock.leisteWidth === mm ? 'active' : ''}" data-leiste-width="${mm}">${mm}mm</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="field">
      <label>Finger</label>
      <div class="chip-row" id="fb-block-fingers-row">
        ${[1, 2, 3, 4].map((n) => `<button type="button" class="chip ${fb.newBlock.fingers === n ? 'active' : ''}" data-fingers="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Gewicht (kg)</label><div class="kg-field"><input type="number" inputmode="decimal" id="fb-block-weight" value="${fb.newBlock.weight}" step="0.5"><span class="mono">kg</span></div></div>
    <div class="chip-row" id="fb-block-mode-row">
      <button type="button" class="chip ${!isReps ? 'active' : ''}" data-mode="hold">Halten</button>
      <button type="button" class="chip ${isReps ? 'active' : ''}" data-mode="reps">Wiederholungen</button>
    </div>
    <div id="fb-block-mode-fields"></div>
    ${!isReps ? `
    <div class="field">
      <label>Hand (einarmig)</label>
      <div class="chip-row" id="fb-block-handmode-row">
        <button type="button" class="chip ${fb.newBlock.handMode === 'fixed' ? 'active' : ''}" data-hand-mode="fixed">Fixiert</button>
        <button type="button" class="chip ${fb.newBlock.handMode === 'alternate' ? 'active' : ''}" data-hand-mode="alternate">Abwechselnd</button>
        <button type="button" class="chip ${fb.newBlock.handMode === 'block' ? 'active' : ''}" data-hand-mode="block">Block</button>
      </div>
    </div>
    <div class="chip-row" id="fb-block-starthand-row">
      <button type="button" class="chip ${fb.newBlock.startHand === 'left' ? 'active' : ''}" data-start-hand="left"><span class="emoji">🫲</span>${fb.newBlock.handMode === 'fixed' ? 'Links' : 'Links zuerst'}</button>
      <button type="button" class="chip ${fb.newBlock.startHand === 'right' ? 'active' : ''}" data-start-hand="right"><span class="emoji">🫱</span>${fb.newBlock.handMode === 'fixed' ? 'Rechts' : 'Rechts zuerst'}</button>
    </div>
    ` : ''}
    <button type="button" class="btn" id="fb-add-block" style="width:100%;">+ Lifting-Pin-Satz hinzufügen</button>
  `;
  document.getElementById('fb-block-griptype-row').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.newBlock.gripType = btn.dataset.gripType;
      renderBlockAddPanel(holder);
    };
  });
  const leisteWidthRow = document.getElementById('fb-block-leistewidth-row');
  if (leisteWidthRow) {
    leisteWidthRow.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.newBlock.leisteWidth = Number(btn.dataset.leisteWidth);
        leisteWidthRow.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
  }
  document.getElementById('fb-block-fingers-row').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.newBlock.fingers = Number(btn.dataset.fingers);
      document.getElementById('fb-block-fingers-row').querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
    };
  });
  document.getElementById('fb-block-weight').oninput = (e) => { fb.newBlock.weight = e.target.value === '' ? 0 : Number(e.target.value); };
  selectOnFocus('fb-block-weight');
  document.getElementById('fb-block-mode-row').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.newBlock.mode = btn.dataset.mode;
      renderBlockAddPanel(holder);
    };
  });
  const handModeRow = document.getElementById('fb-block-handmode-row');
  if (handModeRow) {
    handModeRow.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.newBlock.handMode = btn.dataset.handMode;
        renderBlockAddPanel(holder);
      };
    });
  }
  const startHandRow = document.getElementById('fb-block-starthand-row');
  if (startHandRow) {
    startHandRow.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.newBlock.startHand = btn.dataset.startHand;
        startHandRow.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
  }
  renderBlockModeFields();
  document.getElementById('fb-add-block').onclick = () => {
    const b = { type: 'block', grip: blockGripFromSelection(fb.newBlock), fingers: fb.newBlock.fingers, weight: fb.newBlock.weight, mode: fb.newBlock.mode };
    if (fb.newBlock.mode === 'reps') {
      Object.assign(b, { reps: fb.newBlock.reps, workSec: fb.newBlock.workSec, restSec: fb.newBlock.restSec });
    } else {
      Object.assign(b, { reps: fb.newBlock.reps, hangSec: fb.newBlock.hangSec, restSec: fb.newBlock.restSec, blockRestSec: fb.newBlock.blockRestSec, handMode: fb.newBlock.handMode, startHand: fb.newBlock.startHand });
    }
    fb.blocks.push(b);
    renderFbBlocksList();
  };
}
/* Die zweite Zeile Felder je nach Halten/Wiederholungen — separat, damit
   der Moduswechsel nicht das ganze Panel (inkl. Griff/Finger/Gewicht)
   neu aufbauen und den Tipp-Fokus verlieren muss. */
function renderBlockModeFields() {
  const holder = document.getElementById('fb-block-mode-fields');
  if (!holder) return;
  if (fb.newBlock.mode === 'reps') {
    holder.innerHTML = `
      <div class="field-row">
        <div class="field"><label>Ziel-Wdh.</label><input type="number" id="fb-block-reps" value="${fb.newBlock.reps}" min="1"></div>
        <div class="field"><label>Dauer (s)</label><input type="number" id="fb-block-worksec" value="${fb.newBlock.workSec}" min="5"></div>
      </div>
      <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-block-restsec" value="${fb.newBlock.restSec}" min="0"></div>
    `;
    document.getElementById('fb-block-reps').oninput = (e) => { fb.newBlock.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-block-worksec').oninput = (e) => { fb.newBlock.workSec = Number(e.target.value) || 5; };
    document.getElementById('fb-block-restsec').oninput = (e) => { fb.newBlock.restSec = Number(e.target.value) || 0; };
    ['fb-block-reps', 'fb-block-worksec', 'fb-block-restsec'].forEach(selectOnFocus);
  } else {
    holder.innerHTML = `
      <div class="field-row">
        <div class="field"><label>Sätze</label><input type="number" id="fb-block-reps" value="${fb.newBlock.reps}" min="1"></div>
        <div class="field"><label>Halten (s)</label><input type="number" id="fb-block-hangsec" value="${fb.newBlock.hangSec}" min="1"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Pause zw. Sätzen (s)</label><input type="number" id="fb-block-restsec" value="${fb.newBlock.restSec}" min="0"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-block-blockrestsec" value="${fb.newBlock.blockRestSec}" min="0"></div>
      </div>
    `;
    document.getElementById('fb-block-reps').oninput = (e) => { fb.newBlock.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-block-hangsec').oninput = (e) => { fb.newBlock.hangSec = Number(e.target.value) || 1; };
    document.getElementById('fb-block-restsec').oninput = (e) => { fb.newBlock.restSec = Number(e.target.value) || 0; };
    document.getElementById('fb-block-blockrestsec').oninput = (e) => { fb.newBlock.blockRestSec = Number(e.target.value) || 0; };
    ['fb-block-reps', 'fb-block-hangsec', 'fb-block-restsec', 'fb-block-blockrestsec'].forEach(selectOnFocus);
  }
}

/* Reine Pause zum freien Einfügen in den Ablauf — z. B. zwischen zwei
   Board-Sätzen, ohne dass sie an einen bestimmten Satz-Typ gekoppelt ist. */
function renderPauseAddPanel(holder) {
  holder.innerHTML = `
    <div class="field"><label>Pause (s)</label><input type="number" id="fb-new-pause-seconds" value="${fb.newPause.seconds}" min="1"></div>
    <button type="button" class="btn" id="fb-add-pause" style="width:100%;">+ Pause hinzufügen</button>
  `;
  document.getElementById('fb-new-pause-seconds').oninput = (e) => { fb.newPause.seconds = Number(e.target.value) || 1; };
  selectOnFocus('fb-new-pause-seconds');
  document.getElementById('fb-add-pause').onclick = () => {
    fb.blocks.push({ type: 'pause', seconds: fb.newPause.seconds });
    renderFbBlocksList();
  };
}

/* Rechnet Von/Zu/Schrittweite in die konkreten Zwischenstopps um (z. B.
   Von 1, Zu 9, Schrittweite 2 -> 1,3,5,7,9) — reine Vorschau-Anzeige im
   Baukasten; die tatsächliche Umwandlung in ein 'direct'- oder
   'pattern'-Muster-Objekt passiert erst beim Hinzufügen (siehe
   fb-add-campus-Handler), damit sich an den bestehenden zwei
   Bewegungs-Datentypen nichts ändert. */
function campusStepPreview(fromRung, toRung, stepSize) {
  const distance = toRung - fromRung;
  if (distance === 0) return { error: '"Von" und "Zu" dürfen nicht gleich sein.' };
  const dist = Math.abs(distance);
  const steps = dist / stepSize;
  if (!Number.isInteger(steps)) return { error: `Schrittweite muss ${dist} ohne Rest teilen.` };
  const dir = distance > 0 ? 1 : -1;
  const stops = [fromRung];
  for (let i = 0; i < steps; i++) stops.push(stops[stops.length - 1] + dir * stepSize);
  return { stops, steps };
}

/* Hin- plus optionaler Rückweg zu EINER Vorschau + fertigem Pattern
   kombiniert — der Rückweg nutzt seine eigene Schrittweite (rauf in
   2er-Schritten, aber einzeln zurück soll möglich sein). Liefert immer
   ein `pattern`-Array, auch ohne Rückweg (dann nur der Hinweg), damit
   der fb-add-campus-Handler nicht zwischen beiden Fällen unterscheiden
   muss. */
function campusRoundTripPreview(c) {
  const out = campusStepPreview(c.fromRung, c.toRung, c.stepSize);
  if (out.error) return out;
  const dirOut = c.toRung > c.fromRung ? 1 : -1;
  const pattern = Array(out.steps).fill(dirOut * c.stepSize);
  if (!c.returnEnabled) return { stops: out.stops, pattern };
  const back = campusStepPreview(c.toRung, c.returnTo, c.returnStepSize);
  if (back.error) return { error: `Rückweg: ${back.error}` };
  const dirBack = c.returnTo > c.toRung ? 1 : -1;
  pattern.push(...Array(back.steps).fill(dirBack * c.returnStepSize));
  return { stops: [...out.stops, ...back.stops.slice(1)], pattern };
}

/* Beta: Sprossen direkt am Campus-Bild antippen. Die Route wird in den
   bestehenden Feldern gespeichert (2 Stationen = "Von → Zu", mehr =
   Muster mit startRung + pattern), die Zahlen-Stepper darunter bleiben
   als Alternative. */
function campusBuilderStops(c) {
  if (c.routeFresh) return [];
  if (c.moveMode === 'pattern') return campusStopsOf(c);
  const pv = campusRoundTripPreview(c);
  return pv.error ? [c.fromRung, c.toRung] : pv.stops;
}
function campusSetStops(c, stops) {
  c.routeFresh = false;
  c.returnEnabled = false;
  if (stops.length === 2) {
    c.moveMode = 'direct';
    c.fromRung = stops[0]; c.toRung = stops[1];
    c.stepSize = Math.max(1, Math.abs(stops[1] - stops[0]));
  } else {
    c.moveMode = 'pattern';
    c.startRung = stops[0];
    c.pattern = stops.slice(1).map((r, i) => r - stops[i]);
  }
}
function campusPickerSvg(c) {
  const stops = campusBuilderStops(c);
  const typeL = c.rungType;
  const typeR = c.rungSides === 'different' ? (c.rungTypeRight || c.rungType) : c.rungType;
  const stopSet = new Set(stops);
  let shapes = '';
  Object.keys(CAMPUS_GEOMETRY).forEach((t) => {
    const inUse = t === typeL || t === typeR;
    for (let r = 1; r <= 10; r++) {
      const cls = `cr ${inUse ? 'cr-col' : ''} ${inUse && stopSet.has(r) ? 'cr-stop' : ''} ${CAMPUS_GEOMETRY[t].virtual && CAMPUS_GEOMETRY[t].virtual.includes(r) ? 'cr-virtual' : ''}`;
      shapes += campusRungShapes(t, r, cls, `data-type="${t}" data-rung="${r}"`);
    }
  });
  const numbers = {};
  stops.forEach((r, i) => { (numbers[r] = numbers[r] || []).push(i + 1); });
  const [, xR] = campusTypeXRange(typeR);
  const labels = Object.entries(numbers).map(([r, nums]) => {
    const y = campusRungPoint(typeR, Number(r), 'r').y;
    return `<text class="cr-num" x="${Math.min(xR + 8, CAMPUS_IMG_W - 60)}" y="${y + 10}">${nums.join('·')}</text>`;
  }).join('');
  const path = stops.length > 1 ? `<polyline class="cr-path" points="${stops.map((r) => { const pt = campusRungPoint(typeL, r, 'l'); return `${pt.x},${pt.y}`; }).join(' ')}"/>` : '';
  return `<svg class="campus-pick" viewBox="0 0 ${CAMPUS_IMG_W} ${CAMPUS_IMG_H}" role="group" aria-label="Campusboard: Sprossen antippen">
    <image href="${CAMPUS_BOARD_IMAGE}" x="0" y="0" width="${CAMPUS_IMG_W}" height="${CAMPUS_IMG_H}"/>
    ${shapes}${path}${labels}
  </svg>`;
}
function wireCampusPicker(c) {
  document.querySelectorAll('.campus-pick .cr[data-rung]').forEach((el) => {
    el.onclick = () => {
      const type = el.dataset.type;
      const rung = Number(el.dataset.rung);
      const stops = campusBuilderStops(c);
      const typeR = c.rungTypeRight || c.rungType;
      if (c.rungSides === 'different') {
        if (type !== c.rungType && type !== typeR) {
          // Neue Spalte für die gerade gewählte Hand
          if (c.pickHand === 'r') c.rungTypeRight = type;
          else { c.rungType = type; c.pickHand = 'r'; }
          if (!stops.length) { c.routeFresh = false; c.moveMode = 'pattern'; c.startRung = rung; c.pattern = []; }
          renderFbAddPanel();
          return;
        }
      } else if (type !== c.rungType) {
        // Andere Spalte: Typ wechseln und neue Route an dieser Sprosse starten
        c.rungType = type;
        c.routeFresh = false; c.moveMode = 'pattern'; c.startRung = rung; c.pattern = []; c.returnEnabled = false;
        renderFbAddPanel();
        return;
      }
      if (!stops.length) {
        c.routeFresh = false; c.moveMode = 'pattern'; c.startRung = rung; c.pattern = []; c.returnEnabled = false;
      } else if (stops[stops.length - 1] !== rung) {
        campusSetStops(c, [...stops, rung]);
      }
      renderFbAddPanel();
    };
  });
  const sides = document.getElementById('campus-sides-toggle');
  if (sides) sides.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      c.rungSides = btn.dataset.sides;
      if (c.rungSides === 'different') { c.rungTypeRight = c.rungTypeRight || c.rungType; c.pickHand = 'l'; }
      renderFbAddPanel();
    };
  });
  const pick = document.getElementById('campus-pickhand-toggle');
  if (pick) pick.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.pickHand = btn.dataset.pick; renderFbAddPanel(); };
  });
  const undo = document.getElementById('campus-route-undo');
  if (undo) undo.onclick = () => {
    const stops = campusBuilderStops(c).slice(0, -1);
    if (stops.length >= 2) campusSetStops(c, stops);
    else if (stops.length === 1) { c.moveMode = 'pattern'; c.startRung = stops[0]; c.pattern = []; }
    else c.routeFresh = true;
    renderFbAddPanel();
  };
  document.getElementById('campus-route-new').onclick = () => { c.routeFresh = true; c.pattern = []; renderFbAddPanel(); };
}

/* Campus-Board: keine Foto-Hotspots wie beim Hangboard (Sprossen sind
   durchnummeriert, immer in einer Spalte) — stattdessen Sprossen-TYP per
   Chip + die Bewegung rein über Zahlen/Stepper, entweder als direkter
   Sprung ("Von → Zu", optional mit Zwischenstopps über die Schrittweite)
   oder als sich wiederholendes Muster ("+2/-1 usw."). */
function renderCampusAddPanel(holder) {
  const c = fb.newCampus;
  holder.innerHTML = `
    <div class="field">
      <label>Sprossen-Typ</label>
      <div class="chip-row" id="campus-rung-toggle" style="margin-bottom:6px;">
        ${CAMPUS_RUNG_TYPES.map((t) => `<button type="button" class="chip ${c.rungType === t.id ? 'active' : ''}" data-rung="${t.id}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="chip-row" id="campus-sides-toggle" style="margin:8px 0 8px;">
        <button type="button" class="chip ${c.rungSides !== 'different' ? 'active' : ''}" data-sides="same">Beide Hände gleich</button>
        <button type="button" class="chip ${c.rungSides === 'different' ? 'active' : ''}" data-sides="different">Unterschiedlich</button>
      </div>
      ${c.rungSides === 'different' ? `
        <div class="chip-row" id="campus-pickhand-toggle" style="margin-bottom:8px;">
          <button type="button" class="chip ${c.pickHand !== 'r' ? 'active' : ''}" data-hand-color="l" data-pick="l">Links: ${esc(campusRungLabel(c.rungType))}</button>
          <button type="button" class="chip ${c.pickHand === 'r' ? 'active' : ''}" data-hand-color="r" data-pick="r">Rechts: ${esc(campusRungLabel(c.rungTypeRight || c.rungType))}</button>
        </div>` : ''}
      <div class="campus-pick-wrap">${campusPickerSvg(c)}</div>
      <div class="campus-pick-bar">
        <span class="campus-pick-route">${(() => { const st = campusBuilderStops(c); return st.length ? st.join(' → ') : 'Sprossen der Reihe nach antippen: 1. Tipp = Start'; })()}</span>
        <button type="button" class="btn ghost small" id="campus-route-undo" ${campusBuilderStops(c).length ? '' : 'disabled'}>Zurück</button>
        <button type="button" class="btn ghost small" id="campus-route-new">Neu</button>
      </div>
    </div>

    <div class="field">
      <label>Bewegung</label>
      <div class="chip-row" id="campus-mode-toggle" style="margin-bottom:10px;">
        <button type="button" class="chip ${c.moveMode === 'direct' ? 'active' : ''}" data-mode="direct">Von → Zu</button>
        <button type="button" class="chip ${c.moveMode === 'pattern' ? 'active' : ''}" data-mode="pattern">Muster</button>
      </div>
      ${c.moveMode === 'direct' ? `
        <div class="stepper-row">
          <div style="flex:1;">
            <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Von Sprosse</div>
            <div class="stepper-row">
              <button type="button" class="stepper-btn" data-step="fromRung" data-dir="-1">−</button>
              <div class="stepper-num">${c.fromRung}</div>
              <button type="button" class="stepper-btn" data-step="fromRung" data-dir="1">+</button>
            </div>
          </div>
          <div class="arrow">→</div>
          <div style="flex:1;">
            <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Zu Sprosse</div>
            <div class="stepper-row">
              <button type="button" class="stepper-btn" data-step="toRung" data-dir="-1">−</button>
              <div class="stepper-num">${c.toRung}</div>
              <button type="button" class="stepper-btn" data-step="toRung" data-dir="1">+</button>
            </div>
          </div>
        </div>
        <div class="fb-checkin-label" style="text-align:left;margin:14px 0 6px;">Schrittweite</div>
        <div class="stepper-row">
          <button type="button" class="stepper-btn" data-step="stepSize" data-dir="-1">−</button>
          <div class="stepper-num">${c.stepSize}</div>
          <button type="button" class="stepper-btn" data-step="stepSize" data-dir="1">+</button>
        </div>
        <div class="campus-step-hint">Schrittweite = Distanz: ein einziger Sprung, wie ein normaler Von→Zu-Satz. Kleiner: mehrere Zwischenstopps (z. B. Sprossen überspringen).</div>
        <div class="chip-row" id="campus-return-toggle" style="margin:10px 0 ${c.returnEnabled ? '10px' : '0'};">
          <button type="button" class="chip ${c.returnEnabled ? 'active' : ''}" data-toggle-return="1">↩ Und wieder zurück</button>
        </div>
        ${c.returnEnabled ? `
          <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Zurück zu Sprosse</div>
          <div class="stepper-row">
            <button type="button" class="stepper-btn" data-step="returnTo" data-dir="-1">−</button>
            <div class="stepper-num">${c.returnTo}</div>
            <button type="button" class="stepper-btn" data-step="returnTo" data-dir="1">+</button>
          </div>
          <div class="fb-checkin-label" style="text-align:left;margin:14px 0 6px;">Rückweg-Schrittweite</div>
          <div class="stepper-row">
            <button type="button" class="stepper-btn" data-step="returnStepSize" data-dir="-1">−</button>
            <div class="stepper-num">${c.returnStepSize}</div>
            <button type="button" class="stepper-btn" data-step="returnStepSize" data-dir="1">+</button>
          </div>
        ` : ''}
        ${(() => {
          const preview = campusRoundTripPreview(c);
          return preview.error
            ? `<div class="campus-step-preview error">${esc(preview.error)}</div>`
            : `<div class="campus-step-preview"><span class="label">Ergibt</span><span class="route">${preview.stops.join(' → ')}</span></div>`;
        })()}
      ` : `
        <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Start-Sprosse</div>
        <div class="stepper-row" style="margin-bottom:14px;">
          <button type="button" class="stepper-btn" data-step="startRung" data-dir="-1">−</button>
          <div class="stepper-num">${c.startRung}</div>
          <button type="button" class="stepper-btn" data-step="startRung" data-dir="1">+</button>
        </div>
        <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Muster antippen (wiederholt sich automatisch)</div>
        <div class="chip-row" style="margin-bottom:0;">
          <button type="button" class="pattern-btn up" data-add-pat="1">+1</button>
          <button type="button" class="pattern-btn up" data-add-pat="2">+2</button>
          <button type="button" class="pattern-btn up" data-add-pat="3">+3</button>
          <button type="button" class="pattern-btn down" data-add-pat="-1">−1</button>
          <button type="button" class="pattern-btn down" data-add-pat="-2">−2</button>
        </div>
        <div class="pattern-strip">
          ${c.pattern.length
            ? c.pattern.map((p) => `<span class="pattern-pill ${p < 0 ? 'down' : ''}">${Math.abs(p)} ${p > 0 ? '↑' : '↓'}</span>`).join('')
            : '<span class="mono" style="color:var(--ink-faint);font-size:12px;">noch kein Muster</span>'}
          ${c.pattern.length ? '<span class="pattern-clear" id="campus-pattern-clear">Zurücksetzen ×</span>' : ''}
        </div>
      `}
    </div>

    <div class="field">
      <label>Bewegungsart</label>
      <div class="chip-row" id="campus-armmode-toggle" style="margin-bottom:${c.armMode === 'both' ? '0' : '10px'};">
        <button type="button" class="chip ${c.armMode === 'both' ? 'active' : ''}" data-arm="both"><span class="emoji">🙌</span>${campusArmModeLabel('both')}</button>
        <button type="button" class="chip ${c.armMode === 'match' ? 'active' : ''}" data-arm="match"><span class="emoji">🔄</span>${campusArmModeLabel('match')}</button>
        <button type="button" class="chip ${c.armMode === 'skip' ? 'active' : ''}" data-arm="skip"><span class="emoji">🔃</span>${campusArmModeLabel('skip')}</button>
      </div>
      ${c.armMode !== 'both' ? `
        <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Starthand</div>
        <div class="chip-row" id="campus-starthand-toggle" style="margin-bottom:0;">
          <button type="button" class="chip ${c.startHand === 'left' ? 'active' : ''}" data-hand="left"><span class="emoji">🫲</span>Links zuerst</button>
          <button type="button" class="chip ${c.startHand === 'right' ? 'active' : ''}" data-hand="right"><span class="emoji">🫱</span>Rechts zuerst</button>
        </div>
      ` : ''}
    </div>

    <div class="field-row">
      <div class="field"><label>${c.moveMode === 'pattern' ? 'Wdh. des Musters' : 'Sätze'}</label><input type="number" id="campus-reps" value="${c.reps}" min="1"></div>
      <div class="field"><label>Ausführung (s)</label><input type="number" id="campus-worksec" value="${c.workSec}" min="1"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Pause zw. Sätzen (s)</label><input type="number" id="campus-restsec" value="${c.restSec}" min="0"></div>
      <div class="field"><label>Pause danach (s)</label><input type="number" id="campus-blockrestsec" value="${c.blockRestSec}" min="0"></div>
    </div>
    <button type="button" class="btn" id="fb-add-campus" style="width:100%;">+ Campus-Satz hinzufügen</button>
  `;

  document.getElementById('campus-rung-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.rungType = btn.dataset.rung; renderFbAddPanel(); };
  });
  wireCampusPicker(c);
  document.getElementById('campus-mode-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.moveMode = btn.dataset.mode; renderFbAddPanel(); };
  });
  document.getElementById('campus-armmode-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.armMode = btn.dataset.arm; renderFbAddPanel(); };
  });
  const startHandToggle = document.getElementById('campus-starthand-toggle');
  if (startHandToggle) {
    startHandToggle.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => { c.startHand = btn.dataset.hand; renderFbAddPanel(); };
    });
  }
  const returnToggle = document.getElementById('campus-return-toggle');
  if (returnToggle) {
    returnToggle.querySelector('.chip').onclick = () => {
      c.returnEnabled = !c.returnEnabled;
      // Beim Einschalten sinnvolle Defaults setzen: zurück zum Start,
      // gleiche Schrittweite wie der Hinweg (deckt den häufigsten Fall —
      // ganz zurück — ab, ohne dass man erst alles selbst eintippen muss).
      if (c.returnEnabled) { c.returnTo = c.fromRung; c.returnStepSize = c.stepSize; }
      renderFbAddPanel();
    };
  }
  holder.querySelectorAll('[data-step]').forEach((btn) => {
    btn.onclick = () => {
      const field = btn.dataset.step;
      c[field] = Math.max(1, c[field] + Number(btn.dataset.dir));
      // Von/Zu geändert -> Schrittweite auf die neue volle Distanz
      // zurücksetzen (= ein einziger Sprung, wie bisher), sonst bliebe
      // nach einer Bereichsänderung eine Schrittweite stehen, die nicht
      // mehr zur neuen Distanz passt. Wird nur die Schrittweite selbst
      // angetippt, bleibt sie unangetastet. Rückweg-Schrittweite genauso,
      // sobald sich Zu oder das Rückweg-Ziel ändert.
      if (field === 'fromRung' || field === 'toRung') c.stepSize = Math.max(1, Math.abs(c.toRung - c.fromRung));
      if ((field === 'toRung' || field === 'returnTo') && c.returnEnabled) {
        c.returnStepSize = Math.max(1, Math.abs(c.returnTo - c.toRung));
      }
      renderFbAddPanel();
    };
  });
  holder.querySelectorAll('[data-add-pat]').forEach((btn) => {
    btn.onclick = () => { c.pattern.push(Number(btn.dataset.addPat)); renderFbAddPanel(); };
  });
  const clearBtn = document.getElementById('campus-pattern-clear');
  if (clearBtn) clearBtn.onclick = () => { c.pattern = []; renderFbAddPanel(); };
  document.getElementById('campus-reps').oninput = (e) => { c.reps = Number(e.target.value) || 1; };
  document.getElementById('campus-worksec').oninput = (e) => { c.workSec = Number(e.target.value) || 1; };
  document.getElementById('campus-restsec').oninput = (e) => { c.restSec = Number(e.target.value) || 0; };
  document.getElementById('campus-blockrestsec').oninput = (e) => { c.blockRestSec = Number(e.target.value) || 0; };
  document.getElementById('fb-add-campus').onclick = () => {
    if (c.routeFresh || (c.moveMode === 'pattern' && !c.pattern.length)) { toast('Zuerst mindestens zwei Sprossen antippen (oder ein Muster wählen).', 'err'); return; }
    const pushCampus = (blk) => {
      const out = { ...blk };
      delete out.rungSides; delete out.pickHand; delete out.routeFresh;
      if (c.rungSides !== 'different' || !out.rungTypeRight || out.rungTypeRight === out.rungType) delete out.rungTypeRight;
      fb.blocks.push(out);
    };
    if (c.moveMode === 'direct') {
      const preview = campusRoundTripPreview(c);
      if (preview.error) { toast(preview.error, 'err'); return; }
      if (preview.pattern.length > 1) {
        // Schrittweite < volle Distanz und/oder ein Rückweg dazu -> mit
        // Zwischenstopps: intern als 'pattern'-Satz gespeichert (kein
        // neuer Datentyp nötig, exakt dieselbe Struktur wie ein von Hand
        // gebautes Muster).
        pushCampus({ type: 'campus', ...c, moveMode: 'pattern', startRung: c.fromRung, pattern: preview.pattern });
        renderFbBlocksList();
        return;
      }
    }
    pushCampus({ type: 'campus', ...c, pattern: c.pattern.slice() });
    renderFbBlocksList();
  };
}

async function renderFingerboard() {
  if (!fb.board) fb.board = currentMemberBoard();

  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Fingerboard</h2><div class="sec-rule"></div></div>

    <div class="sec-head" id="fb-quickstart-toggle" style="cursor:pointer;">
      <h2 class="sec-title" style="font-size:18px;">Schnelltraining</h2><div class="sec-rule"></div>
      <span class="sec-chevron" id="fb-quickstart-chevron">${fbQuickstartOpen ? '▾' : '▸'}</span>
    </div>
    <div class="quickstart-grid" id="fb-quickstart" ${fbQuickstartOpen ? '' : 'hidden'}></div>

    <div class="sec-head"><h2 class="sec-title" style="font-size:18px;">Eigenen Ablauf bauen</h2><div class="sec-rule"></div></div>

    <button type="button" class="btn ghost small" id="fb-new-ablauf" style="width:100%;margin-bottom:12px;">Neue Session</button>

    <div class="chip-row fb-addtype-row">
      <button class="chip ${fb.addType === 'hang' ? 'active' : ''}" data-add-type="hang">Board</button>
      <button class="chip ${fb.addType === 'block' ? 'active' : ''}" data-add-type="block">Lifting Pin</button>
      <button class="chip ${fb.addType === 'exercise' ? 'active' : ''}" data-add-type="exercise">Fixübung</button>
      <button class="chip ${fb.addType === 'campus' ? 'active' : ''}" data-add-type="campus">Campus</button>
      <button class="chip ${fb.addType === 'pause' ? 'active' : ''}" data-add-type="pause">Pause</button>
    </div>
    <div id="fb-add-panel" style="margin:12px 0 16px;"></div>

    <div class="field"><label>Zusatzgewicht für diese Session (negativ = Assistenz)</label><div class="kg-field"><input type="number" inputmode="decimal" id="fb-weight" value="${fb.weight}" step="0.5"><span class="mono">kg</span></div></div>

    <div class="sec-head"><h2 class="sec-title">Ablauf</h2><div class="sec-rule"></div></div>

    <div class="field">
      <label>Vorlage laden</label>
      <div class="field-row">
        <select id="fb-template-picker" style="flex:2;"></select>
        <button type="button" class="btn small ghost" id="fb-template-delete" style="flex:0 0 auto;" title="Eigene Vorlage endgültig löschen" hidden>🗑 Löschen</button>
      </div>
    </div>
    <div class="chip-row" style="margin-bottom:16px;">
      <button type="button" class="chip" id="fb-template-save">Aktuellen Ablauf als Vorlage speichern</button>
    </div>

    <div class="sec-head" id="fb-import-toggle" style="cursor:pointer;margin-top:0;">
      <h2 class="sec-title" style="font-size:15px;">Ablauf aus JSON importieren</h2><div class="sec-rule"></div>
      <span class="sec-chevron" id="fb-import-chevron">${fbImportOpen ? '▾' : '▸'}</span>
    </div>
    <div id="fb-import-panel" ${fbImportOpen ? '' : 'hidden'} style="margin-bottom:16px;">
      <div class="field-row" style="margin-bottom:10px;">
        <a href="./assets/ki-anleitung-json.md" download class="btn ghost small" style="flex:1;text-decoration:none;box-sizing:border-box;">📄 Herunterladen</a>
        <button type="button" class="btn ghost small" id="fb-import-guide-copy" style="flex:1;">📋 Kopieren</button>
      </div>
      <div class="field">
        <label>JSON einfügen</label>
        <textarea id="fb-import-textarea" rows="6" placeholder='[{"type":"exercise","exerciseId":"face_pull","reps":15,"workSec":40,"restSec":30}]'></textarea>
      </div>
      <button type="button" class="btn small" id="fb-import-btn">Importieren</button>
      <p class="login-hint" id="fb-import-status" style="margin-top:8px;white-space:pre-line;"></p>
    </div>

    <div id="fb-blocks-list"></div>

    <div id="fb-runtime"></div>

    <div class="sec-head"><h2 class="sec-title">Verlauf</h2><div class="sec-rule"></div></div>
    <div class="list" id="fb-history-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  renderFbAddPanel();
  renderFbBlocksList(); // rendert am Ende auch renderFbRuntime() mit
  renderFbQuickstart();
  renderFbHistory();

  document.getElementById('fb-quickstart-toggle').onclick = () => {
    fbQuickstartOpen = !fbQuickstartOpen;
    document.getElementById('fb-quickstart').hidden = !fbQuickstartOpen;
    document.getElementById('fb-quickstart-chevron').textContent = fbQuickstartOpen ? '▾' : '▸';
  };

  document.querySelectorAll('[data-add-type]').forEach((btn) => {
    btn.onclick = () => {
      fb.addType = btn.dataset.addType;
      document.querySelectorAll('[data-add-type]').forEach((b) => b.classList.toggle('active', b.dataset.addType === fb.addType));
      renderFbAddPanel();
    };
  });
  document.getElementById('fb-weight').oninput = (e) => { fb.weight = e.target.value; };
  document.getElementById('fb-new-ablauf').onclick = () => {
    if (fb.blocks.length && !confirm('Aktuellen Ablauf verwerfen und ganz neu (leer) beginnen?')) return;
    fb.blocks = [];
    const picker = document.getElementById('fb-template-picker');
    if (picker) picker.value = '';
    renderFbBlocksList();
  };

  document.getElementById('fb-import-toggle').onclick = () => {
    fbImportOpen = !fbImportOpen;
    document.getElementById('fb-import-panel').hidden = !fbImportOpen;
    document.getElementById('fb-import-chevron').textContent = fbImportOpen ? '▾' : '▸';
  };
  document.getElementById('fb-import-guide-copy').onclick = async () => {
    try {
      const res = await fetch('./assets/ki-anleitung-json.md');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast('Anleitung kopiert.', 'ok');
    } catch {
      toast('Kopieren nicht möglich.', 'err');
    }
  };
  document.getElementById('fb-import-btn').onclick = () => {
    const text = document.getElementById('fb-import-textarea').value.trim();
    const statusEl = document.getElementById('fb-import-status');
    if (!text) { statusEl.textContent = 'Erst JSON einfügen.'; statusEl.style.color = 'var(--danger)'; return; }
    const result = parseImportedAblauf(text);
    if (result.errors) {
      statusEl.textContent = result.errors.join('\n');
      statusEl.style.color = 'var(--danger)';
      return;
    }
    if (fb.blocks.length && !confirm(`${result.blocks.length} Sätze importieren und aktuellen Ablauf ersetzen?`)) return;
    fb.blocks = result.blocks;
    const picker = document.getElementById('fb-template-picker');
    if (picker) picker.value = '';
    renderFbBlocksList();
    statusEl.textContent = `${result.blocks.length} Sätze importiert.`;
    statusEl.style.color = 'var(--accent)';
  };

  wireFbTemplatePicker();
  Promise.all([loadFbTemplates(), loadSharedTemplates(), loadExerciseFavorites(), loadHiddenTemplates()]).then(() => {
    if (state.route !== 'fingerboard') return;
    refreshFbTemplateOptions();
    renderFbQuickstart();
    // Favoriten laden asynchron nach — Fixübungs-Raster ggf. neu rendern,
    // damit Sternchen/Kurzliste ohne erneutes Antippen des Chips erscheinen.
    if (fb.addType === 'exercise') renderFbAddPanel();
  });
}

/* Verlauf am Ende des Board-Screens — bisher gab es hierfür (anders als
   im Gym-Log) keine sichtbare Liste, fertig gemachte Abläufe landeten
   "unsichtbar" nur in Firebase (fingerboardSessions). Gleiches Muster wie
   renderLogHistory(): neueste zuerst, pro Eintrag teilen/löschen. */
async function renderFbHistory() {
  const raw = await fbGet(`fingerboardSessions/${state.member.id}`);
  const entries = Object.entries(raw || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const list = document.getElementById('fb-history-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, s]) => `
    <div class="log-item">
      <div class="top"><span>${esc(s.date)}</span><span class="type">${esc((BOARDS[s.board] && BOARDS[s.board].label) || s.board)}${s.partial ? ' · UNVOLLSTÄNDIG' : ''}</span></div>
      <div class="ex-log-list">${fbResultsSummaryHtml(s.blocks || [], s.results || [])}</div>
      ${challengeDurationChipsHtml(`fb-history-share-${id}`, CHALLENGE_WINDOW_H)}
      <div class="field-row" style="margin-top:6px;">
        <button type="button" class="btn ghost small" data-share-fb-session="${id}">Als Challenge teilen</button>
        <button type="button" class="btn ghost small" data-delete-fb-session="${id}">Löschen</button>
      </div>
    </div>
  `).join('') : '<div class="list-empty">Noch keine Einträge.</div>';

  entries.forEach(([id]) => wireChallengeDurationChips(`fb-history-share-${id}`));
  list.querySelectorAll('[data-share-fb-session]').forEach((btn) => {
    btn.onclick = async () => {
      const found = entries.find(([id2]) => id2 === btn.dataset.shareFbSession);
      if (!found) return;
      btn.disabled = true;
      await shareFingerboardAsChallenge(found[1].board, found[1].blocks, selectedChallengeHours(`fb-history-share-${btn.dataset.shareFbSession}`));
      btn.disabled = false;
    };
  });
  list.querySelectorAll('[data-delete-fb-session]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Diesen Eintrag wirklich löschen?')) return;
      await fbDelete(`fingerboardSessions/${state.member.id}/${btn.dataset.deleteFbSession}`);
      toast('Eintrag gelöscht.', 'ok');
      renderFbHistory();
    };
  });
}

/* Ein Tap auf "Los" lädt die Vorlage UND startet den Ablauf sofort —
   kein Umweg über "in den Builder laden, runterscrollen, ABLAUF STARTEN
   antippen". Zeigt eigene (fb.templates) bzw. von der Crew geteilte
   Abläufe als Karten, getrennt über die Tabs Eigene/Crew. */
function findFbTemplateById(id) {
  return fb.templates.find((r) => r.id === id) || sharedTemplatesOfKind('fingerboard').find((r) => r.id === id);
}

/* Beim Teilen entsteht eine KOPIE in sharedTemplates — die eigene Vorlage
   erschien dadurch bisher doppelt (als "Eigene" und als "von dome"). Die
   Kopie wird jetzt der eigenen Vorlage zugeordnet (gleicher Ersteller +
   Name) und nur dort als "geteilt" markiert. */
function ownSharedFbCopy(t) {
  return sharedTemplatesOfKind('fingerboard').find((s) => s.createdBy === state.member.id && s.name === t.name);
}
function ownFbEntries() {
  const own = fb.templates.map((t) => ({ ...t, sharedCopy: ownSharedFbCopy(t) || null }));
  // Geteilte Kopien ohne passende eigene Vorlage (z. B. eigene schon
  // gelöscht oder umbenannt) trotzdem unter "Eigene" zeigen — nur so
  // lassen sie sich noch aus der Crew-Liste entfernen.
  const orphans = sharedTemplatesOfKind('fingerboard')
    .filter((s) => s.createdBy === state.member.id && !fb.templates.some((t) => t.name === s.name))
    .map((s) => ({ ...s, sharedOnly: true }));
  return [...own, ...orphans];
}
function crewFbTemplates() {
  return sharedTemplatesOfKind('fingerboard').filter((s) => s.createdBy !== state.member.id);
}

/* Löscht eine eigene Vorlage (mit Rückfrage) — inkl. ihrer geteilten Kopie,
   damit sie nicht bei der Crew stehen bleibt. true, wenn gelöscht. */
async function deleteOwnFbTemplate(entry) {
  const sharedCopy = entry.sharedOnly ? entry : entry.sharedCopy;
  const msg = entry.sharedOnly
    ? `Geteilte Vorlage "${entry.name}" für die ganze Crew löschen?`
    : `Vorlage "${entry.name}" unwiderruflich löschen?${sharedCopy ? ' Sie wird auch für die Crew entfernt.' : ''}`;
  if (!confirm(msg)) return false;
  if (!entry.sharedOnly) await fbDelete(`fingerboardTemplates/${state.member.id}/${entry.id}`);
  if (sharedCopy && state.crewId) await fbDelete(`crewData/${state.crewId}/sharedTemplates/${sharedCopy.id}`);
  await Promise.all([loadFbTemplates(), loadSharedTemplates()]);
  refreshFbTemplateOptions();
  renderFbQuickstart();
  toast('Vorlage gelöscht.', 'ok');
  return true;
}

/* Beim Übernehmen von Hang-Sätzen aus einer Vorlage/Challenge (Schnell-
   training starten, Vorlage laden, Challenge annehmen — alle drei Stellen)
   NUR board:null (das nur die fest eingebauten FINGERBOARD_TEMPLATES
   benutzen, bewusst board-neutral mit generischen Griff-IDs wie
   "edge_small", die es auf beiden Boards gibt) auf das aktuell gewählte
   Board setzen. Eigene/geteilte Vorlagen und Challenges haben dagegen
   schon ein ECHTES Board mit einer dazu passenden, board-spezifischen
   Griff-ID (z. B. "kleine_kante" nur auf BM1000) — wurde bisher trotzdem
   überschrieben, sobald fb.board (typischerweise das zuletzt genutzte
   Board des Mitglieds) etwas anderes war, wodurch Board und Griff-ID
   nicht mehr zusammenpassten und am Ende ein falsches Board gespeichert/
   geteilt wurde ("mit BM1000 trainiert, gespeichert als BM2000"). */
function fbBlocksWithCurrentBoard(blocks) {
  return blocks.map((b) => (b.type === 'hang' && b.board == null ? { ...b, board: fb.board } : { ...b }));
}

/* Ablauf-Balken auf der Schnelltraining-Karte: pro Satz ein Stück, Breite
   nach Dauer, Farbe nach Art (Hang/Lifting Pin blau, Übung weiss, Campus
   dunkelblau, Pause grau) — zeigt den Aufbau auf einen Blick. */
function qsBlockBarHtml(blocks) {
  const color = (b) => (b.type === 'pause' ? 'pause' : b.type === 'exercise' ? 'exercise' : b.type === 'campus' ? 'campus' : 'hang');
  return `<div class="qs-bar" aria-hidden="true">${blocks.map((b) => `<span class="qs-bar-seg ${color(b)}" style="flex-grow:${Math.max(1, Math.round(fbBlockSeconds(b)))}"></span>`).join('')}</div>`;
}

function renderFbQuickstart() {
  const holder = document.getElementById('fb-quickstart');
  if (!holder) return;
  const isCrew = fbQsTab === 'crew';
  const crewAll = crewFbTemplates();
  const creators = [...new Map(crewAll.map((t) => [t.createdBy, t.createdByName])).entries()];
  if (fbQsCreator !== 'all' && !creators.some(([id]) => id === fbQsCreator)) fbQsCreator = 'all';
  const crewFiltered = crewAll.filter((t) => fbQsCreator === 'all' || t.createdBy === fbQsCreator);
  const hiddenCount = crewFiltered.filter((t) => hiddenTemplates[t.id]).length;
  const list = isCrew
    ? crewFiltered.filter((t) => fbQsShowHidden || !hiddenTemplates[t.id])
    : ownFbEntries();

  const tabs = `
    <div class="chip-row" style="margin-bottom:8px;">
      <button type="button" class="chip ${!isCrew ? 'active' : ''}" data-qs-tab="own">Eigene</button>
      <button type="button" class="chip ${isCrew ? 'active' : ''}" data-qs-tab="crew">Crew${crewAll.length ? ` (${crewAll.length})` : ''}</button>
    </div>`;
  const creatorFilter = isCrew && creators.length > 1 ? `
    <div class="chip-row qs-filter-row">
      <button type="button" class="chip small ${fbQsCreator === 'all' ? 'active' : ''}" data-qs-creator="all">Alle</button>
      ${creators.map(([id, name]) => `<button type="button" class="chip small ${fbQsCreator === id ? 'active' : ''}" data-qs-creator="${esc(id)}">${esc(name)}</button>`).join('')}
    </div>` : '';
  const hiddenToggle = isCrew && (hiddenCount || fbQsShowHidden) ? `
    <button type="button" class="btn ghost small" id="qs-toggle-hidden" style="width:100%;margin-bottom:10px;">
      ${fbQsShowHidden ? 'Ausgeblendete verbergen' : `Ausgeblendete anzeigen (${hiddenCount})`}
    </button>` : '';
  const empty = isCrew
    ? (crewAll.length ? 'Alles ausgeblendet.' : 'Noch hat niemand aus der Crew eine Vorlage geteilt.')
    : 'Noch keine eigenen Vorlagen — unten einen Ablauf bauen und "Als Vorlage speichern".';

  holder.innerHTML = tabs + creatorFilter + hiddenToggle + (list.length ? list.map((t, i) => {
    const totalSec = t.blocks.reduce((total, b) => total + fbBlockSeconds(b), 0);
    const isHidden = isCrew && !!hiddenTemplates[t.id];
    const badge = isCrew
      ? `<span class="qs-badge">von ${esc(t.createdByName)}</span>`
      : (t.sharedCopy || t.sharedOnly) ? '<span class="qs-badge">geteilt</span>' : '';
    const actionBtn = isCrew
      ? `<button type="button" class="ex-pick-info" data-qs-hide="${t.id}" title="${isHidden ? 'Wieder einblenden' : 'Für mich ausblenden'}">${isHidden ? '👁' : '🙈'}</button>`
      : `<button type="button" class="ex-pick-info" data-qs-delete="${t.id}" title="Vorlage löschen">🗑</button>`;
    return `
      <div class="qs-card anim-in ${isHidden ? 'qs-hidden' : ''}" style="animation-delay:${i * 55}ms">
        <div class="qs-top">
          <div class="qs-name">${esc(t.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${badge}
            <button type="button" class="ex-pick-info" data-tpl-info="${t.id}" title="Enthaltenen Ablauf ansehen">ℹ</button>
            ${actionBtn}
          </div>
        </div>
        ${t.note ? `<div class="qs-note">${esc(t.note)}</div>` : ''}
        <div class="qs-bottom">
          <div class="qs-meta mono">${t.blocks.length} Sätze · ~${fmtMinSec(totalSec)}</div>
          <button type="button" class="btn qs-start" data-tpl="${t.id}" aria-label="${esc(t.name)} starten"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.9l10.2-6.5a1 1 0 000-1.8L9.5 4.6A1 1 0 008 5.5z"/></svg></button>
        </div>
        ${qsBlockBarHtml(t.blocks)}
      </div>
    `;
  }).join('') : `<div class="list-empty">${empty}</div>`);

  holder.querySelectorAll('[data-qs-tab]').forEach((btn) => {
    btn.onclick = () => {
      fbQsTab = btn.dataset.qsTab;
      try { localStorage.setItem('pincho_fb_qs_tab', fbQsTab); } catch (e) { /* ignorieren */ }
      renderFbQuickstart();
    };
  });
  holder.querySelectorAll('[data-qs-creator]').forEach((btn) => {
    btn.onclick = () => { fbQsCreator = btn.dataset.qsCreator; renderFbQuickstart(); };
  });
  const hiddenBtn = document.getElementById('qs-toggle-hidden');
  if (hiddenBtn) hiddenBtn.onclick = () => { fbQsShowHidden = !fbQsShowHidden; renderFbQuickstart(); };
  holder.querySelectorAll('[data-qs-hide]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.qsHide;
      if (hiddenTemplates[id]) {
        delete hiddenTemplates[id];
        fbDelete(`hiddenTemplates/${state.member.id}/${id}`);
      } else {
        hiddenTemplates[id] = true;
        fbPut(`hiddenTemplates/${state.member.id}/${id}`, true);
        toast('Ausgeblendet — über "Ausgeblendete anzeigen" wieder holbar.');
      }
      refreshFbTemplateOptions();
      renderFbQuickstart();
    };
  });
  holder.querySelectorAll('[data-qs-delete]').forEach((btn) => {
    btn.onclick = () => {
      const entry = ownFbEntries().find((t) => t.id === btn.dataset.qsDelete);
      if (entry) deleteOwnFbTemplate(entry);
    };
  });
  holder.querySelectorAll('.qs-start').forEach((btn) => {
    btn.onclick = () => {
      const t = findFbTemplateById(btn.dataset.tpl);
      if (!t) return;
      if (fb.blocks.length && !confirm('Aktuellen Ablauf durch "' + t.name + '" ersetzen und sofort starten?')) return;
      fb.blocks = fbBlocksWithCurrentBoard(t.blocks);
      renderFbBlocksList();
      startAblauf(); // öffnet direkt das Ablauf-Vollbild
    };
  });
  holder.querySelectorAll('[data-tpl-info]').forEach((btn) => {
    btn.onclick = () => showFbTemplateInfoSheet(btn.dataset.tplInfo);
  });
}

/* Info-Sheet für Schnelltraining-Vorlagen — zeigt den enthaltenen Ablauf
   (welche Sätze in welcher Reihenfolge), bevor man ihn per "Los" sofort
   startet. Eigene Backdrop-Instanz statt showExerciseInfoSheet() wieder-
   zuverwenden, da Inhalt/Kontext (Ablauf statt einzelne Übung) verschieden
   sind — die CSS-Klassen (info-sheet-*) sind trotzdem dieselben. */
function ensureFbTemplateInfoSheet() {
  let el = document.getElementById('fb-template-info-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fb-template-info-sheet';
    el.className = 'info-sheet-backdrop hidden';
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el) el.classList.add('hidden'); };
  }
  return el;
}

function showFbTemplateInfoSheet(templateId) {
  const t = findFbTemplateById(templateId);
  if (!t) return;
  const el = ensureFbTemplateInfoSheet();
  const totalSec = t.blocks.reduce((total, b) => total + fbBlockSeconds(b), 0);
  const items = t.blocks.map((b) => {
    const isHang = isHangLikeBlock(b);
    const isCampus = b.type === 'campus';
    const isPause = b.type === 'pause';
    const title = isPause ? 'Pause' : isHang ? holdBlockTitle(b) : isCampus ? campusLabel(b) : esc(exerciseName(b.exerciseId));
    return `<div class="ex core">${title} · ${esc(fbBlockSub(b))}</div>`;
  }).join('');
  el.innerHTML = `
    <div class="info-sheet-card">
      <button type="button" class="info-sheet-close" id="fb-template-info-close">✕</button>
      <div class="info-sheet-title">${esc(t.name)}</div>
      ${t.note ? `<div class="qs-note" style="margin-bottom:10px;">${esc(t.note)}</div>` : ''}
      <div class="qs-meta mono">${t.blocks.length} Sätze · ~${fmtMinSec(totalSec)}</div>
      <div class="exlist">${items}</div>
    </div>
  `;
  el.classList.remove('hidden');
  document.getElementById('fb-template-info-close').onclick = () => el.classList.add('hidden');
}

/* ---------- Fingerboard-Vorlagen (laden/speichern) ----------
   fb.templates sind eigene, in Firebase gespeicherte Abläufe (Ids = ihre
   Firebase-Push-Keys); dazu kommen die Vorlagen der Crew (sharedTemplates,
   ohne die eigenen geteilten Kopien und ohne ausgeblendete). */
async function loadFbTemplates() {
  const raw = await fbGet(`fingerboardTemplates/${state.member.id}`);
  fb.templates = raw ? Object.entries(raw).map(([key, t]) => ({ ...t, id: key, custom: true })) : [];
}

function refreshFbTemplateOptions() {
  const select = document.getElementById('fb-template-picker');
  if (!select) return;
  const shared = crewFbTemplates().filter((t) => !hiddenTemplates[t.id]);
  select.innerHTML = `
    <option value="">— eigener Ablauf —</option>
    ${fb.templates.length ? `<optgroup label="Eigene Vorlagen">
      ${fb.templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
    </optgroup>` : ''}
    ${shared.length ? `<optgroup label="Von der Crew">
      ${shared.map((t) => `<option value="${t.id}">${esc(t.name)} (${esc(t.createdByName)})</option>`).join('')}
    </optgroup>` : ''}
  `;
}

function wireFbTemplatePicker() {
  refreshFbTemplateOptions();
  // Löschen-Button nur zeigen, wenn wirklich eine EIGENE Vorlage geladen ist
  // (nicht bei einer fest eingebauten oder geteilten Vorlage der Crew, die
  // man ohnehin nicht löschen kann) — sonst sieht der Button direkt neben
  // dem Lade-Dropdown wie ein harmloser "Ablauf leeren"-Button aus, löscht
  // aber die gespeicherte Vorlage unwiderruflich, nicht nur den aktuell
  // angezeigten Ablauf.
  const updateFbDeleteBtnVisibility = () => {
    const btn = document.getElementById('fb-template-delete');
    if (btn) btn.hidden = !fb.templates.some((t) => t.id === document.getElementById('fb-template-picker').value);
  };
  updateFbDeleteBtnVisibility();
  document.getElementById('fb-template-picker').onchange = (e) => {
    const id = e.target.value;
    const t = findFbTemplateById(id);
    if (!t) { updateFbDeleteBtnVisibility(); return; }
    if (fb.blocks.length && !confirm('Aktuellen Ablauf durch "' + t.name + '" ersetzen?')) {
      e.target.value = '';
      updateFbDeleteBtnVisibility();
      return;
    }
    fb.blocks = fbBlocksWithCurrentBoard(t.blocks);
    renderFbBlocksList();
    updateFbDeleteBtnVisibility();
  };
  document.getElementById('fb-template-save').onclick = async () => {
    if (!fb.blocks.length) { toast('Erst einen Ablauf zusammenstellen.', 'err'); return; }
    const name = prompt('Name für diese Vorlage:');
    if (!name) return;
    const key = await fbPush(`fingerboardTemplates/${state.member.id}`, { name, blocks: fb.blocks, createdAt: Date.now() });
    if (!key) { toast('Speichern fehlgeschlagen.', 'err'); return; }
    await loadFbTemplates();
    if (confirm('Vorlage auch mit der Crew teilen?')) {
      const shared = await shareTemplate('fingerboard', name, { blocks: fb.blocks });
      if (shared) await loadSharedTemplates();
    }
    refreshFbTemplateOptions();
    renderFbQuickstart();
    document.getElementById('fb-template-picker').value = key;
    updateFbDeleteBtnVisibility();
    toast('Vorlage gespeichert.', 'ok');
  };
  document.getElementById('fb-template-delete').onclick = async () => {
    const select = document.getElementById('fb-template-picker');
    const t = fb.templates.find((r) => r.id === select.value);
    if (!t) { toast('Nur eigene Vorlagen lassen sich löschen.', 'err'); return; }
    const entry = ownFbEntries().find((r) => r.id === t.id);
    if (!(await deleteOwnFbTemplate(entry || t))) return;
    updateFbDeleteBtnVisibility();
  };
}

/* Phasenliste EINES Blocks — Hang-Sätze als Hang/Pause je Wiederholung,
   Übungs-Sätze als ein "Work"-Schritt (feste Dauer statt Wiederholungszahl,
   damit der Timer automatisch weiterlaufen kann) plus "Pause" danach.
   Treibt sowohl die Zeitschätzung als auch den echten Timer im
   Ablauf-Vollbild — beides nutzt dieselbe Liste, damit sie nie
   auseinanderlaufen.
   Pause zwischen Sätzen (restSec) und Pause danach/vor dem nächsten Block
   (blockRestSec) sind bewusst getrennt — die kurze Pause zwischen zwei
   Hang-Wiederholungen eines Repeater-Protokolls (z. B. 3s) taugt nicht als
   Erholung vor einem ganz anderen Satz. blockRestSec fehlt bei älteren,
   vor dieser Trennung gebauten Abläufen — fällt dann auf restSec zurück.
   Der letzte Block-Übergang bekommt IMMER mindestens 10s: das ist die
   einzige Zeit fürs Check-in (s. openBlockCheckin) — bei "0" konfigurierter
   Pause wird trotzdem kurz Zeit zum Loggen eingeräumt, statt sie ganz
   wegzulassen. */
/* isLastBlock: der ganze Ablauf ist nach dem letzten Arbeitssatz fertig —
   eine abschliessende Pause/"Zeit zum Loggen" davor bringt nichts mehr
   (kein nächster Satz, für den man sich erholen müsste), sie war bisher
   trotzdem immer da. Nur beim tatsächlichen Durchlauf relevant (siehe
   startSequence) — die generische Dauer-Schätzung (fbBlockSeconds) ruft
   ohne dieses Flag auf und bleibt bewusst unverändert (Standardwert
   false), sie kennt die Position eines Blocks im jeweiligen Ablauf nicht. */
function buildBlockSequence(b, isLastBlock = false) {
  if (isHoldModeBlock(b)) {
    const seq = [];
    const workPhase = b.type === 'block' ? 'Halten' : 'Hang';
    for (let s = 0; s < b.reps; s++) {
      // rep (0-indiziert): welche Wiederholung dieser Schritt gehört —
      // nur fürs Lifting-Pin-Hand-Muster gebraucht (siehe blockHandForRep),
      // bei Hang-Sätzen einfach ungenutzt.
      seq.push({ phase: workPhase, seconds: b.hangSec, rep: s });
      if (s < b.reps - 1) {
        if (b.restSec > 0) seq.push({ phase: 'Pause', seconds: b.restSec, rep: s });
      } else if (!isLastBlock) {
        const trailingRest = b.blockRestSec != null ? b.blockRestSec : b.restSec;
        seq.push({ phase: trailingRest > 0 ? 'Pause' : 'Zeit zum Loggen', seconds: Math.max(trailingRest, 10), rep: s });
      }
    }
    return seq;
  }
  if (b.type === 'campus') {
    // Gleiche Struktur wie Hang-Sätze (mehrere Wiederholungen mit Pause
    // dazwischen), nur mit "Work" statt "Hang" als Phase — Campus-Züge
    // sind eine aktive Bewegung, kein Halten.
    const seq = [];
    for (let s = 0; s < b.reps; s++) {
      seq.push({ phase: 'Work', seconds: b.workSec, rep: s });
      if (s < b.reps - 1) {
        if (b.restSec > 0) seq.push({ phase: 'Pause', seconds: b.restSec, rep: s });
      } else if (!isLastBlock) {
        const trailingRest = b.blockRestSec != null ? b.blockRestSec : b.restSec;
        seq.push({ phase: trailingRest > 0 ? 'Pause' : 'Zeit zum Loggen', seconds: Math.max(trailingRest, 10), rep: s });
      }
    }
    return seq;
  }
  if (b.type === 'pause') {
    return [{ phase: 'Pause', seconds: b.seconds }];
  }
  // Bei einer Fixübung ist die Pause danach nur noch die Zeit zum Loggen
  // von Wdh./Gewicht (kein weiterer Satz derselben Übung folgt hier) —
  // 5s reichen dafür, das Mindestmass ist entsprechend niedriger als bei
  // Hang/Campus-Sätzen (dort geht's zusätzlich um echte Erholung).
  return isLastBlock
    ? [{ phase: 'Work', seconds: b.workSec || 40 }]
    : [
        { phase: 'Work', seconds: b.workSec || 40 },
        { phase: b.restSec > 0 ? 'Pause' : 'Zeit zum Loggen', seconds: Math.max(b.restSec, 5) },
      ];
}
function isWorkPhase(step) {
  return !step || step.phase === 'Hang' || step.phase === 'Work' || step.phase === 'Halten';
}
/* Die ABSCHLIESSENDE Pause eines Blocks (letzter Schritt seiner Sequenz) —
   danach kommt entweder ein anderer Block oder der Ablauf ist fertig,
   NICHT eine weitere Wiederholung desselben Blocks. Wird sowohl fürs
   Check-in-Fenster als auch für die "was kommt als Nächstes"-Vorschau
   während des laufenden Ablaufs gebraucht (siehe renderFbOverlay/
   updateFbUpcomingUI) — ein Schritt weiterspringen (fbStepForward) kann
   das mitten in der Pause jederzeit ändern. */
function fbIsTrailingPause() {
  const step = fb.sequence[fb.stepIndex];
  return !!step && !isWorkPhase(step) && fb.stepIndex === fb.sequence.length - 1;
}

function fbEstimateSeconds() {
  return fb.blocks.reduce((total, b) => total + fbBlockSeconds(b), 0);
}
function fmtMinSec(totalSec) {
  return `${Math.floor(totalSec / 60)}:${pad2(totalSec % 60)}`;
}

/* ---------- Übungs-Strichmännchen ----------
   Kleine, animierte SVG-Strichmännchen fürs Ablauf-Vollbild: zeigen auf
   einen Blick, welche Bewegung gemeint ist, ohne Foto/Video. Zwei Arten:
   - 'dynamic': zwei Posen (Start/Ende der Bewegung) überblenden in Dauer-
     schlaufe. Fixe Körperteile sind gedämpft (.fig-fixed), bewegte hell,
     der eigentliche Arbeitspunkt (z. B. die ziehende Hand) lime; eine
     gestrichelte Linie + Pfeil zeigt zusätzlich die Bewegungsrichtung.
   - 'static': eine Pose (Halteübung), sanftes Pulsieren statt Bewegung.
   Nicht jede Übung hat schon eine Animation — renderExerciseFigure()
   fällt für alle anderen auf ein Emoji zurück (siehe dort). */
const EXERCISE_FIGURES = {
  face_pull: { kind: 'dynamic', caption: 'Seitenansicht · Zughand kommt zum Gesicht, Ellbogen bleibt hoch', svg: `
    <line class="fig-rig" x1="188" y1="40" x2="188" y2="140"/>
    <circle class="fig-rig-dot" cx="188" cy="90" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="60" r="5"/>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M165,72 L60,71"/>
    <polygon class="fig-arrow" points="60,71 72,65 72,77"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <polyline points="99,58 140,62 168,66"/>
      <polyline points="99,66 138,72 166,78"/>
      <circle class="fig-joint fig-mid" cx="140" cy="62" r="4.5"/>
      <circle class="fig-joint fig-mid" cx="138" cy="72" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="168" cy="66" r="6"/>
      <circle class="fig-joint fig-hi" cx="166" cy="78" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <polyline points="99,58 65,54 46,64"/>
      <polyline points="99,66 63,66 44,78"/>
      <circle class="fig-joint fig-mid" cx="65" cy="54" r="4.5"/>
      <circle class="fig-joint fig-mid" cx="63" cy="66" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="46" cy="64" r="6"/>
      <circle class="fig-joint fig-hi" cx="44" cy="78" r="6"/>
    </g>
  ` },
  band_pull_apart: { kind: 'dynamic', caption: 'Vorderansicht, stehend · Arme ziehen das Band nach aussen auseinander', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="66" r="5"/>
    <path class="fig-motion" d="M145,66 L53,66"/>
    <polygon class="fig-arrow" points="53,66 65,60 65,72"/>
    <polygon class="fig-arrow" points="145,66 133,60 133,72"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="66" x2="60" y2="70"/>
      <line x1="99" y1="66" x2="138" y2="70"/>
      <circle class="fig-joint fig-hi" cx="60" cy="70" r="6"/>
      <circle class="fig-joint fig-hi" cx="138" cy="70" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="66" x2="40" y2="60"/>
      <line x1="99" y1="66" x2="158" y2="60"/>
      <circle class="fig-joint fig-hi" cx="40" cy="60" r="6"/>
      <circle class="fig-joint fig-hi" cx="158" cy="60" r="6"/>
    </g>
  ` },
  scapula_pull: { kind: 'dynamic', caption: 'Vorderansicht · Arme bleiben oben gestreckt, nur die Schulterblätter senken sich', svg: `
    <line class="fig-rig" x1="100" y1="14" x2="100" y2="48"/>
    <g class="fig-pose fig-fixed">
      <line x1="70" y1="55" x2="130" y2="55"/>
      <line x1="99" y1="70" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="86" y2="196"/>
      <line x1="99" y1="140" x2="114" y2="196"/>
    </g>
    <path class="fig-motion" d="M99,90 L99,68"/>
    <polygon class="fig-arrow" points="99,64 93,76 105,76"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="99" cy="66" r="15"/>
      <line x1="70" y1="55" x2="99" y2="80"/>
      <line x1="130" y1="55" x2="99" y2="80"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="99" cy="86" r="15"/>
      <line x1="70" y1="55" x2="99" y2="100"/>
      <line x1="130" y1="55" x2="99" y2="100"/>
    </g>
  ` },
  pallof: { kind: 'dynamic', caption: 'Vorderansicht, Band von der Seite gehalten · Arme drücken das Band gerade nach vorne weg', svg: `
    <line class="fig-rig" x1="12" y1="55" x2="12" y2="105"/>
    <circle class="fig-rig-dot" cx="12" cy="80" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M108,78 L150,78"/>
    <polygon class="fig-arrow" points="150,78 138,72 138,84"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <line x1="99" y1="70" x2="108" y2="82"/>
      <line x1="99" y1="78" x2="108" y2="88"/>
      <circle class="fig-joint fig-hi" cx="108" cy="85" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <line x1="99" y1="70" x2="150" y2="76"/>
      <line x1="99" y1="78" x2="150" y2="82"/>
      <circle class="fig-joint fig-hi" cx="150" cy="79" r="6"/>
    </g>
  ` },
  bird_dog: { kind: 'dynamic', caption: 'Seitenansicht, Vierfüsslerstand · gegenüberliegender Arm und Bein strecken sich waagrecht aus', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="55" cy="86" r="14"/>
      <circle cx="42" cy="86" r="3"/>
      <line x1="70" y1="90" x2="150" y2="95"/>
      <line x1="70" y1="90" x2="70" y2="150"/>
      <line x1="150" y1="95" x2="150" y2="150"/>
    </g>
    <circle class="fig-joint" cx="70" cy="90" r="5"/>
    <circle class="fig-joint" cx="150" cy="95" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <line x1="70" y1="90" x2="85" y2="150"/>
      <line x1="150" y1="95" x2="135" y2="150"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <line x1="70" y1="90" x2="38" y2="68"/>
      <line x1="150" y1="95" x2="187" y2="108"/>
      <circle class="fig-joint fig-hi" cx="38" cy="68" r="6"/>
      <circle class="fig-joint fig-hi" cx="187" cy="108" r="6"/>
    </g>
  ` },
  crunches: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage · Oberkörper rollt nach vorne/oben ein', svg: `
    <line class="fig-rig" x1="10" y1="160" x2="190" y2="160"/>
    <g class="fig-pose fig-fixed">
      <line x1="120" y1="150" x2="150" y2="120"/>
      <line x1="150" y1="120" x2="148" y2="160"/>
    </g>
    <circle class="fig-joint" cx="120" cy="150" r="5"/>
    <circle class="fig-joint" cx="150" cy="120" r="4.5"/>
    <path class="fig-motion" d="M58,150 Q75,112 90,100"/>
    <polygon class="fig-arrow" points="82,109 92,96 96,111"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <line x1="120" y1="150" x2="70" y2="150"/>
      <circle cx="58" cy="150" r="15"/>
      <circle cx="58" cy="137" r="3"/>
      <line x1="100" y1="150" x2="85" y2="163"/>
      <circle class="fig-joint fig-mid" cx="70" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <polyline points="120,150 112,128 100,112"/>
      <circle cx="90" cy="100" r="15"/>
      <circle cx="99" cy="91" r="3"/>
      <line x1="100" y1="112" x2="128" y2="116"/>
      <circle class="fig-joint fig-mid" cx="100" cy="112" r="5"/>
      <circle class="fig-joint fig-hi" cx="128" cy="116" r="6"/>
    </g>
  ` },
  russian_twist: { kind: 'dynamic', caption: 'Seitenansicht, sitzend, Füsse leicht abgehoben · Oberkörper dreht abwechselnd nach links und rechts', svg: `
    <line class="fig-rig" x1="10" y1="170" x2="190" y2="170"/>
    <g class="fig-pose fig-fixed">
      <line x1="115" y1="160" x2="150" y2="130"/>
      <line x1="150" y1="130" x2="148" y2="170"/>
      <circle cx="60" cy="118" r="14"/>
      <circle cx="73" cy="118" r="3"/>
      <line x1="72" y1="128" x2="115" y2="160"/>
    </g>
    <circle class="fig-joint" cx="115" cy="160" r="5"/>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="90" y1="140" x2="120" y2="150"/>
      <circle class="fig-joint fig-hi" cx="120" cy="150" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="90" y1="140" x2="55" y2="152"/>
      <circle class="fig-joint fig-hi" cx="55" cy="152" r="6"/>
    </g>
  ` },
  superman: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage · Arme und Beine heben sich gleichzeitig vom Boden ab', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="90" y1="140" x2="130" y2="142"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <circle class="fig-joint" cx="130" cy="142" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <circle cx="76" cy="140" r="14"/>
      <circle cx="67" cy="149" r="3"/>
      <line x1="90" y1="140" x2="60" y2="146"/>
      <line x1="130" y1="142" x2="160" y2="148"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <circle cx="70" cy="118" r="14"/>
      <circle cx="57" cy="116" r="3"/>
      <line x1="90" y1="140" x2="55" y2="122"/>
      <line x1="130" y1="142" x2="168" y2="126"/>
      <circle class="fig-joint fig-hi" cx="55" cy="122" r="6"/>
      <circle class="fig-joint fig-hi" cx="168" cy="126" r="6"/>
    </g>
  ` },
  swimmer: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage · Arm und gegenüberliegendes Bein heben abwechselnd', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="90" y1="140" x2="130" y2="142"/>
      <circle cx="73" cy="129" r="13"/>
      <circle cx="60" cy="129" r="3"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <circle class="fig-joint" cx="130" cy="142" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="90" y1="140" x2="58" y2="120"/>
      <line x1="130" y1="142" x2="160" y2="150"/>
      <circle class="fig-joint fig-hi" cx="58" cy="120" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="90" y1="140" x2="60" y2="148"/>
      <line x1="130" y1="142" x2="168" y2="124"/>
      <circle class="fig-joint fig-hi" cx="168" cy="124" r="6"/>
    </g>
  ` },
  glute_bridge: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Füsse aufgestellt · Becken hebt sich nach oben', svg: `
    <line class="fig-rig" x1="10" y1="170" x2="190" y2="170"/>
    <g class="fig-pose fig-fixed">
      <circle cx="150" cy="150" r="14"/>
      <circle cx="150" cy="137" r="3"/>
      <line x1="138" y1="160" x2="105" y2="160"/>
      <line x1="60" y1="130" x2="60" y2="170"/>
    </g>
    <circle class="fig-joint" cx="105" cy="160" r="5"/>
    <circle class="fig-joint" cx="60" cy="130" r="4.5"/>
    <path class="fig-motion" d="M105,155 L105,130"/>
    <polygon class="fig-arrow" points="105,126 99,138 111,138"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="105" y1="160" x2="60" y2="165"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="105" y1="160" x2="60" y2="130"/>
      <circle class="fig-joint fig-hi" cx="82" cy="145" r="5.5"/>
    </g>
  ` },
  push_up: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage im Stütz · Körper senkt sich als gerade Linie ab und drückt wieder hoch', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="195" y2="150"/>
    <circle class="fig-joint" cx="55" cy="150" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="149" r="5.5"/>
    <path class="fig-motion" d="M61,127 L60,100"/>
    <polygon class="fig-arrow" points="60,95 53,107 67,107"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <circle cx="44" cy="88" r="14"/>
      <circle cx="40" cy="100" r="3"/>
      <line x1="60" y1="95" x2="135" y2="100"/>
      <line x1="135" y1="100" x2="190" y2="148"/>
      <line x1="60" y1="95" x2="55" y2="150"/>
      <circle class="fig-joint fig-mid" cx="60" cy="95" r="5"/>
      <circle class="fig-joint fig-mid" cx="135" cy="100" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <circle cx="46" cy="124" r="14"/>
      <circle cx="42" cy="136" r="3"/>
      <line x1="62" y1="130" x2="135" y2="133"/>
      <line x1="135" y1="133" x2="190" y2="149"/>
      <polyline points="62,130 82,148 55,150"/>
      <circle class="fig-joint fig-mid" cx="62" cy="130" r="5"/>
      <circle class="fig-joint fig-mid" cx="135" cy="133" r="5"/>
      <circle class="fig-joint fig-hi" cx="82" cy="148" r="5"/>
    </g>
  ` },
  plank: { kind: 'static', caption: 'Seitenansicht, Unterarmstütz, Bauch nach unten · Körper hält eine gerade Linie von Kopf bis Ferse', svg: `
    <line class="fig-rig" x1="10" y1="155" x2="195" y2="155"/>
    <circle class="fig-joint" cx="90" cy="148" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="154" r="5.5"/>
    <g class="fig-pose">
      <circle cx="44" cy="90" r="14"/>
      <circle cx="40" cy="102" r="3"/>
      <line x1="60" y1="97" x2="135" y2="102"/>
      <line x1="135" y1="102" x2="191" y2="150"/>
      <line x1="60" y1="97" x2="58" y2="128"/>
      <line x1="58" y1="128" x2="90" y2="148"/>
    </g>
  ` },
  side_plank: { kind: 'static', caption: 'Seitenansicht, seitlicher Unterarmstütz · unterer Arm stützt, oberer Arm zeigt zur Decke, Hüfte bleibt oben', svg: `
    <line class="fig-rig" x1="10" y1="155" x2="195" y2="155"/>
    <circle class="fig-joint" cx="58" cy="150" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="150" r="5.5"/>
    <g class="fig-pose">
      <circle cx="44" cy="90" r="14"/>
      <circle cx="57" cy="90" r="3"/>
      <line x1="60" y1="97" x2="135" y2="102"/>
      <line x1="135" y1="102" x2="191" y2="150"/>
      <line x1="60" y1="97" x2="58" y2="150"/>
      <line x1="70" y1="88" x2="72" y2="34"/>
    </g>
    <circle class="fig-joint fig-hi" cx="72" cy="32" r="6"/>
  ` },
  hollow_hold: { kind: 'static', caption: 'Seitenansicht, Rückenlage · unterer Rücken bleibt am Boden, Arme und Beine schweben gestreckt', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose">
      <path d="M40,150 Q100,110 160,150" fill="none"/>
      <circle cx="34" cy="140" r="13"/>
      <circle cx="42" cy="130" r="3"/>
      <line x1="46" y1="146" x2="30" y2="120"/>
      <line x1="150" y1="146" x2="168" y2="130"/>
    </g>
    <circle class="fig-joint fig-hi" cx="30" cy="118" r="5.5"/>
    <circle class="fig-joint fig-hi" cx="168" cy="128" r="5.5"/>
  ` },
  ext_rotation: { kind: 'dynamic', caption: 'Von oben, Ellbogen am Körper angewinkelt · Unterarm dreht vom Bauch weg nach aussen', svg: `
    <line class="fig-rig" x1="150" y1="70" x2="150" y2="110"/>
    <circle class="fig-rig-dot" cx="150" cy="90" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="99" y2="90"/>
    </g>
    <circle class="fig-joint" cx="99" cy="90" r="5"/>
    <path class="fig-motion" d="M80,95 Q100,108 133,86"/>
    <polygon class="fig-arrow" points="133,86 122,84 128,95"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="90" x2="80" y2="95"/>
      <circle class="fig-joint fig-hi" cx="80" cy="95" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="90" x2="135" y2="85"/>
      <circle class="fig-joint fig-hi" cx="135" cy="85" r="6"/>
    </g>
  ` },
  wrist_ext: { kind: 'dynamic', caption: 'Seitenansicht, Unterarm aufgelegt, Hand über der Kante · Handrücken zieht nach oben', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="68" x2="140" y2="80"/>
      <line x1="140" y1="80" x2="165" y2="80"/>
    </g>
    <circle class="fig-joint" cx="165" cy="80" r="5"/>
    <path class="fig-motion" d="M178,95 L178,68"/>
    <polygon class="fig-arrow" points="178,64 172,75 184,75"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="165" y1="80" x2="180" y2="94"/>
      <circle class="fig-joint fig-hi" cx="180" cy="94" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="165" y1="80" x2="180" y2="65"/>
      <circle class="fig-joint fig-hi" cx="180" cy="65" r="5.5"/>
    </g>
  ` },
  y_t_w: { kind: 'dynamic', caption: 'Vorderansicht, leicht vorgebeugt · Arme heben abwechselnd in Y-, T- und W-Stellung', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <line x1="99" y1="65" x2="50" y2="60"/>
      <line x1="99" y1="65" x2="148" y2="60"/>
      <circle class="fig-joint fig-hi" cx="50" cy="60" r="6"/>
      <circle class="fig-joint fig-hi" cx="148" cy="60" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <line x1="99" y1="65" x2="60" y2="25"/>
      <line x1="99" y1="65" x2="138" y2="25"/>
      <circle class="fig-joint fig-hi" cx="60" cy="25" r="6"/>
      <circle class="fig-joint fig-hi" cx="138" cy="25" r="6"/>
    </g>
  ` },
  hanging_leg_raise: { kind: 'dynamic', caption: 'Vorderansicht, hängend am Griff · gestreckte Beine heben sich nach vorne/oben', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <g class="fig-pose fig-fixed">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="42" r="14"/>
      <line x1="100" y1="58" x2="100" y2="120"/>
    </g>
    <circle class="fig-joint" cx="100" cy="120" r="5"/>
    <path class="fig-motion" d="M100,150 Q125,130 150,108"/>
    <polygon class="fig-arrow" points="150,108 138,110 144,120"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="100" y1="120" x2="90" y2="180"/>
      <line x1="100" y1="120" x2="110" y2="180"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="100" y1="120" x2="150" y2="100"/>
      <line x1="100" y1="120" x2="158" y2="112"/>
      <circle class="fig-joint fig-hi" cx="150" cy="100" r="6"/>
      <circle class="fig-joint fig-hi" cx="158" cy="112" r="6"/>
    </g>
  ` },
  toes_to_bar: { kind: 'dynamic', caption: 'Vorderansicht, hängend am Griff · Beine schwingen nach oben, Zehen Richtung Stange', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <g class="fig-pose fig-fixed">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="42" r="14"/>
      <line x1="100" y1="58" x2="100" y2="120"/>
    </g>
    <circle class="fig-joint" cx="100" cy="120" r="5"/>
    <path class="fig-motion" d="M100,150 Q95,90 92,40"/>
    <polygon class="fig-arrow" points="90,30 84,44 96,42"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <line x1="100" y1="120" x2="90" y2="180"/>
      <line x1="100" y1="120" x2="110" y2="180"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <line x1="100" y1="120" x2="85" y2="32"/>
      <line x1="100" y1="120" x2="115" y2="32"/>
      <circle class="fig-joint fig-hi" cx="85" cy="30" r="6"/>
      <circle class="fig-joint fig-hi" cx="115" cy="30" r="6"/>
    </g>
  ` },
  front_lever_prog: { kind: 'dynamic', caption: 'Seitenansicht, hängend am Griff · Körper hebt sich aus dem Hang in die Waagrechte', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <g class="fig-pose fig-fixed">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="42" r="14"/>
      <circle cx="100" cy="55" r="3"/>
    </g>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <line x1="100" y1="58" x2="100" y2="120"/>
      <line x1="100" y1="120" x2="90" y2="180"/>
      <line x1="100" y1="120" x2="110" y2="180"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <line x1="100" y1="58" x2="155" y2="55"/>
      <line x1="155" y1="55" x2="192" y2="52"/>
      <circle class="fig-joint fig-hi" cx="192" cy="52" r="6"/>
    </g>
  ` },
  dips: { kind: 'dynamic', caption: 'Seitenansicht, Stütz auf Barren/Kante · Körper senkt sich mit gebeugten Armen ab und drückt hoch', svg: `
    <line class="fig-rig" x1="55" y1="70" x2="55" y2="76"/>
    <line class="fig-rig" x1="145" y1="70" x2="145" y2="76"/>
    <circle class="fig-joint" cx="70" cy="72" r="5"/>
    <circle class="fig-joint" cx="130" cy="72" r="5"/>
    <path class="fig-motion" d="M100,165 L100,115"/>
    <polygon class="fig-arrow" points="100,110 94,122 106,122"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <circle cx="100" cy="60" r="14"/>
      <circle cx="113" cy="60" r="3"/>
      <line x1="70" y1="72" x2="97" y2="80"/>
      <line x1="130" y1="72" x2="103" y2="80"/>
      <line x1="100" y1="80" x2="100" y2="140"/>
      <line x1="100" y1="140" x2="90" y2="190"/>
      <line x1="100" y1="140" x2="110" y2="190"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <circle cx="100" cy="90" r="14"/>
      <circle cx="113" cy="90" r="3"/>
      <line x1="70" y1="72" x2="97" y2="108"/>
      <line x1="130" y1="72" x2="103" y2="108"/>
      <line x1="100" y1="108" x2="100" y2="168"/>
      <line x1="100" y1="168" x2="90" y2="192"/>
      <line x1="100" y1="168" x2="110" y2="192"/>
    </g>
  ` },
  split_squat: { kind: 'dynamic', caption: 'Seitenansicht, Ausfallschritt, hinterer Fuss erhöht · Knie senkt sich gerade nach unten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <line class="fig-rig" x1="140" y1="150" x2="175" y2="150"/>
    <circle class="fig-joint" cx="72" cy="196" r="5.5"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="86" cy="76" r="14"/>
      <circle cx="99" cy="76" r="3"/>
      <line x1="100" y1="85" x2="100" y2="128"/>
      <line x1="100" y1="128" x2="80" y2="160"/>
      <line x1="80" y1="160" x2="72" y2="196"/>
      <line x1="100" y1="128" x2="130" y2="150"/>
      <line x1="130" y1="150" x2="158" y2="150"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="80" cy="106" r="14"/>
      <circle cx="93" cy="106" r="3"/>
      <line x1="96" y1="115" x2="98" y2="150"/>
      <line x1="98" y1="150" x2="68" y2="172"/>
      <line x1="68" y1="172" x2="72" y2="196"/>
      <line x1="98" y1="150" x2="132" y2="162"/>
      <line x1="132" y1="162" x2="158" y2="150"/>
      <circle class="fig-joint fig-hi" cx="68" cy="172" r="5.5"/>
    </g>
  ` },
  calf_raise: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Fersen heben sich vom Boden ab in den Zehenstand', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
    </g>
    <path class="fig-motion" d="M99,178 L99,160"/>
    <polygon class="fig-arrow" points="99,155 93,167 105,167"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="196"/>
      <line x1="99" y1="138" x2="112" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="184"/>
      <line x1="88" y1="184" x2="94" y2="192"/>
      <line x1="99" y1="138" x2="112" y2="184"/>
      <line x1="112" y1="184" x2="118" y2="192"/>
      <circle class="fig-joint fig-hi" cx="88" cy="184" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="112" cy="184" r="4.5"/>
    </g>
  ` },
  tibialis_raise: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Ferse bleibt am Boden, Zehen/Vorfuss heben sich', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
    </g>
    <path class="fig-motion" d="M112,186 L119,168"/>
    <polygon class="fig-arrow" points="122,162 111,167 121,174"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="99" y1="138" x2="88" y2="196"/>
      <line x1="99" y1="138" x2="112" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="99" y1="138" x2="88" y2="192"/>
      <line x1="88" y1="192" x2="98" y2="180"/>
      <line x1="99" y1="138" x2="112" y2="192"/>
      <line x1="112" y1="192" x2="122" y2="180"/>
      <circle class="fig-joint fig-hi" cx="98" cy="180" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="122" cy="180" r="4.5"/>
    </g>
  ` },
  wall_sit: { kind: 'static', caption: 'Seitenansicht, Rücken an der Wand · Oberschenkel waagrecht wie auf einem unsichtbaren Stuhl', svg: `
    <line class="fig-rig" x1="170" y1="18" x2="170" y2="196"/>
    <line class="fig-rig" x1="105" y1="196" x2="170" y2="196"/>
    <circle class="fig-joint" cx="110" cy="196" r="5.5"/>
    <g class="fig-pose">
      <circle cx="165" cy="78" r="14"/>
      <circle cx="152" cy="78" r="3"/>
      <line x1="165" y1="92" x2="165" y2="150"/>
      <line x1="165" y1="150" x2="110" y2="150"/>
      <line x1="110" y1="150" x2="110" y2="196"/>
    </g>
  ` },
  cat_cow: { kind: 'dynamic', caption: 'Seitenansicht, Vierfüsslerstand · Rücken wölbt sich abwechselnd nach oben und hängt durch', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="70" y1="90" x2="70" y2="150"/>
      <line x1="150" y1="95" x2="150" y2="150"/>
    </g>
    <circle class="fig-joint" cx="70" cy="90" r="5"/>
    <circle class="fig-joint" cx="150" cy="95" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <circle cx="52" cy="78" r="13"/>
      <circle cx="43" cy="87" r="3"/>
      <polyline points="70,90 110,106 150,95"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <circle cx="58" cy="102" r="13"/>
      <circle cx="49" cy="93" r="3"/>
      <polyline points="70,90 110,74 150,95"/>
    </g>
  ` },
  worlds_greatest_stretch: { kind: 'dynamic', caption: 'Seitenansicht, Ausfallschritt · Oberkörper und ein Arm drehen sich nach oben zur Decke', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="100" y1="130" x2="75" y2="155"/>
      <line x1="75" y1="155" x2="70" y2="196"/>
      <line x1="100" y1="130" x2="140" y2="170"/>
      <line x1="140" y1="170" x2="158" y2="196"/>
    </g>
    <path class="fig-motion" d="M78,118 Q105,105 135,66"/>
    <polygon class="fig-arrow" points="140,60 128,62 133,72"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <circle cx="86" cy="88" r="13"/>
      <circle cx="88" cy="75" r="3"/>
      <line x1="100" y1="98" x2="100" y2="130"/>
      <line x1="100" y1="100" x2="76" y2="120"/>
      <circle class="fig-joint fig-hi" cx="76" cy="120" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <circle cx="112" cy="76" r="13"/>
      <circle cx="119" cy="65" r="3"/>
      <line x1="100" y1="98" x2="100" y2="130"/>
      <line x1="100" y1="98" x2="138" y2="62"/>
      <circle class="fig-joint fig-hi" cx="138" cy="62" r="5.5"/>
    </g>
  ` },
  hip_9090: { kind: 'dynamic', caption: 'Von oben, sitzend · beide Knie klappen im 90°-Winkel abwechselnd von einer Seite zur anderen', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="72" r="14"/>
      <line x1="99" y1="86" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M140,133 Q99,165 58,133"/>
    <polygon class="fig-arrow" points="55,130 62,140 68,128"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <polyline points="99,140 138,144 148,122"/>
      <polyline points="99,140 68,152 52,142"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <polyline points="99,140 60,144 50,122"/>
      <polyline points="99,140 131,152 147,142"/>
    </g>
  ` },
  thoracic_rotation: { kind: 'dynamic', caption: 'Seitenansicht, Vierfüsslerstand · ein Arm dreht unter dem Körper durch und wieder nach oben zur Decke', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="190" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="55" cy="80" r="13"/>
      <circle cx="42" cy="80" r="3"/>
      <line x1="70" y1="90" x2="150" y2="95"/>
      <line x1="70" y1="90" x2="70" y2="150"/>
      <line x1="150" y1="95" x2="150" y2="150"/>
    </g>
    <path class="fig-motion" d="M115,125 Q90,90 55,45"/>
    <polygon class="fig-arrow" points="50,40 55,52 63,44"/>
    <g class="fig-pose fig-a" style="animation-duration:2.5s;">
      <line x1="70" y1="90" x2="118" y2="128"/>
      <circle class="fig-joint fig-hi" cx="118" cy="128" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.5s;">
      <line x1="70" y1="90" x2="48" y2="38"/>
      <circle class="fig-joint fig-hi" cx="48" cy="38" r="5.5"/>
    </g>
  ` },
  shoulder_circles_band: { kind: 'dynamic', caption: 'Seitenansicht, stehend · gestreckte Arme kreisen mit dem Band von unten nach oben', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="62" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <line x1="99" y1="62" x2="132" y2="92"/>
      <line x1="99" y1="70" x2="130" y2="98"/>
      <circle class="fig-joint fig-hi" cx="132" cy="92" r="6"/>
      <circle class="fig-joint fig-hi" cx="130" cy="98" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <line x1="99" y1="62" x2="68" y2="30"/>
      <line x1="99" y1="70" x2="66" y2="38"/>
      <circle class="fig-joint fig-hi" cx="68" cy="30" r="6"/>
      <circle class="fig-joint fig-hi" cx="66" cy="38" r="6"/>
    </g>
  ` },
  wrist_mobility: { kind: 'dynamic', caption: 'Seitenansicht, Arme vorgestreckt · Handgelenke kippen auf und ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="97" y1="68" x2="78" y2="95"/>
      <line x1="97" y1="72" x2="118" y2="97"/>
    </g>
    <circle class="fig-joint" cx="78" cy="95" r="4.5"/>
    <circle class="fig-joint" cx="118" cy="97" r="4.5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="78" y1="95" x2="66" y2="86"/>
      <line x1="118" y1="97" x2="130" y2="108"/>
      <circle class="fig-joint fig-hi" cx="66" cy="86" r="5"/>
      <circle class="fig-joint fig-hi" cx="130" cy="108" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="78" y1="95" x2="66" y2="106"/>
      <line x1="118" y1="97" x2="130" y2="86"/>
      <circle class="fig-joint fig-hi" cx="66" cy="106" r="5"/>
      <circle class="fig-joint fig-hi" cx="130" cy="86" r="5"/>
    </g>
  ` },
  leg_swings: { kind: 'dynamic', caption: 'Seitenansicht, an etwas festhalten · gestrecktes Bein schwingt nach vorne und hinten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="108" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M78,178 Q100,160 128,172"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="130" y2="172"/>
      <circle class="fig-joint fig-hi" cx="130" cy="172" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="72" y2="178"/>
      <circle class="fig-joint fig-hi" cx="72" cy="178" r="5.5"/>
    </g>
  ` },
  ankle_rocks: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Knie schiebt über die Zehenspitzen, Ferse bleibt am Boden', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="120" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <circle class="fig-joint" cx="83" cy="196" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="138" x2="85" y2="170"/>
      <line x1="85" y1="170" x2="83" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="138" x2="100" y2="175"/>
      <line x1="100" y1="175" x2="83" y2="196"/>
      <circle class="fig-joint fig-hi" cx="100" cy="175" r="5"/>
    </g>
  ` },
  neck_mobility: { kind: 'dynamic', caption: 'Vorderansicht · Kopf dreht langsam nach links und rechts', svg: `
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="55" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="55" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="83" cy="40" r="15"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="115" cy="40" r="15"/>
    </g>
  ` },
  doorway_pec_stretch: { kind: 'static', caption: 'Vorderansicht, Arm im Türrahmen angewinkelt · Körper dreht von der Wand weg, Brust dehnt sich', svg: `
    <line class="fig-rig" x1="155" y1="18" x2="155" y2="196"/>
    <circle class="fig-joint" cx="150" cy="65" r="5.5"/>
    <g class="fig-pose">
      <circle cx="93" cy="42" r="15"/>
      <line x1="97" y1="60" x2="105" y2="138"/>
      <line x1="105" y1="138" x2="92" y2="196"/>
      <line x1="105" y1="138" x2="118" y2="196"/>
      <line x1="97" y1="65" x2="150" y2="65"/>
    </g>
  ` },
  jump_rope: { kind: 'dynamic', caption: 'Seitenansicht, stehend · beide Füsse federn leicht ab, während das Seil unter den Füssen durchschwingt', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="120"/>
    </g>
    <circle class="fig-joint" cx="99" cy="120" r="5"/>
    <path class="fig-motion" d="M99,178 L99,160"/>
    <polygon class="fig-arrow" points="99,155 93,167 105,167"/>
    <g class="fig-pose fig-a" style="animation-duration:1s;">
      <line x1="99" y1="120" x2="86" y2="188"/>
      <line x1="99" y1="120" x2="112" y2="188"/>
      <line x1="99" y1="75" x2="82" y2="108"/>
      <line x1="99" y1="75" x2="116" y2="108"/>
      <circle class="fig-joint fig-hi" cx="82" cy="108" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="116" cy="108" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1s;">
      <line x1="99" y1="120" x2="90" y2="172"/>
      <line x1="99" y1="120" x2="108" y2="172"/>
      <line x1="99" y1="75" x2="78" y2="98"/>
      <line x1="99" y1="75" x2="120" y2="98"/>
      <circle class="fig-joint fig-hi" cx="78" cy="98" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="120" cy="98" r="4.5"/>
    </g>
  ` },
  jefferson_curl: { kind: 'dynamic', caption: 'Seitenansicht, stehend, leichtes Gewicht in den Händen · Wirbelsäule rollt Wirbel für Wirbel Richtung Boden ein und wieder auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M90,70 Q65,110 58,160"/>
    <polygon class="fig-arrow" points="58,160 62,148 70,157"/>
    <g class="fig-pose fig-a" style="animation-duration:2.3s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="70" x2="94" y2="130"/>
      <circle class="fig-joint fig-hi" cx="94" cy="130" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.3s;">
      <path d="M99,138 Q75,100 62,55" fill="none"/>
      <circle cx="55" cy="48" r="14"/>
      <line x1="80" y1="90" x2="58" y2="175"/>
      <circle class="fig-joint fig-hi" cx="58" cy="175" r="4.5"/>
    </g>
  ` },
  hip_adduction_machine: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Beine drücken gegen den Widerstand zusammen', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="140" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="60" r="14"/>
      <circle cx="112" cy="60" r="3"/>
      <line x1="99" y1="74" x2="99" y2="130"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <path class="fig-motion" d="M70,160 L92,160"/>
    <polygon class="fig-arrow" points="92,160 84,155 84,165"/>
    <path class="fig-motion" d="M128,160 L106,160"/>
    <polygon class="fig-arrow" points="106,160 114,155 114,165"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="65" y2="160"/>
      <line x1="99" y1="130" x2="133" y2="160"/>
      <circle class="fig-joint fig-hi" cx="65" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="133" cy="160" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="88" y2="160"/>
      <line x1="99" y1="130" x2="110" y2="160"/>
      <circle class="fig-joint fig-hi" cx="88" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="110" cy="160" r="5"/>
    </g>
  ` },
  hip_abduction_machine: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Beine drücken gegen den Widerstand auseinander', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="140" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="60" r="14"/>
      <circle cx="112" cy="60" r="3"/>
      <line x1="99" y1="74" x2="99" y2="130"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <path class="fig-motion" d="M92,160 L70,160"/>
    <polygon class="fig-arrow" points="70,160 78,155 78,165"/>
    <path class="fig-motion" d="M106,160 L128,160"/>
    <polygon class="fig-arrow" points="128,160 120,155 120,165"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="88" y2="160"/>
      <line x1="99" y1="130" x2="110" y2="160"/>
      <circle class="fig-joint fig-hi" cx="88" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="110" cy="160" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="130" x2="65" y2="160"/>
      <line x1="99" y1="130" x2="133" y2="160"/>
      <circle class="fig-joint fig-hi" cx="65" cy="160" r="5"/>
      <circle class="fig-joint fig-hi" cx="133" cy="160" r="5"/>
    </g>
  ` },
  standwaage: { kind: 'static', caption: 'Seitenansicht, Einbeinstand · Oberkörper und freies Bein bilden eine waagrechte Linie, Arme stabilisieren seitlich', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="130" cy="70" r="14"/>
      <circle cx="140" cy="76" r="3"/>
      <line x1="122" y1="82" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="90" y2="196"/>
      <line x1="99" y1="150" x2="45" y2="130"/>
      <line x1="122" y1="90" x2="150" y2="60"/>
      <line x1="122" y1="90" x2="95" y2="65"/>
    </g>
    <circle class="fig-joint fig-hi" cx="45" cy="130" r="5.5"/>
  ` },
  cable_glute_kickback: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug · gestrecktes Bein drückt gegen den Widerstand nach hinten', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="10" y2="196"/>
    <circle class="fig-rig-dot" cx="10" cy="180" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="120"/>
      <line x1="99" y1="120" x2="90" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="120" r="5"/>
    <path class="fig-motion" d="M60,160 L30,178"/>
    <polygon class="fig-arrow" points="30,178 40,172 38,182"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="120" x2="70" y2="150"/>
      <line x1="70" y1="150" x2="55" y2="185"/>
      <circle class="fig-joint fig-hi" cx="55" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="120" x2="55" y2="115"/>
      <line x1="55" y1="115" x2="18" y2="130"/>
      <circle class="fig-joint fig-hi" cx="18" cy="130" r="5.5"/>
    </g>
  ` },
  heel_touches: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Beine angewinkelt · Oberkörper hebt sich leicht und tippt abwechselnd zur rechten und linken Ferse', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="60" y1="150" x2="55" y2="196"/>
      <line x1="140" y1="150" x2="145" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <circle cx="60" cy="110" r="13"/>
      <circle cx="66" cy="118" r="3"/>
      <line x1="70" y1="122" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="60" y2="150"/>
      <line x1="99" y1="130" x2="140" y2="150"/>
      <line x1="70" y1="120" x2="55" y2="190"/>
      <circle class="fig-joint fig-hi" cx="55" cy="190" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <circle cx="140" cy="110" r="13"/>
      <circle cx="134" cy="118" r="3"/>
      <line x1="130" y1="122" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="60" y2="150"/>
      <line x1="99" y1="130" x2="140" y2="150"/>
      <line x1="130" y1="120" x2="145" y2="190"/>
      <circle class="fig-joint fig-hi" cx="145" cy="190" r="5"/>
    </g>
  ` },
  side_bend_dumbbell: { kind: 'dynamic', caption: 'Vorderansicht, stehend, Kurzhantel in einer Hand · Oberkörper neigt sich seitlich zur Gewichtsseite und richtet sich wieder auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <path class="fig-motion" d="M99,60 L118,75"/>
    <polygon class="fig-arrow" points="118,75 106,72 112,82"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="70" x2="99" y2="130"/>
      <circle class="fig-joint fig-hi" cx="99" cy="130" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <path d="M99,138 Q108,95 130,60" fill="none"/>
      <circle cx="136" cy="52" r="15"/>
      <line x1="120" y1="80" x2="140" y2="130"/>
      <circle class="fig-joint fig-hi" cx="140" cy="130" r="5"/>
    </g>
  ` },
  side_bend_cable: { kind: 'dynamic', caption: 'Seitenansicht zum Kabelzug · Oberkörper neigt sich gegen den Widerstand zur Seite und richtet sich kontrolliert wieder auf', svg: `
    <line class="fig-rig" x1="180" y1="20" x2="180" y2="60"/>
    <circle class="fig-rig-dot" cx="180" cy="40" r="6"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="138" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="65" x2="150" y2="55"/>
      <circle class="fig-joint fig-hi" cx="150" cy="55" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <path d="M99,138 Q108,95 130,60" fill="none"/>
      <circle cx="136" cy="52" r="15"/>
      <line x1="130" y1="60" x2="165" y2="42"/>
      <circle class="fig-joint fig-hi" cx="165" cy="42" r="5"/>
    </g>
  ` },
  cable_crunch: { kind: 'dynamic', caption: 'Seitenansicht, kniend vor dem Kabelzug · Oberkörper rollt mit angespanntem Bauch nach unten ein', svg: `
    <line class="fig-rig" x1="99" y1="10" x2="99" y2="35"/>
    <circle class="fig-rig-dot" cx="99" cy="25" r="6"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="140" x2="80" y2="196"/>
      <line x1="99" y1="140" x2="118" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M99,70 Q99,100 99,120"/>
    <polygon class="fig-arrow" points="99,124 93,112 105,112"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="45" r="14"/>
      <line x1="97" y1="59" x2="99" y2="140"/>
      <line x1="97" y1="50" x2="99" y2="35"/>
      <circle class="fig-joint fig-hi" cx="97" cy="45" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <path d="M99,140 Q95,95 90,75" fill="none"/>
      <circle cx="86" cy="65" r="14"/>
      <line x1="86" y1="70" x2="99" y2="35"/>
      <circle class="fig-joint fig-hi" cx="86" cy="65" r="5"/>
    </g>
  ` },
  one_arm_row_dumbbell: { kind: 'dynamic', caption: 'Seitenansicht, ein Knie und eine Hand auf der Bank abgestützt · freier Arm zieht die Hantel zur Hüfte hoch', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="120" y2="150"/>
    <circle class="fig-joint" cx="60" cy="150" r="5"/>
    <circle class="fig-joint" cx="110" cy="150" r="5"/>
    <path class="fig-motion" d="M150,175 L150,140"/>
    <polygon class="fig-arrow" points="150,135 144,147 156,147"/>
    <g class="fig-pose fig-fixed">
      <circle cx="125" cy="90" r="14"/>
      <circle cx="118" cy="98" r="3"/>
      <line x1="115" y1="100" x2="112" y2="150"/>
      <line x1="130" y1="100" x2="60" y2="150"/>
      <line x1="112" y1="150" x2="130" y2="196"/>
      <line x1="112" y1="150" x2="95" y2="196"/>
    </g>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="120" y1="105" x2="150" y2="178"/>
      <circle class="fig-joint fig-hi" cx="150" cy="178" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="120" y1="105" x2="150" y2="140"/>
      <circle class="fig-joint fig-hi" cx="150" cy="140" r="5.5"/>
    </g>
  ` },
  cable_curl_low_pulley: { kind: 'dynamic', caption: 'Seitenansicht, stehend am tiefen Kabelzug · Unterarm curlt mit gestrecktem Oberarm nach oben zur Schulter', svg: `
    <line class="fig-rig" x1="130" y1="180" x2="130" y2="196"/>
    <circle class="fig-rig-dot" cx="130" cy="188" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M120,150 Q125,100 110,75"/>
    <polygon class="fig-arrow" points="106,68 105,80 116,76"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="122" y2="130"/>
      <line x1="122" y1="130" x2="128" y2="180"/>
      <circle class="fig-joint fig-hi" cx="128" cy="180" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="122" y2="90"/>
      <line x1="122" y1="90" x2="108" y2="68"/>
      <circle class="fig-joint fig-hi" cx="108" cy="68" r="5.5"/>
    </g>
  ` },
  glute_bridge_side_step: { kind: 'dynamic', caption: 'Seitenansicht, Hüftbrücke mit Band um die Knie · Hüfte bleibt oben, ein Knie tritt seitlich zur Seite und zurück', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="44" cy="150" r="13"/>
      <circle cx="52" cy="158" r="3"/>
      <line x1="56" y1="160" x2="120" y2="150"/>
    </g>
    <circle class="fig-joint" cx="120" cy="150" r="5"/>
    <path class="fig-motion" d="M150,165 L175,170"/>
    <polygon class="fig-arrow" points="175,170 165,164 165,175"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="120" y1="150" x2="150" y2="165"/>
      <line x1="150" y1="165" x2="150" y2="196"/>
      <circle class="fig-joint fig-hi" cx="150" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="120" y1="150" x2="150" y2="165"/>
      <line x1="150" y1="165" x2="178" y2="185"/>
      <circle class="fig-joint fig-hi" cx="178" cy="185" r="5"/>
    </g>
  ` },
  box_step_stepper: { kind: 'dynamic', caption: 'Seitenansicht, Stepper vor sich · ein Bein steigt hinauf und streckt sich oben durch, danach Seite wechseln', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="70" y2="196"/>
    <line class="fig-rig" x1="70" y1="150" x2="140" y2="150"/>
    <circle class="fig-joint" cx="70" cy="150" r="5"/>
    <path class="fig-motion" d="M130,180 L130,155"/>
    <polygon class="fig-arrow" points="130,150 124,162 136,162"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="88" cy="86" r="14"/>
      <circle cx="80" cy="90" r="3"/>
      <line x1="92" y1="95" x2="95" y2="140"/>
      <line x1="95" y1="140" x2="80" y2="196"/>
      <line x1="95" y1="140" x2="130" y2="180"/>
      <circle class="fig-joint fig-hi" cx="130" cy="180" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="112" cy="82" r="14"/>
      <circle cx="104" cy="86" r="3"/>
      <line x1="115" y1="92" x2="112" y2="132"/>
      <line x1="112" y1="132" x2="130" y2="150"/>
      <line x1="112" y1="132" x2="90" y2="170"/>
      <circle class="fig-joint fig-hi" cx="90" cy="170" r="5.5"/>
    </g>
  ` },
  lateral_shuffle: { kind: 'dynamic', caption: 'Vorderansicht, tiefe Haltung · schnelle Seitschritte, Füsse bleiben nah am Boden, Oberkörper stabil', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M90,170 L140,175"/>
    <polygon class="fig-arrow" points="140,175 130,170 132,180"/>
    <g class="fig-pose fig-a" style="animation-duration:1s;">
      <circle cx="97" cy="95" r="14"/>
      <line x1="97" y1="109" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="118" y2="196"/>
      <line x1="97" y1="115" x2="70" y2="140"/>
      <line x1="97" y1="115" x2="124" y2="140"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1s;">
      <circle cx="120" cy="95" r="14"/>
      <line x1="120" y1="109" x2="122" y2="150"/>
      <line x1="122" y1="150" x2="105" y2="196"/>
      <line x1="122" y1="150" x2="145" y2="196"/>
      <line x1="120" y1="115" x2="93" y2="135"/>
      <line x1="120" y1="115" x2="150" y2="135"/>
      <circle class="fig-joint fig-hi" cx="145" cy="196" r="5"/>
    </g>
  ` },
  carioca: { kind: 'dynamic', caption: 'Seitwärts laufen mit über- und untergekreuzten Schritten · Hüfte bleibt beweglich', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,170 L130,180"/>
    <polygon class="fig-arrow" points="130,180 120,176 122,186"/>
    <g class="fig-pose fig-a" style="animation-duration:1.1s;">
      <circle cx="97" cy="95" r="14"/>
      <line x1="97" y1="109" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="70" y2="185"/>
      <line x1="99" y1="150" x2="128" y2="185"/>
      <circle class="fig-joint fig-hi" cx="70" cy="185" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.1s;">
      <circle cx="115" cy="95" r="14"/>
      <line x1="115" y1="109" x2="117" y2="150"/>
      <line x1="117" y1="150" x2="140" y2="185"/>
      <line x1="117" y1="150" x2="90" y2="180"/>
      <circle class="fig-joint fig-hi" cx="90" cy="180" r="4.5"/>
    </g>
  ` },
  quick_feet: { kind: 'dynamic', caption: 'Auf der Stelle, so schnell wie möglich die Füsse abwechselnd kurz antippen, aufrechte Haltung', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="60" r="14"/>
      <line x1="97" y1="74" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M99,178 L99,165"/>
    <polygon class="fig-arrow" points="99,160 93,172 105,172"/>
    <g class="fig-pose fig-a" style="animation-duration:0.7s;">
      <line x1="99" y1="140" x2="88" y2="196"/>
      <line x1="99" y1="140" x2="106" y2="185"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:0.7s;">
      <line x1="99" y1="140" x2="92" y2="185"/>
      <line x1="99" y1="140" x2="112" y2="196"/>
    </g>
  ` },
  high_knees: { kind: 'dynamic', caption: 'Auf der Stelle oder vorwärts laufen · Knie explosiv bis auf Hüfthöhe anheben', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="60" r="14"/>
      <line x1="97" y1="74" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M115,180 L115,110"/>
    <polygon class="fig-arrow" points="115,105 109,117 121,117"/>
    <g class="fig-pose fig-a" style="animation-duration:0.9s;">
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="185"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:0.9s;">
      <line x1="99" y1="140" x2="90" y2="185"/>
      <line x1="99" y1="140" x2="115" y2="110"/>
      <line x1="115" y1="110" x2="120" y2="150"/>
      <circle class="fig-joint fig-hi" cx="115" cy="110" r="5"/>
    </g>
  ` },
  single_leg_hops: { kind: 'dynamic', caption: 'Auf einem Bein kontrolliert vorwärts oder seitlich springen, weich in den Knien abfedern', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,175 Q125,150 145,175"/>
    <polygon class="fig-arrow" points="145,175 138,168 133,178"/>
    <g class="fig-pose fig-a" style="animation-duration:1.3s;">
      <circle cx="97" cy="95" r="14"/>
      <line x1="97" y1="109" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="90" y2="196"/>
      <line x1="99" y1="150" x2="110" y2="180"/>
      <line x1="110" y1="180" x2="105" y2="196"/>
      <circle class="fig-joint fig-hi" cx="90" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.3s;">
      <circle cx="120" cy="80" r="14"/>
      <line x1="120" y1="94" x2="122" y2="140"/>
      <line x1="122" y1="140" x2="145" y2="180"/>
      <line x1="122" y1="140" x2="105" y2="160"/>
      <line x1="105" y1="160" x2="95" y2="145"/>
      <circle class="fig-joint fig-hi" cx="145" cy="180" r="5"/>
    </g>
  ` },
  lateral_bounds: { kind: 'dynamic', caption: 'Seitlich von einem Bein aufs andere springen, weich abfedern, kurz stabilisieren, dann zurückspringen', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M70,170 Q99,140 128,170"/>
    <polygon class="fig-arrow" points="128,170 118,166 118,176"/>
    <g class="fig-pose fig-a" style="animation-duration:1.2s;">
      <circle cx="75" cy="90" r="14"/>
      <line x1="78" y1="104" x2="80" y2="145"/>
      <line x1="80" y1="145" x2="65" y2="196"/>
      <line x1="80" y1="145" x2="105" y2="175"/>
      <line x1="105" y1="175" x2="100" y2="196"/>
      <circle class="fig-joint fig-hi" cx="65" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.2s;">
      <circle cx="123" cy="90" r="14"/>
      <line x1="120" y1="104" x2="118" y2="145"/>
      <line x1="118" y1="145" x2="133" y2="196"/>
      <line x1="118" y1="145" x2="93" y2="175"/>
      <line x1="93" y1="175" x2="98" y2="196"/>
      <circle class="fig-joint fig-hi" cx="133" cy="196" r="5"/>
    </g>
  ` },
  shuttle_sprint: { kind: 'dynamic', caption: 'Kurze Sprints zwischen Markierungen, schnelles Abstoppen und Richtungswechsel', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M60,180 L150,180"/>
    <polygon class="fig-arrow" points="150,180 140,175 140,185"/>
    <g class="fig-pose fig-a" style="animation-duration:1s;">
      <circle cx="80" cy="90" r="14"/>
      <line x1="83" y1="104" x2="90" y2="145"/>
      <line x1="90" y1="145" x2="60" y2="180"/>
      <line x1="90" y1="145" x2="120" y2="160"/>
      <line x1="120" y1="160" x2="140" y2="140"/>
      <circle class="fig-joint fig-hi" cx="60" cy="180" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1s;">
      <circle cx="120" cy="90" r="14"/>
      <line x1="117" y1="104" x2="110" y2="145"/>
      <line x1="110" y1="145" x2="150" y2="180"/>
      <line x1="110" y1="145" x2="80" y2="160"/>
      <line x1="80" y1="160" x2="60" y2="140"/>
      <circle class="fig-joint fig-hi" cx="150" cy="180" r="5"/>
    </g>
  ` },
  agility_ladder_run: { kind: 'dynamic', caption: 'Schnelle, kurze Schritte durch eine Koordinationsleiter (oder markierte Felder), verschiedene Schrittmuster möglich', svg: `
    <line class="fig-rig" x1="60" y1="196" x2="60" y2="185"/>
    <line class="fig-rig" x1="100" y1="196" x2="100" y2="185"/>
    <line class="fig-rig" x1="140" y1="196" x2="140" y2="185"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="70" r="14"/>
      <line x1="97" y1="84" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="140" r="5"/>
    <path class="fig-motion" d="M99,178 L120,165"/>
    <polygon class="fig-arrow" points="120,165 110,164 113,174"/>
    <g class="fig-pose fig-a" style="animation-duration:0.8s;">
      <line x1="99" y1="140" x2="90" y2="196"/>
      <line x1="99" y1="140" x2="108" y2="170"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:0.8s;">
      <line x1="99" y1="140" x2="95" y2="170"/>
      <line x1="99" y1="140" x2="120" y2="196"/>
    </g>
  ` },
  couch_stretch: { kind: 'static', caption: 'Seitenansicht, hinteres Knie am Boden · Fussrücken an Wand/Couch abgestützt, Becken schiebt sich nach vorne unten', svg: `
    <line class="fig-rig" x1="150" y1="60" x2="150" y2="196"/>
    <circle class="fig-joint" cx="150" cy="170" r="5.5"/>
    <g class="fig-pose">
      <circle cx="70" cy="90" r="14"/>
      <circle cx="78" cy="96" r="3"/>
      <line x1="70" y1="104" x2="90" y2="150"/>
      <line x1="90" y1="150" x2="80" y2="196"/>
      <line x1="90" y1="150" x2="130" y2="180"/>
      <line x1="130" y1="180" x2="150" y2="170"/>
    </g>
  ` },
  figure_four_stretch: { kind: 'static', caption: 'Seitenansicht, Rückenlage · ein Knöchel liegt auf dem gegenüberliegenden Knie, das freie Bein zieht sich zur Brust', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="30" cy="130" r="3"/>
      <line x1="46" y1="146" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="130" y2="120"/>
      <line x1="130" y1="120" x2="150" y2="145"/>
      <line x1="99" y1="150" x2="115" y2="105"/>
      <line x1="46" y1="146" x2="130" y2="110"/>
    </g>
  ` },
  frog_stretch: { kind: 'static', caption: 'Vierfüsslerstand, Knie weit auseinander nach aussen · Gesäss senkt sich langsam Richtung Fersen ab', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="99" cy="115" r="14"/>
      <line x1="99" y1="129" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="180"/>
      <line x1="60" y1="180" x2="60" y2="196"/>
      <line x1="99" y1="150" x2="138" y2="180"/>
      <line x1="138" y1="180" x2="138" y2="196"/>
      <line x1="99" y1="129" x2="75" y2="150"/>
      <line x1="99" y1="129" x2="123" y2="150"/>
    </g>
  ` },
  deep_squat_hold: { kind: 'static', caption: 'Seitenansicht, Füsse schulterbreit · so tief wie möglich in die Hocke, Fersen bleiben am Boden, Position ruhig halten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5.5"/>
    <g class="fig-pose">
      <circle cx="107" cy="95" r="15"/>
      <line x1="103" y1="110" x2="99" y2="155"/>
      <line x1="99" y1="155" x2="70" y2="180"/>
      <line x1="70" y1="180" x2="76" y2="196"/>
      <line x1="99" y1="155" x2="128" y2="180"/>
      <line x1="128" y1="180" x2="122" y2="196"/>
      <line x1="103" y1="115" x2="80" y2="140"/>
      <line x1="103" y1="115" x2="126" y2="140"/>
    </g>
  ` },
  spiderman_lunge_rotation: { kind: 'dynamic', caption: 'Seitenansicht, grosser Ausfallschritt · innere Hand stützt neben dem vorderen Fuss, Oberkörper dreht sich zur Decke auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,80 Q130,90 150,70"/>
    <polygon class="fig-arrow" points="150,70 138,70 142,80"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="60" y2="175"/>
      <line x1="60" y1="175" x2="55" y2="196"/>
      <line x1="99" y1="150" x2="130" y2="185"/>
      <line x1="130" y1="185" x2="150" y2="196"/>
      <line x1="99" y1="150" x2="60" y2="185"/>
    </g>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <circle cx="80" cy="100" r="14"/>
      <line x1="88" y1="110" x2="99" y2="150"/>
      <line x1="90" y1="105" x2="115" y2="80"/>
      <circle class="fig-joint fig-hi" cx="115" cy="80" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <circle cx="105" cy="80" r="14"/>
      <line x1="108" y1="94" x2="99" y2="150"/>
      <line x1="112" y1="85" x2="150" y2="65"/>
      <circle class="fig-joint fig-hi" cx="150" cy="65" r="5"/>
    </g>
  ` },
  standing_hip_circles: { kind: 'dynamic', caption: 'Vorderansicht, hüftbreiter Stand · grosse, kontrollierte Kreise mit der Hüfte in beide Richtungen', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="130"/>
    </g>
    <circle class="fig-joint" cx="99" cy="130" r="5"/>
    <path class="fig-motion" d="M119,150 A20,12 0 1 1 118.9,150"/>
    <polygon class="fig-arrow" points="119,150 110,146 112,157"/>
    <g class="fig-pose fig-a" style="animation-duration:2.4s;">
      <line x1="99" y1="130" x2="80" y2="185"/>
      <line x1="99" y1="130" x2="118" y2="185"/>
      <circle class="fig-joint fig-hi" cx="119" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.4s;">
      <line x1="99" y1="130" x2="90" y2="188"/>
      <line x1="99" y1="130" x2="128" y2="178"/>
      <circle class="fig-joint fig-hi" cx="129" cy="145" r="5"/>
    </g>
  ` },
  lateral_lunge_mobility: { kind: 'dynamic', caption: 'Vorderansicht, grosser Schritt zur Seite · Gewicht verlagert sich auf das gebeugte Bein, das andere bleibt gestreckt', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,175 L145,180"/>
    <polygon class="fig-arrow" points="145,180 135,176 137,186"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="112" cy="55" r="15"/>
      <line x1="108" y1="72" x2="105" y2="138"/>
      <line x1="105" y1="138" x2="60" y2="196"/>
      <line x1="105" y1="138" x2="150" y2="175"/>
      <line x1="150" y1="175" x2="150" y2="196"/>
      <circle class="fig-joint fig-hi" cx="105" cy="138" r="5.5"/>
    </g>
  ` },
  standing_quad_stretch: { kind: 'static', caption: 'Seitenansicht, Einbeinstand · ein Fuss wird zum Gesäss gezogen, Knie zeigt nach unten, Becken kippt leicht nach vorne', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <g class="fig-pose">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="90" y2="196"/>
      <line x1="99" y1="138" x2="120" y2="165"/>
      <line x1="120" y1="165" x2="105" y2="185"/>
      <line x1="99" y1="80" x2="110" y2="170"/>
    </g>
    <circle class="fig-joint fig-hi" cx="105" cy="185" r="5.5"/>
  ` },
  calf_stretch_wall: { kind: 'static', caption: 'Hände an der Wand, ein Bein weit nach hinten gestreckt · Ferse bleibt am Boden, Becken schiebt sich nach vorne', svg: `
    <line class="fig-rig" x1="10" y1="20" x2="10" y2="196"/>
    <circle class="fig-joint" cx="45" cy="70" r="5"/>
    <g class="fig-pose">
      <circle cx="70" cy="60" r="14"/>
      <circle cx="80" cy="65" r="3"/>
      <line x1="55" y1="68" x2="15" y2="65"/>
      <line x1="75" y1="72" x2="90" y2="150"/>
      <line x1="90" y1="150" x2="80" y2="196"/>
      <line x1="90" y1="150" x2="150" y2="175"/>
      <line x1="150" y1="175" x2="170" y2="196"/>
    </g>
  ` },
  adductor_rock: { kind: 'dynamic', caption: 'Kniend, ein Bein seitlich gestreckt aufgestellt · Gewicht wiegt sich kontrolliert von einer Seite zur anderen', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M70,140 L130,140"/>
    <polygon class="fig-arrow" points="70,140 80,135 80,145"/>
    <polygon class="fig-arrow" points="130,140 120,135 120,145"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="75" cy="105" r="14"/>
      <line x1="80" y1="118" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="140" y2="150"/>
      <line x1="99" y1="150" x2="70" y2="180"/>
      <line x1="70" y1="180" x2="70" y2="196"/>
      <circle class="fig-joint fig-hi" cx="140" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="123" cy="105" r="14"/>
      <line x1="118" y1="118" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="150"/>
      <line x1="99" y1="150" x2="128" y2="180"/>
      <line x1="128" y1="180" x2="128" y2="196"/>
      <circle class="fig-joint fig-hi" cx="60" cy="150" r="5"/>
    </g>
  ` },
  back_extension: { kind: 'dynamic', caption: 'Seitenansicht, an der Rückenstrecker-Bank · Oberkörper senkt sich aus der Hüfte ab und richtet sich kontrolliert wieder auf', svg: `
    <line class="fig-rig" x1="70" y1="150" x2="130" y2="150"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="90" y2="196"/>
      <line x1="99" y1="150" x2="108" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M60,150 L60,100"/>
    <polygon class="fig-arrow" points="60,95 54,107 66,107"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="45" cy="165" r="14"/>
      <line x1="52" y1="172" x2="99" y2="150"/>
      <circle class="fig-joint fig-hi" cx="45" cy="165" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="55" cy="105" r="14"/>
      <line x1="60" y1="117" x2="99" y2="150"/>
      <circle class="fig-joint fig-hi" cx="55" cy="105" r="5.5"/>
    </g>
  ` },
  ab_wheel_rollout: { kind: 'dynamic', caption: 'Seitenansicht, kniend · Rad rollt mit angespanntem Bauch kontrolliert nach vorne und wieder zurück', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="90" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,60 Q60,90 40,140"/>
    <polygon class="fig-arrow" points="40,140 46,128 54,136"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="97" cy="118" r="14"/>
      <line x1="97" y1="132" x2="99" y2="150"/>
      <line x1="97" y1="125" x2="70" y2="160"/>
      <circle class="fig-joint fig-hi" cx="70" cy="160" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="55" cy="55" r="14"/>
      <path d="M99,150 Q75,110 62,68" fill="none"/>
      <line x1="62" y1="68" x2="30" y2="150"/>
      <circle class="fig-joint fig-hi" cx="30" cy="150" r="5.5"/>
    </g>
  ` },
  cable_woodchop: { kind: 'dynamic', caption: 'Seitenansicht zum Kabelzug · Griff zieht diagonal von oben aussen nach unten über den Körper', svg: `
    <line class="fig-rig" x1="188" y1="20" x2="188" y2="45"/>
    <circle class="fig-rig-dot" cx="188" cy="32" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M150,50 Q110,110 50,160"/>
    <polygon class="fig-arrow" points="50,160 58,150 62,160"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="70" x2="155" y2="45"/>
      <circle class="fig-joint fig-hi" cx="155" cy="45" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="70" x2="45" y2="165"/>
      <circle class="fig-joint fig-hi" cx="45" cy="165" r="5.5"/>
    </g>
  ` },
  dead_bug: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Arme und Beine angewinkelt · gegenüberliegender Arm und Bein strecken sich abwechselnd aus', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="30" cy="130" r="3"/>
      <line x1="46" y1="146" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="145"/>
      <line x1="99" y1="150" x2="130" y2="185"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M130,120 L165,105"/>
    <polygon class="fig-arrow" points="165,105 155,104 158,114"/>
    <path class="fig-motion" d="M95,185 L75,190"/>
    <polygon class="fig-arrow" points="75,190 84,186 84,194"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="150" x2="115" y2="115"/>
      <line x1="99" y1="150" x2="90" y2="185"/>
      <circle class="fig-joint fig-hi" cx="115" cy="115" r="5"/>
      <circle class="fig-joint fig-hi" cx="90" cy="185" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="150" x2="168" y2="102"/>
      <line x1="99" y1="150" x2="70" y2="192"/>
      <circle class="fig-joint fig-hi" cx="168" cy="102" r="5"/>
      <circle class="fig-joint fig-hi" cx="70" cy="192" r="5"/>
    </g>
  ` },
  mountain_climbers: { kind: 'dynamic', caption: 'Seitenansicht, Liegestütz-Position · Knie ziehen abwechselnd zügig Richtung Brust', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="195" y2="150"/>
    <circle class="fig-joint" cx="55" cy="150" r="5.5"/>
    <circle class="fig-joint" cx="191" cy="149" r="5.5"/>
    <g class="fig-pose fig-fixed">
      <circle cx="44" cy="88" r="14"/>
      <circle cx="40" cy="100" r="3"/>
      <line x1="60" y1="95" x2="135" y2="100"/>
      <line x1="135" y1="100" x2="190" y2="148"/>
      <line x1="60" y1="95" x2="55" y2="150"/>
    </g>
    <path class="fig-motion" d="M150,180 Q130,140 105,110"/>
    <polygon class="fig-arrow" points="105,110 112,120 100,122"/>
    <g class="fig-pose fig-a" style="animation-duration:1.4s;">
      <line x1="135" y1="100" x2="150" y2="185"/>
      <circle class="fig-joint fig-hi" cx="150" cy="185" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.4s;">
      <line x1="135" y1="100" x2="100" y2="115"/>
      <circle class="fig-joint fig-hi" cx="100" cy="115" r="5"/>
    </g>
  ` },
  sit_up: { kind: 'dynamic', caption: 'Rückenlage, Füsse fixiert · Oberkörper rollt mit angespanntem Bauch komplett zum Sitz auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="130" y2="180"/>
      <line x1="130" y1="180" x2="160" y2="180"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M50,140 Q60,90 90,60"/>
    <polygon class="fig-arrow" points="90,60 78,60 82,70"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="35" cy="140" r="14"/>
      <circle cx="30" cy="130" r="3"/>
      <line x1="46" y1="146" x2="99" y2="150"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="82" cy="55" r="14"/>
      <circle cx="93" cy="52" r="3"/>
      <line x1="88" y1="68" x2="99" y2="150"/>
    </g>
  ` },
  squat: { kind: 'dynamic', caption: 'Seitenansicht, Füsse schulterbreit · Hüfte senkt sich nach hinten unten ab, Knie folgen der Fussrichtung', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 L99,130"/>
    <polygon class="fig-arrow" points="99,125 93,137 105,137"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="107" cy="85" r="15"/>
      <line x1="103" y1="100" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="75" y2="175"/>
      <line x1="75" y1="175" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="123" y2="175"/>
      <line x1="123" y1="175" x2="118" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  deadlift: { kind: 'dynamic', caption: 'Seitenansicht, Stange nah am Schienbein · Oberkörper richtet sich aus Hüfte und Beinen kontrolliert auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M75,170 L90,90"/>
    <polygon class="fig-arrow" points="90,90 82,96 88,104"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="120" cy="70" r="14"/>
      <circle cx="112" cy="78" r="3"/>
      <line x1="112" y1="82" x2="90" y2="150"/>
      <line x1="90" y1="150" x2="85" y2="196"/>
      <line x1="90" y1="150" x2="110" y2="196"/>
      <line x1="105" y1="90" x2="75" y2="172"/>
      <circle class="fig-joint fig-hi" cx="75" cy="172" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="90" y2="196"/>
      <line x1="99" y1="138" x2="108" y2="196"/>
      <line x1="99" y1="70" x2="90" y2="130"/>
      <circle class="fig-joint fig-hi" cx="90" cy="130" r="5.5"/>
    </g>
  ` },
  rdl: { kind: 'dynamic', caption: 'Seitenansicht, Beine leicht gebeugt · Hüfte schiebt sich nach hinten, Stange gleitet nah am Bein ab und wieder hoch', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M78,165 L92,100"/>
    <polygon class="fig-arrow" points="92,100 84,105 90,113"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="115" cy="75" r="14"/>
      <circle cx="108" cy="82" r="3"/>
      <line x1="108" y1="86" x2="95" y2="150"/>
      <line x1="95" y1="150" x2="88" y2="196"/>
      <line x1="95" y1="150" x2="108" y2="196"/>
      <line x1="103" y1="95" x2="78" y2="168"/>
      <circle class="fig-joint fig-hi" cx="78" cy="168" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="90" y2="196"/>
      <line x1="99" y1="138" x2="108" y2="196"/>
      <line x1="99" y1="70" x2="92" y2="130"/>
      <circle class="fig-joint fig-hi" cx="92" cy="130" r="5.5"/>
    </g>
  ` },
  zercher_squat_rotation: { kind: 'dynamic', caption: 'Seitenansicht, Kniebeuge mit Gewicht in den Armbeugen · unten in der Position rotiert der Oberkörper kontrolliert zur Seite', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M70,110 Q99,120 128,110"/>
    <polygon class="fig-arrow" points="128,110 118,108 120,118"/>
    <g class="fig-pose fig-fixed">
      <line x1="99" y1="150" x2="75" y2="175"/>
      <line x1="75" y1="175" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="123" y2="175"/>
      <line x1="123" y1="175" x2="118" y2="196"/>
    </g>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <circle cx="107" cy="90" r="14"/>
      <line x1="99" y1="103" x2="99" y2="150"/>
      <line x1="80" y1="110" x2="118" y2="110"/>
      <circle class="fig-joint fig-hi" cx="80" cy="110" r="5"/>
      <circle class="fig-joint fig-hi" cx="118" cy="110" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <circle cx="90" cy="90" r="14"/>
      <line x1="99" y1="103" x2="99" y2="150"/>
      <line x1="65" y1="105" x2="105" y2="115"/>
      <circle class="fig-joint fig-hi" cx="65" cy="105" r="5"/>
      <circle class="fig-joint fig-hi" cx="105" cy="115" r="5"/>
    </g>
  ` },
  leg_extension: { kind: 'dynamic', caption: 'Seitenansicht, sitzend an der Maschine · Unterschenkel strecken sich gegen den Widerstand nach vorne', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="60" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="70" cy="60" r="14"/>
      <line x1="70" y1="74" x2="70" y2="140"/>
      <line x1="70" y1="140" x2="99" y2="150"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,190 Q130,170 150,140"/>
    <polygon class="fig-arrow" points="150,140 138,142 142,152"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="95" y2="196"/>
      <circle class="fig-joint fig-hi" cx="95" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="150" y2="138"/>
      <circle class="fig-joint fig-hi" cx="150" cy="138" r="5"/>
    </g>
  ` },
  leg_curl_lying: { kind: 'dynamic', caption: 'Seitenansicht, Bauchlage an der Maschine · Fersen ziehen gegen den Widerstand Richtung Gesäss', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="130" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="30" cy="140" r="13"/>
      <circle cx="34" cy="130" r="3"/>
      <line x1="42" y1="146" x2="120" y2="150"/>
    </g>
    <circle class="fig-joint" cx="120" cy="150" r="5"/>
    <path class="fig-motion" d="M155,175 L145,120"/>
    <polygon class="fig-arrow" points="145,115 140,126 150,127"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="120" y1="150" x2="158" y2="178"/>
      <circle class="fig-joint fig-hi" cx="158" cy="178" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="120" y1="150" x2="150" y2="105"/>
      <circle class="fig-joint fig-hi" cx="150" cy="105" r="5.5"/>
    </g>
  ` },
  hip_abduction_cable: { kind: 'dynamic', caption: 'Seitenansicht, seitlich zum Kabelzug stehend · Bein spreizt gegen den Widerstand seitlich ab', svg: `
    <line class="fig-rig" x1="190" y1="150" x2="190" y2="196"/>
    <circle class="fig-rig-dot" cx="190" cy="175" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="120"/>
      <line x1="99" y1="120" x2="95" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="120" r="5"/>
    <path class="fig-motion" d="M110,160 L150,175"/>
    <polygon class="fig-arrow" points="150,175 140,170 140,180"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="120" x2="108" y2="196"/>
      <circle class="fig-joint fig-hi" cx="108" cy="196" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="120" x2="160" y2="180"/>
      <circle class="fig-joint fig-hi" cx="160" cy="180" r="5.5"/>
    </g>
  ` },
  calf_raise_machine: { kind: 'dynamic', caption: 'Seitenansicht, an der Maschine, Schultern unter den Polstern · Fersen drücken sich nach oben in den Zehenstand', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <line class="fig-rig" x1="80" y1="20" x2="120" y2="20"/>
    <circle class="fig-joint" cx="99" cy="34" r="5"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
    </g>
    <path class="fig-motion" d="M99,178 L99,160"/>
    <polygon class="fig-arrow" points="99,155 93,167 105,167"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="196"/>
      <line x1="99" y1="138" x2="112" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="99" y1="138" x2="88" y2="184"/>
      <line x1="88" y1="184" x2="94" y2="192"/>
      <line x1="99" y1="138" x2="112" y2="184"/>
      <line x1="112" y1="184" x2="118" y2="192"/>
      <circle class="fig-joint fig-hi" cx="88" cy="184" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="112" cy="184" r="4.5"/>
    </g>
  ` },
  calf_raise_seated: { kind: 'dynamic', caption: 'Seitenansicht, sitzend, Polster auf den Oberschenkeln · Fersen heben sich gegen den Widerstand an', svg: `
    <line class="fig-rig" x1="60" y1="150" x2="140" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="70" r="14"/>
      <line x1="99" y1="84" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="130" y2="150"/>
      <rect x="118" y="140" width="20" height="10" rx="2"/>
    </g>
    <circle class="fig-joint" cx="130" cy="150" r="5"/>
    <path class="fig-motion" d="M130,190 L130,172"/>
    <polygon class="fig-arrow" points="130,167 124,179 136,179"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="130" y1="150" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="130" cy="196" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="130" y1="150" x2="130" y2="184"/>
      <line x1="130" y1="184" x2="140" y2="192"/>
      <circle class="fig-joint fig-hi" cx="140" cy="192" r="4.5"/>
    </g>
  ` },
  deadlift_sumo: { kind: 'dynamic', caption: 'Vorderansicht, breiter Stand, Hände innerhalb der Beine · Oberkörper richtet sich aus Hüfte und Beinen auf', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M85,165 L92,95"/>
    <polygon class="fig-arrow" points="92,95 84,100 90,108"/>
    <g class="fig-pose fig-a" style="animation-duration:2.1s;">
      <circle cx="115" cy="72" r="14"/>
      <circle cx="107" cy="80" r="3"/>
      <line x1="108" y1="84" x2="95" y2="148"/>
      <line x1="95" y1="148" x2="75" y2="196"/>
      <line x1="95" y1="148" x2="120" y2="196"/>
      <line x1="103" y1="92" x2="85" y2="170"/>
      <circle class="fig-joint fig-hi" cx="85" cy="170" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.1s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="78" y2="196"/>
      <line x1="99" y1="138" x2="120" y2="196"/>
      <line x1="99" y1="70" x2="92" y2="130"/>
      <circle class="fig-joint fig-hi" cx="92" cy="130" r="5.5"/>
    </g>
  ` },
  hip_thrust: { kind: 'dynamic', caption: 'Seitenansicht, oberer Rücken auf der Bank · Hüfte drückt mit Gewicht auf dem Becken nach oben, Gesäss oben anspannen', svg: `
    <line class="fig-rig" x1="10" y1="150" x2="55" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="30" cy="140" r="13"/>
      <circle cx="26" cy="130" r="3"/>
      <line x1="40" y1="148" x2="55" y2="150"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M99,180 L99,150"/>
    <polygon class="fig-arrow" points="99,145 93,157 105,157"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="55" y1="150" x2="99" y2="185"/>
      <line x1="99" y1="185" x2="130" y2="150"/>
      <line x1="130" y1="150" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="55" y1="150" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="130" y2="160"/>
      <line x1="130" y1="160" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  leg_press: { kind: 'dynamic', caption: 'Seitenansicht, an der Beinpresse · Beine beugen sich bis ca. 90° und strecken die Platte kontrolliert wieder nach oben', svg: `
    <line class="fig-rig" x1="150" y1="60" x2="150" y2="180"/>
    <g class="fig-pose fig-fixed">
      <circle cx="60" cy="110" r="14"/>
      <line x1="60" y1="124" x2="70" y2="150"/>
      <line x1="70" y1="150" x2="99" y2="150"/>
    </g>
    <circle class="fig-joint" cx="99" cy="150" r="5"/>
    <path class="fig-motion" d="M120,150 L150,110"/>
    <polygon class="fig-arrow" points="150,110 140,113 145,122"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="99" y2="185"/>
      <line x1="99" y1="185" x2="130" y2="185"/>
      <circle class="fig-joint fig-hi" cx="130" cy="185" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="150" x2="115" y2="130"/>
      <line x1="115" y1="130" x2="150" y2="110"/>
      <circle class="fig-joint fig-hi" cx="150" cy="110" r="5"/>
    </g>
  ` },
  lunge_dumbbell: { kind: 'dynamic', caption: 'Seitenansicht, grosser Schritt nach vorne · hinteres Knie senkt sich Richtung Boden, dann zurück in den Stand drücken', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 Q130,180 150,175"/>
    <polygon class="fig-arrow" points="150,175 140,170 142,180"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <circle class="fig-joint fig-hi" cx="114" cy="196" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="102" cy="60" r="15"/>
      <line x1="100" y1="78" x2="100" y2="130"/>
      <line x1="100" y1="130" x2="150" y2="150"/>
      <line x1="150" y1="150" x2="150" y2="196"/>
      <line x1="100" y1="130" x2="70" y2="160"/>
      <line x1="70" y1="160" x2="80" y2="196"/>
      <circle class="fig-joint fig-hi" cx="150" cy="196" r="5"/>
    </g>
  ` },
  goblet_squat: { kind: 'dynamic', caption: 'Seitenansicht, Gewicht vor der Brust gehalten · Kniebeuge bis Oberschenkel mindestens parallel zum Boden', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 L99,130"/>
    <polygon class="fig-arrow" points="99,125 93,137 105,137"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="65" x2="99" y2="90"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="107" cy="85" r="15"/>
      <line x1="103" y1="100" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="75" y2="175"/>
      <line x1="75" y1="175" x2="80" y2="196"/>
      <line x1="99" y1="150" x2="123" y2="175"/>
      <line x1="123" y1="175" x2="118" y2="196"/>
      <line x1="103" y1="108" x2="103" y2="130"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  sumo_squat: { kind: 'dynamic', caption: 'Vorderansicht, breiter Stand, Fussspitzen nach aussen · Hüfte senkt sich gerade nach unten, Knie in Fussrichtung', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,175 L99,130"/>
    <polygon class="fig-arrow" points="99,125 93,137 105,137"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="75" y2="196"/>
      <line x1="99" y1="138" x2="123" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="138" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="97" cy="72" r="15"/>
      <line x1="97" y1="90" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="60" y2="175"/>
      <line x1="60" y1="175" x2="68" y2="196"/>
      <line x1="99" y1="150" x2="138" y2="175"/>
      <line x1="138" y1="175" x2="130" y2="196"/>
      <circle class="fig-joint fig-hi" cx="99" cy="150" r="5.5"/>
    </g>
  ` },
  step_up: { kind: 'dynamic', caption: 'Seitenansicht, erhöhte Fläche vor sich · ein Bein steigt hinauf, oben durchstrecken, kontrolliert zurück nach unten', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="70" y2="196"/>
    <line class="fig-rig" x1="70" y1="160" x2="140" y2="160"/>
    <circle class="fig-joint" cx="70" cy="160" r="5"/>
    <path class="fig-motion" d="M130,190 L130,165"/>
    <polygon class="fig-arrow" points="130,160 124,172 136,172"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <circle cx="88" cy="90" r="14"/>
      <line x1="90" y1="104" x2="95" y2="145"/>
      <line x1="95" y1="145" x2="80" y2="196"/>
      <line x1="95" y1="145" x2="130" y2="190"/>
      <circle class="fig-joint fig-hi" cx="130" cy="190" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <circle cx="112" cy="88" r="14"/>
      <line x1="112" y1="102" x2="112" y2="140"/>
      <line x1="112" y1="140" x2="130" y2="160"/>
      <line x1="112" y1="140" x2="90" y2="175"/>
      <circle class="fig-joint fig-hi" cx="90" cy="175" r="5.5"/>
    </g>
  ` },
  nordic_hamstring_curl: { kind: 'dynamic', caption: 'Seitenansicht, kniend, Füsse fixiert · Oberkörper senkt sich so weit wie möglich kontrolliert nach vorne ab, mit den Beinen abbremsen', svg: `
    <line class="fig-rig" x1="80" y1="196" x2="120" y2="196"/>
    <circle class="fig-joint" cx="99" cy="196" r="5"/>
    <path class="fig-motion" d="M99,90 Q60,120 45,165"/>
    <polygon class="fig-arrow" points="45,165 50,153 58,163"/>
    <g class="fig-pose fig-a" style="animation-duration:2.2s;">
      <circle cx="97" cy="120" r="15"/>
      <line x1="97" y1="135" x2="99" y2="170"/>
      <line x1="99" y1="170" x2="99" y2="196"/>
      <circle class="fig-joint fig-hi" cx="97" cy="120" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2.2s;">
      <path d="M99,170 Q70,130 42,70" fill="none"/>
      <circle cx="36" cy="60" r="14"/>
      <line x1="99" y1="170" x2="99" y2="196"/>
      <circle class="fig-joint fig-hi" cx="36" cy="60" r="5.5"/>
    </g>
  ` },
  pullup: { kind: 'dynamic', caption: 'Vorderansicht, Obergriff an der Stange · Körper zieht sich hoch, bis das Kinn über die Stange kommt', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <path class="fig-motion" d="M100,150 L100,90"/>
    <polygon class="fig-arrow" points="100,85 94,97 106,97"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="80" r="14"/>
      <circle cx="112" cy="80" r="3"/>
      <line x1="100" y1="94" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="110" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="90" y2="40"/>
      <line x1="122" y1="20" x2="110" y2="40"/>
      <circle cx="100" cy="34" r="14"/>
      <circle cx="112" cy="30" r="3"/>
      <line x1="100" y1="48" x2="100" y2="110"/>
      <line x1="100" y1="110" x2="90" y2="170"/>
      <line x1="100" y1="110" x2="110" y2="170"/>
      <circle class="fig-joint fig-hi" cx="100" cy="34" r="6"/>
    </g>
  ` },
  pullup_weighted: { kind: 'dynamic', caption: 'Vorderansicht, Obergriff an der Stange, Zusatzgewicht am Gurt · Körper zieht sich hoch, bis das Kinn über die Stange kommt', svg: `
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <path class="fig-motion" d="M100,150 L100,90"/>
    <polygon class="fig-arrow" points="100,85 94,97 106,97"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="80" r="14"/>
      <circle cx="112" cy="80" r="3"/>
      <line x1="100" y1="94" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="110" y2="196"/>
      <rect x="93" y="152" width="14" height="12" rx="2"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="78" y1="20" x2="90" y2="40"/>
      <line x1="122" y1="20" x2="110" y2="40"/>
      <circle cx="100" cy="34" r="14"/>
      <circle cx="112" cy="30" r="3"/>
      <line x1="100" y1="48" x2="100" y2="110"/>
      <line x1="100" y1="110" x2="90" y2="170"/>
      <line x1="100" y1="110" x2="110" y2="170"/>
      <rect x="93" y="112" width="14" height="12" rx="2"/>
      <circle class="fig-joint fig-hi" cx="100" cy="34" r="6"/>
    </g>
  ` },
  pullup_close_grip: { kind: 'dynamic', caption: 'Vorderansicht, enger Untergriff an der Stange · Körper zieht sich hoch, bis das Kinn über die Stange kommt', svg: `
    <line class="fig-rig" x1="70" y1="20" x2="130" y2="20"/>
    <circle class="fig-joint" cx="100" cy="58" r="5"/>
    <path class="fig-motion" d="M100,150 L100,90"/>
    <polygon class="fig-arrow" points="100,85 94,97 106,97"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="88" y1="20" x2="96" y2="58"/>
      <line x1="112" y1="20" x2="104" y2="58"/>
      <circle cx="100" cy="80" r="14"/>
      <circle cx="112" cy="80" r="3"/>
      <line x1="100" y1="94" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="110" y2="196"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="88" y1="20" x2="94" y2="40"/>
      <line x1="112" y1="20" x2="106" y2="40"/>
      <circle cx="100" cy="34" r="14"/>
      <circle cx="112" cy="30" r="3"/>
      <line x1="100" y1="48" x2="100" y2="110"/>
      <line x1="100" y1="110" x2="90" y2="170"/>
      <line x1="100" y1="110" x2="110" y2="170"/>
      <circle class="fig-joint fig-hi" cx="100" cy="34" r="6"/>
    </g>
  ` },
  lat_pulldown: { kind: 'dynamic', caption: 'Vorderansicht, sitzend am Latzug · Stange kommt von oben gestreckt bis zur oberen Brust herunter', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="40"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="78" r="5"/>
    <path class="fig-motion" d="M60,45 Q99,70 138,45"/>
    <polygon class="fig-arrow" points="60,45 68,42 66,52"/>
    <polygon class="fig-arrow" points="138,45 130,42 132,52"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="65" y2="42"/>
      <line x1="99" y1="78" x2="133" y2="42"/>
      <circle class="fig-joint fig-hi" cx="65" cy="42" r="5"/>
      <circle class="fig-joint fig-hi" cx="133" cy="42" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="70" y2="100"/>
      <line x1="99" y1="78" x2="128" y2="100"/>
      <circle class="fig-joint fig-hi" cx="70" cy="100" r="5"/>
      <circle class="fig-joint fig-hi" cx="128" cy="100" r="5"/>
    </g>
  ` },
  lat_pulldown_wide: { kind: 'dynamic', caption: 'Vorderansicht, sitzend, sehr breiter Obergriff · Stange kommt von weit aussen oben zur oberen Brust herunter', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="40"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="78" r="5"/>
    <path class="fig-motion" d="M50,42 Q99,70 148,42"/>
    <polygon class="fig-arrow" points="50,42 58,40 57,50"/>
    <polygon class="fig-arrow" points="148,42 140,40 141,50"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="55" y2="40"/>
      <line x1="99" y1="78" x2="143" y2="40"/>
      <circle class="fig-joint fig-hi" cx="55" cy="40" r="5"/>
      <circle class="fig-joint fig-hi" cx="143" cy="40" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="70" y2="100"/>
      <line x1="99" y1="78" x2="128" y2="100"/>
      <circle class="fig-joint fig-hi" cx="70" cy="100" r="5"/>
      <circle class="fig-joint fig-hi" cx="128" cy="100" r="5"/>
    </g>
  ` },
  lat_pulldown_single: { kind: 'dynamic', caption: 'Vorderansicht, sitzend, einarmig · Griff kommt gestreckt von oben zur Hüfte herunter, Oberkörper bleibt stabil', svg: `
    <line class="fig-rig" x1="130" y1="8" x2="130" y2="40"/>
    <circle class="fig-rig-dot" cx="130" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="85" y2="196"/>
      <line x1="99" y1="140" x2="115" y2="196"/>
      <line x1="99" y1="90" x2="80" y2="120"/>
    </g>
    <circle class="fig-joint" cx="99" cy="78" r="5"/>
    <path class="fig-motion" d="M155,45 Q135,70 118,95"/>
    <polygon class="fig-arrow" points="118,95 120,84 128,90"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="155" y2="42"/>
      <circle class="fig-joint fig-hi" cx="155" cy="42" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="78" x2="118" y2="98"/>
      <circle class="fig-joint fig-hi" cx="118" cy="98" r="5"/>
    </g>
  ` },
  straight_arm_pulldown: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug · gestreckte Arme drücken von Schulterhöhe kontrolliert zu den Oberschenkeln', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="35"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="50" r="14"/>
      <line x1="97" y1="64" x2="99" y2="140"/>
      <line x1="99" y1="140" x2="86" y2="196"/>
      <line x1="99" y1="140" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M99,45 Q99,90 99,120"/>
    <polygon class="fig-arrow" points="99,124 93,112 105,112"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="90" y2="35"/>
      <circle class="fig-joint fig-hi" cx="90" cy="35" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="100" y2="130"/>
      <circle class="fig-joint fig-hi" cx="100" cy="130" r="5"/>
    </g>
  ` },
  row_cable: { kind: 'dynamic', caption: 'Seitenansicht, aufrecht sitzend am Kabelzug · Griff kommt gestreckt bis zum Bauch heran, Ellbogen nah am Körper', svg: `
    <line class="fig-rig" x1="180" y1="90" x2="180" y2="110"/>
    <circle class="fig-rig-dot" cx="180" cy="100" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="60" r="14"/>
      <line x1="99" y1="74" x2="99" y2="130"/>
      <line x1="99" y1="130" x2="85" y2="150"/>
      <line x1="85" y1="150" x2="85" y2="196"/>
      <line x1="99" y1="130" x2="115" y2="150"/>
      <line x1="115" y1="150" x2="115" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="90" r="5"/>
    <path class="fig-motion" d="M160,100 L110,100"/>
    <polygon class="fig-arrow" points="110,100 120,94 120,106"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="90" x2="165" y2="100"/>
      <circle class="fig-joint fig-hi" cx="165" cy="100" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="90" x2="115" y2="105"/>
      <circle class="fig-joint fig-hi" cx="115" cy="105" r="5"/>
    </g>
  ` },
  row_barbell: { kind: 'dynamic', caption: 'Seitenansicht, Oberkörper vorgebeugt · Stange zieht gestreckt von unten zum Bauch heran', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="140" cy="80" r="14"/>
      <circle cx="150" cy="86" r="3"/>
      <line x1="130" y1="90" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="120" y2="196"/>
    </g>
    <circle class="fig-joint" cx="120" cy="100" r="5"/>
    <path class="fig-motion" d="M60,170 L60,120"/>
    <polygon class="fig-arrow" points="60,115 54,127 66,127"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="60" y2="175"/>
      <circle class="fig-joint fig-hi" cx="60" cy="175" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="95" y2="140"/>
      <circle class="fig-joint fig-hi" cx="95" cy="140" r="5.5"/>
    </g>
  ` },
  t_bar_row: { kind: 'dynamic', caption: 'Seitenansicht, Oberkörper vorgebeugt, T-Bar-Griff · Griff zieht von unten zum Bauch heran, Rücken bleibt gerade', svg: `
    <line class="fig-rig" x1="10" y1="196" x2="190" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="140" cy="80" r="14"/>
      <circle cx="150" cy="86" r="3"/>
      <line x1="130" y1="90" x2="100" y2="150"/>
      <line x1="100" y1="150" x2="90" y2="196"/>
      <line x1="100" y1="150" x2="120" y2="196"/>
    </g>
    <circle class="fig-joint" cx="120" cy="100" r="5"/>
    <path class="fig-motion" d="M75,165 L95,135"/>
    <polygon class="fig-arrow" points="95,135 84,136 90,146"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="70" y2="170"/>
      <circle class="fig-joint fig-hi" cx="70" cy="170" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="120" y1="100" x2="98" y2="138"/>
      <circle class="fig-joint fig-hi" cx="98" cy="138" r="5.5"/>
    </g>
  ` },
  bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Bank · Stange senkt sich zur Brust ab und wird gerade nach oben gedrückt', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M90,110 L90,60"/>
    <polygon class="fig-arrow" points="90,55 84,67 96,67"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="90" y2="110"/>
      <circle class="fig-joint fig-hi" cx="90" cy="110" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="90" y2="60"/>
      <circle class="fig-joint fig-hi" cx="90" cy="60" r="5.5"/>
    </g>
  ` },
  incline_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Schrägbank (ca. 30°) · Stange senkt sich zur oberen Brust ab und wird nach oben gedrückt', svg: `
    <line class="fig-rig" x1="30" y1="185" x2="150" y2="95"/>
    <g class="fig-pose fig-fixed">
      <circle cx="40" cy="165" r="13"/>
      <circle cx="46" cy="155" r="3"/>
      <line x1="50" y1="160" x2="140" y2="110"/>
      <line x1="140" y1="110" x2="160" y2="125"/>
      <line x1="140" y1="110" x2="150" y2="90"/>
    </g>
    <circle class="fig-joint" cx="95" cy="135" r="5"/>
    <path class="fig-motion" d="M95,105 L95,55"/>
    <polygon class="fig-arrow" points="95,50 89,62 101,62"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="95" y1="135" x2="95" y2="105"/>
      <circle class="fig-joint fig-hi" cx="95" cy="105" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="95" y1="135" x2="95" y2="55"/>
      <circle class="fig-joint fig-hi" cx="95" cy="55" r="5.5"/>
    </g>
  ` },
  decline_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Negativbank (Kopf tiefer) · Stange senkt sich zur unteren Brust ab und wird nach oben gedrückt', svg: `
    <line class="fig-rig" x1="150" y1="185" x2="30" y2="95"/>
    <g class="fig-pose fig-fixed">
      <circle cx="140" cy="165" r="13"/>
      <circle cx="146" cy="155" r="3"/>
      <line x1="150" y1="160" x2="60" y2="110"/>
      <line x1="60" y1="110" x2="40" y2="125"/>
      <line x1="60" y1="110" x2="50" y2="90"/>
    </g>
    <circle class="fig-joint" cx="105" cy="135" r="5"/>
    <path class="fig-motion" d="M105,105 L105,55"/>
    <polygon class="fig-arrow" points="105,50 99,62 111,62"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="105" y1="135" x2="105" y2="105"/>
      <circle class="fig-joint fig-hi" cx="105" cy="105" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="105" y1="135" x2="105" y2="55"/>
      <circle class="fig-joint fig-hi" cx="105" cy="55" r="5.5"/>
    </g>
  ` },
  dumbbell_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Bank · Kurzhanteln senken sich zur Brust ab und werden gerade nach oben gedrückt', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M80,110 L80,60"/>
    <polygon class="fig-arrow" points="80,55 74,67 86,67"/>
    <path class="fig-motion" d="M100,110 L100,60"/>
    <polygon class="fig-arrow" points="100,55 94,67 106,67"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="80" y2="110"/>
      <line x1="90" y1="140" x2="100" y2="110"/>
      <circle class="fig-joint fig-hi" cx="80" cy="110" r="5"/>
      <circle class="fig-joint fig-hi" cx="100" cy="110" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="80" y2="60"/>
      <line x1="90" y1="140" x2="100" y2="60"/>
      <circle class="fig-joint fig-hi" cx="80" cy="60" r="5"/>
      <circle class="fig-joint fig-hi" cx="100" cy="60" r="5"/>
    </g>
  ` },
  ohp: { kind: 'dynamic', caption: 'Vorderansicht, stehend oder sitzend · Stange bzw. Hanteln drücken von Schulterhöhe gerade nach oben', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M99,95 L99,45"/>
    <polygon class="fig-arrow" points="99,40 93,52 105,52"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="90" y2="95"/>
      <line x1="99" y1="70" x2="108" y2="95"/>
      <circle class="fig-joint fig-hi" cx="90" cy="95" r="5"/>
      <circle class="fig-joint fig-hi" cx="108" cy="95" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="70" x2="85" y2="30"/>
      <line x1="99" y1="70" x2="113" y2="30"/>
      <circle class="fig-joint fig-hi" cx="85" cy="30" r="5"/>
      <circle class="fig-joint fig-hi" cx="113" cy="30" r="5"/>
    </g>
  ` },
  butterfly: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Arme führen von aussen kommend vor der Brust zusammen', svg: `
    <line class="fig-rig" x1="99" y1="196" x2="99" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="85" r="5"/>
    <path class="fig-motion" d="M60,80 L99,95"/>
    <polygon class="fig-arrow" points="99,95 90,90 90,100"/>
    <path class="fig-motion" d="M138,80 L99,95"/>
    <polygon class="fig-arrow" points="99,95 108,90 108,100"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="55" y2="75"/>
      <line x1="99" y1="85" x2="143" y2="75"/>
      <circle class="fig-joint fig-hi" cx="55" cy="75" r="5"/>
      <circle class="fig-joint fig-hi" cx="143" cy="75" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="90" y2="95"/>
      <line x1="99" y1="85" x2="108" y2="95"/>
      <circle class="fig-joint fig-hi" cx="90" cy="95" r="5"/>
      <circle class="fig-joint fig-hi" cx="108" cy="95" r="5"/>
    </g>
  ` },
  triceps_extension: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug, Ellbogen am Körper fixiert · Unterarm streckt sich von oben nach unten', svg: `
    <line class="fig-rig" x1="99" y1="8" x2="99" y2="35"/>
    <circle class="fig-rig-dot" cx="99" cy="20" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="45" r="15"/>
      <line x1="97" y1="63" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="70" x2="105" y2="105"/>
    </g>
    <circle class="fig-joint" cx="105" cy="105" r="5"/>
    <path class="fig-motion" d="M105,60 L105,95"/>
    <polygon class="fig-arrow" points="105,100 99,88 111,88"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="105" y1="105" x2="112" y2="65"/>
      <circle class="fig-joint fig-hi" cx="112" cy="65" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="105" y1="105" x2="112" y2="145"/>
      <circle class="fig-joint fig-hi" cx="112" cy="145" r="5"/>
    </g>
  ` },
  dumbbell_flyes: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage auf der Bank · Arme leicht gebeugt seitlich absenken, dann in einem Bogen über der Brust zusammenführen', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M50,120 Q70,90 88,75"/>
    <polygon class="fig-arrow" points="88,75 76,74 80,84"/>
    <path class="fig-motion" d="M130,120 Q110,90 92,75"/>
    <polygon class="fig-arrow" points="92,75 104,74 100,84"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="90" y1="140" x2="45" y2="115"/>
      <line x1="90" y1="140" x2="135" y2="115"/>
      <circle class="fig-joint fig-hi" cx="45" cy="115" r="5"/>
      <circle class="fig-joint fig-hi" cx="135" cy="115" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="90" y1="140" x2="85" y2="70"/>
      <line x1="90" y1="140" x2="95" y2="70"/>
      <circle class="fig-joint fig-hi" cx="85" cy="70" r="5"/>
      <circle class="fig-joint fig-hi" cx="95" cy="70" r="5"/>
    </g>
  ` },
  cable_crossover: { kind: 'dynamic', caption: 'Vorderansicht, Kabel von oben aussen kommend · Arme führen die Griffe vor dem Körper nach unten zusammen', svg: `
    <line class="fig-rig" x1="10" y1="20" x2="10" y2="60"/>
    <circle class="fig-rig-dot" cx="10" cy="40" r="6"/>
    <line class="fig-rig" x1="188" y1="20" x2="188" y2="60"/>
    <circle class="fig-rig-dot" cx="188" cy="40" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="30" y2="45"/>
      <line x1="99" y1="70" x2="168" y2="45"/>
      <circle class="fig-joint fig-hi" cx="30" cy="45" r="5"/>
      <circle class="fig-joint fig-hi" cx="168" cy="45" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="70" x2="85" y2="105"/>
      <line x1="99" y1="70" x2="113" y2="105"/>
      <circle class="fig-joint fig-hi" cx="85" cy="105" r="5"/>
      <circle class="fig-joint fig-hi" cx="113" cy="105" r="5"/>
    </g>
  ` },
  dumbbell_pullover: { kind: 'dynamic', caption: 'Seitenansicht, quer zur Bank liegend · gestreckte Arme senken die Hantel hinter den Kopf ab und ziehen sie zur Brust zurück', svg: `
    <line class="fig-rig" x1="70" y1="150" x2="130" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="99" cy="130" r="14"/>
      <line x1="99" y1="144" x2="99" y2="150"/>
      <line x1="99" y1="150" x2="80" y2="150"/>
      <line x1="80" y1="150" x2="70" y2="170"/>
      <line x1="99" y1="150" x2="120" y2="150"/>
      <line x1="120" y1="150" x2="130" y2="170"/>
    </g>
    <circle class="fig-joint" cx="99" cy="105" r="5"/>
    <path class="fig-motion" d="M99,180 L99,110"/>
    <polygon class="fig-arrow" points="99,105 93,117 105,117"/>
    <g class="fig-pose fig-a" style="animation-duration:2s;">
      <line x1="99" y1="105" x2="99" y2="185"/>
      <circle class="fig-joint fig-hi" cx="99" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:2s;">
      <line x1="99" y1="105" x2="99" y2="60"/>
      <circle class="fig-joint fig-hi" cx="99" cy="60" r="5.5"/>
    </g>
  ` },
  pullover_machine: { kind: 'dynamic', caption: 'Seitenansicht, sitzend an der Maschine · Arme ziehen von oben nach unten vor dem Körper, Ellbogen leicht gebeugt', svg: `
    <line class="fig-rig" x1="99" y1="196" x2="99" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="80" r="5"/>
    <path class="fig-motion" d="M99,50 L99,110"/>
    <polygon class="fig-arrow" points="99,115 93,103 105,103"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="80" x2="99" y2="35"/>
      <circle class="fig-joint fig-hi" cx="99" cy="35" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="80" x2="99" y2="125"/>
      <circle class="fig-joint fig-hi" cx="99" cy="125" r="5"/>
    </g>
  ` },
  bicep_curl_dumbbell: { kind: 'dynamic', caption: 'Seitenansicht, Oberarm fixiert am Körper · Hantel curlt zur Schulter hoch und senkt sich kontrolliert wieder ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="103" y2="105"/>
    </g>
    <circle class="fig-joint" cx="103" cy="105" r="5"/>
    <path class="fig-motion" d="M115,150 Q125,120 112,90"/>
    <polygon class="fig-arrow" points="108,85 108,96 118,92"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="103" y1="105" x2="118" y2="150"/>
      <circle class="fig-joint fig-hi" cx="118" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="103" y1="105" x2="112" y2="70"/>
      <circle class="fig-joint fig-hi" cx="112" cy="70" r="5"/>
    </g>
  ` },
  bicep_curl_barbell: { kind: 'dynamic', caption: 'Vorderansicht, schulterbreiter Griff · Stange curlt gestreckt am Körper entlang nach oben und senkt sich kontrolliert ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="80" y2="105"/>
      <line x1="99" y1="66" x2="118" y2="105"/>
    </g>
    <circle class="fig-joint" cx="80" cy="105" r="5"/>
    <circle class="fig-joint" cx="118" cy="105" r="5"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="80" y1="105" x2="75" y2="150"/>
      <line x1="118" y1="105" x2="123" y2="150"/>
      <circle class="fig-joint fig-hi" cx="75" cy="150" r="5"/>
      <circle class="fig-joint fig-hi" cx="123" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="80" y1="105" x2="88" y2="65"/>
      <line x1="118" y1="105" x2="110" y2="65"/>
      <circle class="fig-joint fig-hi" cx="88" cy="65" r="5"/>
      <circle class="fig-joint fig-hi" cx="110" cy="65" r="5"/>
    </g>
  ` },
  hammer_curl: { kind: 'dynamic', caption: 'Seitenansicht, neutraler Griff (Handflächen zueinander), Oberarm fixiert · Hantel curlt zur Schulter hoch und senkt sich kontrolliert ab', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="66" x2="95" y2="105"/>
    </g>
    <circle class="fig-joint" cx="95" cy="105" r="5"/>
    <path class="fig-motion" d="M85,150 Q75,120 88,90"/>
    <polygon class="fig-arrow" points="92,85 92,96 82,92"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="95" y1="105" x2="80" y2="150"/>
      <circle class="fig-joint fig-hi" cx="80" cy="150" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="95" y1="105" x2="86" y2="70"/>
      <circle class="fig-joint fig-hi" cx="86" cy="70" r="5"/>
    </g>
  ` },
  cable_curl: { kind: 'dynamic', caption: 'Seitenansicht, stehend am Kabelzug, Ellbogen fixiert · Griff curlt gestreckt von unten zur Schulter hoch', svg: `
    <line class="fig-rig" x1="99" y1="180" x2="99" y2="196"/>
    <circle class="fig-rig-dot" cx="99" cy="188" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="70" r="5"/>
    <path class="fig-motion" d="M99,160 L99,100"/>
    <polygon class="fig-arrow" points="99,95 93,107 105,107"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="99" y1="70" x2="99" y2="165"/>
      <circle class="fig-joint fig-hi" cx="99" cy="165" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="99" y1="70" x2="99" y2="95"/>
      <circle class="fig-joint fig-hi" cx="99" cy="95" r="5"/>
    </g>
  ` },
  close_grip_bench_press: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, enger Griff · Stange senkt sich zur unteren Brust ab, Ellbogen bleiben nah am Körper', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
    </g>
    <circle class="fig-joint" cx="90" cy="140" r="5"/>
    <path class="fig-motion" d="M90,110 L90,60"/>
    <polygon class="fig-arrow" points="90,55 84,67 96,67"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="85" y2="112"/>
      <line x1="90" y1="140" x2="95" y2="112"/>
      <circle class="fig-joint fig-hi" cx="85" cy="112" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="95" cy="112" r="4.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="90" y1="140" x2="85" y2="60"/>
      <line x1="90" y1="140" x2="95" y2="60"/>
      <circle class="fig-joint fig-hi" cx="85" cy="60" r="4.5"/>
      <circle class="fig-joint fig-hi" cx="95" cy="60" r="4.5"/>
    </g>
  ` },
  skull_crusher: { kind: 'dynamic', caption: 'Seitenansicht, Rückenlage, Oberarm senkrecht fixiert · Unterarm senkt die Stange Richtung Stirn ab und streckt sie wieder nach oben', svg: `
    <line class="fig-rig" x1="20" y1="150" x2="150" y2="150"/>
    <g class="fig-pose fig-fixed">
      <circle cx="35" cy="140" r="13"/>
      <circle cx="38" cy="130" r="3"/>
      <line x1="46" y1="146" x2="140" y2="150"/>
      <line x1="140" y1="150" x2="160" y2="130"/>
      <line x1="140" y1="150" x2="150" y2="175"/>
      <line x1="90" y1="140" x2="90" y2="95"/>
    </g>
    <circle class="fig-joint" cx="90" cy="95" r="5"/>
    <path class="fig-motion" d="M75,120 L88,90"/>
    <polygon class="fig-arrow" points="88,90 78,90 84,100"/>
    <g class="fig-pose fig-a" style="animation-duration:1.7s;">
      <line x1="90" y1="95" x2="70" y2="125"/>
      <circle class="fig-joint fig-hi" cx="70" cy="125" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.7s;">
      <line x1="90" y1="95" x2="90" y2="55"/>
      <circle class="fig-joint fig-hi" cx="90" cy="55" r="5"/>
    </g>
  ` },
  lateral_raise: { kind: 'dynamic', caption: 'Vorderansicht, stehend · Arme leicht gebeugt seitlich bis Schulterhöhe anheben, kontrolliert absenken', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <path class="fig-motion" d="M108,130 Q100,90 68,68"/>
    <polygon class="fig-arrow" points="62,65 72,64 70,75"/>
    <path class="fig-motion" d="M90,130 Q98,90 130,68"/>
    <polygon class="fig-arrow" points="136,65 126,64 128,75"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="105" y2="130"/>
      <line x1="99" y1="65" x2="93" y2="130"/>
      <circle class="fig-joint fig-hi" cx="105" cy="130" r="5"/>
      <circle class="fig-joint fig-hi" cx="93" cy="130" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="60" y2="60"/>
      <line x1="99" y1="65" x2="138" y2="60"/>
      <circle class="fig-joint fig-hi" cx="60" cy="60" r="5"/>
      <circle class="fig-joint fig-hi" cx="138" cy="60" r="5"/>
    </g>
  ` },
  front_raise: { kind: 'dynamic', caption: 'Seitenansicht, stehend · Hantel(n) mit leicht gebeugten Armen nach vorne bis Schulterhöhe anheben, kontrolliert absenken', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <path class="fig-motion" d="M99,130 Q99,90 99,70"/>
    <polygon class="fig-arrow" points="99,65 93,77 105,77"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="102" y2="130"/>
      <circle class="fig-joint fig-hi" cx="102" cy="130" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="145" y2="60"/>
      <circle class="fig-joint fig-hi" cx="145" cy="60" r="5"/>
    </g>
  ` },
  wrist_curl: { kind: 'dynamic', caption: 'Seitenansicht, Unterarm aufgelegt, Handfläche nach oben · Handgelenk beugt und streckt sich', svg: `
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <circle cx="110" cy="40" r="3"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
      <line x1="99" y1="68" x2="140" y2="100"/>
      <line x1="140" y1="100" x2="165" y2="100"/>
    </g>
    <circle class="fig-joint" cx="165" cy="100" r="5"/>
    <path class="fig-motion" d="M178,118 L178,88"/>
    <polygon class="fig-arrow" points="178,84 172,95 184,95"/>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="165" y1="100" x2="180" y2="115"/>
      <circle class="fig-joint fig-hi" cx="180" cy="115" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="165" y1="100" x2="180" y2="85"/>
      <circle class="fig-joint fig-hi" cx="180" cy="85" r="5"/>
    </g>
  ` },
  reverse_butterfly: { kind: 'dynamic', caption: 'Vorderansicht, sitzend an der Maschine · Arme öffnen sich nach hinten, Schulterblätter ziehen zusammen', svg: `
    <line class="fig-rig" x1="99" y1="150" x2="99" y2="196"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="55" r="14"/>
      <line x1="97" y1="69" x2="99" y2="140"/>
    </g>
    <circle class="fig-joint" cx="99" cy="85" r="5"/>
    <path class="fig-motion" d="M99,95 L60,80"/>
    <polygon class="fig-arrow" points="60,80 68,78 66,88"/>
    <path class="fig-motion" d="M99,95 L138,80"/>
    <polygon class="fig-arrow" points="138,80 130,78 132,88"/>
    <g class="fig-pose fig-a" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="90" y2="95"/>
      <line x1="99" y1="85" x2="108" y2="95"/>
      <circle class="fig-joint fig-hi" cx="90" cy="95" r="5"/>
      <circle class="fig-joint fig-hi" cx="108" cy="95" r="5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.9s;">
      <line x1="99" y1="85" x2="55" y2="75"/>
      <line x1="99" y1="85" x2="143" y2="75"/>
      <circle class="fig-joint fig-hi" cx="55" cy="75" r="5"/>
      <circle class="fig-joint fig-hi" cx="143" cy="75" r="5"/>
    </g>
  ` },
  lateral_raise_cable: { kind: 'dynamic', caption: 'Vorderansicht, stehend am tiefen Kabelzug · Arm hebt seitlich mit leicht gebeugtem Ellbogen bis Schulterhöhe', svg: `
    <line class="fig-rig" x1="120" y1="185" x2="120" y2="196"/>
    <circle class="fig-rig-dot" cx="120" cy="190" r="6"/>
    <g class="fig-pose fig-fixed">
      <circle cx="97" cy="40" r="15"/>
      <line x1="97" y1="58" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <circle class="fig-joint" cx="99" cy="65" r="5"/>
    <path class="fig-motion" d="M110,140 Q100,90 60,68"/>
    <polygon class="fig-arrow" points="55,66 65,64 62,75"/>
    <g class="fig-pose fig-a" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="112" y2="130"/>
      <line x1="112" y1="130" x2="118" y2="185"/>
      <circle class="fig-joint fig-hi" cx="118" cy="185" r="5.5"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.8s;">
      <line x1="99" y1="65" x2="55" y2="60"/>
      <circle class="fig-joint fig-hi" cx="55" cy="60" r="5.5"/>
    </g>
  ` },
};

/* Jedes Strichmännchen bekommt eine kurze Bildunterschrift, die Blickwinkel,
   Ausgangsstellung und Bewegungsrichtung in Worten festhält — bei so
   abstrakten Linienfiguren ist "vorne/hinten", "wie steht man zum Boden"
   und "geht's nach innen/aussen bzw. hoch/runter" per Bild allein nicht
   immer eindeutig, ein Satz Text macht es das aber zuverlässig. */
function exerciseFigureSvg(exerciseId) {
  const fig = EXERCISE_FIGURES[exerciseId];
  if (!fig) return `<div class="ex-figure-emoji">💪</div>`;
  const svg = `<svg viewBox="0 0 200 200" class="ex-figure ${fig.kind === 'static' ? 'fig-static' : ''}">${fig.svg}</svg>`;
  return fig.caption ? `${svg}<div class="ex-figure-caption">${esc(fig.caption)}</div>` : svg;
}

/* ---------- Zielmuskeln-Übersicht ----------
   Ein einziges, wiederverwendbares Körper-Umriss-SVG (vorne links, hinten
   rechts) mit fest definierten Zonen — pro Übung wird nur die Klasse
   (primary/secondary/inaktiv) der jeweiligen Zone umgeschaltet, das
   Bild selbst bleibt immer dasselbe. Positionen sind bewusst schematisch
   (Rechtecke/Ellipsen wie bei den Strichmännchen), keine anatomische
   Illustration. */
/* Anatomische Zonen (Beta): Vorderansicht links, Rückansicht rechts
   (um 125 nach rechts verschoben). Jede Zone ist ein Pfad, links und
   rechts gespiegelt; die Form orientiert sich grob am echten Muskel statt
   an Rechtecken. BODY_BASE_SVG ist der dunkle Körperumriss darunter,
   BODY_DECO_SVG feine Linien darüber (nicht antippbar). */
const BACK = (d) => `<path transform="translate(125 0)" d="${d}"/>`;
const FRONT = (d) => `<path d="${d}"/>`;
const MUSCLE_ZONES_SVG = {
  neck_traps: FRONT('M55 38 Q48 43 41 46 Q46 49 52 47 Q56 44 56 40 Z M65 38 Q72 43 79 46 Q74 49 68 47 Q64 44 64 40 Z'),
  shoulders: FRONT('M38 47 Q28 49 26 62 Q31 66 36 62 Q40 56 40 50 Z M82 47 Q92 49 94 62 Q89 66 84 62 Q80 56 80 50 Z'),
  chest: FRONT('M59 50 Q48 48 41 52 Q38 62 42 70 Q52 74 59 70 Z M61 50 Q72 48 79 52 Q82 62 78 70 Q68 74 61 70 Z'),
  biceps: FRONT('M34 66 Q27 70 26 82 Q27 90 31 92 Q35 84 36 72 Z M86 66 Q93 70 94 82 Q93 90 89 92 Q85 84 84 72 Z'),
  forearms_front: FRONT('M29 96 Q23 106 21 122 Q23 126 26 124 Q30 110 33 98 Z M91 96 Q97 106 99 122 Q97 126 94 124 Q90 110 87 98 Z'),
  abs: FRONT('M53 74 L67 74 Q68 96 66 116 Q60 120 54 116 Q52 96 53 74 Z'),
  obliques: FRONT('M42 74 Q41 90 44 110 Q48 114 51 112 Q50 92 51 76 Z M78 74 Q79 90 76 110 Q72 114 69 112 Q70 92 69 76 Z'),
  quads: FRONT('M44 124 Q38 148 42 174 Q47 180 53 177 Q58 152 58 128 Q52 122 44 124 Z M76 124 Q82 148 78 174 Q73 180 67 177 Q62 152 62 128 Q68 122 76 124 Z'),
  shins: FRONT('M43 190 Q40 210 43 232 Q46 236 49 234 Q52 212 51 192 Z M77 190 Q80 210 77 232 Q74 236 71 234 Q68 212 69 192 Z'),
  traps: BACK('M60 36 Q52 42 44 48 Q52 58 60 66 Z M60 36 Q68 42 76 48 Q68 58 60 66 Z'),
  rear_delts: BACK('M38 47 Q28 49 26 62 Q31 66 36 62 Q40 56 40 50 Z M82 47 Q92 49 94 62 Q89 66 84 62 Q80 56 80 50 Z'),
  lats: BACK('M58 66 Q48 58 42 58 Q40 74 45 96 Q52 102 58 98 Z M62 66 Q72 58 78 58 Q80 74 75 96 Q68 102 62 98 Z'),
  triceps: BACK('M34 66 Q27 70 26 82 Q27 90 31 92 Q35 84 36 72 Z M86 66 Q93 70 94 82 Q93 90 89 92 Q85 84 84 72 Z'),
  forearms_back: BACK('M29 96 Q23 106 21 122 Q23 126 26 124 Q30 110 33 98 Z M91 96 Q97 106 99 122 Q97 126 94 124 Q90 110 87 98 Z'),
  lower_back: BACK('M54 100 L66 100 L66 116 Q60 119 54 116 Z'),
  glutes: BACK('M59 118 Q47 116 42 126 Q43 140 58 140 Z M61 118 Q73 116 78 126 Q77 140 62 140 Z'),
  hamstrings: BACK('M44 144 Q39 162 42 178 Q48 182 54 178 Q57 160 57 144 Z M76 144 Q81 162 78 178 Q72 182 66 178 Q63 160 63 144 Z'),
  calves: BACK('M43 188 Q38 204 43 222 Q47 226 51 222 Q55 204 51 188 Z M77 188 Q82 204 77 222 Q73 226 69 222 Q65 204 69 188 Z'),
};
const BODY_FIGURE_BASE = `
  <ellipse cx="60" cy="20" rx="10" ry="12"/>
  <path d="M55 30 L65 30 L66 40 L54 40 Z"/>
  <path d="M40 44 Q60 38 80 44 Q84 60 80 76 L78 120 Q60 128 42 120 L40 76 Q36 60 40 44 Z"/>
  <path d="M38 48 Q26 50 24 66 L20 96 Q16 116 17 130 Q20 140 25 136 Q28 120 32 100 L37 70 Z M82 48 Q94 50 96 66 L100 96 Q104 116 103 130 Q100 140 95 136 Q92 120 88 100 L83 70 Z"/>
  <path d="M42 120 Q36 150 40 184 Q38 210 42 240 L50 244 Q54 214 53 186 Q58 152 59 124 Z M78 120 Q84 150 80 184 Q82 210 78 240 L70 244 Q66 214 67 186 Q62 152 61 124 Z"/>`;
const BODY_BASE_SVG = `<g class="body-base">${BODY_FIGURE_BASE}<g transform="translate(125 0)">${BODY_FIGURE_BASE}</g></g>`;
const BODY_DECO_SVG = '<path class="body-deco" d="M53 86 L67 86 M53 98 L67 98 M60 74 L60 116"/>';
const BODY_VIEWBOX = '0 0 245 250';

const MUSCLE_ZONE_LABEL = {
  neck_traps: 'Nacken', shoulders: 'Schultern', chest: 'Brust', biceps: 'Bizeps',
  forearms_front: 'Unterarm (Beuger)', abs: 'Bauch', obliques: 'Seitl. Bauch',
  quads: 'Quadrizeps', shins: 'Schienbein', traps: 'Trapezius', rear_delts: 'Hintere Schulter',
  lats: 'Latissimus', triceps: 'Trizeps', forearms_back: 'Unterarm (Strecker)',
  lower_back: 'Unterer Rücken', glutes: 'Gesäss', hamstrings: 'Hintere Oberschenkel', calves: 'Waden',
};

function bodyMapSvg(primary, secondary) {
  const zoneEl = (id, shape) => {
    const cls = primary.includes(id) ? 'muscle-zone primary' : secondary.includes(id) ? 'muscle-zone secondary' : 'muscle-zone';
    return `<g class="${cls}">${shape}</g>`;
  };
  const zones = Object.entries(MUSCLE_ZONES_SVG).map(([id, shape]) => zoneEl(id, shape)).join('');
  return `
    <svg viewBox="${BODY_VIEWBOX}" class="muscle-map">
      ${BODY_BASE_SVG}
      ${zones}
      ${BODY_DECO_SVG}
    </svg>
  `;
}

function muscleLabelsText(primary, secondary) {
  const p = primary.map((id) => MUSCLE_ZONE_LABEL[id] || id);
  const s = secondary.map((id) => MUSCLE_ZONE_LABEL[id] || id);
  if (!p.length && !s.length) return '';
  return s.length ? `${p.join(', ')} (+ ${s.join(', ')})` : p.join(', ');
}

/* "Info"-Aufklapper bei Freestyle/Plan-Ausführung: zeigt, was bei dieser
   Übung wirklich zuverlässig bekannt ist (Zielmuskeln, gleicher Körper-
   Umriss wie beim Fingerboard-Checkin) — bewusst keine selbst erfundenen
   Ausführungshinweise, die im Zweifel falsch/gefährlich wären. */
function fsExerciseInfoHtml(exerciseId) {
  const muscles = exerciseMuscles(exerciseId);
  const text = muscleLabelsText(muscles.primary, muscles.secondary);
  const howTo = exerciseHowTo(exerciseId);
  return `
    <div class="fb-muscle-block">
      ${howTo ? `<div class="ex-howto">${esc(howTo)}</div>` : ''}
      ${text ? bodyMapSvg(muscles.primary, muscles.secondary) : ''}
      ${text ? `<div class="fb-muscle-label mono">${esc(text)}</div>` : ''}
    </div>
  `;
}

/* Maschineneinstellungen (Sitzhöhe, ROM, Pin-Position...) braucht man JEDES
   Mal an derselben Maschine wieder — anders als Ausführung/Zielmuskeln (die
   man höchstens einmal nachschaut) gehört das direkt sichtbar zur aktiven
   Übung, nicht hinter dem ℹ-Umschalter versteckt. Wert kommt automatisch
   vom letzten Mal, da er dauerhaft pro Übung in exerciseSettings liegt.
   Standardmässig nur als kompakter Text angezeigt (nicht als leeres,
   mehrzeiliges Eingabefeld, das viel Platz frisst, auch wenn nichts oder
   nur ein kurzer Satz drinsteht) — erst der ✎-Button schaltet auf ein
   echtes, fokussiertes Textfeld um; nur EINE Übung ist je aktiv, daher
   reicht ein einzelnes modul-globales Flag statt einem pro Übung. */
let fsNoteEditing = false;

/* Kurze Trend-Übersicht direkt nach "Fertig & Speichern" — {name, symbol,
   cls} pro geloggter Übung dieser Session, bevor der Screen wieder in den
   normalen (leeren) Zustand zurückspringt. null = keine Übersicht aktiv. */
let fsRecap = null;
function fsMachineNoteHtml(exerciseId) {
  const note = exerciseSettings[exerciseId] || '';
  if (!fsNoteEditing) {
    return `
      <div class="fs-machine-note-view">
        <span class="fs-machine-note-text">${note ? esc(note) : 'Keine Maschineneinstellungen notiert.'}</span>
        <button type="button" class="ex-row-remove" id="fs-machine-note-edit" title="Maschineneinstellungen bearbeiten">✎</button>
      </div>
    `;
  }
  return `
    <div class="field fs-machine-note">
      <label>Maschineneinstellungen (optional)</label>
      <textarea data-machine-note="${exerciseId}" id="fs-machine-note-input" placeholder="z. B. Sitz Stufe 4, ROM oben eingeschränkt…">${esc(note)}</textarea>
    </div>
  `;
}

/* Kleines, unverzerrtes Board-Abbild mit einem Punkt an der Griffposition —
   zeigt auf einen Blick, welcher Griff für diesen Hang-Satz gemeint ist. */
function miniBoardThumb(boardId, gripId, gripId2) {
  const board = BOARDS[boardId];
  // Manche Griffe haben zwei Löcher (links + rechts gespiegelt) — beide
  // markieren, sonst ist bei einem grossen Punkt in der Mitte nicht
  // erkennbar, welches der beiden Löcher gemeint ist. gripId2 (optional):
  // zweiter, andersfarbig markierter Griff für Sätze mit unterschiedlichem
  // Griff pro Hand (siehe hangBoardThumb).
  const dots = board.hotspots
    .filter((h) => h.grip === gripId && (!gripId2 || hotspotSide(h) !== 'right'))
    .map((s) => `<span class="dot hole ${s.surface ? 'surface' : ''}" style="${holeStyle(s)}"></span>`)
    .join('');
  const dots2 = gripId2 ? board.hotspots
    .filter((h) => h.grip === gripId2 && hotspotSide(h) !== 'left')
    .map((s) => `<span class="dot dot-alt hole ${s.surface ? 'surface' : ''}" style="${holeStyle(s)}"></span>`)
    .join('') : '';
  return `<div class="timeline-thumb"><img src="${board.image}" alt="">${dots}${dots2}</div>`;
}

/* Hang-Sätze mit unterschiedlichem Griff pro Hand (b.gripLeft/gripRight
   statt einem gemeinsamen b.grip) — überall, wo bisher ein einzelner
   Griff angezeigt wurde, jetzt beide anzeigen, wenn gesetzt. */
function hangIsAsymmetric(b) { return b.gripLeft != null; }
function hangGripLabel(b) {
  return hangIsAsymmetric(b)
    ? `L: ${gripLabel(b.board, b.gripLeft)} · R: ${gripLabel(b.board, b.gripRight)}`
    : gripLabel(b.board, b.grip);
}
function hangArmNote(b) {
  return hangIsAsymmetric(b) ? '' : gripArmNote(b.board, b.grip);
}
function hangBoardThumb(b) {
  return hangIsAsymmetric(b) ? miniBoardThumb(b.board, b.gripLeft, b.gripRight) : miniBoardThumb(b.board, b.grip);
}

/* Griffblock (auch als Pinch nutzbar, über die Querseite) — anders als
   das Fingerboard kein Foto mit Hotspots, sondern ein frei benanntes
   Leisten-/Pinch-Griffstück mit definierter Fingerzahl. Strukturell sonst
   identisch zum Hang-Satz (reps/hangSec/restSec/blockRestSec, gleicher
   Sekundentimer/Ring), deshalb dieselben drei Helferfunktionen im selben
   Muster wie hangGripLabel/hangArmNote/hangBoardThumb — immer einarmig,
   da ein Griffblock nur mit einer Hand gleichzeitig gegriffen wird. */
function blockGripLabel(b) {
  return `${b.grip || 'Lifting Pin'} · ${b.fingers}-Finger`;
}
function handLabel(hand) { return hand === 'right' ? 'Rechts' : 'Links'; }
function handIcon(hand) { return hand === 'right' ? '🫱' : '🫲'; }
/* Welche Hand für die wievielte Wiederholung (0-indiziert, siehe rep-Feld
   in buildBlockSequence) dran ist — nur für Halten-Modus relevant (dort
   ist jede Wiederholung ein eigener, klar abgegrenzter Satz); im
   Wiederholungen-Modus läuft alles in einem durchgehenden Timer ohne
   Grenzen dazwischen, ein Wechsel liesse sich dort nicht sauber anzeigen. */
function blockHandForRep(b, repIndex) {
  const start = b.startHand || 'left';
  const other = start === 'left' ? 'right' : 'left';
  if (b.handMode === 'alternate') return repIndex % 2 === 0 ? start : other;
  if (b.handMode === 'block') return repIndex < Math.ceil(b.reps / 2) ? start : other;
  return start; // 'fixed' (Standard, auch bei älteren/importierten Sätzen ohne handMode)
}
/* Kurzbeschreibung des Hand-Musters ohne "einarmig,"-Präfix — fürs
   Timeline-Sub (fbBlockSub), wo schon andere, kommafreie Angaben mit " · "
   aneinandergereiht werden. */
function blockHandPatternText(b) {
  const handMode = b.handMode || 'fixed';
  const start = b.startHand || 'left';
  if (handMode === 'alternate') return `abwechselnd (${handLabel(start)} zuerst)`;
  if (handMode === 'block') {
    const other = start === 'left' ? 'right' : 'left';
    const firstCount = Math.ceil(b.reps / 2);
    return `${firstCount}× ${handLabel(start)} dann ${b.reps - firstCount}× ${handLabel(other)}`;
  }
  return handLabel(start);
}
/* Ohne activeRep: allgemeine Beschreibung des Hand-Musters (Vorschau-
   Bildschirme). MIT activeRep (nur während eines laufenden Halten-
   Arbeitsschritts übergeben): zeigt stattdessen die JETZT aktive Hand —
   genau dann will man wissen, welcher Arm dran ist, nicht das ganze
   Muster nochmal lesen müssen. */
function blockArmNote(b, activeRep) {
  if (activeRep != null) {
    const hand = blockHandForRep(b, activeRep);
    return `einarmig · ${handIcon(hand)} ${handLabel(hand)}`;
  }
  return `einarmig, ${blockHandPatternText(b)}`;
}
/* Kein Foto vorhanden (anders als beim Fingerboard) — die generische
   Hänge-Figur reicht als Vorschau-"Thumb" (klein genug, dass die
   abweichende Bewegung dort nicht ins Gewicht fällt). */
function blockThumb() {
  return `<div class="timeline-thumb fb-block-thumb">${FB_HANG_FIGURE_SVG}</div>`;
}
/* Dispatcher: an den meisten Stellen sind Hang- und Griffblock-Sätze
   austauschbar (gleicher Timer/gleiche Vorlaufzeit) — nur Titel/Figur
   unterscheiden sich, da kein Board-Foto existiert. holdBlockTitle() gibt
   bereits HTML-escapten Text zurück (Aufrufer müssen NICHT nochmal esc()
   anwenden), anders als hangGripLabel/blockGripLabel selbst. */
function isHangLikeBlock(b) { return b.type === 'hang' || b.type === 'block'; }
/* Griffblock/Lifting Pin ist wahlweise Halten (Sekundentimer, wie Hang)
   ODER Wiederholungen (heben/ablassen zählen, wie eine Fixübung) — dieser
   Dispatcher entscheidet NUR die Ablaufform (Sequenz/Checkin-Form/Ziel-
   Anzeige), unabhängig von holdBlockTitle/-Thumb/-ArmNote oben, die immer
   den Griffblock-Look zeigen, egal in welchem Modus. activeRep wird nur
   für Griffblock/Halten durchgereicht (siehe blockArmNote). */
function isRepsStyleBlock(b) { return b.type === 'exercise' || (b.type === 'block' && b.mode === 'reps'); }
function isHoldModeBlock(b) { return b.type === 'hang' || (b.type === 'block' && b.mode !== 'reps'); }
function holdBlockArmNote(b, activeRep) { return b.type === 'block' ? blockArmNote(b, activeRep) : hangArmNote(b); }
function holdBlockThumb(b) { return b.type === 'block' ? blockThumb() : hangBoardThumb(b); }
function holdBlockTitle(b) {
  if (b.type === 'block') return `Lifting Pin @ ${esc(blockGripLabel(b))}`;
  // Pro Hand unterschiedlich: gleiche Farben wie am Board (links blau,
  // rechts orange), damit sofort klar ist, welche Hand wohin gehört.
  if (hangIsAsymmetric(b)) {
    return `Hang @ <span class="hand-l">L: ${esc(gripLabel(b.board, b.gripLeft))}</span> · <span class="hand-r">R: ${esc(gripLabel(b.board, b.gripRight))}</span>`;
  }
  return `Hang @ ${esc(hangGripLabel(b))}`;
}

/* Campus-Sätze brauchen keine Foto-Hotspots wie beim Hangboard — die
   Sprossen sind durchnummeriert, deshalb reicht die Bewegung als reiner
   Zahlen-Text ("Sprosse 1→4" bzw. "Start 1 · Muster +2/-1" fürs
   Wiederholmuster, siehe fb.newCampus.moveMode). */
function campusMoveText(b) {
  return b.moveMode === 'pattern'
    ? `Start ${b.startRung} · Muster ${b.pattern.map((p) => (p > 0 ? '+' + p : String(p))).join('/')}`
    : `Sprosse ${b.fromRung}→${b.toRung}`;
}
/* Bewegungsart als Symbol statt Text, damit man's mitten im Training auf
   einen Blick erkennt, ohne lesen zu müssen: 🙌 beide Hände gleichzeitig,
   🔄/🔃 wechselseitig (nachziehen bzw. überspringen) mit 🫲/🫱 für die
   Starthand. Fehlt armMode (ältere Sätze/Importe), gilt "beidarmig" als
   neutraler Standard, der dem alten Verhalten am nächsten kommt. */
function campusArmIcons(b) {
  const armMode = b.armMode || 'both';
  if (armMode === 'both') return '🙌';
  const armIcon = armMode === 'skip' ? '🔃' : '🔄';
  const handIcon = b.startHand === 'right' ? '🫱' : '🫲';
  return `${armIcon}${handIcon}`;
}
function campusLabel(b) {
  const rungs = b.rungTypeRight && b.rungTypeRight !== b.rungType
    ? `<span class="hand-l">L: ${esc(campusRungLabel(b.rungType))}</span> · <span class="hand-r">R: ${esc(campusRungLabel(b.rungTypeRight))}</span>`
    : esc(campusRungLabel(b.rungType));
  return `${campusArmIcons(b)} Campus (${rungs}) · ${esc(campusMoveText(b))}`;
}
/* Bewegungsart als Klartext statt reiner Symbol-Kombo ("🔃🫲") — musste man
   erst entschlüsseln, "Übergreifen · Links zuerst" liest sich von selbst.
   Dieselben drei Begriffe wie die Chips im Baukasten (campusArmModeLabel),
   damit Aufbau und Ausführung dieselbe Sprache sprechen. */
function campusArmModeLabel(armMode) {
  if (armMode === 'match') return 'Nachziehen';
  if (armMode === 'skip') return 'Übergreifen';
  return 'Gleichzeitig';
}
function campusArmLabelHtml(b) {
  const armMode = b.armMode || 'both';
  const handText = armMode !== 'both' ? (b.startHand === 'right' ? 'Rechts zuerst' : 'Links zuerst') : '';
  return `<div class="campus-armline"><span class="campus-armline-mode">${esc(campusArmModeLabel(armMode))}</span>${handText ? `<span class="campus-armline-hand">${esc(handText)}</span>` : ''}</div>`;
}

/* Wegpunkte einer Muster-Bewegung: Start, Ende, und jede Stelle, an der
   sich die Schrittweite ändert (Richtungswechsel eingeschlossen — der
   ändert die Schrittweite ja immer mit) — genau dort ist die konkrete
   Sprossen-Nummer wichtig. Eine Kette gleich grosser Schritte in
   gleicher Richtung braucht dazwischen keine eigene Markierung (die
   Gerade sagt "jede Sprosse" bzw. "jede N-te Sprosse" von selbst).
   WICHTIG: es zählt der Vergleich stepIn vs. stepOut, nicht nur die
   Grösse von stepIn allein — sonst fällt z. B. bei Start 2 mit Muster
   +1/+2/+1 die Sprosse 3 (stepIn=1, aber stepOut=2, also sehr wohl ein
   Wechsel) fälschlich unter den Tisch. */
function campusPatternWaypoints(b) {
  const positions = [b.startRung];
  b.pattern.forEach((step) => positions.push(positions[positions.length - 1] + step));
  const waypoints = [{ rung: positions[0] }];
  for (let i = 1; i < positions.length - 1; i++) {
    const stepIn = positions[i] - positions[i - 1];
    const stepOut = positions[i + 1] - positions[i];
    if (stepIn !== stepOut) waypoints.push({ rung: positions[i] });
  }
  waypoints.push({ rung: positions[positions.length - 1] });
  return { positions, waypoints };
}

/* Kurzer Wegtext unter der Leiter: bei gleichmässigem Schrittmuster
   (z. B. immer +2) reicht "Start 1 · Schritte von 2 · Bis 9" — bei
   wechselnder Richtung (z. B. rauf/runter) lieber jeden Wegpunkt einzeln
   ("Start 1 · Rauf bis 9 · Runter bis 4"), sonst würde die "gleichmässig"-
   Kurzform an der falschen Stelle wieder lang. */
function campusRouteStepsHtml(b) {
  const { waypoints } = campusPatternWaypoints(b);
  const uniform = b.pattern.every((s) => s === b.pattern[0]);
  const first = waypoints[0].rung;
  const last = waypoints[waypoints.length - 1].rung;
  const firstDir = waypoints.length > 1 && waypoints[1].rung < first ? 'down' : 'up';
  const rows = [];
  if (uniform && waypoints.length > 2) {
    rows.push({ dir: firstDir, html: `Start <b>Sprosse ${first}</b>` });
    rows.push({ dir: firstDir, html: `Schritte von <b>${Math.abs(b.pattern[0])}</b>` });
    rows.push({ dir: firstDir, html: `Bis <b>Sprosse ${last}</b>` });
  } else {
    waypoints.forEach((w, i) => {
      if (i === 0) { rows.push({ dir: firstDir, html: `Start <b>Sprosse ${w.rung}</b>` }); return; }
      const dir = w.rung > waypoints[i - 1].rung ? 'up' : 'down';
      rows.push({ dir, html: `${dir === 'up' ? 'Rauf' : 'Runter'} bis <b>Sprosse ${w.rung}</b>` });
    });
  }
  return rows.map((r) => `<div class="campus-route-step"><span class="campus-route-dot ${r.dir}"></span>${r.html}</div>`).join('');
}

/* Leiter-Grafik statt Zahlen-Kacheln: bildet den tatsächlichen Weg am
   Board ab (welche Sprossen, in welcher Reihenfolge), nicht nur
   abstrakte Vorzeichen — leichter in den paar Sekunden vor dem Satz zu
   merken, wenn man eh schon zum Board läuft statt aufs Handy zu schauen.
   Läufe gleicher Richtung (z. B. die ganze Aufwärtsstrecke einer Kette
   aus mehreren +2-Schritten) werden zu EINER Linie mit einer Pfeilspitze
   zusammengefasst statt einer pro Einzelschritt. Bei nur einem Lauf
   (keine Richtungsumkehr) läuft die Linie mittig, bei Richtungswechseln
   bekommt "rauf" die rechte und "runter" die linke Spur, damit sich
   überlappende Sprossen-Bereiche nicht gegenseitig verdecken. */
function campusLadderSvgMarkup(b) {
  const { positions, waypoints } = campusPatternWaypoints(b);
  const minRung = Math.min(...positions);
  const maxRung = Math.max(...positions);
  const span = maxRung - minRung;
  const topY = 24, bottomY = 196;
  const yFor = (rung) => (span === 0 ? (topY + bottomY) / 2 : bottomY - ((rung - minRung) / span) * (bottomY - topY));

  const waypointRungs = new Set(waypoints.map((w) => w.rung));
  let svg = '';
  for (let r = minRung; r <= maxRung; r++) {
    if (waypointRungs.has(r)) continue;
    const y = yFor(r).toFixed(1);
    svg += `<line x1="28" y1="${y}" x2="62" y2="${y}" stroke="var(--line)" stroke-width="2"/>`;
  }

  const runs = [];
  for (let i = 1; i < waypoints.length; i++) {
    const dir = waypoints[i].rung > waypoints[i - 1].rung ? 1 : -1;
    const last = runs[runs.length - 1];
    if (last && last.dir === dir) last.toRung = waypoints[i].rung;
    else runs.push({ dir, fromRung: waypoints[i - 1].rung, toRung: waypoints[i].rung });
  }
  const single = runs.length <= 1;
  runs.forEach((run) => {
    const x = single ? 45 : (run.dir > 0 ? 76 : 14);
    const color = run.dir > 0 ? 'var(--accent)' : 'var(--accent2)';
    const fromY = yFor(run.fromRung), toY = yFor(run.toRung);
    const lineStartY = fromY - run.dir * 4;
    const lineEndY = toY + run.dir * 8;
    const tipY = toY - run.dir * 4;
    svg += `<line x1="${x}" y1="${lineStartY.toFixed(1)}" x2="${x}" y2="${lineEndY.toFixed(1)}" stroke="${color}" stroke-width="3"/>`;
    svg += `<polygon points="${x},${tipY.toFixed(1)} ${x - 6},${lineEndY.toFixed(1)} ${x + 6},${lineEndY.toFixed(1)}" fill="${color}"/>`;
  });

  const r = waypoints.length > 6 ? 9 : 11;
  waypoints.forEach((w, i) => {
    const outDir = i < waypoints.length - 1
      ? (waypoints[i + 1].rung > w.rung ? 1 : -1)
      : (waypoints[i - 1] && waypoints[i - 1].rung > w.rung ? -1 : 1);
    const color = outDir > 0 ? 'var(--accent)' : 'var(--accent2)';
    const textColor = outDir > 0 ? '#04141c' : '#2b0a02';
    const y = yFor(w.rung).toFixed(1);
    svg += `<circle cx="45" cy="${y}" r="${r}" fill="${color}"/>`;
    svg += `<text x="45" y="${(yFor(w.rung) + r * 0.35).toFixed(1)}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-size="${r + 1}" font-weight="700" fill="${textColor}">${w.rung}</text>`;
  });

  return `<svg viewBox="0 0 90 220" class="campus-ladder-svg">${svg}</svg>`;
}

/* Ersetzt das reine Deko-Strichmännchen während des Campus-Arbeitssatzes.
   Direkt-Sätze bleiben ein kompakter Pfeil ("1→4"), Muster-Sätze bekommen
   die Leiter-Grafik + den Wegtext statt der Zahlen-Kacheln von früher. */
/* Beta: Campus-Satz als Ausschnitt des echten Boards mit der Route —
   nummerierte Sprossen, Linie dazwischen und (animate) zwei Hand-Punkte,
   die den Ablauf vorspielen: gleichzeitig, nachziehen oder übergreifen.
   Gedacht vor allem für die Pause VOR dem Satz (Überblick holen, dann zur
   Wand); während des Satzes selbst ruhig ohne Animation. */
function campusWorkFigureSvg(b, animate = true) {
  const stops = campusStopsOf(b);
  const text = stops.length === 2
    ? `<div class="campus-route-step"><span class="campus-route-dot up"></span>Start <b>Sprosse ${stops[0]}</b></div><div class="campus-route-step"><span class="campus-route-dot ${stops[1] > stops[0] ? 'up' : 'down'}"></span>${stops[1] > stops[0] ? 'Rauf' : 'Runter'} bis <b>Sprosse ${stops[1]}</b></div>`
    : campusRouteStepsHtml({ ...b, pattern: stops.slice(1).map((r, i) => r - stops[i]), startRung: stops[0] });
  return `<div class="campus-work-figure">${campusArmLabelHtml(b)}<div class="campus-anim-row">${campusRouteAnimSvg(b, animate)}<div class="campus-route">${text}</div></div></div>`;
}

/* Alle Stationen eines Campus-Satzes (Sprossennummern in Reihenfolge). */
function campusStopsOf(b) {
  if (b.moveMode !== 'pattern') return [b.fromRung, b.toRung];
  const stops = [b.startRung];
  (b.pattern || []).forEach((p) => stops.push(stops[stops.length - 1] + p));
  return stops;
}
/* Mittelpunkt einer Sprosse für eine Hand ('l'/'r') im Campus-Bild. */
function campusRungPoint(typeId, rung, hand) {
  const g = CAMPUS_GEOMETRY[typeId];
  if (!g) return null;
  const y = g.ys[Math.min(Math.max(rung, 1), g.ys.length) - 1];
  if (g.kind === 'ball') return { x: hand === 'r' ? g.cols[1] : g.cols[0], y };
  const w = g.x1 - g.x0;
  return { x: hand === 'r' ? g.x0 + w * 0.72 : g.x0 + w * 0.28, y };
}
function campusTypeXRange(typeId) {
  const g = CAMPUS_GEOMETRY[typeId];
  if (!g) return [0, CAMPUS_IMG_W];
  return g.kind === 'ball' ? [g.cols[0] - g.r, g.cols[1] + g.r] : [g.x0, g.x1];
}
/* Form einer Sprosse als SVG (Leiste = abgerundetes Rechteck, Kugel = Kreis
   pro Spalte). cls/attrs werden an jede Form gehängt. */
function campusRungShapes(typeId, rung, cls, attrs = '') {
  const g = CAMPUS_GEOMETRY[typeId];
  const y = g.ys[rung - 1];
  if (g.kind === 'ball') {
    return g.cols.map((cx, i) => `<circle class="${cls}" cx="${cx}" cy="${y}" r="${g.r + 3}" ${attrs} data-side="${i ? 'r' : 'l'}"/>`).join('');
  }
  return `<rect class="${cls}" x="${g.x0 - 3}" y="${y - g.h / 2 - 3}" width="${g.x1 - g.x0 + 6}" height="${g.h + 6}" rx="${g.h / 2 + 3}" ${attrs}/>`;
}

/* Zeitplan der Hand-Bewegungen: Liste [{t0, t1, rung}] je Hand. */
function campusHandEvents(b, stops) {
  const armMode = b.armMode || 'both';
  const lead = b.startHand === 'right' ? 'r' : 'l';
  const other = lead === 'l' ? 'r' : 'l';
  const ev = { l: [], r: [] };
  for (let i = 1; i < stops.length; i++) {
    const t = i - 1;
    if (armMode === 'both') {
      ev.l.push({ t0: t + 0.1, t1: t + 0.6, rung: stops[i] });
      ev.r.push({ t0: t + 0.1, t1: t + 0.6, rung: stops[i] });
    } else if (armMode === 'match') {
      ev[lead].push({ t0: t + 0.05, t1: t + 0.45, rung: stops[i] });
      ev[other].push({ t0: t + 0.5, t1: t + 0.9, rung: stops[i] });
    } else {
      const hand = i % 2 === 1 ? lead : other;
      ev[hand].push({ t0: t + 0.1, t1: t + 0.6, rung: stops[i] });
    }
  }
  return ev;
}

function campusRouteAnimSvg(b, animate) {
  const typeL = b.rungType;
  const typeR = b.rungTypeRight || b.rungType;
  if (!CAMPUS_GEOMETRY[typeL] || !CAMPUS_GEOMETRY[typeR]) return campusLadderSvgMarkup(b.moveMode === 'pattern' ? b : { ...b, moveMode: 'pattern', startRung: b.fromRung, pattern: [b.toRung - b.fromRung] });
  const stops = campusStopsOf(b);
  const [ax0, ax1] = campusTypeXRange(typeL);
  const [bx0, bx1] = campusTypeXRange(typeR);
  const x0 = Math.max(0, Math.min(ax0, bx0) - 40);
  const x1 = Math.max(ax1, bx1) + 90; // Platz rechts für die Nummern
  // Nur der benutzte Höhenbereich (plus eine Sprosse Luft), damit die Route
  // gross genug erscheint.
  const ysUsed = stops.flatMap((r) => [campusRungPoint(typeL, r, 'l').y, campusRungPoint(typeR, r, 'r').y]);
  const y0 = Math.max(0, Math.min(...ysUsed) - 70);
  const y1 = Math.min(CAMPUS_IMG_H, Math.max(...ysUsed) + 70);
  const types = typeL === typeR ? [typeL] : [typeL, typeR];
  const stopSet = new Set(stops);
  let shapes = '';
  types.forEach((t) => {
    for (let r = 1; r <= 10; r++) {
      if (stopSet.has(r)) shapes += campusRungShapes(t, r, 'cr-stop');
    }
  });
  // Nummern (Reihenfolge) neben den Stationen
  const labelX = Math.max(ax1, bx1) + 12;
  const labels = {};
  stops.forEach((r, i) => { (labels[r] = labels[r] || []).push(i + 1); });
  const labelSvg = Object.entries(labels).map(([r, nums]) => {
    const y = campusRungPoint(typeR, Number(r), 'r').y;
    return `<text class="cr-num" x="${labelX}" y="${y + 9}">${nums.join('·')}</text>`;
  }).join('');
  const T = Math.max(1, stops.length - 1) + 1.2;
  const dur = (T * 0.9).toFixed(2);
  const ev = campusHandEvents(b, stops);
  const handSvg = ['l', 'r'].map((hand) => {
    const type = hand === 'l' ? typeL : typeR;
    const p0 = campusRungPoint(type, stops[0], hand);
    if (!animate) return `<circle class="cr-hand ${hand}" cx="${p0.x}" cy="${p0.y}" r="17"/>`;
    const pts = [[0, stops[0]]];
    let last = stops[0];
    ev[hand].forEach((e) => { pts.push([e.t0, last], [e.t1, e.rung]); last = e.rung; });
    pts.push([T, last]);
    // keyTimes streng steigend halten
    const times = [];
    pts.forEach(([t], i) => { times.push(Math.max(t, i ? times[i - 1] + 0.001 : 0)); });
    const keyTimes = times.map((t) => Math.min(1, t / T).toFixed(4)).join(';');
    const values = pts.map(([, r]) => campusRungPoint(type, r, hand).y).join(';');
    return `<circle class="cr-hand ${hand}" cx="${p0.x}" cy="${p0.y}" r="17"><animate attributeName="cy" dur="${dur}s" repeatCount="indefinite" values="${values}" keyTimes="${keyTimes}"/></circle>`;
  }).join('');
  const lineL = stops.map((r) => { const p = campusRungPoint(typeL, r, 'l'); return `${p.x},${p.y}`; }).join(' ');
  return `
    <svg class="campus-anim" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" preserveAspectRatio="xMidYMid meet" aria-label="Route ${stops.join(' → ')}">
      <image href="${CAMPUS_BOARD_IMAGE}" x="0" y="0" width="${CAMPUS_IMG_W}" height="${CAMPUS_IMG_H}" opacity=".55"/>
      ${shapes}
      <polyline class="cr-path" points="${lineL}"/>
      ${labelSvg}
      ${handSvg}
    </svg>`;
}

/* Senkrechter Strich (zwei bei den Kugeln, da im Zickzack statt einer
   geraden Spalte angeordnet) über dem Referenzbild — zeigt sofort, welche
   Spalte im Bild dem gewählten Sprossen-Typ entspricht, ohne dass man
   raten muss. Positionen kommen aus CAMPUS_RUNG_TYPES (lineX/lineX2, %
   der Bildbreite) — grob geschätzt, über wireCampusRefCalibration direkt
   am Bild nachjustierbar. */
function campusRefLinesHtml(rungTypeId) {
  const t = CAMPUS_RUNG_TYPES.find((r) => r.id === rungTypeId);
  if (!t) return '';
  const xs = [t.lineX, t.lineX2].filter((x) => x != null);
  return xs.map((x) => `<div class="campus-ref-line" style="left:${x}%;"></div>`).join('');
}

/* Welcher Sprossen-Typ liegt an dieser %-Position im Referenzbild? Jeder
   Typ hat 1-2 kalibrierte Linien (lineX/lineX2) — Antippen wählt einfach
   den Typ mit der NÄCHSTEN Linie. Das funktioniert auch dort, wo sich
   Zonen nicht sauber links-nach-rechts sortieren lassen (die Kugel-Typen
   liegen mit ihren zwei Zickzack-Spalten ineinander verschachtelt): jede
   einzelne Linie zieht eigenständig ihre eigene Zone bis zur Mitte zur
   nächsten Nachbarlinie, unabhängig davon, welchem Typ diese gehört. */
function campusRungTypeAtX(xPercent) {
  let best = null;
  let bestDist = Infinity;
  CAMPUS_RUNG_TYPES.forEach((t) => {
    [t.lineX, t.lineX2].filter((x) => x != null).forEach((x) => {
      const dist = Math.abs(x - xPercent);
      if (dist < bestDist) { bestDist = dist; best = t.id; }
    });
  });
  return best;
}

/* Antippen des Referenzbilds wählt direkt den passenden Sprossen-Typ
   (campusRungTypeAtX) — die Linie war ja als Bestätigung schon da, jetzt
   entscheidet sie auch wirklich mit, statt nur zur Kontrolle dazustehen.
   Der Klartext-Readout bleibt als kurze Bestätigung, welcher Typ getroffen
   wurde. Sollten die lineX/lineX2-Werte für ein Board mal nicht genau
   passen, zeigt der Readout zusätzlich die getippte %-Position an — damit
   lässt sich falsch kalibrierten Typen weiterhin schnell nachhelfen. */
function wireCampusRefCalibration(c) {
  const wrap = document.getElementById('campus-ref');
  const readout = document.getElementById('campus-ref-calib');
  if (!wrap || !readout) return;
  wrap.onclick = (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const matched = campusRungTypeAtX(x);
    if (matched && matched !== c.rungType) {
      c.rungType = matched;
      renderFbAddPanel();
      return;
    }
    readout.textContent = `${campusRungLabel(matched)} (getippt bei ${x}%)`;
  };
}

function fbBlockSub(b) {
  if (b.type === 'pause') {
    return `${b.seconds}s Pause`;
  }
  if (isHoldModeBlock(b)) {
    const blockRestSec = b.blockRestSec != null ? b.blockRestSec : b.restSec;
    const prefix = b.type === 'block' ? 'Halten' : 'Hang';
    const handSuffix = b.type === 'block' ? ' · ' + blockHandPatternText(b) : '';
    return `${b.hangSec}s ${prefix} · ${b.restSec}s zw. Sätzen · ${blockRestSec}s danach · ×${b.reps}${handSuffix}`;
  }
  if (b.type === 'campus') {
    const blockRestSec = b.blockRestSec != null ? b.blockRestSec : b.restSec;
    return `${campusMoveText(b)} · ${b.workSec}s Ausführung · ${b.restSec}s zw. Sätzen · ${blockRestSec}s danach · ×${b.reps}`;
  }
  return `${b.workSec || 40}s Ausführung · Ziel ${b.reps}×${b.restSec ? ' · ' + b.restSec + 's Pause danach' : ''}`;
}

function fbBlockTitle(b) {
  if (b.type === 'pause') return 'Pause';
  if (isHangLikeBlock(b)) return holdBlockTitle(b);
  if (b.type === 'campus') return campusLabel(b);
  return esc(exerciseName(b.exerciseId));
}

/* Letzte 3 Sekunden einer Pause (rest-tense, siehe renderFbOverlay/
   updateTimerUI): statt die Zahl nur zu vergrössern/pulsieren, fliegt jede
   Ziffer einzeln aus dem Bild (siehe .fb-fly-char in styles.css) — jede
   Ziffer als eigenes <span>, damit die CSS-Animation bei jedem Tick (neues
   Element durch den Re-Render) von vorne losläuft, statt nur einmal zu
   laufen und dann stehen zu bleiben. */
function fbFlyDigitsHtml(text) {
  return text.split('').map((ch) => `<span class="fb-fly-char">${esc(ch)}</span>`).join('');
}

/* Inhalt der grossen Zahl im laufenden Ablauf: "LOS!" hat Vorrang (kurzer
   Blitz beim Wechsel in eine Arbeitsphase, siehe advanceToNextStep), sonst
   in den letzten 3 Sekunden einer Pause die rausfliegenden Ziffern, sonst
   einfach die Sekundenzahl. An allen drei Render-Stellen (zwei Layouts in
   renderFbOverlay, plus updateTimerUI) identisch verwendet. */
function fbBigContent(restTense) {
  if (fb.showLos) return 'LOS!';
  return restTense ? fbFlyDigitsHtml(pad2(fb.secondsLeft)) : pad2(fb.secondsLeft);
}

/* Regel-Kacheln (reiner Text, keine Icons — siehe Vorschau/Nutzer-
   Feedback): vier immer gleich angeordnete Fakten zum aktuell laufenden
   bzw. bei der abschliessenden Pause zum NÄCHSTEN Block, direkt unter der
   Kopfzeile. Nur für Hang/Griffblock (Halten- und Wiederholungen-Modus)
   und Campus — genau die Blocktypen mit Griff-/Hand-/Muster-Angaben, die
   sich aus dem dichten Beschreibungstext allein schlecht auf einen Blick
   erfassen liessen. Fixübungen/Pause haben kein Griff-/Hand-Konzept und
   bekommen bewusst keine Zeile, um die Reihenfolge nicht mit Lückenfeldern
   zu verwässern. */
function fbFactChipsHtml(b, activeRep) {
  if (isHangLikeBlock(b)) {
    const grip = b.type === 'block' ? blockGripLabel(b) : hangGripLabel(b);
    const timeText = b.type === 'block' && b.mode === 'reps' ? `${b.workSec || 40}s Dauer` : `${b.hangSec}s Halten`;
    return fbFactRowHtml([
      ['Griff', grip],
      // Eigene id: beim Lifting Pin im Wechsel-Modus ändert sich die aktive
      // Hand pro Wiederholung, ohne dass ein voller Re-Render passiert
      // (siehe #fb-hand-note-Pendant weiter unten in updateTimerUI) — muss
      // deshalb dort gezielt nachgezogen werden.
      ['Arme', fbFactArmText(b, activeRep), 'fb-fact-arm'],
      ['Zeit', timeText],
      ['Sätze', `×${b.reps}`],
    ]);
  }
  if (b.type === 'campus') {
    return fbFactRowHtml([
      ['Sprosse', campusRungLabel(b.rungType)],
      ['Modus', fbFactCampusModeText(b)],
      ['Zeit', `${b.workSec}s je Zug`],
      ['Muster', fbFactCampusMusterText(b)],
    ]);
  }
  return '';
}
function fbFactRowHtml(pairs) {
  return `<div class="fb-fact-row">${pairs.map(([label, value, id]) => `
    <div class="fb-fact-chip">
      <div class="fb-fact-label mono">${esc(label)}</div>
      <div class="fb-fact-value"${id ? ` id="${id}"` : ''}>${esc(value)}</div>
    </div>
  `).join('')}</div>`;
}
/* Ohne aktive Wiederholung (Pause, Vorschau des nächsten Blocks): allgemeines
   Muster ("Einarmig, abwechselnd (links zuerst)"). MIT aktiver Wiederholung
   (laufende Halten-Arbeitsphase): stattdessen die JETZT dran seiende Hand —
   dasselbe Prinzip wie holdBlockArmNote, hier aber als reiner Text ohne
   Emoji, damit die Kachel zur reinen Text-Variante passt. */
function fbFactArmText(b, activeRep) {
  if (b.type === 'block') {
    if (activeRep != null) return `Einarmig · ${handLabel(blockHandForRep(b, activeRep))}`;
    return `Einarmig, ${blockHandPatternText(b)}`;
  }
  if (hangIsAsymmetric(b)) return 'Pro Hand unterschiedlich';
  const note = gripArmNote(b.board, b.grip);
  return note ? note.charAt(0).toUpperCase() + note.slice(1) : 'Einarmig';
}
function fbFactCampusModeText(b) {
  const armMode = b.armMode || 'both';
  const modeLabel = campusArmModeLabel(armMode);
  return armMode === 'both' ? modeLabel : `${modeLabel}, ${b.startHand === 'right' ? 'Rechts' : 'Links'} zuerst`;
}
function fbFactCampusMusterText(b) {
  if (b.moveMode !== 'pattern') return `Sprosse ${b.fromRung} → ${b.toRung}`;
  const end = b.pattern.reduce((r, p) => r + p, b.startRung);
  return `${b.startRung} → ${end}, ${b.pattern.length} Züge`;
}

/* Restprogramm-Übersicht: Button oben links im laufenden Ablauf-Overlay
   (siehe renderFbOverlay) legt diese Liste über den Timer, der im
   Hintergrund einfach weiterläuft — kein Pausieren nötig, es ist nur eine
   zusätzliche Ebene über der schon laufenden Ansicht. */
function fbOverviewHtml() {
  const items = fb.blocks.map((b, i) => {
    const state = i < fb.blockIndex ? 'done' : i === fb.blockIndex ? 'current' : 'upcoming';
    return `
      <div class="fb-overview-item fb-overview-${state}">
        <div class="fb-overview-idx mono">${state === 'done' ? '✓' : i + 1}</div>
        <div>
          <div class="fb-overview-title">${fbBlockTitle(b)}</div>
          <div class="fb-overview-sub mono">${esc(fbBlockSub(b))}</div>
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="fb-overview" id="fb-overview">
      <div class="fb-overview-header">
        <div class="fb-overview-title-main mono">RESTPROGRAMM · SATZ ${fb.blockIndex + 1}/${fb.blocks.length}</div>
      </div>
      <div class="fb-overview-list">${items}</div>
      <button type="button" class="fb-overlay-close" id="fb-overview-close" title="Schliessen">✕</button>
    </div>
  `;
}

function toggleFbOverview(show) {
  fb.showOverview = show;
  renderFbOverlay();
}

function wireFbOverviewPanel() {
  const closeBtn = document.getElementById('fb-overview-close');
  if (closeBtn) closeBtn.onclick = () => toggleFbOverview(false);
  // Direkt zum aktuellen Satz scrollen, damit man ihn bei langen Abläufen
  // nicht erst suchen muss.
  const current = document.querySelector('#fb-overview .fb-overview-current');
  if (current) current.scrollIntoView({ block: 'center' });
}

function renderFbBlocksList() {
  saveDraft('fb_blocks', fb.blocks);
  const holder = document.getElementById('fb-blocks-list');
  if (!holder) return;

  if (!fb.blocks.length) {
    holder.innerHTML = '<div class="list-empty" style="margin-bottom:14px;">Noch kein Ablauf — Sätze unten hinzufügen.</div>';
    renderFbRuntime();
    return;
  }

  const stats = `
    <div class="stat-tiles">
      <div class="stat-tile"><div class="num">${fb.blocks.length}</div><div class="lbl">Sätze</div></div>
      <div class="stat-tile"><div class="num mono" id="fb-stat-time">${fmtMinSec(fbEstimateSeconds())}</div><div class="lbl">~ Dauer</div></div>
    </div>
  `;

  const items = fb.blocks.map((b, i) => {
    const isHang = isHangLikeBlock(b);
    const isCampus = b.type === 'campus';
    const isPause = b.type === 'pause';
    const title = isPause ? 'Pause' : isHang ? holdBlockTitle(b) : isCampus ? campusLabel(b) : esc(exerciseName(b.exerciseId));
    const thumb = isPause
      ? `<div class="timeline-thumb timeline-thumb-emoji">⏸</div>`
      : isHang
        ? `<button type="button" class="timeline-thumb-edit" data-edit-grip="${i}" title="Griff bearbeiten">${holdBlockThumb(b)}<span class="thumb-edit-badge">✏</span></button>`
        : isCampus
          ? `<div class="timeline-thumb"><img src="${CAMPUS_BOARD_IMAGE}" alt=""></div>`
          : `<div class="timeline-thumb timeline-thumb-emoji">💪</div>`;
    const edit = isPause ? `
        <input type="number" data-i="${i}" data-f="seconds" value="${b.seconds}" class="ex-row-input" title="Pause (s)">
      ` : isHoldModeBlock(b) ? `
        <input type="number" data-i="${i}" data-f="reps" value="${b.reps}" class="ex-row-input" title="Wiederholungen">
        <button type="button" class="ex-row-step" data-step="${i}" title="Zusätzliche Wiederholung">+</button>
        <input type="number" data-i="${i}" data-f="hangSec" value="${b.hangSec}" class="ex-row-input" title="Halten (s)">
        <input type="number" data-i="${i}" data-f="restSec" value="${b.restSec}" class="ex-row-input" title="Pause zwischen Sätzen (s)">
        <input type="number" data-i="${i}" data-f="blockRestSec" value="${b.blockRestSec != null ? b.blockRestSec : b.restSec}" class="ex-row-input" title="Pause danach, vor dem nächsten Satz (s)">
      ` : isCampus ? `
        <input type="number" data-i="${i}" data-f="reps" value="${b.reps}" class="ex-row-input" title="Sätze / Wdh. des Musters">
        <input type="number" data-i="${i}" data-f="workSec" value="${b.workSec}" class="ex-row-input" title="Ausführung (s)">
        <input type="number" data-i="${i}" data-f="restSec" value="${b.restSec}" class="ex-row-input" title="Pause zwischen Sätzen (s)">
        <input type="number" data-i="${i}" data-f="blockRestSec" value="${b.blockRestSec != null ? b.blockRestSec : b.restSec}" class="ex-row-input" title="Pause danach, vor dem nächsten Satz (s)">
      ` : `
        <input type="number" data-i="${i}" data-f="reps" value="${b.reps}" class="ex-row-input" title="Ziel-Wiederholungen">
        <input type="number" data-i="${i}" data-f="workSec" value="${b.workSec || 40}" class="ex-row-input" title="Dauer (s)">
        <input type="number" data-i="${i}" data-f="restSec" value="${b.restSec || 0}" class="ex-row-input" title="Pause danach (s)">
      `;
    return `
      <div class="timeline-item anim-in" style="animation-delay:${Math.min(i, 14) * 30}ms">
        <div class="timeline-badge ${isHang ? '' : 'exercise'}">${i + 1}</div>
        <div class="timeline-card">
          ${thumb}
          <div class="info">
            <div class="title">${title}</div>
            <div class="sub" id="fb-sub-${i}">${esc(fbBlockSub(b))}</div>
            <div class="timeline-edit">${edit}</div>
          </div>
          <div class="timeline-move">
            ${(!isHang && !isCampus && !isPause) ? `<button type="button" class="timeline-move-btn" data-fb-info="${i}" title="Info zur Übung">ℹ</button>` : ''}
            <button type="button" class="timeline-move-btn" data-move-up="${i}" ${i === 0 ? 'disabled' : ''} title="Nach oben verschieben">▲</button>
            <button type="button" class="timeline-move-btn" data-move-down="${i}" ${i === fb.blocks.length - 1 ? 'disabled' : ''} title="Nach unten verschieben">▼</button>
          </div>
          <button type="button" class="timeline-remove" data-remove="${i}">×</button>
        </div>
      </div>
    `;
  }).join('');

  holder.innerHTML = stats + `<div class="timeline">${items}</div>`;

  holder.querySelectorAll('.timeline-edit input').forEach((inp) => {
    inp.oninput = () => {
      const i = Number(inp.dataset.i);
      fb.blocks[i][inp.dataset.f] = Number(inp.value) || 0;
      saveDraft('fb_blocks', fb.blocks);
      const subEl = document.getElementById(`fb-sub-${i}`);
      if (subEl) subEl.textContent = fbBlockSub(fb.blocks[i]);
      const timeEl = document.getElementById('fb-stat-time');
      if (timeEl) timeEl.textContent = fmtMinSec(fbEstimateSeconds());
    };
  });
  holder.querySelectorAll('[data-step]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.step);
      fb.blocks[i].reps = (Number(fb.blocks[i].reps) || 0) + 1;
      renderFbBlocksList();
    };
  });
  holder.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => {
      fb.blocks.splice(Number(btn.dataset.remove), 1);
      renderFbBlocksList();
    };
  });
  holder.querySelectorAll('[data-fb-info]').forEach((btn) => {
    btn.onclick = () => showExerciseInfoSheet(fb.blocks[Number(btn.dataset.fbInfo)].exerciseId);
  });
  holder.querySelectorAll('[data-edit-grip]').forEach((btn) => {
    btn.onclick = () => openFbGripEditor(Number(btn.dataset.editGrip));
  });
  holder.querySelectorAll('[data-move-up]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.moveUp);
      if (i <= 0) return;
      [fb.blocks[i - 1], fb.blocks[i]] = [fb.blocks[i], fb.blocks[i - 1]];
      renderFbBlocksList();
    };
  });
  holder.querySelectorAll('[data-move-down]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.moveDown);
      if (i >= fb.blocks.length - 1) return;
      [fb.blocks[i], fb.blocks[i + 1]] = [fb.blocks[i + 1], fb.blocks[i]];
      renderFbBlocksList();
    };
  });
  renderFbRuntime(); // Start-Button-Status hängt von fb.blocks.length ab
}

/* Nur noch der Idle-Zustand ("Ablauf starten") — sobald ein Ablauf läuft,
   übernimmt das Vollbild (fb-overlay, siehe unten) komplett. */
function renderFbRuntime() {
  const holder = document.getElementById('fb-runtime');
  if (!holder) return;
  holder.innerHTML = `<button class="btn" id="fb-start-ablauf" ${fb.blocks.length ? '' : 'disabled'}>ABLAUF STARTEN</button>`;
  const btn = document.getElementById('fb-start-ablauf');
  if (btn) btn.onclick = startAblauf;
  showFabStart('▶ STARTEN', 'fb-start-ablauf');
}

/* ---------- Ablauf-Vollbild ----------
   Eigenes, fixed-positioniertes Overlay ausserhalb von #app — läuft über
   den Firebase-Renderzyklus der Seite hinweg, damit der Timer beim
   Navigieren nicht mitten drin abreisst. Zeigt: Fortschritt als Kletterer,
   der an einer Felswand hochsteigt (Gesamtzeit statt nur eine Linie),
   die aktuelle Phase gross, und eine "Danach"-Ankündigung, was als
   Nächstes kommt. */
/* Strichmännchen fürs Hang-/Pause-Timing (nicht in EXERCISE_FIGURES, da
   kein Übungs-Objekt dahintersteht) — hängt am Brett während "Hang",
   steht entspannt mit lockeren Armen während "Pause". Der Ring um die
   grosse Zahl füllt sich dabei mit dem Fortschritt INNERHALB des
   aktuellen Hang-/Pause-Schritts (nicht des ganzen Ablaufs). */
const FB_RING_CIRCUMFERENCE = 326.7; // 2 * PI * r(52)
/* Beta: Faultier statt Strichmännchen (Pincho = Fingerkraft wie ein
   Faultier). Beim Hängen hängt es mit den Krallen an der Leiste und
   schwingt leicht, in der Pause sitzt es mit hängenden Armen und atmet
   durch (Animationen in styles.css, .sloth-*). */
const SLOTH_FACE = `
  <circle class="sloth-head" cx="100" cy="64" r="19"/>
  <path class="sloth-mask" d="M86 62 q6 -7 12 1 q-6 7 -12 -1z M114 62 q-6 -7 -12 1 q6 7 12 -1z"/>
  <path class="sloth-line" d="M97 71 h6 M94 76 q6 4 12 0"/>`;
const FB_HANG_FIGURE_SVG = `
  <svg viewBox="0 0 200 200" class="ex-figure fb-hang-figure sloth-fig">
    <line class="fig-rig sloth-bar" x1="36" y1="20" x2="164" y2="20"/>
    <g class="sloth-swing">
      <path class="sloth-limb" d="M72 22 Q70 50 88 76"/>
      <path class="sloth-limb" d="M128 22 Q130 50 112 76"/>
      <path class="sloth-claw" d="M66 20 q4 -8 10 -2 M70 22 q6 -8 11 0 M124 22 q5 -8 11 -2 M128 22 q6 -8 10 0"/>
      <ellipse class="sloth-body" cx="100" cy="118" rx="27" ry="36"/>
      <path class="sloth-line" d="M86 108 q14 9 28 0 M88 124 q12 7 24 0"/>
      ${SLOTH_FACE}
      <circle class="sloth-eye" cx="93" cy="62" r="2.4"/>
      <circle class="sloth-eye" cx="107" cy="62" r="2.4"/>
      <path class="sloth-limb" d="M88 148 Q82 164 84 182 M112 148 Q118 164 116 182"/>
      <path class="sloth-claw" d="M80 184 q-2 7 -8 8 M85 185 q0 7 -4 10 M120 184 q2 7 8 8 M115 185 q0 7 4 10"/>
    </g>
  </svg>
`;
const FB_REST_FIGURE_SVG = `
  <svg viewBox="0 0 200 200" class="ex-figure fb-rest-figure sloth-fig">
    <g class="sloth-breathe">
      <ellipse class="sloth-body" cx="100" cy="134" rx="32" ry="34"/>
      <path class="sloth-line" d="M84 124 q16 10 32 0 M86 142 q14 8 28 0"/>
      <circle class="sloth-head" cx="100" cy="84" r="19"/>
      <path class="sloth-mask" d="M86 82 q6 -7 12 1 q-6 7 -12 -1z M114 82 q-6 -7 -12 1 q6 7 12 -1z"/>
      <path class="sloth-line" d="M89 82 q4 3 8 0 M103 82 q4 3 8 0 M97 91 h6 M95 96 q5 3 10 0"/>
      <path class="sloth-limb" d="M82 170 q-10 10 -24 12 M118 170 q10 10 24 12"/>
    </g>
    <path class="sloth-limb fb-arm-shake" d="M72 116 Q60 140 64 164"/>
    <path class="sloth-limb fb-arm-shake" d="M128 116 Q140 140 136 164"/>
    <text class="sloth-z" x="128" y="58">z</text>
    <text class="sloth-z sloth-z2" x="142" y="42">z</text>
  </svg>
`;
/* Lifting Pin ist kein Hängen (FB_HANG_FIGURE_SVG), sondern ein einarmiges
   Ziehen von unten (Pin auf Hüfthöhe) nach oben (Richtung Schulter) — eigene
   Animation dafür, stehende Fixfigur + EIN animierter Arm (Start/Ende
   überblenden wie bei den dynamischen Übungs-Strichmännchen), der andere
   Arm hängt ruhig/gedämpft daneben. Standardzeichnung ist die rechte Hand;
   für "links" wird die ganze Figur per CSS horizontal gespiegelt. */
function blockPullFigureSvg(hand) {
  const flip = hand === 'left' ? ' style="transform:scaleX(-1);"' : '';
  return `
  <svg viewBox="0 0 200 200" class="ex-figure fb-block-pull-figure"${flip}>
    <path class="fig-motion" d="M138,148 L138,76"/>
    <polygon class="fig-arrow" points="138,76 130,90 146,90"/>
    <g class="fig-pose fig-fixed">
      <circle cx="100" cy="42" r="14"/>
      <line x1="100" y1="56" x2="100" y2="128"/>
      <line x1="100" y1="128" x2="86" y2="190"/>
      <line x1="100" y1="128" x2="114" y2="190"/>
      <line x1="100" y1="60" x2="76" y2="108"/>
    </g>
    <g class="fig-pose fig-a" style="animation-duration:1.6s;">
      <line x1="100" y1="60" x2="138" y2="148"/>
      <circle class="fig-joint fig-hi" cx="138" cy="148" r="6"/>
    </g>
    <g class="fig-pose fig-b" style="animation-duration:1.6s;">
      <line x1="100" y1="60" x2="130" y2="76"/>
      <circle class="fig-joint fig-hi" cx="130" cy="76" r="6"/>
    </g>
  </svg>
  `;
}
/* Dispatcher fürs "Work"-Strichmännchen während des laufenden Timers:
   Hang bleibt die Hänge-Figur, Griffblock/Lifting Pin zeigt stattdessen
   das Zieh-Strichmännchen mit der gerade aktiven Hand (activeRep kommt
   aus dem rep-Feld des laufenden Sequenz-Schritts, siehe buildBlockSequence). */
function holdBlockWorkFigure(b, activeRep) {
  return b.type === 'block' ? blockPullFigureSvg(blockHandForRep(b, activeRep || 0)) : FB_HANG_FIGURE_SVG;
}

function ensureFbOverlay() {
  let el = document.getElementById('fb-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fb-overlay';
    el.className = 'fb-overlay hidden';
    document.body.appendChild(el);
    wireFbOverlaySwipe(el);
  }
  return el;
}

/* Nach links wischen = "einen Schritt weiter" (dasselbe wie ⏭, siehe
   fbStepForward), nach rechts = zurück — v. a. bei Übungs-Sätzen soll man
   so ohne genaues Zielen auf einen Button weiterkommen. Einmal auf das
   Overlay-Element selbst gebunden (bleibt über jedes innerHTML-Neurendern
   hinweg bestehen), nicht auf einzelne Kind-Elemente. */
function wireFbOverlaySwipe(el) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    if (!fb.running || fb.preCount != null) return; // nur während eines laufenden Satzes
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.3) return; // zu kurz oder zu diagonal
    if (dx < 0) fbStepForward(); else fbStepBack();
  }, { passive: true });
}

async function openFbOverlay() {
  const el = ensureFbOverlay();
  el.classList.remove('hidden');
  if (el.requestFullscreen) {
    try { await el.requestFullscreen(); } catch (e) { /* z.B. iOS Safari — CSS-Vollbild reicht als Fallback */ }
  }
  renderFbOverlay();
}

function closeFbOverlay() {
  const el = document.getElementById('fb-overlay');
  if (el) el.classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/* Dauer eines einzelnen Blocks in Sekunden — wie fbEstimateSeconds(),
   aber pro Block statt summiert (fürs Fortschritts-Tracking nötig). */
function fbBlockSeconds(b) {
  return buildBlockSequence(b).reduce((s, p) => s + p.seconds, 0);
}

function fbElapsedSeconds() {
  let elapsed = 0;
  for (let i = 0; i < fb.blockIndex; i++) elapsed += fbBlockSeconds(fb.blocks[i]);
  const cur = fb.blocks[fb.blockIndex];
  if (cur && fb.running && fb.sequence.length) {
    const done = fb.sequence.slice(0, fb.stepIndex).reduce((s, p) => s + p.seconds, 0);
    const curTotal = fb.sequence[fb.stepIndex] ? fb.sequence[fb.stepIndex].seconds : 0;
    elapsed += done + (curTotal - fb.secondsLeft);
  }
  return elapsed;
}

/* Was kommt als Nächstes dran — erst innerhalb des laufenden Blocks
   (nächste Phase in fb.sequence), sonst der nächste Block im Ablauf. */
function fbUpcomingLabel() {
  const block = fb.blocks[fb.blockIndex];
  if (block && fb.sequence.length) {
    const next = fb.sequence[fb.stepIndex + 1];
    if (next) return `${next.phase} ${next.seconds}s`;
  }
  const nextBlock = fb.blocks[fb.blockIndex + 1];
  if (!nextBlock) return 'Letzter Satz — gleich geschafft!';
  if (nextBlock.type === 'hang') return 'Hang @ ' + hangGripLabel(nextBlock);
  if (nextBlock.type === 'block') return 'Lifting Pin @ ' + blockGripLabel(nextBlock);
  if (nextBlock.type === 'campus') return campusLabel(nextBlock);
  if (nextBlock.type === 'pause') return 'Pause';
  return exerciseName(nextBlock.exerciseId);
}

function updateFbProgressUI() {
  const text = document.getElementById('fb-progress-text');
  if (!text) return;
  text.textContent = `Satz ${Math.min(fb.blockIndex + 1, fb.blocks.length)}/${fb.blocks.length} · ${fmtMinSec(fbElapsedSeconds())} / ${fmtMinSec(fbEstimateSeconds())}`;
}

function updateFbUpcomingUI() {
  const el = document.getElementById('fb-upcoming');
  if (!el) return;
  // Während der abschliessenden Pause zeigt schon der grosse Titel "GLEICH:
  // ..." (siehe renderFbOverlay/fbIsTrailingPause) genau das, was diese
  // Zeile sonst ankündigen würde — Wiederholung hier weglassen.
  el.textContent = fbIsTrailingPause() ? '' : 'Danach: ' + fbUpcomingLabel();
}

/* ---------- Transport-Leiste (Zurück / Play-Pause / Weiter) ----------
   Der Ablauf läuft nach dem ersten "LOS" von allein durch alle Sätze
   (Hang- wie Übungs-Sätze) — kein Antippen zwischen den Sätzen mehr nötig.
   Zurück/Weiter springen direkt in den Nachbar-Satz (inkl. dessen eigenem
   Vorbereitungs-Countdown bei Hang-Sätzen), Play/Pause hält den gerade
   laufenden Timer an, ohne den Bildschirm auszuschalten. */
/* Transport-Symbole als SVG statt Emoji-Zeichen (⏮⏸⏭ werden auf Android
   als bunte Emoji-Kacheln gezeichnet). */
const TRANSPORT_ICON = {
  prev: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 6.2v11.6a1 1 0 01-1.5.9L10 12.9a1 1 0 010-1.8l8.5-5.8a1 1 0 011.5.9z"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 6.2v11.6a1 1 0 001.5.9L14 12.9a1 1 0 000-1.8L5.5 5.3A1 1 0 004 6.2z"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.9l10.2-6.5a1 1 0 000-1.8L9.5 4.6A1 1 0 008 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
};
function fbTransportRow() {
  const canPause = fb.running;
  const isPaused = canPause && !fb.intervalId;
  return `
    <div class="fb-transport">
      <button type="button" class="fb-transport-btn" id="fb-prev" ${fb.blockIndex === 0 && fb.stepIndex === 0 ? 'disabled' : ''} title="Zurück" aria-label="Zurück">${TRANSPORT_ICON.prev}</button>
      <button type="button" class="fb-transport-btn fb-play" id="fb-playpause" ${canPause ? '' : 'disabled'} title="${isPaused ? 'Weiter' : 'Pause'}">${isPaused ? TRANSPORT_ICON.play : TRANSPORT_ICON.pause}</button>
      <button type="button" class="fb-transport-btn" id="fb-skip" title="Einen Schritt weiter" aria-label="Einen Schritt weiter">${TRANSPORT_ICON.next}</button>
    </div>
  `;
}

/* Transport "Zurück" (⏮) sowie Wischen nach rechts: sollte wie "Weiter"
   nur EINEN Schritt zurückspulen, sprang bisher aber immer einen ganzen
   Satz zurück (fb.blockIndex - 1) — bei einem Block mit mehreren
   Wiederholungen/Pausen also weit über den eigentlich gewünschten
   vorherigen Schritt hinaus. Jetzt symmetrisch zu fbStepForward: gibt es
   innerhalb des laufenden Satzes noch einen vorherigen Schritt, geht's nur
   dorthin (mit dessen voller Dauer, genau wie beim Vorspulen); nur wenn
   man schon beim allerersten Schritt dieses Satzes ist, geht's zum
   vorherigen Satz. */
function fbStepBack() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  fbCheckinTyping = false; // Feld ist beim Block-/Schrittwechsel weg — sonst bliebe die Zeit angehalten
  if (fb.stepIndex > 0) {
    fb.stepIndex--;
    fb.secondsLeft = fb.sequence[fb.stepIndex].seconds;
    fb.stepStartedAt = Date.now();
    fb.intervalId = setInterval(tickBlock, 1000);
    renderFbOverlay();
    return;
  }
  if (fb.blockIndex === 0) {
    // Ganz am Anfang des Ablaufs — nichts mehr davor (Button ist in diesem
    // Zustand ohnehin disabled, Wischen kann aber trotzdem hier landen).
    fb.intervalId = setInterval(tickBlock, 1000);
    renderFbOverlay();
    return;
  }
  // War bisher der eigentliche Bug: sprang über beginBlock() immer zum
  // ALLERERSTEN Schritt des vorherigen Blocks (bei mehreren Wiederholungen
  // also weit zurück, nicht nur einen Schritt) — jetzt stattdessen direkt
  // der LETZTE Schritt seiner Sequenz, symmetrisch dazu, wie Vorspulen am
  // Blockende in den ERSTEN Schritt des nächsten Blocks geht. Kein
  // beginBlock()/Vorbereitungs-Countdown hier: man kehrt in einen bereits
  // durchlaufenen Schritt zurück, startet ihn nicht neu.
  fb.blockIndex--;
  const prevBlock = fb.blocks[fb.blockIndex];
  fb.sequence = buildBlockSequence(prevBlock, fb.blockIndex === fb.blocks.length - 1);
  fb.stepIndex = fb.sequence.length - 1;
  fb.secondsLeft = fb.sequence[fb.stepIndex].seconds;
  fb.stepStartedAt = Date.now();
  fb.intervalId = setInterval(tickBlock, 1000);
  renderFbOverlay();
}

/* Transport "Weiter" (⏭) sowie Wischen nach links: laut Nutzer-Feedback
   soll das nur EINEN Schritt vorspulen (wie ein abgelaufener Timer),
   nicht den ganzen Satz überspringen — das sprang bisher direkt zum
   nächsten Block/zur nächsten Übung, "man fliegt immer direkt zur
   nächsten Übung". Jeder Schritt einzeln, wie tickBlock() es bei Ablauf
   der Zeit auch tut — siehe advanceToNextStep(). */
function fbStepForward() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  fbCheckinTyping = false; // Feld ist beim Blockwechsel weg — sonst bliebe die Zeit im neuen Block angehalten
  if (advanceToNextStep()) return; // Block war zu Ende -> beginBlock()/finishAblauf() haben schon gerendert
  fb.intervalId = setInterval(tickBlock, 1000);
  renderFbOverlay();
}

function fbTogglePause() {
  if (!fb.running) return;
  if (fb.intervalId) {
    clearInterval(fb.intervalId);
    fb.intervalId = null;
    fb.pausedAt = Date.now();
  } else {
    // stepStartedAt um die Pausendauer nach vorne schieben — der Ring
    // orientiert sich an der seit Schrittbeginn VERSTRICHENEN Zeit (siehe
    // syncFbRingAnimation), ohne das würde die Pause fälschlich mitzählen
    // und der Ring springt beim Fortsetzen ein Stück nach vorne.
    if (fb.pausedAt) { fb.stepStartedAt += Date.now() - fb.pausedAt; fb.pausedAt = null; }
    fb.intervalId = setInterval(tickBlock, 1000);
  }
  renderFbOverlay();
}

function renderFbOverlay() {
  const el = ensureFbOverlay();
  if (!fb.running && !fb.awaitingNext && fb.preCount == null) { closeFbOverlay(); return; }

  let stage = '';
  if (fb.awaitingNext) {
    const next = fb.blocks[fb.blockIndex];
    if (!next) { closeFbOverlay(); return; }
    const isHang = isHangLikeBlock(next);
    const isCampus = next.type === 'campus';
    const isPause = next.type === 'pause';
    const nextArmNote = isHang ? holdBlockArmNote(next) : '';
    stage = `
      <div class="fb-stage-label mono">NÄCHSTER SATZ (${fb.blockIndex + 1}/${fb.blocks.length})</div>
      <div class="fb-stage-figure">${isPause ? FB_REST_FIGURE_SVG : isHang ? holdBlockThumb(next) : isCampus ? campusWorkFigureSvg(next) : exerciseFigureSvg(next.exerciseId)}</div>
      <div class="fb-stage-title">${isPause ? 'Pause' : isHang ? holdBlockTitle(next) : isCampus ? campusLabel(next) : esc(exerciseName(next.exerciseId))}</div>
      <div class="fb-stage-sub mono">${esc(fbBlockSub(next))}${nextArmNote ? ' · ' + nextArmNote : ''}</div>
      ${fbTransportRow()}
      <button class="btn fb-stage-btn" id="fb-continue">LOS</button>
    `;
  } else if (fb.preCount != null) {
    const block = fb.blocks[fb.blockIndex];
    const isHang = isHangLikeBlock(block);
    const armNote = isHang ? holdBlockArmNote(block) : '';
    const tense = fb.preCount <= 3;
    stage = `
      <div class="fb-stage-label mono">SATZ ${fb.blockIndex + 1}/${fb.blocks.length} · ${isHang ? holdBlockTitle(block) : campusLabel(block)}${armNote ? ' · ' + armNote : ''}</div>
      <div class="fb-stage-figure">${isHang ? holdBlockThumb(block) : campusWorkFigureSvg(block)}</div>
      <div class="fb-precount-heading mono">ALLEZ${state.member && state.member.name ? `, ${esc(state.member.name)}` : ''}!</div>
      <div class="fb-precount-subheading mono">GET READY!</div>
      <div class="fb-precount ${tense ? 'fb-precount-tense' : ''}" id="fb-precount">${fb.preCount}</div>
      <div class="fb-stage-sub mono">Hände ans Board — Zeit zum Vorbereiten!</div>
      <button class="btn fb-stage-btn" id="fb-precount-skip">Jetzt starten</button>
      ${fb.blockIndex > 0 ? '<button class="btn ghost fb-stage-btn" id="fb-finish-early">Vorzeitig beenden & speichern</button>' : ''}
      <button class="btn ghost fb-stage-btn" id="fb-cancel">ABBRECHEN</button>
    `;
  } else {
    // Ein einziges Template für Hang-, Griffblock-, Übungs- UND Campus-
    // Sätze — alle laufen über dieselbe fb.sequence/tickBlock-Uhr,
    // unterscheiden sich nur darin, was während "Work" gezeigt wird
    // (Board-Punkt, generische Hänge-Figur, animiertes Strichmännchen der
    // Übung, oder das Campus-Symbol).
    const block = fb.blocks[fb.blockIndex];
    const isExercise = block.type === 'exercise';
    // Wiederholungen-Griffblock zeigt wie eine Übung ein Ziel + den
    // manuellen "geschafft"-Button, aber OHNE Zielmuskel-Anzeige (dafür
    // bleibt isExercise oben strikt auf echte Übungen begrenzt).
    const showTarget = isExercise || (block.type === 'block' && block.mode === 'reps');
    const isCampus = block.type === 'campus';
    const step = fb.sequence[fb.stepIndex];
    const working = isWorkPhase(step);
    const phaseTotal = step ? step.seconds : 1;
    const frac = phaseTotal ? 1 - fb.secondsLeft / phaseTotal : 0;
    const ringOffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
    const isPausedNow = fb.running && !fb.intervalId;
    const restWarn = !working && fb.secondsLeft > 0 && fb.secondsLeft <= 5;
    const restTense = !working && fb.secondsLeft > 0 && fb.secondsLeft <= 3;
    // Letzte 3 Sekunden eines ARBEITS-Satzes (Hang/Work/Halten): eigener,
    // schlichterer Effekt (Blinken statt Rausfliegen) — warnt, dass die
    // Arbeitsphase gleich endet, ohne mit dem Pausen-Effekt zu verwechseln.
    const workTense = working && fb.secondsLeft > 0 && fb.secondsLeft <= 3;
    const activeRep = working && step ? step.rep : null;

    // Während der ABSCHLIESSENDEN Pause dieses Blocks (danach kommt ein
    // anderer Block oder der Ablauf ist fertig) interessiert nicht mehr,
    // was gerade erledigt wurde — Titel und grosses Bild zeigen deshalb
    // schon den NÄCHSTEN Block ("GLEICH: ..."), statt weiter den bereits
    // fertigen aktuellen zu zeigen. Pausen MIT verbleibenden Wiederholungen
    // desselben Blocks (z. B. zwischen Hang-Wiederholung 1 und 2) sind
    // davon nicht betroffen, dort bleibt es ja ohnehin derselbe Satz/Griff.
    // isLastBlock (buildBlockSequence) sorgt schon dafür, dass der
    // ALLERLETZTE Block im Ablauf keine abschliessende Pause mehr bekommt,
    // weshalb nextBlockRef hier praktisch immer existiert.
    const isTrailingPause = fbIsTrailingPause();
    const nextBlockRef = isTrailingPause ? fb.blocks[fb.blockIndex + 1] : null;
    const displayBlock = nextBlockRef || block;
    const displayIsHang = isHangLikeBlock(displayBlock);
    const displayIsCampus = displayBlock.type === 'campus';
    const displayIsPause = displayBlock.type === 'pause';
    const displayIsExercise = displayBlock.type === 'exercise';
    // Bei Hang ist armNote (Griff-Notiz) übers ganze Satz-Vollbild fix, bei
    // Lifting Pin ändert sich die aktive Hand aber pro Wiederholung — ein
    // eigenes Element dafür, das updateTimerUI() bei jedem Tick auffrischen
    // kann, statt es nur einmal beim vollen Rendern dieses Bildschirms
    // (renderFbOverlay) reinzuschreiben und dann bis zum nächsten Satz
    // eingefroren zu lassen. Während der Vorschau (isTrailingPause) gibt es
    // noch keine "aktive" Wiederholung des NÄCHSTEN Blocks, deshalb dort
    // activeRep bewusst null (zeigt das statische Hand-Muster statt einer
    // konkreten Hand).
    const displayArmNote = displayIsHang ? holdBlockArmNote(displayBlock, isTrailingPause ? null : activeRep) : '';
    const displayLabel = displayIsPause
      ? 'Pause'
      : displayIsHang
        ? `${holdBlockTitle(displayBlock)}${displayArmNote ? ` · <span id="fb-hand-note">${displayArmNote}</span>` : ''}`
        : displayIsCampus ? campusLabel(displayBlock) : esc(exerciseName(displayBlock.exerciseId));
    const muscles = isTrailingPause
      ? (displayIsExercise ? exerciseMuscles(displayBlock.exerciseId) : null)
      : (isExercise ? exerciseMuscles(block.exerciseId) : null);
    const muscleText = muscles ? muscleLabelsText(muscles.primary, muscles.secondary) : '';
    const headerText = isTrailingPause
      ? `NEXT: ${displayLabel}`
      : `SATZ ${fb.blockIndex + 1}/${fb.blocks.length} · ${displayLabel}${showTarget ? ' · Ziel ' + esc(String(block.reps)) + '×' : ''}`;
    // "Schritt X/Y" zählte bisher auch die Pausen-Schritte mit (z. B.
    // "Schritt 2/6" bei nur 3 Wiederholungen), das war verwirrend — bei
    // Blöcken mit rep-Feld pro Schritt (Hang/Griffblock/Campus) jetzt
    // stattdessen die tatsächliche, noch kommende Wiederholungszahl zeigen.
    // Während der abschliessenden Pause reicht "Pause" allein, der Titel
    // oben zeigt ja schon, was als Nächstes kommt.
    let phaseText = '';
    if (step) {
      if (isTrailingPause) {
        phaseText = 'Pause';
      } else if (step.rep != null) {
        const remaining = block.reps - step.rep - 1;
        phaseText = working ? `${step.phase} · Satz ${step.rep + 1}/${block.reps}` : `Pause · noch ${remaining} ${remaining === 1 ? 'Satz' : 'Sätze'}`;
      } else {
        phaseText = step.phase;
      }
      if (isPausedNow) phaseText += ' · PAUSIERT';
    }
    stage = `
      <div class="fb-stage-label mono${!working ? (isTrailingPause ? ' fb-stage-label-next' : ' fb-stage-label-readable') : ''}" id="fb-stage-label">${headerText}</div>
      ${fbFactChipsHtml(displayBlock, isTrailingPause ? null : activeRep)}
      ${displayIsHang
        ? `<div class="fb-stage-figure">${holdBlockThumb(displayBlock)}</div>
           <div class="fb-hang-visual ${isPausedNow ? 'fb-paused' : ''}${restTense ? ' rest-tense' : ''}">
             <div class="fb-phase-figure" id="fb-phase-figure" data-kind="${working ? 'work' : 'rest'}:${activeRep != null ? activeRep : ''}">${working ? holdBlockWorkFigure(block, activeRep) : FB_REST_FIGURE_SVG}</div>
             <div class="fb-timer-ring">
               <svg viewBox="0 0 120 120">
                 <circle class="ring-bg" cx="60" cy="60" r="52"/>
                 <circle class="ring-fg ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}${restTense ? ' rest-tense' : ''}${workTense ? ' work-tense' : ''}" id="fb-ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${ringOffset}"/>
               </svg>
               <div class="big ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}${restTense ? ' rest-tense' : ''}${workTense ? ' work-tense' : ''}${fb.showLos ? ' los-flash' : ''}" id="fb-big">${fbBigContent(restTense)}</div>
             </div>
           </div>`
        : `<div class="fb-stage-figure" id="fb-phase-figure" data-kind="${working ? 'work' : 'rest'}:">${working
            ? (isCampus ? campusWorkFigureSvg(block, false) : exerciseFigureSvg(block.exerciseId))
            : (isTrailingPause ? (displayIsCampus ? campusWorkFigureSvg(displayBlock) : displayIsPause ? FB_REST_FIGURE_SVG : exerciseFigureSvg(displayBlock.exerciseId)) : isCampus ? campusWorkFigureSvg(block) : FB_REST_FIGURE_SVG)}</div>
           <div class="fb-hang-visual ${isPausedNow ? 'fb-paused' : ''}${restTense ? ' rest-tense' : ''}">
             <div class="fb-timer-ring">
               <svg viewBox="0 0 120 120">
                 <circle class="ring-bg" cx="60" cy="60" r="52"/>
                 <circle class="ring-fg ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}${restTense ? ' rest-tense' : ''}${workTense ? ' work-tense' : ''}" id="fb-ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${ringOffset}"/>
               </svg>
               <div class="big ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}${restTense ? ' rest-tense' : ''}${workTense ? ' work-tense' : ''}${fb.showLos ? ' los-flash' : ''}" id="fb-big">${fbBigContent(restTense)}</div>
             </div>
           </div>`}
      <div class="phase mono" id="fb-phase">${esc(phaseText)}</div>
      ${muscleText ? `
        <div class="fb-muscle-block">
          ${bodyMapSvg(muscles.primary, muscles.secondary)}
          <div class="fb-muscle-label mono">${esc(muscleText)}</div>
        </div>
      ` : ''}
      <div class="fb-stage-next mono" id="fb-upcoming"></div>
      <div class="fb-checkin" id="fb-checkin" ${isTrailingPause ? '' : 'hidden'}>${isTrailingPause ? checkinPanelHtml(fb.blockIndex) : ''}</div>
      ${showTarget ? `<button class="btn fb-stage-btn" id="fb-reps-done" ${working ? '' : 'hidden'}>Wiederholungen geschafft — weiter</button>` : ''}
      ${fbTransportRow()}
      ${fb.blockIndex > 0 ? '<button class="btn ghost fb-stage-btn" id="fb-finish-early">Vorzeitig beenden & speichern</button>' : ''}
      <button class="btn ghost fb-stage-btn" id="fb-cancel">ABBRECHEN</button>
    `;
  }

  el.innerHTML = `
    <button type="button" class="fb-overlay-close" id="fb-overlay-close" title="Abbrechen">✕</button>
    <button type="button" class="fb-overlay-overview-btn" id="fb-overview-btn" title="Restprogramm ansehen">☰</button>
    <div class="fb-overlay-inner">
      <div class="fb-progress-text mono" id="fb-progress-text"></div>
      <div class="fb-overlay-stage">${stage}</div>
    </div>
    ${fb.showOverview ? fbOverviewHtml() : ''}
  `;

  document.getElementById('fb-overlay-close').onclick = cancelAblauf;
  document.getElementById('fb-overview-btn').onclick = () => toggleFbOverview(true);
  if (fb.showOverview) wireFbOverviewPanel();
  const prevBtn = document.getElementById('fb-prev');
  if (prevBtn) prevBtn.onclick = fbStepBack;
  const skipBtn = document.getElementById('fb-skip');
  if (skipBtn) skipBtn.onclick = fbStepForward;
  const ppBtn = document.getElementById('fb-playpause');
  if (ppBtn && !ppBtn.disabled) ppBtn.onclick = fbTogglePause;
  if (fb.awaitingNext) {
    document.getElementById('fb-continue').onclick = startCurrentBlock;
  } else if (fb.preCount != null) {
    document.getElementById('fb-precount-skip').onclick = finishPreCountdown;
    const finishEarlyBtn1 = document.getElementById('fb-finish-early');
    if (finishEarlyBtn1) finishEarlyBtn1.onclick = finishAblaufEarly;
    document.getElementById('fb-cancel').onclick = cancelAblauf;
  } else {
    const finishEarlyBtn2 = document.getElementById('fb-finish-early');
    if (finishEarlyBtn2) finishEarlyBtn2.onclick = finishAblaufEarly;
    document.getElementById('fb-cancel').onclick = cancelAblauf;
    const repsDoneBtn = document.getElementById('fb-reps-done');
    if (repsDoneBtn) repsDoneBtn.onclick = fbFinishRepsWork;
    // Nur verdrahten, wenn das Check-in-Markup gerade tatsächlich im DOM
    // steht (exakt dieselbe Bedingung wie beim Einbetten oben) — sonst
    // existiert z. B. nach "Zurück" zu einem bereits abgeschlossenen Block
    // (der schon ein Ergebnis hat, aber gerade nicht in der Schluss-Pause
    // steht) kein #fb-checkin-Inhalt zum Verdrahten.
    if (fbIsTrailingPause() && fb.runResults[fb.blockIndex]) wireCheckinPanel(fb.blockIndex);
    updateFbUpcomingUI();
  }
  updateFbProgressUI();
  syncFbRingAnimation(); // Ring-Element ist hier ggf. frisch neu gebaut worden — Animation entsprechend (neu) ansetzen
}

/* Kleiner Konfetti-Regen für den "Ablauf geschafft"-Screen — reines CSS/
   DOM, kein Canvas/Library nötig. Respektiert prefers-reduced-motion
   (Browser ignoriert die Animation dann per CSS, hier nur zusätzlich
   gar nicht erst erzeugen, um unnötige DOM-Arbeit zu sparen). */
function spawnConfetti(container) {
  if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), '#ff6b47', '#ffffff', '#4fc3ff'];
  for (let i = 0; i < 26; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    const left = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = 1.6 + Math.random() * 1.2;
    const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360);
    piece.style.left = left + '%';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = delay + 's';
    piece.style.animationDuration = duration + 's';
    piece.style.setProperty('--spin', spin + 'deg');
    container.appendChild(piece);
  }
}

function beep(freq, duration) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    // Browser legen die Audio-Ausgabe nach ein paar Sekunden Stille aus
    // Stromspargründen schlafen (state 'suspended') — ohne explizites
    // resume() bleibt sie stumm bzw. wacht spürbar verzögert auf (genau
    // das "Ton kommt zu spät"-Gefühl nach einer längeren stillen Phase,
    // z. B. während eines langen Hangs). Kostet im Normalfall (Context
    // läuft schon) nichts, siehe auch audioKeepWarm().
    if (beep.ctx.state === 'suspended') beep.ctx.resume();
    const osc = beep.ctx.createOscillator();
    const gain = beep.ctx.createGain();
    // Dreieckwelle statt der scharfen Rechteckwelle: klingt wie die
    // elektronischen Pieptöne eines Ski-Startsignals (Skiabfahrt) — klar
    // und mit etwas Charakter, aber runder/angenehmer als der kantige
    // "Retro"-Ton zuvor und immer noch deutlicher als der ursprüngliche,
    // sehr weiche reine Sinuston.
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(beep.ctx.destination);
    gain.gain.setValueAtTime(0.18, beep.ctx.currentTime);
    osc.start();
    osc.stop(beep.ctx.currentTime + duration / 1000);
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}

/* Ein Piepton wird zwar synchron zum Sekunden-Tick ausgelöst, kommt beim
   Hören aber trotzdem noch minimal nach der sichtbaren Änderung an (Geräte-
   /Browser-Audiolatenz lässt sich softwareseitig nicht "in die
   Vergangenheit" vorziehen). Stattdessen wird hier der gegenteilige Hebel
   genutzt: das BILD (Zahl/Ring/Übergang) wird um denselben Betrag NACH dem
   Ton gezeigt, statt gleichzeitig — im Ergebnis wirkt der Ton dann relativ
   zum Bild "vorgezogen". Bei Bedarf einfach diese eine Zahl anpassen. */
const FB_AUDIO_LEAD_MS = 70;

/* Hält die Audio-Ausgabe während eines laufenden Ablaufs durchgehend wach
   (für Menschen unhörbar: 20Hz, praktisch Lautstärke 0), damit sie zwischen
   zwei echten Pieptönen (z. B. über eine ganze Hang-Phase hinweg) nicht in
   den Stromspar-Ruhezustand fällt — sonst wacht sie beim nächsten echten
   Piepton (beepTick/beepStart/beepEnd) spürbar verzögert auf. Wird bei
   jedem Sekunden-Tick im Fingerboard-Ablauf mitaufgerufen (siehe tickBlock/
   tickPreCountdown), kostet dabei praktisch nichts. */
function audioKeepWarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    if (beep.ctx.state === 'suspended') beep.ctx.resume();
    const osc = beep.ctx.createOscillator();
    const gain = beep.ctx.createGain();
    osc.frequency.value = 20;
    gain.gain.setValueAtTime(0.00001, beep.ctx.currentTime);
    osc.connect(gain); gain.connect(beep.ctx.destination);
    osc.start();
    osc.stop(beep.ctx.currentTime + 0.05);
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}

/* Zwei akustische Signale statt eines einzelnen Tons pro Ereignis:
   - beepTick(): ein kurzer Piep pro Sekunde — sowohl beim Vorbereitungs-
     Countdown (letzte 3 von 5 Sekunden) als auch am Ende einer Pause
     (letzte 3 Sekunden), damit man auch ohne hinzuschauen merkt, dass es
     gleich weitergeht.
   - beepStart()/beepEnd(): der Wechsel Hang↔Pause. "Start" ist der
     wichtigste Moment (jetzt sofort losgreifen/loslegen) und bekam bisher
     denselben Ton wie "Ende" — im Trainingslärm/ohne hinzuschauen kaum
     auseinanderzuhalten. Start ist jetzt ein höherer, aufsteigender
     Doppelton (klar als "Los!" erkennbar), Ende bleibt der bisherige
     einzelne, tiefere Ton (bewusst "ruhiger" für die Pause). */
function beepTick() {
  beep(1400, 90);
}
function beepStart() {
  beep(1568, 110);
  setTimeout(() => beep(1976, 170), 130);
}
function beepEnd() {
  beep(1046, 380);
}

/* Gong-Schlag für die Gym-Pausenuhr: statt eines Pieptons mehrere
   Sinus-Teiltöne mit leicht unharmonischen Verhältnissen (typisch für
   Gong/Klangschale), kurzer Anschlag und langes, weiches Ausklingen.
   gongStrikes(n) schlägt n-mal hintereinander, damit man die Pausenlänge
   auch ohne hinzuschauen am Gehör abzählen kann. */
function gong(when) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    const ctx = beep.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = when ?? ctx.currentTime;
    const base = 220;
    const partials = [[1, 0.22, 2.6], [2.02, 0.09, 1.8], [2.74, 0.06, 1.3], [4.1, 0.03, 0.8]];
    partials.forEach(([ratio, vol, decay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    });
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}
function gongStrikes(n) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!beep.ctx) beep.ctx = new Ctx();
    const start = beep.ctx.currentTime;
    for (let i = 0; i < n; i++) gong(start + i * 0.9);
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}

async function requestWakeLock() {
  if (fb.wakeLock) return; // schon aktiv — nicht doppelt anfordern (würde den Handle auf das alte Lock verlieren)
  try {
    if ('wakeLock' in navigator) {
      fb.wakeLock = await navigator.wakeLock.request('screen');
      // Der Browser gibt das Lock automatisch frei, sobald der Tab in den
      // Hintergrund geht (Screen aus, App-Wechsel, ...) — OHNE dass wir das
      // sonst mitbekommen. fb.wakeLock zeigte danach fälschlich weiter auf
      // ein bereits totes Lock, wodurch der obige Frühausstieg jede weitere
      // Anfrage stillschweigend blockierte und der Screen nie wieder
      // wachgehalten wurde. Sentinel hier zurücksetzen, sobald es freigegeben
      // wird, damit ein späterer requestWakeLock()-Aufruf (siehe
      // visibilitychange unten) tatsächlich neu anfordert.
      fb.wakeLock.addEventListener('release', () => { fb.wakeLock = null; });
    }
  } catch (e) { /* ignorieren */ }
}
function releaseWakeLock() {
  if (fb.wakeLock) { fb.wakeLock.release().catch(() => {}); fb.wakeLock = null; }
}
/* Kommt der Tab aus dem Hintergrund zurück (Screen wieder an, App wieder
   im Vordergrund), während eigentlich noch ein Ablauf/eine Session läuft,
   das Lock aber (siehe oben) automatisch verfallen ist — sofort neu
   anfordern, statt erst beim nächsten Satzwechsel. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const sessionActive = fb.running || fb.preCount != null || !!fsWorkTimer.intervalId || !!fsRestTimer.intervalId;
  if (sessionActive) requestWakeLock();
});

function startAblauf() {
  fb.blockIndex = 0;
  fb.running = false;
  fb.awaitingNext = true;
  fb.preCount = null;
  fb.runResults = [];
  fb.showOverview = false;
  clearTimeout(fb.losTimeoutId);
  fb.showLos = false;
  fbCheckinTyping = false;
  openFbOverlay();
}

/* Ergebnis-Eintrag für einen Block anlegen, falls noch nicht geschehen —
   idempotent, damit sowohl der Check-in-Aufruf während der Pause als auch
   das Sicherheitsnetz in advanceBlock() (falls keine Pause Zeit dafür
   liess) dieselbe Funktion nutzen können, ohne sich zu überschreiben.
   Vorbelegung ist immer "alles geschafft" bzw. Zielwerte/letztes Gewicht —
   wer nichts anfasst, bekommt genau das geloggt. */
function initBlockResult(index) {
  if (fb.runResults[index]) return;
  const block = fb.blocks[index];
  if (!block) return;
  if (block.type === 'pause') {
    fb.runResults[index] = { type: 'pause' };
    return;
  }
  if (block.type === 'campus' || isHoldModeBlock(block)) {
    // Campus-Züge und Halten-Griffblock-Sätze sind wie Hang-Sätze binär
    // "geschafft/nicht" pro Wiederholung, keine variable Wdh./Gewicht-
    // Erfassung wie bei Übungen.
    fb.runResults[index] = { type: block.type, doneReps: new Array(block.reps).fill(true) };
  } else if (block.type === 'block') {
    // Wiederholungen-Griffblock: Gewicht ist bereits bekannt/eingestellt
    // (kein Verlauf wie bei Übungen nötig) — als Vorbelegung übernehmen.
    fb.runResults[index] = { type: 'block', reps: block.reps, weight: block.weight != null ? block.weight : '' };
  } else {
    const last = lastValueForExercise(block.exerciseId);
    fb.runResults[index] = { type: 'exercise', reps: block.reps, weight: last && last.weight != null ? last.weight : '' };
  }
}

/* Baut das Check-in-Panel (Chips fürs Hang, Wdh./Gewicht fürs Übungs-
   Set) und verdrahtet es — genutzt sowohl beim Öffnen während der
   Pause (tickBlock) als auch bei einem vollen Neurendern der Bühne
   (renderFbOverlay), z. B. nach Pause/Weiter, damit der Zwischenstand
   nicht verloren geht. */
function checkinPanelHtml(index) {
  const result = fb.runResults[index];
  if (!result || result.type === 'pause') return '';
  if (result.doneReps) {
    return `
      <div class="fb-checkin-label mono">GESCHAFFTE SÄTZE</div>
      <div class="fb-checkin-chips">
        ${result.doneReps.map((ok, i) => `<button type="button" class="fb-chip ${ok ? 'ok' : 'fail'}" data-satz="${i}">${i + 1}</button>`).join('')}
      </div>
    `;
  }
  return `
    <div class="fb-checkin-label mono">GESCHAFFT</div>
    <form id="fb-checkin-form" class="fb-checkin-row">
      <input type="text" inputmode="numeric" enterkeyhint="done" id="fb-checkin-reps" value="${esc(String(result.reps))}" placeholder="Wdh.">
      <div class="kg-field"><input type="number" inputmode="decimal" enterkeyhint="done" id="fb-checkin-weight" value="${esc(String(result.weight))}" step="0.5" placeholder="0"><span class="mono">kg</span></div>
    </form>
  `;
}
function wireCheckinPanel(index) {
  const holder = document.getElementById('fb-checkin');
  const result = fb.runResults[index];
  if (!holder || !result || result.type === 'pause') return;
  if (result.doneReps) {
    holder.querySelectorAll('.fb-chip').forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.satz);
        result.doneReps[i] = !result.doneReps[i];
        btn.classList.toggle('ok', result.doneReps[i]);
        btn.classList.toggle('fail', !result.doneReps[i]);
      };
    });
  } else {
    const repsEl = document.getElementById('fb-checkin-reps');
    const weightEl = document.getElementById('fb-checkin-weight');
    const formEl = document.getElementById('fb-checkin-form');
    repsEl.oninput = (e) => { result.reps = e.target.value; };
    weightEl.oninput = (e) => { result.weight = e.target.value === '' ? '' : Number(e.target.value); };
    // Zeit anhalten, solange getippt wird — sonst reisst der Countdown
    // mitten in der Eingabe ab, bevor man fertig ist.
    [repsEl, weightEl].forEach((el) => {
      el.onfocus = () => { fbCheckinTyping = true; fbCheckinPausedAt = Date.now(); el.select(); }; // Vorbelegung markiert, direkt überschreibbar
      el.onblur = () => {
        fbCheckinTyping = false;
        // Getippte Dauer war für den Countdown angehalten (s.o.) — muss
        // deshalb auch beim Ring nachgeholt werden, sonst zählt die Zeit
        // im Feld fälschlich als "verstrichen" (siehe syncFbRingAnimation)
        // und der Ring springt beim Verlassen des Felds nach vorne.
        if (fbCheckinPausedAt) { fb.stepStartedAt += Date.now() - fbCheckinPausedAt; fbCheckinPausedAt = null; }
        syncFbRingAnimation();
      };
      // Enter/"Fertig" auf der virtuellen Tastatur soll das Feld verlassen
      // statt es fokussiert zu lassen — sonst bleibt fbCheckinTyping hängen
      // und der Countdown steht, bis man manuell woanders hintippt. Manche
      // virtuellen Tastaturen (v. a. bei type="number"/IME-Eingabe) feuern
      // dafür kein brauchbares keydown — deshalb zusätzlich der Submit
      // des umschliessenden <form> unten, den so gut wie jede Tastatur
      // beim Antippen der Enter-/Fertig-Taste auslöst.
      el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
    });
    if (formEl) formEl.onsubmit = (e) => { e.preventDefault(); document.activeElement && document.activeElement.blur(); };
  }
}
/* Öffnet das Check-in fürs gerade beendete Set — wird genau beim Eintritt
   in die abschliessende Pause des Blocks aufgerufen (tickBlock), läuft
   also nebenher, ohne den Ablauf zu unterbrechen: Standard ist "alles
   geschafft"/Zielwerte, wer nichts antippt, bekommt genau das geloggt,
   sobald die Pause endet und advanceBlock() den nächsten Satz einläutet. */
function openBlockCheckin() {
  initBlockResult(fb.blockIndex);
  const holder = document.getElementById('fb-checkin');
  if (!holder) return;
  holder.hidden = false;
  holder.innerHTML = checkinPanelHtml(fb.blockIndex);
  wireCheckinPanel(fb.blockIndex);
}

/* Tap auf "LOS" (nur ganz am Anfang nötig): der Ablauf läuft danach von
   selbst durch alle Sätze — Hang-Sätze, Übungs-Sätze, die Pause dazwischen,
   der nächste Satz — ohne dass man nochmal etwas antippen muss. Der
   Bildschirm bleibt dabei durchgehend an (ein einziges Wake-Lock von hier
   bis zum Ende/Abbruch, nicht pro Satz neu). Play/Pause bleibt jederzeit
   möglich, ist aber optional. */
function startCurrentBlock() {
  fb.awaitingNext = false;
  requestWakeLock();
  beginBlock();
}

/* Startet fb.blockIndex: bei Hang- UND Campus-Sätzen erst ein Countdown
   zum Hinlaufen/Hände-ans-Board-Bekommen, danach automatisch der Timer;
   bei Fixübungen direkt der Timer (kein Board, zu dem man erst hinmuss).
   Der Countdown ist aber NUR vorm allerersten Satz des ganzen Ablaufs
   nötig — bei jedem weiteren Hang-/Campus-/Lifting-Pin-Satz gab es davor
   schon die abschliessende Pause des vorherigen Satzes, die genau diese
   Vorbereitungszeit bereits mitbringt; ein zweiter, separater 15s-
   Countdown wäre nur Leerlauf oben drauf.
   Wird sowohl beim allerersten Satz als auch bei jedem automatischen
   Weiterschalten sowie bei Zurück/Weiter aufgerufen — ein einziger
   Einstiegspunkt statt Sonderfällen pro Aufrufer. */
const FB_PRECOUNT_SECONDS = 10;
function beginBlock() {
  const block = fb.blocks[fb.blockIndex];
  if (!block) { finishAblauf(); return; }
  requestWakeLock();
  const needsPrecount = fb.blockIndex === 0 && (block.type === 'hang' || block.type === 'campus' || block.type === 'block');
  if (needsPrecount) {
    fb.preCount = FB_PRECOUNT_SECONDS;
    renderFbOverlay();
    fb.intervalId = setInterval(tickPreCountdown, 1000);
  } else {
    startSequence();
  }
}

/* Countdown vorzeitig beenden (Zeit reicht schon) ODER weil er abgelaufen
   ist — beides landet in derselben Übergabe an startSequence(), damit
   "Jetzt starten" und "Countdown fertig" exakt denselben Weg nehmen. */
function finishPreCountdown() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  fb.preCount = null;
  startSequence();
}

function tickPreCountdown() {
  audioKeepWarm();
  fb.preCount--;
  if (fb.preCount <= 0) { finishPreCountdown(); return; }
  if (fb.preCount <= 3) beepTick();
  setTimeout(renderFbOverlay, FB_AUDIO_LEAD_MS); // siehe FB_AUDIO_LEAD_MS — Ton vor Bild
}

function startSequence() {
  const block = fb.blocks[fb.blockIndex];
  fb.running = true;
  fb.sequence = buildBlockSequence(block, fb.blockIndex === fb.blocks.length - 1);
  fb.stepIndex = 0;
  fb.secondsLeft = fb.sequence[0].seconds;
  fb.stepStartedAt = Date.now();
  fb.pausedAt = null;
  fb.intervalId = setInterval(tickBlock, 1000);
  beepStart();
  // "LOS!" blitzt auch hier kurz auf (siehe advanceToNextStep) — gilt für
  // JEDEN Satzstart über diesen Weg: nach dem Vorbereitungs-Countdown vorm
  // allerersten Satz genauso wie beim automatischen Start jedes weiteren
  // Blocks (der ja keinen eigenen Countdown mehr bekommt).
  fb.showLos = true;
  clearTimeout(fb.losTimeoutId);
  fb.losTimeoutId = setTimeout(() => { fb.showLos = false; updateTimerUI(); }, 600);
  renderFbOverlay();
  updateTimerUI();
}

/* Schritt-Ende (Timer abgelaufen ODER manuell per "Wiederholungen
   geschafft" vorzeitig beendet, siehe fbFinishRepsWork) — an einer Stelle,
   damit beide Wege exakt gleich behandelt werden: nächste Phase im selben
   Satz (z. B. Work -> Pause) ODER, falls die Sequenz zu Ende ist, der
   nächste Satz. Gibt true zurück, wenn advanceBlock() übernommen hat (der
   Aufrufer soll dann nicht mehr selbst weiterrendern, da beginBlock()/
   finishAblauf() das schon erledigt haben). */
function advanceToNextStep() {
  fb.stepIndex++;
  if (fb.stepIndex >= fb.sequence.length) {
    clearInterval(fb.intervalId);
    fb.intervalId = null;
    beep(1318, 300);
    advanceBlock();
    return true;
  }
  fb.secondsLeft = fb.sequence[fb.stepIndex].seconds;
  fb.stepStartedAt = Date.now();
  const newStep = fb.sequence[fb.stepIndex];
  if (isWorkPhase(newStep)) {
    beepStart();
    // "LOS!" blitzt kurz statt der Zahl auf — füllt genau die Lücke, die
    // sonst entsteht, nachdem die letzte Ziffer der Pause weggeflogen ist
    // (siehe rest-tense/fbFlyDigitsHtml), bevor die neue Satz-Zeit zu
    // laufen beginnt.
    fb.showLos = true;
    clearTimeout(fb.losTimeoutId);
    fb.losTimeoutId = setTimeout(() => { fb.showLos = false; updateTimerUI(); }, 600);
  } else {
    beepEnd();
  }
  // Letzte Pause des Blocks (danach kommt der nächste Satz) — genau hier
  // ist Zeit fürs Check-in, ohne den Ablauf zu unterbrechen: es läuft
  // nebenher während der ohnehin schon geplanten Erholung.
  if (fbIsTrailingPause()) openBlockCheckin();
  return false;
}

/* Treibt #fb-ring-fg über eine ECHTE CSS-Animation an (statt den Offset
   einmal pro Sekunde per JS zu setzen und drüber zu transitionieren) — der
   Ring läuft dadurch exakt in Echtzeit mit (animation-delay ist die seit
   Schrittbeginn verstrichene Zeit, negativ, damit die Animation an genau
   der richtigen Stelle "einsteigt"), unabhängig vom 1x/Sekunde-Tick-Timing
   und ohne dass am Phasenende manuell auf "geschlossen" gesprungen werden
   müsste — die Animation erreicht stroke-dashoffset:0 von selbst exakt im
   richtigen Moment. Bei "prefers-reduced-motion" (siehe auch styles.css)
   stattdessen wie bisher ein statischer, aus fb.secondsLeft berechneter
   Wert ohne Animation. Muss bei jedem echten Schrittwechsel neu aufgerufen
   werden (frisches DOM-Element durch renderFbOverlay ODER derselbe Ring-
   Knoten bei einem gezielten Update in tickBlock) — NICHT bei jedem
   laufenden Tick innerhalb derselben Phase, sonst würde die Animation
   ständig neu gestartet statt einfach weiterzulaufen. */
function syncFbRingAnimation() {
  const ring = document.getElementById('fb-ring-fg');
  if (!ring) return;
  const step = fb.sequence[fb.stepIndex];
  const phaseTotal = step ? step.seconds : 1;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !phaseTotal) {
    ring.style.animation = 'none';
    ring.style.strokeDashoffset = (FB_RING_CIRCUMFERENCE * (phaseTotal ? fb.secondsLeft / phaseTotal : 0)).toFixed(1);
    return;
  }
  const elapsedSec = Math.max(0, (Date.now() - fb.stepStartedAt) / 1000);
  ring.style.animation = 'none';
  ring.getBoundingClientRect(); // Reflow erzwingen, damit der Neustart unten wirklich greift
  ring.style.animation = `fbRingFill ${phaseTotal}s linear forwards`;
  ring.style.animationDelay = `-${elapsedSec}s`;
  ring.style.animationPlayState = (fb.intervalId && !fbCheckinTyping) ? 'running' : 'paused';
}

function tickBlock() {
  if (fbCheckinTyping) return; // Zeit angehalten, solange man im Check-in tippt
  audioKeepWarm();
  fb.secondsLeft--;
  const step = fb.sequence[fb.stepIndex];
  if (fb.secondsLeft <= 0) {
    if (advanceToNextStep()) return; // advanceBlock() hat schon (inkl. Ring) neu gerendert
    if (fbIsTrailingPause()) {
      // Übergang in die ABSCHLIESSENDE Pause: Titel/Bild wechseln jetzt auf
      // den NÄCHSTEN Block (siehe renderFbOverlay/fbStageDisplayInfo), der
      // ein komplett anderer Satz-Typ sein kann (anderes Layout: Board-
      // Thumb vs. kombinierte Figur) — ein gezieltes Update reicht dafür
      // nicht, hier lohnt sich ein voller Re-Render (passiert nur einmal
      // pro Block, kein Performance-Problem); baut den Ring frisch, dessen
      // Animation läuft über syncFbRingAnimation() am Ende von
      // renderFbOverlay() mit an. Verzögert (siehe FB_AUDIO_LEAD_MS), damit
      // der eben ausgelöste Ton (advanceToNextStep) dem Bild vorausläuft.
      setTimeout(renderFbOverlay, FB_AUDIO_LEAD_MS);
      return;
    }
    // Gleicher Ring-Knoten bleibt bestehen (kein voller Re-Render nötig) —
    // Animation für die neue Phase explizit neu ansetzen, ebenfalls
    // verzögert (siehe oben).
    setTimeout(syncFbRingAnimation, FB_AUDIO_LEAD_MS);
  } else if (step && !isWorkPhase(step) && fb.secondsLeft <= 3) {
    // Letzte 3 Sekunden einer Pause: kurzer Tick pro Sekunde als
    // akustische Vorwarnung, dass der nächste Satz gleich losgeht.
    beepTick();
  }
  setTimeout(updateTimerUI, FB_AUDIO_LEAD_MS);
}

/* "Wiederholungen geschafft — weiter" bei Fixübungen/Lifting-Pin-Reps:
   beendet nur die gerade laufende ARBEITS-Phase vorzeitig (wie ein
   abgelaufener Timer) und geht in die danach ohnehin vorgesehene Pause —
   bei diesen Blöcken (Sequenz immer nur Work+Pause) ist das automatisch
   IMMER die abschliessende Pause, deshalb hier direkt voll neu rendern
   (zeigt dann schon den nächsten Block, siehe renderFbOverlay), statt nur
   gezielt zu aktualisieren. Der laufende Interval-Timer bleibt unverändert
   (tickt weiter für die neue Pause-Phase) — anders als fbStepForward()
   (⏭/Wischen), das auch ausserhalb der Arbeitsphase funktionieren muss und
   deshalb den Timer selbst neu aufsetzt. */
function fbFinishRepsWork() {
  if (advanceToNextStep()) return;
  renderFbOverlay();
}

/* Satz fertig -> sofort weiter zum nächsten (kein Warten auf einen erneuten
   Tap) — das war der eigentliche Grund für "kein Flow", nicht nur die
   Reihenfolge der Bau-Oberfläche. */
function advanceBlock() {
  // Sicherheitsnetz: Blöcke ohne Pause danach (restSec 0) hatten keine Zeit
  // fürs Check-in während des Laufs — hier trotzdem die Standardwerte
  // eintragen, damit jeder Block ein Ergebnis für die Übersicht am Ende hat.
  initBlockResult(fb.blockIndex);
  fb.blockIndex++;
  fb.running = false;
  if (fb.blockIndex >= fb.blocks.length) {
    releaseWakeLock();
    finishAblauf();
  } else {
    beginBlock();
  }
}

function updateTimerUI() {
  const big = document.getElementById('fb-big');
  const phase = document.getElementById('fb-phase');
  const ring = document.getElementById('fb-ring-fg');
  const figureHolder = document.getElementById('fb-phase-figure');
  const stageLabel = document.getElementById('fb-stage-label');
  const block = fb.blocks[fb.blockIndex];
  const step = fb.sequence[fb.stepIndex];
  const working = isWorkPhase(step);
  // Letzte 5 Sekunden einer Pause optisch hervorheben (Farbe + Pulsieren),
  // damit man auch aus der Distanz merkt, dass es gleich weitergeht. Die
  // letzten 3 Sekunden (synchron zu den beepTick()-Pieptönen, siehe
  // tickBlock) bekommen zusätzlich einen deutlich kräftigeren Effekt statt
  // nur des sanften Dauer-Pulsierens — inkl. spürbar grösserer Zahl.
  const restWarn = !working && fb.secondsLeft > 0 && fb.secondsLeft <= 5;
  const restTense = !working && fb.secondsLeft > 0 && fb.secondsLeft <= 3;
  const workTense = working && fb.secondsLeft > 0 && fb.secondsLeft <= 3;
  // Während JEDER Pause (nicht nur der abschliessenden) ist die Kopfzeile
  // (Griff/Übungsdetails) das Einzige, was noch verrät, was als Nächstes
  // drankommt, war aber immer winzig — jetzt spürbar besser lesbar. Die
  // abschliessende Pause zeigt dort nur den kurzen "NEXT: ..."-Titel und
  // bekommt weiter die grosse Next-Schrift; Pausen MIT verbleibenden
  // Wiederholungen zeigen den oft langen Griff-/Muster-Text (siehe
  // headerText in renderFbOverlay) — dort nur moderat vergrössert, damit
  // z. B. lange Campus-Muster nicht den Bildschirm sprengen.
  if (stageLabel) {
    const trailingNow = fbIsTrailingPause();
    stageLabel.classList.toggle('fb-stage-label-next', !working && trailingNow);
    stageLabel.classList.toggle('fb-stage-label-readable', !working && !trailingNow);
  }

  if (big) {
    // innerHTML statt textContent: sowohl für "LOS!" als auch für die
    // rest-tense-Ziffern (jede ein eigenes <span>, siehe fbFlyDigitsHtml)
    // nötig, damit die jeweilige Animation bei jedem Tick als frisches
    // Element neu von vorne losläuft.
    big.innerHTML = fbBigContent(restTense);
    big.className = 'big' + (working ? '' : ' rest') + (restWarn ? ' rest-warn' : '') + (restTense ? ' rest-tense' : '') + (workTense ? ' work-tense' : '') + (fb.showLos ? ' los-flash' : '');
  }
  // Während der abschliessenden Pause (isTrailingPause) zeigt das grosse
  // Bild/der Titel schon den NÄCHSTEN Block (siehe renderFbOverlay) — das
  // wird dort einmalig beim vollen Rendern gesetzt und bleibt für die
  // Dauer dieser Pause gültig (blockIndex/stepIndex ändern sich erst beim
  // nächsten Block), deshalb hier einfach griffbereit neu berechnet.
  const isTrailingPauseNow = fbIsTrailingPause();
  const displayBlockNow = isTrailingPauseNow ? (fb.blocks[fb.blockIndex + 1] || block) : block;
  const displayIsHangNow = isHangLikeBlock(displayBlockNow);
  if (phase) {
    let phaseText;
    if (isTrailingPauseNow) {
      phaseText = 'Pause';
    } else if (step && step.rep != null) {
      const remaining = block.reps - step.rep - 1;
      phaseText = working ? `${step.phase} · Satz ${step.rep + 1}/${block.reps}` : `Pause · noch ${remaining} ${remaining === 1 ? 'Satz' : 'Sätze'}`;
    } else {
      phaseText = step ? step.phase : '';
    }
    phase.textContent = phaseText;
  }
  if (ring) {
    // Der Füllstand selbst läuft über die CSS-Animation aus
    // syncFbRingAnimation() (echtzeit-synchron, hier nichts zu tun) — nur
    // bei prefers-reduced-motion gibt's keine Animation, dort hier bei
    // jedem Tick den statischen Wert nachziehen.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const phaseTotal = step ? step.seconds : 1;
      ring.style.strokeDashoffset = (FB_RING_CIRCUMFERENCE * (phaseTotal ? fb.secondsLeft / phaseTotal : 0)).toFixed(1);
    }
    ring.classList.toggle('rest', !working);
    ring.classList.toggle('rest-warn', restWarn);
    ring.classList.toggle('rest-tense', restTense);
    ring.classList.toggle('work-tense', workTense);
  }
  const hangVisual = document.querySelector('#fb-overlay .fb-hang-visual');
  if (hangVisual) hangVisual.classList.toggle('rest-tense', restTense);
  // Schlüssel enthält zusätzlich die aktuelle Wiederholung (rep) — beim
  // Lifting Pin mit Hand-Wechsel pro Satz UND restSec=0 (keine Pause
  // zwischen den Wiederholungen) bliebe "kind" sonst durchgehend "work",
  // die Figur würde beim Handwechsel nie neu gezeichnet.
  const activeRep = working && step ? step.rep : null;
  const kind = (working ? 'work' : 'rest') + ':' + (activeRep != null ? activeRep : '') + (isTrailingPauseNow ? ':next' : '');
  if (figureHolder && figureHolder.dataset.kind !== kind) {
    if (working) {
      figureHolder.innerHTML = isHangLikeBlock(block) ? holdBlockWorkFigure(block, activeRep) : block.type === 'campus' ? campusWorkFigureSvg(block, false) : exerciseFigureSvg(block.exerciseId);
    } else if (displayIsHangNow) {
      // Layout mit separatem Board-Thumb oben (schon beim vollen Rendern
      // gesetzt, hier unberührt) — die kleine Figur bleibt die Ruhefigur.
      figureHolder.innerHTML = FB_REST_FIGURE_SVG;
    } else {
      // Kombinierte Grossfigur (kein separater Board-Thumb): während der
      // abschliessenden Pause die Vorschau des nächsten Blocks zeigen.
      figureHolder.innerHTML = isTrailingPauseNow
        ? (displayBlockNow.type === 'campus' ? campusWorkFigureSvg(displayBlockNow) : displayBlockNow.type === 'pause' ? FB_REST_FIGURE_SVG : exerciseFigureSvg(displayBlockNow.exerciseId))
        : block.type === 'campus' ? campusWorkFigureSvg(block) : FB_REST_FIGURE_SVG;
    }
    figureHolder.dataset.kind = kind;
  }
  const repsDoneBtn = document.getElementById('fb-reps-done');
  if (repsDoneBtn) repsDoneBtn.hidden = !working;
  // Aktive Hand beim Lifting Pin ändert sich pro Wiederholung — das
  // fb-stage-label selbst wird nur einmal pro Satz komplett aufgebaut
  // (renderFbOverlay), deshalb hier gezielt nur die Hand-Anzeige darin
  // nachziehen, statt das ganze Label (inkl. Titel/Griff) neu zu bauen.
  // Nur während einer laufenden Arbeitsphase nötig (nur dort ändert sich
  // pro Tick etwas) — während einer Pause stünde hier sonst fälschlich
  // wieder das Muster des AKTUELLEN statt des in der Vorschau gezeigten
  // nächsten Blocks.
  const handNoteEl = document.getElementById('fb-hand-note');
  if (handNoteEl && working && block && block.type === 'block') handNoteEl.textContent = blockArmNote(block, activeRep);
  // Analog: die "Arme"-Regel-Kachel (siehe fbFactChipsHtml) zeigt beim
  // Lifting Pin im Wechsel-Modus dieselbe pro-Wiederholung wechselnde Hand.
  const factArmEl = document.getElementById('fb-fact-arm');
  if (factArmEl && working && block && block.type === 'block') factArmEl.textContent = fbFactArmText(block, activeRep);
  updateFbUpcomingUI();
  updateFbProgressUI();
}

function cancelAblauf() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  releaseWakeLock();
  fb.running = false;
  fb.awaitingNext = false;
  fb.preCount = null;
  fb.blockIndex = 0;
  clearTimeout(fb.losTimeoutId);
  fb.showLos = false;
  fbCheckinTyping = false;
  closeFbOverlay();
  renderFbRuntime();
}

/* Vorzeitiges Beenden: z. B. nach 30 Min. reicht es, aber der bisherige
   Fortschritt (schon fertig gemachte Blöcke) soll trotzdem gespeichert
   und teilbar sein statt komplett zu verfallen wie bei cancelAblauf().
   Nur wirklich ABGESCHLOSSENE Blöcke (Index < fb.blockIndex) zählen —
   der gerade laufende, noch nicht fertige Block würde sonst fälschlich
   als "alles geschafft" geloggt (initBlockResult-Vorbelegung). */
async function finishAblaufEarly() {
  if (fb.blockIndex <= 0) {
    toast('Noch kein Satz abgeschlossen zum Speichern.', 'err');
    return;
  }
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  const doneBlocks = fb.blocks.slice(0, fb.blockIndex);
  const doneResults = fb.runResults.slice(0, fb.blockIndex);
  await finishAblauf(doneBlocks, doneResults, true);
}

/* Übersicht am Ende: pro Block, was tatsächlich geschafft wurde (nicht nur
   was geplant war) — Hang-Sätze als X/Y, Übungs-Sätze als geloggte
   Wdh.×kg. Headline zählt nur die Hang-Sätze (einzige Ja/Nein-Metrik). */
function fbResultsSummaryHtml(blocks, results) {
  let totalReps = 0;
  let doneReps = 0;
  const rows = blocks.map((b, i) => {
    const r = results[i];
    if (!r || r.type === 'pause') return '';
    if (r.doneReps) {
      // Hang, Campus oder Halten-Griffblock — binäres geschafft/nicht pro Satz.
      const done = r.doneReps.filter(Boolean).length;
      totalReps += r.doneReps.length;
      doneReps += done;
      const label = r.type === 'campus' ? campusLabel(b) : r.type === 'block' ? esc(blockGripLabel(b)) : esc(hangGripLabel(b));
      return `<div class="fb-summary-row"><span>${label}</span><span class="mono">${done}/${r.doneReps.length}</span></div>`;
    }
    // Echte Übung ODER Wiederholungen-Griffblock — geloggte Wdh.×Gewicht.
    const weightText = r.weight !== '' && r.weight != null ? ` × ${esc(String(r.weight))}kg` : '';
    const label = r.type === 'block' ? esc(blockGripLabel(b)) : esc(exerciseName(b.exerciseId));
    return `<div class="fb-summary-row"><span>${label}</span><span class="mono">${esc(String(r.reps))}${weightText}</span></div>`;
  }).join('');
  const headline = totalReps ? `<div class="fb-summary-headline mono">${doneReps}/${totalReps} Sätze geschafft</div>` : '';
  return `${headline}<div class="fb-summary-list">${rows}</div>`;
}

/* blocksOverride/resultsOverride: nur beim vorzeitigen Beenden gesetzt
   (siehe finishAblaufEarly) — dann zählen NUR die tatsächlich
   abgeschlossenen Blöcke, nicht der volle geplante Ablauf. */
async function finishAblauf(blocksOverride, resultsOverride, isPartial) {
  fb.running = false;
  fb.awaitingNext = false;
  fb.blockIndex = 0;
  releaseWakeLock();
  beep(1568, 400);

  const blocks = blocksOverride || fb.blocks;
  const results = resultsOverride || fb.runResults.slice();
  // Board des tatsächlich durchgeführten Ablaufs, NICHT das gerade aktuell
  // ausgewählte fb.board — beim Teilen als Challenge/in der Verlauf-Historie
  // zeigte sonst z. B. "Beastmaker 2000" an, obwohl der Ablauf mit Sätzen
  // auf dem BM1000 durchgeführt wurde, nur weil das eigene Board inzwischen
  // (oder nie) auf BM1000 gestellt war.
  const board = (blocks.find((b) => b.type === 'hang') || {}).board || fb.board;
  const estimateSeconds = blocks.reduce((total, b) => total + fbBlockSeconds(b), 0);

  const el = ensureFbOverlay();
  el.innerHTML = `
    <div class="fb-overlay-inner fb-overlay-done">
      <div class="fb-done-emoji">${isPartial ? '💪' : '🎉'}</div>
      <div class="fb-stage-title">${isPartial ? 'Vorzeitig beendet & gespeichert' : 'Ablauf geschafft!'}</div>
      <div class="fb-stage-sub mono">${blocks.length} Sätze · ${fmtMinSec(estimateSeconds)} Trainingszeit</div>
      ${fbResultsSummaryHtml(blocks, results)}
      ${challengeDurationChipsHtml('fb-share', CHALLENGE_WINDOW_H)}
      <button class="btn fb-stage-btn ghost" id="fb-overlay-share">Als Challenge teilen</button>
      <button class="btn fb-stage-btn" id="fb-overlay-finish">Schliessen</button>
    </div>
  `;
  wireChallengeDurationChips('fb-share');
  document.getElementById('fb-overlay-finish').onclick = () => { closeFbOverlay(); renderFbRuntime(); renderFbHistory(); };
  document.getElementById('fb-overlay-share').onclick = async (e) => {
    e.target.disabled = true;
    await shareFingerboardAsChallenge(board, blocks, selectedChallengeHours('fb-share'));
    e.target.textContent = 'Geteilt ✓';
  };
  if (!isPartial) spawnConfetti(document.querySelector('.fb-overlay-done'));

  const session = {
    date: todayKey(),
    board,
    weight: fb.weight || 0,
    blocks,
    results,
    createdAt: Date.now(),
    ...(isPartial ? { partial: true } : {}),
  };
  await fbPush(`fingerboardSessions/${state.member.id}`, session);
  toast('Ablauf gespeichert 💪', 'ok');
}


/* ================================================================
   FORTSCHRITT (Beta)
   Eigene Kurve im Mittelpunkt: pro Übung der beste Satz je Training,
   dazu Wochenübersicht (Gym / Board / Anderes), ein paar Kennzahlen und
   eine grobe Erholungs-Anzeige pro Körperbereich. Kein Vergleich mit
   anderen — nur der eigene Verlauf.
   ================================================================= */
const PROGRESS_COLORS = { gym: '#2f95cf', board: '#c4851c', other: '#9b7be6' }; // validiert (dark, #10151b)
const PROGRESS_RANGES = [['4w', '4W', 28], ['3m', '3M', 91], ['1y', '1J', 365], ['all', 'Alle', 100000]];
let progressRange = '3m';
let progressExerciseId = null;
let progressFbSessions = [];

function dayKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function mondayOf(d) { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; }
function entryTime(e) { return e.createdAt || new Date(e.date + 'T12:00').getTime(); }

/* Bester Satz einer Übung in einem Training: mit Gewicht = schwerstes
   Gewicht (bei Gleichstand mehr Wdh.), ohne Gewicht = meiste Wdh./Sekunden. */
function bestSetOf(exerciseId, sets) {
  let best = null;
  sets.forEach((st) => {
    const w = st.weight !== '' && st.weight != null ? Number(st.weight) : 0;
    const r = Number(st.reps) || 0;
    const score = w > 0 ? w * 1000 + r : r;
    if (!best || score > best.score) best = { w, r, score, suffix: setUnitSuffix(exerciseId, st) };
  });
  if (!best) return null;
  return { ...best, value: best.w > 0 ? best.w : best.r, label: best.w > 0 ? `${best.w} kg × ${best.r}${best.suffix}` : `${best.r}${best.suffix || ' Wdh.'}` };
}

function progressSeries(exerciseId, days) {
  const since = Date.now() - days * 86400000;
  const pts = [];
  state.logs.forEach((e) => {
    if (entryTime(e) < since) return;
    const ex = (e.exercises || []).find((x) => x.exerciseId === exerciseId && Array.isArray(x.sets) && x.sets.length);
    if (!ex) return;
    const best = bestSetOf(exerciseId, ex.sets);
    if (best) pts.push({ t: entryTime(e), date: e.date, ...best });
  });
  return pts.sort((a, b) => a.t - b.t);
}

/* Einfaches Linien-Diagramm (eine Serie, keine Legende nötig — der Titel
   benennt sie). Punkte antippbar: Wert erscheint in der Zeile darunter. */
function progressLineChart(id, pts, unitLabel) {
  if (!pts.length) return '<div class="list-empty">Noch keine Daten in diesem Zeitraum.</div>';
  const W = 340, H = 160, padL = 34, padR = 12, padT = 14, padB = 22;
  const vals = pts.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo; lo -= span * 0.1; hi += span * 0.1;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t) => (t1 === t0 ? (padL + W - padR) / 2 : padL + ((t - t0) / (t1 - t0)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const maxVal = Math.max(...vals);
  const prIdx = vals.lastIndexOf(maxVal);
  const fmt = (v) => (Math.round(v * 10) / 10).toString();
  const minVal = Math.min(...vals);
  const ticks = maxVal === minVal ? [maxVal] : [maxVal, (maxVal + minVal) / 2, minVal];
  const grid = ticks.map((v) =>
    `<line class="pg-grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="pg-axis" x="${padL - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('');
  const line = pts.map((p) => `${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `
    <circle class="pg-hit" cx="${x(p.t).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="16" data-chart="${id}" data-i="${i}"><title>${esc(fmtShortDate(p.date))}: ${esc(p.label)}</title></circle>
    <circle class="pg-dot ${i === prIdx ? 'pr' : ''}" cx="${x(p.t).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${i === prIdx ? 6 : 4}"/>`).join('');
  const dateLabels = [pts[0], pts[pts.length - 1]].filter((p, i, arr) => i === 0 || p !== arr[0])
    .map((p, i) => `<text class="pg-axis" x="${x(p.t).toFixed(1)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : 'end'}">${esc(fmtShortDate(p.date))}</text>`).join('');
  return `
    <svg class="pg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unitLabel)}: ${pts.map((p) => fmtShortDate(p.date) + ' ' + p.label).join(', ')}">
      ${cycleBandsSvg(x, t0, t1, padT, H - padB)}
      ${grid}
      <polyline class="pg-line" points="${line}"/>
      ${dots}${dateLabels}
    </svg>
    <div class="pg-readout" id="${id}-readout">Punkt antippen für Details · Rekord: <b>${esc(pts[prIdx].label)}</b> (${esc(fmtShortDate(pts[prIdx].date))})</div>`;
}

function progressWeekGridHtml() {
  const byDay = {};
  const mark = (key, kind) => {
    const order = { board: 3, gym: 2, other: 1 };
    if (!byDay[key] || order[kind] > order[byDay[key]]) byDay[key] = kind;
  };
  state.logs.forEach((e) => mark(dayKey(new Date(entryTime(e))), e.type === 'gym' || (e.exercises || []).length ? 'gym' : 'other'));
  progressFbSessions.forEach((sn) => mark(dayKey(new Date(entryTime(sn))), 'board'));
  const thisMonday = mondayOf(new Date());
  const cols = [];
  for (let w = 7; w >= 0; w--) {
    const mon = new Date(thisMonday); mon.setDate(mon.getDate() - w * 7);
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(mon); day.setDate(day.getDate() + d);
      const kind = byDay[dayKey(day)];
      const future = day > new Date();
      cells.push(`<span class="pg-cell ${kind || ''} ${future ? 'future' : ''}" title="${pad2(day.getDate())}.${pad2(day.getMonth() + 1)}.${kind ? ' · ' + ({ gym: 'Gym', board: 'Board', other: 'Anderes' })[kind] : ''}"></span>`);
    }
    cols.push(`<div class="pg-week">${cells.join('')}<span class="pg-week-label">${pad2(mon.getDate())}.${pad2(mon.getMonth() + 1)}.</span></div>`);
  }
  return `<div class="pg-weeks">${cols.join('')}</div>
    <div class="pg-legend"><span><i class="gym"></i>Gym</span><span><i class="board"></i>Board</span><span><i class="other"></i>Anderes</span></div>`;
}

function progressStats() {
  const times = [...state.logs.map(entryTime), ...progressFbSessions.map(entryTime)];
  const last30 = times.filter((t) => t > Date.now() - 30 * 86400000).length;
  const weeksWith = new Set(times.map((t) => mondayOf(new Date(t)).getTime()));
  let streak = 0;
  const cur = mondayOf(new Date());
  if (!weeksWith.has(cur.getTime())) cur.setDate(cur.getDate() - 7);
  while (weeksWith.has(cur.getTime())) { streak++; cur.setDate(cur.getDate() - 7); }
  const weekStart = mondayOf(new Date()).getTime();
  let kg = 0;
  state.logs.filter((e) => entryTime(e) >= weekStart).forEach((e) => (e.exercises || []).forEach((ex) => (ex.sets || []).forEach((st) => {
    const w = Number(st.weight); const r = Number(st.reps);
    if (w > 0 && r > 0 && setUnitSuffix(ex.exerciseId, st) !== 's') kg += w * r;
  })));
  return { last30, streak, kg };
}

const RECOVERY_AREAS = [
  { id: 'finger', label: 'Finger', readyH: 72 },
  { id: 'zug', label: 'Zug', readyH: 48, muscles: ['lats', 'traps', 'rear_delts', 'biceps', 'forearms_front', 'forearms_back', 'neck_traps'] },
  { id: 'druck', label: 'Druck', readyH: 48, muscles: ['chest', 'shoulders', 'triceps'] },
  { id: 'beine', label: 'Beine', readyH: 48, muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'shins'] },
  { id: 'rumpf', label: 'Rumpf', readyH: 36, muscles: ['abs', 'obliques', 'lower_back'] },
];
function progressRecoveryHtml() {
  const lastT = {};
  const touch = (id, t) => { if (!lastT[id] || t > lastT[id]) lastT[id] = t; };
  progressFbSessions.forEach((sn) => touch('finger', entryTime(sn)));
  state.logs.forEach((e) => {
    if (e.type === 'klettern') touch('finger', entryTime(e));
    (e.exercises || []).forEach((ex) => {
      const m = exerciseMuscles(ex.exerciseId);
      RECOVERY_AREAS.forEach((a) => { if (a.muscles && m.primary.some((x) => a.muscles.includes(x))) touch(a.id, entryTime(e)); });
    });
  });
  return RECOVERY_AREAS.map((a) => {
    const t = lastT[a.id];
    const h = t ? (Date.now() - t) / 3600000 : null;
    const ratio = h == null ? 1 : Math.min(1, h / a.readyH);
    const ready = h == null || h >= a.readyH;
    const ago = h == null ? 'noch nie' : h < 24 ? 'heute' : `vor ${Math.floor(h / 24)} ${Math.floor(h / 24) === 1 ? 'Tag' : 'Tagen'}`;
    return `<div class="pg-rec">
      <div class="pg-rec-head"><span>${a.label}</span><span class="${ready ? 'ok' : 'wait'}">${ago} · ${ready ? 'bereit' : 'noch schonen'}</span></div>
      <div class="pg-rec-bar"><span class="${ready ? 'ok' : 'wait'}" style="width:${Math.round(ratio * 100)}%"></span></div>
    </div>`;
  }).join('');
}

function fbSessionHangSeconds(sn) {
  let sec = 0;
  (sn.blocks || []).forEach((b, i) => {
    if (b.type !== 'hang') return;
    const r = (sn.results || [])[i];
    const done = r && Array.isArray(r.doneReps) ? r.doneReps.filter(Boolean).length : Number(b.reps) || 0;
    sec += done * (Number(b.hangSec) || 0);
  });
  return sec;
}

/* ---------- Zyklus (freiwillig, nur für die Person selbst) ----------
   Gespeichert privat unter cycle/{memberId}: {consentAt, starts:{'YYYY-MM-DD':true}}.
   Eingetragen wird nur der erste Tag jeder Periode; Phasen und die nächste
   Periode sind eine einfache Schätzung daraus (Eisprung ~14 Tage vor der
   nächsten Periode), kein medizinischer Rat. */
const CYCLE_PERIOD_DAYS = 5;
const CYCLE_DEFAULT_LEN = 28;
const CYCLE_PHASES = {
  mens: { label: 'Menstruation', color: '#e5484d' },
  foll: { label: 'Follikelphase', color: '#3fb68b' },
  ovu: { label: 'Eisprung', color: '#e6b422' },
  lut: { label: 'Lutealphase', color: '#9b7be6' },
};
const DAY_MS = 86400000;
let cycleData = null; // null = aus/noch nicht geladen

function dayStart(key) { return new Date(key + 'T00:00').getTime(); }
function cycleStarts() {
  return Object.keys((cycleData && cycleData.starts) || {}).sort();
}
/* Ø Zykluslänge aus den letzten (max. 6) plausiblen Abständen. */
function cycleAvgLen() {
  const s = cycleStarts();
  const lens = [];
  for (let i = 1; i < s.length; i++) {
    const d = Math.round((dayStart(s[i]) - dayStart(s[i - 1])) / DAY_MS);
    if (d >= 20 && d <= 45) lens.push(d);
  }
  const recent = lens.slice(-6);
  return recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : CYCLE_DEFAULT_LEN;
}
/* Phase an Zyklustag `day` (1-basiert) bei Länge `len`. */
function cyclePhaseOf(day, len) {
  if (day <= CYCLE_PERIOD_DAYS) return 'mens';
  const ovu = len - 14;
  if (day >= ovu - 1 && day <= ovu + 1) return 'ovu';
  return day < ovu ? 'foll' : 'lut';
}
/* Phasen-Abschnitte [{from, to, phase}] (ms) über alle eingetragenen
   Zyklen; der letzte läuft mit der Ø-Länge bis zur geschätzten nächsten Periode. */
function cycleSegments() {
  const s = cycleStarts();
  const avg = cycleAvgLen();
  const segs = [];
  s.forEach((key, i) => {
    const start = dayStart(key);
    const next = s[i + 1] ? dayStart(s[i + 1]) : start + avg * DAY_MS;
    const len = Math.max(1, Math.round((next - start) / DAY_MS));
    for (let d = 1; d <= len; d++) {
      const phase = cyclePhaseOf(d, len);
      const from = start + (d - 1) * DAY_MS;
      const last = segs[segs.length - 1];
      if (last && last.phase === phase && last.to === from) last.to = from + DAY_MS;
      else segs.push({ from, to: from + DAY_MS, phase });
    }
  });
  return segs;
}
/* Heute: Zyklustag, Phase, nächste Periode (Schätzung). */
function cycleToday() {
  const s = cycleStarts();
  if (!s.length) return null;
  const today = dayStart(dayKey(new Date()));
  const last = dayStart(s[s.length - 1]);
  if (today < last) return null;
  const avg = cycleAvgLen();
  const day = Math.round((today - last) / DAY_MS) + 1;
  const next = last + avg * DAY_MS;
  return { day, phase: day > avg ? null : cyclePhaseOf(day, avg), next, inDays: Math.round((next - today) / DAY_MS), avg };
}

/* Farbige Bänder hinter einem Diagramm (x = Zeit → Pixel). */
function cycleBandsSvg(x, t0, t1, top, bottom) {
  if (!cycleData || !cycleStarts().length) return '';
  const lo = t0 === t1 ? t0 - DAY_MS : t0, hi = t0 === t1 ? t1 + DAY_MS : t1;
  return cycleSegments().filter((g) => g.to > lo && g.from < hi).map((g) => {
    const a = x(Math.max(g.from, lo)), b = x(Math.min(g.to, hi));
    return `<rect class="pg-cycle-band" x="${a.toFixed(1)}" y="${top}" width="${Math.max(1, b - a).toFixed(1)}" height="${bottom - top}" fill="${CYCLE_PHASES[g.phase].color}"><title>${CYCLE_PHASES[g.phase].label}</title></rect>`;
  }).join('');
}
function cycleLegendHtml() {
  if (!cycleData || !cycleStarts().length) return '';
  return `<div class="pg-legend pg-cycle-legend">${Object.values(CYCLE_PHASES).map((p) => `<span><i style="background:${p.color}"></i>${p.label}</span>`).join('')}</div>`;
}

function fmtDayLong(ms) {
  const d = new Date(ms);
  return `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

/* Wissen pro Phase — bewusst vorsichtig formuliert: Die Studienlage zu
   Leistung und Zyklus ist dünn und uneinheitlich (Quellen in CYCLE_SOURCES). */
const CYCLE_INFO = {
  mens: {
    tip: 'Nach Befinden trainieren — im Schnitt ist die Leistung höchstens minimal tiefer, Beschwerden sind aber sehr individuell.',
    body: 'Östrogen und Progesteron sind tief.',
    science: 'Eine grosse Meta-Analyse fand in der frühen Follikelphase (während der Periode) höchstens eine sehr kleine Leistungsminderung — mit grossen Unterschieden zwischen Personen [1].',
    practice: 'Einheiten nach Krämpfen/Müdigkeit anpassen statt nach Kalender. Starke Blutungen sind bei Sportlerinnen häufig (rund ein Drittel) und erhöhen das Risiko für Eisenmangel [4] — bei anhaltender Müdigkeit Eisenwerte ärztlich prüfen lassen.',
  },
  foll: {
    tip: 'Normal nach Plan trainieren — ein fester Kraftvorteil in dieser Phase ist nicht belegt.',
    body: 'Östrogen steigt bis kurz vor dem Eisprung an.',
    science: 'Ein Überblick über alle Meta-Analysen fand keinen verlässlichen Einfluss der Zyklusphase auf Maximalkraft oder Muskelaufbau; die Studien sind meist klein und von geringer Qualität [2].',
    practice: 'Fühlst du dich stark, ist das ein guter Moment für harte Einheiten — dein Gefühl ist hier aussagekräftiger als die Phase.',
  },
  ovu: {
    tip: 'Nichts Besonderes nötig — die Leistung ändert sich um den Eisprung nicht verlässlich.',
    body: 'Östrogen erreicht seinen Höhepunkt, kurz darauf folgt der Eisprung.',
    science: 'Eine Übersicht nur über methodisch hochwertige Studien findet meist keine Phasen-Unterschiede bei Kraft, Schnellkraft und Ausdauer [3].',
    practice: 'Normal trainieren. Wann genau der Eisprung ist, schätzt die App nur grob.',
  },
  lut: {
    tip: 'Körpertemperatur ist leicht erhöht — bei Wärme mehr trinken und Pausen einplanen.',
    body: 'Progesteron ist hoch; die Körpertemperatur liegt etwa 0,3–0,7 °C höher.',
    science: 'Eine Meta-Analyse zeigt eine höhere Körperkerntemperatur in der Lutealphase, vor und nach Belastung in der Wärme [5]. Auf Kraft und Leistung gibt es keinen verlässlichen Effekt [2][3].',
    practice: 'In warmen Hallen/Sommer auf Trinken und Pausen achten. Vor der Periode (PMS) kann das Befinden schwanken — Einheiten flexibel halten.',
  },
};
const CYCLE_SOURCES = [
  ['McNulty et al. (2020), Sports Medicine — Meta-Analyse Leistung & Zyklusphase', 'https://doi.org/10.1007/s40279-020-01319-3'],
  ['Colenso-Semple et al. (2023), Frontiers in Sports and Active Living — Kraft & Muskelaufbau', 'https://doi.org/10.3389/fspor.2023.1054542'],
  ['Systematische Übersicht hochwertiger Studien (2025), Journal of Applied Physiology', 'https://journals.physiology.org/doi/full/10.1152/japplphysiol.00223.2025'],
  ['Bruinvels et al. (2016), PLOS One — starke Blutungen bei Sportlerinnen', 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0149881'],
  ['Giersch et al. (2020), J Sci Med Sport — Zyklus & Temperatur bei Belastung in der Wärme', 'https://doi.org/10.1016/j.jsams.2020.05.014'],
];

function cycleLearnHtml(current) {
  const order = ['mens', 'foll', 'ovu', 'lut'];
  return `<details class="pg-cycle-more pg-cycle-learn">
    <summary>Mehr erfahren: Training &amp; Zyklus</summary>
    <p class="pg-muted" style="margin:0 0 10px;">Kurz gesagt: Die Forschung findet im Schnitt kaum Leistungsunterschiede zwischen den Phasen, aber grosse Unterschiede zwischen Personen. Empfohlen wird deshalb, <b>auf die eigenen Daten und das eigene Befinden</b> zu achten statt nach festen Phasen-Regeln zu trainieren [1][2].</p>
    ${order.map((k) => `
      <div class="pg-cycle-phase ${k === current ? 'current' : ''}">
        <p class="pg-cycle-phase-title"><i style="background:${CYCLE_PHASES[k].color}"></i>${CYCLE_PHASES[k].label}${k === current ? ' · jetzt' : ''}</p>
        <p><b>Körper:</b> ${CYCLE_INFO[k].body}</p>
        <p><b>Studien:</b> ${CYCLE_INFO[k].science}</p>
        <p><b>Praxis:</b> ${CYCLE_INFO[k].practice}</p>
      </div>`).join('')}
    <p class="pg-cycle-phase-title">Quellen</p>
    <ol class="pg-cycle-sources">${CYCLE_SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ol>
  </details>`;
}

/* Persönlicher Vergleich: jede Einheit relativ zum eigenen Niveau in den
   ±4 Wochen darum (gleiche Übung bzw. Hängezeit) — so verfälscht der
   normale Trainingsfortschritt den Vergleich nicht. Dann Mittel pro Phase. */
const CYCLE_MIN_PER_PHASE = 3;
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function relativeScores() {
  const series = {}; // key -> [{t, v}]
  const add = (key, t, v) => { if (v > 0) (series[key] = series[key] || []).push({ t, v }); };
  state.logs.forEach((e) => (e.exercises || []).forEach((ex) => {
    if (!Array.isArray(ex.sets) || !ex.sets.length || ['warmup_general', 'cooldown_general'].includes(ex.exerciseId)) return;
    const best = bestSetOf(ex.exerciseId, ex.sets);
    if (best) add('ex:' + ex.exerciseId, entryTime(e), best.value);
  }));
  progressFbSessions.forEach((sn) => add('fb', entryTime(sn), fbSessionHangSeconds(sn)));
  const perSession = {}; // Tag -> [ratios]
  Object.values(series).forEach((pts) => pts.forEach((p) => {
    const near = pts.filter((q) => q !== p && Math.abs(q.t - p.t) <= 28 * DAY_MS).map((q) => q.v);
    if (near.length < 2) return;
    const k = dayKey(new Date(p.t));
    (perSession[k] = perSession[k] || []).push(p.v / median(near));
  }));
  return Object.entries(perSession).map(([k, r]) => ({ t: dayStart(k) + DAY_MS / 2, ratio: r.reduce((a, b) => a + b, 0) / r.length }));
}
function cyclePhaseAt(t) {
  const g = cycleSegments().find((s) => t >= s.from && t < s.to);
  return g ? g.phase : null;
}
function cycleCompareHtml() {
  const today = Date.now();
  const byPhase = { mens: [], foll: [], ovu: [], lut: [] };
  relativeScores().forEach((s) => {
    if (s.t > today) return;
    const ph = cyclePhaseAt(s.t);
    if (ph) byPhase[ph].push(s.ratio);
  });
  const total = Object.values(byPhase).reduce((a, b) => a + b.length, 0);
  const rows = Object.entries(byPhase).map(([k, r]) => {
    const enough = r.length >= CYCLE_MIN_PER_PHASE;
    const pct = enough ? Math.round((r.reduce((a, b) => a + b, 0) / r.length - 1) * 100) : null;
    const w = enough ? Math.min(50, Math.abs(pct) * 5) : 0; // 10 % = volle Halbbreite
    return `<div class="pg-cmp-row">
      <span class="pg-cmp-label"><i style="background:${CYCLE_PHASES[k].color}"></i>${CYCLE_PHASES[k].label}</span>
      <span class="pg-cmp-bar">${enough ? `<span style="${pct >= 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${CYCLE_PHASES[k].color}"></span>` : ''}</span>
      <span class="pg-cmp-val">${enough ? `${pct > 0 ? '+' : ''}${pct} %` : `${r.length}/${CYCLE_MIN_PER_PHASE}`}</span>
    </div>`;
  }).join('');
  return `<div class="pg-cmp">
    <p class="pg-cycle-phase-title">Deine Leistung nach Phase</p>
    ${rows}
    <p class="pg-muted" style="margin:6px 0 0;">Jede Einheit im Vergleich zu deinem Niveau in den Wochen davor/danach (${total} Einheiten). Ab ${CYCLE_MIN_PER_PHASE} Einheiten pro Phase erscheint ein Wert; bei wenigen Einheiten kann ein Unterschied auch Zufall sein.</p>
  </div>`;
}

function cycleCardHtml() {
  if (!cycleData) {
    return `<div class="pg-card" id="pg-cycle">
      <div class="pg-card-head"><h3>Zyklus</h3><span class="pg-muted">freiwillig</span></div>
      <p class="pg-muted" style="margin:0 0 12px;">Zeigt deine Zyklusphasen hinter den Leistungskurven, schätzt die nächste Periode und vergleicht deine Leistung je Phase. Nur für dich sichtbar — nie für die Crew oder in Challenges. Jederzeit löschbar.</p>
      <button class="btn ghost small" id="cycle-enable">Einschalten</button>
      ${cycleLearnHtml(null)}
    </div>`;
  }
  const t = cycleToday();
  const starts = cycleStarts();
  const todayKey = dayKey(new Date());
  let now = '<p class="pg-muted" style="margin:0 0 12px;">Trag den ersten Tag deiner letzten Periode ein.</p>';
  if (t) {
    const nextTxt = t.inDays > 0 ? `in ${t.inDays} ${t.inDays === 1 ? 'Tag' : 'Tagen'}` : t.inDays === 0 ? 'heute' : `seit ${-t.inDays} ${t.inDays === -1 ? 'Tag' : 'Tagen'} erwartet`;
    now = `<div class="pg-hero"><span class="pg-hero-num" style="color:${t.phase ? CYCLE_PHASES[t.phase].color : 'var(--ink)'}">Tag ${t.day}</span><span class="pg-hero-sub">${t.phase ? CYCLE_PHASES[t.phase].label : 'Periode überfällig?'}</span></div>
      <p class="pg-muted" style="margin:0 0 12px;">Nächste Periode ca. <b>${fmtDayLong(t.next)}</b> (${nextTxt}) · Ø ${t.avg} Tage</p>
      ${t.phase ? `<p class="pg-cycle-tip" style="border-color:${CYCLE_PHASES[t.phase].color}">${CYCLE_INFO[t.phase].tip}</p>` : ''}`;
  }
  return `<div class="pg-card" id="pg-cycle">
    <div class="pg-card-head"><h3>Zyklus</h3><span class="pg-muted">nur für dich</span></div>
    ${now}
    ${starts.includes(todayKey) ? '' : '<button class="btn small" id="cycle-today">Periode hat heute begonnen</button>'}
    ${starts.length ? cycleCompareHtml() : ''}
    ${cycleLearnHtml(t && t.phase)}
    <details class="pg-cycle-more pg-cycle-entries">
      <summary>Einträge &amp; Einstellungen</summary>
      <div class="field-row pg-cycle-add">
        <div class="field"><label>Periodenbeginn nachtragen</label><input type="date" id="cycle-date" max="${todayKey}" value="${todayKey}"></div>
        <button class="btn ghost small" id="cycle-add">Eintragen</button>
      </div>
      <div class="chip-row">${starts.slice().reverse().map((k) => `<span class="chip small">${esc(fmtShortDate(k))} <button type="button" class="chip-x" data-cycle-del="${esc(k)}" aria-label="${esc(fmtShortDate(k))} löschen">×</button></span>`).join('') || '<span class="pg-muted">Noch keine Einträge.</span>'}</div>
      <button class="btn ghost small" id="cycle-off">Ausschalten &amp; alle Zyklusdaten löschen</button>
    </details>
    <p class="pg-muted" style="margin:10px 0 0;">Schätzung aus deinen Einträgen — kein medizinischer Rat und keine Verhütungsmethode.</p>
  </div>`;
}

function wireCycleCard() {
  const base = `cycle/${state.member.id}`;
  const enable = document.getElementById('cycle-enable');
  if (enable) enable.onclick = async () => {
    if (!confirm('Zyklusdaten sind Gesundheitsdaten. Sie werden in deinem privaten Bereich gespeichert, den nur du sehen kannst (nicht die Crew). Du kannst sie jederzeit löschen. Einverstanden?')) return;
    cycleData = { consentAt: Date.now() };
    await fbPut(base, cycleData);
    drawProgress();
  };
  const addStart = async (key) => {
    if (!key || key > dayKey(new Date())) { toast('Bitte ein Datum bis heute wählen.', 'err'); return; }
    cycleData = { ...cycleData, starts: { ...(cycleData.starts || {}), [key]: true } };
    await fbPut(`${base}/starts/${key}`, true);
    drawProgress();
  };
  const today = document.getElementById('cycle-today');
  if (today) today.onclick = () => addStart(dayKey(new Date()));
  const add = document.getElementById('cycle-add');
  if (add) add.onclick = () => addStart(document.getElementById('cycle-date').value);
  document.querySelectorAll('[data-cycle-del]').forEach((b) => {
    b.onclick = async () => {
      const key = b.dataset.cycleDel;
      const starts = { ...(cycleData.starts || {}) };
      delete starts[key];
      cycleData = { ...cycleData, starts };
      await fbDelete(`${base}/starts/${key}`);
      drawProgress();
      const more = document.querySelector('.pg-cycle-entries');
      if (more) more.open = true;
    };
  });
  const off = document.getElementById('cycle-off');
  if (off) off.onclick = async () => {
    if (!confirm('Zyklus-Tracking ausschalten und alle Zyklusdaten endgültig löschen?')) return;
    cycleData = null;
    await fbDelete(base);
    toast('Zyklusdaten gelöscht.', 'ok');
    drawProgress();
  };
}

async function renderProgress() {
  renderShell(`<div class="sec-head"><h2 class="sec-title">Fortschritt</h2><div class="sec-rule"></div></div><div id="pg-root"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>`);
  const [rawLogs, rawFb, rawCycle] = await Promise.all([fbGet(`logs/${state.member.id}`), fbGet(`fingerboardSessions/${state.member.id}`), fbGet(`cycle/${state.member.id}`)]);
  cycleData = rawCycle && rawCycle.consentAt ? rawCycle : null;
  state.logs = Object.values(rawLogs || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  progressFbSessions = Object.values(rawFb || {}).sort((a, b) => entryTime(a) - entryTime(b));
  drawProgress();
}

function drawProgress() {
  const root = document.getElementById('pg-root');
  if (!root) return;
  const exIds = [];
  state.logs.forEach((e) => (e.exercises || []).forEach((ex) => {
    if (Array.isArray(ex.sets) && ex.sets.length && !exIds.includes(ex.exerciseId) && !['warmup_general', 'cooldown_general'].includes(ex.exerciseId)) exIds.push(ex.exerciseId);
  }));
  if (!progressExerciseId || !exIds.includes(progressExerciseId)) progressExerciseId = exIds[0] || null;
  const days = PROGRESS_RANGES.find((r) => r[0] === progressRange)[2];
  const pts = progressExerciseId ? progressSeries(progressExerciseId, days) : [];
  let headline = '';
  if (pts.length >= 2) {
    const first = pts[0].value, last = pts[pts.length - 1].value;
    const pct = first ? Math.round(((last - first) / first) * 100) : 0;
    headline = `<div class="pg-hero"><span class="pg-hero-num ${pct >= 0 ? 'up' : 'down'}">${pct > 0 ? '+' : ''}${pct} %</span><span class="pg-hero-sub">${esc(pts[0].label)} → ${esc(pts[pts.length - 1].label)}</span></div>`;
  }
  const isNewPr = pts.length >= 2 && pts[pts.length - 1].value > Math.max(...pts.slice(0, -1).map((p) => p.value));
  const stats = progressStats();
  const fbRecent = progressFbSessions.filter((sn) => entryTime(sn) > Date.now() - days * 86400000);
  const fbPts = fbRecent.map((sn) => { const v = fbSessionHangSeconds(sn); return { t: entryTime(sn), date: sn.date, value: v, label: `${v} s Hängezeit` }; }).filter((p) => p.value > 0);

  root.innerHTML = `
    <div class="pg-tiles">
      <div class="pg-tile"><b>${stats.last30}</b><span>Einheiten in 30 Tagen</span></div>
      <div class="pg-tile"><b class="accent">${stats.streak}</b><span>${stats.streak === 1 ? 'Woche' : 'Wochen'} in Folge</span></div>
      <div class="pg-tile"><b>${stats.kg >= 1000 ? (stats.kg / 1000).toFixed(1).replace('.', ',') + ' t' : Math.round(stats.kg) + ' kg'}</b><span>bewegt diese Woche</span></div>
    </div>

    <div class="pg-card">
      <div class="pg-card-head">
        <h3>Übung</h3>
        <div class="chip-row pg-ranges">${PROGRESS_RANGES.map(([k, l]) => `<button type="button" class="chip small ${k === progressRange ? 'active' : ''}" data-range="${k}">${l}</button>`).join('')}</div>
      </div>
      ${exIds.length ? `<select class="pg-select" id="pg-exercise" aria-label="Übung wählen">${exIds.map((id) => `<option value="${id}" ${id === progressExerciseId ? 'selected' : ''}>${esc(exerciseName(id))}</option>`).join('')}</select>` : ''}
      ${isNewPr ? `<div class="pg-pr">Neuer Rekord: <b>${esc(pts[pts.length - 1].label)}</b></div>` : ''}
      ${headline}
      ${exIds.length ? progressLineChart('pg-ex', pts, 'Bester Satz je Training') : '<div class="list-empty">Noch keine Gym-Sätze geloggt.</div>'}
      ${exIds.length && pts.length ? cycleLegendHtml() : ''}
    </div>

    <div class="pg-card">
      <div class="pg-card-head"><h3>Board · Hängezeit je Einheit</h3></div>
      ${progressLineChart('pg-fb', fbPts, 'Hängezeit je Einheit')}
      ${fbPts.length ? cycleLegendHtml() : ''}
    </div>

    ${cycleCardHtml()}

    <div class="pg-card">
      <div class="pg-card-head"><h3>Letzte 8 Wochen</h3><span class="pg-muted">Mo – So</span></div>
      ${progressWeekGridHtml()}
    </div>

    <div class="pg-card">
      <div class="pg-card-head"><h3>Erholung</h3><span class="pg-muted">seit letzter Belastung</span></div>
      ${progressRecoveryHtml()}
      <p class="pg-muted" style="margin:8px 0 0;">Grobe Richtwerte (Finger 72 h, Rumpf 36 h, sonst 48 h), kein medizinischer Rat.</p>
    </div>
  `;
  root.querySelectorAll('[data-range]').forEach((b) => { b.onclick = () => { progressRange = b.dataset.range; drawProgress(); }; });
  wireCycleCard();
  const sel = document.getElementById('pg-exercise');
  if (sel) sel.onchange = () => { progressExerciseId = sel.value; drawProgress(); };
  const series = { 'pg-ex': pts, 'pg-fb': fbPts };
  root.querySelectorAll('.pg-hit').forEach((c) => {
    c.onclick = () => {
      const p = series[c.dataset.chart][Number(c.dataset.i)];
      const out = document.getElementById(`${c.dataset.chart}-readout`);
      if (out && p) out.innerHTML = `<b>${esc(fmtShortDate(p.date))}</b> · ${esc(p.label)}`;
    };
  });
}

/* ================================================================
   CHALLENGES
   Keine eigene "Challenge bauen"-Maske mehr mit Griff/Protokoll/Übungen —
   eine Challenge ist ein bereits gemachtes (Fingerboard-Ablauf, s.
   finishAblauf) oder geplantes/Freestyle-Training (Log-Verlauf, s.
   renderLog), das man mit einem Tap für die Crew freigibt. Absichtlich
   kein Punkte-, Zeit- oder Gewichtsvergleich zwischen den Mitgliedern —
   es zählt nur "mitgemacht oder nicht", die Challenge soll Anreiz zum
   Training sein, kein Wettkampf um besser/schlechter.
   ================================================================= */
const HOUR_MS = 60 * 60 * 1000;
const CHALLENGE_WINDOW_H = 72; // Vorbelegung beim Teilen, frei wählbar (s. CHALLENGE_DURATIONS)
/* Schichtarbeiter schaffen ein Training nicht immer innerhalb von 72h —
   deshalb frei wählbar statt fest, mit 1 Woche als Obergrenze (mehr würde
   "Challenge" als kurzfristigen Anreiz zu sehr verwässern). */
const CHALLENGE_DURATIONS = [
  { hours: 24, label: '24H' },
  { hours: 72, label: '72H' },
  { hours: 168, label: '1 WOCHE' },
];

function challengeDurationChipsHtml(prefix, selectedHours) {
  return `<div class="chip-row chal-duration-row" id="${prefix}-duration">
    ${CHALLENGE_DURATIONS.map((d) => `<button type="button" class="chip ${d.hours === selectedHours ? 'active' : ''}" data-hours="${d.hours}">${d.label}</button>`).join('')}
  </div>`;
}
function wireChallengeDurationChips(prefix) {
  const holder = document.getElementById(`${prefix}-duration`);
  if (!holder) return;
  holder.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => holder.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
  });
}
function selectedChallengeHours(prefix) {
  const holder = document.getElementById(`${prefix}-duration`);
  const active = holder && holder.querySelector('.chip.active');
  return active ? Number(active.dataset.hours) : CHALLENGE_WINDOW_H;
}

async function pushChallenge(fields, hours) {
  const crew = activeCrew();
  if (!crew) { toast('Du bist in keiner Crew — unter KONTO beitreten.', 'err'); return null; }
  const now = Date.now();
  const windowH = hours || CHALLENGE_WINDOW_H;
  const participants = {};
  for (const id of Object.keys(crew.members || {})) {
    participants[id] = id === state.member.id ? { status: 'done', completedAt: now } : { status: 'pending' };
  }
  const challenge = {
    createdBy: state.member.id,
    createdByName: state.member.name,
    createdAt: now,
    expiresAt: now + windowH * HOUR_MS,
    participants,
    ...fields,
  };
  const id = await fbPush(`crewData/${state.crewId}/challenges`, challenge);
  if (id) toast(`Challenge raus an ${crew.name} (${windowH}h Zeit)!`, 'ok');
  else toast('Konnte Challenge nicht senden.', 'err');
  return id;
}

function shareFingerboardAsChallenge(board, blocks, hours) {
  return pushChallenge({ kind: 'fingerboard', board, blocks }, hours);
}

function shareLogEntryAsChallenge(entry, hours) {
  return pushChallenge({
    kind: 'session',
    sessionType: entry.type,
    exercises: entry.exercises,
    ...(entry.durationMin ? { durationMin: entry.durationMin } : {}),
    note: entry.note || '',
  }, hours);
}

/* Umschalter, wenn man in mehreren Crews ist — Challenges und geteilte
   Vorlagen gelten immer für die aktive Crew. */
function crewSwitchHtml() {
  const ids = Object.keys(state.crews);
  if (ids.length < 2) return '';
  return `<div class="chip-row" id="crew-switch">${ids.map((id) => `<button type="button" class="chip ${id === state.crewId ? 'active' : ''}" data-crew="${esc(id)}">${esc(state.crews[id].name)}</button>`).join('')}</div>`;
}
function wireCrewSwitch(onChange) {
  document.querySelectorAll('#crew-switch .chip').forEach((b) => {
    b.onclick = () => { setActiveCrew(b.dataset.crew); onChange(); };
  });
}

async function renderChallenges() {
  const crew = activeCrew();
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Challenges</h2><div class="sec-rule"></div></div>
    ${crewSwitchHtml()}
    <p class="login-hint" style="margin:0 0 16px;text-align:left;">Ein Training fertig gemacht? Im Fingerboard (nach "Ablauf geschafft") oder im Log-Verlauf kannst du es ${crew ? `<b>${esc(crew.name)}</b>` : 'der Crew'} als Challenge vorschlagen — Zeitfenster beim Teilen wählbar (24h bis 1 Woche).</p>
    <div class="list" id="challenge-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);
  wireCrewSwitch(() => { loadSharedTemplates(); renderChallenges(); });
  if (!crew) {
    document.getElementById('challenge-list').innerHTML = '<div class="list-empty">Du bist noch in keiner Crew — unter <a href="#konto">KONTO</a> mit einem Einladungscode beitreten.</div>';
    return;
  }
  const base = `crewData/${state.crewId}/challenges`;

  const raw = await fbGet(base);
  state.challenges = raw || {};
  markChallengesSeenNow();
  const now = Date.now();

  // Abgelaufene, unbestätigte Teilnahmen als "expired" markieren (lazy).
  for (const [id, c] of Object.entries(state.challenges)) {
    if (now > c.expiresAt && c.participants) {
      for (const [pid, p] of Object.entries(c.participants)) {
        if (p.status === 'pending') {
          fbPatch(`${base}/${id}/participants/${pid}`, { status: 'expired' });
          p.status = 'expired';
        }
      }
    }
  }

  const entries = Object.entries(state.challenges).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const list = document.getElementById('challenge-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, c]) => renderChallengeCard(id, c, now)).join('') : '<div class="list-empty">Noch keine Challenges — teile ein fertiges Training, um die erste zu starten.</div>';

  list.querySelectorAll('[data-toggle-done]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.toggleDone;
      const c = state.challenges[id];
      const myStatus = c && c.participants && c.participants[state.member.id] && c.participants[state.member.id].status;
      if (myStatus === 'done') {
        await fbPatch(`${base}/${id}/participants/${state.member.id}`, { status: 'pending', completedAt: null });
        toast('Zurückgesetzt.', 'ok');
      } else {
        await fbPatch(`${base}/${id}/participants/${state.member.id}`, { status: 'done', completedAt: Date.now() });
        toast('Mitgemacht — stark!', 'ok');
      }
      renderChallenges();
    };
  });
  // "Annehmen" kopiert die Challenge in den eigenen Ablauf-Baukasten (Board
  // bzw. Plan), statt sie nur als erledigt zu markieren — so kann man sie
  // auch wirklich NACHMACHEN, nicht nur bestätigen, dass man sie schon kennt.
  list.querySelectorAll('[data-accept]').forEach((btn) => {
    btn.onclick = () => {
      const c = state.challenges[btn.dataset.accept];
      if (!c) return;
      if (c.kind === 'fingerboard') {
        if (fb.blocks.length && !confirm('Aktuellen Fingerboard-Ablauf durch diese Challenge ersetzen?')) return;
        fb.board = fb.board || currentMemberBoard();
        fb.blocks = fbBlocksWithCurrentBoard(c.blocks || []);
        renderFbBlocksList();
        location.hash = '#fingerboard';
        toast('Challenge in den Ablauf geladen — leg los!', 'ok');
      } else if (c.kind === 'session') {
        if (logBuilder.exercises.length && !confirm('Aktuellen Plan durch diese Challenge ersetzen?')) return;
        logBuilder.exercises = (c.exercises || []).map((g) => {
          const first = (g.sets || [])[0] || {};
          return { exerciseId: g.exerciseId, sets: (g.sets || []).length || 3, reps: first.reps ?? '', weight: first.weight ?? '' };
        });
        saveDraft('log_exercises', logBuilder.exercises);
        logMode = 'planned';
        location.hash = '#log';
        toast('Challenge als Plan geladen — leg los!', 'ok');
      }
    };
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Diese Challenge wirklich löschen?')) return;
      await fbDelete(`${base}/${btn.dataset.delete}`);
      toast('Challenge gelöscht.', 'ok');
      renderChallenges();
    };
  });
}

function renderChallengeCard(id, c, now) {
  const expired = now > c.expiresAt;
  const hoursLeft = Math.max(0, Math.ceil((c.expiresAt - now) / HOUR_MS));
  const my = c.participants && c.participants[state.member.id];
  const myDone = my && my.status === 'done';
  const isMine = c.createdBy === state.member.id;

  let title, detail;
  if (c.kind === 'fingerboard') {
    title = `Fingerboard · ${esc(BOARDS[c.board].label)}`;
    detail = (c.blocks || []).map((b) => {
      if (b.type === 'hang') return `<div class="ex core">Hang @ ${esc(hangGripLabel({ ...b, board: b.board || c.board }))} · ${b.hangSec}s × ${esc(String(b.reps))} · ${b.restSec}s Pause</div>`;
      if (b.type === 'block' && b.mode === 'reps') return `<div class="ex core">Lifting Pin @ ${esc(blockGripLabel(b))} · ${b.workSec || 40}s × ${esc(String(b.reps))}</div>`;
      if (b.type === 'block') return `<div class="ex core">Lifting Pin @ ${esc(blockGripLabel(b))} · ${b.hangSec}s × ${esc(String(b.reps))} · ${b.restSec}s Pause</div>`;
      if (b.type === 'pause') return `<div class="ex core">⏸ Pause · ${b.seconds}s</div>`;
      return `<div class="ex core">${esc(exerciseName(b.exerciseId))} · ${b.workSec || 40}s × ${esc(String(b.reps))}</div>`;
    }).join('');
  } else {
    title = LOG_TYPE_LABEL[c.sessionType] || esc(c.sessionType || 'Training');
    detail = c.durationMin
      ? `<div class="ex core">${sessionTypeIconLabel(c.sessionType)} · ${c.durationMin} Min.</div>`
      : (c.exercises || []).map((ex) => `<div class="ex core">${esc(exerciseName(ex.exerciseId))} · ${esc(fbExerciseSetsText(ex))}</div>`).join('');
  }

  return `
    <div class="challenge-card ${expired ? 'expired' : ''}">
      <span class="stamp ${myDone ? 'done' : ''}">${expired ? 'VORBEI' : hoursLeft + 'H'}</span>
      <p class="chal-from">Von <b>${esc(c.createdByName)}</b> · ${title}</p>
      <div class="exlist">${detail || '<div class="ex">Keine Details.</div>'}</div>
      ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
      <div class="crew">
        ${Object.entries(c.participants || {}).map(([pid, p]) => `<span class="p ${p.status}">${esc((state.members[pid] || {}).name || '?')}</span>`).join('')}
      </div>
      <div class="chal-actions">
        ${(!expired && (c.kind === 'fingerboard' || (c.kind === 'session' && (c.exercises || []).length))) ? `<button class="btn small" data-accept="${id}">ANNEHMEN</button>` : ''}
        ${(!expired && my) ? `<button class="btn ghost small" data-toggle-done="${id}">${myDone ? '✓ MITGEMACHT' : 'MITGEMACHT'}</button>` : ''}
        ${isMine ? `<button class="btn ghost small" data-delete="${id}">LÖSCHEN</button>` : ''}
      </div>
    </div>
  `;
}

/* ================================================================
   KONTO + CREWS
   Eigenes Konto, Crews (aktiv setzen, beitreten, verlassen) und — für
   wer eine Crew gegründet hat — Einladungscode teilen/erneuern und
   Mitglieder entfernen. Crew gründen darf vorerst nur der Admin (bis
   config/crewCreationOpen in Firebase auf true steht).
   ================================================================= */
function inviteLink(code) {
  return `${location.origin}${location.pathname}?code=${encodeURIComponent(code)}`;
}

async function renderKonto() {
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Konto</h2><div class="sec-rule"></div></div>
    <div class="card">
      <p class="card-title">Angemeldet</p>
      <p class="card-value">${esc(state.member.name)}</p>
      <p class="card-sub">${esc(authEmail() || '')}</p>
      <button class="btn ghost small konto-logout" id="konto-logout">Abmelden</button>
    </div>
    <div class="sec-head"><h2 class="sec-title">Crews</h2><div class="sec-rule"></div></div>
    <div id="konto-crews"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
    <div class="card">
      <p class="card-title">Crew beitreten</p>
      <div class="field-row">
        <div class="field"><input type="text" id="konto-join-code" autocapitalize="characters" autocomplete="off" placeholder="Einladungscode"></div>
        <button class="btn small" id="konto-join">Beitreten</button>
      </div>
    </div>
    <div id="konto-create"></div>
  `);
  document.getElementById('konto-logout').onclick = () => logout();
  document.getElementById('konto-join').onclick = () => joinCrewWithCode(normalizeInviteCode(document.getElementById('konto-join-code').value));

  await loadCrews(); // frisch: neue Mitglieder sollen ohne Neustart erscheinen
  const holder = document.getElementById('konto-crews');
  if (!holder) return; // weiternavigiert
  const ids = Object.keys(state.crews);
  const me = state.member.id;
  const secrets = {};
  await Promise.all(ids.filter((id) => state.crews[id].owner === me).map(async (id) => {
    const r = await fbGetNow(`crewSecrets/${id}`);
    if (r.ok && r.value) secrets[id] = r.value.inviteCode;
  }));
  if (!document.getElementById('konto-crews')) return; // weiternavigiert
  holder.innerHTML = ids.length ? ids.map((id) => {
    const c = state.crews[id];
    const isOwner = c.owner === me;
    const members = Object.entries(c.members || {});
    return `
      <div class="card crew-card">
        <div class="crew-head">
          <p class="card-value">${esc(c.name)}</p>
          ${id === state.crewId ? '<span class="tag-pill">AKTIV</span>' : `<button class="btn ghost small" data-activate="${esc(id)}">Aktiv setzen</button>`}
        </div>
        <div class="chip-row crew-members">
          ${members.map(([mid, m]) => `<span class="chip small ${m.legacy ? 'legacy' : ''}">${esc(m.name)}${mid === c.owner ? ' ★' : ''}${m.legacy ? ' · noch nicht dabei' : ''}${isOwner && mid !== me ? ` <button type="button" class="chip-x" data-remove="${esc(id)}|${esc(mid)}" aria-label="${esc(m.name)} entfernen">×</button>` : ''}</span>`).join('')}
        </div>
        ${isOwner ? `
          <p class="card-title">Einladungscode</p>
          <p class="invite-code mono">${esc(secrets[id] || '—')}</p>
          <div class="chal-actions">
            ${secrets[id] ? `<button class="btn small" data-share="${esc(id)}">Einladen</button>` : ''}
            <button class="btn ghost small" data-regen="${esc(id)}">Neuer Code</button>
          </div>
          <p class="card-sub">"Neuer Code" macht den alten ungültig — wer schon drin ist, bleibt drin.</p>
        ` : `<div class="chal-actions"><button class="btn ghost small" data-leave="${esc(id)}">Crew verlassen</button></div>`}
      </div>
    `;
  }).join('') : '<div class="list-empty">Noch in keiner Crew — unten mit einem Einladungscode beitreten.</div>';

  holder.querySelectorAll('[data-activate]').forEach((b) => {
    b.onclick = () => { setActiveCrew(b.dataset.activate); loadSharedTemplates(); renderKonto(); };
  });
  holder.querySelectorAll('[data-share]').forEach((b) => {
    b.onclick = () => shareInvite(state.crews[b.dataset.share].name, secrets[b.dataset.share]);
  });
  holder.querySelectorAll('[data-regen]').forEach((b) => {
    b.onclick = () => regenerateInvite(b.dataset.regen, secrets[b.dataset.regen]);
  });
  holder.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = async () => {
      const [crewId, mid] = b.dataset.remove.split('|');
      const name = state.crews[crewId].members[mid].name;
      if (!confirm(`${name} aus "${state.crews[crewId].name}" entfernen?`)) return;
      const r = await fbUpdateNow('', { [`crews/${crewId}/members/${mid}`]: null });
      toast(r.ok ? `${name} entfernt.` : 'Hat nicht geklappt.', r.ok ? 'ok' : 'err');
      await loadCrews();
      renderKonto();
    };
  });
  holder.querySelectorAll('[data-leave]').forEach((b) => {
    b.onclick = async () => {
      const crewId = b.dataset.leave;
      if (!confirm(`"${state.crews[crewId].name}" verlassen? Zurück geht's nur mit einem neuen Einladungscode.`)) return;
      const r = await fbUpdateNow('', { [`crews/${crewId}/members/${me}`]: null, [`members/${me}/crews/${crewId}`]: null });
      if (!r.ok) { toast('Hat nicht geklappt.', 'err'); return; }
      toast('Crew verlassen.', 'ok');
      await loadCrews();
      loadSharedTemplates();
      renderKonto();
    };
  });

  // Crew gründen: Admin (Phase 1) oder sobald für alle freigeschaltet.
  const [cfg, admin] = await Promise.all([fbGetNow('config'), probeAdmin()]);
  const open = cfg.ok && cfg.value && cfg.value.crewCreationOpen === true;
  const createHolder = document.getElementById('konto-create');
  if (!createHolder || !(open || admin !== null)) return;
  createHolder.innerHTML = `
    <div class="card">
      <p class="card-title">Neue Crew gründen</p>
      <div class="field-row">
        <div class="field"><input type="text" id="konto-create-name" maxlength="40" placeholder="Name der Crew"></div>
        <button class="btn small" id="konto-create-btn">Gründen</button>
      </div>
    </div>
  `;
  document.getElementById('konto-create-btn').onclick = () => createCrew(document.getElementById('konto-create-name').value.trim());
}

async function shareInvite(crewName, code) {
  const text = `Komm in meine Pincho-Crew "${crewName}"! Einladungscode: ${code}`;
  const url = inviteLink(code);
  try {
    if (navigator.share) { await navigator.share({ title: 'Pincho', text, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Einladung kopiert — z. B. in WhatsApp einfügen.', 'ok');
  } catch (e) {
    prompt('Einladung kopieren:', `${text} ${url}`);
  }
}

async function regenerateInvite(crewId, oldCode) {
  if (!confirm('Neuen Code erzeugen? Der alte funktioniert dann nicht mehr.')) return;
  const code = await uniqueInviteCode();
  if (!code) { toast('Keine Verbindung.', 'err'); return; }
  const updates = {
    [`invites/${code}`]: { crewId, crewName: state.crews[crewId].name },
    [`crewSecrets/${crewId}/inviteCode`]: code,
  };
  if (oldCode) updates[`invites/${oldCode}`] = null;
  const r = await fbUpdateNow('', updates);
  toast(r.ok ? `Neuer Code: ${code}` : 'Hat nicht geklappt.', r.ok ? 'ok' : 'err');
  renderKonto();
}

async function joinCrewWithCode(code) {
  if (!code) { toast('Bitte Einladungscode eingeben.', 'err'); return; }
  const inv = await fbGetNow(`invites/${code}`);
  if (!inv.ok) { toast('Keine Verbindung.', 'err'); return; }
  if (!inv.value || !inv.value.crewId) { toast('Diesen Code gibt es nicht (mehr).', 'err'); return; }
  const crewId = inv.value.crewId;
  if (state.crews[crewId]) { toast(`Du bist schon in "${state.crews[crewId].name}".`); return; }
  const me = state.member.id;
  const r = await fbUpdateNow('', {
    [`crews/${crewId}/members/${me}`]: { name: state.member.name, joinedAt: Date.now(), code },
    [`members/${me}/crews/${crewId}`]: true,
  });
  if (!r.ok) { toast('Beitreten hat nicht geklappt.', 'err'); return; }
  await loadCrews();
  setActiveCrew(crewId);
  loadSharedTemplates();
  toast(`Willkommen in "${inv.value.crewName || 'der Crew'}"!`, 'ok');
  renderKonto();
}

async function createCrew(name) {
  if (!name) { toast('Bitte einen Namen für die Crew eingeben.', 'err'); return; }
  const code = await uniqueInviteCode();
  if (!code) { toast('Keine Verbindung.', 'err'); return; }
  const crewId = generatePushId();
  const me = state.member.id;
  const now = Date.now();
  const r = await fbUpdateNow('', {
    [`crews/${crewId}`]: { name, owner: me, createdAt: now, members: { [me]: { name: state.member.name, joinedAt: now } } },
    [`crewSecrets/${crewId}`]: { inviteCode: code },
    [`invites/${code}`]: { crewId, crewName: name },
    [`members/${me}/crews/${crewId}`]: true,
  });
  if (!r.ok) { toast('Crew gründen hat nicht geklappt.', 'err'); return; }
  await loadCrews();
  setActiveCrew(crewId);
  loadSharedTemplates();
  toast(`Crew "${name}" gegründet — Code ${code}`, 'ok');
  renderKonto();
}

/* ---------- Start ---------- */
window.addEventListener('hashchange', () => {
  state.route = (location.hash || '#fingerboard').replace('#', '');
  render();
});
boot();

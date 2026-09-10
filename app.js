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

/* Tippbares Übungs-Raster statt <select>-Dropdown — bei Dutzenden Übungen
   ist ein natives Dropdown auf dem Handy ein langes, unübersichtliches
   Scrollen; ein Raster lässt sich auf einen Blick überfliegen (gleiche
   Idee wie schon bei der Challenge-Übungsauswahl, hier aber Einzelauswahl
   statt Checkbox-Liste). */
function exercisePickerGridHtml(list, selectedId) {
  return Object.entries(EXERCISE_CATEGORY_LABEL)
    .filter(([cat]) => list.some((e) => e.category === cat))
    .map(([cat, label]) => `
      <div class="ex-cat-label">${label}</div>
      <div class="ex-pick-grid">
        ${list.filter((e) => e.category === cat).sort((a, b) => a.name.localeCompare(b.name, 'de')).map((e) => {
          const muscles = exerciseMuscles(e.id);
          const sub = muscles.primary.map((id) => MUSCLE_ZONE_LABEL[id] || id).join(', ');
          return `
          <button type="button" class="ex-pick-btn ${e.id === selectedId ? 'active' : ''}" data-exercise="${e.id}">
            ${esc(e.name)}
            ${sub ? `<span class="ex-pick-sub">${esc(sub)}</span>` : ''}
          </button>
        `;
        }).join('')}
      </div>
    `).join('');
}
/* Lang drücken statt tippen zeigt Infos zur Übung (Ausführung, Zielmuskeln),
   ohne sie schon auszuwählen — bei uneindeutigen Namen ("Rudern Kabel" vs.
   "Rudern Langhantel") kann man so erst nachschauen, bevor man committet.
   Setzt bei ausgelöstem Long-Press ein Flag, das der nachfolgende Klick
   (der auf Touch-Geräten nach dem Loslassen trotzdem feuert) prüft, um die
   normale Auswahl für DIESEN einen Tap zu überspringen. */
function wireLongPress(el, onLongPress, holdMs = 480) {
  let timer = null;
  const start = () => { timer = setTimeout(() => { timer = null; el.dataset.longPressed = '1'; onLongPress(); }, holdMs); };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointermove', cancel);
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

function showExerciseInfoSheet(exerciseId) {
  const el = ensureExerciseInfoSheet();
  const muscles = exerciseMuscles(exerciseId);
  const muscleText = muscleLabelsText(muscles.primary, muscles.secondary);
  const howTo = exerciseHowTo(exerciseId);
  el.innerHTML = `
    <div class="info-sheet-card">
      <button type="button" class="info-sheet-close" id="info-sheet-close">✕</button>
      <div class="info-sheet-title">${esc(exerciseName(exerciseId))}</div>
      ${howTo ? `<div class="ex-howto">${esc(howTo)}</div>` : ''}
      ${muscleText ? `<div class="fb-muscle-block">${bodyMapSvg(muscles.primary, muscles.secondary)}<div class="fb-muscle-label mono">${esc(muscleText)}</div></div>` : ''}
    </div>
  `;
  el.classList.remove('hidden');
  document.getElementById('info-sheet-close').onclick = () => el.classList.add('hidden');
}

function wireExercisePickerGrid(containerId, onSelect, scrollTargetId) {
  const holder = document.getElementById(containerId);
  if (!holder) return;
  holder.querySelectorAll('.ex-pick-btn').forEach((btn) => {
    wireLongPress(btn, () => showExerciseInfoSheet(btn.dataset.exercise));
    btn.onclick = () => {
      if (btn.dataset.longPressed === '1') { btn.dataset.longPressed = ''; return; }
      holder.querySelectorAll('.ex-pick-btn').forEach((b) => b.classList.toggle('active', b === btn));
      onSelect(btn.dataset.exercise);
      if (scrollTargetId) {
        document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
  });
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
const state = {
  member: JSON.parse(localStorage.getItem('pincho_member') || 'null'),
  route: (location.hash || '#fingerboard').replace('#', ''),
  members: {},        // {id: {name, board}}
  logs: [],           // eigene Logs, neueste zuerst
  challenges: {},      // {id: {...}}
  weekPlan: null,      // Array von 7 Tagen
};

/* ---------- Boot ---------- */
async function boot() {
  const authed = await ensureValidAuthToken();
  if (!authed) { renderPasswordGate(); return; }
  if (!state.member) { renderNamePicker(); return; }

  // Sofort rendern statt auf eine (ggf. langsame/wacklige) Firebase-Antwort
  // zu warten — die Mitgliederliste wird im Hintergrund nachgeladen und
  // löst bei Bedarf ein Nachrendern aus (Fingerboard/Challenges nutzen sie).
  render();
  await loadMembers();
  if (state.route === 'fingerboard' || state.route === 'challenges') render();

  // Läuft unabhängig von der gerade offenen Ansicht — nur so kann der
  // Benachrichtigungspunkt schon beim App-Start stimmen, nicht erst wenn
  // man zufällig auf "Challenges" tippt.
  fbGet('challenges').then((raw) => {
    if (raw === undefined) return;
    state.challenges = raw || {};
    setChallengeUnseenCount(countUnseenChallenges(state.challenges));
  });
}

async function loadMembers() {
  const raw = await fbGet('members');
  state.members = raw || {};
}

function currentMemberBoard() {
  const m = state.members[state.member.id];
  return (m && m.board) || 'bm2000';
}

/* ================================================================
   LOGIN — zweistufig:
   1) gemeinsamer Team-Code (echter Firebase-Auth-Account, sichert die
      Datenbank ab — siehe firebase.js)
   2) eigener Name (rein lokal pro Gerät gemerkt, keine echten Accounts)
   ================================================================= */
function renderPasswordGate() {
  APP_ROOT.innerHTML = `
    <div class="login-shell">
      <img class="login-logo" src="./assets/icon-512-any.png" alt="Pincho">
      <p class="login-tag">${APP_TAGLINE}</p>
      <div class="field">
        <label>Team-Code</label>
        <input type="password" id="login-password" placeholder="••••" autofocus>
      </div>
      <button class="btn" id="login-password-submit">REIN AN DIE WAND</button>
      <p class="login-hint" id="login-password-hint">Erste Anmeldung überhaupt? Der hier eingegebene Code wird zum neuen Team-Code.</p>
    </div>
  `;
  document.getElementById('login-password-submit').onclick = submitPasswordGate;
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPasswordGate();
  });
}

async function submitPasswordGate() {
  const password = document.getElementById('login-password').value;
  const hint = document.getElementById('login-password-hint');
  if (!password) { toast('Bitte Team-Code eingeben.', 'err'); return; }

  let result = await signInTeam(password);
  if (!result.ok && result.code === 'EMAIL_NOT_FOUND') {
    result = await signUpTeam(password);
    if (result.ok) toast('Team-Code gesetzt.', 'ok');
  }
  if (!result.ok) {
    hint.textContent = 'Falscher Team-Code — bitte nochmal versuchen.';
    hint.style.color = 'var(--danger)';
    return;
  }
  boot();
}

function renderNamePicker() {
  APP_ROOT.innerHTML = `
    <div class="login-shell">
      <img class="login-logo" src="./assets/icon-512-any.png" alt="Pincho">
      <p class="login-tag">Wer trainiert?</p>
      <div class="chip-row" id="name-picker-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
      <p class="login-hint">Einmal pro Gerät — danach merkt sich Pincho, wer du bist.</p>
    </div>
  `;
  loadMembers().then(() => {
    const row = document.getElementById('name-picker-list');
    if (!row) return; // Nutzer hat inzwischen weiternavigiert
    const ids = Object.keys(state.members);
    row.innerHTML = ids.map((id) => `
      <button type="button" class="chip" data-id="${esc(id)}">${esc(state.members[id].name)}</button>
    `).join('') + `<button type="button" class="chip" id="name-picker-add">+ Neu</button>`;

    row.querySelectorAll('.chip[data-id]').forEach((btn) => {
      btn.onclick = () => selectMemberAndEnter(btn.dataset.id, state.members[btn.dataset.id].name);
    });
    document.getElementById('name-picker-add').onclick = async () => {
      const name = prompt('Wie heisst du?');
      if (!name || !name.trim()) return;
      const id = await fbPush('members', { name: name.trim(), board: 'bm2000' });
      if (!id) { toast('Konnte nicht speichern.', 'err'); return; }
      state.members[id] = { name: name.trim(), board: 'bm2000' };
      selectMemberAndEnter(id, name.trim());
    };
  });
}

function selectMemberAndEnter(id, name) {
  state.member = { id, name };
  localStorage.setItem('pincho_member', JSON.stringify(state.member));
  boot();
}

/* "Raus" wechselt nur den lokal gewählten Namen (z. B. anderes Gerät,
   Kollege trainiert am selben Handy) — der Team-Code bleibt angemeldet. */
function logout() {
  localStorage.removeItem('pincho_member');
  state.member = null;
  renderNamePicker();
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
const NAV_ITEMS = [
  { route: 'fingerboard', label: 'Board' },
  { route: 'log', label: 'Log' },
  { route: 'plan', label: 'Plan' },
  { route: 'challenges', label: 'Challenges' },
];

function renderShell(contentHtml) {
  const memberName = state.member ? esc(state.member.name) : '';
  APP_ROOT.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <span class="mark">PIN<em>CHO</em></span>
        <p class="app-tagline mono" id="app-tagline">${appTaglineTyped ? esc(APP_TAGLINE) : ''}</p>
      </div>
      <div class="who">
        <span class="name mono">${memberName}</span>
        <button class="logout" id="logout-btn">RAUS</button>
      </div>
    </div>
    <div class="shell">${contentHtml}</div>
    <nav class="bottomnav">
      ${NAV_ITEMS.map((n) => `<a href="#${n.route}" class="${state.route === n.route ? 'active' : ''}">${n.label}${n.route === 'challenges' ? `<span class="nav-dot" id="nav-challenge-dot" ${challengeUnseenCount ? '' : 'hidden'}></span>` : ''}</a>`).join('')}
      <span class="nav-indicator" id="nav-indicator"></span>
    </nav>
  `;
  document.getElementById('logout-btn').onclick = logout;
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
  if (!nav || !active || !indicator) return;
  indicator.style.left = active.offsetLeft + 'px';
  indicator.style.width = active.offsetWidth + 'px';
}
window.addEventListener('resize', positionNavIndicator);

function render() {
  if (!state.member) { boot(); return; }
  switch (state.route) {
    case 'log': renderLog(); break;
    case 'fingerboard': renderFingerboard(); break;
    case 'challenges': renderChallenges(); break;
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
const LOG_TYPE_LABEL = { klettern: 'Klettern', gym: 'Gym', fingerboard: 'Fingerboard', mobility: 'Mobility', yoga: 'Yoga', jogging: 'Jogging', velo: 'Velo', pilates: 'Pilates', warmup: 'Warm-up', sonstiges: 'Sonstiges' };
/* logBuilder ist jetzt der PLAN-EDITOR (Ziel-Sätze/Wdh./Gewicht, kein
   Ergebnis) — siehe sessionPlans weiter unten fürs Speichern/Laden/
   Ausführen. */
let logBuilder = { exercises: loadDraft('log_exercises') || [] };
let logMode = 'planned'; // 'planned' | 'freestyle' | 'execute' | 'wall' — 'execute' nur über "Plan starten" erreichbar
let logPickerExerciseId = EXERCISE_LIBRARY[0].id;
/* Freestyle: kein fester Plan — Übung wählen, Satz für Satz mit Gewicht/Wdh
   erfassen (auch mehrfach dieselbe Übung, z. B. Aufwärm- vs. Arbeitssätze),
   erst beim Speichern wird daraus ein Log-Eintrag. exercises: Liste von
   {exerciseId, sets: [{weight, reps}, ...]} in der Reihenfolge, in der die
   Übungen zum ersten Mal gewählt wurden. */
let freestyleBuilder = loadDraft('freestyle') || { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id };

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

/* Geteilte Vorlagen — EINE flache, member-übergreifende Liste (statt eigener
   Collection pro Feature), sichtbar für die ganze Crew, nicht nur den, der
   sie gespeichert hat (anders als fingerboardTemplates/sessionPlans/
   wallTemplates, die pro Mitglied liegen). `kind` unterscheidet Fingerboard-
   Abläufe, Geplant-Pläne und Ausdauer-Blockabläufe innerhalb derselben
   Liste. */
let sharedTemplates = [];
async function loadSharedTemplates() {
  const raw = await fbGet('sharedTemplates');
  sharedTemplates = raw ? Object.entries(raw).map(([key, t]) => ({ ...t, id: key })) : [];
}
async function shareTemplate(kind, name, data) {
  const key = await fbPush('sharedTemplates', {
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

/* Vergleichstabelle über die letzten 3 Sessions: Zeilen = Satz 1/2/3...,
   Spalten = Datum je Session (neuste links) — zeigt die Tendenz auf einen
   Blick, nicht nur einen einzelnen "letzten Wert". */
function exerciseHistoryTableHtml(exerciseId) {
  const sessions = historyForExercise(exerciseId, 3);
  if (!sessions.length) return '';
  const maxSets = Math.max(...sessions.map((s) => s.sets.length));
  const suffix = exerciseIsHold(exerciseId) ? 's' : '';
  let rows = '';
  for (let i = 0; i < maxSets; i++) {
    rows += `<tr><td class="hist-row-label mono">Satz ${i + 1}</td>${sessions.map((s) => {
      const set = s.sets[i];
      if (!set) return '<td class="mono">–</td>';
      const w = set.weight !== '' && set.weight != null ? esc(String(set.weight)) + 'kg × ' : '';
      return `<td class="mono">${w}${esc(String(set.reps))}${suffix}</td>`;
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
  const hideSessionFields = logMode === 'wall' || logMode === 'planned' || logMode === 'warmup';
  await Promise.all([loadSessionPlans(), loadExerciseSettings(), loadSharedTemplates(), loadWallTemplates()]);
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Neue Session</h2><div class="sec-rule"></div></div>
    <div class="card">
      ${hideSessionFields ? '' : `
      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" id="log-date" value="${todayKey()}"></div>
        <div class="field"><label>Typ</label>
          <select id="log-type">
            ${Object.entries(LOG_TYPE_LABEL).map(([v, label]) => `<option value="${v}" ${v === 'gym' ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>`}

      ${logMode === 'execute' ? '' : `
      <div class="chip-row">
        <button type="button" class="chip ${logMode === 'planned' ? 'active' : ''}" data-log-mode="planned">Geplant</button>
        <button type="button" class="chip ${logMode === 'freestyle' ? 'active' : ''}" data-log-mode="freestyle">Freestyle</button>
        <button type="button" class="chip ${logMode === 'wall' ? 'active' : ''}" data-log-mode="wall">Ausdauer</button>
        <button type="button" class="chip ${logMode === 'warmup' ? 'active' : ''}" data-log-mode="warmup">Warm-up</button>
      </div>`}

      <div id="log-builder-panel"></div>

      ${hideSessionFields ? '' : `
      <div class="field"><label>Notiz (optional)</label><textarea id="log-note" placeholder="Befinden, Bedingungen, Sonstiges…"></textarea></div>
      <div class="field"><label>RPE (1–10, optional)</label><input type="number" id="log-rpe" min="1" max="10"></div>
      <button class="btn" id="log-save">SESSION SPEICHERN</button>`}
    </div>

    <div class="sec-head"><h2 class="sec-title">Verlauf</h2><div class="sec-rule"></div></div>
    <div class="list" id="log-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  renderLogBuilderPanel();

  document.querySelectorAll('[data-log-mode]').forEach((btn) => {
    btn.onclick = () => {
      logMode = btn.dataset.logMode;
      renderLog();
    };
  });

  if (hideSessionFields) { renderLogHistory(); return; }

  document.getElementById('log-save').onclick = async () => {
    const rawExercises = (logMode === 'execute' ? planExecution.exercises : freestyleBuilder.exercises).filter((g) => g.sets.length);
    if (!rawExercises.length) { toast('Noch keine Sätze erfasst.', 'err'); return; }
    const entry = {
      date: document.getElementById('log-date').value || todayKey(),
      type: document.getElementById('log-type').value,
      exercises: rawExercises.map((g) => ({ exerciseId: g.exerciseId, sets: g.sets })),
      note: document.getElementById('log-note').value.trim(),
      rpe: document.getElementById('log-rpe').value || null,
      createdAt: Date.now(),
    };
    const id = await fbPush(`logs/${state.member.id}`, entry);
    if (id) {
      toast('Session gespeichert.', 'ok');
      if (logMode === 'execute') {
        // Der Plan selbst bleibt erhalten (wie eine Fingerboard-Vorlage) —
        // nur die gerade laufende Ausführung wird zurückgesetzt.
        planExecution = null;
        logMode = 'planned';
      } else {
        freestyleBuilder = { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id };
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
  list.innerHTML = entries.length ? entries.map(([id, e]) => `
    <div class="log-item">
      <div class="top"><span>${esc(e.date)}</span><span class="type">${esc((e.type || '').toUpperCase())}</span></div>
      ${e.durationMin ? `<div class="ex-log-list"><div class="ex-log-row"><span>${sessionTypeIconLabel(e.type)}</span><span class="mono">${e.durationMin} Min.</span></div></div>` : ''}
      ${(e.exercises && e.exercises.length) ? `<div class="ex-log-list">${e.exercises.map((ex) => `
        <div class="ex-log-row"><span>${esc(exerciseName(ex.exerciseId))}</span><span class="mono">${esc(fbExerciseSetsText(ex))}</span></div>
      `).join('')}</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      ${challengeDurationChipsHtml(`log-share-${id}`, CHALLENGE_WINDOW_H)}
      <div class="field-row" style="margin-top:6px;">
        <button type="button" class="btn ghost small" data-share-log="${id}">Als Challenge teilen</button>
        <button type="button" class="btn ghost small" data-delete-log="${id}">Löschen</button>
      </div>
    </div>
  `).join('') : '<div class="list-empty">Noch keine Einträge.</div>';

  entries.forEach(([id]) => wireChallengeDurationChips(`log-share-${id}`));
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
        <button type="button" class="fb-transport-btn fb-play" id="wall-playpause" title="${isPausedNow ? 'Weiter' : 'Pause'}">${isPausedNow ? '▶' : '⏸'}</button>
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

/* ================================================================
   WARM-UP (kein Timer/Sätze — nur Start/Stopp + optionaler Freitext, was
   man gemacht hat. Bewusst so simpel wie möglich, da ein Aufwärmen keine
   strukturierte Erfassung braucht. Speichert wie "An die Wand" direkt in
   logs/{member}, sobald man nach dem Stopp auf Speichern tippt. */
let warmup = { running: false, seconds: 0, intervalId: null, note: '' };

function renderWarmupBuilder(holder) {
  const canSave = !warmup.running && warmup.seconds > 0;
  holder.innerHTML = `
    <div class="timer-box">
      <div class="big" id="warmup-big">${fmtMinSec(warmup.seconds)}</div>
    </div>
    <button type="button" class="btn" id="warmup-toggle" style="width:100%;margin-bottom:14px;">${warmup.running ? 'STOPP' : 'START'}</button>
    ${canSave ? `
      <div class="field"><label>Was hast du gemacht? (optional)</label><textarea id="warmup-note" placeholder="z. B. Rudergerät, Schulter-Mobilisation…">${esc(warmup.note)}</textarea></div>
      <button type="button" class="btn" id="warmup-save" style="width:100%;">SPEICHERN</button>
    ` : ''}
  `;
  document.getElementById('warmup-toggle').onclick = () => {
    if (warmup.running) {
      clearInterval(warmup.intervalId);
      warmup.intervalId = null;
      warmup.running = false;
    } else {
      warmup.running = true;
      warmup.seconds = 0;
      warmup.intervalId = setInterval(() => {
        warmup.seconds++;
        const big = document.getElementById('warmup-big');
        if (big) big.textContent = fmtMinSec(warmup.seconds);
      }, 1000);
    }
    renderWarmupBuilder(holder);
  };
  const noteEl = document.getElementById('warmup-note');
  if (noteEl) noteEl.oninput = (e) => { warmup.note = e.target.value; };
  const saveBtn = document.getElementById('warmup-save');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const elapsedMin = Math.max(1, Math.round(warmup.seconds / 60));
      const entry = { date: todayKey(), type: 'warmup', durationMin: elapsedMin, exercises: [], note: warmup.note.trim(), rpe: null, createdAt: Date.now() };
      const id = await fbPush(`logs/${state.member.id}`, entry);
      if (id) {
        toast('Warm-up gespeichert.', 'ok');
        warmup = { running: false, seconds: 0, intervalId: null, note: '' };
        renderLog();
      } else toast('Konnte nicht speichern.', 'err');
    };
  }
}

/* Kompakte Satz-Anzeige fürs Verlauf: geplante Einträge (fester Wert für
   alle Sätze) und Freestyle-Einträge (jeder Satz einzeln erfasst) sehen
   unterschiedlich aus, laufen aber in derselben Liste zusammen. */
function fbExerciseSetsText(ex) {
  const suffix = exerciseIsHold(ex.exerciseId) ? 's' : '';
  if (Array.isArray(ex.sets)) {
    return ex.sets.map((s) => (s.weight !== '' && s.weight != null ? `${s.weight}kg×${s.reps}${suffix}` : `${s.reps}${suffix}`)).join(', ');
  }
  return `${ex.sets}×${ex.reps}${suffix}${ex.weight ? ' @ ' + ex.weight + 'kg' : ''}`;
}

function renderLogBuilderPanel() {
  const holder = document.getElementById('log-builder-panel');
  if (!holder) return;

  if (logMode === 'wall') {
    renderWallBuilder(holder);
  } else if (logMode === 'warmup') {
    renderWarmupBuilder(holder);
  } else if (logMode === 'freestyle') {
    holder.innerHTML = `
      <div class="field">
        <label>Übung</label>
        <div id="fs-exercise-grid">${exercisePickerGridHtml(EXERCISE_LIBRARY, freestyleBuilder.pickerExerciseId)}</div>
      </div>
      <div id="fs-panel"></div>
      <div id="fs-discard-holder"></div>
    `;
    wireExercisePickerGrid('fs-exercise-grid', (id) => {
      freestyleBuilder.pickerExerciseId = id;
      let idx = freestyleBuilder.exercises.findIndex((g) => g.exerciseId === id);
      if (idx === -1) {
        freestyleBuilder.exercises.push({ exerciseId: id, sets: [] });
        idx = freestyleBuilder.exercises.length - 1;
      }
      freestyleBuilder.activeIndex = idx;
      renderFsPanel();
      // Zur aktiven Übung scrollen statt zu einer festen Stelle — das
      // Eingabefeld steht jetzt direkt bei ihr, nicht mehr fest oben.
      document.getElementById(`fs-group-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, null);
    renderFsPanel();
  } else if (logMode === 'execute') {
    holder.innerHTML = `
      <div class="sec-head" style="margin-top:0;"><h2 class="sec-title" style="font-size:16px;">${esc(planExecution.planName)}</h2><div class="sec-rule"></div></div>
      <div id="fs-panel"></div>
      <button type="button" class="btn ghost small" id="plan-execute-cancel" style="width:100%;margin-top:8px;">Ausführung abbrechen</button>
    `;
    renderFsPanel();
    document.getElementById('plan-execute-cancel').onclick = () => {
      if (!confirm('Ausführung abbrechen? Noch nicht gespeicherte Sätze gehen verloren.')) return;
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
          <button type="button" class="btn small ghost" id="plan-delete" style="flex:0 0 auto;" title="Eigenen Plan löschen">🗑</button>
        </div>
      </div>

      <div class="field">
        <label>Übung hinzufügen</label>
        <div id="log-exercise-grid">${exercisePickerGridHtml(EXERCISE_LIBRARY, logPickerExerciseId)}</div>
        <button type="button" class="btn" id="log-exercise-add" style="width:100%;margin-top:8px;">+ Hinzufügen</button>
      </div>

      <div id="log-exercise-rows"></div>

      <div class="chip-row" style="margin-top:14px;">
        <button type="button" class="chip" id="plan-save">Als Plan speichern</button>
      </div>
      <button type="button" class="btn" id="plan-start" ${logBuilder.exercises.length ? '' : 'disabled'} style="width:100%;">PLAN STARTEN</button>
    `;
    renderLogExerciseRows();
    wireExercisePickerGrid('log-exercise-grid', (id) => { logPickerExerciseId = id; }, 'log-exercise-add');
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
      toast('Plan gespeichert.', 'ok');
    };
    document.getElementById('plan-delete').onclick = async () => {
      const val = document.getElementById('log-template').value;
      const p = val.startsWith('plan:') && sessionPlans.find((pl) => pl.id === val.slice(5));
      if (!p) { toast('Nur eigene Pläne lassen sich löschen.', 'err'); return; }
      if (!confirm('Plan "' + p.name + '" löschen?')) return;
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
        exercises: logBuilder.exercises.map((ex) => ({
          exerciseId: ex.exerciseId, sets: [],
          targetSets: ex.sets, targetReps: ex.reps, targetWeight: ex.weight,
        })),
      };
      logMode = 'execute';
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
/* Pause-Timer zwischen Sätzen: startet automatisch, sobald der erste Satz
   der Session geloggt wird, läuft aufwärts weiter und piepst alle 30s —
   Hinweis, wie lange die Pause schon dauert, ohne dass man selbst die Zeit
   im Auge behalten muss. Läuft unabhängig von der gerade aktiven Übung
   (eine einzige, globale Pausenuhr), da die Pause zwischen Sätzen egal
   welcher Übung dieselbe ist. */
let fsRestTimer = { seconds: 0, intervalId: null };
function updateFsRestTimerUI() {
  const el = document.getElementById('fs-rest-timer');
  if (!el) return;
  el.hidden = false;
  el.textContent = `PAUSE ${fmtMinSec(fsRestTimer.seconds)}`;
}
function startFsRestTimer() {
  clearInterval(fsRestTimer.intervalId);
  fsRestTimer.seconds = 0;
  updateFsRestTimerUI();
  fsRestTimer.intervalId = setInterval(() => {
    fsRestTimer.seconds++;
    updateFsRestTimerUI();
    if (fsRestTimer.seconds % 30 === 0) beepStart();
  }, 1000);
}

/* Halte-Timer für isometrische Übungen (Plank, Wall Sit, ...) — Start/
   Stopp füllt die Haltedauer direkt als Sekunden ins Wdh.-Feld statt sie
   erraten/mitzählen zu müssen. Eine einzige, modul-globale Uhr reicht, da
   jeweils nur eine Übung gleichzeitig aktiv gehalten wird. */
let fsHoldTimer = { seconds: 0, intervalId: null };
function wireHoldTimerButton(btn, repsEl) {
  btn.onclick = () => {
    if (fsHoldTimer.intervalId) {
      clearInterval(fsHoldTimer.intervalId);
      fsHoldTimer.intervalId = null;
      repsEl.value = String(fsHoldTimer.seconds);
      btn.textContent = '⏱ Timer starten';
    } else {
      fsHoldTimer.seconds = 0;
      btn.textContent = '⏱ 0:00 · Stopp';
      fsHoldTimer.intervalId = setInterval(() => {
        fsHoldTimer.seconds++;
        btn.textContent = `⏱ ${fmtMinSec(fsHoldTimer.seconds)} · Stopp`;
      }, 1000);
    }
  };
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
    freestyleBuilder = { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id };
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
    holder.innerHTML = '<p class="login-hint">Übung wählen und "+ Übung" antippen, um Sätze zu erfassen.</p>';
    return;
  }

  // Das Eingabefeld (Gewicht/Wdh. + Satz-Knopf) schwebt jetzt fest oben,
  // statt in der Karte der jeweiligen Übung mitzuscrollen — sonst musste
  // man bei einer langen Übungsliste (oder offener Tastatur, die den
  // unteren Bildschirmteil frisst) erst zur richtigen Stelle zurück-
  // scrollen, um überhaupt einen Satz eintragen zu können.
  const floatingInputHtml = (g) => {
    const isHold = exerciseIsHold(g.exerciseId);
    // Vorschlag fürs Feld: zuerst der zuletzt in DIESER Session geloggte
    // Satz (damit ein zweiter, dritter... Satz nicht wieder den alten
    // Session-übergreifenden Wert zeigt), erst wenn noch keiner erfasst
    // wurde die Historie als Ausgangspunkt.
    const last = g.sets.length ? g.sets[g.sets.length - 1] : lastValueForExercise(g.exerciseId);
    return `
      <div class="field-row">
        <div class="field"><label>Gewicht (kg)</label><input type="number" inputmode="decimal" id="fs-weight" value="${last && last.weight != null ? esc(String(last.weight)) : ''}" step="0.5"></div>
        <div class="field"><label>${isHold ? 'Dauer (s)' : 'Wdh.'}</label><input type="text" inputmode="numeric" id="fs-reps" value="${last ? esc(String(last.reps)) : ''}"></div>
      </div>
      ${isHold ? `<button type="button" class="btn ghost small" id="fs-hold-timer" style="width:100%;margin-bottom:8px;">⏱ Timer starten</button>` : ''}
      <button type="button" class="btn small" id="fs-add-set" style="width:100%;">+ Satz</button>
    `;
  };

  const activeGroup = builder.exercises[builder.activeIndex];
  holder.innerHTML = `
    ${activeGroup ? `
    <div class="fs-sticky-bar fs-sticky-input" id="fs-sticky-bar">
      <div class="fs-sticky-head mono">
        <span>▸ ${esc(exerciseName(activeGroup.exerciseId))}</span>
        ${logMode === 'freestyle' ? `<button type="button" class="btn ghost small" id="fs-sticky-add" style="flex-shrink:0;">+ Übung</button>` : ''}
      </div>
      ${floatingInputHtml(activeGroup)}
    </div>` : ''}
    <div class="fs-rest-timer mono" id="fs-rest-timer" hidden></div>
    ${builder.exercises.map((g, gi) => {
      const targetText = g.targetReps != null
        ? `Ziel: ${g.targetSets}×${g.targetReps}${g.targetWeight ? ' @ ' + g.targetWeight + 'kg' : ''}`
        : '';
      return `
    <div class="fs-group ${gi === builder.activeIndex ? 'active' : ''}" id="fs-group-${gi}">
      <div class="fs-group-head">
        <span data-activate="${gi}" style="cursor:pointer;">${esc(exerciseName(g.exerciseId))}</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="ex-row-remove" data-info="${gi}" title="Info zur Übung">ℹ</button>
          ${logMode === 'freestyle' ? `<button type="button" class="ex-row-remove" data-remove-group="${gi}" title="Übung entfernen">×</button>` : ''}
        </div>
      </div>
      ${g.infoOpen ? fsExerciseInfoHtml(g.exerciseId) : ''}
      ${gi === builder.activeIndex && targetText ? `<div class="fs-target-value mono">${esc(targetText)}</div>` : ''}
      ${gi === builder.activeIndex ? exerciseHistoryTableHtml(g.exerciseId) : ''}
      ${g.sets.length ? g.sets.map((s, si) => `
        <div class="fs-set-row mono">
          <span>Satz ${si + 1}</span>
          <input type="number" inputmode="decimal" step="0.5" class="ex-row-input" data-edit="${gi}:${si}:weight" value="${s.weight !== '' && s.weight != null ? esc(String(s.weight)) : ''}" placeholder="kg" title="Gewicht">
          <input type="text" inputmode="numeric" class="ex-row-input" data-edit="${gi}:${si}:reps" value="${esc(String(s.reps))}" placeholder="${exerciseIsHold(g.exerciseId) ? 's' : 'Wdh'}" title="${exerciseIsHold(g.exerciseId) ? 'Dauer (s)' : 'Wiederholungen'}">
          <button type="button" class="ex-row-remove" data-remove-set="${gi}:${si}" title="Satz entfernen">×</button>
        </div>
      `).join('') : '<div class="fs-set-row mono" style="color:var(--ink-faint);">noch keine Sätze</div>'}
    </div>
  `;
    }).join('')}`;
  updateFsRestTimerUI();

  const stickyBar = document.getElementById('fs-sticky-bar');
  if (stickyBar) {
    const topbarH = document.querySelector('.topbar')?.getBoundingClientRect().height || 0;
    stickyBar.style.top = `${topbarH}px`;
    const stickyAdd = document.getElementById('fs-sticky-add');
    if (stickyAdd) {
      stickyAdd.onclick = () => {
        document.getElementById('fs-exercise-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }
  }

  holder.querySelectorAll('[data-activate]').forEach((el) => {
    el.onclick = () => {
      builder.activeIndex = Number(el.dataset.activate);
      renderFsPanel();
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
  });
  const weightEl = document.getElementById('fs-weight');
  const repsEl = document.getElementById('fs-reps');
  if (weightEl) {
    // Beim Antippen sofort leeren statt den alten Wert erst löschen zu
    // müssen — man tippt hier ja gerade rein, weil man ihn ändern will.
    weightEl.onfocus = (e) => { e.target.value = ''; };
    repsEl.onfocus = (e) => { e.target.value = ''; };
    const submitSet = () => {
      const reps = repsEl.value.trim();
      if (!reps) { toast('Wiederholungen eingeben.', 'err'); return; }
      const weightRaw = weightEl.value;
      // Feld VOR dem Neu-Rendern aktiv verlassen (Tastatur zu) — sonst
      // entscheidet auf Android manchmal die virtuelle Tastatur selbst,
      // wohin der Fokus springt, sobald das fokussierte Element beim
      // Re-Render verschwindet (z. B. zurück auf einen älteren Satz).
      weightEl.blur();
      repsEl.blur();
      builder.exercises[builder.activeIndex].sets.push({ weight: weightRaw === '' ? '' : Number(weightRaw), reps });
      startFsRestTimer();
      renderFsPanel();
    };
    // Enter auf dem Handy-Keyboard loggt den Satz direkt, ohne dass man
    // extra den Button antippen muss.
    weightEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitSet(); } };
    repsEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitSet(); } };
    document.getElementById('fs-add-set').onclick = submitSet;
    const holdBtn = document.getElementById('fs-hold-timer');
    if (holdBtn) wireHoldTimerButton(holdBtn, repsEl);
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
    };
  });
}

/* ================================================================
   FINGERBOARD
   ================================================================= */
let fbQuickstartOpen = false; // Schnelltraining-Karten sind standardmässig eingeklappt
let fbCheckinTyping = false; // während der Wdh./Gewicht-Eingabe im Check-in steht der Countdown still
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
    } else if (b.type === 'exercise') {
      if (!EXERCISE_LIBRARY.some((e) => e.id === b.exerciseId)) { errors.push(`Satz ${n}: unbekannte exerciseId "${b.exerciseId}".`); return; }
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
      errors.push(`Satz ${n}: "type" muss "hang", "exercise", "campus" oder "pause" sein (war "${b.type}").`);
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
  addType: 'hang',       // 'hang' | 'exercise' | 'campus' | 'pause' — welches Add-Panel gerade offen ist
  newHang: { reps: 3, hangSec: 7, restSec: 30, blockRestSec: 60 },      // Werte fürs nächste Hinzufügen, direkt im Add-Panel editierbar
  newExercise: { exerciseId: ACCESSORY_EXERCISES[0].id, reps: 15, workSec: 40, restSec: 30 },
  newCampus: {
    rungType: CAMPUS_RUNG_TYPES[0].id, moveMode: 'direct',
    fromRung: 1, toRung: 4, startRung: 1, pattern: [],
    reps: 4, workSec: 3, restSec: 15, blockRestSec: 90,
    armMode: 'both', startHand: 'left', // armMode: 'both' | 'match' | 'skip' — 'match'/'skip' zeigen zusätzlich startHand
  },
  newPause: { seconds: 60 },
  blocks: loadDraft('fb_blocks') || [], // Ablauf: {type:'hang', board, grip, reps, hangSec, restSec, blockRestSec} | {type:'exercise', exerciseId, reps, workSec, restSec} | {type:'campus', rungType, moveMode, reps, workSec, restSec, blockRestSec, fromRung/toRung ODER startRung/pattern, armMode, startHand} | {type:'pause', seconds}
  templates: [],         // eigene, in Firebase gespeicherte Abläufe (zusätzlich zu FINGERBOARD_TEMPLATES)
  weight: '',
  blockIndex: 0,
  running: false,
  awaitingNext: false,   // Satz fertig, wartet auf "Los" für den nächsten
  preCount: null,        // 5..1 während des Vorbereitungs-Countdowns vor einem Hang-Satz, sonst null
  sequence: [],          // flache Phasenliste NUR für den gerade laufenden Hang-Satz
  stepIndex: 0,
  secondsLeft: 0,
  intervalId: null,
  wakeLock: null,
  runResults: [],        // pro Blockindex: {type:'hang', doneReps:[bool,...]} | {type:'exercise', reps, weight} — was beim Durchlauf tatsächlich geschafft wurde
};

/* Echtes Board-Bild (eigene Illustration/eigenes Foto, siehe assets/) mit
   unsichtbaren, antippbaren Kreiszonen über den Griffen (Positionen aus
   data.js, in % von Bildbreite/-höhe — funktioniert responsiv). Da es sich
   bislang um eine Illustration handelt, ist die Zuordnung Zone↔Kategorie
   nach bestem Augenmass gewählt, nicht pixelgenau vermessen. */
function renderBoardImage() {
  const board = BOARDS[fb.board];
  const spots = board.hotspots.map((h) => {
    const grip = board.grips.find((g) => g.id === h.grip);
    const cls = fb.gripMode === 'different'
      ? [h.grip === fb.selectedGripLeft ? 'active-left' : '', h.grip === fb.selectedGripRight ? 'active-right' : ''].filter(Boolean).join(' ')
      : (fb.selectedGrip === h.grip ? 'active' : '');
    return `<button type="button" class="board-hotspot ${cls}" style="left:${h.x}%;top:${h.y}%;" data-grip="${h.grip}" title="${esc(grip.label)}${grip.note ? ' · ' + esc(grip.note) : ''}"></button>`;
  }).join('');
  return `<div class="board-photo-wrap" id="fb-board-photo">
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

function fbSelectedGripHint() {
  if (fb.gripMode === 'different') {
    const left = fb.selectedGripLeft ? esc(gripLabel(fb.board, fb.selectedGripLeft)) : '—';
    const right = fb.selectedGripRight ? esc(gripLabel(fb.board, fb.selectedGripRight)) : '—';
    return `Links: ${left} · Rechts: ${right}`;
  }
  return fb.selectedGrip
    ? 'Gewählt: ' + esc(gripLabel(fb.board, fb.selectedGrip))
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
function selectFbGrip(gripId) {
  // Nach der linken Hand automatisch zur rechten weiterschalten — ein Klick
  // weniger, da als Nächstes ohnehin der rechte Griff drankommt.
  const advanceToRight = fb.gripMode === 'different' && fb.pickingHand === 'left';
  if (fb.gripMode === 'different') {
    if (fb.pickingHand === 'left') fb.selectedGripLeft = gripId;
    else fb.selectedGripRight = gripId;
    if (advanceToRight) fb.pickingHand = 'right';
  } else {
    fb.selectedGrip = gripId;
  }
  const hint = document.getElementById('fb-selected-hint');
  if (hint) hint.textContent = fbSelectedGripHint();
  document.querySelectorAll('#fb-board-visual .board-hotspot').forEach((el) => {
    if (fb.gripMode === 'different') {
      el.classList.toggle('active-left', el.dataset.grip === fb.selectedGripLeft);
      el.classList.toggle('active-right', el.dataset.grip === fb.selectedGripRight);
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
    if (advanceToRight) {
      leftBtn.classList.remove('active');
      rightBtn.classList.add('active');
      const label = document.querySelector('#fb-add-panel .field label');
      if (label) label.textContent = 'Oder aus der Liste wählen (für rechts)';
    }
  }
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
          <button class="chip ${fb.pickingHand === 'left' ? 'active' : ''}" data-hand="left">Links${fb.selectedGripLeft ? ': ' + esc(gripLabel(fb.board, fb.selectedGripLeft)) : ' wählen'}</button>
          <button class="chip ${fb.pickingHand === 'right' ? 'active' : ''}" data-hand="right">Rechts${fb.selectedGripRight ? ': ' + esc(gripLabel(fb.board, fb.selectedGripRight)) : ' wählen'}</button>
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
        state.members[state.member.id] = { ...state.members[state.member.id], board: fb.board };
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
      el.onclick = () => selectFbGrip(el.dataset.grip);
    });
    document.getElementById('fb-grip-select').onchange = (e) => selectFbGrip(e.target.value || null);
    document.getElementById('fb-new-reps').oninput = (e) => { fb.newHang.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-hangsec').oninput = (e) => { fb.newHang.hangSec = Number(e.target.value) || 1; };
    document.getElementById('fb-new-restsec').oninput = (e) => { fb.newHang.restSec = Number(e.target.value) || 0; };
    document.getElementById('fb-new-blockrestsec').oninput = (e) => { fb.newHang.blockRestSec = Number(e.target.value) || 0; };
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
  } else if (fb.addType === 'exercise') {
    holder.innerHTML = `
      <div class="field">
        <label>Übung</label>
        <div id="fb-exercise-grid">${exercisePickerGridHtml(ACCESSORY_EXERCISES, fb.newExercise.exerciseId)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Ziel-Wdh.</label><input type="number" id="fb-new-exreps" value="${fb.newExercise.reps}" min="1"></div>
        <div class="field"><label>Dauer (s)</label><input type="number" id="fb-new-exwork" value="${fb.newExercise.workSec}" min="5"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-new-exrest" value="${fb.newExercise.restSec}" min="0"></div>
      </div>
      <button type="button" class="btn" id="fb-add-exercise" style="width:100%;">+ Übung hinzufügen</button>
    `;
    wireExercisePickerGrid('fb-exercise-grid', (id) => { fb.newExercise.exerciseId = id; }, 'fb-add-exercise');
    document.getElementById('fb-new-exreps').oninput = (e) => { fb.newExercise.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-exwork').oninput = (e) => { fb.newExercise.workSec = Number(e.target.value) || 5; };
    document.getElementById('fb-new-exrest').oninput = (e) => { fb.newExercise.restSec = Number(e.target.value) || 0; };
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

/* Reine Pause zum freien Einfügen in den Ablauf — z. B. zwischen zwei
   Board-Sätzen, ohne dass sie an einen bestimmten Satz-Typ gekoppelt ist. */
function renderPauseAddPanel(holder) {
  holder.innerHTML = `
    <div class="field"><label>Pause (s)</label><input type="number" id="fb-new-pause-seconds" value="${fb.newPause.seconds}" min="1"></div>
    <button type="button" class="btn" id="fb-add-pause" style="width:100%;">+ Pause hinzufügen</button>
  `;
  document.getElementById('fb-new-pause-seconds').oninput = (e) => { fb.newPause.seconds = Number(e.target.value) || 1; };
  document.getElementById('fb-add-pause').onclick = () => {
    fb.blocks.push({ type: 'pause', seconds: fb.newPause.seconds });
    renderFbBlocksList();
  };
}

/* Campus-Board: keine Foto-Hotspots wie beim Hangboard (Sprossen sind
   durchnummeriert, immer in einer Spalte) — stattdessen Sprossen-TYP per
   Chip + die Bewegung rein über Zahlen/Stepper, entweder als direkter
   Sprung ("Von → Zu") oder als sich wiederholendes Muster ("+2/-1 usw."). */
function renderCampusAddPanel(holder) {
  const c = fb.newCampus;
  holder.innerHTML = `
    <div class="field">
      <label>Sprossen-Typ</label>
      <div class="chip-row" id="campus-rung-toggle" style="margin-bottom:6px;">
        ${CAMPUS_RUNG_TYPES.map((t) => `<button type="button" class="chip ${c.rungType === t.id ? 'active' : ''}" data-rung="${t.id}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="campus-ref" id="campus-ref">
        <img src="${CAMPUS_BOARD_IMAGE}" alt="">
        ${campusRefLinesHtml(c.rungType)}
        <div class="campus-ref-label">Antippen zum Nachjustieren der Linie</div>
      </div>
      <p class="mono" id="campus-ref-calib" style="text-align:center;font-size:11px;color:var(--ink-faint);margin:4px 0 0;min-height:14px;"></p>
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
        <button type="button" class="chip ${c.armMode === 'both' ? 'active' : ''}" data-arm="both"><span class="emoji">🙌</span>Beidarmig</button>
        <button type="button" class="chip ${c.armMode === 'match' ? 'active' : ''}" data-arm="match"><span class="emoji">🔄</span>Nachziehen</button>
        <button type="button" class="chip ${c.armMode === 'skip' ? 'active' : ''}" data-arm="skip"><span class="emoji">🔃</span>Überspringen</button>
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
  wireCampusRefCalibration(c);
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
  holder.querySelectorAll('[data-step]').forEach((btn) => {
    btn.onclick = () => {
      const field = btn.dataset.step;
      c[field] = Math.max(1, c[field] + Number(btn.dataset.dir));
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
    if (c.moveMode === 'pattern' && !c.pattern.length) { toast('Zuerst ein Muster antippen.', 'err'); return; }
    fb.blocks.push({ type: 'campus', ...c, pattern: c.pattern.slice() });
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

    <div class="chip-row">
      <button class="chip ${fb.addType === 'hang' ? 'active' : ''}" data-add-type="hang">Hang-Satz</button>
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
        <button type="button" class="btn small ghost" id="fb-template-delete" style="flex:0 0 auto;" title="Eigene Vorlage löschen">🗑</button>
      </div>
    </div>
    <div class="chip-row" style="margin-bottom:16px;">
      <button type="button" class="chip" id="fb-template-save">Aktuellen Ablauf als Vorlage speichern</button>
      <button type="button" class="chip" id="fb-new-ablauf">Neuen, leeren Ablauf beginnen</button>
    </div>

    <div class="sec-head" id="fb-import-toggle" style="cursor:pointer;margin-top:0;">
      <h2 class="sec-title" style="font-size:15px;">Ablauf aus JSON importieren</h2><div class="sec-rule"></div>
      <span class="sec-chevron" id="fb-import-chevron">${fbImportOpen ? '▾' : '▸'}</span>
    </div>
    <div id="fb-import-panel" ${fbImportOpen ? '' : 'hidden'} style="margin-bottom:16px;">
      <div class="field">
        <label>JSON einfügen</label>
        <textarea id="fb-import-textarea" rows="6" placeholder='[{"type":"exercise","exerciseId":"face_pull","reps":15,"workSec":40,"restSec":30}]'></textarea>
      </div>
      <button type="button" class="btn small" id="fb-import-btn">Importieren</button>
      <p class="login-hint" id="fb-import-status" style="margin-top:8px;white-space:pre-line;"></p>
    </div>

    <div id="fb-blocks-list"></div>

    <div id="fb-runtime"></div>
  `);

  renderFbAddPanel();
  renderFbBlocksList(); // rendert am Ende auch renderFbRuntime() mit
  renderFbQuickstart();

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
  Promise.all([loadFbTemplates(), loadSharedTemplates()]).then(() => {
    if (state.route === 'fingerboard') { refreshFbTemplateOptions(); renderFbQuickstart(); }
  });
}

/* Ein Tap auf "Los" lädt die Vorlage UND startet den Ablauf sofort —
   kein Umweg über "in den Builder laden, runterscrollen, ABLAUF STARTEN
   antippen". Zeigt fest eingebaute (FINGERBOARD_TEMPLATES) und eigene,
   in Firebase gespeicherte (fb.templates) Abläufe zusammen als Karten. */
function findFbTemplateById(id) {
  return FINGERBOARD_TEMPLATES.find((r) => r.id === id) || fb.templates.find((r) => r.id === id) || sharedTemplatesOfKind('fingerboard').find((r) => r.id === id);
}

function renderFbQuickstart() {
  const holder = document.getElementById('fb-quickstart');
  if (!holder) return;
  const all = [...FINGERBOARD_TEMPLATES, ...fb.templates, ...sharedTemplatesOfKind('fingerboard')];
  if (!all.length) {
    holder.innerHTML = '<div class="list-empty">Noch keine Vorlagen — unten selbst einen Ablauf bauen und speichern.</div>';
    return;
  }
  holder.innerHTML = all.map((t, i) => {
    const totalSec = t.blocks.reduce((total, b) => total + fbBlockSeconds(b), 0);
    const badge = t.custom ? '<span class="qs-badge">Eigene</span>' : t.kind === 'fingerboard' ? `<span class="qs-badge">von ${esc(t.createdByName)}</span>` : '';
    return `
      <div class="qs-card anim-in" style="animation-delay:${i * 55}ms">
        <div class="qs-top">
          <div class="qs-name">${esc(t.name)}</div>
          ${badge}
        </div>
        ${t.note ? `<div class="qs-note">${esc(t.note)}</div>` : ''}
        <div class="qs-meta mono">${t.blocks.length} Sätze · ~${fmtMinSec(totalSec)}</div>
        <button type="button" class="btn qs-start" data-tpl="${t.id}">Los</button>
      </div>
    `;
  }).join('');
  holder.querySelectorAll('.qs-start').forEach((btn) => {
    btn.onclick = () => {
      const t = findFbTemplateById(btn.dataset.tpl);
      if (!t) return;
      if (fb.blocks.length && !confirm('Aktuellen Ablauf durch "' + t.name + '" ersetzen und sofort starten?')) return;
      fb.blocks = t.blocks.map((b) => (b.type === 'hang' ? { ...b, board: fb.board } : { ...b }));
      renderFbBlocksList();
      startAblauf(); // öffnet direkt das Ablauf-Vollbild
    };
  });
}

/* ---------- Fingerboard-Vorlagen (laden/speichern) ----------
   FINGERBOARD_TEMPLATES (data.js) sind feste, mitgelieferte Abläufe;
   fb.templates sind eigene, in Firebase gespeicherte — beide landen in
   derselben Auswahl. Ids eigener Vorlagen sind ihre Firebase-Push-Keys,
   fest eingebaute behalten ihre id aus data.js. */
async function loadFbTemplates() {
  const raw = await fbGet(`fingerboardTemplates/${state.member.id}`);
  fb.templates = raw ? Object.entries(raw).map(([key, t]) => ({ ...t, id: key, custom: true })) : [];
}

function refreshFbTemplateOptions() {
  const select = document.getElementById('fb-template-picker');
  if (!select) return;
  const shared = sharedTemplatesOfKind('fingerboard');
  select.innerHTML = `
    <option value="">— eigener Ablauf —</option>
    ${FINGERBOARD_TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
    ${fb.templates.length ? `<optgroup label="Eigene Vorlagen">
      ${fb.templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
    </optgroup>` : ''}
    ${shared.length ? `<optgroup label="Geteilte Vorlagen">
      ${shared.map((t) => `<option value="${t.id}">${esc(t.name)} (${esc(t.createdByName)})</option>`).join('')}
    </optgroup>` : ''}
  `;
}

function wireFbTemplatePicker() {
  refreshFbTemplateOptions();
  document.getElementById('fb-template-picker').onchange = (e) => {
    const id = e.target.value;
    const t = findFbTemplateById(id);
    if (!t) return;
    if (fb.blocks.length && !confirm('Aktuellen Ablauf durch "' + t.name + '" ersetzen?')) {
      e.target.value = '';
      return;
    }
    fb.blocks = t.blocks.map((b) => (b.type === 'hang' ? { ...b, board: fb.board } : { ...b }));
    renderFbBlocksList();
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
    toast('Vorlage gespeichert.', 'ok');
  };
  document.getElementById('fb-template-delete').onclick = async () => {
    const select = document.getElementById('fb-template-picker');
    const t = fb.templates.find((r) => r.id === select.value);
    if (!t) { toast('Nur eigene Vorlagen lassen sich löschen.', 'err'); return; }
    if (!confirm('Vorlage "' + t.name + '" löschen?')) return;
    await fbDelete(`fingerboardTemplates/${state.member.id}/${t.id}`);
    await loadFbTemplates();
    refreshFbTemplateOptions();
    toast('Vorlage gelöscht.', 'ok');
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
function buildBlockSequence(b) {
  if (b.type === 'hang') {
    const seq = [];
    for (let s = 0; s < b.reps; s++) {
      seq.push({ phase: 'Hang', seconds: b.hangSec });
      if (s < b.reps - 1) {
        if (b.restSec > 0) seq.push({ phase: 'Pause', seconds: b.restSec });
      } else {
        const trailingRest = b.blockRestSec != null ? b.blockRestSec : b.restSec;
        seq.push({ phase: trailingRest > 0 ? 'Pause' : 'Zeit zum Loggen', seconds: Math.max(trailingRest, 10) });
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
      seq.push({ phase: 'Work', seconds: b.workSec });
      if (s < b.reps - 1) {
        if (b.restSec > 0) seq.push({ phase: 'Pause', seconds: b.restSec });
      } else {
        const trailingRest = b.blockRestSec != null ? b.blockRestSec : b.restSec;
        seq.push({ phase: trailingRest > 0 ? 'Pause' : 'Zeit zum Loggen', seconds: Math.max(trailingRest, 10) });
      }
    }
    return seq;
  }
  if (b.type === 'pause') {
    return [{ phase: 'Pause', seconds: b.seconds }];
  }
  return [
    { phase: 'Work', seconds: b.workSec || 40 },
    { phase: b.restSec > 0 ? 'Pause' : 'Zeit zum Loggen', seconds: Math.max(b.restSec, 10) },
  ];
}
function isWorkPhase(step) {
  return !step || step.phase === 'Hang' || step.phase === 'Work';
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
const MUSCLE_ZONES_SVG = {
  neck_traps: '<rect x="33" y="25" width="24" height="8" rx="3"/>',
  shoulders: '<ellipse cx="24" cy="34" rx="8" ry="7"/><ellipse cx="66" cy="34" rx="8" ry="7"/>',
  chest: '<rect x="30" y="32" width="30" height="18" rx="4"/>',
  biceps: '<rect x="14" y="38" width="9" height="20" rx="4"/><rect x="67" y="38" width="9" height="20" rx="4"/>',
  forearms_front: '<rect x="10" y="60" width="8" height="24" rx="4"/><rect x="72" y="60" width="8" height="24" rx="4"/>',
  abs: '<rect x="34" y="52" width="22" height="26" rx="4"/>',
  obliques: '<rect x="26" y="54" width="7" height="22" rx="3"/><rect x="57" y="54" width="7" height="22" rx="3"/>',
  quads: '<rect x="28" y="80" width="16" height="34" rx="5"/><rect x="46" y="80" width="16" height="34" rx="5"/>',
  shins: '<rect x="30" y="116" width="11" height="28" rx="4"/><rect x="49" y="116" width="11" height="28" rx="4"/>',
  traps: '<rect x="133" y="21" width="24" height="14" rx="4"/>',
  rear_delts: '<ellipse cx="124" cy="34" rx="8" ry="7"/><ellipse cx="166" cy="34" rx="8" ry="7"/>',
  lats: '<rect x="128" y="38" width="34" height="24" rx="5"/>',
  triceps: '<rect x="112" y="38" width="9" height="20" rx="4"/><rect x="169" y="38" width="9" height="20" rx="4"/>',
  forearms_back: '<rect x="108" y="60" width="8" height="24" rx="4"/><rect x="174" y="60" width="8" height="24" rx="4"/>',
  lower_back: '<rect x="133" y="62" width="24" height="18" rx="4"/>',
  glutes: '<rect x="128" y="80" width="34" height="18" rx="6"/>',
  hamstrings: '<rect x="128" y="98" width="16" height="30" rx="5"/><rect x="146" y="98" width="16" height="30" rx="5"/>',
  calves: '<rect x="130" y="130" width="11" height="26" rx="4"/><rect x="149" y="130" width="11" height="26" rx="4"/>',
};

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
    <svg viewBox="0 0 190 160" class="muscle-map">
      <circle class="muscle-head" cx="45" cy="13" r="9"/>
      <circle class="muscle-head" cx="145" cy="13" r="9"/>
      ${zones}
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
  const note = exerciseSettings[exerciseId] || '';
  return `
    <div class="fb-muscle-block">
      ${howTo ? `<div class="ex-howto">${esc(howTo)}</div>` : ''}
      ${text ? bodyMapSvg(muscles.primary, muscles.secondary) : ''}
      ${text ? `<div class="fb-muscle-label mono">${esc(text)}</div>` : ''}
      <div class="field" style="margin-top:8px;">
        <label>Maschineneinstellungen (optional)</label>
        <textarea data-machine-note="${exerciseId}" placeholder="z. B. Sitz Stufe 4, ROM oben eingeschränkt…">${esc(note)}</textarea>
      </div>
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
    .filter((h) => h.grip === gripId)
    .map((s) => `<span class="dot" style="left:${s.x}%;top:${s.y}%;"></span>`)
    .join('');
  const dots2 = gripId2 ? board.hotspots
    .filter((h) => h.grip === gripId2)
    .map((s) => `<span class="dot dot-alt" style="left:${s.x}%;top:${s.y}%;"></span>`)
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
  return `${campusArmIcons(b)} Campus (${esc(campusRungLabel(b.rungType))}) · ${esc(campusMoveText(b))}`;
}
/* Ersetzt das reine Deko-Strichmännchen während des Campus-Arbeitssatzes:
   wichtiger als eine generische Figur ist, dass Bewegungsart/Starthand
   (Symbole) und die eigentliche Bewegung (welche Sprossen/welches Muster)
   auch aus einiger Distanz sofort erkennbar sind — deshalb gross und mit
   Pfeilen statt kleinem Fliesstext. */
function campusWorkFigureSvg(b) {
  const moveHtml = b.moveMode === 'pattern'
    ? `<div class="campus-work-pattern">${b.pattern.map((p) => `<span class="campus-work-chip ${p < 0 ? 'down' : 'up'}">${Math.abs(p)}${p > 0 ? '↑' : '↓'}</span>`).join('')}</div>
       <div class="campus-work-sub mono">AB SPROSSE ${b.startRung}</div>`
    : `<div class="campus-work-move mono">${b.fromRung}<span class="campus-work-arrow">→</span>${b.toRung}</div>`;
  return `<div class="campus-work-figure"><div class="campus-work-icons">${campusArmIcons(b)}</div>${moveHtml}</div>`;
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

/* Antippen des Referenzbilds loggt die %-Position (gleiches Muster wie
   wireCalibration() fürs Hangboard) — falls die grob geschätzten
   lineX-Werte in data.js für ein Board nicht genau passen, lässt sich das
   hier schnell nachjustieren statt raten zu müssen. */
function wireCampusRefCalibration(c) {
  const wrap = document.getElementById('campus-ref');
  const readout = document.getElementById('campus-ref-calib');
  if (!wrap || !readout) return;
  wrap.onclick = (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const line = `${campusRungLabel(c.rungType)}: lineX: ${x}`;
    readout.textContent = line;
    if (navigator.clipboard) navigator.clipboard.writeText(String(x)).catch(() => {});
  };
}

function fbBlockSub(b) {
  if (b.type === 'pause') {
    return `${b.seconds}s Pause`;
  }
  if (b.type === 'hang') {
    const blockRestSec = b.blockRestSec != null ? b.blockRestSec : b.restSec;
    return `${b.hangSec}s Hang · ${b.restSec}s zw. Sätzen · ${blockRestSec}s danach · ×${b.reps}`;
  }
  if (b.type === 'campus') {
    const blockRestSec = b.blockRestSec != null ? b.blockRestSec : b.restSec;
    return `${campusMoveText(b)} · ${b.workSec}s Ausführung · ${b.restSec}s zw. Sätzen · ${blockRestSec}s danach · ×${b.reps}`;
  }
  return `${b.workSec || 40}s Ausführung · Ziel ${b.reps}×${b.restSec ? ' · ' + b.restSec + 's Pause danach' : ''}`;
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
    const isHang = b.type === 'hang';
    const isCampus = b.type === 'campus';
    const isPause = b.type === 'pause';
    const title = isPause ? 'Pause' : isHang ? `Hang @ ${esc(hangGripLabel(b))}` : isCampus ? campusLabel(b) : esc(exerciseName(b.exerciseId));
    const thumb = isPause
      ? `<div class="timeline-thumb timeline-thumb-emoji">⏸</div>`
      : isHang
        ? hangBoardThumb(b)
        : isCampus
          ? `<div class="timeline-thumb"><img src="${CAMPUS_BOARD_IMAGE}" alt=""></div>`
          : `<div class="timeline-thumb timeline-thumb-emoji">💪</div>`;
    const edit = isPause ? `
        <input type="number" data-i="${i}" data-f="seconds" value="${b.seconds}" class="ex-row-input" title="Pause (s)">
      ` : isHang ? `
        <input type="number" data-i="${i}" data-f="reps" value="${b.reps}" class="ex-row-input" title="Wiederholungen">
        <button type="button" class="ex-row-step" data-step="${i}" title="Zusätzliche Wiederholung">+</button>
        <input type="number" data-i="${i}" data-f="hangSec" value="${b.hangSec}" class="ex-row-input" title="Hang (s)">
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
          <div class="timeline-drag-handle" data-drag="${i}" title="Ziehen zum Verschieben">⠿</div>
          ${thumb}
          <div class="info">
            <div class="title">${title}</div>
            <div class="sub" id="fb-sub-${i}">${esc(fbBlockSub(b))}</div>
            <div class="timeline-edit">${edit}</div>
          </div>
          <div class="timeline-move">
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
  wireFbBlocksDragReorder(holder);

  renderFbRuntime(); // Start-Button-Status hängt von fb.blocks.length ab
}

/* Verschieben per Ziehen am Griff-Symbol (⠿), zusätzlich zu den ▲/▼-
   Buttons — per Pointer Events (deckt Maus UND Touch einheitlich ab).
   Der gezogene Satz wird während des Ziehens aus dem normalen Fluss
   herausgenommen (position:fixed) und an seiner Stelle steht ein
   Platzhalter mit gleicher Höhe; die übrigen Sätze haben unterschiedliche
   Höhen (Hang/Übung/Campus/Pause haben verschieden viele Eingabefelder),
   deshalb lässt der Platzhalter den Browser selbst neu fliessen, statt
   mit einem festen Versatz zu rechnen. Reihenfolge wird erst beim
   Loslassen in fb.blocks übernommen und per renderFbBlocksList() (das
   auch speichert) neu aufgebaut. */
function wireFbBlocksDragReorder(holder) {
  const list = holder.querySelector('.timeline');
  if (!list) return;
  list.querySelectorAll('[data-drag]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const item = handle.closest('.timeline-item');
      const startIndex = Number(handle.dataset.drag);
      const rect = item.getBoundingClientRect();
      const startY = e.clientY;
      const startTop = rect.top;

      const placeholder = document.createElement('div');
      placeholder.className = 'timeline-item timeline-drag-placeholder';
      placeholder.style.height = rect.height + 'px';
      list.insertBefore(placeholder, item);

      item.classList.add('dragging');
      item.style.position = 'fixed';
      item.style.top = startTop + 'px';
      item.style.left = rect.left + 'px';
      item.style.width = rect.width + 'px';
      document.body.appendChild(item);

      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* z. B. sehr alte Browser — Drag funktioniert trotzdem */ }

      const onMove = (ev) => {
        const dy = ev.clientY - startY;
        item.style.top = (startTop + dy) + 'px';
        const centerY = startTop + dy + rect.height / 2;
        let moved = true;
        while (moved) {
          moved = false;
          const siblings = Array.from(list.children);
          const phIndex = siblings.indexOf(placeholder);
          const prev = siblings[phIndex - 1];
          if (prev) {
            const pr = prev.getBoundingClientRect();
            if (centerY < pr.top + pr.height / 2) { list.insertBefore(placeholder, prev); moved = true; continue; }
          }
          const next = siblings[phIndex + 1];
          if (next) {
            const nr = next.getBoundingClientRect();
            if (centerY > nr.top + nr.height / 2) { list.insertBefore(placeholder, next.nextSibling); moved = true; }
          }
        }
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        const finalIndex = Array.from(list.children).indexOf(placeholder);
        placeholder.remove();
        item.remove();
        if (finalIndex !== -1 && finalIndex !== startIndex) {
          const [moved] = fb.blocks.splice(startIndex, 1);
          fb.blocks.splice(finalIndex, 0, moved);
        }
        renderFbBlocksList();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  });
}

/* Nur noch der Idle-Zustand ("Ablauf starten") — sobald ein Ablauf läuft,
   übernimmt das Vollbild (fb-overlay, siehe unten) komplett. */
function renderFbRuntime() {
  const holder = document.getElementById('fb-runtime');
  if (!holder) return;
  holder.innerHTML = `<button class="btn" id="fb-start-ablauf" ${fb.blocks.length ? '' : 'disabled'}>ABLAUF STARTEN</button>`;
  const btn = document.getElementById('fb-start-ablauf');
  if (btn) btn.onclick = startAblauf;
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
const FB_HANG_FIGURE_SVG = `
  <svg viewBox="0 0 200 200" class="ex-figure fb-hang-figure">
    <line class="fig-rig" x1="40" y1="20" x2="160" y2="20"/>
    <g class="fig-pose">
      <line x1="78" y1="20" x2="94" y2="58"/>
      <line x1="122" y1="20" x2="106" y2="58"/>
      <circle cx="100" cy="42" r="14"/>
      <line x1="100" y1="58" x2="100" y2="120"/>
      <line x1="100" y1="120" x2="90" y2="180"/>
      <line x1="100" y1="120" x2="110" y2="180"/>
    </g>
  </svg>
`;
const FB_REST_FIGURE_SVG = `
  <svg viewBox="0 0 200 200" class="ex-figure fb-rest-figure">
    <g class="fig-pose">
      <circle cx="99" cy="42" r="15"/>
      <line x1="99" y1="60" x2="99" y2="138"/>
      <line x1="99" y1="138" x2="86" y2="196"/>
      <line x1="99" y1="138" x2="114" y2="196"/>
    </g>
    <line class="fig-pose fb-arm-shake" x1="99" y1="65" x2="80" y2="112"/>
    <line class="fig-pose fb-arm-shake" x1="99" y1="65" x2="118" y2="112"/>
  </svg>
`;

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

/* Nach links wischen = "fertig, weiter" (dasselbe wie ⏭/"Wiederholungen
   geschafft"), nach rechts = zurück — v. a. bei Übungs-Sätzen soll man so
   ohne genaues Zielen auf einen Button weiterkommen. Einmal auf das
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
    if (dx < 0) fbSkipForward(); else fbGoBack();
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
  if (el) el.textContent = 'Danach: ' + fbUpcomingLabel();
}

/* ---------- Transport-Leiste (Zurück / Play-Pause / Weiter) ----------
   Der Ablauf läuft nach dem ersten "LOS" von allein durch alle Sätze
   (Hang- wie Übungs-Sätze) — kein Antippen zwischen den Sätzen mehr nötig.
   Zurück/Weiter springen direkt in den Nachbar-Satz (inkl. dessen eigenem
   Vorbereitungs-Countdown bei Hang-Sätzen), Play/Pause hält den gerade
   laufenden Timer an, ohne den Bildschirm auszuschalten. */
function fbTransportRow() {
  const canPause = fb.running;
  const isPaused = canPause && !fb.intervalId;
  return `
    <div class="fb-transport">
      <button type="button" class="fb-transport-btn" id="fb-prev" ${fb.blockIndex === 0 ? 'disabled' : ''} title="Zurück">⏮</button>
      <button type="button" class="fb-transport-btn fb-play" id="fb-playpause" ${canPause ? '' : 'disabled'} title="${isPaused ? 'Weiter' : 'Pause'}">${isPaused ? '▶' : '⏸'}</button>
      <button type="button" class="fb-transport-btn" id="fb-skip" title="Diesen Satz überspringen">⏭</button>
    </div>
  `;
}

function fbGoBack() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  fbCheckinTyping = false; // Feld ist beim Blockwechsel weg — sonst bliebe die Zeit im neuen Block angehalten
  fb.blockIndex = Math.max(0, fb.blockIndex - 1);
  beginBlock();
}

function fbSkipForward() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  fbCheckinTyping = false; // Feld ist beim Blockwechsel weg — sonst bliebe die Zeit im neuen Block angehalten
  initBlockResult(fb.blockIndex); // frühzeitig übersprungen (z. B. "Wiederholungen geschafft") — trotzdem Standardwerte fürs Ergebnis
  fb.blockIndex++;
  if (fb.blockIndex >= fb.blocks.length) {
    releaseWakeLock();
    finishAblauf();
  } else {
    beginBlock();
  }
}

function fbTogglePause() {
  if (!fb.running) return;
  if (fb.intervalId) {
    clearInterval(fb.intervalId);
    fb.intervalId = null;
  } else {
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
    const isHang = next.type === 'hang';
    const isCampus = next.type === 'campus';
    const isPause = next.type === 'pause';
    const nextArmNote = isHang ? hangArmNote(next) : '';
    stage = `
      <div class="fb-stage-label mono">NÄCHSTER SATZ (${fb.blockIndex + 1}/${fb.blocks.length})</div>
      <div class="fb-stage-figure">${isPause ? FB_REST_FIGURE_SVG : isHang ? hangBoardThumb(next) : isCampus ? campusWorkFigureSvg(next) : exerciseFigureSvg(next.exerciseId)}</div>
      <div class="fb-stage-title">${isPause ? 'Pause' : isHang ? 'Hang @ ' + esc(hangGripLabel(next)) : isCampus ? campusLabel(next) : esc(exerciseName(next.exerciseId))}</div>
      <div class="fb-stage-sub mono">${esc(fbBlockSub(next))}${nextArmNote ? ' · ' + nextArmNote : ''}</div>
      ${fbTransportRow()}
      <button class="btn fb-stage-btn" id="fb-continue">LOS</button>
    `;
  } else if (fb.preCount != null) {
    const block = fb.blocks[fb.blockIndex];
    const armNote = hangArmNote(block);
    const tense = fb.preCount <= 3;
    stage = `
      <div class="fb-stage-label mono">SATZ ${fb.blockIndex + 1}/${fb.blocks.length} · ${esc(hangGripLabel(block))}${armNote ? ' · ' + armNote : ''}</div>
      <div class="fb-stage-figure">${hangBoardThumb(block)}</div>
      <div class="fb-precount ${tense ? 'fb-precount-tense' : ''}" id="fb-precount">${fb.preCount}</div>
      <div class="fb-stage-sub mono">Hände ans Board — gleich geht's los!</div>
      <button class="btn ghost fb-stage-btn" id="fb-cancel">ABBRECHEN</button>
    `;
  } else {
    // Ein einziges Template für Hang-, Übungs- UND Campus-Sätze — alle
    // laufen über dieselbe fb.sequence/tickBlock-Uhr, unterscheiden sich
    // nur darin, was während "Work" gezeigt wird (Board-Punkt, animiertes
    // Strichmännchen der Übung, oder das Campus-Symbol).
    const block = fb.blocks[fb.blockIndex];
    const isHang = block.type === 'hang';
    const isExercise = block.type === 'exercise';
    const isCampus = block.type === 'campus';
    const isPause = block.type === 'pause';
    const step = fb.sequence[fb.stepIndex];
    const working = isWorkPhase(step);
    const phaseTotal = step ? step.seconds : 1;
    const frac = phaseTotal ? 1 - fb.secondsLeft / phaseTotal : 0;
    const ringOffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
    const isPausedNow = fb.running && !fb.intervalId;
    const restWarn = !working && fb.secondsLeft > 0 && fb.secondsLeft <= 10;
    const armNote = isHang ? hangArmNote(block) : '';
    const label = isPause
      ? 'Pause'
      : isHang
        ? `Hang @ ${esc(hangGripLabel(block))}${armNote ? ' · ' + armNote : ''}`
        : isCampus ? campusLabel(block) : esc(exerciseName(block.exerciseId));
    const muscles = isExercise ? exerciseMuscles(block.exerciseId) : null;
    const muscleText = muscles ? muscleLabelsText(muscles.primary, muscles.secondary) : '';
    stage = `
      <div class="fb-stage-label mono">SATZ ${fb.blockIndex + 1}/${fb.blocks.length} · ${label}${isExercise ? ' · Ziel ' + esc(String(block.reps)) + '×' : ''}</div>
      ${isHang
        ? `<div class="fb-stage-figure">${hangBoardThumb(block)}</div>
           <div class="fb-hang-visual ${isPausedNow ? 'fb-paused' : ''}">
             <div class="fb-phase-figure" id="fb-phase-figure" data-kind="${working ? 'work' : 'rest'}">${working ? FB_HANG_FIGURE_SVG : FB_REST_FIGURE_SVG}</div>
             <div class="fb-timer-ring">
               <svg viewBox="0 0 120 120">
                 <circle class="ring-bg" cx="60" cy="60" r="52"/>
                 <circle class="ring-fg ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}" id="fb-ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${ringOffset}"/>
               </svg>
               <div class="big ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}" id="fb-big">${pad2(fb.secondsLeft)}</div>
             </div>
           </div>`
        : `<div class="fb-stage-figure" id="fb-phase-figure" data-kind="${working ? 'work' : 'rest'}">${working ? (isCampus ? campusWorkFigureSvg(block) : exerciseFigureSvg(block.exerciseId)) : FB_REST_FIGURE_SVG}</div>
           <div class="fb-hang-visual ${isPausedNow ? 'fb-paused' : ''}">
             <div class="fb-timer-ring">
               <svg viewBox="0 0 120 120">
                 <circle class="ring-bg" cx="60" cy="60" r="52"/>
                 <circle class="ring-fg ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}" id="fb-ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${ringOffset}"/>
               </svg>
               <div class="big ${working ? '' : 'rest'}${restWarn ? ' rest-warn' : ''}" id="fb-big">${pad2(fb.secondsLeft)}</div>
             </div>
           </div>`}
      <div class="phase mono" id="fb-phase">${step ? `${step.phase} · Schritt ${fb.stepIndex + 1}/${fb.sequence.length}${isPausedNow ? ' · PAUSIERT' : ''}` : ''}</div>
      ${muscleText ? `
        <div class="fb-muscle-block">
          ${bodyMapSvg(muscles.primary, muscles.secondary)}
          <div class="fb-muscle-label mono">${esc(muscleText)}</div>
        </div>
      ` : ''}
      <div class="fb-stage-next mono" id="fb-upcoming"></div>
      <div class="fb-checkin" id="fb-checkin" ${fb.stepIndex === fb.sequence.length - 1 && !working ? '' : 'hidden'}>${fb.stepIndex === fb.sequence.length - 1 && !working ? checkinPanelHtml(fb.blockIndex) : ''}</div>
      ${isExercise ? `<button class="btn fb-stage-btn" id="fb-reps-done" ${working ? '' : 'hidden'}>Wiederholungen geschafft — weiter</button>` : ''}
      ${fbTransportRow()}
      <button class="btn ghost fb-stage-btn" id="fb-cancel">ABBRECHEN</button>
    `;
  }

  el.innerHTML = `
    <button type="button" class="fb-overlay-close" id="fb-overlay-close" title="Abbrechen">✕</button>
    <div class="fb-overlay-inner">
      <div class="fb-progress-text mono" id="fb-progress-text"></div>
      <div class="fb-overlay-stage">${stage}</div>
    </div>
  `;

  document.getElementById('fb-overlay-close').onclick = cancelAblauf;
  const prevBtn = document.getElementById('fb-prev');
  if (prevBtn) prevBtn.onclick = fbGoBack;
  const skipBtn = document.getElementById('fb-skip');
  if (skipBtn) skipBtn.onclick = fbSkipForward;
  const ppBtn = document.getElementById('fb-playpause');
  if (ppBtn && !ppBtn.disabled) ppBtn.onclick = fbTogglePause;
  if (fb.awaitingNext) {
    document.getElementById('fb-continue').onclick = startCurrentBlock;
  } else if (fb.preCount != null) {
    document.getElementById('fb-cancel').onclick = cancelAblauf;
  } else {
    document.getElementById('fb-cancel').onclick = cancelAblauf;
    const repsDoneBtn = document.getElementById('fb-reps-done');
    if (repsDoneBtn) repsDoneBtn.onclick = fbSkipForward;
    // Nur verdrahten, wenn das Check-in-Markup gerade tatsächlich im DOM
    // steht (exakt dieselbe Bedingung wie beim Einbetten oben) — sonst
    // existiert z. B. nach "Zurück" zu einem bereits abgeschlossenen Block
    // (der schon ein Ergebnis hat, aber gerade nicht in der Schluss-Pause
    // steht) kein #fb-checkin-Inhalt zum Verdrahten.
    const inCheckinWindow = fb.stepIndex === fb.sequence.length - 1 && !isWorkPhase(fb.sequence[fb.stepIndex]);
    if (inCheckinWindow && fb.runResults[fb.blockIndex]) wireCheckinPanel(fb.blockIndex);
    updateFbUpcomingUI();
  }
  updateFbProgressUI();
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
    const osc = beep.ctx.createOscillator();
    const gain = beep.ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(beep.ctx.destination);
    gain.gain.setValueAtTime(0.2, beep.ctx.currentTime);
    osc.start();
    osc.stop(beep.ctx.currentTime + duration / 1000);
  } catch (e) { /* Audio nicht verfügbar, kein Problem */ }
}

/* Zwei akustische Signale statt eines einzelnen Tons pro Ereignis:
   - beepTick(): ein kurzer Piep pro Sekunde — sowohl beim Vorbereitungs-
     Countdown (letzte 3 von 5 Sekunden) als auch am Ende einer Pause
     (letzte 3 Sekunden), damit man auch ohne hinzuschauen merkt, dass es
     gleich weitergeht.
   - beepStart()/beepEnd(): ein einzelner, langer Ton für den tatsächlichen
     Wechsel Hang↔Pause. Bewusst derselbe Klang für beide — der Kontext
     (Countdown davor bzw. laufender Hang) macht schon eindeutig, was
     gerade passiert, und ein einheitliches "Bing" wirkt klarer als zwei
     ähnlich lange Töne, die man ohnehin kaum unterscheiden könnte. */
function beepTick() {
  beep(1400, 90);
}
function beepStart() {
  beep(1046, 380);
}
function beepEnd() {
  beep(1046, 380);
}

async function requestWakeLock() {
  if (fb.wakeLock) return; // schon aktiv — nicht doppelt anfordern (würde den Handle auf das alte Lock verlieren)
  try { if ('wakeLock' in navigator) fb.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignorieren */ }
}
function releaseWakeLock() {
  if (fb.wakeLock) { fb.wakeLock.release().catch(() => {}); fb.wakeLock = null; }
}

function startAblauf() {
  fb.blockIndex = 0;
  fb.running = false;
  fb.awaitingNext = true;
  fb.preCount = null;
  fb.runResults = [];
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
  if (block.type === 'hang' || block.type === 'campus') {
    // Campus-Züge sind wie Hang-Sätze binär "geschafft/nicht" pro
    // Wiederholung, keine variable Wdh./Gewicht-Erfassung wie bei Übungen.
    fb.runResults[index] = { type: block.type, doneReps: new Array(block.reps).fill(true) };
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
  if (result.type !== 'exercise') {
    return `
      <div class="fb-checkin-label mono">GESCHAFFTE SÄTZE — nicht geschaffte abwählen</div>
      <div class="fb-checkin-chips">
        ${result.doneReps.map((ok, i) => `<button type="button" class="fb-chip ${ok ? 'ok' : 'fail'}" data-satz="${i}">${i + 1}</button>`).join('')}
      </div>
    `;
  }
  return `
    <div class="fb-checkin-label mono">GESCHAFFT</div>
    <div class="fb-checkin-row">
      <input type="text" inputmode="numeric" id="fb-checkin-reps" value="${esc(String(result.reps))}" placeholder="Wdh.">
      <div class="kg-field"><input type="number" inputmode="decimal" id="fb-checkin-weight" value="${esc(String(result.weight))}" step="0.5" placeholder="0"><span class="mono">kg</span></div>
    </div>
  `;
}
function wireCheckinPanel(index) {
  const holder = document.getElementById('fb-checkin');
  const result = fb.runResults[index];
  if (!holder || !result || result.type === 'pause') return;
  if (result.type !== 'exercise') {
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
    repsEl.oninput = (e) => { result.reps = e.target.value; };
    weightEl.oninput = (e) => { result.weight = e.target.value === '' ? '' : Number(e.target.value); };
    // Zeit anhalten, solange getippt wird — sonst reisst der Countdown
    // mitten in der Eingabe ab, bevor man fertig ist.
    [repsEl, weightEl].forEach((el) => {
      el.onfocus = () => { fbCheckinTyping = true; };
      el.onblur = () => { fbCheckinTyping = false; };
    });
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

/* Startet fb.blockIndex: bei Hang-Sätzen erst der 5-Sekunden-Countdown zum
   Hände-ans-Board-Bekommen, danach automatisch der Timer; bei Übungs-Sätzen
   direkt der Timer (kein Board, das man greifen müsste). Wird sowohl beim
   allerersten Satz als auch bei jedem automatischen Weiterschalten sowie
   bei Zurück/Weiter aufgerufen — ein einziger Einstiegspunkt statt
   Sonderfällen pro Aufrufer. */
function beginBlock() {
  const block = fb.blocks[fb.blockIndex];
  if (!block) { finishAblauf(); return; }
  requestWakeLock();
  if (block.type === 'hang') {
    fb.preCount = 5;
    renderFbOverlay();
    fb.intervalId = setInterval(tickPreCountdown, 1000);
  } else {
    startSequence();
  }
}

function tickPreCountdown() {
  fb.preCount--;
  if (fb.preCount <= 0) {
    clearInterval(fb.intervalId);
    fb.intervalId = null;
    fb.preCount = null;
    startSequence();
    return;
  }
  if (fb.preCount <= 3) beepTick();
  renderFbOverlay();
}

function startSequence() {
  const block = fb.blocks[fb.blockIndex];
  fb.running = true;
  fb.sequence = buildBlockSequence(block);
  fb.stepIndex = 0;
  fb.secondsLeft = fb.sequence[0].seconds;
  fb.intervalId = setInterval(tickBlock, 1000);
  beepStart();
  renderFbOverlay();
  updateTimerUI();
}

function tickBlock() {
  if (fbCheckinTyping) return; // Zeit angehalten, solange man im Check-in tippt
  fb.secondsLeft--;
  const step = fb.sequence[fb.stepIndex];
  if (fb.secondsLeft <= 0) {
    fb.stepIndex++;
    if (fb.stepIndex >= fb.sequence.length) {
      clearInterval(fb.intervalId);
      fb.intervalId = null;
      beep(1318, 300);
      advanceBlock();
      return;
    }
    fb.secondsLeft = fb.sequence[fb.stepIndex].seconds;
    const newStep = fb.sequence[fb.stepIndex];
    if (isWorkPhase(newStep)) beepStart(); else beepEnd();
    // Letzte Pause des Blocks (danach kommt der nächste Satz) — genau hier
    // ist Zeit fürs Check-in, ohne den Ablauf zu unterbrechen: es läuft
    // nebenher während der ohnehin schon geplanten Erholung.
    if (!isWorkPhase(newStep) && fb.stepIndex === fb.sequence.length - 1) openBlockCheckin();
  } else if (step && !isWorkPhase(step) && fb.secondsLeft <= 3) {
    // Letzte 3 Sekunden einer Pause: kurzer Tick pro Sekunde als
    // akustische Vorwarnung, dass der nächste Satz gleich losgeht.
    beepTick();
  }
  updateTimerUI();
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
  const block = fb.blocks[fb.blockIndex];
  const step = fb.sequence[fb.stepIndex];
  const working = isWorkPhase(step);
  // Letzte 10 Sekunden einer Pause optisch hervorheben (Farbe + Pulsieren),
  // damit man auch aus der Distanz merkt, dass es gleich weitergeht.
  const restWarn = !working && fb.secondsLeft > 0 && fb.secondsLeft <= 10;

  if (big) {
    big.textContent = pad2(fb.secondsLeft);
    big.className = 'big' + (working ? '' : ' rest') + (restWarn ? ' rest-warn' : '');
  }
  if (phase) phase.textContent = step ? `${step.phase} · Schritt ${fb.stepIndex + 1}/${fb.sequence.length}` : '';
  if (ring) {
    const phaseTotal = step ? step.seconds : 1;
    const frac = phaseTotal ? 1 - fb.secondsLeft / phaseTotal : 0;
    ring.style.strokeDashoffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
    ring.classList.toggle('rest', !working);
    ring.classList.toggle('rest-warn', restWarn);
  }
  const kind = working ? 'work' : 'rest';
  if (figureHolder && figureHolder.dataset.kind !== kind) {
    figureHolder.innerHTML = working
      ? (block.type === 'hang' ? FB_HANG_FIGURE_SVG : block.type === 'campus' ? campusWorkFigureSvg(block) : exerciseFigureSvg(block.exerciseId))
      : FB_REST_FIGURE_SVG;
    figureHolder.dataset.kind = kind;
  }
  const repsDoneBtn = document.getElementById('fb-reps-done');
  if (repsDoneBtn) repsDoneBtn.hidden = !working;
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
  fbCheckinTyping = false;
  closeFbOverlay();
  renderFbRuntime();
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
    if (r.type === 'hang') {
      const done = r.doneReps.filter(Boolean).length;
      totalReps += r.doneReps.length;
      doneReps += done;
      return `<div class="fb-summary-row"><span>${esc(hangGripLabel(b))}</span><span class="mono">${done}/${r.doneReps.length}</span></div>`;
    }
    if (r.type === 'campus') {
      const done = r.doneReps.filter(Boolean).length;
      totalReps += r.doneReps.length;
      doneReps += done;
      return `<div class="fb-summary-row"><span>${campusLabel(b)}</span><span class="mono">${done}/${r.doneReps.length}</span></div>`;
    }
    const weightText = r.weight !== '' && r.weight != null ? ` × ${esc(String(r.weight))}kg` : '';
    return `<div class="fb-summary-row"><span>${esc(exerciseName(b.exerciseId))}</span><span class="mono">${esc(String(r.reps))}${weightText}</span></div>`;
  }).join('');
  const headline = totalReps ? `<div class="fb-summary-headline mono">${doneReps}/${totalReps} Sätze geschafft</div>` : '';
  return `${headline}<div class="fb-summary-list">${rows}</div>`;
}

async function finishAblauf() {
  fb.running = false;
  fb.awaitingNext = false;
  fb.blockIndex = 0;
  releaseWakeLock();
  beep(1568, 400);

  const board = fb.board;
  const blocks = fb.blocks;
  const results = fb.runResults.slice();

  const el = ensureFbOverlay();
  el.innerHTML = `
    <div class="fb-overlay-inner fb-overlay-done">
      <div class="fb-done-emoji">🎉</div>
      <div class="fb-stage-title">Ablauf geschafft!</div>
      <div class="fb-stage-sub mono">${blocks.length} Sätze · ${fmtMinSec(fbEstimateSeconds())} Trainingszeit</div>
      ${fbResultsSummaryHtml(blocks, results)}
      ${challengeDurationChipsHtml('fb-share', CHALLENGE_WINDOW_H)}
      <button class="btn fb-stage-btn ghost" id="fb-overlay-share">Als Challenge teilen</button>
      <button class="btn fb-stage-btn" id="fb-overlay-finish">Schliessen</button>
    </div>
  `;
  wireChallengeDurationChips('fb-share');
  document.getElementById('fb-overlay-finish').onclick = () => { closeFbOverlay(); renderFbRuntime(); };
  document.getElementById('fb-overlay-share').onclick = async (e) => {
    e.target.disabled = true;
    await shareFingerboardAsChallenge(board, blocks, selectedChallengeHours('fb-share'));
    e.target.textContent = 'Geteilt ✓';
  };
  spawnConfetti(document.querySelector('.fb-overlay-done'));

  const session = {
    date: todayKey(),
    board,
    weight: fb.weight || 0,
    blocks,
    results,
    createdAt: Date.now(),
  };
  await fbPush(`fingerboardSessions/${state.member.id}`, session);
  toast('Ablauf gespeichert 💪', 'ok');
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
  const now = Date.now();
  const windowH = hours || CHALLENGE_WINDOW_H;
  const participants = {};
  for (const id of Object.keys(state.members)) {
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
  const id = await fbPush('challenges', challenge);
  if (id) toast(`Challenge raus an die Crew (${windowH}h Zeit)!`, 'ok');
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

async function renderChallenges() {
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Challenges</h2><div class="sec-rule"></div></div>
    <p class="login-hint" style="margin:0 0 16px;text-align:left;">Ein Training fertig gemacht? Im Fingerboard (nach "Ablauf geschafft") oder im Log-Verlauf kannst du es der Crew als Challenge vorschlagen — Zeitfenster beim Teilen wählbar (24h bis 1 Woche).</p>
    <div class="list" id="challenge-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  const raw = await fbGet('challenges');
  state.challenges = raw || {};
  markChallengesSeenNow();
  const now = Date.now();

  // Abgelaufene, unbestätigte Teilnahmen als "expired" markieren (lazy).
  for (const [id, c] of Object.entries(state.challenges)) {
    if (now > c.expiresAt && c.participants) {
      for (const [pid, p] of Object.entries(c.participants)) {
        if (p.status === 'pending') {
          fbPatch(`challenges/${id}/participants/${pid}`, { status: 'expired' });
          p.status = 'expired';
        }
      }
    }
  }

  const entries = Object.entries(state.challenges).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const list = document.getElementById('challenge-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, c]) => renderChallengeCard(id, c, now)).join('') : '<div class="list-empty">Noch keine Challenges — teile ein fertiges Training, um die erste zu starten.</div>';

  list.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.onclick = async () => {
      await fbPatch(`challenges/${btn.dataset.confirm}/participants/${state.member.id}`, { status: 'done', completedAt: Date.now() });
      toast('Mitgemacht — stark!', 'ok');
      renderChallenges();
    };
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Diese Challenge wirklich löschen?')) return;
      await fbDelete(`challenges/${btn.dataset.delete}`);
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
        ${(!expired && my && my.status === 'pending') ? `<button class="btn small" data-confirm="${id}">MITGEMACHT</button>` : ''}
        ${isMine ? `<button class="btn ghost small" data-delete="${id}">LÖSCHEN</button>` : ''}
      </div>
    </div>
  `;
}

/* ---------- Start ---------- */
window.addEventListener('hashchange', () => {
  state.route = (location.hash || '#fingerboard').replace('#', '');
  render();
});
boot();

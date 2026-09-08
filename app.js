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
        ${list.filter((e) => e.category === cat).sort((a, b) => a.name.localeCompare(b.name, 'de')).map((e) => `
          <button type="button" class="ex-pick-btn ${e.id === selectedId ? 'active' : ''}" data-exercise="${e.id}">${esc(e.name)}</button>
        `).join('')}
      </div>
    `).join('');
}
function wireExercisePickerGrid(containerId, onSelect, scrollTargetId) {
  const holder = document.getElementById(containerId);
  if (!holder) return;
  holder.querySelectorAll('.ex-pick-btn').forEach((btn) => {
    btn.onclick = () => {
      holder.querySelectorAll('.ex-pick-btn').forEach((b) => b.classList.toggle('active', b === btn));
      onSelect(btn.dataset.exercise);
      if (scrollTargetId) {
        document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  route: (location.hash || '#plan').replace('#', ''),
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
      <h1 class="login-word">PIN<em>CHO</em></h1>
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
      <h1 class="login-word">PIN<em>CHO</em></h1>
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
  { route: 'plan', label: 'Plan' },
  { route: 'log', label: 'Log' },
  { route: 'fingerboard', label: 'Board' },
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
const LOG_TYPE_LABEL = { klettern: 'Klettern', gym: 'Gym', fingerboard: 'Fingerboard', mobility: 'Mobility', yoga: 'Yoga', jogging: 'Jogging', pilates: 'Pilates', sonstiges: 'Sonstiges' };
let logBuilder = { exercises: loadDraft('log_exercises') || [] };
let logMode = 'planned'; // 'planned' | 'freestyle'
let logPickerExerciseId = EXERCISE_LIBRARY[0].id;
/* Freestyle: kein fester Plan — Übung wählen, Satz für Satz mit Gewicht/Wdh
   erfassen (auch mehrfach dieselbe Übung, z. B. Aufwärm- vs. Arbeitssätze),
   erst beim Speichern wird daraus ein Log-Eintrag. exercises: Liste von
   {exerciseId, sets: [{weight, reps}, ...]} in der Reihenfolge, in der die
   Übungen zum ersten Mal gewählt wurden. */
let freestyleBuilder = loadDraft('freestyle') || { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id };

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

async function renderLog() {
  const isEndurance = logMode === 'endurance';
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Neue Session</h2><div class="sec-rule"></div></div>
    <div class="card">
      ${isEndurance ? '' : `
      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" id="log-date" value="${todayKey()}"></div>
        <div class="field"><label>Typ</label>
          <select id="log-type">
            ${Object.entries(LOG_TYPE_LABEL).map(([v, label]) => `<option value="${v}" ${v === 'gym' ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>`}

      <div class="chip-row">
        <button type="button" class="chip ${logMode === 'planned' ? 'active' : ''}" data-log-mode="planned">Geplant</button>
        <button type="button" class="chip ${logMode === 'freestyle' ? 'active' : ''}" data-log-mode="freestyle">Freestyle</button>
        <button type="button" class="chip ${logMode === 'endurance' ? 'active' : ''}" data-log-mode="endurance">Ausdauer</button>
      </div>

      <div id="log-builder-panel"></div>

      ${isEndurance ? '' : `
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

  if (isEndurance) { renderLogHistory(); return; }

  document.getElementById('log-save').onclick = async () => {
    const exercises = logMode === 'freestyle'
      ? freestyleBuilder.exercises.filter((g) => g.sets.length)
      : logBuilder.exercises;
    if (!exercises.length) { toast('Noch keine Übungen erfasst.', 'err'); return; }
    const entry = {
      date: document.getElementById('log-date').value || todayKey(),
      type: document.getElementById('log-type').value,
      exercises,
      note: document.getElementById('log-note').value.trim(),
      rpe: document.getElementById('log-rpe').value || null,
      createdAt: Date.now(),
    };
    const id = await fbPush(`logs/${state.member.id}`, entry);
    if (id) {
      toast('Session gespeichert.', 'ok');
      logBuilder = { exercises: [] };
      freestyleBuilder = { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id };
      saveDraft('log_exercises', logBuilder.exercises);
      saveDraft('freestyle', freestyleBuilder);
      renderLog();
    } else toast('Konnte nicht speichern.', 'err');
  };

  if (logMode === 'freestyle') renderFsActive(); // "Letztes Mal"-Hinweis nachreichen, falls schon eine Übung aktiv ist
  await renderLogHistory();
}

/* Verlauf-Liste — eigene Funktion, weil sie sowohl vom normalen
   Geplant/Freestyle-Zweig als auch vom Ausdauer-Zweig (der die übrigen
   Formularfelder gar nicht erst anzeigt) gebraucht wird. */
async function renderLogHistory() {
  const raw = await fbGet(`logs/${state.member.id}`);
  const entries = Object.entries(raw || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  state.logs = entries.map(([, e]) => e);
  const list = document.getElementById('log-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, e]) => `
    <div class="log-item">
      <div class="top"><span>${esc(e.date)}</span><span class="type">${esc((e.type || '').toUpperCase())}</span></div>
      ${e.durationMin ? `<div class="ex-log-list"><div class="ex-log-row"><span>⏱ Ausdauer</span><span class="mono">${e.durationMin} Min.</span></div></div>` : ''}
      ${(e.exercises && e.exercises.length) ? `<div class="ex-log-list">${e.exercises.map((ex) => `
        <div class="ex-log-row"><span>${esc(exerciseName(ex.exerciseId))}</span><span class="mono">${esc(fbExerciseSetsText(ex))}</span></div>
      `).join('')}</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      ${challengeDurationChipsHtml(`log-share-${id}`, CHALLENGE_WINDOW_H)}
      <button type="button" class="btn ghost small" data-share-log="${id}" style="margin-top:6px;">Als Challenge teilen</button>
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
}

/* ================================================================
   AUSDAUER (freies Klettern/Bouldern nach Minuten, statt Sätzen/Wdh.)
   Eigenständiger, einfacher Countdown — bewusst NICHT ins Fingerboard-
   Block-System eingebaut, das ist konzeptionell Hangboard-Training.
   Speichert direkt in logs/{member}, landet damit automatisch im
   selben Verlauf und ist über den bestehenden "Als Challenge teilen"-
   Weg genauso teilbar wie jede andere Session. */
const endurance = { minutes: 20, running: false, secondsLeft: 0, totalSeconds: 0, intervalId: null };

function ensureEnduranceOverlay() {
  let el = document.getElementById('endurance-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'endurance-overlay';
    el.className = 'fb-overlay hidden';
    document.body.appendChild(el);
  }
  return el;
}

async function startEnduranceTimer() {
  endurance.totalSeconds = endurance.minutes * 60;
  endurance.secondsLeft = endurance.totalSeconds;
  endurance.running = true;
  const el = ensureEnduranceOverlay();
  el.classList.remove('hidden');
  if (el.requestFullscreen) {
    try { await el.requestFullscreen(); } catch (e) { /* z.B. iOS Safari — CSS-Vollbild reicht als Fallback */ }
  }
  endurance.intervalId = setInterval(tickEndurance, 1000);
  renderEnduranceOverlay();
  beepStart();
}

function tickEndurance() {
  endurance.secondsLeft--;
  if (endurance.secondsLeft <= 0) {
    clearInterval(endurance.intervalId);
    endurance.intervalId = null;
    beep(1318, 300);
    finishEndurance();
    return;
  }
  if (endurance.secondsLeft <= 3) beepTick();
  updateEnduranceUI();
}

function toggleEndurancePause() {
  if (!endurance.running) return;
  if (endurance.intervalId) { clearInterval(endurance.intervalId); endurance.intervalId = null; }
  else { endurance.intervalId = setInterval(tickEndurance, 1000); }
  renderEnduranceOverlay();
}

function cancelEndurance() {
  clearInterval(endurance.intervalId);
  endurance.intervalId = null;
  endurance.running = false;
  const el = document.getElementById('endurance-overlay');
  if (el) el.classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function renderEnduranceOverlay() {
  const el = ensureEnduranceOverlay();
  const isPausedNow = endurance.running && !endurance.intervalId;
  const frac = endurance.totalSeconds ? 1 - endurance.secondsLeft / endurance.totalSeconds : 0;
  const ringOffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
  const mm = Math.floor(endurance.secondsLeft / 60);
  const ss = endurance.secondsLeft % 60;
  el.innerHTML = `
    <button type="button" class="fb-overlay-close" id="endurance-close" title="Abbrechen">✕</button>
    <div class="fb-overlay-inner">
      <div class="fb-stage-label mono">AUSDAUER</div>
      <div class="fb-hang-visual ${isPausedNow ? 'fb-paused' : ''}">
        <div class="fb-timer-ring">
          <svg viewBox="0 0 120 120">
            <circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-fg" id="endurance-ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${ringOffset}"/>
          </svg>
          <div class="big" id="endurance-big">${pad2(mm)}:${pad2(ss)}</div>
        </div>
      </div>
      <div class="phase mono">${isPausedNow ? 'PAUSIERT' : 'Läuft'}</div>
      <div class="fb-transport">
        <button type="button" class="fb-transport-btn fb-play" id="endurance-playpause" title="${isPausedNow ? 'Weiter' : 'Pause'}">${isPausedNow ? '▶' : '⏸'}</button>
      </div>
      <button class="btn fb-stage-btn" id="endurance-done-btn">FERTIG</button>
      <button class="btn ghost fb-stage-btn" id="endurance-cancel-btn">ABBRECHEN</button>
    </div>
  `;
  document.getElementById('endurance-close').onclick = cancelEndurance;
  document.getElementById('endurance-cancel-btn').onclick = cancelEndurance;
  document.getElementById('endurance-playpause').onclick = toggleEndurancePause;
  document.getElementById('endurance-done-btn').onclick = () => finishEndurance();
}

function updateEnduranceUI() {
  const big = document.getElementById('endurance-big');
  const ring = document.getElementById('endurance-ring-fg');
  const mm = Math.floor(endurance.secondsLeft / 60);
  const ss = endurance.secondsLeft % 60;
  if (big) big.textContent = `${pad2(mm)}:${pad2(ss)}`;
  if (ring) {
    const frac = endurance.totalSeconds ? 1 - endurance.secondsLeft / endurance.totalSeconds : 0;
    ring.style.strokeDashoffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
  }
}

/* Läuft der Timer komplett ab ODER wird "FERTIG" früher angetippt — in
   beiden Fällen wird die tatsächlich vergangene Zeit geloggt (nicht die
   ursprünglich eingestellte), falls man früher aufhört als geplant. */
async function finishEndurance() {
  clearInterval(endurance.intervalId);
  endurance.intervalId = null;
  endurance.running = false;
  const elapsedMin = Math.max(1, Math.round((endurance.totalSeconds - Math.max(endurance.secondsLeft, 0)) / 60));
  beep(1568, 400);

  const el = ensureEnduranceOverlay();
  el.innerHTML = `
    <div class="fb-overlay-inner fb-overlay-done">
      <div class="fb-done-emoji">🎉</div>
      <div class="fb-stage-title">Ausdauer geschafft!</div>
      <div class="fb-stage-sub mono">${elapsedMin} ${elapsedMin === 1 ? 'Minute' : 'Minuten'}</div>
      ${challengeDurationChipsHtml('endurance-share', CHALLENGE_WINDOW_H)}
      <button class="btn fb-stage-btn ghost" id="endurance-share-btn">Als Challenge teilen</button>
      <button class="btn fb-stage-btn" id="endurance-finish-btn">Schliessen</button>
    </div>
  `;
  wireChallengeDurationChips('endurance-share');
  spawnConfetti(document.querySelector('#endurance-overlay .fb-overlay-done'));

  const entry = { date: todayKey(), type: 'klettern', durationMin: elapsedMin, exercises: [], note: '', rpe: null, createdAt: Date.now() };
  const id = await fbPush(`logs/${state.member.id}`, entry);
  if (id) toast('Ausdauer-Session gespeichert 💪', 'ok'); else toast('Konnte nicht speichern.', 'err');

  document.getElementById('endurance-finish-btn').onclick = () => {
    const overlay = document.getElementById('endurance-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    renderLogHistory();
  };
  document.getElementById('endurance-share-btn').onclick = async (e) => {
    e.target.disabled = true;
    await shareLogEntryAsChallenge(entry, selectedChallengeHours('endurance-share'));
    e.target.textContent = 'Geteilt ✓';
  };
}

/* Kompakte Satz-Anzeige fürs Verlauf: geplante Einträge (fester Wert für
   alle Sätze) und Freestyle-Einträge (jeder Satz einzeln erfasst) sehen
   unterschiedlich aus, laufen aber in derselben Liste zusammen. */
function fbExerciseSetsText(ex) {
  if (Array.isArray(ex.sets)) {
    return ex.sets.map((s) => (s.weight !== '' && s.weight != null ? `${s.weight}kg×${s.reps}` : String(s.reps))).join(', ');
  }
  return `${ex.sets}×${ex.reps}${ex.weight ? ' @ ' + ex.weight + 'kg' : ''}`;
}

function renderLogBuilderPanel() {
  const holder = document.getElementById('log-builder-panel');
  if (!holder) return;

  if (logMode === 'endurance') {
    holder.innerHTML = `
      <div class="field"><label>Minuten</label><input type="number" inputmode="numeric" id="endurance-minutes" value="${endurance.minutes}" min="1"></div>
      <button type="button" class="btn" id="endurance-start" style="width:100%;">TIMER STARTEN</button>
    `;
    document.getElementById('endurance-minutes').oninput = (e) => { endurance.minutes = Number(e.target.value) || 1; };
    document.getElementById('endurance-start').onclick = startEnduranceTimer;
  } else if (logMode === 'freestyle') {
    holder.innerHTML = `
      <div class="field">
        <label>Übung</label>
        <div id="fs-exercise-grid">${exercisePickerGridHtml(EXERCISE_LIBRARY, freestyleBuilder.pickerExerciseId)}</div>
      </div>
      <div id="fs-active"></div>
      <div id="fs-entries"></div>
    `;
    wireExercisePickerGrid('fs-exercise-grid', (id) => {
      freestyleBuilder.pickerExerciseId = id;
      let idx = freestyleBuilder.exercises.findIndex((g) => g.exerciseId === id);
      if (idx === -1) {
        freestyleBuilder.exercises.push({ exerciseId: id, sets: [] });
        idx = freestyleBuilder.exercises.length - 1;
      }
      freestyleBuilder.activeIndex = idx;
      renderFsActive();
      renderFsEntries();
    }, 'fs-active');
    renderFsActive();
    renderFsEntries();
  } else {
    holder.innerHTML = `
      <div class="field">
        <label>Vorlage laden</label>
        <select id="log-template">
          <option value="">— eigener Ablauf —</option>
          ${ROUTINE_TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
        </select>
      </div>

      <div id="log-exercise-rows"></div>

      <div class="field">
        <label>Übung hinzufügen</label>
        <div id="log-exercise-grid">${exercisePickerGridHtml(EXERCISE_LIBRARY, logPickerExerciseId)}</div>
        <button type="button" class="btn" id="log-exercise-add" style="width:100%;margin-top:8px;">+ Hinzufügen</button>
      </div>
    `;
    renderLogExerciseRows();
    wireExercisePickerGrid('log-exercise-grid', (id) => { logPickerExerciseId = id; }, 'log-exercise-add');
    document.getElementById('log-template').onchange = (e) => {
      const t = ROUTINE_TEMPLATES.find((r) => r.id === e.target.value);
      logBuilder.exercises = t ? t.exercises.map((ex) => ({ ...ex, weight: '' })) : [];
      renderLogExerciseRows();
    };
    document.getElementById('log-exercise-add').onclick = () => {
      logBuilder.exercises.push({ exerciseId: logPickerExerciseId, sets: 3, reps: '', weight: '' });
      renderLogExerciseRows();
    };
  }
}

/* Aktive Freestyle-Übung: zeigt den letzten bekannten Wert (falls vorhanden)
   direkt als Vorschlag in den Feldern an — genau der "wo war ich stehen
   geblieben"-Hinweis. Eigene Render-Funktion (statt renderLogBuilderPanel
   erneut aufzurufen), damit ein Satz hinzufügen nicht das ganze Panel inkl.
   Übungs-Auswahl neu aufbaut. */
function renderFsActive() {
  const holder = document.getElementById('fs-active');
  if (!holder) return;
  const g = freestyleBuilder.exercises[freestyleBuilder.activeIndex];
  if (!g) {
    holder.innerHTML = '<p class="login-hint">Übung wählen und "+ Übung" antippen, um Sätze zu erfassen.</p>';
    return;
  }
  const last = lastValueForExercise(g.exerciseId);
  holder.innerHTML = `
    <div class="fs-active-card">
      <div class="fs-active-name">${esc(exerciseName(g.exerciseId))}</div>
      ${last ? `<div class="fs-last-value mono">Letztes Mal: ${last.weight !== '' && last.weight != null ? esc(String(last.weight)) + 'kg × ' : ''}${esc(String(last.reps))}</div>` : ''}
      <div class="field-row">
        <div class="field"><label>Gewicht (kg)</label><input type="number" inputmode="decimal" id="fs-weight" value="${last && last.weight != null ? esc(String(last.weight)) : ''}" step="0.5"></div>
        <div class="field"><label>Wdh.</label><input type="text" inputmode="numeric" id="fs-reps" value="${last ? esc(String(last.reps)) : ''}"></div>
      </div>
      <button type="button" class="btn small" id="fs-add-set" style="width:100%;">+ Satz</button>
    </div>
  `;
  document.getElementById('fs-add-set').onclick = () => {
    const reps = document.getElementById('fs-reps').value.trim();
    if (!reps) { toast('Wiederholungen eingeben.', 'err'); return; }
    const weightRaw = document.getElementById('fs-weight').value;
    g.sets.push({ weight: weightRaw === '' ? '' : Number(weightRaw), reps });
    renderFsEntries();
  };
}

function renderFsEntries() {
  saveDraft('freestyle', freestyleBuilder);
  const holder = document.getElementById('fs-entries');
  if (!holder) return;
  if (!freestyleBuilder.exercises.length) {
    holder.innerHTML = '<div class="list-empty" style="margin:14px 0;">Noch keine Sätze — Übung wählen und loslegen.</div>';
    return;
  }
  holder.innerHTML = freestyleBuilder.exercises.map((g, gi) => `
    <div class="fs-group ${gi === freestyleBuilder.activeIndex ? 'active' : ''}">
      <div class="fs-group-head">
        <span>${esc(exerciseName(g.exerciseId))}</span>
        <button type="button" class="ex-row-remove" data-remove-group="${gi}" title="Übung entfernen">×</button>
      </div>
      ${g.sets.length ? g.sets.map((s, si) => `
        <div class="fs-set-row mono">
          <span>Satz ${si + 1}</span>
          <span>${s.weight !== '' && s.weight != null ? esc(String(s.weight)) + 'kg × ' : ''}${esc(String(s.reps))}</span>
          <button type="button" class="ex-row-remove" data-remove-set="${gi}:${si}" title="Satz entfernen">×</button>
        </div>
      `).join('') : '<div class="fs-set-row mono" style="color:var(--ink-faint);">noch keine Sätze</div>'}
    </div>
  `).join('');
  holder.querySelectorAll('[data-remove-group]').forEach((btn) => {
    btn.onclick = () => {
      const gi = Number(btn.dataset.removeGroup);
      freestyleBuilder.exercises.splice(gi, 1);
      if (freestyleBuilder.activeIndex >= freestyleBuilder.exercises.length) freestyleBuilder.activeIndex = freestyleBuilder.exercises.length - 1;
      renderFsActive();
      renderFsEntries();
    };
  });
  holder.querySelectorAll('[data-remove-set]').forEach((btn) => {
    btn.onclick = () => {
      const [gi, si] = btn.dataset.removeSet.split(':').map(Number);
      freestyleBuilder.exercises[gi].sets.splice(si, 1);
      renderFsEntries();
    };
  });
}

function renderLogExerciseRows() {
  saveDraft('log_exercises', logBuilder.exercises);
  const holder = document.getElementById('log-exercise-rows');
  if (!holder) return;
  holder.innerHTML = logBuilder.exercises.length ? logBuilder.exercises.map((ex, i) => `
    <div class="ex-row">
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
      if (!board.grips.some((g) => g.id === b.grip)) { errors.push(`Satz ${n}: unbekannter grip "${b.grip}" für ${b.board}.`); return; }
      const reps = Number(b.reps);
      const hangSec = Number(b.hangSec);
      const restSec = Number(b.restSec);
      const blockRestSec = b.blockRestSec != null ? Number(b.blockRestSec) : null;
      if (!(reps > 0)) { errors.push(`Satz ${n}: reps muss eine Zahl > 0 sein.`); return; }
      if (!(hangSec > 0)) { errors.push(`Satz ${n}: hangSec muss eine Zahl > 0 sein.`); return; }
      if (!(restSec >= 0)) { errors.push(`Satz ${n}: restSec muss eine Zahl >= 0 sein.`); return; }
      if (blockRestSec != null && !(blockRestSec >= 0)) { errors.push(`Satz ${n}: blockRestSec muss eine Zahl >= 0 sein.`); return; }
      blocks.push({ type: 'hang', board: b.board, grip: b.grip, reps, hangSec, restSec, ...(blockRestSec != null ? { blockRestSec } : {}) });
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
      const common = { type: 'campus', rungType: b.rungType, moveMode: b.moveMode, reps, workSec, restSec, ...(blockRestSec != null ? { blockRestSec } : {}) };
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
    } else {
      errors.push(`Satz ${n}: "type" muss "hang", "exercise" oder "campus" sein (war "${b.type}").`);
    }
  });

  if (errors.length) return { errors };
  return { blocks };
}

const fb = {
  board: null,
  selectedGrip: null,   // am grafischen Board gewählter Griff, fürs Hinzufügen eines Hang-Satzes
  addType: 'hang',       // 'hang' | 'exercise' | 'campus' — welches Add-Panel gerade offen ist
  newHang: { reps: 3, hangSec: 7, restSec: 30, blockRestSec: 60 },      // Werte fürs nächste Hinzufügen, direkt im Add-Panel editierbar
  newExercise: { exerciseId: ACCESSORY_EXERCISES[0].id, reps: 15, workSec: 40, restSec: 30 },
  newCampus: {
    rungType: CAMPUS_RUNG_TYPES[0].id, moveMode: 'direct',
    fromRung: 1, toRung: 4, startRung: 1, pattern: [],
    reps: 4, workSec: 3, restSec: 15, blockRestSec: 90,
  },
  blocks: loadDraft('fb_blocks') || [], // Ablauf: {type:'hang', board, grip, reps, hangSec, restSec, blockRestSec} | {type:'exercise', exerciseId, reps, workSec, restSec} | {type:'campus', rungType, moveMode, reps, workSec, restSec, blockRestSec, fromRung/toRung ODER startRung/pattern}
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
    const active = fb.selectedGrip === h.grip;
    return `<button type="button" class="board-hotspot ${active ? 'active' : ''}" style="left:${h.x}%;top:${h.y}%;" data-grip="${h.grip}" title="${esc(grip.label)}${grip.note ? ' · ' + esc(grip.note) : ''}"></button>`;
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
  return fb.selectedGrip
    ? 'Gewählt: ' + esc(gripLabel(fb.board, fb.selectedGrip))
    : 'Griff am Board antippen (oder unten aus der Liste wählen).';
}

/* Nur die betroffenen Elemente aktualisieren statt renderFingerboard()
   komplett neu aufzurufen — ein voller Re-Render ersetzt #app und wirft
   den Scroll dabei zurück nach oben. Beim wiederholten Antippen mehrerer
   Griffe beim Ablauf-Bauen war das der eigentliche Grund fürs ständige
   Hoch-/Runterscrollen, nicht nur die Reihenfolge der Abschnitte. */
function selectFbGrip(gripId) {
  fb.selectedGrip = gripId;
  const hint = document.getElementById('fb-selected-hint');
  if (hint) hint.textContent = fbSelectedGripHint();
  document.querySelectorAll('#fb-board-visual .board-hotspot').forEach((el) => {
    el.classList.toggle('active', el.dataset.grip === gripId);
  });
  const select = document.getElementById('fb-grip-select');
  if (select && select.value !== (gripId || '')) select.value = gripId || '';
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
      <div class="board-visual" id="fb-board-visual">${renderBoardImage()}</div>
      <p class="mono" id="fb-calib-readout" style="text-align:center;font-size:11px;color:var(--ink-faint);margin:6px 0;min-height:14px;"></p>
      <p class="login-hint" id="fb-selected-hint" style="margin:0 0 8px;">${fbSelectedGripHint()}</p>
      <div class="field">
        <label>Oder aus der Liste wählen</label>
        <select id="fb-grip-select">
          <option value="">— Griff wählen —</option>
          ${BOARDS[fb.board].grips.map((g) => `<option value="${g.id}" ${fb.selectedGrip === g.id ? 'selected' : ''}>${esc(g.label)}${g.note ? ' · ' + esc(g.note) : ''}${gripArmNote(fb.board, g.id) ? ' · ' + gripArmNote(fb.board, g.id) : ''}</option>`).join('')}
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
        state.members[state.member.id] = { ...state.members[state.member.id], board: fb.board };
        fbPatch(`members/${state.member.id}`, { board: fb.board });
        renderFbAddPanel();
      };
    });
    document.getElementById('fb-board-visual').querySelectorAll('.board-hotspot').forEach((el) => {
      el.onclick = () => selectFbGrip(el.dataset.grip);
    });
    document.getElementById('fb-grip-select').onchange = (e) => selectFbGrip(e.target.value || null);
    document.getElementById('fb-new-reps').oninput = (e) => { fb.newHang.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-hangsec').oninput = (e) => { fb.newHang.hangSec = Number(e.target.value) || 1; };
    document.getElementById('fb-new-restsec').oninput = (e) => { fb.newHang.restSec = Number(e.target.value) || 0; };
    document.getElementById('fb-new-blockrestsec').oninput = (e) => { fb.newHang.blockRestSec = Number(e.target.value) || 0; };
    document.getElementById('fb-add-hang').onclick = () => {
      if (!fb.selectedGrip) { toast('Zuerst einen Griff wählen.', 'err'); return; }
      fb.blocks.push({ type: 'hang', board: fb.board, grip: fb.selectedGrip, ...fb.newHang });
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
  } else {
    renderCampusAddPanel(holder);
  }
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
      <div class="campus-ref">
        <img src="${CAMPUS_BOARD_IMAGE}" alt="">
        <div class="campus-ref-label">Zur Orientierung — nicht antippbar</div>
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
  document.getElementById('campus-mode-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.moveMode = btn.dataset.mode; renderFbAddPanel(); };
  });
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
  loadFbTemplates().then(() => {
    if (state.route === 'fingerboard') { refreshFbTemplateOptions(); renderFbQuickstart(); }
  });
}

/* Ein Tap auf "Los" lädt die Vorlage UND startet den Ablauf sofort —
   kein Umweg über "in den Builder laden, runterscrollen, ABLAUF STARTEN
   antippen". Zeigt fest eingebaute (FINGERBOARD_TEMPLATES) und eigene,
   in Firebase gespeicherte (fb.templates) Abläufe zusammen als Karten. */
function renderFbQuickstart() {
  const holder = document.getElementById('fb-quickstart');
  if (!holder) return;
  const all = [...FINGERBOARD_TEMPLATES, ...fb.templates];
  if (!all.length) {
    holder.innerHTML = '<div class="list-empty">Noch keine Vorlagen — unten selbst einen Ablauf bauen und speichern.</div>';
    return;
  }
  holder.innerHTML = all.map((t, i) => {
    const totalSec = t.blocks.reduce((total, b) => total + fbBlockSeconds(b), 0);
    return `
      <div class="qs-card anim-in" style="animation-delay:${i * 55}ms">
        <div class="qs-top">
          <div class="qs-name">${esc(t.name)}</div>
          ${t.custom ? '<span class="qs-badge">Eigene</span>' : ''}
        </div>
        ${t.note ? `<div class="qs-note">${esc(t.note)}</div>` : ''}
        <div class="qs-meta mono">${t.blocks.length} Sätze · ~${fmtMinSec(totalSec)}</div>
        <button type="button" class="btn qs-start" data-tpl="${t.id}">Los</button>
      </div>
    `;
  }).join('');
  holder.querySelectorAll('.qs-start').forEach((btn) => {
    btn.onclick = () => {
      const t = FINGERBOARD_TEMPLATES.find((r) => r.id === btn.dataset.tpl) || fb.templates.find((r) => r.id === btn.dataset.tpl);
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
  select.innerHTML = `
    <option value="">— eigener Ablauf —</option>
    ${FINGERBOARD_TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
    ${fb.templates.length ? `<optgroup label="Eigene Vorlagen">
      ${fb.templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
    </optgroup>` : ''}
  `;
}

function wireFbTemplatePicker() {
  refreshFbTemplateOptions();
  document.getElementById('fb-template-picker').onchange = (e) => {
    const id = e.target.value;
    const t = FINGERBOARD_TEMPLATES.find((r) => r.id === id) || fb.templates.find((r) => r.id === id);
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
    refreshFbTemplateOptions();
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

/* Kleines, unverzerrtes Board-Abbild mit einem Punkt an der Griffposition —
   zeigt auf einen Blick, welcher Griff für diesen Hang-Satz gemeint ist. */
function miniBoardThumb(boardId, gripId) {
  const board = BOARDS[boardId];
  // Manche Griffe haben zwei Löcher (links + rechts gespiegelt) — beide
  // markieren, sonst ist bei einem grossen Punkt in der Mitte nicht
  // erkennbar, welches der beiden Löcher gemeint ist.
  const dots = board.hotspots
    .filter((h) => h.grip === gripId)
    .map((s) => `<span class="dot" style="left:${s.x}%;top:${s.y}%;"></span>`)
    .join('');
  return `<div class="timeline-thumb"><img src="${board.image}" alt="">${dots}</div>`;
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
function campusLabel(b) {
  return `Campus (${esc(campusRungLabel(b.rungType))}) · ${esc(campusMoveText(b))}`;
}
function campusFigureSvg() {
  return `<div class="ex-figure-emoji">🤸</div>`;
}

function fbBlockSub(b) {
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
    const title = isHang ? `Hang @ ${esc(gripLabel(b.board, b.grip))}` : isCampus ? campusLabel(b) : esc(exerciseName(b.exerciseId));
    const thumb = isHang
      ? miniBoardThumb(b.board, b.grip)
      : isCampus
        ? `<div class="timeline-thumb"><img src="${CAMPUS_BOARD_IMAGE}" alt=""></div>`
        : `<div class="timeline-thumb timeline-thumb-emoji">💪</div>`;
    const edit = isHang ? `
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
          ${thumb}
          <div class="info">
            <div class="title">${title}</div>
            <div class="sub" id="fb-sub-${i}">${esc(fbBlockSub(b))}</div>
            <div class="timeline-edit">${edit}</div>
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
  if (nextBlock.type === 'hang') return 'Hang @ ' + gripLabel(nextBlock.board, nextBlock.grip);
  if (nextBlock.type === 'campus') return campusLabel(nextBlock);
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
    const nextArmNote = isHang ? gripArmNote(next.board, next.grip) : '';
    stage = `
      <div class="fb-stage-label mono">NÄCHSTER SATZ (${fb.blockIndex + 1}/${fb.blocks.length})</div>
      <div class="fb-stage-figure">${isHang ? miniBoardThumb(next.board, next.grip) : isCampus ? campusFigureSvg() : exerciseFigureSvg(next.exerciseId)}</div>
      <div class="fb-stage-title">${isHang ? 'Hang @ ' + esc(gripLabel(next.board, next.grip)) : isCampus ? campusLabel(next) : esc(exerciseName(next.exerciseId))}</div>
      <div class="fb-stage-sub mono">${esc(fbBlockSub(next))}${nextArmNote ? ' · ' + nextArmNote : ''}</div>
      ${fbTransportRow()}
      <button class="btn fb-stage-btn" id="fb-continue">LOS</button>
    `;
  } else if (fb.preCount != null) {
    const block = fb.blocks[fb.blockIndex];
    const armNote = gripArmNote(block.board, block.grip);
    const tense = fb.preCount <= 3;
    stage = `
      <div class="fb-stage-label mono">SATZ ${fb.blockIndex + 1}/${fb.blocks.length} · ${esc(gripLabel(block.board, block.grip))}${armNote ? ' · ' + armNote : ''}</div>
      <div class="fb-stage-figure">${miniBoardThumb(block.board, block.grip)}</div>
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
    const step = fb.sequence[fb.stepIndex];
    const working = isWorkPhase(step);
    const phaseTotal = step ? step.seconds : 1;
    const frac = phaseTotal ? 1 - fb.secondsLeft / phaseTotal : 0;
    const ringOffset = (FB_RING_CIRCUMFERENCE * (1 - frac)).toFixed(1);
    const isPausedNow = fb.running && !fb.intervalId;
    const restWarn = !working && fb.secondsLeft > 0 && fb.secondsLeft <= 10;
    const armNote = isHang ? gripArmNote(block.board, block.grip) : '';
    const label = isHang
      ? `Hang @ ${esc(gripLabel(block.board, block.grip))}${armNote ? ' · ' + armNote : ''}`
      : isCampus ? campusLabel(block) : esc(exerciseName(block.exerciseId));
    const muscles = isExercise ? exerciseMuscles(block.exerciseId) : null;
    const muscleText = muscles ? muscleLabelsText(muscles.primary, muscles.secondary) : '';
    stage = `
      <div class="fb-stage-label mono">SATZ ${fb.blockIndex + 1}/${fb.blocks.length} · ${label}${isExercise ? ' · Ziel ' + esc(String(block.reps)) + '×' : ''}</div>
      ${isHang
        ? `<div class="fb-stage-figure">${miniBoardThumb(block.board, block.grip)}</div>
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
        : `<div class="fb-stage-figure" id="fb-phase-figure" data-kind="${working ? 'work' : 'rest'}">${working ? (isCampus ? campusFigureSvg() : exerciseFigureSvg(block.exerciseId)) : FB_REST_FIGURE_SVG}</div>
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
  if (!result) return '';
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
  if (!holder || !result) return;
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
      ? (block.type === 'hang' ? FB_HANG_FIGURE_SVG : block.type === 'campus' ? campusFigureSvg() : exerciseFigureSvg(block.exerciseId))
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
    if (!r) return '';
    if (r.type === 'hang') {
      const done = r.doneReps.filter(Boolean).length;
      totalReps += r.doneReps.length;
      doneReps += done;
      return `<div class="fb-summary-row"><span>${esc(gripLabel(b.board, b.grip))}</span><span class="mono">${done}/${r.doneReps.length}</span></div>`;
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
    detail = (c.blocks || []).map((b) => b.type === 'hang'
      ? `<div class="ex core">Hang @ ${esc(gripLabel(b.board || c.board, b.grip))} · ${b.hangSec}s × ${esc(String(b.reps))} · ${b.restSec}s Pause</div>`
      : `<div class="ex core">${esc(exerciseName(b.exerciseId))} · ${b.workSec || 40}s × ${esc(String(b.reps))}</div>`
    ).join('');
  } else {
    title = LOG_TYPE_LABEL[c.sessionType] || esc(c.sessionType || 'Training');
    detail = c.durationMin
      ? `<div class="ex core">⏱ Ausdauer · ${c.durationMin} Min.</div>`
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
  state.route = (location.hash || '#plan').replace('#', '');
  render();
});
boot();

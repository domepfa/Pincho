/* ================================================================
   app.js — Pincho: Login, Routing, Views, Fingerboard-Timer, Challenges.
   Vanilla JS, kein Framework, kein Build-Step.
   ================================================================= */

const APP_ROOT = document.getElementById('app');
const TOAST_ROOT = document.getElementById('toast-root');

/* ---------- Helfer ---------- */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
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
      <p class="login-tag">Kraft, die an der Wand ankommt.</p>
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
      <span class="mark">PIN<em>CHO</em></span>
      <div class="who">
        <span class="name mono">${memberName}</span>
        <button class="logout" id="logout-btn">RAUS</button>
      </div>
    </div>
    <div class="shell">${contentHtml}</div>
    <nav class="bottomnav">
      ${NAV_ITEMS.map((n) => `<a href="#${n.route}" class="${state.route === n.route ? 'active' : ''}">${n.label}</a>`).join('')}
    </nav>
  `;
  document.getElementById('logout-btn').onclick = logout;
}

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
let logBuilder = { exercises: [] };

async function renderLog() {
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Neue Session</h2><div class="sec-rule"></div></div>
    <div class="card">
      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" id="log-date" value="${todayKey()}"></div>
        <div class="field"><label>Typ</label>
          <select id="log-type">
            <option value="klettern">Klettern</option>
            <option value="gym" selected>Gym</option>
            <option value="fingerboard">Fingerboard</option>
            <option value="mobility">Mobility</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </div>
      </div>

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
        <div class="field-row">
          <select id="log-exercise-picker" style="flex:2;">
            ${Object.entries(EXERCISE_CATEGORY_LABEL).map(([cat, label]) => `
              <optgroup label="${label}">
                ${EXERCISE_LIBRARY.filter((e) => e.category === cat).map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}
              </optgroup>
            `).join('')}
          </select>
          <button type="button" class="btn small" id="log-exercise-add" style="flex:0 0 auto;">+ Hinzufügen</button>
        </div>
      </div>

      <div class="field"><label>Notiz (optional)</label><textarea id="log-note" placeholder="Befinden, Bedingungen, Sonstiges…"></textarea></div>
      <div class="field"><label>RPE (1–10, optional)</label><input type="number" id="log-rpe" min="1" max="10"></div>
      <button class="btn" id="log-save">SESSION SPEICHERN</button>
    </div>

    <div class="sec-head"><h2 class="sec-title">Verlauf</h2><div class="sec-rule"></div></div>
    <div class="list" id="log-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  renderLogExerciseRows();

  document.getElementById('log-template').onchange = (e) => {
    const t = ROUTINE_TEMPLATES.find((r) => r.id === e.target.value);
    logBuilder.exercises = t ? t.exercises.map((ex) => ({ ...ex, weight: '' })) : [];
    renderLogExerciseRows();
  };
  document.getElementById('log-exercise-add').onclick = () => {
    const id = document.getElementById('log-exercise-picker').value;
    logBuilder.exercises.push({ exerciseId: id, sets: 3, reps: '', weight: '' });
    renderLogExerciseRows();
  };

  document.getElementById('log-save').onclick = async () => {
    const entry = {
      date: document.getElementById('log-date').value || todayKey(),
      type: document.getElementById('log-type').value,
      exercises: logBuilder.exercises,
      note: document.getElementById('log-note').value.trim(),
      rpe: document.getElementById('log-rpe').value || null,
      createdAt: Date.now(),
    };
    const id = await fbPush(`logs/${state.member.id}`, entry);
    if (id) { toast('Session gespeichert.', 'ok'); logBuilder = { exercises: [] }; renderLog(); }
    else toast('Konnte nicht speichern.', 'err');
  };

  const raw = await fbGet(`logs/${state.member.id}`);
  const entries = Object.entries(raw || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const list = document.getElementById('log-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, e]) => `
    <div class="log-item">
      <div class="top"><span>${esc(e.date)}</span><span class="type">${esc((e.type || '').toUpperCase())}</span></div>
      ${(e.exercises && e.exercises.length) ? `<div class="ex-log-list">${e.exercises.map((ex) => `
        <div class="ex-log-row"><span>${esc(exerciseName(ex.exerciseId))}</span><span class="mono">${esc(String(ex.sets))}×${esc(String(ex.reps))}${ex.weight ? ' @ ' + esc(String(ex.weight)) + 'kg' : ''}</span></div>
      `).join('')}</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
    </div>
  `).join('') : '<div class="list-empty">Noch keine Einträge.</div>';
}

function renderLogExerciseRows() {
  const holder = document.getElementById('log-exercise-rows');
  if (!holder) return;
  holder.innerHTML = logBuilder.exercises.length ? logBuilder.exercises.map((ex, i) => `
    <div class="ex-row">
      <span class="ex-row-name">${esc(exerciseName(ex.exerciseId))}</span>
      <input type="number" data-i="${i}" data-f="sets" value="${ex.sets}" placeholder="Sätze" class="ex-row-input" title="Sätze">
      <input type="text" data-i="${i}" data-f="reps" value="${esc(String(ex.reps))}" placeholder="Wdh" class="ex-row-input" title="Wiederholungen">
      <input type="number" data-i="${i}" data-f="weight" value="${ex.weight}" placeholder="kg" step="0.5" class="ex-row-input" title="Gewicht">
      <button type="button" class="ex-row-remove" data-remove="${i}">×</button>
    </div>
  `).join('') : '<div class="list-empty" style="margin-bottom:14px;">Noch keine Übungen — Vorlage laden oder unten hinzufügen.</div>';

  holder.querySelectorAll('input').forEach((inp) => {
    inp.oninput = () => {
      const i = Number(inp.dataset.i);
      const f = inp.dataset.f;
      logBuilder.exercises[i][f] = f === 'reps' ? inp.value : (Number(inp.value) || 0);
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
const fb = {
  board: null,
  grip: null,
  protocolId: 'max_hang',
  params: { ...PROTOCOLS.max_hang.defaults },
  weight: '',
  sequence: [],
  stepIndex: 0,
  secondsLeft: 0,
  running: false,
  intervalId: null,
  wakeLock: null,
};

function boardGripPositions(boardId) {
  const grips = BOARDS[boardId].grips;
  const cols = 2;
  return grips.map((g, i) => ({
    ...g,
    x: 8 + (i % cols) * 104,
    y: 8 + Math.floor(i / cols) * 46,
  }));
}

/* Bricht ein Griff-Label in max. 2 Zeilen um (an einer Leerstelle nahe der
   Mitte), damit es in der SVG-Box nicht überläuft. */
function wrapGripLabel(label) {
  if (label.length <= 13) return [label];
  const words = label.split(' ');
  if (words.length === 1) return [label];
  let bestIdx = 0, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const diff = Math.abs(a - b);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return [words.slice(0, bestIdx).join(' '), words.slice(bestIdx).join(' ')];
}

function renderBoardSvg() {
  const positions = boardGripPositions(fb.board);
  const cols = 2;
  const rows = Math.ceil(positions.length / cols);
  const h = 8 + rows * 46 + 24;
  const shapes = positions.map((g) => {
    const lines = wrapGripLabel(g.label);
    const startY = g.y + 21 - (lines.length - 1) * 5;
    const tspans = lines.map((line, li) => `<tspan x="${g.x + 48}" y="${startY + li * 10}">${esc(line)}</tspan>`).join('');
    return `
    <g class="grip-btn ${fb.grip === g.id ? 'active' : ''}" data-grip="${g.id}">
      <rect x="${g.x}" y="${g.y}" width="96" height="36" rx="4"></rect>
      <text x="${g.x + 48}" y="${startY}" font-size="8" text-anchor="middle">${tspans}</text>
    </g>
  `;
  }).join('');
  return `<svg viewBox="0 0 216 ${h}" width="100%">${shapes}</svg>`;
}

async function renderFingerboard() {
  if (!fb.board) fb.board = currentMemberBoard();

  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Fingerboard</h2><div class="sec-rule"></div></div>

    <div class="chip-row" id="fb-board-toggle">
      <button class="chip ${fb.board === 'bm1000' ? 'active' : ''}" data-board="bm1000">BM 1000</button>
      <button class="chip ${fb.board === 'bm2000' ? 'active' : ''}" data-board="bm2000">BM 2000</button>
    </div>

    <div class="board-visual" id="fb-board-visual">${renderBoardSvg()}</div>

    <div class="chip-row" id="fb-protocol">
      ${Object.keys(PROTOCOLS).map((p) => `<button class="chip ${fb.protocolId === p ? 'active' : ''}" data-proto="${p}">${PROTOCOLS[p].label}</button>`).join('')}
    </div>

    <div id="fb-params"></div>

    <div class="field"><label>Zusatzgewicht (kg, negativ = Assistenz)</label><input type="number" id="fb-weight" value="${fb.weight}" step="0.5"></div>

    <div class="timer-box">
      <div class="big ${fb.sequence[fb.stepIndex] && fb.sequence[fb.stepIndex].phase !== 'Hang' ? 'rest' : ''}" id="fb-big">${fb.running ? pad2(fb.secondsLeft) : '--'}</div>
      <div class="phase mono" id="fb-phase">${fb.running ? (fb.sequence[fb.stepIndex] ? fb.sequence[fb.stepIndex].phase : '') : 'bereit'}</div>
    </div>

    <div class="timer-controls">
      ${fb.running
        ? `<button class="btn ghost" id="fb-stop">STOP</button>`
        : `<button class="btn" id="fb-start" ${fb.grip ? '' : 'disabled'}>START</button>`}
    </div>
    ${!fb.grip ? '<p class="login-hint">Zuerst einen Griff auswählen.</p>' : ''}
  `);

  renderFingerboardParams();

  document.getElementById('fb-board-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.board = btn.dataset.board;
      fb.grip = null;
      state.members[state.member.id] = { ...state.members[state.member.id], board: fb.board };
      fbPatch(`members/${state.member.id}`, { board: fb.board });
      renderFingerboard();
    };
  });
  document.getElementById('fb-board-visual').querySelectorAll('.grip-btn').forEach((el) => {
    el.onclick = () => { fb.grip = el.dataset.grip; renderFingerboard(); };
  });
  document.getElementById('fb-protocol').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.protocolId = btn.dataset.proto;
      fb.params = { ...PROTOCOLS[fb.protocolId].defaults };
      renderFingerboard();
    };
  });
  document.getElementById('fb-weight').oninput = (e) => { fb.weight = e.target.value; };
  const startBtn = document.getElementById('fb-start');
  if (startBtn) startBtn.onclick = startFingerboardTimer;
  const stopBtn = document.getElementById('fb-stop');
  if (stopBtn) stopBtn.onclick = stopFingerboardTimer;
}

function renderFingerboardParams() {
  const holder = document.getElementById('fb-params');
  if (!holder) return;
  const fields = PROTOCOLS[fb.protocolId].fields;
  const labelMap = { hangSec: 'Hang (s)', restSec: 'Pause (s)', reps: 'Wdh/Satz', sets: 'Sätze', restBetweenSec: 'Satzpause (s)' };
  holder.innerHTML = `<div class="field-row">${fields.map((f) => `
    <div class="field"><label>${labelMap[f]}</label><input type="number" data-p="${f}" value="${fb.params[f]}"></div>
  `).join('')}</div>`;
  holder.querySelectorAll('input').forEach((inp) => {
    inp.oninput = () => { fb.params[inp.dataset.p] = Number(inp.value) || 0; };
  });
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

async function requestWakeLock() {
  try { if ('wakeLock' in navigator) fb.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignorieren */ }
}
function releaseWakeLock() {
  if (fb.wakeLock) { fb.wakeLock.release().catch(() => {}); fb.wakeLock = null; }
}

function startFingerboardTimer() {
  fb.sequence = buildSequence(fb.protocolId, fb.params);
  fb.stepIndex = 0;
  fb.secondsLeft = fb.sequence[0].seconds;
  fb.running = true;
  beep(880, 200);
  requestWakeLock();
  updateTimerUI();
  fb.intervalId = setInterval(tickFingerboardTimer, 1000);
  renderFingerboard();
}

function tickFingerboardTimer() {
  fb.secondsLeft--;
  if (fb.secondsLeft <= 0) {
    fb.stepIndex++;
    if (fb.stepIndex >= fb.sequence.length) {
      finishFingerboardTimer();
      return;
    }
    fb.secondsLeft = fb.sequence[fb.stepIndex].seconds;
    beep(fb.sequence[fb.stepIndex].phase === 'Hang' ? 1046 : 660, 220);
  }
  updateTimerUI();
}

function updateTimerUI() {
  const big = document.getElementById('fb-big');
  const phase = document.getElementById('fb-phase');
  if (!big || !phase) return;
  const step = fb.sequence[fb.stepIndex];
  big.textContent = pad2(fb.secondsLeft);
  big.className = 'big' + (step && step.phase !== 'Hang' ? ' rest' : '');
  phase.textContent = step ? `${step.phase} · Schritt ${fb.stepIndex + 1}/${fb.sequence.length}` : '';
}

function stopFingerboardTimer() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  fb.running = false;
  releaseWakeLock();
  renderFingerboard();
}

async function finishFingerboardTimer() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
  fb.running = false;
  releaseWakeLock();
  beep(1318, 400);

  const session = {
    date: todayKey(),
    board: fb.board,
    grip: fb.grip,
    protocolId: fb.protocolId,
    params: fb.params,
    weight: fb.weight || 0,
    createdAt: Date.now(),
  };
  await fbPush(`fingerboardSessions/${state.member.id}`, session);
  toast('Fingerboard-Session gespeichert 💪', 'ok');
  renderFingerboard();
}

/* ================================================================
   CHALLENGES
   ================================================================= */
const HOUR_MS = 60 * 60 * 1000;
const CHALLENGE_WINDOW_H = 48;

function getSharedGripIds() {
  if (Object.keys(state.members).length === 0) return []; // Mitgliederliste noch nicht geladen
  const boardIds = Object.values(state.members).map((m) => m.board || 'bm2000');
  const uniqueBoards = [...new Set(boardIds)];
  const gripSets = uniqueBoards.map((b) => new Set(BOARDS[b].grips.map((g) => g.id)));
  const allGrips = new Set(BOARDS.bm2000.grips.concat(BOARDS.bm1000.grips).map((g) => g.id));
  return [...allGrips].filter((id) => gripSets.every((s) => s.has(id)));
}

let newChallengeState = null;

function openNewChallengeForm() {
  newChallengeState = { grip: null, protocolId: 'max_hang', params: { ...PROTOCOLS.max_hang.defaults }, exercises: [] };
  renderChallenges();
}

async function renderChallenges() {
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Challenges</h2><div class="sec-rule"></div></div>
    <button class="btn ghost" id="new-challenge-btn" style="margin-bottom:16px;">${newChallengeState ? 'ABBRECHEN' : '+ NEUE CHALLENGE'}</button>
    <div id="new-challenge-form"></div>
    <div class="list" id="challenge-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  document.getElementById('new-challenge-btn').onclick = () => {
    newChallengeState = newChallengeState ? null : { grip: null, protocolId: 'max_hang', params: { ...PROTOCOLS.max_hang.defaults }, exercises: [] };
    renderChallenges();
  };

  if (newChallengeState) renderNewChallengeForm();

  const raw = await fbGet('challenges');
  state.challenges = raw || {};
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
  list.innerHTML = entries.length ? entries.map(([id, c]) => renderChallengeCard(id, c, now)).join('') : '<div class="list-empty">Noch keine Challenges — leg die erste an!</div>';

  list.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.onclick = async () => {
      await fbPatch(`challenges/${btn.dataset.confirm}/participants/${state.member.id}`, { status: 'done', completedAt: Date.now() });
      toast('Bestätigt — gut gemacht!', 'ok');
      renderChallenges();
    };
  });
}

function renderChallengeCard(id, c, now) {
  const expired = now > c.expiresAt;
  const hoursLeft = Math.max(0, Math.ceil((c.expiresAt - now) / HOUR_MS));
  const my = c.participants && c.participants[state.member.id];
  const myDone = my && my.status === 'done';
  return `
    <div class="challenge-card ${expired ? 'expired' : ''}">
      <span class="stamp ${myDone ? 'done' : ''}">${expired ? 'VORBEI' : hoursLeft + 'H'}</span>
      <p class="chal-from">Von <b>${esc(c.createdByName)}</b> · ${esc(gripLabel(c.board, c.grip))} · ${esc(PROTOCOLS[c.protocolId].label)}</p>
      <div class="exlist">
        <div class="ex"><b>${esc(PROTOCOLS[c.protocolId].label)}</b> auf ${esc(BOARDS[c.board].label)}</div>
        ${(c.exercises || []).map((ex) => `<div class="ex core">${esc(ex)}</div>`).join('')}
      </div>
      <div class="crew">
        ${Object.entries(c.participants || {}).map(([pid, p]) => `<span class="p ${p.status}">${esc((state.members[pid] || {}).name || '?')}</span>`).join('')}
      </div>
      ${(!expired && my && my.status === 'pending') ? `<button class="btn small" data-confirm="${id}">TRAINING BESTÄTIGEN</button>` : ''}
    </div>
  `;
}

function renderNewChallengeForm() {
  const holder = document.getElementById('new-challenge-form');
  const sharedGrips = getSharedGripIds();
  const boardForLabels = currentMemberBoard();

  holder.innerHTML = `
    <div class="new-challenge-form">
      <p class="card-title" style="margin-bottom:10px;">Nur Griffe, die auf allen Boards der Crew existieren</p>
      <div class="chip-row">
        ${sharedGrips.map((id) => `<button type="button" class="chip ${newChallengeState.grip === id ? 'active' : ''}" data-grip="${id}">${esc(gripLabel(boardForLabels, id))}</button>`).join('') || '<span class="mono" style="font-size:12px;color:var(--ink-faint);">Keine gemeinsamen Griffe (unterschiedliche Boards?)</span>'}
      </div>
      <div class="chip-row">
        ${Object.keys(PROTOCOLS).map((p) => `<button type="button" class="chip ${newChallengeState.protocolId === p ? 'active' : ''}" data-proto="${p}">${PROTOCOLS[p].label}</button>`).join('')}
      </div>
      ${Object.entries(EXERCISE_CATEGORY_LABEL).filter(([cat]) => ACCESSORY_EXERCISES.some((e) => e.category === cat)).map(([cat, label]) => `
        <div class="ex-cat-label">${label} — in den Pausen</div>
        <div class="ex-check-grid">
          ${ACCESSORY_EXERCISES.filter((e) => e.category === cat).map((e) => `
            <label class="ex-check"><input type="checkbox" value="${e.name}" ${newChallengeState.exercises.includes(e.name) ? 'checked' : ''}> ${esc(e.name)}</label>
          `).join('')}
        </div>
      `).join('')}
      <button class="btn" id="send-challenge-btn" style="margin-top:6px;">CHALLENGE SENDEN (48H)</button>
    </div>
  `;

  holder.querySelectorAll('[data-grip]').forEach((btn) => {
    btn.onclick = () => { newChallengeState.grip = btn.dataset.grip; renderNewChallengeForm(); };
  });
  holder.querySelectorAll('[data-proto]').forEach((btn) => {
    btn.onclick = () => { newChallengeState.protocolId = btn.dataset.proto; newChallengeState.params = { ...PROTOCOLS[btn.dataset.proto].defaults }; renderNewChallengeForm(); };
  });
  holder.querySelectorAll('.ex-check input').forEach((cb) => {
    cb.onchange = () => {
      if (cb.checked) newChallengeState.exercises.push(cb.value);
      else newChallengeState.exercises = newChallengeState.exercises.filter((v) => v !== cb.value);
    };
  });
  document.getElementById('send-challenge-btn').onclick = sendNewChallenge;
}

async function sendNewChallenge() {
  if (!newChallengeState.grip) { toast('Bitte einen Griff wählen.', 'err'); return; }
  const now = Date.now();
  const participants = {};
  for (const id of Object.keys(state.members)) {
    participants[id] = id === state.member.id
      ? { status: 'done', completedAt: now }
      : { status: 'pending' };
  }
  const challenge = {
    createdBy: state.member.id,
    createdByName: state.member.name,
    createdAt: now,
    expiresAt: now + CHALLENGE_WINDOW_H * HOUR_MS,
    board: currentMemberBoard(),
    grip: newChallengeState.grip,
    protocolId: newChallengeState.protocolId,
    params: newChallengeState.params,
    exercises: newChallengeState.exercises,
    participants,
  };
  const id = await fbPush('challenges', challenge);
  if (id) { toast('Challenge raus an die Crew!', 'ok'); newChallengeState = null; renderChallenges(); }
  else toast('Konnte Challenge nicht senden.', 'err');
}

/* ---------- Start ---------- */
window.addEventListener('hashchange', () => {
  state.route = (location.hash || '#plan').replace('#', '');
  render();
});
boot();

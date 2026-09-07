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
      <button class="btn" id="login-password-submit">PINCHIBOY, COME MAKE ME SCREAM!</button>
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
      <span class="nav-indicator" id="nav-indicator"></span>
    </nav>
  `;
  document.getElementById('logout-btn').onclick = logout;
  positionNavIndicator();
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
let logBuilder = { exercises: [] };
let logMode = 'planned'; // 'planned' | 'freestyle'
/* Freestyle: kein fester Plan — Übung wählen, Satz für Satz mit Gewicht/Wdh
   erfassen (auch mehrfach dieselbe Übung, z. B. Aufwärm- vs. Arbeitssätze),
   erst beim Speichern wird daraus ein Log-Eintrag. exercises: Liste von
   {exerciseId, sets: [{weight, reps}, ...]} in der Reihenfolge, in der die
   Übungen zum ersten Mal gewählt wurden. */
let freestyleBuilder = { exercises: [], activeIndex: -1 };

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

      <div class="chip-row">
        <button type="button" class="chip ${logMode === 'planned' ? 'active' : ''}" data-log-mode="planned">Geplant</button>
        <button type="button" class="chip ${logMode === 'freestyle' ? 'active' : ''}" data-log-mode="freestyle">Freestyle</button>
      </div>

      <div id="log-builder-panel"></div>

      <div class="field"><label>Notiz (optional)</label><textarea id="log-note" placeholder="Befinden, Bedingungen, Sonstiges…"></textarea></div>
      <div class="field"><label>RPE (1–10, optional)</label><input type="number" id="log-rpe" min="1" max="10"></div>
      <button class="btn" id="log-save">SESSION SPEICHERN</button>
    </div>

    <div class="sec-head"><h2 class="sec-title">Verlauf</h2><div class="sec-rule"></div></div>
    <div class="list" id="log-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  renderLogBuilderPanel();

  document.querySelectorAll('[data-log-mode]').forEach((btn) => {
    btn.onclick = () => {
      logMode = btn.dataset.logMode;
      document.querySelectorAll('[data-log-mode]').forEach((b) => b.classList.toggle('active', b.dataset.logMode === logMode));
      renderLogBuilderPanel();
    };
  });

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
      freestyleBuilder = { exercises: [], activeIndex: -1 };
      renderLog();
    } else toast('Konnte nicht speichern.', 'err');
  };

  const raw = await fbGet(`logs/${state.member.id}`);
  const entries = Object.entries(raw || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  state.logs = entries.map(([, e]) => e);
  if (logMode === 'freestyle') renderFsActive(); // "Letztes Mal"-Hinweis nachreichen, falls schon eine Übung aktiv ist
  const list = document.getElementById('log-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, e]) => `
    <div class="log-item">
      <div class="top"><span>${esc(e.date)}</span><span class="type">${esc((e.type || '').toUpperCase())}</span></div>
      ${(e.exercises && e.exercises.length) ? `<div class="ex-log-list">${e.exercises.map((ex) => `
        <div class="ex-log-row"><span>${esc(exerciseName(ex.exerciseId))}</span><span class="mono">${esc(fbExerciseSetsText(ex))}</span></div>
      `).join('')}</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
    </div>
  `).join('') : '<div class="list-empty">Noch keine Einträge.</div>';
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

  if (logMode === 'freestyle') {
    holder.innerHTML = `
      <div class="field">
        <label>Übung</label>
        <div class="field-row">
          <select id="fs-exercise-picker" style="flex:2;">
            ${Object.entries(EXERCISE_CATEGORY_LABEL).map(([cat, label]) => `
              <optgroup label="${label}">
                ${EXERCISE_LIBRARY.filter((e) => e.category === cat).map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}
              </optgroup>
            `).join('')}
          </select>
          <button type="button" class="btn small" id="fs-add-exercise" style="flex:0 0 auto;">+ Übung</button>
        </div>
      </div>
      <div id="fs-active"></div>
      <div id="fs-entries"></div>
    `;
    document.getElementById('fs-add-exercise').onclick = () => {
      const exerciseId = document.getElementById('fs-exercise-picker').value;
      let idx = freestyleBuilder.exercises.findIndex((g) => g.exerciseId === exerciseId);
      if (idx === -1) {
        freestyleBuilder.exercises.push({ exerciseId, sets: [] });
        idx = freestyleBuilder.exercises.length - 1;
      }
      freestyleBuilder.activeIndex = idx;
      renderFsActive();
      renderFsEntries();
    };
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
    `;
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

const fb = {
  board: null,
  selectedGrip: null,   // am grafischen Board gewählter Griff, fürs Hinzufügen eines Hang-Satzes
  addType: 'hang',       // 'hang' | 'exercise' — welches Add-Panel gerade offen ist
  newHang: { reps: 3, hangSec: 7, restSec: 30 },      // Werte fürs nächste Hinzufügen, direkt im Add-Panel editierbar
  newExercise: { reps: 15, workSec: 40, restSec: 30 },
  blocks: [],            // Ablauf: {type:'hang', board, grip, reps, hangSec, restSec} | {type:'exercise', exerciseId, reps, workSec, restSec}
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
        <div class="field"><label>Pause (s)</label><input type="number" id="fb-new-restsec" value="${fb.newHang.restSec}" min="0"></div>
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
    document.getElementById('fb-add-hang').onclick = () => {
      if (!fb.selectedGrip) { toast('Zuerst einen Griff wählen.', 'err'); return; }
      fb.blocks.push({ type: 'hang', board: fb.board, grip: fb.selectedGrip, ...fb.newHang });
      renderFbBlocksList();
    };
  } else {
    holder.innerHTML = `
      <div class="field">
        <label>Übung</label>
        <select id="fb-exercise-picker">
          ${Object.entries(EXERCISE_CATEGORY_LABEL).filter(([cat]) => ACCESSORY_EXERCISES.some((e) => e.category === cat)).map(([cat, label]) => `
            <optgroup label="${label}">
              ${ACCESSORY_EXERCISES.filter((e) => e.category === cat).map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}
            </optgroup>
          `).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Ziel-Wdh.</label><input type="number" id="fb-new-exreps" value="${fb.newExercise.reps}" min="1"></div>
        <div class="field"><label>Dauer (s)</label><input type="number" id="fb-new-exwork" value="${fb.newExercise.workSec}" min="5"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-new-exrest" value="${fb.newExercise.restSec}" min="0"></div>
      </div>
      <button type="button" class="btn" id="fb-add-exercise" style="width:100%;">+ Übung hinzufügen</button>
    `;
    document.getElementById('fb-new-exreps').oninput = (e) => { fb.newExercise.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-exwork').oninput = (e) => { fb.newExercise.workSec = Number(e.target.value) || 5; };
    document.getElementById('fb-new-exrest').oninput = (e) => { fb.newExercise.restSec = Number(e.target.value) || 0; };
    document.getElementById('fb-add-exercise').onclick = () => {
      const exerciseId = document.getElementById('fb-exercise-picker').value;
      fb.blocks.push({ type: 'exercise', exerciseId, ...fb.newExercise });
      renderFbBlocksList();
    };
  }
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
    </div>
    <div id="fb-add-panel" style="margin:12px 0 16px;"></div>

    <div class="field"><label>Zusatzgewicht für diese Session (kg, negativ = Assistenz)</label><input type="number" id="fb-weight" value="${fb.weight}" step="0.5"></div>

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

/* Phasenliste EINES Blocks — Hang-Sätze über buildSequence() (Hang/Pause je
   Wiederholung), Übungs-Sätze als ein "Work"-Schritt (feste Dauer statt
   Wiederholungszahl, damit der Timer automatisch weiterlaufen kann) plus
   optionaler "Pause" danach. Treibt sowohl die Zeitschätzung als auch den
   echten Timer im Ablauf-Vollbild — beides nutzt dieselbe Liste, damit sie
   nie auseinanderlaufen. */
function buildBlockSequence(b) {
  if (b.type === 'hang') return buildSequence('custom', { hangSec: b.hangSec, restSec: b.restSec, sets: b.reps });
  const seq = [{ phase: 'Work', seconds: b.workSec || 40 }];
  if (b.restSec > 0) seq.push({ phase: 'Pause', seconds: b.restSec });
  return seq;
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

function fbBlockSub(b) {
  if (b.type === 'hang') return `${b.hangSec}s Hang · ${b.restSec}s Pause · ×${b.reps}`;
  return `${b.workSec || 40}s Ausführung · Ziel ${b.reps}×${b.restSec ? ' · ' + b.restSec + 's Pause danach' : ''}`;
}

function renderFbBlocksList() {
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
    const title = isHang ? `Hang @ ${esc(gripLabel(b.board, b.grip))}` : esc(exerciseName(b.exerciseId));
    const thumb = isHang ? miniBoardThumb(b.board, b.grip) : `<div class="timeline-thumb timeline-thumb-emoji">💪</div>`;
    const edit = isHang ? `
        <input type="number" data-i="${i}" data-f="reps" value="${b.reps}" class="ex-row-input" title="Wiederholungen">
        <button type="button" class="ex-row-step" data-step="${i}" title="Zusätzliche Wiederholung">+</button>
        <input type="number" data-i="${i}" data-f="hangSec" value="${b.hangSec}" class="ex-row-input" title="Hang (s)">
        <input type="number" data-i="${i}" data-f="restSec" value="${b.restSec}" class="ex-row-input" title="Pause (s)">
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
  return nextBlock.type === 'hang' ? 'Hang @ ' + gripLabel(nextBlock.board, nextBlock.grip) : exerciseName(nextBlock.exerciseId);
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
  fb.blockIndex = Math.max(0, fb.blockIndex - 1);
  beginBlock();
}

function fbSkipForward() {
  clearInterval(fb.intervalId);
  fb.intervalId = null;
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
    const nextArmNote = isHang ? gripArmNote(next.board, next.grip) : '';
    stage = `
      <div class="fb-stage-label mono">NÄCHSTER SATZ (${fb.blockIndex + 1}/${fb.blocks.length})</div>
      <div class="fb-stage-figure">${isHang ? miniBoardThumb(next.board, next.grip) : exerciseFigureSvg(next.exerciseId)}</div>
      <div class="fb-stage-title">${isHang ? 'Hang @ ' + esc(gripLabel(next.board, next.grip)) : esc(exerciseName(next.exerciseId))}</div>
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
    // Ein einziges Template für Hang- UND Übungs-Sätze — beide laufen jetzt
    // über dieselbe fb.sequence/tickBlock-Uhr, unterscheiden sich nur darin,
    // was während "Work" gezeigt wird (Board-Punkt bzw. das animierte
    // Strichmännchen der Übung).
    const block = fb.blocks[fb.blockIndex];
    const isHang = block.type === 'hang';
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
      : esc(exerciseName(block.exerciseId));
    const muscles = !isHang ? exerciseMuscles(block.exerciseId) : null;
    const muscleText = muscles ? muscleLabelsText(muscles.primary, muscles.secondary) : '';
    stage = `
      <div class="fb-stage-label mono">SATZ ${fb.blockIndex + 1}/${fb.blocks.length} · ${label}${!isHang ? ' · Ziel ' + esc(String(block.reps)) + '×' : ''}</div>
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
        : `<div class="fb-stage-figure" id="fb-phase-figure" data-kind="${working ? 'work' : 'rest'}">${working ? exerciseFigureSvg(block.exerciseId) : FB_REST_FIGURE_SVG}</div>
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
      ${!isHang ? `<button class="btn fb-stage-btn" id="fb-reps-done" ${working ? '' : 'hidden'}>Wiederholungen geschafft — weiter</button>` : ''}
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
  openFbOverlay();
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
  beepStart();
  renderFbOverlay();
  updateTimerUI();
  fb.intervalId = setInterval(tickBlock, 1000);
}

function tickBlock() {
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
    if (isWorkPhase(fb.sequence[fb.stepIndex])) beepStart(); else beepEnd();
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
      ? (block.type === 'hang' ? FB_HANG_FIGURE_SVG : exerciseFigureSvg(block.exerciseId))
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
  closeFbOverlay();
  renderFbRuntime();
}

async function finishAblauf() {
  fb.running = false;
  fb.awaitingNext = false;
  fb.blockIndex = 0;
  releaseWakeLock();
  beep(1568, 400);

  const el = ensureFbOverlay();
  el.innerHTML = `
    <div class="fb-overlay-inner fb-overlay-done">
      <div class="fb-done-emoji">🎉</div>
      <div class="fb-stage-title">Ablauf geschafft!</div>
      <div class="fb-stage-sub mono">${fb.blocks.length} Sätze · ${fmtMinSec(fbEstimateSeconds())} Trainingszeit</div>
      <button class="btn fb-stage-btn" id="fb-overlay-finish">Schliessen</button>
    </div>
  `;
  document.getElementById('fb-overlay-finish').onclick = () => { closeFbOverlay(); renderFbRuntime(); };
  spawnConfetti(document.querySelector('.fb-overlay-done'));

  const session = {
    date: todayKey(),
    board: fb.board,
    weight: fb.weight || 0,
    blocks: fb.blocks,
    createdAt: Date.now(),
  };
  await fbPush(`fingerboardSessions/${state.member.id}`, session);
  toast('Ablauf gespeichert 💪', 'ok');
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

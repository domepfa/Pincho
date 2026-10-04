/* js/fb-dice.js — Board-Tab: Würfeln am Board und Würfelduell (openDuel, in sich geschlossen) */
/* ---------- Würfeln am Board ----------
   Ein Satz (füllt nur das Formular, Hinzufügen wie gewohnt) oder ein ganzer
   Ablauf (Vorschau, erst "Übernehmen" ersetzt den Ablauf). Sicherheit:
   gewürfelt wird nach Schwierigkeitsstufe — am Anfang nur grosse Griffe,
   kleine Leisten/Taschen erst nach ein paar Sätzen, Monos nie. */
const FB_DICE_TIER = {
  jug: 0, edge_large: 0, sloper_easy: 0,
  edge_medium: 1, sloper_medium: 1, pocket3: 1, pocket3_deep: 1, pocket2_deep: 1, edge3: 1,
  edge_small: 2, pocket3_small: 2, pocket2: 2, pocket2_offset: 2, sloper_hard: 2,
  edge_xsmall: 3, pocket2_small: 3,
};
const FB_DICE_CAMPUS_TIER = { rundleiste_gross: 0, leiste_gross: 0, leiste_35: 1, kugel_gross: 1, leiste_27: 2, kugel_klein: 2, leiste_19: 3 };
// Sprossenfolgen (Stationen), vom Leichten zum Schweren
const FB_DICE_CAMPUS_ROUTES = [
  [[1, 2, 3, 4], [1, 3, 5]],
  [[1, 3, 5, 7], [1, 4, 7], [1, 2, 3, 4, 5, 6]],
  [[1, 4, 7, 9], [1, 3, 5, 7, 9], [1, 5, 8]],
  [[1, 5, 9], [1, 4, 7, 10], [1, 4, 2, 5, 3, 6]],
];
let fbDice = { what: 'set', kind: 'hang', len: 15, preview: null };
const diceInt = (min, max, step = 1) => min + step * Math.floor(Math.random() * (Math.floor((max - min) / step) + 1));
const dicePick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Höchste erlaubte Stufe je nach Anzahl Arbeitssätze davor
const fbDiceMaxTier = (workBefore) => (workBefore < 2 ? 1 : workBefore < 4 ? 2 : 3);

/* Letzter Hang-Satz an diesem Griff aus dem Verlauf (für Hängezeit/Sätze) */
function fbDiceLastHang(board, grip) {
  for (const sn of fbSessionsCache) {
    const b = (sn.blocks || []).find((x) => x.type === 'hang' && x.board === board && x.grip === grip);
    if (b) return b;
  }
  return null;
}
function fbDiceHang(board, maxTier, lastGrip, warm = false) {
  // Einarmige Griffe nie würfeln — einarmig hängen ist zu hart für einen Zufallsvorschlag
  const grips = BOARDS[board].grips.filter((g) => FB_DICE_TIER[g.id] != null && FB_DICE_TIER[g.id] <= maxTier && g.id !== lastGrip && gripArmNote(board, g.id) !== 'einarmig');
  // Aufwärmen: grosse Griffe bevorzugen; danach schwerere Stufen etwas bevorzugen (sonst fast nur Aufwärmgriffe)
  const weighted = grips.flatMap((g) => Array(warm ? 2 - FB_DICE_TIER[g.id] : FB_DICE_TIER[g.id] + 1).fill(g));
  const g = dicePick(weighted.length ? weighted : BOARDS[board].grips.filter((x) => FB_DICE_TIER[x.id] === 0 && gripArmNote(board, x.id) !== 'einarmig'));
  const tier = FB_DICE_TIER[g.id] ?? 1;
  const last = fbDiceLastHang(board, g.id);
  const [lo, hi] = [[8, 12], [7, 10], [6, 10], [5, 8]][tier];
  const hangSec = last ? Math.min(hi + 2, Math.max(lo, last.hangSec + diceInt(-1, 1))) : diceInt(lo, hi);
  const b = { type: 'hang', board, grip: g.id, reps: diceInt(2, 4), hangSec, restSec: diceInt(30, 60, 15), blockRestSec: diceInt(90, 150, 30) };
  return b;
}
function fbDiceCampus(maxTier) {
  maxTier = Math.max(0, maxTier);
  const types = CAMPUS_RUNG_TYPES.filter((t) => (FB_DICE_CAMPUS_TIER[t.id] ?? 1) <= maxTier);
  const t = dicePick(types.length ? types : CAMPUS_RUNG_TYPES);
  const routeTier = Math.min(maxTier, FB_DICE_CAMPUS_ROUTES.length - 1);
  const stops = dicePick(FB_DICE_CAMPUS_ROUTES[diceInt(0, routeTier)]);
  return { rungType: t.id, stops, reps: diceInt(3, 5), workSec: 3, restSec: diceInt(15, 30, 15), blockRestSec: diceInt(90, 150, 30) };
}
function fbDiceCampusBlock(maxTier) {
  const d = fbDiceCampus(maxTier);
  const c = { ...fb.newCampus, rungType: d.rungType, rungSides: 'same', armMode: 'both', reps: d.reps, workSec: d.workSec, restSec: d.restSec, blockRestSec: d.blockRestSec };
  campusSetStops(c, d.stops);
  const out = { type: 'campus', ...c, pattern: (c.pattern || []).slice() };
  delete out.rungSides; delete out.pickHand; delete out.routeFresh; delete out.hands; delete out.skipEnd; delete out.rungTypeRight;
  return out;
}
/* Ganzer Ablauf: Aufwärmen auf grossen Griffen, dann ansteigend, bis die Ziellänge erreicht ist */
function fbDiceAblauf(kind, minutes) {
  const board = fb.board || currentMemberBoard();
  const blocks = [];
  let work = 0, lastGrip = null;
  const total = () => blocks.reduce((sum, b) => sum + fbBlockSeconds(b), 0);
  while (total() < minutes * 60 && blocks.length < 30) {
    const campusTurn = kind === 'campus' ? work >= 1 : kind === 'mix' ? work >= 2 && work % 2 === 1 : false;
    let b;
    if (campusTurn) b = fbDiceCampusBlock(fbDiceMaxTier(work) - 1);
    else { b = fbDiceHang(board, fbDiceMaxTier(work), lastGrip, work < 2); lastGrip = b.grip; }
    blocks.push(b);
    work++;
  }
  return blocks;
}
function fbDiceSet() {
  const workBefore = fb.blocks.filter((b) => b.type !== 'pause').length;
  const maxTier = fbDiceMaxTier(workBefore);
  if (fbDice.kind === 'campus') {
    const d = fbDiceCampus(maxTier);
    const c = fb.newCampus;
    Object.assign(c, { rungType: d.rungType, rungSides: 'same', reps: d.reps, workSec: d.workSec, restSec: d.restSec, blockRestSec: d.blockRestSec });
    campusSetStops(c, d.stops);
    fb.addType = 'campus';
  } else {
    const b = fbDiceHang(fb.board, maxTier, fb.selectedGrip);
    fb.addType = 'hang';
    fb.gripMode = 'same';
    fb.selectedGrip = b.grip;
    Object.assign(fb.newHang, { reps: b.reps, hangSec: b.hangSec, restSec: b.restSec, blockRestSec: b.blockRestSec });
  }
  document.querySelectorAll('[data-add-type]').forEach((x) => x.classList.toggle('active', x.dataset.addType === fb.addType));
  const wf = document.getElementById('fb-weight-field');
  if (wf) wf.hidden = false;
  renderFbAddPanel();
}
function openFbDiceSheet() {
  let el = document.getElementById('fb-dice-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fb-dice-sheet';
    el.className = 'info-sheet-backdrop';
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    wireSheetSwipeDown(el, () => el.remove());
  }
  const d = fbDice;
  const chip = (attr, val, cur, label) => `<button type="button" class="chip ${val === cur ? 'active' : ''}" data-${attr}="${val}">${label}</button>`;
  const totalSec = d.preview ? d.preview.reduce((sum, b) => sum + fbBlockSeconds(b), 0) : 0;
  el.innerHTML = `
    <div class="info-sheet-card fb-dice-card">
      <div class="fs-rest-grip" aria-hidden="true"></div>
      <h3 class="fb-dice-title">${ICON_DIE} Würfeln</h3>
      <div class="chip-row">${chip('dice-what', 'set', d.what, 'Ein Satz')}${chip('dice-what', 'ablauf', d.what, 'Ganzer Ablauf')}</div>
      <label class="fs-rest-label fb-dice-label">Art</label>
      <div class="chip-row">${chip('dice-kind', 'hang', d.kind, 'Board')}${chip('dice-kind', 'campus', d.kind, 'Campus')}${d.what === 'ablauf' ? chip('dice-kind', 'mix', d.kind, 'Mix') : ''}</div>
      ${d.what === 'ablauf' ? `<label class="fs-rest-label fb-dice-label">Länge</label>
      <div class="chip-row">${chip('dice-len', '15', String(d.len), '~15 min')}${chip('dice-len', '30', String(d.len), '~30 min')}</div>` : ''}
      ${d.what === 'ablauf' && d.preview ? `
        <div class="fb-dice-preview">
          <span class="fs-rest-label">${d.preview.length} Sätze · ~${fmtMinSec(totalSec)}</span>
          <ol>${d.preview.map((b) => `<li>${fbBlockTitle(b)} <small>${b.type === 'campus' ? `${b.reps}×` : `${b.reps}× ${b.hangSec}s`}</small></li>`).join('')}</ol>
          ${fb.blocks.length ? '<p class="login-hint">Übernehmen ersetzt den aktuellen Ablauf.</p>' : ''}
        </div>
        <div class="fb-dice-actions">
          <button type="button" class="btn" id="fb-dice-take">Übernehmen</button>
          <button type="button" class="btn ghost" id="fb-dice-roll">Nochmal</button>
        </div>` : `<button type="button" class="btn fb-dice-go" id="fb-dice-roll">Würfeln</button>`}
      ${d.what === 'set' ? '<p class="login-hint">Der Satz landet im Formular — dort wie gewohnt hinzufügen.</p>' : ''}
    </div>`;
  el.querySelectorAll('[data-dice-what]').forEach((b) => { b.onclick = () => { d.what = b.dataset.diceWhat; if (d.what === 'set' && d.kind === 'mix') d.kind = 'hang'; d.preview = null; openFbDiceSheet(); }; });
  el.querySelectorAll('[data-dice-kind]').forEach((b) => { b.onclick = () => { d.kind = b.dataset.diceKind; d.preview = null; openFbDiceSheet(); }; });
  el.querySelectorAll('[data-dice-len]').forEach((b) => { b.onclick = () => { d.len = Number(b.dataset.diceLen); d.preview = null; openFbDiceSheet(); }; });
  el.querySelector('#fb-dice-roll').onclick = () => {
    if (d.what === 'set') {
      el.remove();
      fbDiceSet();
      document.getElementById('fb-add-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    d.preview = fbDiceAblauf(d.kind, d.len);
    openFbDiceSheet();
  };
  const take = el.querySelector('#fb-dice-take');
  if (take) take.onclick = () => {
    fb.blocks = d.preview;
    d.preview = null;
    const picker = document.getElementById('fb-template-picker');
    if (picker) picker.value = '';
    el.remove();
    renderFbBlocksList();
    document.getElementById('fb-blocks-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Gewürfelter Ablauf übernommen', 'ok');
  };
}

/* Mitspieler fürs Würfelduell: alle Crew-Mitglieder mit Konto (ohne mich),
   je Person einmal, aktive Crew zuerst. */
function duelCrewMates() {
  const out = [];
  const crewIds = Object.keys(state.crews || {}).sort((a, b) => (a === state.crewId ? -1 : b === state.crewId ? 1 : 0));
  crewIds.forEach((crewId) => Object.entries((state.crews[crewId] || {}).members || {}).forEach(([mid, m]) => {
    if (!state.member || mid === state.member.id || out.some((x) => x.mid === mid) || !m || !m.name) return;
    out.push({ mid, crewId, name: m.name });
  }));
  return out;
}
/* Würfelduell-Ergebnisse, die jemand aus der Crew für mich gespeichert hat
   (crewData/<crew>/duelInbox/<ich>), in den eigenen Verlauf übernehmen und
   aus dem Briefkasten löschen. Nur frisch vom Server (kein Doppel-Import aus
   dem Offline-Cache). */
async function importDuelInbox() {
  if (!state.member) return;
  let n = 0, from = '';
  for (const crewId of Object.keys(state.crews || {})) {
    const r = await fbGetNow(`crewData/${crewId}/duelInbox/${state.member.id}`);
    if (!r.ok || !r.value) continue;
    for (const [key, item] of Object.entries(r.value)) {
      const sn = item && item.session;
      const ok = sn && Array.isArray(sn.blocks) && sn.blocks.length && sn.blocks.every((b) => b && b.type === 'hang' && BOARDS[b.board] && Number(b.hangSec) > 0);
      if (ok) {
        const clean = {
          date: String(sn.date || todayKey()).slice(0, 10), board: BOARDS[sn.board] ? sn.board : sn.blocks[0].board, weight: 0, templateId: 'duel',
          blocks: sn.blocks.map((b) => ({ type: 'hang', board: b.board, grip: String(b.grip), reps: 1, hangSec: Math.min(120, Number(b.hangSec)), restSec: 0, blockRestSec: 0 })),
          results: sn.blocks.map(() => ({ type: 'hang', doneReps: [true] })),
          createdAt: Number(sn.createdAt) || Date.now(),
        };
        // Feste ID statt Push: wird der Briefkasten doppelt gelesen (Löschen noch nicht hochgeladen), entsteht kein Duplikat
        await fbPut(`fingerboardSessions/${state.member.id}/duel_${key}`, clean);
        n++; from = String(item.fromName || '').slice(0, 24);
      }
      await fbDelete(`crewData/${crewId}/duelInbox/${state.member.id}/${key}`);
    }
  }
  if (n) {
    toast(n === 1 ? `Würfelduell${from ? ' mit ' + from : ''} übernommen` : `${n} Würfelduelle übernommen`, 'ok');
    if (document.getElementById('fb-history-list')) renderFbHistory();
    if (state.route === 'progress') renderProgress();
  }
}

/* ---------- Würfelduell (zu zweit, ein Handy) ----------
   Vollbild über der App, aus beta/entwurf-wuerfelspiel.html übernommen.
   Ablauf je Runde: gemeinsamen Griff würfeln (wird jede Runde kleiner,
   keine Monos/einarmigen Griffe), dann würfelt jeder dem anderen die
   Hängezeit. Kein Sieger — gezählt wird die gehaltene Zeit ("wer länger
   hängt, hat Kraft gewonnen"). Zwischen den eigenen Hangs mindestens 90 s
   Pause. Die eigenen Hangs (Spieler 1 = angemeldete Person) landen als
   Board-Einheit (templateId 'duel') im Verlauf und im Fortschritt. */
function openDuel() {
  if (document.getElementById('duel')) return;
  const root = document.createElement('div');
  root.id = 'duel';
  root.innerHTML = '<div class="screen"></div>';
  document.body.appendChild(root);
  const app = root.firstChild;

/* Schwierigkeit je Griff: 0 = Aufwärmen, 3 = klein. Monos und einarmige Griffe fehlen bewusst. */
const TIER = {
  jug: 0, edge_large: 0, sloper_easy: 0,
  edge_medium: 1, sloper_medium: 1, pocket3: 1, pocket3_deep: 1, pocket2_deep: 1, edge3: 1,
  edge_small: 2, pocket3_small: 2, pocket2: 2, pocket2_offset: 2, sloper_hard: 2,
  edge_xsmall: 3, pocket2_small: 3,
};
const REST_SEC = 90;
const g = {
  names: ['Anna', 'Ben'], board: 'bm2000', rounds: 5, min: 6, max: 12,
  round: 0, turn: 0, grip: null, rolled: null, score: [0, 0], held: [0, 0],
  lastHangEnd: [0, 0], log: [], screen: 'setup', speed: 1,
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* egal */ } };
const now = () => Date.now();
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
let timer = null;
const stop = () => { clearInterval(timer); timer = null; };

function armNote(board, id) {
  const ov = (typeof GRIP_ARM_OVERRIDE !== 'undefined' && GRIP_ARM_OVERRIDE[board]) || {};
  return ov[id] || '';
}
function maxTier() { // Runde 1–2 nur grosse Griffe, dann immer kleiner
  const r = g.round + 1;
  return r <= 2 ? 1 : Math.min(3, 1 + Math.ceil((r - 2) / Math.max(1, (g.rounds - 2) / 2)));
}
function rollGrip() {
  const mt = maxTier();
  const pool = BOARDS[g.board].grips.filter((x) => TIER[x.id] != null && TIER[x.id] <= mt && armNote(g.board, x.id) !== 'einarmig' && (!g.grip || x.id !== g.grip.id));
  // In späteren Runden die schwerste erlaubte Stufe bevorzugen
  const weighted = pool.flatMap((x) => Array(g.round < 2 ? 1 : TIER[x.id] + 1).fill(x));
  return weighted[Math.floor(Math.random() * weighted.length)];
}
function gripHtml(grip) {
  const b = BOARDS[g.board];
  const dots = b.hotspots.filter((h) => h.grip === grip.id).map((h) => `<span class="dot" style="left:${h.hx ?? h.x}%;top:${h.hy ?? h.y}%"></span>`).join('');
  const t = TIER[grip.id];
  return `
    <div class="board"><div class="board-in"><img src="${b.image}" alt="${esc(b.label)}">${dots}</div></div>
    <div class="grip-name"><b>${esc(grip.label)}</b><span>${esc(grip.note || ' ')}</span>
      <div class="tier" aria-label="Schwierigkeit ${t + 1} von 4">${[0, 1, 2, 3].map((i) => `<i class="${i <= t ? 'on' : ''}"></i>`).join('')}</div></div>`;
}
function topBar(showRound = true) {
  return `
    <div class="top">
      <button class="icon-btn" id="quit" aria-label="Beenden">✕</button>
      <div class="score">
        <span class="p"><i style="background:var(--pa)"></i>${esc(g.names[0])}</span>
        <span class="pts">${g.held[0]} s</span><span class="colon">·</span><span class="pts">${g.held[1]} s</span>
        <span class="p">${esc(g.names[1])}<i style="background:var(--pb)"></i></span>
      </div>
      <span style="width:40px;flex:none"></span>
    </div>
    ${showRound ? `<div class="round">Runde ${g.round + 1} von ${g.rounds}</div>` : ''}`;
}
const tag = (i) => `<span class="tag" style="background:var(--p${i ? 'b' : 'a'})">${esc(g.names[i])}</span>`;
function wireTop() {
  const q = document.getElementById('quit');
  if (q) q.onclick = () => { if (g.screen === 'setup' || g.screen === 'end' || confirm('Würfelduell beenden?')) close(); };
  const s = document.getElementById('speed');
  if (s) s.onclick = () => { g.speed = g.speed > 1 ? 1 : 5; s.classList.toggle('on', g.speed > 1); };
}

/* Würfel: kurz durchrollen, dann stehen bleiben */
function rollDie(el, values, final, done) {
  el.classList.add('rolling');
  let n = 0;
  const id = setInterval(() => {
    el.firstChild.textContent = values[Math.floor(Math.random() * values.length)];
    if (++n > 10) {
      clearInterval(id);
      el.classList.remove('rolling');
      el.firstChild.textContent = final;
      el.classList.add('done');
      buzz(60);
      done();
    }
  }, 80);
}

function render() {
  stop();
  ({ setup, grip, rollTime, ready, countdown, hang, result, end }[g.screen])();
  wireTop();
}

function setup() {
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="quit" aria-label="Schliessen">✕</button></div>
    <h1>${ICON_DICE2} Würfelduell</h1>
    <p class="intro">Zu zweit am Board, ein Handy. Ihr würfelt den Griff gemeinsam und dem anderen die Hängezeit.</p>
    <div class="field"><label>Du</label><div class="names one"><input id="n0" value="${esc(g.names[0])}" maxlength="12"></div></div>
    <div class="field"><label>Mitspieler</label>
      ${duelCrewMates().length ? `<div class="chips" style="margin-bottom:8px">${duelCrewMates().map((m) => `<button class="chip ${g.partner && g.partner.mid === m.mid ? 'on' : ''}" data-mate="${esc(m.mid)}">${esc(m.name)}</button>`).join('')}<button class="chip ${g.partner ? '' : 'on'}" data-mate="">Gast</button></div>` : ''}
      ${g.partner ? '' : `<div class="names one"><input id="n1" class="mate" value="${esc(g.names[1])}" maxlength="12" placeholder="Name"></div>`}
    </div>
    <div class="field"><label>Board</label><div class="chips">${['bm1000', 'bm2000'].map((b) => `<button class="chip ${g.board === b ? 'on' : ''}" data-board="${b}">${b === 'bm1000' ? 'BM 1000' : 'BM 2000'}</button>`).join('')}</div></div>
    <div class="field"><label>Runden</label><div class="chips">${[3, 5, 8].map((r) => `<button class="chip ${g.rounds === r ? 'on' : ''}" data-rounds="${r}">${r}</button>`).join('')}</div></div>
    <div class="field"><label>Hängezeit</label><div class="chips">${[[5, 10], [6, 12], [8, 15]].map(([a, b]) => `<button class="chip ${g.min === a ? 'on' : ''}" data-range="${a}-${b}">${a}–${b} s</button>`).join('')}</div></div>
    <ul class="rules">
      <li>Am Anfang grosse Griffe, jede Runde wird es kleiner.</li>
      <li>Jede gehaltene Sekunde zählt. Deine Hängezeit landet im Fortschritt${g.partner ? `, die von ${esc(g.partner.name)} in ${esc(g.partner.name)}s Fortschritt` : ''}.</li>
      <li>Zwischen deinen Hangs mindestens ${REST_SEC} s Pause.</li>
    </ul>
    <div class="actions"><button class="btn" id="go">Los geht's</button></div>`;
  app.querySelectorAll('[data-board]').forEach((b) => { b.onclick = () => { g.board = b.dataset.board; setup(); }; });
  app.querySelectorAll('[data-rounds]').forEach((b) => { b.onclick = () => { g.rounds = Number(b.dataset.rounds); setup(); }; });
  app.querySelectorAll('[data-range]').forEach((b) => { b.onclick = () => { [g.min, g.max] = b.dataset.range.split('-').map(Number); setup(); }; });
  ['n0', 'n1'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.oninput = (e) => { g.names[i] = e.target.value.trim() || (i ? 'B' : 'A'); }; });
  app.querySelectorAll('[data-mate]').forEach((b) => {
    b.onclick = () => {
      const m = duelCrewMates().find((x) => x.mid === b.dataset.mate);
      g.partner = m || null;
      g.names[1] = m ? m.name : 'Gast';
      setup();
    };
  });
  document.getElementById('go').onclick = () => {
    Object.assign(g, { round: 0, turn: 0, grip: null, score: [0, 0], held: [0, 0], lastHangEnd: [0, 0], log: [] });
    g.screen = 'grip'; render();
  };
}

function grip() {
  const pick = rollGrip();
  app.innerHTML = `${topBar()}
    <div class="main">
      <p class="who">Gemeinsamer Griff für diese Runde</p>
      <div id="grip-box" style="opacity:.25">${gripHtml(pick)}</div>
    </div>
    <div class="actions" id="act"><button class="btn" id="roll">Griff würfeln</button></div>`;
  document.getElementById('roll').onclick = () => {
    const box = document.getElementById('grip-box');
    const grips = BOARDS[g.board].grips.filter((x) => TIER[x.id] != null);
    let n = 0;
    document.getElementById('act').innerHTML = '';
    const id = setInterval(() => {
      box.innerHTML = gripHtml(grips[Math.floor(Math.random() * grips.length)]);
      if (++n > 9) {
        clearInterval(id);
        g.grip = pick;
        box.innerHTML = gripHtml(pick);
        box.style.opacity = 1;
        buzz(80);
        document.getElementById('act').innerHTML = `<button class="btn" id="next">Weiter: ${esc(g.names[1 - g.turn])} würfelt</button>`;
        document.getElementById('next').onclick = () => { g.screen = 'rollTime'; render(); };
      }
    }, 90);
  };
}

function rollTime() {
  const hanger = g.turn, roller = 1 - g.turn;
  const values = []; for (let s = g.min; s <= g.max; s++) values.push(s);
  app.innerHTML = `${topBar()}
    <div class="main">
      <p class="who">${tag(roller)} würfelt für ${tag(hanger)}</p>
      <div class="die" id="die"><span>?</span><small>Sek.</small></div>
      <p class="who" style="font-size:15px">${esc(g.grip.label)}</p>
    </div>
    <div class="actions" id="act"><button class="btn" id="roll">Zeit würfeln</button></div>`;
  document.getElementById('roll').onclick = () => {
    document.getElementById('act').innerHTML = '';
    g.rolled = values[Math.floor(Math.random() * values.length)];
    rollDie(document.getElementById('die'), values, g.rolled, () => {
      document.getElementById('act').innerHTML = `<button class="btn" id="next">Handy an ${esc(g.names[hanger])} →</button>`;
      document.getElementById('next').onclick = () => { g.screen = 'ready'; render(); };
    });
  };
}

function restLeft(i) {
  if (!g.lastHangEnd[i]) return 0;
  return Math.max(0, Math.ceil(REST_SEC - ((now() - g.lastHangEnd[i]) / 1000) * g.speed));
}
function ready() {
  const i = g.turn;
  const draw = () => {
    const left = restLeft(i);
    app.innerHTML = `${topBar()}
      <div class="main">
        <p class="who">${tag(i)} hängt <b>${g.rolled} s</b></p>
        ${gripHtml(g.grip)}
        ${left ? `<div class="rest"><b>${fmt(left)}</b><span>Pause für ${esc(g.names[i])}</span></div>` : ''}
      </div>
      <div class="actions">
        ${left ? '<button class="link" id="skip">Jetzt schon hängen</button>' : '<button class="btn" id="start">▶ Start</button>'}
      </div>`;
    wireTop();
    const st = document.getElementById('start');
    if (st) st.onclick = () => { g.screen = 'countdown'; render(); };
    const sk = document.getElementById('skip');
    if (sk) sk.onclick = () => { g.lastHangEnd[i] = 0; draw(); };
    return left;
  };
  if (draw()) timer = setInterval(() => { if (!draw()) { stop(); buzz([100, 60, 100]); } }, 1000);
}

function countdown() {
  let n = 3;
  app.innerHTML = `${topBar()}<div class="main"><p class="who">Hände an den Griff</p><div class="count cond" id="cnt">3</div></div>`;
  buzz(60); beepTick();
  timer = setInterval(() => {
    n--;
    if (n <= 0) { beepStart(); g.screen = 'hang'; render(); return; }
    document.getElementById('cnt').textContent = n;
    buzz(60); beepTick();
  }, 1000 / Math.min(g.speed, 2));
}

function hang() {
  const i = g.turn, target = g.rolled, L = 2 * Math.PI * 104;
  const started = now();
  app.innerHTML = `${topBar()}
    <div class="main">
      <p class="who">${tag(i)} · ${esc(g.grip.label)}</p>
      <div class="timer"><svg viewBox="0 0 240 240"><circle class="track" cx="120" cy="120" r="104"/><circle class="ring" id="ring" cx="120" cy="120" r="104" stroke-dasharray="${L}" stroke-dashoffset="0"/></svg>
        <div class="num"><span id="num">${target}</span><small>hängen</small></div></div>
    </div>
    <div class="actions"><button class="btn release" id="rel">Losgelassen</button></div>`;
  const finish = (heldSec, ok) => {
    stop();
    g.lastHangEnd[i] = now();
    g.held[i] += heldSec;
    if (ok) g.score[i]++;
    g.log.push({ round: g.round, who: i, grip: g.grip.label, gripId: g.grip.id, target, held: heldSec, ok });
    buzz(ok ? [80, 60, 200] : 300);
    g.screen = 'result'; render();
  };
  timer = setInterval(() => {
    const el = ((now() - started) / 1000) * g.speed;
    const left = Math.max(0, target - el);
    document.getElementById('num').textContent = Math.ceil(left);
    document.getElementById('ring').style.strokeDashoffset = String(L * (el / target));
    if (left <= 0) finish(target, true);
  }, 100);
  document.getElementById('rel').onclick = () => {
    const el = Math.min(target, Math.floor(((now() - started) / 1000) * g.speed));
    finish(el, el >= target);
  };
}

function result() {
  const last = g.log[g.log.length - 1];
  const bothDone = g.log.filter((l) => l.round === g.round).length === 2;
  const lastRound = g.round + 1 >= g.rounds;
  app.innerHTML = `${topBar()}
    <div class="main">
      <div class="result ${last.ok ? 'ok' : 'fail'}">
        <b>${last.ok ? `Gehalten! ${last.held} s` : 'Losgelassen'}</b>
        <span>${esc(g.names[last.who])}: ${last.held} von ${last.target} s</span>
      </div>
    </div>
    <div class="actions"><button class="btn" id="next">${!bothDone ? `Jetzt ${esc(g.names[1 - last.who])}` : lastRound ? 'Zum Ergebnis' : 'Nächste Runde'}</button></div>`;
  document.getElementById('next').onclick = () => {
    if (!bothDone) { g.turn = 1 - g.turn; g.screen = 'rollTime'; }
    else if (lastRound) g.screen = 'end';
    else { g.round++; g.turn = g.round % 2; g.screen = 'grip'; } // abwechselnd beginnen
    render();
  };
}

function end() {
  saveDuel();
  const rows = [];
  for (let r = 0; r < g.rounds; r++) {
    const l = g.log.filter((x) => x.round === r);
    if (!l.length) continue;
    const cell = (i) => { const x = l.find((y) => y.who === i); return x ? `${x.ok ? '✓' : '✗'} ${x.held}/${x.target}s` : '–'; };
    rows.push(`<tr><td>${r + 1}</td><td>${esc(l[0].grip)}</td><td class="c">${cell(0)}</td><td class="c">${cell(1)}</td></tr>`);
  }
  app.innerHTML = `${topBar(false)}
    <div class="main">
      <div class="winner"><span>💪 Gewonnen haben beide: Kraft</span>
        <div class="duel-totals">${[0, 1].map((i) => `<div><b style="color:var(--p${i ? 'b' : 'a'})">${g.held[i]} s</b><span>${esc(g.names[i])}</span></div>`).join('')}</div>
        <p class="who" style="font-size:14px;margin-top:6px">${g.saved ? `Hängezeit im Fortschritt gespeichert${g.partner ? ` – auch bei ${esc(g.partner.name)}` : ''}.` : ''}</p></div>
      <table><thead><tr><th>#</th><th>Griff</th><th class="c">${esc(g.names[0])}</th><th class="c">${esc(g.names[1])}</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    </div>
    <div class="actions"><button class="btn" id="again">Revanche</button><button class="btn ghost" id="setup">Einstellungen</button></div>`;
  document.getElementById('again').onclick = () => { Object.assign(g, { round: 0, turn: 0, grip: null, score: [0, 0], held: [0, 0], lastHangEnd: [0, 0], log: [], saved: false }); g.screen = 'grip'; render(); };
  document.getElementById('setup').onclick = () => { g.screen = 'setup'; render(); };
}


  /* Eigene Hangs (Spieler 1) als Board-Einheit speichern — einmal pro Spiel,
     auch beim vorzeitigen Schliessen; gehaltene Sekunden = Hängezeit. */
  function saveDuel() {
    if (g.saved || !state.member) return;
    const sessionOf = (who) => {
      const hangs = g.log.filter((l) => l.who === who && l.held > 0);
      return hangs.length ? {
        date: todayKey(), board: g.board, weight: 0, templateId: 'duel',
        blocks: hangs.map((l) => ({ type: 'hang', board: g.board, grip: l.gripId, reps: 1, hangSec: l.held, restSec: 0, blockRestSec: 0 })),
        results: hangs.map(() => ({ type: 'hang', doneReps: [true] })),
        createdAt: Date.now(),
      } : null;
    };
    const own = sessionOf(0), mate = g.partner ? sessionOf(1) : null;
    if (!own && !mate) return;
    g.saved = true;
    if (own) fbPush(`fingerboardSessions/${state.member.id}`, own).then(() => { if (document.getElementById('fb-history-list')) renderFbHistory(); });
    // Mitspieler aus der Crew: über den Crew-Briefkasten, die App der anderen Person übernimmt es (importDuelInbox)
    if (mate) fbPush(`crewData/${g.partner.crewId}/duelInbox/${g.partner.mid}`, { fromId: state.member.id, fromName: g.names[0], session: mate });
  }
  g.names = [(state.member && state.member.name) || 'Ich', 'Gast'];
  g.partner = null;
  g.board = fb.board || currentMemberBoard();
  const onPop = () => { stop(); root.remove(); releaseWakeLock(); window.removeEventListener('popstate', onPop); };
  const close = () => { saveDuel(); onPop(); if (history.state && history.state.duel) history.back(); };
  history.pushState({ duel: true }, '');
  window.addEventListener('popstate', onPop);
  requestWakeLock();
  render();
}

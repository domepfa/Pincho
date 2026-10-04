/* js/ausdauer.js — Gym-Tab, Modus Ausdauer: freie Stoppuhr und geplanter Wand-/Pause-Ablauf (eigener Vollbild-Timer) */
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
      <div class="fb-stage-figure" id="wall-figure">${working ? wallFigureSvg() : fbRestFigureSvg()}</div>
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
      ${slothFigure('wave', 'fb-done-sloth')}
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

/* js/flow.js — Gym-Tab, Modus Flow (Yoga/Pilates): Posen-Raster, Builder, JSON-Import, eigener Vollbild-Timer */
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
  openExerciseInfoSheet(el);
  document.getElementById('info-sheet-close').onclick = () => closeExerciseInfoSheet();
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
    <button type="button" class="btn" id="flow-new" style="width:100%;margin-bottom:12px;">＋ Neuer Flow</button>
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
        <a href="${ASSET_BASE}ki-anleitung-flow-json.md" download class="btn ghost small" style="flex:1;text-decoration:none;box-sizing:border-box;">📄 Herunterladen</a>
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
      const res = await fetch(ASSET_BASE + 'ki-anleitung-flow-json.md');
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
      <div class="fb-stage-figure" id="flow-figure">${working ? '<div class="ex-figure-emoji">🧘</div>' : fbRestFigureSvg()}</div>
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
  if (figureHolder) figureHolder.innerHTML = working ? '<div class="ex-figure-emoji">🧘</div>' : fbRestFigureSvg();
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
      ${slothFigure('wave', 'fb-done-sloth')}
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

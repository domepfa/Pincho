/* js/fingerboard.js — Board-Tab: Zustand fb, Schnelltraining, JSON-Import, Board-Bild/Griffe, Griff-Editoren, renderFingerboard, Verlauf, Vorlagen, Phasenliste */
/* ================================================================
   FINGERBOARD
   ================================================================= */
let fbQuickstartOpen = false; // Schnelltraining-Karten sind standardmässig eingeklappt
/* Schnelltraining: 'own' = eigene Vorlagen, 'crew' = von anderen geteilte.
   Tab-Wahl pro Gerät gemerkt; Ersteller-Filter/"Ausgeblendete zeigen" nur
   für die aktuelle Ansicht. */
let fbQsTab = (() => { try { return localStorage.getItem(STORAGE_PREFIX + 'fb_qs_tab') || 'pincho'; } catch (e) { return 'pincho'; } })();
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
  newHang: { reps: 3, hangSec: 7, restSec: 30, blockRestSec: 60 },
  newHangHand: { handMode: 'alternate', startHand: 'left' }, // nur bei Einarm-Griffen (siehe fbHangHandHtml)      // Werte fürs nächste Hinzufügen, direkt im Add-Panel editierbar
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
    armMode: 'both', startHand: 'left', // armMode: 'both' | 'match' | 'skip' | 'free' — 'match'/'skip' zeigen zusätzlich startHand
    skipEnd: 'one', // nur 'skip': am Ende einhändig ('one') oder die andere Hand nachziehen ('match')
    hands: [], // nur 'free' ("Hand für Hand"): Hand ('l'/'r') je Zug, parallel zu pattern
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
  const handHolder = document.getElementById('fb-hang-hand');
  if (handHolder) { handHolder.innerHTML = fbHangHandHtml(); wireFbHangHand(); }
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

async function renderFingerboard() {
  if (!fb.board) fb.board = currentMemberBoard();

  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Fingerboard</h2><div class="sec-rule"></div></div>
    <div id="fb-start-card-holder">${fbStartCardHtml()}</div>

    <div class="sec-head" id="fb-quickstart-toggle" style="cursor:pointer;">
      <h2 class="sec-title" style="font-size:18px;">Schnelltraining</h2><div class="sec-rule"></div>
      <span class="sec-chevron" id="fb-quickstart-chevron">${fbQuickstartOpen ? '▾' : '▸'}</span>
    </div>
    <div class="quickstart-grid" id="fb-quickstart" ${fbQuickstartOpen ? '' : 'hidden'}></div>

    <div class="sec-head"><h2 class="sec-title" style="font-size:18px;">Eigenen Ablauf bauen</h2><div class="sec-rule"></div></div>

    <button type="button" class="btn" id="fb-new-ablauf" style="width:100%;margin-bottom:12px;">＋ Neuer Ablauf</button>

    <div class="chip-row fb-addtype-row">
      <button class="chip ${fb.addType === 'hang' ? 'active' : ''}" data-add-type="hang">Board</button>
      <button class="chip ${fb.addType === 'block' ? 'active' : ''}" data-add-type="block">Lifting Pin</button>
      <button class="chip ${fb.addType === 'exercise' ? 'active' : ''}" data-add-type="exercise">Fixübung</button>
      <button class="chip ${fb.addType === 'campus' ? 'active' : ''}" data-add-type="campus">Campus</button>
      <button class="chip ${fb.addType === 'pause' ? 'active' : ''}" data-add-type="pause">Pause</button>
    </div>
    <div id="fb-add-panel" style="margin:12px 0 16px;"></div>

    <div class="field" id="fb-weight-field" ${fb.addType === 'block' ? 'hidden' : ''}><label>Zusatzgewicht für diese Session (negativ = Assistenz)</label><div class="kg-field"><input type="number" inputmode="decimal" id="fb-weight" value="${fb.weight}" step="0.5"><span class="mono">kg</span></div></div>

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
        <a href="${ASSET_BASE}ki-anleitung-json.md" download class="btn ghost small" style="flex:1;text-decoration:none;box-sizing:border-box;">📄 Herunterladen</a>
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

    <div class="sec-head"><h2 class="sec-title" style="font-size:18px;">Für Abwechslung</h2><div class="sec-rule"></div></div>
    <div class="fb-fun">
      <button type="button" class="fb-fun-row" id="fb-dice-open">${ICON_DIE}<span>Ablauf würfeln<small>Satz oder ganzer Ablauf, Board / Campus</small></span><i aria-hidden="true">›</i></button>
      <button type="button" class="fb-fun-row" id="fb-duel-open">${ICON_DICE2}<span>Würfelduell<small>zu zweit, ein Handy</small></span><i aria-hidden="true">›</i></button>
    </div>

    <div class="sec-head"><h2 class="sec-title">Verlauf</h2><div class="sec-rule"></div></div>
    <div class="list" id="fb-history-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  renderFbAddPanel();
  renderFbBlocksList(); // rendert am Ende auch renderFbRuntime() mit
  renderFbQuickstart();
  renderFbHistory();

  const startGo = document.querySelector('#fb-start-card-holder .fb-start-go');
  if (startGo) startGo.onclick = () => fbStartTemplate(startGo.dataset.tpl);
  document.getElementById('fb-quickstart-toggle').onclick = () => {
    fbQuickstartOpen = !fbQuickstartOpen;
    document.getElementById('fb-quickstart').hidden = !fbQuickstartOpen;
    document.getElementById('fb-quickstart-chevron').textContent = fbQuickstartOpen ? '▾' : '▸';
  };

  document.querySelectorAll('[data-add-type]').forEach((btn) => {
    btn.onclick = () => {
      fb.addType = btn.dataset.addType;
      document.querySelectorAll('[data-add-type]').forEach((b) => b.classList.toggle('active', b.dataset.addType === fb.addType));
      // Beim Lifting Pin hängt das Gewicht direkt am Pin — ein Zusatzgewicht
      // am Körper gibt es dort nicht.
      document.getElementById('fb-weight-field').hidden = fb.addType === 'block';
      renderFbAddPanel();
    };
  });
  document.getElementById('fb-weight').oninput = (e) => { fb.weight = e.target.value; };
  document.getElementById('fb-dice-open').onclick = openFbDiceSheet;
  document.getElementById('fb-duel-open').onclick = openDuel;
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
      const res = await fetch(ASSET_BASE + 'ki-anleitung-json.md');
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
let fbSessionsCache = []; // neueste zuerst, für Steigerungsvorschlag und Max-Hang-Test
async function renderFbHistory() {
  const raw = await fbGet(`fingerboardSessions/${state.member.id}`);
  fbSessionsCache = Object.values(raw || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  fbRefreshStartCard();
  const entries = Object.entries(raw || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const list = document.getElementById('fb-history-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, s]) => `
    <div class="log-item">
      <div class="top"><span>${esc(fmtDayKey(s.date))}</span><span class="type">${s.templateId === 'duel' ? 'Würfelduell · ' : ''}${esc((BOARDS[s.board] && BOARDS[s.board].label) || s.board)}${s.partial ? ' · UNVOLLSTÄNDIG' : ''}</span></div>
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
  return fb.templates.find((r) => r.id === id) || sharedTemplatesOfKind('fingerboard').find((r) => r.id === id)
    || PINCHO_PROGRAMS.find((r) => r.id === id);
}
/* Zuletzt per Schnelltraining gestartete Vorlage bzw. Programm (für die Startkarte oben) */
function fbLastTemplate() {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'fb_last_tpl') || 'null'); return v && findFbTemplateById(v.id) ? v : null; } catch (e) { return null; }
}
function fbRememberTemplate(id) {
  try { localStorage.setItem(STORAGE_PREFIX + 'fb_last_tpl', JSON.stringify({ id, at: Date.now() })); } catch (e) { /* ignorieren */ }
}
/* Startkarte: grosser "Weiter mit"-Knopf ganz oben; neue Nutzer bekommen das Einsteiger-Programm vorgeschlagen */
function fbStartCardHtml() {
  const last = fbLastTemplate();
  const t = last ? findFbTemplateById(last.id) : PINCHO_PROGRAMS.find((p) => p.id === 'pp_beginner');
  if (!t) return '';
  const totalSec = t.blocks.reduce((sum, b) => sum + fbBlockSeconds(b), 0);
  const when = last ? `zuletzt ${fmtDateShort(new Date(last.at))}` : 'Dein erstes Training';
  return `
    <div class="fb-start-card">
      <div class="fb-start-text">
        <span class="fb-start-eyebrow">${last ? 'Weiter mit' : 'Vorschlag'}</span>
        <b>${esc(t.name)}</b>
        <span class="fb-start-meta">${when} · ${t.blocks.length} Sätze · ~${fmtMinSec(totalSec)}</span>
        ${(() => { const sug = fbWeightSuggestion(t.id); return sug ? `<span class="fb-start-sug">${esc(sug.why)}</span>` : ''; })()}
      </div>
      <button type="button" class="btn qs-start fb-start-go" data-tpl="${t.id}" aria-label="${esc(t.name)} starten"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.9l10.2-6.5a1 1 0 000-1.8L9.5 4.6A1 1 0 008 5.5z"/></svg></button>
    </div>`;
}
function fmtDateShort(d) {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? 'heute' : days === 1 ? 'gestern' : days < 7 ? `vor ${days} Tagen` : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}
/* Anteil geschaffter Hänger einer Session (0..1), null ohne Hang-Sätze */
function fbHangSuccess(sn) {
  let done = 0, total = 0;
  (sn.blocks || []).forEach((b, i) => {
    if (b.type !== 'hang') return;
    const r = (sn.results || [])[i];
    const reps = r && r.doneReps ? r.doneReps : new Array(b.reps).fill(false);
    total += reps.length; done += reps.filter(Boolean).length;
  });
  return total ? done / total : null;
}
/* Bester Max-Hang-Test: höchstes Zusatzgewicht, bei dem mindestens ein Test-Hänger (10 s) geschafft wurde */
function fbMaxHangBest() {
  let best = null;
  fbSessionsCache.filter((sn) => sn.templateId === 'pp_maxtest').forEach((sn) => {
    const ok = (sn.blocks || []).some((b, i) => b.type === 'hang' && b.reps === 1 && b.hangSec >= 10 && ((sn.results || [])[i]?.doneReps || [])[0]);
    const w = Number(sn.weight) || 0;
    if (ok && (best == null || w > best.weight)) best = { weight: w, date: sn.date };
  });
  return best;
}
/* Zusatzgewicht-Vorschlag für eine Vorlage:
   Max Hangs aus dem Test (85 %), sonst Steigerung gegenüber dem letzten Mal mit derselben Vorlage */
function fbWeightSuggestion(id) {
  if (id === 'pp_maxhang') {
    const best = fbMaxHangBest();
    if (best) {
      // 85 % der Gesamtlast wäre ohne Körpergewicht nicht rechenbar; Faustregel: ~4 kg unter dem Testgewicht
      const w = Math.round((best.weight - 4) * 2) / 2;
      return { weight: w, why: `Max-Hang-Test ${fmtKg(best.weight)} → heute ${fmtKg(w)}` };
    }
  }
  const last = fbSessionsCache.find((sn) => sn.templateId === id && !sn.partial);
  if (!last || id === 'pp_maxtest' || id === 'pp_warmup') return null;
  const ok = fbHangSuccess(last);
  if (ok == null) return null;
  const w = Number(last.weight) || 0;
  if (ok >= 1) return { weight: w + 2, why: `Letztes Mal ${fmtKg(w)} alles geschafft → heute ${fmtKg(w + 2)}` };
  if (ok < 0.75) return { weight: w - 2, why: `Letztes Mal ${fmtKg(w)} nur ${Math.round(ok * 100)} % geschafft → heute ${fmtKg(w - 2)}` };
  return { weight: w, why: `Letztes Mal ${fmtKg(w)}, fast alles geschafft → gleich bleiben` };
}
function fmtKg(w) { return `${w > 0 ? '+' : ''}${String(w).replace('.', ',')} kg`; }
function fbRefreshStartCard() {
  const holder = document.getElementById('fb-start-card-holder');
  if (!holder) return;
  holder.innerHTML = fbStartCardHtml();
  const go = holder.querySelector('.fb-start-go');
  if (go) go.onclick = () => fbStartTemplate(go.dataset.tpl);
}

/* Ein Schnelltraining (Vorlage/Programm) laden und sofort starten */
function fbStartTemplate(id) {
  const t = findFbTemplateById(id);
  if (!t) return;
  if (fb.blocks.length && !confirm('Aktuellen Ablauf durch "' + t.name + '" ersetzen und sofort starten?')) return;
  fb.blocks = fbBlocksWithCurrentBoard(t.blocks);
  fbRememberTemplate(id);
  fb.pendingTemplateId = id;
  const sug = fbWeightSuggestion(id);
  if (sug) {
    fb.weight = sug.weight;
    const field = document.getElementById('fb-weight');
    if (field) field.value = sug.weight;
    toast(`Zusatzgewicht: ${sug.why}. Anpassbar unter „Zusatzgewicht“.`);
  }
  renderFbBlocksList();
  startAblauf(); // öffnet direkt das Ablauf-Vollbild
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
  const isPincho = fbQsTab === 'pincho';
  const crewAll = crewFbTemplates();
  const creators = [...new Map(crewAll.map((t) => [t.createdBy, t.createdByName])).entries()];
  if (fbQsCreator !== 'all' && !creators.some(([id]) => id === fbQsCreator)) fbQsCreator = 'all';
  const crewFiltered = crewAll.filter((t) => fbQsCreator === 'all' || t.createdBy === fbQsCreator);
  const hideable = isCrew ? crewFiltered : isPincho ? PINCHO_PROGRAMS : [];
  const hiddenCount = hideable.filter((t) => hiddenTemplates[t.id]).length;
  const list = isCrew || isPincho
    ? hideable.filter((t) => fbQsShowHidden || !hiddenTemplates[t.id])
    : ownFbEntries();

  const tabs = `
    <div class="chip-row" style="margin-bottom:8px;">
      <button type="button" class="chip ${isPincho ? 'active' : ''}" data-qs-tab="pincho">Programme</button>
      <button type="button" class="chip ${!isCrew && !isPincho ? 'active' : ''}" data-qs-tab="own">Eigene</button>
      <button type="button" class="chip ${isCrew ? 'active' : ''}" data-qs-tab="crew">Crew${crewAll.length ? ` (${crewAll.length})` : ''}</button>
    </div>`;
  const creatorFilter = isCrew && creators.length > 1 ? `
    <div class="chip-row qs-filter-row">
      <button type="button" class="chip small ${fbQsCreator === 'all' ? 'active' : ''}" data-qs-creator="all">Alle</button>
      ${creators.map(([id, name]) => `<button type="button" class="chip small ${fbQsCreator === id ? 'active' : ''}" data-qs-creator="${esc(id)}">${esc(name)}</button>`).join('')}
    </div>` : '';
  const hiddenToggle = (isCrew || isPincho) && (hiddenCount || fbQsShowHidden) ? `
    <button type="button" class="btn ghost small" id="qs-toggle-hidden" style="width:100%;margin-bottom:10px;">
      ${fbQsShowHidden ? 'Ausgeblendete verbergen' : `Ausgeblendete anzeigen (${hiddenCount})`}
    </button>` : '';
  const empty = isPincho ? 'Alle Programme ausgeblendet.' : isCrew
    ? (crewAll.length ? 'Alles ausgeblendet.' : 'Noch hat niemand aus der Crew eine Vorlage geteilt.')
    : 'Noch keine eigenen Vorlagen — unten einen Ablauf bauen und "Als Vorlage speichern".';

  holder.innerHTML = tabs + creatorFilter + hiddenToggle + (list.length ? list.map((t, i) => {
    const totalSec = t.blocks.reduce((total, b) => total + fbBlockSeconds(b), 0);
    const isHidden = (isCrew || isPincho) && !!hiddenTemplates[t.id];
    const badge = isPincho ? '' : isCrew
      ? `<span class="qs-badge">von ${esc(t.createdByName)}</span>`
      : (t.sharedCopy || t.sharedOnly) ? '<span class="qs-badge">geteilt</span>' : '';
    const actionBtn = isCrew || isPincho
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
      try { localStorage.setItem(STORAGE_PREFIX + 'fb_qs_tab', fbQsTab); } catch (e) { /* ignorieren */ }
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
    btn.onclick = () => fbStartTemplate(btn.dataset.tpl);
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

/* js/fb-runner.js — Board: laufender Ablauf – Vollbild, Transport, Bühne mit Faultier, Check-in, Timer-Engine, finishAblauf */
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
   durch (Animationen in css/, .sloth-*). */
const SLOTH_FACE = `
  <circle class="sloth-head" cx="100" cy="64" r="19"/>
  <path class="sloth-mask" d="M86 62 q6 -7 12 1 q-6 7 -12 -1z M114 62 q-6 -7 -12 1 q6 7 12 -1z"/>
  <path class="sloth-line" d="M97 71 h6 M94 76 q6 4 12 0"/>`;
// Faultier-Puppe (sloth-rig.js); jedes Mal neu, damit ein Wechsel der Figur im Konto sofort gilt
const fbHangFigureSvg = () => slothFigure('hang', 'ex-figure sloth-img');
const fbRestFigureSvg = () => slothFigure('rest', 'ex-figure sloth-img');
/* Lifting Pin: Faultier steht seitlich und hält den Griffblock mit dem Pin
   und der Scheibe darunter (statisch, siehe Pose 'pinlift' in sloth-rig.js).
   Die Figur schaut nach rechts, man sieht also ihre linke Seite — für die
   rechte Hand wird sie gespiegelt. */
function blockPinFigureSvg(hand) {
  const svg = slothFigure('pinlift', 'ex-figure sloth-img');
  return hand === 'right' ? svg.replace('<svg ', '<svg style="transform:scaleX(-1)" ') : svg;
}
/* Dispatcher fürs "Work"-Strichmännchen während des laufenden Timers:
   Hang bleibt die Hänge-Figur, Griffblock/Lifting Pin zeigt stattdessen
   das Zieh-Strichmännchen mit der gerade aktiven Hand (activeRep kommt
   aus dem rep-Feld des laufenden Sequenz-Schritts, siehe buildBlockSequence). */
function holdBlockWorkFigure(b, activeRep) {
  return b.type === 'block' ? blockPinFigureSvg(blockHandForRep(b, activeRep || 0)) : fbHangFigureSvg();
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
  const segs = document.getElementById('fbx-segs');
  if (!segs) return;
  const cur = fb.blocks[fb.blockIndex];
  let frac = 0;
  if (cur && fb.running && fb.sequence.length) {
    const done = fb.sequence.slice(0, fb.stepIndex).reduce((s, p) => s + p.seconds, 0);
    const curTotal = fb.sequence[fb.stepIndex] ? fb.sequence[fb.stepIndex].seconds : 0;
    frac = Math.min(1, (done + curTotal - fb.secondsLeft) / Math.max(fbBlockSeconds(cur), 1));
  }
  Array.from(segs.children).forEach((seg, i) => {
    const f = i < fb.blockIndex ? 1 : i > fb.blockIndex ? 0 : frac;
    seg.firstChild.style.transform = `scaleX(${f})`;
    seg.classList.toggle('current', i === fb.blockIndex);
  });
}

function updateFbUpcomingUI() {
  const el = document.getElementById('fb-upcoming');
  if (!el) return;
  // In der abschliessenden Pause steht dort schon die Vorschau des nächsten Blocks (renderFbOverlay).
  if (fbIsTrailingPause()) return;
  const text = 'Danach: ' + fbUpcomingLabel();
  if (el.textContent !== text) { el.textContent = text; fbFitLine(el); }
}

/* ---------- Transport-Leiste (Zurück / Play-Pause / Weiter) ----------
   Der Ablauf läuft nach dem Start von allein durch alle Sätze
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
/* Transport "Zurück" (⏮) sowie Wischen nach rechts: sollte wie "Weiter"
   nur EINEN Schritt zurückspulen, sprang bisher aber immer einen ganzen
   Satz zurück (fb.blockIndex - 1) — bei einem Block mit mehreren
   Wiederholungen/Pausen also weit über den eigentlich gewünschten
   vorherigen Schritt hinaus. Jetzt symmetrisch zu fbStepForward: gibt es
   innerhalb des laufenden Satzes noch einen vorherigen Schritt, geht's nur
   dorthin (mit dessen voller Dauer, genau wie beim Vorspulen); nur wenn
   man schon beim allerersten Schritt dieses Satzes ist, geht's zum
   vorherigen Satz. */
/* EIN Timer für den ganzen Ablauf: vor jedem neuen Intervall wird das alte
   gestoppt. Vorher setzten startSequence()/Vor-/Zurückspulen teils ein
   neues Intervall, ohne das alte zu beenden — nach mehrmaligem schnellem
   Vorspulen liefen dann mehrere Timer parallel und die Uhr raste. */
function fbSetTimer(fn) {
  clearInterval(fb.intervalId);
  fb.intervalId = fn ? setInterval(fn, 1000) : null;
}

/* Vor-/Zurückspulen vor dem eigentlichen Start: "Weiter" startet sofort
   (ohne Vorbereitungs-Countdown), statt in einer noch gar nicht
   aufgebauten Sequenz zu springen. true = erledigt. */
function fbSkipStartPhase() {
  if (fb.awaitingNext) { fb.awaitingNext = false; requestWakeLock(); startSequence(); return true; }
  if (fb.preCount != null) { finishPreCountdown(); return true; }
  return false;
}
/* War der Ablauf pausiert, bleibt er es auch nach dem Springen. */
function fbKeepPaused(wasPaused) {
  if (!wasPaused) return;
  fbSetTimer(null);
  fb.pausedAt = Date.now();
  renderFbOverlay();
}

function fbStepBack() {
  if (fb.awaitingNext || fb.preCount != null) return;
  const wasPaused = fb.running && !fb.intervalId;
  fbSetTimer(null);
  fbCheckinTyping = false; // Feld ist beim Block-/Schrittwechsel weg — sonst bliebe die Zeit angehalten
  if (fb.stepIndex > 0) {
    fb.stepIndex--;
    fb.secondsLeft = fb.sequence[fb.stepIndex].seconds;
    fb.stepStartedAt = Date.now();
    fbSetTimer(tickBlock);
    renderFbOverlay();
    fbKeepPaused(wasPaused);
    return;
  }
  if (fb.blockIndex === 0) {
    // Ganz am Anfang des Ablaufs — nichts mehr davor (Button ist in diesem
    // Zustand ohnehin disabled, Wischen kann aber trotzdem hier landen).
    fbSetTimer(tickBlock);
    renderFbOverlay();
    fbKeepPaused(wasPaused);
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
  fbSetTimer(tickBlock);
  renderFbOverlay();
  fbKeepPaused(wasPaused);
}

/* Transport "Weiter" (⏭) sowie Wischen nach links: laut Nutzer-Feedback
   soll das nur EINEN Schritt vorspulen (wie ein abgelaufener Timer),
   nicht den ganzen Satz überspringen — das sprang bisher direkt zum
   nächsten Block/zur nächsten Übung, "man fliegt immer direkt zur
   nächsten Übung". Jeder Schritt einzeln, wie tickBlock() es bei Ablauf
   der Zeit auch tut — siehe advanceToNextStep(). */
function fbStepForward() {
  if (fbSkipStartPhase()) return;
  const wasPaused = fb.running && !fb.intervalId;
  fbSetTimer(null);
  fbCheckinTyping = false; // Feld ist beim Blockwechsel weg — sonst bliebe die Zeit im neuen Block angehalten
  if (!advanceToNextStep()) { // sonst hat beginBlock()/finishAblauf() schon gerendert
    fbSetTimer(tickBlock);
    renderFbOverlay();
  }
  if (fb.blockIndex < fb.blocks.length) fbKeepPaused(wasPaused);
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
    fbSetTimer(tickBlock);
  }
  renderFbOverlay();
}

/* ---------- Ablauf-Vollbild (Beta: ruhiges Layout) ----------
   Feste Zeilen: Kopf (✕ · Fortschritt · Übersicht) · Phase · Bühne · Zahl ·
   Info · Steuerung. Zwischen den Phasen springt nichts, alles passt ohne
   Scrollen, die Knöpfe stehen immer an derselben Stelle. Bei Hang-Sätzen
   hängt das Faultier direkt am gewählten Griff (fbLayoutBoardStage), in
   der Pause steht es darunter und der nächste Griff ist markiert.
   Entwurf dazu: beta/entwurf-timer.html. */

/* Was gerade zu sehen ist: 'ready' (vor dem Start / Vorbereitung), 'work'
   oder 'rest'. In der abschliessenden Pause eines Blocks zeigt die Bühne
   schon den NÄCHSTEN Block (displayBlock). */
function fbRunState() {
  const block = fb.blocks[fb.blockIndex];
  if (fb.awaitingNext || fb.preCount != null) {
    return { mode: 'ready', block, displayBlock: block, step: null, working: false, trailing: false, activeRep: null };
  }
  const step = fb.sequence[fb.stepIndex];
  const working = isWorkPhase(step);
  const trailing = fbIsTrailingPause();
  const displayBlock = (trailing && fb.blocks[fb.blockIndex + 1]) || block;
  return { mode: working ? 'work' : 'rest', block, displayBlock, step, working, trailing, activeRep: working && step ? step.rep : null };
}
/* Wechselt dieser Schlüssel, wird das Vollbild neu aufgebaut (Phasen-/
   Schrittwechsel), sonst werden nur Zahl und Balken nachgezogen. */
function fbStageKey(st) {
  return [st.mode, fb.blockIndex, fb.awaitingNext ? 'a' : '', fb.preCount != null ? 'p' : '', st.mode === 'ready' ? '' : fb.stepIndex, st.mode !== 'work' ? fbSoonLevel() : ''].join(':');
}

/* ---- Ende der Pause ankündigen ----
   Stufe 1 (10 s vorher): Doppelton + Vibration, Titel "Gleich Hang".
   Stufe 2 (5 s): Phasenfarbe läuft von Orange zu Blau, Faultier streckt
   die Arme Richtung Griff. Stufe 3 (3 s): Piep + Vibration pro Sekunde,
   Zahl springt, Bühne blitzt einmal blau. */
function fbNextWorkBlock() {
  const step = fb.sequence[fb.stepIndex];
  if (fb.awaitingNext || fb.preCount != null || !step || isWorkPhase(step)) return null;
  const next = fbIsTrailingPause() ? fb.blocks[fb.blockIndex + 1] : fb.blocks[fb.blockIndex];
  return next && next.type !== 'pause' ? next : null;
}
function fbWorkWord(b) {
  if (b.type === 'hang') return 'Hang';
  if (b.type === 'block') return b.mode === 'reps' ? 'Ziehen' : 'Halten';
  if (b.type === 'campus') return 'Campus';
  return 'Übung';
}
/* 0 = normale Pause, 1 = ≤10 s, 2 = ≤5 s (nur wenn danach gearbeitet wird) */
function fbSoonLevel() {
  if (fb.preCount != null) return fb.preCount <= 5 ? 2 : 0; // Start-Countdown: gleiche Steigerung
  if (!fbNextWorkBlock() || fb.secondsLeft <= 0) return 0;
  return fb.secondsLeft <= 5 ? 2 : fb.secondsLeft <= 10 ? 1 : 0;
}
function fbWarnSoon() {
  fbBuzz([80, 60, 80]);
  beep(1175, 90);
  setTimeout(() => beep(1175, 90), 140);
}

function fbPhaseWord(st) {
  if (st.mode === 'ready') {
    // Start-Countdown: motivierend mit Vornamen (wie früher "ALLEZ, …!")
    const first = state.member && state.member.name ? String(state.member.name).trim().split(/\s+/)[0].slice(0, 10) : '';
    return fb.preCount != null ? esc(first ? `Allez, ${first}!` : 'Allez!') : 'Bereit';
  }
  const b = st.block;
  if (st.mode === 'rest') {
    const next = fbNextWorkBlock();
    if (next && fbSoonLevel() > 0) return `Gleich ${fbWorkWord(next)}`;
    return st.step && st.step.phase === 'Zeit zum Loggen' ? 'Loggen' : 'Pause';
  }
  if (b.type === 'pause') return 'Pause';
  if (b.type === 'hang') return 'Hang';
  if (b.type === 'block') return b.mode === 'reps' ? 'Ziehen' : 'Halten';
  if (b.type === 'campus') return 'Campus';
  return 'Übung';
}
function fbRepText(st) {
  const n = fb.blocks.length;
  if (st.trailing) return n > 1 ? `Block ${fb.blockIndex + 2}/${n}` : '';
  const b = st.block;
  const blockPart = n > 1 ? `Block ${fb.blockIndex + 1}/${n}` : '';
  let repPart = '';
  if (st.step && st.step.rep != null) repPart = `Satz ${st.step.rep + 1}/${b.reps}`;
  else if (st.mode === 'ready' && (isHoldModeBlock(b) || b.type === 'campus')) repPart = `Satz 1/${b.reps}`;
  else if (isRepsStyleBlock(b)) repPart = `Ziel ${b.reps}×`;
  return [repPart, blockPart].filter(Boolean).join(' · ');
}

function fbGripNote(boardId, gripId) {
  const board = BOARDS[boardId];
  const g = board && board.grips.find((x) => x.id === gripId);
  return g && g.note ? g.note.replace(/(\d)mm/g, '$1 mm') : '';
}
/* Erste Info-Zeile (fett): Griff/Übung des gezeigten Blocks. Liefert HTML. */
function fbInfoMainHtml(b, activeRep) {
  if (b.type === 'pause') return `${b.seconds} s Pause`;
  if (b.type === 'hang') {
    if (hangIsAsymmetric(b)) {
      return `<span class="hand-l">L: ${esc(gripLabel(b.board, b.gripLeft))}</span> · <span class="hand-r">R: ${esc(gripLabel(b.board, b.gripRight))}</span>`;
    }
    const arm = hangArmNote(b);
    const armText = arm !== 'einarmig' ? arm
      : activeRep != null ? `einarmig ${handLabel(fbHangHandForRep(b, activeRep)).toLowerCase()}`
      : b.handMode ? `einarmig, ${blockHandPatternText(b)}` : arm;
    const parts = [gripLabel(b.board, b.grip), fbGripNote(b.board, b.grip), armText].filter(Boolean);
    return esc(parts.join(' · '));
  }
  if (b.type === 'block') {
    const hand = activeRep != null ? `${handLabel(blockHandForRep(b, activeRep))} (einarmig)` : `einarmig, ${blockHandPatternText(b)}`;
    return `${esc(blockGripLabel(b))} · ${esc(hand)}`;
  }
  if (b.type === 'campus') {
    // Ohne die Emoji-Symbole aus campusLabel (Android zeichnet sie als bunte Kacheln)
    const rungs = b.rungTypeRight && b.rungTypeRight !== b.rungType
      ? `<span class="hand-l">L: ${esc(campusRungLabel(b.rungType))}</span> · <span class="hand-r">R: ${esc(campusRungLabel(b.rungTypeRight))}</span>`
      : esc(campusRungLabel(b.rungType));
    return `${rungs} · ${esc(campusMoveText(b))}`;
  }
  return esc(exerciseName(b.exerciseId));
}
/* Kurzfassung eines Blocks für die Vorschau in der Pause davor. */
/* Zeile unter der Info im Start-Countdown: was jetzt zu tun ist */
function fbGetReadyText(b) {
  if (b.type === 'hang') return 'Get ready — Hände ans Board!';
  if (b.type === 'block') return 'Get ready — Pin greifen!';
  if (b.type === 'campus') return 'Get ready — an die Startsprosse!';
  return 'Get ready — Position einnehmen!';
}
/* Kurzname fürs Schild "Als Nächstes" auf der Bühne (ohne Klammerzusatz). */
function fbShortName(b) {
  const short = (t) => String(t || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (b.type === 'pause') return 'Pause';
  if (b.type === 'hang') return hangIsAsymmetric(b) ? `${short(gripLabel(b.board, b.gripLeft))} / ${short(gripLabel(b.board, b.gripRight))}` : short(gripLabel(b.board, b.grip));
  if (b.type === 'block') return short(blockGripLabel(b));
  if (b.type === 'campus') return short(campusRungLabel(b.rungType));
  return short(exerciseName(b.exerciseId));
}
function fbShortSub(b) {
  if (b.type === 'pause') return 'Pause';
  if (isHoldModeBlock(b)) return `${b.reps}× ${b.hangSec} s ${b.type === 'block' ? 'Halten' : 'Hang'}${b.reps > 1 && b.restSec > 0 ? ` · ${b.restSec} s Pause` : ''}`;
  if (b.type === 'campus') return `${b.reps}× ${campusMoveText(b)}`;
  return `Ziel ${b.reps}× · ${b.workSec || 40} s`;
}

/* ---- Board mit Faultier am Griff ---- */
/* Griffe eines Hang-Satzes als [x, y, w, h] in Prozent des Board-Bilds,
   dazu welche Hand wohin gehört (für Farben bei L/R unterschiedlich). */
function fbHangSpots(b) {
  const board = BOARDS[b.board];
  if (!board) return [];
  const box = (h, hand) => ({ x: h.hx != null ? h.hx : h.x, y: h.hy != null ? h.hy : h.y, w: h.hw != null ? h.hw : 5, h: h.hh != null ? h.hh : 5, hand });
  if (hangIsAsymmetric(b)) {
    const l = board.hotspots.filter((h) => h.grip === b.gripLeft && hotspotSide(h) !== 'right').sort((p, q) => (p.hx ?? p.x) - (q.hx ?? q.x))[0];
    const r = board.hotspots.filter((h) => h.grip === b.gripRight && hotspotSide(h) !== 'left').sort((p, q) => (q.hx ?? q.x) - (p.hx ?? p.x))[0];
    return [l && box(l, 'l'), r && box(r, 'r')].filter(Boolean);
  }
  return board.hotspots.filter((h) => h.grip === b.grip).map((h) => box(h, ''));
}
function fbBoardStageHtml(b, hanging, tag, reach) {
  const board = BOARDS[b.board];
  const spots = fbHangSpots(b);
  const rings = spots.map((s) => `<rect class="fbx-ring${s.hand ? ' fbx-ring-' + s.hand : ''}" x="${s.x - s.w / 2}" y="${s.y - s.h / 2}" width="${s.w}" height="${s.h}" rx="2.5" vector-effect="non-scaling-stroke"/>`).join('');
  const clip = spots.map((s) => `<rect x="${(s.x - s.w / 2) / 100}" y="${(s.y - s.h / 2) / 100}" width="${s.w / 100}" height="${s.h / 100}" rx=".02"/>`).join('');
  const top = spots.length ? Math.min(...spots.map((s) => s.y - s.h / 2)) : 0;
  const cx = spots.length ? spots.reduce((sum, s) => sum + s.x, 0) / spots.length : 50;
  return `
    <div class="fbx-board" id="fbx-board">
      <img class="fbx-board-dim" src="${board.image}" alt="${esc(board.label)}">
      <img class="fbx-board-lit" src="${board.image}" alt="" aria-hidden="true">
      <svg class="fbx-board-rings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${rings}</svg>
      <svg width="0" height="0" class="fbx-clipdef" aria-hidden="true"><clipPath id="fbx-grip-clip" clipPathUnits="objectBoundingBox">${clip}</clipPath></svg>
      ${tag ? `<div class="fbx-tag" style="left:${cx}%;top:${top}%">${esc(tag)}</div>` : ''}
    </div>
    <div class="fbx-fig" id="fbx-fig" data-fit="${hanging ? 'hang' : 'stand'}">${hanging ? '' : reach ? slothFigure('reach', 'sloth-img') : fbRestFigureSvg()}</div>
  `;
}

/* Hang-Pose mit einstellbarer Armspreizung f (0 = Hände fast zusammen,
   1 = wie an der Stange). Pro Griff wird f so gesucht, dass die Hände
   genau auf dem Griff bzw. den zwei Löchern liegen. */
const FB_HANG_NARROW = { uarm_l: -97, farm_l: -93, grip_l: -91, uarm_r: -83, farm_r: -87, grip_r: -89 };
function fbHangPose(f) {
  const name = 'boardhang' + Math.round(f * 1000);
  if (!SLOTH_POSES[name]) {
    const base = SLOTH_POSES.hang;
    // len_farm ~0: Greifhand bringt schon Unterarm mit (sonst ein Glied zu viel)
    const a = { ...base.a, len_farm_l: 0.001, len_farm_r: 0.001 }, b = { ...base.b, len_farm_l: 0.001, len_farm_r: 0.001 };
    for (const k of Object.keys(FB_HANG_NARROW)) {
      a[k] = FB_HANG_NARROW[k] + f * (base.a[k] - FB_HANG_NARROW[k]);
      b[k] = a[k] + (base.b[k] - base.a[k]);
    }
    SLOTH_POSES[name] = { ...base, bar: false, a, b, label: 'Faultier hängt am Griff' };
  }
  return name;
}
const fbHangSpreadCache = {};
/* Griff nur einarmig nutzbar (z. B. BM2000 Grosse Kante, siehe GRIP_ARM_OVERRIDE). */
function fbHangOneArm(b) {
  return b.type === 'hang' && !hangIsAsymmetric(b) && hangArmNote(b) === 'einarmig';
}
/* Welche Hand bei einem Einarm-Hang dran ist: gewählt beim Hinzufügen
   (handMode/startHand wie beim Lifting Pin); ältere Sätze ohne Wahl
   wechseln einfach ab, links zuerst. */
function fbHangHandForRep(b, rep) {
  return b.handMode ? blockHandForRep(b, rep) : (rep % 2 ? 'right' : 'left');
}
function fbOneArmHand(st) {
  return fbHangHandForRep(st.displayBlock, st.activeRep || 0);
}
function fbLayoutBoardStage() {
  const stageEl = document.getElementById('fbx-stage');
  const boardEl = document.getElementById('fbx-board');
  const figEl = document.getElementById('fbx-fig');
  if (!stageEl || !boardEl || !figEl) return;
  const stage = stageEl.getBoundingClientRect();
  const board = boardEl.getBoundingClientRect();
  if (!stage.height || !board.height) return;
  const bx = board.left - stage.left, by = board.top - stage.top;
  if (figEl.dataset.fit === 'stand') {
    const svg = figEl.querySelector('svg');
    if (!svg) return;
    const [sx, , sw, sh] = svg.getAttribute('viewBox').split(' ').map(Number);
    const room = stage.height - (by + board.height) - 10;
    const k = Math.max(room, 40) / sh;
    Object.assign(figEl.style, { width: sw * k + 'px', height: sh * k + 'px', left: (stage.width / 2 + sx * k) + 'px', top: (stage.height - 8 - sh * k) + 'px' });
    return;
  }
  const st = fbRunState();
  const b = st.displayBlock;
  const spots = fbHangSpots(b);
  if (!spots.length) return;
  // Einarm-Griff: Faultier hängt an einer Hand (abwechselnd je Satz), die andere hängt locker
  if (fbHangOneArm(b)) {
    const sp = spots[0];
    const gx1 = bx + board.width * sp.x / 100;
    const gy1 = by + board.height * sp.y / 100;
    figEl.innerHTML = slothFigure(fbOneArmHand(st) === 'right' ? 'hang1r' : 'hang1l', 'sloth-img');
    const [vx, vy, vw, vh] = figEl.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
    const s1 = (stage.height - gy1 - 6) / (vh + vy);
    Object.assign(figEl.style, { width: vw * s1 + 'px', height: vh * s1 + 'px', left: (gx1 + vx * s1) + 'px', top: (gy1 + vy * s1) + 'px' });
    return;
  }
  const cx = spots.reduce((s, p) => s + p.x, 0) / spots.length;
  const cy = spots.reduce((s, p) => s + p.y, 0) / spots.length;
  const gx = bx + board.width * cx / 100;
  const gy = by + board.height * cy / 100;
  const place = (f) => {
    figEl.innerHTML = slothFigure(fbHangPose(f), 'sloth-img');
    const [vx, vy, vw, vh] = figEl.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
    const s = (stage.height - gy - 6) / (vh + vy);
    Object.assign(figEl.style, { width: vw * s + 'px', height: vh * s + 'px', left: (gx + vx * s) + 'px', top: (gy + vy * s) + 'px' });
  };
  // Zielabstand der Hände: zwei Löcher = deren Abstand, ein Griff = Hände nebeneinander darauf
  const xs = spots.map((p) => p.x);
  const target = spots.length > 1
    ? board.width * (Math.max(...xs) - Math.min(...xs)) / 100
    : board.width * spots[0].w / 100 * 0.55;
  const key = `${b.board}:${spots.map((p) => p.x.toFixed(1)).join('/')}@${Math.round(board.width)}x${Math.round(stage.height)}`;
  if (fbHangSpreadCache[key] == null) {
    figEl.classList.add('fbx-measuring');
    // hi gross genug, dass die Hände auch die äussersten Griffe erreichen
    let lo = -1, hi = 5;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      place(mid);
      const l = figEl.querySelector('.sp-grip_l image');
      const r = figEl.querySelector('.sp-grip_r image');
      if (!l || !r) break;
      const lr = l.getBoundingClientRect(), rr = r.getBoundingClientRect();
      const span = (rr.left + rr.width / 2) - (lr.left + lr.width / 2);
      if (span < target) lo = mid; else hi = mid;
    }
    fbHangSpreadCache[key] = (lo + hi) / 2;
    figEl.classList.remove('fbx-measuring');
  }
  place(fbHangSpreadCache[key]);
}
window.addEventListener('resize', () => { if (document.getElementById('fbx-board')) fbLayoutBoardStage(); });

/* Bühne: Board mit Faultier (Hang), sonst die passende Figur mittig. */
function fbStageInnerHtml(st) {
  const d = st.displayBlock;
  const onBoard = d.type === 'hang' && BOARDS[d.board];
  const tag = st.mode === 'ready' ? (onBoard ? 'Hier hängen' : '') : st.trailing ? `Als Nächstes · ${fbShortName(d)}` : '';
  if (onBoard) return fbBoardStageHtml(d, st.mode === 'work', tag, st.mode !== 'work' && fbSoonLevel() === 2);
  let fig;
  if (st.mode === 'work') {
    const b = st.block;
    fig = isHangLikeBlock(b) ? holdBlockWorkFigure(b, st.activeRep) : b.type === 'campus' ? campusWorkFigureSvg(b, false) : b.type === 'pause' ? fbRestFigureSvg() : exerciseFigureSvg(b.exerciseId);
  } else if (st.mode === 'ready' || st.trailing) {
    fig = d.type === 'campus' ? campusWorkFigureSvg(d) : d.type === 'pause' ? fbRestFigureSvg() : isHangLikeBlock(d) ? holdBlockWorkFigure(d, 0) : exerciseFigureSvg(d.exerciseId);
  } else {
    fig = st.block.type === 'campus' ? campusWorkFigureSvg(st.block) : fbRestFigureSvg();
  }
  return `<div class="fbx-center">${fig}</div>${tag ? `<div class="fbx-tag fbx-tag-top">${esc(tag)}</div>` : ''}`;
}

function fbMainButtonHtml(st) {
  const showTarget = isRepsStyleBlock(st.block);
  if (fb.awaitingNext || fb.preCount != null) return '<button type="button" class="fbx-main fbx-main-wide" id="fbx-start">START</button>';
  if (showTarget && st.working) return '<button type="button" class="fbx-main fbx-main-wide" id="fb-reps-done">GESCHAFFT</button>';
  const isPaused = fb.running && !fb.intervalId;
  return `<button type="button" class="fbx-main" id="fb-playpause" aria-label="${isPaused ? 'Weiter' : 'Anhalten'}">${isPaused ? TRANSPORT_ICON.play : TRANSPORT_ICON.pause}</button>`;
}

function fbQuitSheetHtml() {
  return `
    <div class="fbx-sheet-bg" id="fbx-sheet">
      <div class="fbx-sheet">
        <div class="fbx-sheet-title">Training beenden?</div>
        <div class="fbx-sheet-text">${fb.blockIndex > 0 ? 'Fertige Blöcke kannst du speichern.' : 'Es ist noch kein Block fertig.'}</div>
        <button type="button" class="btn" id="fbx-stay">Weitermachen</button>
        ${fb.blockIndex > 0 ? '<button type="button" class="btn ghost" id="fb-finish-early">Beenden &amp; speichern</button>' : ''}
        <button type="button" class="btn ghost fbx-danger" id="fb-cancel">Verwerfen</button>
      </div>
    </div>
  `;
}
/* ✕ hält den Timer an und fragt nach; "Weitermachen" läuft weiter. */
function fbOpenQuit() {
  fb.showQuit = true;
  fb.quitResume = null;
  if (fb.preCount != null && fb.intervalId) { fbSetTimer(null); fb.quitResume = 'pre'; }
  else if (fb.running && fb.intervalId) { fbTogglePause(); fb.quitResume = 'run'; }
  renderFbOverlay();
}
function fbCloseQuit() {
  fb.showQuit = false;
  const resume = fb.quitResume;
  fb.quitResume = null;
  if (resume === 'pre') { fbSetTimer(tickPreCountdown); renderFbOverlay(); }
  else if (resume === 'run') fbTogglePause(); // rendert selbst
  else renderFbOverlay();
}

/* Nichts abschneiden: Titel, Satz-Angabe und Info-Zeilen werden so weit
   verkleinert, bis sie ganz hineinpassen (Info fett darf zweizeilig sein). */
function fbFitOverlayText() {
  const title = document.querySelector('#fb-overlay .fbx-title');
  const phase = document.getElementById('fb-phase');
  const repEl = document.getElementById('fb-rep');
  if (title && phase && repEl) {
    phase.style.fontSize = ''; repEl.style.fontSize = '';
    const need = () => phase.scrollWidth + repEl.scrollWidth + 12;
    let f = parseFloat(getComputedStyle(phase).fontSize);
    while (need() > title.clientWidth && f > 24) { f -= 2; phase.style.fontSize = f + 'px'; }
    let r = parseFloat(getComputedStyle(repEl).fontSize);
    while (need() > title.clientWidth && r > 12) { r -= 1; repEl.style.fontSize = r + 'px'; }
  }
  const main = document.getElementById('fbx-info-main');
  if (main) {
    main.style.fontSize = '';
    let m = parseFloat(getComputedStyle(main).fontSize);
    while (main.scrollHeight > main.clientHeight + 1 && m > 12) { m -= 1; main.style.fontSize = m + 'px'; }
  }
  fbFitLine(document.getElementById('fb-upcoming'));
}
function fbFitLine(el) {
  if (!el) return;
  el.style.fontSize = '';
  let f = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 1 && f > 11) { f -= 1; el.style.fontSize = f + 'px'; }
}
window.addEventListener('resize', () => { if (document.querySelector('#fb-overlay .fbx')) fbFitOverlayText(); });
// Schrift (Barlow) kommt evtl. erst nach dem ersten Aufbau — danach nochmal einpassen
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (document.querySelector('#fb-overlay .fbx')) fbFitOverlayText(); });

function renderFbOverlay() {
  const el = ensureFbOverlay();
  if (!fb.running && !fb.awaitingNext && fb.preCount == null) { closeFbOverlay(); return; }
  if (!fb.blocks[fb.blockIndex]) { closeFbOverlay(); return; }
  const st = fbRunState();
  const isPaused = fb.running && !fb.intervalId;
  const segs = fb.blocks.map((b) => `<div class="fbx-seg" style="flex:${Math.max(fbBlockSeconds(b), 1)}"><i></i></div>`).join('');
  const muscles = (st.mode === 'work' && st.block.type === 'exercise') ? exerciseMuscles(st.block.exerciseId)
    : (st.trailing && st.displayBlock.type === 'exercise') ? exerciseMuscles(st.displayBlock.exerciseId) : null;
  const showMuscles = muscles && muscleLabelsText(muscles.primary, muscles.secondary);
  const upcoming = st.trailing ? fbShortSub(st.displayBlock) : fb.preCount != null ? fbGetReadyText(st.block) : fb.awaitingNext ? fbShortSub(st.block) : '';
  const bigNum = fb.preCount != null
    ? `<div class="fbx-num" id="fb-precount">${fb.preCount}</div>`
    : fb.awaitingNext
      ? `<div class="fbx-num" id="fb-big">${pad2(buildBlockSequence(st.block)[0].seconds)}</div>`
      : `<div class="fbx-num" id="fb-big">${fbBigContent(false)}</div>`;
  const canBack = !(fb.blockIndex === 0 && fb.stepIndex === 0) && !fb.awaitingNext && fb.preCount == null;

  el.innerHTML = `
    <div class="fbx fbx-${st.mode}${isPaused ? ' paused' : ''}${st.mode !== 'work' && fbSoonLevel() === 2 ? ' fbx-soon' : ''}" data-key="${fbStageKey(st)}">
      <div class="fbx-top">
        <button type="button" class="fbx-icon" id="fb-overlay-close" aria-label="Beenden"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div class="fbx-segs" id="fbx-segs">${segs}</div>
        <button type="button" class="fbx-icon" id="fb-overview-btn" aria-label="Restprogramm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg></button>
      </div>
      <div class="fbx-title">
        <div class="fbx-phase" id="fb-phase">${fbPhaseWord(st)}${isPaused ? '<span class="fbx-paused-tag">angehalten</span>' : ''}</div>
        <div class="fbx-rep" id="fb-rep">${esc(fbRepText(st))}</div>
      </div>
      <div class="fbx-stage${isPaused ? ' fb-paused' : ''}" id="fbx-stage">
        ${fbStageInnerHtml(st)}
        ${showMuscles ? `<div class="fbx-muscles">${bodyMapSvg(muscles.primary, muscles.secondary)}</div>` : ''}
        ${st.trailing ? `<div class="fbx-checkin fb-checkin" id="fb-checkin">${fb.runResults[fb.blockIndex] ? checkinPanelHtml(fb.blockIndex) : ''}</div>` : ''}
      </div>
      <div class="fbx-count">
        ${bigNum}
        <div class="fbx-bar"><i id="fb-bar-fg"></i></div>
      </div>
      <div class="fbx-info">
        <b id="fbx-info-main">${st.trailing ? '<span class="fbx-next-label">Danach:</span> ' : ''}${fbInfoMainHtml(st.displayBlock, st.activeRep)}</b>
        <span id="fb-upcoming">${esc(upcoming)}</span>
      </div>
      <div class="fbx-controls">
        <button type="button" class="fbx-ctl" id="fb-prev" ${canBack ? '' : 'disabled'} aria-label="Zurück">${TRANSPORT_ICON.prev}</button>
        ${fbMainButtonHtml(st)}
        <button type="button" class="fbx-ctl" id="fb-skip" aria-label="Weiter">${TRANSPORT_ICON.next}</button>
      </div>
    </div>
    ${fb.showQuit ? fbQuitSheetHtml() : ''}
    ${fb.showOverview ? fbOverviewHtml() : ''}
  `;

  document.getElementById('fb-overlay-close').onclick = fbOpenQuit;
  document.getElementById('fb-overview-btn').onclick = () => toggleFbOverview(true);
  if (fb.showOverview) wireFbOverviewPanel();
  document.getElementById('fb-prev').onclick = fbStepBack;
  document.getElementById('fb-skip').onclick = fbStepForward;
  const start = document.getElementById('fbx-start');
  if (start) start.onclick = fb.awaitingNext ? startCurrentBlock : finishPreCountdown;
  const pp = document.getElementById('fb-playpause');
  if (pp) pp.onclick = fbTogglePause;
  const repsDone = document.getElementById('fb-reps-done');
  if (repsDone) repsDone.onclick = fbFinishRepsWork;
  if (fb.showQuit) {
    document.getElementById('fbx-stay').onclick = fbCloseQuit;
    document.getElementById('fb-cancel').onclick = () => { fb.showQuit = false; cancelAblauf(); };
    const early = document.getElementById('fb-finish-early');
    if (early) early.onclick = () => { fb.showQuit = false; finishAblaufEarly(); };
  }
  if (st.trailing && fb.runResults[fb.blockIndex]) wireCheckinPanel(fb.blockIndex);
  if (!st.trailing && !fb.awaitingNext && fb.preCount == null) updateFbUpcomingUI();
  updateFbProgressUI();
  syncFbRingAnimation();
  fbFitOverlayText();
  fbLayoutBoardStage();
  // Board-Bild evtl. noch nicht geladen: nach dem Laden nochmal ausrichten
  const img = el.querySelector('.fbx-board-dim');
  if (img && !img.complete) img.addEventListener('load', fbLayoutBoardStage, { once: true });
  kickCampusAnims(el);
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

/* Beginnt ein Ablauf direkt mit kleinen Griffen, einmal am Tag ans Aufwärmen erinnern
   (häufigste Ursache für Ringband-Verletzungen: kalt an kleine Leisten) */
function fbWarmupReminder() {
  const first = fb.blocks.find((b) => b.type !== 'pause');
  const warm = !first || first.type !== 'hang' || ['jug', 'edge_large', 'sloper_easy', 'sloper_medium'].includes(first.grip || first.gripLeft);
  if (warm) return;
  const today = todayKey();
  try { if (localStorage.getItem(STORAGE_PREFIX + 'warmup_hint') === today) return; localStorage.setItem(STORAGE_PREFIX + 'warmup_hint', today); } catch (e) { return; }
  toast('Aufgewärmt? Nie kalt an kleine Griffe: Programm „Aufwärmen“ unter Schnelltraining dauert 5 Minuten.');
}

function startAblauf() {
  fbWarmupReminder();
  fb.templateId = fb.pendingTemplateId || null;
  fb.pendingTemplateId = null;
  fb.blockIndex = 0;
  fb.running = false;
  fb.awaitingNext = true;
  fb.preCount = null;
  fb.runResults = [];
  fb.showOverview = false;
  clearTimeout(fb.losTimeoutId);
  fb.showLos = false;
  fb.showQuit = false;
  fbCheckinTyping = false;
  // Beginnt der Ablauf mit Hang/Campus/Lifting Pin, ist der Vorbereitungs-
  // Countdown selbst der Bereit-Bildschirm (kein extra "LOS" davor).
  const first = fb.blocks[0];
  if (first && (first.type === 'hang' || first.type === 'campus' || first.type === 'block')) {
    fb.awaitingNext = false;
    beginBlock();
  }
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
/* Beim Tippen verdeckt die Handy-Tastatur die Info-Zeile unten — darum steht
   im Eingabe-Kästchen selbst noch einmal, was danach kommt. */
function fbCheckinNextHtml() {
  const st = fbRunState();
  if (!st.trailing) return '';
  return `<div class="fb-checkin-next">Danach: <b>${esc(fbShortName(st.displayBlock))}</b> · ${esc(fbShortSub(st.displayBlock))}</div>`;
}
function checkinPanelHtml(index) {
  const result = fb.runResults[index];
  if (!result || result.type === 'pause') return '';
  if (result.doneReps) {
    return `
      <div class="fb-checkin-label mono">GESCHAFFTE SÄTZE</div>
      ${fbCheckinNextHtml()}
      <div class="fb-checkin-chips">
        ${result.doneReps.map((ok, i) => `<button type="button" class="fb-chip ${ok ? 'ok' : 'fail'}" data-satz="${i}">${i + 1}</button>`).join('')}
      </div>
    `;
  }
  return `
    <div class="fb-checkin-label mono">GESCHAFFT</div>
    ${fbCheckinNextHtml()}
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
    fbSetTimer(tickPreCountdown);
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
  if (fb.preCount <= 3) { beepTick(); fbBuzz(80); }
  // Nur die Zahl aktualisieren statt alles neu zu zeichnen — sonst startet
  // die Campus-Routen-Animation jede Sekunde von vorne und läuft nie durch.
  // Ausnahme: bei 5 s einmal neu aufbauen (Farbe → Blau, Faultier streckt sich).
  setTimeout(() => {
    const root = document.querySelector('#fb-overlay .fbx');
    if (root && root.dataset.key !== fbStageKey(fbRunState())) { renderFbOverlay(); return; }
    const num = document.getElementById('fb-precount');
    if (!num || fb.preCount == null) { renderFbOverlay(); return; }
    num.textContent = fb.preCount;
    if (fb.preCount <= 3) {
      num.classList.remove('fbx-pop'); void num.offsetWidth; num.classList.add('fbx-pop');
      const stageEl = document.getElementById('fbx-stage');
      if (stageEl && fb.preCount === 3) stageEl.classList.add('fbx-flash');
    }
  }, fbAudioLeadMs()); // siehe fbAudioLeadMs — Ton vor Bild
}

function startSequence() {
  const block = fb.blocks[fb.blockIndex];
  fb.running = true;
  fb.sequence = buildBlockSequence(block, fb.blockIndex === fb.blocks.length - 1);
  fb.stepIndex = 0;
  fb.secondsLeft = fb.sequence[0].seconds;
  fb.stepStartedAt = Date.now();
  fb.pausedAt = null;
  fbSetTimer(tickBlock);
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

/* Treibt den Phasen-Balken (#fb-bar-fg, früher der Ring) über eine ECHTE
   CSS-Animation an (statt einmal pro Sekunde per JS zu setzen) — er
   läuft dadurch exakt in Echtzeit mit (animation-delay ist die seit
   Schrittbeginn verstrichene Zeit, negativ, damit die Animation an genau
   der richtigen Stelle "einsteigt"), unabhängig vom 1x/Sekunde-Tick-Timing
   und ohne dass am Phasenende manuell auf "geschlossen" gesprungen werden
   müsste — die Animation erreicht das Ende von selbst exakt im
   richtigen Moment. Bei "prefers-reduced-motion" (siehe auch css/)
   stattdessen wie bisher ein statischer, aus fb.secondsLeft berechneter
   Wert ohne Animation. Muss bei jedem echten Schrittwechsel neu aufgerufen
   werden (frisches DOM-Element durch renderFbOverlay ODER derselbe Ring-
   Knoten bei einem gezielten Update in tickBlock) — NICHT bei jedem
   laufenden Tick innerhalb derselben Phase, sonst würde die Animation
   ständig neu gestartet statt einfach weiterzulaufen. */
function syncFbRingAnimation() {
  const bar = document.getElementById('fb-bar-fg');
  if (!bar) return;
  // Vorbereitung: Balken läuft über die Countdown-Zeit
  if (fb.preCount != null) {
    bar.style.animation = 'none';
    bar.getBoundingClientRect();
    bar.style.animation = `fbBarFill ${FB_PRECOUNT_SECONDS}s linear forwards`;
    bar.style.animationDelay = `-${FB_PRECOUNT_SECONDS - fb.preCount}s`;
    bar.style.animationPlayState = fb.intervalId ? 'running' : 'paused';
    return;
  }
  const step = fb.sequence[fb.stepIndex];
  if (fb.awaitingNext || !step) { bar.style.animation = 'none'; bar.style.transform = 'scaleX(0)'; return; }
  const phaseTotal = step.seconds;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !phaseTotal) {
    bar.style.animation = 'none';
    bar.style.transform = `scaleX(${phaseTotal ? 1 - fb.secondsLeft / phaseTotal : 1})`;
    return;
  }
  const elapsedSec = Math.max(0, (Date.now() - fb.stepStartedAt) / 1000);
  bar.style.animation = 'none';
  bar.getBoundingClientRect(); // Reflow erzwingen, damit der Neustart unten wirklich greift
  bar.style.animation = `fbBarFill ${phaseTotal}s linear forwards`;
  bar.style.animationDelay = `-${elapsedSec}s`;
  bar.style.animationPlayState = (fb.intervalId && !fbCheckinTyping) ? 'running' : 'paused';
}

function tickBlock() {
  if (fbCheckinTyping) return; // Zeit angehalten, solange man im Check-in tippt
  audioKeepWarm();
  const step = fb.sequence[fb.stepIndex];
  // Display war aus (Ticks gedrosselt/ausgefallen): verpasste Sekunden des
  // laufenden Schritts aus der echten Uhr nachholen, statt dort
  // weiterzuzählen, wo der Bildschirm ausging. Nur innerhalb des aktuellen
  // Schritts — bei 0 geht es wie gewohnt einen Schritt weiter.
  if (step && fb.stepStartedAt && !fb.pausedAt) {
    const real = step.seconds - Math.floor((Date.now() - fb.stepStartedAt) / 1000);
    if (fb.secondsLeft - real > 2) fb.secondsLeft = Math.max(1, real + 1);
  }
  fb.secondsLeft--;
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
      // renderFbOverlay() mit an. Verzögert (siehe fbAudioLeadMs), damit
      // der eben ausgelöste Ton (advanceToNextStep) dem Bild vorausläuft.
      setTimeout(renderFbOverlay, fbAudioLeadMs());
      return;
    }
    // Gleicher Ring-Knoten bleibt bestehen (kein voller Re-Render nötig) —
    // Animation für die neue Phase explizit neu ansetzen, ebenfalls
    // verzögert (siehe oben).
    setTimeout(syncFbRingAnimation, fbAudioLeadMs());
  } else if (step && !isWorkPhase(step) && fb.secondsLeft <= 3) {
    // Letzte 3 Sekunden einer Pause: kurzer Tick pro Sekunde als
    // akustische Vorwarnung, dass der nächste Satz gleich losgeht.
    beepTick();
    if (fbNextWorkBlock()) fbBuzz(80);
  } else if (step && !isWorkPhase(step) && fb.secondsLeft === 10 && fbNextWorkBlock()) {
    fbWarnSoon(); // Stufe 1: 10 s vor Ende der Pause
  }
  setTimeout(updateTimerUI, fbAudioLeadMs());
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
  const root = document.querySelector('#fb-overlay .fbx');
  if (!root) return;
  const st = fbRunState();
  // Neuer Schritt/neue Phase: ganz neu aufbauen (Figur, Titel, Knöpfe)
  if (root.dataset.key !== fbStageKey(st)) { renderFbOverlay(); return; }
  const restWarn = !st.working && fb.secondsLeft > 0 && fb.secondsLeft <= 5;
  const restTense = !st.working && fb.secondsLeft > 0 && fb.secondsLeft <= 3;
  const workTense = st.working && fb.secondsLeft > 0 && fb.secondsLeft <= 3;
  const big = document.getElementById('fb-big');
  if (big) {
    // innerHTML: "LOS!" und die einzeln rausfliegenden Ziffern (fbFlyDigitsHtml)
    // sollen bei jedem Tick als frische Elemente neu animieren.
    big.innerHTML = fbBigContent(false);
    big.className = 'fbx-num' + (restWarn ? ' rest-warn' : '') + (workTense ? ' work-tense' : '') + (fb.showLos ? ' los-flash' : '');
    // Letzte 3 s der Pause: Zahl springt bei jedem Tick (Klasse neu setzen, damit die Animation neu startet)
    if (restTense && fbNextWorkBlock()) { void big.offsetWidth; big.classList.add('fbx-pop'); }
  }
  const stageEl = document.getElementById('fbx-stage');
  if (stageEl && !st.working && fb.secondsLeft === 3 && fbNextWorkBlock() && !stageEl.classList.contains('fbx-flash')) stageEl.classList.add('fbx-flash');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) syncFbRingAnimation();
  if (!st.trailing) updateFbUpcomingUI();
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
      ${slothFigure('wave', 'fb-done-sloth')}
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
    ...(fb.templateId ? { templateId: fb.templateId } : {}),
    blocks,
    results,
    createdAt: Date.now(),
    ...(isPartial ? { partial: true } : {}),
  };
  await fbPush(`fingerboardSessions/${state.member.id}`, session);
  toast('Ablauf gespeichert 💪', 'ok');
}

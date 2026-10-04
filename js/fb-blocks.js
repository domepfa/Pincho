/* js/fb-blocks.js — Board: Beschreibung von Sätzen (Hang/Block/Campus-Labels, Leiter- und Routen-Grafik, Regel-Chips, Ablaufliste) */
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
  return `<div class="timeline-thumb fb-block-thumb">${blockPinFigureSvg('left')}</div>`;
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
/* "Hand für Hand": Züge als L2 · R3 … (Start = beide Hände). */
function campusFreeMovesText(b) {
  const stops = campusStopsOf(b);
  return (b.hands || []).map((h, i) => `${h === 'r' ? 'R' : 'L'}${stops[i + 1]}`).join(' · ');
}
function campusMoveText(b) {
  if (b.armMode === 'free') return `Start ${b.startRung} · ${campusFreeMovesText(b)}`;
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
  if (armMode === 'free') return '✋';
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
  if (armMode === 'free') return 'Hand für Hand';
  if (armMode === 'match') return 'Nachziehen';
  if (armMode === 'skip') return 'Übergreifen';
  return 'Gleichzeitig';
}
function campusArmLabelHtml(b) {
  const armMode = b.armMode || 'both';
  let handText = armMode !== 'both' && armMode !== 'free' ? (b.startHand === 'right' ? 'Rechts zuerst' : 'Links zuerst') : '';
  if (armMode === 'skip' && b.skipEnd === 'match') handText += ' · am Ende nachziehen';
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
  const text = b.armMode === 'free'
    ? `<div class="campus-route-step"><span class="campus-route-dot up"></span>Start <b>Sprosse ${stops[0]}</b> (beide Hände)</div>${(b.hands || []).map((h, i) => `<div class="campus-route-step"><span class="campus-route-dot ${h === 'r' ? 'hand-r-dot' : 'up'}"></span>${h === 'r' ? 'Rechts' : 'Links'} an <b>Sprosse ${stops[i + 1]}</b></div>`).join('')}`
    : stops.length === 2
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
  if (armMode === 'free') {
    (b.hands || []).forEach((h, i) => { ev[h === 'r' ? 'r' : 'l'].push({ t0: i + 0.1, t1: i + 0.6, rung: stops[i + 1] }); });
    return ev;
  }
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
  // Übergreifen, "am Ende nachziehen": die zweite Hand kommt zum Schluss
  // ebenfalls an die Zielsprosse (sonst hält man den letzten Griff einhändig).
  if (armMode === 'skip' && b.skipEnd === 'match' && stops.length > 1) {
    const n = stops.length - 1;
    const lastHand = n % 2 === 1 ? lead : other;
    ev[lastHand === 'l' ? 'r' : 'l'].push({ t0: n + 0.1, t1: n + 0.6, rung: stops[n] });
  }
  return ev;
}

/* Frisch eingesetzte Campus-Animation sofort starten: Chrome lässt eine
   per innerHTML eingefügte SMIL-Animation sonst eine ganze Runde (~5 s)
   stillstehen, bevor sich die Hand-Punkte bewegen. Zurücksetzen auf 0 im
   nächsten Frame erzwingt, dass sie von Anfang an läuft. */
function kickCampusAnims(root) {
  requestAnimationFrame(() => {
    (root || document).querySelectorAll('svg.campus-anim').forEach((svg) => {
      try { svg.setCurrentTime(0); } catch (e) { /* ignorieren */ }
    });
  });
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
  const T = Math.max(1, stops.length - 1) + (b.armMode === 'skip' && b.skipEnd === 'match' ? 2.2 : 1.2);
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
    const handSuffix = (b.type === 'block' || b.handMode) ? ' · ' + blockHandPatternText(b) : '';
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
  if (armMode === 'both' || armMode === 'free') return modeLabel;
  return `${modeLabel}, ${b.startHand === 'right' ? 'Rechts' : 'Links'} zuerst${armMode === 'skip' && b.skipEnd === 'match' ? ', am Ende nachziehen' : ''}`;
}
function fbFactCampusMusterText(b) {
  if (b.armMode === 'free') return `Start ${b.startRung} · ${campusFreeMovesText(b)}`;
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

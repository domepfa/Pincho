/* ================================================================
   data.js — statische Konfiguration: Boards, Protokolle, Übungen.
   Keine Firebase-Zugriffe hier, nur reine Daten.
   ================================================================= */

/* ---------- Beastmaker-Boards ----------
   Griffe sind bewusst als KATEGORIEN modelliert, nicht als exakte mm-Werte:
   so bleiben Challenges zwischen BM1000 und BM2000 fair vergleichbar, auch
   wenn die beiden Boards nicht identische Kantentiefen haben. Bei der
   Challenge-Erstellung wird automatisch nur die Schnittmenge der Kategorien
   angeboten, die auf ALLEN beteiligten Boards existieren (siehe app.js,
   getSharedGripIds()).

   BM1000- und BM2000-Kanten/Taschen sind reale Herstellerangaben (bestätigt
   anhand beschrifteter Referenzgrafiken, September 2026). Jug- und
   Sloper-Winkel sind bekannt, aber ohne mm-Tiefe (Sloper werden über den
   Winkel trainiert, nicht über eine Tiefe). */
const BOARDS = {
  bm1000: {
    label: 'Beastmaker 1000',
    image: './assets/board-bm1000.png',
    grips: [
      { id: 'jug', label: 'Jug', note: '2 Jugs oben' },
      { id: 'edge_large', label: 'Grosse Kante (4-Finger)', note: '50mm' },
      { id: 'edge_medium', label: 'Mittlere Kante (4-Finger)', note: '45mm' },
      { id: 'edge_small', label: 'Kleine Kante (4-Finger)', note: '20mm' },
      { id: 'edge_xsmall', label: 'Kleinste Kante (4-Finger)', note: '15mm' },
      { id: 'edge3', label: '3-Finger-Kante', note: '30mm' },
      { id: 'pocket3', label: '3-Finger-Tasche', note: '20mm' },
      { id: 'pocket3_deep', label: '3-Finger-Tasche tief', note: '45mm' },
      { id: 'pocket2', label: '2-Finger-Tasche', note: '25mm' },
      { id: 'pocket2_deep', label: '2-Finger-Tasche tief', note: '50mm' },
      { id: 'sloper_easy', label: 'Sloper 20°', note: '' },
      { id: 'sloper_medium', label: 'Sloper 35°', note: '' },
    ],
    // Antippbare Zonen (% von Bildbreite/-höhe) — per calibrate.html
    // erzeugt (Bild antippen, Griff zuordnen, Code exportieren).
    hotspots: [
      { grip: 'jug', x: 14.9, y: 23 },
      { grip: 'jug', x: 84.9, y: 24.2 },
      { grip: 'sloper_medium', x: 28.9, y: 31.4 },
      { grip: 'sloper_medium', x: 69.2, y: 30.3 },
      { grip: 'sloper_easy', x: 44.6, y: 28 },
      { grip: 'sloper_easy', x: 57.5, y: 28.6 },
      { grip: 'edge_xsmall', x: 13.9, y: 37.6 },
      { grip: 'edge_xsmall', x: 85.9, y: 37.6 },
      { grip: 'edge3', x: 46.1, y: 35.4 },
      { grip: 'edge3', x: 57.5, y: 39.3 },
      { grip: 'edge_medium', x: 12.4, y: 51.1 },
      { grip: 'edge_medium', x: 90.7, y: 51.7 },
      { grip: 'pocket2_deep', x: 76.5, y: 52 },
      { grip: 'pocket2_deep', x: 25.3, y: 52 },
      { grip: 'pocket3_deep', x: 36.2, y: 52.8 },
      { grip: 'pocket3_deep', x: 68.2, y: 52.2 },
      { grip: 'edge_large', x: 50.2, y: 50.7 },
      { grip: 'edge_small', x: 82.1, y: 68.6 },
      { grip: 'edge_small', x: 20.3, y: 66.3 },
      { grip: 'pocket2', x: 68.9, y: 68 },
      { grip: 'pocket2', x: 34.5, y: 68.5 },
      { grip: 'pocket3', x: 57.5, y: 69.1 },
      { grip: 'pocket3', x: 44.6, y: 68 },
    ],
  },
  bm2000: {
    label: 'Beastmaker 2000',
    image: './assets/board-bm2000.png',
    grips: [
      { id: 'edge_large', label: 'Grosse Kante (4-Finger)', note: '50mm' },
      { id: 'edge_medium', label: 'Mittlere Kante (4-Finger)', note: '33mm' },
      { id: 'edge_small', label: 'Kleine Kante (4-Finger)', note: '20mm' },
      { id: 'edge_xsmall', label: 'Kleinste Kante (4-Finger)', note: '15mm' },
      { id: 'pocket3', label: '3-Finger-Tasche', note: '40mm' },
      { id: 'pocket3_small', label: '3-Finger-Tasche klein', note: '20mm' },
      { id: 'pocket2', label: '2-Finger-Tasche', note: '30mm' },
      { id: 'pocket2_small', label: '2-Finger-Tasche klein', note: '20mm' },
      { id: 'pocket2_offset', label: '2-Finger-Tasche versetzt (Mittel-/Zeigefinger)', note: '35 / 50mm' },
      { id: 'mono', label: 'Mono-Tasche', note: '55mm' },
      { id: 'mono_small', label: 'Mono-Tasche klein', note: '25mm' },
      { id: 'sloper_easy', label: 'Sloper 20°', note: '' },
      { id: 'sloper_medium', label: 'Sloper 35°', note: '' },
      { id: 'sloper_hard', label: 'Sloper 45°', note: '' },
    ],
    // Siehe Kommentar bei bm1000 — gleiche Vorgehensweise.
    hotspots: [
      { grip: 'sloper_easy', x: 43.3, y: 26.4 },
      { grip: 'sloper_easy', x: 56.8, y: 25.3 },
      { grip: 'sloper_medium', x: 29.1, y: 30.3 },
      { grip: 'sloper_medium', x: 72, y: 30.3 },
      { grip: 'sloper_hard', x: 11.4, y: 28.1 },
      { grip: 'sloper_hard', x: 87.4, y: 29.2 },
      { grip: 'edge_medium', x: 13.9, y: 52.1 },
      { grip: 'edge_medium', x: 88.4, y: 48.7 },
      { grip: 'mono', x: 23.8, y: 50.8 },
      { grip: 'mono', x: 78, y: 48.5 },
      { grip: 'pocket2_offset', x: 29.9, y: 49.6 },
      { grip: 'pocket2_offset', x: 70.7, y: 47.9 },
      { grip: 'pocket2', x: 38.8, y: 49.3 },
      { grip: 'pocket2', x: 62.1, y: 49.3 },
      { grip: 'edge_large', x: 50.9, y: 49.5 },
      { grip: 'edge_xsmall', x: 14.4, y: 68.2 },
      { grip: 'edge_xsmall', x: 86.9, y: 65.9 },
      { grip: 'mono_small', x: 24.6, y: 68.5 },
      { grip: 'mono_small', x: 78.5, y: 67.9 },
      { grip: 'pocket2_small', x: 31.7, y: 68.2 },
      { grip: 'pocket2_small', x: 72.2, y: 66.5 },
      { grip: 'pocket2_small', x: 39.8, y: 68 },
      { grip: 'pocket2_small', x: 63.6, y: 68 },
      { grip: 'pocket3', x: 44.8, y: 37.3 },
      { grip: 'pocket3_small', x: 57.5, y: 36.7 },
      { grip: 'edge_small', x: 51.9, y: 69.7 },
    ],
  },
};

function gripLabel(boardId, gripId) {
  const board = BOARDS[boardId];
  const grip = board && board.grips.find((g) => g.id === gripId);
  return grip ? grip.label : gripId;
}

function gripInfo(boardId, gripId) {
  const board = BOARDS[boardId];
  return board && board.grips.find((g) => g.id === gripId);
}

/* Zwei gespiegelte Löcher (links + rechts) heisst zuverlässig beidarmig
   (eine Hand pro Seite) — das lässt sich aus den kalibrierten hotspots
   ableiten. EIN Loch ist dagegen mehrdeutig: das kann eine schmale,
   wirklich einarmige Position sein, ODER eine durchgehende breite Kante,
   die trotz nur einem Kalibrierpunkt ganz normal beidhändig genutzt wird
   (z. B. die grosse Kante — klassischer beidhändiger Aufwärm-Hang trotz
   nur einem Punkt in der Mitte). Ohne Rückmeldung vom echten Brett lässt
   sich das nicht unterscheiden, darum wird bei einem Loch bewusst NICHTS
   behauptet, statt zu raten. */
function gripArmNote(boardId, gripId) {
  const board = BOARDS[boardId];
  if (!board) return '';
  const count = board.hotspots.filter((h) => h.grip === gripId).length;
  return count >= 2 ? 'beidarmig' : '';
}

/* ---------- Fingerboard-Protokolle ---------- */
const PROTOCOLS = {
  max_hang: {
    label: 'Max Hang',
    defaults: { hangSec: 10, restSec: 180, sets: 5 },
    fields: ['hangSec', 'restSec', 'sets'],
  },
  repeater: {
    label: 'Repeater (7/3)',
    defaults: { hangSec: 7, restSec: 3, reps: 6, sets: 4, restBetweenSec: 180 },
    fields: ['hangSec', 'restSec', 'reps', 'sets', 'restBetweenSec'],
  },
  custom: {
    label: 'Frei',
    defaults: { hangSec: 10, restSec: 60, sets: 5 },
    fields: ['hangSec', 'restSec', 'sets'],
  },
};

/* Baut eine flache Liste von Phasen ({phase, seconds}) aus einem Protokoll +
   den (ggf. angepassten) Parametern. Der Timer selbst kennt nur diese Liste,
   nicht die Protokoll-Logik dahinter. */
function buildSequence(protocolId, opts) {
  const seq = [];
  if (protocolId === 'repeater') {
    const { hangSec, restSec, reps, sets, restBetweenSec } = opts;
    for (let s = 0; s < sets; s++) {
      for (let r = 0; r < reps; r++) {
        seq.push({ phase: 'Hang', seconds: hangSec });
        if (r < reps - 1) seq.push({ phase: 'Pause', seconds: restSec });
      }
      if (s < sets - 1) seq.push({ phase: 'Satzpause', seconds: restBetweenSec });
    }
  } else {
    const { hangSec, restSec, sets } = opts;
    for (let s = 0; s < sets; s++) {
      seq.push({ phase: 'Hang', seconds: hangSec });
      if (s < sets - 1) seq.push({ phase: 'Pause', seconds: restSec });
    }
  }
  return seq;
}

/* ---------- Übungsdatenbank ----------
   Eine Liste für alles: Log-Einträge, Trainingsplan-Vorlagen UND die
   Zubehör-Auswahl bei Challenges. `pauseFriendly: true` markiert Übungen,
   die sich in Fingerboard-Pausen machen lassen (kein Langhantel-Rack nötig)
   — genau diese Teilmenge wird bei Challenges angeboten
   (siehe ACCESSORY_EXERCISES unten). */
const EXERCISE_LIBRARY = [
  // Zug
  { id: 'pullup', name: 'Klimmzug', category: 'zug' },
  { id: 'pullup_weighted', name: 'Klimmzug mit Zusatzgewicht', category: 'zug' },
  { id: 'lat_pulldown', name: 'Latzug', category: 'zug' },
  { id: 'lat_pulldown_single', name: 'Latzug einarmig', category: 'zug' },
  { id: 'row_cable', name: 'Rudern Kabel', category: 'zug' },
  { id: 'row_barbell', name: 'Rudern Langhantel', category: 'zug' },
  // Antagonisten
  { id: 'face_pull', name: 'Face Pulls', category: 'antagonist', pauseFriendly: true },
  { id: 'ext_rotation', name: 'Aussenrotation Kabel', category: 'antagonist', pauseFriendly: true },
  { id: 'wrist_ext', name: 'Reverse Wrist Curls', category: 'antagonist', pauseFriendly: true },
  { id: 'y_t_w', name: 'Y-T-W-Raises', category: 'antagonist', pauseFriendly: true },
  { id: 'scapula_pull', name: 'Scapula Pulls', category: 'antagonist', pauseFriendly: true },
  { id: 'band_pull_apart', name: 'Band Pull-Apart', category: 'antagonist', pauseFriendly: true },
  // Rumpf
  { id: 'pallof', name: 'Pallof Press', category: 'rumpf', pauseFriendly: true },
  { id: 'crunches', name: 'Crunches', category: 'rumpf', pauseFriendly: true },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', category: 'rumpf', pauseFriendly: true },
  { id: 'front_lever_prog', name: 'Front-Lever-Progression', category: 'rumpf', pauseFriendly: true },
  { id: 'toes_to_bar', name: 'Toes-to-Bar', category: 'rumpf', pauseFriendly: true },
  { id: 'plank', name: 'Unterarmstütz (Plank)', category: 'rumpf', pauseFriendly: true },
  { id: 'side_plank', name: 'Seitstütz', category: 'rumpf', pauseFriendly: true },
  { id: 'russian_twist', name: 'Russian Twist', category: 'rumpf', pauseFriendly: true },
  { id: 'hollow_hold', name: 'Hollow Body Hold', category: 'rumpf', pauseFriendly: true },
  { id: 'superman', name: 'Superman', category: 'rumpf', pauseFriendly: true },
  { id: 'bird_dog', name: 'Bird Dog', category: 'rumpf', pauseFriendly: true },
  // Push
  { id: 'push_up', name: 'Liegestütz', category: 'push', pauseFriendly: true },
  { id: 'bench_press', name: 'Bankdrücken', category: 'push' },
  { id: 'ohp', name: 'Overhead Press', category: 'push' },
  { id: 'dips', name: 'Dips', category: 'push', pauseFriendly: true },
  // Beine
  { id: 'squat', name: 'Kniebeuge', category: 'beine' },
  { id: 'deadlift', name: 'Kreuzheben', category: 'beine' },
  { id: 'split_squat', name: 'Bulgarian Split Squat', category: 'beine', pauseFriendly: true },
  { id: 'calf_raise', name: 'Wadenheben', category: 'beine', pauseFriendly: true },
  { id: 'wall_sit', name: 'Wall Sit', category: 'beine', pauseFriendly: true },
  { id: 'glute_bridge', name: 'Glute Bridge', category: 'beine', pauseFriendly: true },
  // Mobilität
  { id: 'cat_cow', name: 'Katze-Kuh', category: 'mobility', pauseFriendly: true },
  { id: 'worlds_greatest_stretch', name: "World's Greatest Stretch", category: 'mobility', pauseFriendly: true },
  { id: 'hip_9090', name: 'Hüftwechsel 90/90', category: 'mobility', pauseFriendly: true },
  { id: 'thoracic_rotation', name: 'BWS-Rotation (Thread the Needle)', category: 'mobility', pauseFriendly: true },
  { id: 'shoulder_circles_band', name: 'Schulterkreisen mit Band', category: 'mobility', pauseFriendly: true },
  { id: 'wrist_mobility', name: 'Handgelenk-Mobilisation', category: 'mobility', pauseFriendly: true },
  { id: 'leg_swings', name: 'Beinschwingen', category: 'mobility', pauseFriendly: true },
  { id: 'ankle_rocks', name: 'Sprunggelenk-Mobilisation', category: 'mobility', pauseFriendly: true },
  { id: 'neck_mobility', name: 'Nacken-Mobilisation', category: 'mobility', pauseFriendly: true },
  { id: 'doorway_pec_stretch', name: 'Türrahmen-Dehnung Brust', category: 'mobility', pauseFriendly: true },
];

const ACCESSORY_EXERCISES = EXERCISE_LIBRARY.filter((e) => e.pauseFriendly);

const EXERCISE_CATEGORY_LABEL = {
  zug: 'Zug',
  antagonist: 'Antagonisten',
  push: 'Push',
  beine: 'Beine',
  rumpf: 'Rumpf',
  mobility: 'Mobilität',
};

function exerciseName(id) {
  const ex = EXERCISE_LIBRARY.find((e) => e.id === id);
  return ex ? ex.name : id;
}

/* ---------- Trainingsplan-Vorlagen ----------
   Vorgefertigte Abläufe (Übung + Sätze + Wiederholungen), die im Log als
   Ausgangspunkt geladen und danach frei angepasst werden können. */
const ROUTINE_TEMPLATES = [
  {
    id: 'gym_zug_rumpf',
    name: 'Gym — Zug & Rumpf',
    exercises: [
      { exerciseId: 'pullup_weighted', sets: 4, reps: '5' },
      { exerciseId: 'row_barbell', sets: 3, reps: '8' },
      { exerciseId: 'pallof', sets: 3, reps: '12' },
      { exerciseId: 'face_pull', sets: 3, reps: '15' },
      { exerciseId: 'wrist_ext', sets: 2, reps: '15' },
    ],
  },
  {
    id: 'gym_beine_push',
    name: 'Gym — Beine & Push',
    exercises: [
      { exerciseId: 'squat', sets: 4, reps: '6' },
      { exerciseId: 'split_squat', sets: 3, reps: '10' },
      { exerciseId: 'bench_press', sets: 3, reps: '8' },
      { exerciseId: 'ohp', sets: 3, reps: '8' },
    ],
  },
  {
    id: 'gym_ganzkoerper',
    name: 'Gym — Ganzkörper (Einsteiger)',
    exercises: [
      { exerciseId: 'deadlift', sets: 3, reps: '5' },
      { exerciseId: 'lat_pulldown', sets: 3, reps: '10' },
      { exerciseId: 'push_up', sets: 3, reps: '12' },
      { exerciseId: 'pallof', sets: 3, reps: '12' },
    ],
  },
];

/* ---------- Fingerboard-Ablauf-Vorlagen ----------
   Vorgefertigte Abläufe (Hang- + Übungs-Sätze), die im Fingerboard-Tab
   geladen werden können — siehe ROUTINE_TEMPLATES oben fürs Log-Pendant.
   `grip` verwendet bewusst nur Kategorien, die auf BEIDEN Boards existieren
   (siehe getSharedGripIds() in app.js), damit die Vorlage unabhängig vom
   eigenen Board funktioniert; `board` fehlt hier deshalb absichtlich und
   wird beim Laden auf das aktuell gewählte Board des Mitglieds gesetzt.
   Exercise-Sätze tragen zusätzlich `restSec` (Pause NACH der Übung, bevor
   der nächste Satz startet) — bei Hang-Sätzen mit nur 1 Wiederholung dient
   das Timing zwischen den Sätzen als aktive Pause (siehe fbEstimateSeconds
   in app.js). */
const FINGERBOARD_TEMPLATES = [
  {
    id: 'advanced_45min_flow',
    name: '45-Min Kraft-Flow (Fortgeschritten)',
    note: 'Aktivierung → Max Hangs → Repeater-Finish → Zweitgriff-Reiz → Cool-down. ~42 Min. reine Ablaufzeit, mit Übergängen real ca. 45 Min.',
    blocks: [
      // Phase 1 — Aktivierung: allgemeine Mobilität, dann ansteigende Hangs
      // bis knapp an die Arbeitsintensität (verhindert kalte Finger/Rolluli-Belastung).
      { type: 'exercise', exerciseId: 'shoulder_circles_band', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'wrist_mobility', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'thoracic_rotation', reps: 8, restSec: 0 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 3, hangSec: 7, restSec: 30 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 3, hangSec: 7, restSec: 45 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 2, hangSec: 8, restSec: 60 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 1, hangSec: 10, restSec: 0 },

      // Phase 2 — Max Hangs auf dem Hauptgriff (edge_small): 6×10s nahe
      // Maximalkraft, volle 2:30 Pause pro Satz — genutzt für leichte,
      // nicht-ermüdende Schulter-/Rumpfarbeit statt komplett passiv zu warten.
      { type: 'hang', board: null, grip: 'edge_small', reps: 1, hangSec: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'face_pull', reps: 12, restSec: 150 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 1, hangSec: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'band_pull_apart', reps: 15, restSec: 150 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 1, hangSec: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'scapula_pull', reps: 10, restSec: 150 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 1, hangSec: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'pallof', reps: 10, restSec: 150 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 1, hangSec: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'bird_dog', reps: 8, restSec: 150 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 1, hangSec: 10, restSec: 0 },

      // Phase 3 — Repeater-Finish auf grossem Griff (Arbeitskapazität statt
      // Maximalkraft, deshalb bewusst ein einfacherer Griff bei Vorermüdung).
      { type: 'hang', board: null, grip: 'edge_large', reps: 6, hangSec: 7, restSec: 3 },
      { type: 'exercise', exerciseId: 'plank', reps: 30, restSec: 180 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 6, hangSec: 7, restSec: 3 },

      // Phase 4 — Zweitgriff-Reiz (Spezifität): andere Griffart, damit die
      // Session nicht nur eine einzige Kante trainiert.
      { type: 'hang', board: null, grip: 'pocket3', reps: 1, hangSec: 7, restSec: 0 },
      { type: 'exercise', exerciseId: 'hollow_hold', reps: 20, restSec: 100 },
      { type: 'hang', board: null, grip: 'pocket3', reps: 1, hangSec: 7, restSec: 0 },
      { type: 'exercise', exerciseId: 'russian_twist', reps: 16, restSec: 100 },
      { type: 'hang', board: null, grip: 'pocket3', reps: 1, hangSec: 7, restSec: 0 },
      { type: 'exercise', exerciseId: 'side_plank', reps: 20, restSec: 100 },
      { type: 'hang', board: null, grip: 'pocket3', reps: 1, hangSec: 7, restSec: 0 },
      { type: 'exercise', exerciseId: 'superman', reps: 12, restSec: 100 },
      { type: 'hang', board: null, grip: 'pocket3', reps: 1, hangSec: 7, restSec: 0 },

      // Phase 5 — Cool-down: kurze, gezielte Mobilisation/Dehnung.
      { type: 'exercise', exerciseId: 'doorway_pec_stretch', reps: 1, restSec: 0 },
      { type: 'exercise', exerciseId: 'cat_cow', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'wrist_ext', reps: 12, restSec: 0 },
      { type: 'exercise', exerciseId: 'leg_swings', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'neck_mobility', reps: 8, restSec: 0 },
    ],
  },
  {
    id: 'beginner_edge_flow',
    name: 'Einsteiger-Flow — Grosse Kante',
    note: 'Kurze, submaximale Hangs auf der grössten (sichersten) Kante statt Max Hangs — Fokus auf sauberer Technik und Sehnen-Gewöhnung, nicht auf Maximalkraft. ~20 Min.',
    blocks: [
      // Phase 1 — Aktivierung
      { type: 'exercise', exerciseId: 'wrist_mobility', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'shoulder_circles_band', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'thoracic_rotation', reps: 8, restSec: 0 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 3, hangSec: 5, restSec: 30 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 3, hangSec: 6, restSec: 30 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 2, hangSec: 7, restSec: 40 },

      // Phase 2 — Hauptblock: submaximale Einzel-Hangs, dazwischen leichte,
      // nicht ermüdende Schulter-/Rumpfarbeit statt komplett passiver Pause.
      { type: 'hang', board: null, grip: 'edge_large', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'face_pull', reps: 10, restSec: 60 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'band_pull_apart', reps: 12, restSec: 60 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'pallof', reps: 10, restSec: 60 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'bird_dog', reps: 8, restSec: 60 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'ext_rotation', reps: 10, restSec: 60 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 1, hangSec: 6, restSec: 0 },

      // Phase 3 — Ergänzung ohne Griffbrett
      { type: 'exercise', exerciseId: 'plank', reps: 20, restSec: 30 },
      { type: 'exercise', exerciseId: 'glute_bridge', reps: 12, restSec: 30 },
      { type: 'exercise', exerciseId: 'hollow_hold', reps: 15, restSec: 30 },
      { type: 'exercise', exerciseId: 'calf_raise', reps: 15, restSec: 0 },

      // Phase 4 — Cool-down
      { type: 'exercise', exerciseId: 'cat_cow', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'doorway_pec_stretch', reps: 1, restSec: 0 },
      { type: 'exercise', exerciseId: 'wrist_ext', reps: 12, restSec: 0 },
    ],
  },
  {
    id: 'beginner_sloper_flow',
    name: 'Einsteiger-Flow — mit Sloper',
    note: 'Slopers trainieren Körperspannung und Griffkraft über die offene Hand statt über die Fingerscheiben — schonender Einstieg als kleine Kanten/Taschen. ~20 Min.',
    blocks: [
      // Phase 1 — Aktivierung, kurzer Primer auf der sicheren Kante
      { type: 'exercise', exerciseId: 'wrist_mobility', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'shoulder_circles_band', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'thoracic_rotation', reps: 8, restSec: 0 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 3, hangSec: 5, restSec: 30 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 2, hangSec: 6, restSec: 40 },

      // Phase 2 — Hauptblock Sloper 20° (offene Hand, Körperspannung).
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'face_pull', reps: 10, restSec: 60 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'scapula_pull', reps: 10, restSec: 60 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'pallof', reps: 10, restSec: 60 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'bird_dog', reps: 8, restSec: 60 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },

      // Phase 3 — Zweitgriff-Reiz: Sloper 35°, etwas steiler, kürzere Sätze.
      { type: 'hang', board: null, grip: 'sloper_medium', reps: 1, hangSec: 5, restSec: 0 },
      { type: 'exercise', exerciseId: 'hollow_hold', reps: 15, restSec: 50 },
      { type: 'hang', board: null, grip: 'sloper_medium', reps: 1, hangSec: 5, restSec: 0 },
      { type: 'exercise', exerciseId: 'russian_twist', reps: 14, restSec: 50 },
      { type: 'hang', board: null, grip: 'sloper_medium', reps: 1, hangSec: 5, restSec: 0 },

      // Phase 4 — Ergänzung ohne Griffbrett
      { type: 'exercise', exerciseId: 'glute_bridge', reps: 12, restSec: 30 },
      { type: 'exercise', exerciseId: 'calf_raise', reps: 15, restSec: 0 },

      // Phase 5 — Cool-down
      { type: 'exercise', exerciseId: 'cat_cow', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'doorway_pec_stretch', reps: 1, restSec: 0 },
      { type: 'exercise', exerciseId: 'wrist_ext', reps: 12, restSec: 0 },
    ],
  },
];

/* ---------- Standard-Wochenplan (Startvorlage) ----------
   Wird pro Mitglied einmalig nach Firebase kopiert und ist dort danach
   frei editierbar (siehe app.js renderPlan). */
const DEFAULT_WEEK_PLAN = [
  { day: 'Mo', title: 'Bouldern Halle', tag: 'skill' },
  { day: 'Di', title: 'Gym — Zug & Rumpf', tag: 'gym' },
  { day: 'Mi', title: 'Ruhetag / Mobility', tag: 'ruhe' },
  { day: 'Do', title: 'Fingerboard 15’', tag: 'finger' },
  { day: 'Fr', title: 'Bouldern Halle', tag: 'skill' },
  { day: 'Sa', title: 'Gym — Beine & Push', tag: 'gym' },
  { day: 'So', title: 'Ruhetag', tag: 'ruhe' },
];

const TAG_LABEL = {
  skill: 'SKILL',
  gym: 'GYM',
  finger: 'FINGER',
  ruhe: 'RUHE',
};

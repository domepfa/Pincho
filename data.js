/* ================================================================
   data.js — statische Konfiguration: Boards, Protokolle, Übungen.
   Keine Firebase-Zugriffe hier, nur reine Daten.
   ================================================================= */

/* ---------- Beastmaker-Boards ----------
   Griffe sind bewusst als KATEGORIEN modelliert, nicht als exakte mm-Werte:
   so bleibt der Vergleich zwischen BM1000 und BM2000 sinnvoll, auch wenn
   die beiden Boards nicht identische Kantentiefen haben.

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
    // x-Werte auf die vertikale Mittelachse (50%) hin symmetrisiert: die
    // Griffe sind entweder genau mittig (ein einzelner Hotspot) oder
    // spiegelverkehrt gleich weit von der Mitte weg (ein Paar) — das reine
    // Antipp-Kalibrieren war hier leicht ungenau, das Brett selbst ist exakt
    // symmetrisch (gleiche Idee wie schon bei der Zeilenhöhe/y korrigiert).
    hotspots: [
      { grip: 'jug', x: 15, y: 23.6 },
      { grip: 'jug', x: 85, y: 23.6 },
      { grip: 'sloper_medium', x: 29.85, y: 30.9 },
      { grip: 'sloper_medium', x: 70.15, y: 30.9 },
      { grip: 'sloper_easy', x: 43.55, y: 28.3 },
      { grip: 'sloper_easy', x: 56.45, y: 28.3 },
      { grip: 'edge_xsmall', x: 14, y: 37.6 },
      { grip: 'edge_xsmall', x: 86, y: 37.6 },
      { grip: 'edge3', x: 44.3, y: 37.3 },
      { grip: 'edge3', x: 55.7, y: 37.3 },
      { grip: 'edge_medium', x: 10.85, y: 51.4 },
      { grip: 'edge_medium', x: 89.15, y: 51.4 },
      { grip: 'pocket2_deep', x: 75.6, y: 52 },
      { grip: 'pocket2_deep', x: 24.4, y: 52 },
      { grip: 'pocket3_deep', x: 34, y: 52.5 },
      { grip: 'pocket3_deep', x: 66, y: 52.5 },
      { grip: 'edge_large', x: 50, y: 50.7 },
      { grip: 'edge_small', x: 80.9, y: 67.4 },
      { grip: 'edge_small', x: 19.1, y: 67.4 },
      { grip: 'pocket2', x: 67.2, y: 68.3 },
      { grip: 'pocket2', x: 32.8, y: 68.3 },
      { grip: 'pocket3', x: 56.45, y: 68.6 },
      { grip: 'pocket3', x: 43.55, y: 68.6 },
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
    // Siehe Kommentar bei bm1000 — gleiche Vorgehensweise. pocket3/
    // pocket3_small sind zwar unterschiedliche Griffgrössen, sitzen aber
    // als Paar auf gleicher Zeile/Höhe (deshalb auch deren y aneinander
    // angeglichen), genau wie ein normales gleichnamiges Paar.
    hotspots: [
      { grip: 'sloper_easy', x: 43.25, y: 25.9 },
      { grip: 'sloper_easy', x: 56.75, y: 25.9 },
      { grip: 'sloper_medium', x: 28.55, y: 30.3 },
      { grip: 'sloper_medium', x: 71.45, y: 30.3 },
      { grip: 'sloper_hard', x: 12, y: 28.7 },
      { grip: 'sloper_hard', x: 88, y: 28.7 },
      { grip: 'edge_medium', x: 12.75, y: 50.4 },
      { grip: 'edge_medium', x: 87.25, y: 50.4 },
      { grip: 'mono', x: 22.9, y: 49.7 },
      { grip: 'mono', x: 77.1, y: 49.7 },
      { grip: 'pocket2_offset', x: 29.6, y: 48.8 },
      { grip: 'pocket2_offset', x: 70.4, y: 48.8 },
      { grip: 'pocket2', x: 38.35, y: 49.3 },
      { grip: 'pocket2', x: 61.65, y: 49.3 },
      { grip: 'edge_large', x: 50, y: 49.5 },
      { grip: 'edge_xsmall', x: 13.75, y: 67.1 },
      { grip: 'edge_xsmall', x: 86.25, y: 67.1 },
      { grip: 'mono_small', x: 23.05, y: 68.2 },
      { grip: 'mono_small', x: 76.95, y: 68.2 },
      { grip: 'pocket2_small', x: 29.75, y: 67.4 },
      { grip: 'pocket2_small', x: 70.25, y: 67.4 },
      { grip: 'pocket2_small', x: 38.1, y: 68 },
      { grip: 'pocket2_small', x: 61.9, y: 68 },
      { grip: 'pocket3', x: 43.65, y: 37 },
      { grip: 'pocket3_small', x: 56.35, y: 37 },
      { grip: 'edge_small', x: 50, y: 69.7 },
    ],
  },
};

/* ---------- Campus-Board ----------
   Anders als beim Hangboard geht es hier nicht um exakte Griff-Positionen
   (die Sprossen sind ohnehin durchnummeriert und immer in einer Spalte) —
   deshalb kein Foto-Hotspot-Picker wie bei BOARDS, sondern nur der
   Sprossen-TYP (unterschiedliche Leisten-/Sprossengrössen = unterschiedlich
   schwer) plus die Bewegung als Zahlen (siehe app.js, Satz-Typ 'campus'). */
const CAMPUS_BOARD_IMAGE = './assets/board-campus.jpg';
/* lineX/lineX2 (% von Bildbreite, siehe assets/board-campus.jpg): markiert
   im Referenzbild per Strich, welche Spalte gemeint ist — bei den Kugeln
   zwei Striche, da deren Löcher im Zickzack (zwei versetzte Spalten) statt
   einer geraden Reihe angeordnet sind. Anordnung der vier Kugel-Spalten
   von links nach rechts: gross/klein/klein/gross (aussen = gross, innen =
   klein) — bei Bedarf über die Kalibrier-Anzeige direkt am Referenzbild
   nachjustierbar. */
const CAMPUS_RUNG_TYPES = [
  { id: 'rundleiste_gross', label: 'Rundleiste gross', lineX: 7 },
  { id: 'kugel_gross', label: 'Kugel gross', lineX: 19.5, lineX2: 31.5 },
  { id: 'kugel_klein', label: 'Kugel klein', lineX: 23, lineX2: 28 },
  { id: 'leiste_35', label: 'Leiste 35', lineX: 44 },
  { id: 'leiste_27', label: 'Leiste 27', lineX: 60 },
  { id: 'leiste_19', label: 'Leiste 19', lineX: 77 },
  { id: 'leiste_gross', label: 'Leiste gross', lineX: 93.5 },
];
function campusRungLabel(rungTypeId) {
  const t = CAMPUS_RUNG_TYPES.find((r) => r.id === rungTypeId);
  return t ? t.label : rungTypeId;
}

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

/* ---------- Übungsdatenbank ----------
   Eine Liste für alles: Log-Einträge, Trainingsplan-Vorlagen UND die
   Übungs-Blöcke im Fingerboard-Ablauf. `pauseFriendly: true` markiert
   Übungen, die sich in Fingerboard-Pausen machen lassen (kein
   Langhantel-Rack nötig) — genau diese Teilmenge steht dort zur Auswahl
   (siehe ACCESSORY_EXERCISES unten). */
/* `muscles` (primary/secondary) sind allgemeines Trainingswissen, keine
   erfundenen Produktdaten — welche Muskelgruppe eine Standardübung wie
   Klimmzug oder Kniebeuge beansprucht, ist Lehrbuchstoff. Zone-Ids
   beziehen sich auf MUSCLE_ZONES_SVG/MUSCLE_ZONE_LABEL in app.js. */
const EXERCISE_LIBRARY = [
  // Zug
  { id: 'pullup', name: 'Klimmzug', category: 'zug', muscles: { primary: ['lats'], secondary: ['biceps', 'forearms_front'] } },
  { id: 'pullup_weighted', name: 'Klimmzug mit Zusatzgewicht', category: 'zug', muscles: { primary: ['lats'], secondary: ['biceps', 'forearms_front'] } },
  { id: 'lat_pulldown', name: 'Latzug', category: 'zug', muscles: { primary: ['lats'], secondary: ['biceps', 'rear_delts'] } },
  { id: 'lat_pulldown_single', name: 'Latzug einarmig', category: 'zug', muscles: { primary: ['lats'], secondary: ['biceps', 'obliques'] } },
  { id: 'row_cable', name: 'Rudern Kabel', category: 'zug', muscles: { primary: ['lats', 'traps'], secondary: ['biceps', 'rear_delts'] } },
  { id: 'row_barbell', name: 'Rudern Langhantel', category: 'zug', muscles: { primary: ['lats', 'traps'], secondary: ['biceps', 'lower_back'] } },
  // Antagonisten
  { id: 'face_pull', name: 'Face Pulls', category: 'antagonist', pauseFriendly: true, muscles: { primary: ['rear_delts', 'traps'], secondary: ['forearms_back'] } },
  { id: 'ext_rotation', name: 'Aussenrotation Kabel', category: 'antagonist', pauseFriendly: true, muscles: { primary: ['rear_delts'], secondary: [] } },
  { id: 'wrist_ext', name: 'Reverse Wrist Curls', category: 'antagonist', pauseFriendly: true, muscles: { primary: ['forearms_back'], secondary: [] } },
  { id: 'y_t_w', name: 'Y-T-W-Raises', category: 'antagonist', pauseFriendly: true, muscles: { primary: ['rear_delts', 'traps'], secondary: ['lats'] } },
  { id: 'scapula_pull', name: 'Scapula Pulls', category: 'antagonist', pauseFriendly: true, muscles: { primary: ['traps', 'lats'], secondary: ['rear_delts'] } },
  { id: 'band_pull_apart', name: 'Band Pull-Apart', category: 'antagonist', pauseFriendly: true, muscles: { primary: ['rear_delts', 'traps'], secondary: [] } },
  { id: 'reverse_butterfly', name: 'Reverse Butterfly', category: 'antagonist', muscles: { primary: ['rear_delts'], secondary: ['traps'] } },
  // Rumpf
  { id: 'pallof', name: 'Pallof Press', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['obliques', 'abs'], secondary: [] } },
  { id: 'crunches', name: 'Crunches', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['abs'], secondary: [] } },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['abs'], secondary: ['obliques', 'forearms_front'] } },
  { id: 'front_lever_prog', name: 'Front-Lever-Progression', category: 'rumpf', pauseFriendly: true, isHold: true, muscles: { primary: ['lats', 'abs'], secondary: ['shoulders', 'forearms_front'] } },
  { id: 'toes_to_bar', name: 'Toes-to-Bar', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['abs'], secondary: ['lats', 'forearms_front'] } },
  { id: 'plank', name: 'Unterarmstütz (Plank)', category: 'rumpf', pauseFriendly: true, isHold: true, muscles: { primary: ['abs'], secondary: ['obliques', 'shoulders'] } },
  { id: 'side_plank', name: 'Seitstütz', category: 'rumpf', pauseFriendly: true, isHold: true, muscles: { primary: ['obliques'], secondary: ['abs'] } },
  { id: 'russian_twist', name: 'Russian Twist', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['obliques'], secondary: ['abs'] } },
  { id: 'hollow_hold', name: 'Hollow Body Hold', category: 'rumpf', pauseFriendly: true, isHold: true, muscles: { primary: ['abs'], secondary: ['obliques'] } },
  { id: 'superman', name: 'Superman', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['lower_back'], secondary: ['glutes'] } },
  { id: 'bird_dog', name: 'Bird Dog', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['lower_back', 'abs'], secondary: ['glutes'] } },
  { id: 'swimmer', name: 'Schwimmer', category: 'rumpf', pauseFriendly: true, muscles: { primary: ['lower_back'], secondary: ['glutes', 'shoulders'] } },
  { id: 'back_extension', name: 'Backextension', category: 'rumpf', muscles: { primary: ['lower_back'], secondary: ['glutes', 'hamstrings'] } },
  // Push
  { id: 'push_up', name: 'Liegestütz', category: 'push', pauseFriendly: true, muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] } },
  { id: 'bench_press', name: 'Bankdrücken', category: 'push', muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] } },
  { id: 'incline_bench_press', name: 'Schrägbankdrücken', category: 'push', muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] } },
  { id: 'ohp', name: 'Overhead Press', category: 'push', muscles: { primary: ['shoulders'], secondary: ['triceps'] } },
  { id: 'dips', name: 'Dips', category: 'push', pauseFriendly: true, muscles: { primary: ['chest', 'triceps'], secondary: ['shoulders'] } },
  { id: 'butterfly', name: 'Butterfly', category: 'push', muscles: { primary: ['chest'], secondary: ['shoulders'] } },
  { id: 'triceps_extension', name: 'Trizepsstrecker', category: 'push', muscles: { primary: ['triceps'], secondary: [] } },
  // Beine
  { id: 'squat', name: 'Kniebeuge', category: 'beine', muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] } },
  { id: 'deadlift', name: 'Kreuzheben', category: 'beine', muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back'] } },
  { id: 'rdl', name: 'Romanian Deadlift', category: 'beine', muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back'] } },
  { id: 'zercher_squat_rotation', name: 'Zerchersquat in Rotation', category: 'beine', muscles: { primary: ['quads', 'obliques'], secondary: ['glutes', 'abs'] } },
  { id: 'split_squat', name: 'Bulgarian Split Squat', category: 'beine', pauseFriendly: true, muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] } },
  { id: 'leg_extension', name: 'Beinstrecker', category: 'beine', muscles: { primary: ['quads'], secondary: [] } },
  { id: 'leg_curl_lying', name: 'Beinbieger im Liegen', category: 'beine', muscles: { primary: ['hamstrings'], secondary: [] } },
  { id: 'hip_abduction_cable', name: 'Abduktion am Kabel', category: 'beine', muscles: { primary: ['glutes'], secondary: [] } },
  { id: 'calf_raise', name: 'Wadenheben', category: 'beine', pauseFriendly: true, muscles: { primary: ['calves'], secondary: [] } },
  { id: 'calf_raise_machine', name: 'Wadenheben Maschine', category: 'beine', muscles: { primary: ['calves'], secondary: [] } },
  { id: 'calf_raise_seated', name: 'Wadenheben sitzend', category: 'beine', muscles: { primary: ['calves'], secondary: [] } },
  { id: 'tibialis_raise', name: 'Tibialis Raise', category: 'beine', pauseFriendly: true, muscles: { primary: ['shins'], secondary: [] } },
  { id: 'wall_sit', name: 'Wall Sit', category: 'beine', pauseFriendly: true, isHold: true, muscles: { primary: ['quads'], secondary: [] } },
  { id: 'glute_bridge', name: 'Glute Bridge', category: 'beine', pauseFriendly: true, muscles: { primary: ['glutes'], secondary: ['hamstrings'] } },
  // Mobilität
  { id: 'cat_cow', name: 'Katze-Kuh', category: 'mobility', pauseFriendly: true, muscles: { primary: ['lower_back'], secondary: ['abs'] } },
  { id: 'worlds_greatest_stretch', name: "World's Greatest Stretch", category: 'mobility', pauseFriendly: true, muscles: { primary: ['hamstrings', 'obliques'], secondary: ['quads'] } },
  { id: 'hip_9090', name: 'Hüftwechsel 90/90', category: 'mobility', pauseFriendly: true, muscles: { primary: ['glutes'], secondary: [] } },
  { id: 'thoracic_rotation', name: 'BWS-Rotation (Thread the Needle)', category: 'mobility', pauseFriendly: true, muscles: { primary: ['lats'], secondary: ['obliques'] } },
  { id: 'shoulder_circles_band', name: 'Schulterkreisen mit Band', category: 'mobility', pauseFriendly: true, muscles: { primary: ['shoulders'], secondary: ['rear_delts'] } },
  { id: 'wrist_mobility', name: 'Handgelenk-Mobilisation', category: 'mobility', pauseFriendly: true, muscles: { primary: ['forearms_front'], secondary: ['forearms_back'] } },
  { id: 'leg_swings', name: 'Beinschwingen', category: 'mobility', pauseFriendly: true, muscles: { primary: ['hamstrings'], secondary: ['quads'] } },
  { id: 'ankle_rocks', name: 'Sprunggelenk-Mobilisation', category: 'mobility', pauseFriendly: true, muscles: { primary: ['calves'], secondary: [] } },
  { id: 'neck_mobility', name: 'Nacken-Mobilisation', category: 'mobility', pauseFriendly: true, muscles: { primary: ['neck_traps'], secondary: [] } },
  { id: 'doorway_pec_stretch', name: 'Türrahmen-Dehnung Brust', category: 'mobility', pauseFriendly: true, muscles: { primary: ['chest'], secondary: ['shoulders'] } },
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

function exerciseMuscles(id) {
  const ex = EXERCISE_LIBRARY.find((e) => e.id === id);
  return (ex && ex.muscles) || { primary: [], secondary: [] };
}

/* Isometrische Halte-Übungen (Plank, Wall Sit, ...) — dort ist die Wdh.-
   Zahl in Wirklichkeit eine Haltedauer in Sekunden, deshalb bekommen sie
   im Log einen Timer statt eines reinen Zahlenfelds. */
function exerciseIsHold(id) {
  const ex = EXERCISE_LIBRARY.find((e) => e.id === id);
  return !!(ex && ex.isHold);
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
   `grip` verwendet bewusst nur Kategorien, die auf BEIDEN Boards existieren,
   damit die Vorlage unabhängig vom eigenen Board funktioniert; `board`
   fehlt hier deshalb absichtlich und
   wird beim Laden auf das aktuell gewählte Board des Mitglieds gesetzt.
   Exercise-Sätze tragen zusätzlich `restSec` (Pause NACH der Übung, bevor
   der nächste Satz startet) — bei Hang-Sätzen mit nur 1 Wiederholung dient
   das Timing zwischen den Sätzen als aktive Pause (siehe fbEstimateSeconds
   in app.js). */
/* ---------- Pausen-Philosophie in den Hang-Sätzen unten ----------
   Nicht überall dieselbe Pausenlänge — je nach Zweck:
   - Aufwärm-Rampe (submaximal, Muskeltemperatur/Sehnen aktivieren): KURZ,
     10-25s reichen, da nichts erschöpft wird, das sich erst erholen muss.
   - Submaximale Arbeitssätze (Einsteiger — Sehnen-Gewöhnung, nicht
     Maximalkraft): MODERAT, ~45s — genug für ordentliche Erholung ohne die
     3-Minuten-Pausen zu brauchen, die nur bei echten Maximalversuchen
     sinnvoll sind.
   - Max Hangs (nahe am Limit, Fortgeschrittene): LANG, 2:30-3:00 — volle
     ATP-CP-Regeneration zwischen nahezu maximalen Einzelversuchen.
   - Repeater (7/3-Protokoll): die kurze 3s-Pause GEHÖRT zum Protokoll
     (simuliert Ausschütteln am Fels), dafür lange Pause zwischen den
     Sätzen selbst. */
const FINGERBOARD_TEMPLATES = [
  {
    id: 'advanced_45min_flow',
    name: '45-Min Kraft-Flow (Fortgeschritten)',
    note: 'Aktivierung → Max Hangs → Repeater-Finish → Zweitgriff-Reiz → Cool-down. ~40 Min. reine Ablaufzeit, mit Übergängen real ca. 45 Min.',
    blocks: [
      // Phase 1 — Aktivierung: allgemeine Mobilität, dann ansteigende Hangs
      // bis knapp an die Arbeitsintensität. Kurze Pausen (submaximal, es
      // gibt hier nichts "voll" zu regenerieren).
      { type: 'exercise', exerciseId: 'shoulder_circles_band', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'wrist_mobility', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'thoracic_rotation', reps: 8, restSec: 0 },
      { type: 'hang', board: null, grip: 'edge_large', reps: 3, hangSec: 7, restSec: 15 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 3, hangSec: 7, restSec: 20 },
      { type: 'hang', board: null, grip: 'edge_small', reps: 2, hangSec: 8, restSec: 25 },
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
    name: 'Einsteiger-Flow — Kante (beidarmig)',
    note: 'Kurze, submaximale Hangs auf einer beidhändig belegten Kante (bewusst KEINE Einhand-Positionen — die sind Expertenlevel) statt Max Hangs — Fokus auf sauberer Technik und Sehnen-Gewöhnung. ~18 Min.',
    blocks: [
      // Phase 1 — Aktivierung: kurze Pausen, da submaximal.
      { type: 'exercise', exerciseId: 'wrist_mobility', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'shoulder_circles_band', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'thoracic_rotation', reps: 8, restSec: 0 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 3, hangSec: 5, restSec: 12 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 3, hangSec: 6, restSec: 15 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 2, hangSec: 7, restSec: 20 },

      // Phase 2 — Hauptblock: submaximale Einzel-Hangs, ~45s moderate Pause
      // (genug Erholung für submaximale Reize, keine Max-Hang-Pausen nötig),
      // dazwischen leichte, nicht ermüdende Schulter-/Rumpfarbeit.
      { type: 'hang', board: null, grip: 'edge_medium', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'face_pull', reps: 10, restSec: 45 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'band_pull_apart', reps: 12, restSec: 45 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'pallof', reps: 10, restSec: 45 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'bird_dog', reps: 8, restSec: 45 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'ext_rotation', reps: 10, restSec: 45 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 1, hangSec: 6, restSec: 0 },

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
    note: 'Slopers trainieren Körperspannung und Griffkraft über die offene, beidhändig belegte Hand statt über die Fingerscheiben — schonender Einstieg als kleine Kanten/Taschen. ~16 Min.',
    blocks: [
      // Phase 1 — Aktivierung, kurzer Primer auf einer beidhändigen Kante
      { type: 'exercise', exerciseId: 'wrist_mobility', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'shoulder_circles_band', reps: 10, restSec: 0 },
      { type: 'exercise', exerciseId: 'thoracic_rotation', reps: 8, restSec: 0 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 3, hangSec: 5, restSec: 12 },
      { type: 'hang', board: null, grip: 'edge_medium', reps: 2, hangSec: 6, restSec: 15 },

      // Phase 2 — Hauptblock Sloper 20° (offene Hand, Körperspannung),
      // ~45s moderate Pause statt Max-Hang-Pausen (submaximaler Reiz).
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'face_pull', reps: 10, restSec: 45 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'scapula_pull', reps: 10, restSec: 45 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'pallof', reps: 10, restSec: 45 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },
      { type: 'exercise', exerciseId: 'bird_dog', reps: 8, restSec: 45 },
      { type: 'hang', board: null, grip: 'sloper_easy', reps: 1, hangSec: 6, restSec: 0 },

      // Phase 3 — Zweitgriff-Reiz: Sloper 35°, etwas steiler, kürzere Sätze.
      { type: 'hang', board: null, grip: 'sloper_medium', reps: 1, hangSec: 5, restSec: 0 },
      { type: 'exercise', exerciseId: 'hollow_hold', reps: 15, restSec: 40 },
      { type: 'hang', board: null, grip: 'sloper_medium', reps: 1, hangSec: 5, restSec: 0 },
      { type: 'exercise', exerciseId: 'russian_twist', reps: 14, restSec: 40 },
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

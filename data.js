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

   Die Freitext-"note" pro Griff (exakte mm-Angabe) bitte einmal am eigenen
   Board ablesen und hier eintragen — ihr habt beide Boards physisch vor Ort,
   das ist zuverlässiger als eine geschätzte Angabe. */
const BOARDS = {
  bm1000: {
    label: 'Beastmaker 1000',
    grips: [
      { id: 'jug', label: 'Jug', note: '2 Jugs oben' },
      { id: 'edge_large', label: 'Grosse Kante', note: 'mm noch eintragen' },
      { id: 'edge_medium', label: 'Mittlere Kante', note: 'mm noch eintragen' },
      { id: 'pocket4_deep', label: '4-Finger-Tasche tief', note: '' },
      { id: 'pocket4_medium', label: '4-Finger-Tasche mittel', note: '' },
      { id: 'pocket3', label: '3-Finger-Tasche', note: '' },
      { id: 'pocket2', label: '2-Finger-Tasche', note: '' },
      { id: 'sloper_easy', label: 'Sloper 20°', note: '' },
      { id: 'sloper_medium', label: 'Sloper 35°', note: '' },
    ],
  },
  bm2000: {
    label: 'Beastmaker 2000',
    grips: [
      { id: 'edge_large', label: 'Grosse Kante', note: 'mm noch eintragen' },
      { id: 'edge_medium', label: 'Mittlere Kante', note: 'mm noch eintragen' },
      { id: 'edge_small', label: 'Kleine Kante', note: 'mm noch eintragen' },
      { id: 'pocket4_deep', label: '4-Finger-Tasche tief', note: '' },
      { id: 'pocket4_medium', label: '4-Finger-Tasche mittel', note: '' },
      { id: 'pocket3', label: '3-Finger-Tasche', note: '' },
      { id: 'pocket2', label: '2-Finger-Tasche', note: '' },
      { id: 'mono', label: 'Mono-Tasche', note: '' },
      { id: 'sloper_medium', label: 'Sloper 35°', note: '' },
      { id: 'sloper_hard', label: 'Sloper 45°', note: '' },
    ],
  },
};

function gripLabel(boardId, gripId) {
  const board = BOARDS[boardId];
  const grip = board && board.grips.find((g) => g.id === gripId);
  return grip ? grip.label : gripId;
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

/* ---------- Zubehör-Übungen für Trainings-Pausen & Challenges ---------- */
const ACCESSORY_EXERCISES = [
  { id: 'face_pull', name: 'Face Pulls', category: 'antagonist' },
  { id: 'ext_rotation', name: 'Aussenrotation Kabel', category: 'antagonist' },
  { id: 'wrist_ext', name: 'Reverse Wrist Curls', category: 'antagonist' },
  { id: 'y_t_w', name: 'Y-T-W-Raises', category: 'antagonist' },
  { id: 'pallof', name: 'Pallof Press', category: 'rumpf' },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', category: 'rumpf' },
  { id: 'front_lever_prog', name: 'Front-Lever-Progression', category: 'rumpf' },
  { id: 'toes_to_bar', name: 'Toes-to-Bar', category: 'rumpf' },
  { id: 'push_up', name: 'Liegestütz / Bankdrücken', category: 'push' },
  { id: 'ohp', name: 'Overhead Press', category: 'push' },
  { id: 'dips', name: 'Dips', category: 'push' },
  { id: 'split_squat', name: 'Bulgarian Split Squat', category: 'beine' },
  { id: 'deadlift', name: 'Kreuzheben', category: 'beine' },
  { id: 'squat', name: 'Kniebeuge', category: 'beine' },
];

const EXERCISE_CATEGORY_LABEL = {
  antagonist: 'Antagonisten',
  rumpf: 'Rumpf',
  push: 'Push',
  beine: 'Beine',
};

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

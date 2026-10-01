/* ================================================================
   muscle-map.js — Zielmuskeln-Übersicht: Körperkarte (MUSCLE_ZONES_SVG,
   BODY_*), Muskel-Namen (MUSCLE_ZONE_LABEL), bodyMapSvg() und
   muscleLabelsText(). Ausgelagert aus app.js, Inhalt unverändert.
   Wird in index.html VOR app.js geladen; app.js nutzt es nur in
   Funktionen, nicht beim Laden.
   ================================================================= */

/* ---------- Zielmuskeln-Übersicht ----------
   Ein einziges, wiederverwendbares Körper-Umriss-SVG (vorne links, hinten
   rechts) mit fest definierten Zonen — pro Übung wird nur die Klasse
   (primary/secondary/inaktiv) der jeweiligen Zone umgeschaltet, das
   Bild selbst bleibt immer dasselbe. Positionen sind bewusst schematisch
   (Rechtecke/Ellipsen wie bei den Strichmännchen), keine anatomische
   Illustration. */
/* Anatomische Zonen (Beta): Vorderansicht links, Rückansicht rechts
   (um 125 nach rechts verschoben). Jede Zone ist ein Pfad, links und
   rechts gespiegelt; die Form orientiert sich grob am echten Muskel statt
   an Rechtecken. BODY_BASE_SVG ist der dunkle Körperumriss darunter,
   BODY_DECO_SVG feine Linien darüber (nicht antippbar). */
const BACK = (d) => `<path transform="translate(125 0)" d="${d}"/>`;
const FRONT = (d) => `<path d="${d}"/>`;
const MUSCLE_ZONES_SVG = {
  neck_traps: FRONT('M55 38 Q48 43 41 46 Q46 49 52 47 Q56 44 56 40 Z M65 38 Q72 43 79 46 Q74 49 68 47 Q64 44 64 40 Z'),
  shoulders: FRONT('M38 47 Q28 49 26 62 Q31 66 36 62 Q40 56 40 50 Z M82 47 Q92 49 94 62 Q89 66 84 62 Q80 56 80 50 Z'),
  chest: FRONT('M59 50 Q48 48 41 52 Q38 62 42 70 Q52 74 59 70 Z M61 50 Q72 48 79 52 Q82 62 78 70 Q68 74 61 70 Z'),
  biceps: FRONT('M34 66 Q27 70 26 82 Q27 90 31 92 Q35 84 36 72 Z M86 66 Q93 70 94 82 Q93 90 89 92 Q85 84 84 72 Z'),
  forearms_front: FRONT('M29 96 Q23 106 21 122 Q23 126 26 124 Q30 110 33 98 Z M91 96 Q97 106 99 122 Q97 126 94 124 Q90 110 87 98 Z'),
  abs: FRONT('M53 74 L67 74 Q68 96 66 116 Q60 120 54 116 Q52 96 53 74 Z'),
  obliques: FRONT('M42 74 Q41 90 44 110 Q48 114 51 112 Q50 92 51 76 Z M78 74 Q79 90 76 110 Q72 114 69 112 Q70 92 69 76 Z'),
  quads: FRONT('M44 124 Q38 148 42 174 Q47 180 53 177 Q58 152 58 128 Q52 122 44 124 Z M76 124 Q82 148 78 174 Q73 180 67 177 Q62 152 62 128 Q68 122 76 124 Z'),
  shins: FRONT('M43 190 Q40 210 43 232 Q46 236 49 234 Q52 212 51 192 Z M77 190 Q80 210 77 232 Q74 236 71 234 Q68 212 69 192 Z'),
  traps: BACK('M60 36 Q52 42 44 48 Q52 58 60 66 Z M60 36 Q68 42 76 48 Q68 58 60 66 Z'),
  rear_delts: BACK('M38 47 Q28 49 26 62 Q31 66 36 62 Q40 56 40 50 Z M82 47 Q92 49 94 62 Q89 66 84 62 Q80 56 80 50 Z'),
  lats: BACK('M58 66 Q48 58 42 58 Q40 74 45 96 Q52 102 58 98 Z M62 66 Q72 58 78 58 Q80 74 75 96 Q68 102 62 98 Z'),
  triceps: BACK('M34 66 Q27 70 26 82 Q27 90 31 92 Q35 84 36 72 Z M86 66 Q93 70 94 82 Q93 90 89 92 Q85 84 84 72 Z'),
  forearms_back: BACK('M29 96 Q23 106 21 122 Q23 126 26 124 Q30 110 33 98 Z M91 96 Q97 106 99 122 Q97 126 94 124 Q90 110 87 98 Z'),
  lower_back: BACK('M54 100 L66 100 L66 116 Q60 119 54 116 Z'),
  glutes: BACK('M59 118 Q47 116 42 126 Q43 140 58 140 Z M61 118 Q73 116 78 126 Q77 140 62 140 Z'),
  hamstrings: BACK('M44 144 Q39 162 42 178 Q48 182 54 178 Q57 160 57 144 Z M76 144 Q81 162 78 178 Q72 182 66 178 Q63 160 63 144 Z'),
  calves: BACK('M43 188 Q38 204 43 222 Q47 226 51 222 Q55 204 51 188 Z M77 188 Q82 204 77 222 Q73 226 69 222 Q65 204 69 188 Z'),
};
const BODY_FIGURE_BASE = `
  <ellipse cx="60" cy="20" rx="10" ry="12"/>
  <path d="M55 30 L65 30 L66 40 L54 40 Z"/>
  <path d="M40 44 Q60 38 80 44 Q84 60 80 76 L78 120 Q60 128 42 120 L40 76 Q36 60 40 44 Z"/>
  <path d="M38 48 Q26 50 24 66 L20 96 Q16 116 17 130 Q20 140 25 136 Q28 120 32 100 L37 70 Z M82 48 Q94 50 96 66 L100 96 Q104 116 103 130 Q100 140 95 136 Q92 120 88 100 L83 70 Z"/>
  <path d="M42 120 Q36 150 40 184 Q38 210 42 240 L50 244 Q54 214 53 186 Q58 152 59 124 Z M78 120 Q84 150 80 184 Q82 210 78 240 L70 244 Q66 214 67 186 Q62 152 61 124 Z"/>`;
const BODY_BASE_SVG = `<g class="body-base">${BODY_FIGURE_BASE}<g transform="translate(125 0)">${BODY_FIGURE_BASE}</g></g>`;
const BODY_DECO_SVG = '<path class="body-deco" d="M53 86 L67 86 M53 98 L67 98 M60 74 L60 116"/>';
const BODY_VIEWBOX = '0 0 245 250';

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
    <svg viewBox="${BODY_VIEWBOX}" class="muscle-map">
      ${BODY_BASE_SVG}
      ${zones}
      ${BODY_DECO_SVG}
    </svg>
  `;
}

function muscleLabelsText(primary, secondary) {
  const p = primary.map((id) => MUSCLE_ZONE_LABEL[id] || id);
  const s = secondary.map((id) => MUSCLE_ZONE_LABEL[id] || id);
  if (!p.length && !s.length) return '';
  return s.length ? `${p.join(', ')} (+ ${s.join(', ')})` : p.join(', ');
}

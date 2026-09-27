/* Faultier-Gliederpuppe: setzt die Figur aus Einzelteilen (assets/sloth/rig,
   erzeugt von tools/sloth-rig/build.py) zusammen und stellt sie per Winkel.

   Eine Pose hat zwei Endstellungen a und b (Weltwinkel je Knochen in Grad,
   0° = nach rechts, 90° = nach unten) und pendelt a -> b -> a. Daraus werden
   einmalig CSS-Keyframes gerechnet; die Figur selbst ist ein statisches SVG,
   das sich per innerHTML einsetzen lässt und ohne JS-Schleife animiert. */

const SLOTH_RIG_BASE = '../assets/sloth/rig/';

/* PARTS:BEGIN */
const SLOTH_PARTS = {"front_head":[510,53,696,293],"front_torso":[456,248,745,582],"front_uarm_l":[296,251,478,388],"front_uarm_r":[723,251,904,388],"front_farm_l":[51,288,294,400],"front_farm_r":[907,288,1150,400],"front_thigh_l":[439,516,582,697],"front_thigh_r":[629,516,773,697],"front_tail":[566,584,643,725],"front_calf_l":[444,678,569,866],"front_calf_r":[643,679,768,866],"back_head":[510,53,696,293],"back_torso":[455,247,745,622],"back_uarm_l":[300,251,478,388],"back_uarm_r":[723,251,900,388],"back_farm_l":[163,288,294,396],"back_farm_r":[906,288,1039,396],"back_elbow_l":[267,315,319,367],"back_elbow_r":[881,314,934,367],"back_grip_l":[195,606,314,813],"back_grip_r":[899,606,1018,813],"back_thigh_l":[439,567,571,697],"back_thigh_r":[641,562,773,697],"back_tail":[566,619,643,741],"back_calf_l":[444,678,569,866],"back_calf_r":[643,678,768,866],"front_uarm2_l":[79,99,232,337],"front_uarm2_r":[377,99,531,337],"front_farm2_l":[681,101,861,612],"front_farm2_r":[951,101,1131,612],"side_torso":[458,53,699,568],"side_tail":[372,453,473,535],"side_uarm":[791,80,910,268],"side_uarm_far":[791,80,910,268],"side_elbow":[811,261,857,307],"side_elbow_far":[811,261,857,307],"side_farm":[770,320,959,400],"side_farm_far":[770,320,959,400],"side_hand":[990,449,1166,539],"side_hand_far":[990,449,1166,539],"side_thigh":[629,516,773,687],"side_thigh_far":[629,516,773,687],"side_knee":[721,652,768,700],"side_knee_far":[721,652,768,700],"side_calf":[1020,689,1180,854],"side_calf_far":[1020,689,1180,854],"side_fist":[59,109,404,284],"side_fist_far":[59,109,404,284],"side_flat":[624,706,893,825],"side_flat_far":[624,706,893,825]};
/* PARTS:END */

// Gelenkpunkte in Vorlagen-Koordinaten (1200 x 896): [nah, fern]
const SLOTH_JOINTS = {
  front: {
    torso: [[600, 560], [600, 280]],
    head: [[600, 282], [600, 70]],
    uarm_l: [[462, 318], [312, 328]],
    farm_l: [[288, 342], [70, 350]],
    uarm_r: [[738, 318], [888, 328]],
    farm_r: [[912, 342], [1130, 350]],
    thigh_l: [[532, 540], [498, 682]],
    calf_l: [[508, 700], [508, 835]],
    thigh_r: [[668, 540], [702, 682]],
    calf_r: [[692, 700], [692, 835]],
    tail: [[604, 592], [600, 715]],
    // hängende Arme (Zusatzblatt, grösser gezeichnet)
    uarm2_l: [[160, 168], [166, 322], 0.62],
    farm2_l: [[757, 185], [770, 585], 0.58],
    uarm2_r: [[450, 168], [456, 322], 0.62],
    farm2_r: [[1043, 185], [1035, 585], 0.58],
  },
  back: {
    torso: [[606, 560], [606, 282]],
    head: [[603, 285], [603, 70]],
    uarm_l: [[462, 318], [293, 341]],
    farm_l: [[293, 341], [172, 344]],
    grip_l: [[255, 628], [255, 800]],
    uarm_r: [[738, 318], [907, 341]],
    farm_r: [[907, 341], [1028, 344]],
    grip_r: [[958, 628], [958, 800]],
    thigh_l: [[520, 588], [506, 684]],
    thigh_r: [[686, 588], [700, 684]],
    tail: [[604, 626], [604, 738]],
    calf_l: [[507, 692], [508, 835]],
    calf_r: [[693, 692], [692, 835]],
  },
  // Seitenansicht (Blick nach rechts); dritter Wert = Massstab des Teils
  side: {
    torso: [[586, 513], [544, 295]],
    tail: [[462, 500], [385, 468]],
    uarm: [[850, 128], [834, 284]],
    farm: [[806, 360], [948, 360]],
    hand: [[1000, 492], [1160, 494]],
    fist: [[100, 205], [313, 195], 0.5],
    flat: [[655, 766], [880, 792], 0.62],
    thigh: [[668, 548], [745, 676]],
    calf: [[1068, 702], [1064, 812]],
  },
};
// Anschlusspunkte am Rumpf
const SLOTH_ANCHORS = {
  front: { neck: [600, 282], sh_l: [470, 318], sh_r: [730, 318], shd_l: [458, 322], shd_r: [742, 322], hip_l: [532, 545], hip_r: [668, 545], tail: [602, 585] },
  back: { neck: [603, 282], sh_l: [470, 318], sh_r: [732, 318], hip_l: [520, 584], hip_r: [686, 584], tail: [604, 616] },
  side: { shoulder: [544, 295], hip: [586, 513], tail: [505, 505] },
};
// Zeichenreihenfolge (hinten -> vorne)
const SLOTH_ORDER = {
  front: ['tail', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'torso', 'head'],
  back: ['calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'elbow_l', 'elbow_r', 'torso', 'tail', 'head', 'grip_l', 'grip_r'],
  // hängende Arme: Unterarm-Kappe liegt über der Schnittkante des Oberarms
  frontDown: ['tail', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'torso', 'uarm_l', 'uarm_r', 'farm_l', 'farm_r', 'head'],
  side: ['farm_far', 'hand_far', 'uarm_far', 'elbow_far', 'calf_far', 'thigh_far', 'knee_far', 'tail', 'torso', 'calf', 'thigh', 'knee', 'farm', 'hand', 'uarm', 'elbow'],
};

const HANG_ARMS = { uarm_l: -110, farm_l: -98, grip_l: -94, uarm_r: -70, farm_r: -82, grip_r: -86 };
const STAND_LEGS = { thigh_l: 100, calf_l: 91, thigh_r: 80, calf_r: 89 };

/* view: Vorlage · pin: fester Punkt ('hands' = Mitte der Hände, 'feet';
   Seite: 'wrist', 'ankle') · dur: Sekunden pro Durchgang · keys: Verlauf
   a(0) -> b(1) über die Zeit · bar: Stange an den Händen · floor: Boden-
   schatten (y relativ zum festen Punkt) · label: Bildbeschreibung.
   Seitenansicht: Winkel uarm/farm/hand/thigh/calf gelten für die vordere
   Seite, f… (fuarm, ffarm, …) für die hintere (sonst gleich wie vorne);
   grip: 'fist' (Faust) / 'flat' (flach am Boden) statt offener Hand;
   Vorne: arms: 'down' = hängende Arme aus dem Zusatzblatt; solve: Rumpfwinkel so wählen, dass die
   Zehen auf Handhöhe liegen (Stütz), mit toe = Abstand Knöchel–Boden. */
const SLOTH_POSES = {
  pushup: {
    view: 'side', pin: 'wrist', dur: 2.6, floor: 34, solve: { toe: 60 }, grip: 'flat', label: 'Liegestütz',
    a: { uarm: 92, farm: 90, hand: 0 },
    b: { uarm: 146, farm: 52, hand: 0 },
  },
  squat: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, label: 'Kniebeuge',
    a: { torso: -100, uarm: 95, farm: 92, thigh: 80, calf: 92 },
    b: { torso: -60, uarm: -4, farm: -6, thigh: 10, calf: 110 },
  },
  hang: {
    view: 'back', pin: 'hands', dur: 3.6, bar: true, label: 'Faultier hängt an der Stange',
    a: { torso: -90, head: -90, ...HANG_ARMS, thigh_l: 97, calf_l: 92, thigh_r: 83, calf_r: 88, tail: 0 },
    b: { torso: -91.5, head: -92, uarm_l: -111, farm_l: -99, grip_l: -95, uarm_r: -71, farm_r: -83, grip_r: -87, thigh_l: 103, calf_l: 100, thigh_r: 79, calf_r: 82, tail: 8 },
  },
  pull: {
    view: 'back', pin: 'hands', dur: 2.6, bar: true, label: 'Klimmzug',
    keys: [[0, 0], [0.12, 0], [0.45, 1], [0.6, 1], [0.95, 0], [1, 0]],
    a: { torso: -90, head: -90, ...HANG_ARMS, thigh_l: 100, calf_l: 96, thigh_r: 80, calf_r: 84, tail: 0 },
    b: { torso: -90, head: -86, uarm_l: -198, farm_l: -100, grip_l: -95, uarm_r: 18, farm_r: -80, grip_r: -85, thigh_l: 108, calf_l: 100, thigh_r: 72, calf_r: 80, tail: -6 },
  },
  rest: {
    view: 'front', pin: 'feet', dur: 4.2, floor: 26, arms: 'down', label: 'Faultier steht und atmet durch',
    a: { torso: -90, head: -90, uarm_l: 98, farm_l: 93, uarm_r: 82, farm_r: 87, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -92, uarm_l: 96, farm_l: 92, uarm_r: 84, farm_r: 88, ...STAND_LEGS, tail: 0 },
  },
  wave: {
    view: 'front', pin: 'feet', dur: 1.4, label: 'Faultier winkt',
    a: { torso: -90, head: -92, uarm_l: 106, farm_l: 95, uarm_r: -30, farm_r: -70, ...STAND_LEGS, tail: 0 },
    b: { torso: -91, head: -88, uarm_l: 106, farm_l: 95, uarm_r: -34, farm_r: -110, ...STAND_LEGS, tail: 0 },
  },
  flex: {
    view: 'front', pin: 'feet', dur: 1.6, label: 'Faultier zeigt die Muskeln',
    a: { torso: -90, head: -90, uarm_l: 172, farm_l: -120, uarm_r: 8, farm_r: -60, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 180, farm_l: -95, uarm_r: 0, farm_r: -85, ...STAND_LEGS, tail: 0 },
  },
};

function slothRigBuild(pose) {
  const view = pose.view, J = SLOTH_JOINTS[view], A = SLOTH_ANCHORS[view];
  const rad = (d) => d * Math.PI / 180;
  const rot = (v, d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (v, k) => [v[0] * k, v[1] * k];
  const a0 = (name) => { const [p, d] = J[name]; return Math.atan2(d[1] - p[1], d[0] - p[0]) * 180 / Math.PI; };
  // Teil so stellen, dass sein Nah-Gelenk auf P liegt und der Knochen in Weltrichtung deg zeigt
  const place = (name, P, deg, img) => {
    const [p, d, k = 1] = J[name], r = deg - a0(name);
    return { img: img || view + '_' + name, P, r, p, k, map: (q) => add(P, mul(rot(sub(q, p), r), k)), end: add(P, mul(rot(sub(d, p), r), k)) };
  };
  const ball = (img, P) => { const b = SLOTH_PARTS[img]; return { img, P, r: 0, p: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], k: 1 }; };

  function side(s) {
    const q = {}, hk = pose.grip || 'hand', D = pose.depth || [-14, -8];
    const t = q.torso = place('torso', [0, 0], s.torso);
    q.tail = place('tail', t.map(A.tail), s.torso + a0('tail') - a0('torso') + (s.tail || 0));
    for (const far of [false, true]) {
      const x = far ? '_far' : '', v = (k) => (far ? s['f' + k] ?? s[k] : s[k]);
      const sh = add(t.map(A.shoulder), far ? D : [0, 0]), hip = add(t.map(A.hip), far ? D : [0, 0]);
      q['uarm' + x] = place('uarm', sh, v('uarm'), 'side_uarm' + x);
      q['elbow' + x] = ball('side_elbow' + x, q['uarm' + x].end);
      q['farm' + x] = place('farm', q['uarm' + x].end, v('farm'), 'side_farm' + x);
      q['hand' + x] = place(hk, q['farm' + x].end, v('hand') ?? v('farm'), 'side_' + hk + x);
      q['thigh' + x] = place('thigh', hip, v('thigh'), 'side_thigh' + x);
      q['knee' + x] = ball('side_knee' + x, q['thigh' + x].end);
      q['calf' + x] = place('calf', q['thigh' + x].end, v('calf'), 'side_calf' + x);
    }
    return { q, pts: { wrist: q.farm.end, ankle: q.calf.end } };
  }

  function frontBack(s) {
    const q = {};
    const t = q.torso = place('torso', [0, 0], s.torso);
    q.head = place('head', t.map(A.neck), s.head);
    q.tail = place('tail', t.map(A.tail), s.torso + 180 + (s.tail || 0));
    const down = pose.arms === 'down';
    for (const x of ['l', 'r']) {
      const ua = down ? 'uarm2_' + x : 'uarm_' + x, fa = down ? 'farm2_' + x : 'farm_' + x;
      q['uarm_' + x] = place(ua, t.map(A[(down ? 'shd_' : 'sh_') + x]), s['uarm_' + x]);
      q['farm_' + x] = place(fa, q['uarm_' + x].end, s['farm_' + x]);
      if (J['grip_' + x]) q['grip_' + x] = place('grip_' + x, q['farm_' + x].end, s['grip_' + x]);
      q['thigh_' + x] = place('thigh_' + x, t.map(A['hip_' + x]), s['thigh_' + x]);
      q['calf_' + x] = place('calf_' + x, q['thigh_' + x].end, s['calf_' + x]);
      if (view === 'back') q['elbow_' + x] = ball('back_elbow_' + x, q['uarm_' + x].end);
    }
    const hand = (x) => (q['grip_' + x] || q['farm_' + x]).end;
    return { q, pts: {
      hands: [(hand('l')[0] + hand('r')[0]) / 2, Math.min(hand('l')[1], hand('r')[1])],
      feet: [(q.calf_l.end[0] + q.calf_r.end[0]) / 2, Math.max(q.calf_l.end[1], q.calf_r.end[1])],
    } };
  }

  const pose1 = view === 'side' ? side : frontBack;
  // Stütz: Rumpfwinkel suchen, bei dem die Zehen am Boden liegen
  const solve = (s) => {
    let best = s.torso, bd = Infinity;
    for (let a = -80; a <= 10; a += 0.25) {
      const leg = a + 180, { pts } = pose1({ ...s, torso: a, thigh: leg + (s.legBend || 0), calf: leg });
      const d = Math.abs(pts.ankle[1] + pose.solve.toe - pts.wrist[1]);
      if (d < bd) { bd = d; best = a; }
    }
    return { ...s, torso: best, thigh: best + 180 + (s.legBend || 0), calf: best + 180 };
  };
  // Liefert je Teil { img, P, r, p, k } (Welt = P + k·R(r)·(x - p)), relativ zum festen Punkt
  return (s) => {
    const { q, pts } = pose1(pose.solve ? solve(s) : s);
    const pin = pts[pose.pin];
    for (const k in q) q[k] = { img: q[k].img, P: sub(q[k].P, pin), r: q[k].r, p: q[k].p, k: q[k].k };
    return q;
  };
}

const slothRigCache = {};
function slothRigPrepare(name) {
  if (slothRigCache[name]) return slothRigCache[name];
  const pose = SLOTH_POSES[name];
  const build = slothRigBuild(pose);
  const keys = pose.keys || [[0, 0], [0.5, 1], [1, 0]];
  const amount = (t) => {
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
        const u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(u * Math.PI));
      }
    }
    return keys[keys.length - 1][1];
  };
  const N = 16, frames = [];
  for (let i = 0; i <= N; i++) {
    const m = amount(i / N), s = {};
    for (const k in pose.a) s[k] = pose.a[k] + ((pose.b[k] ?? pose.a[k]) - pose.a[k]) * m;
    frames.push(build(s));
  }
  const order = SLOTH_ORDER[pose.view === 'front' && pose.arms === 'down' ? 'frontDown' : pose.view];
  // Umriss über alle Stellungen -> viewBox
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of frames) for (const key of order) {
    const { img, P, r, p, k } = f[key], b = SLOTH_PARTS[img];
    const c = Math.cos(r * Math.PI / 180) * k, s = Math.sin(r * Math.PI / 180) * k;
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      const dx = x - p[0], dy = y - p[1], wx = P[0] + dx * c - dy * s, wy = P[1] + dx * s + dy * c;
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
    }
  }
  if (pose.floor != null) y1 = Math.max(y1, pose.floor + 6);
  const padX = (x1 - x0) * 0.02, padY = (y1 - y0) * 0.02;
  const box = [x0 - padX, y0 - padY, x1 - x0 + 2 * padX, y1 - y0 + 2 * padY].map((v) => Math.round(v));
  const n = (v) => +v.toFixed(1);
  const sc = (e) => (e.k !== 1 ? ` scale(${e.k})` : '');
  // SVG-Attribut (Startstellung) und CSS-Transform (Keyframes) derselben Stellung
  const tfAttr = (e) => `translate(${n(e.P[0])} ${n(e.P[1])}) rotate(${+e.r.toFixed(2)})${sc(e)} translate(${n(-e.p[0])} ${n(-e.p[1])})`;
  const tfCss = (e) => `translate(${n(e.P[0])}px,${n(e.P[1])}px) rotate(${+e.r.toFixed(2)}deg)${sc(e)} translate(${n(-e.p[0])}px,${n(-e.p[1])}px)`;
  const css = [];
  for (const key of order) {
    const steps = frames.map((f, i) => `${+(i * 100 / N).toFixed(2)}%{transform:${tfCss(f[key])}}`).join('');
    css.push(`@keyframes srk-${name}-${key}{${steps}}.sr-${name} .sp-${key}{animation:srk-${name}-${key} ${pose.dur}s linear infinite}`);
  }
  const style = document.createElement('style');
  style.textContent = css.join('\n');
  document.head.appendChild(style);
  const parts = order.map((key) => {
    const e = frames[0][key], b = SLOTH_PARTS[e.img];
    return `<g class="sp-${key}" transform="${tfAttr(e)}"><image href="${SLOTH_RIG_BASE}${e.img}.png" x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}"/></g>`;
  }).join('');
  let extra = '';
  if (pose.bar) {
    const w = box[2] * 0.96;
    extra = `<rect class="sloth-rig-bar" x="${(-w / 2).toFixed(0)}" y="14" width="${w.toFixed(0)}" height="26" rx="13"/>`;
  }
  if (pose.floor != null) extra = `<ellipse class="sloth-rig-shadow" cx="${n(box[0] + box[2] / 2)}" cy="${pose.floor}" rx="${n(box[2] * (pose.view === 'side' ? 0.46 : 0.34))}" ry="${n(Math.max(10, box[2] * 0.035))}"/>`;
  slothRigCache[name] = { box, body: extra + parts };
  return slothRigCache[name];
}

// SVG-Markup einer Pose, z. B. slothFigure('hang', 'ex-figure sloth-img')
function slothFigure(name, cls = '') {
  const r = slothRigPrepare(name), [x, y, w, h] = r.box;
  return `<svg class="sloth-rig sr-${name} ${cls}" viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w / 3)}" height="${Math.round(h / 3)}" role="img" aria-label="${SLOTH_POSES[name].label}">${r.body}</svg>`;
}

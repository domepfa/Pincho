/* Faultier-Gliederpuppe: setzt die Figur aus Einzelteilen (assets/sloth/rig,
   erzeugt von tools/sloth-rig/build.py) zusammen und stellt sie per Winkel.

   Eine Pose hat zwei Endstellungen a und b (Weltwinkel je Knochen in Grad,
   0° = nach rechts, 90° = nach unten) und pendelt a -> b -> a. Daraus werden
   einmalig CSS-Keyframes gerechnet; die Figur selbst ist ein statisches SVG,
   das sich per innerHTML einsetzen lässt und ohne JS-Schleife animiert. */

const SLOTH_RIG_BASE = '../assets/sloth/rig/';

/* PARTS:BEGIN */
const SLOTH_PARTS = {"front_head":[510,53,696,293],"front_torso":[456,248,745,582],"front_uarm_l":[296,251,478,388],"front_uarm_r":[723,251,904,388],"front_farm_l":[51,288,294,400],"front_farm_r":[907,288,1150,400],"front_thigh_l":[439,516,582,697],"front_thigh_r":[629,516,773,697],"front_tail":[566,584,643,725],"front_calf_l":[444,678,569,866],"front_calf_r":[643,679,768,866],"back_head":[510,53,696,293],"back_torso":[455,247,745,622],"back_uarm_l":[300,251,478,388],"back_uarm_r":[723,251,900,388],"back_farm_l":[163,288,294,396],"back_farm_r":[906,288,1039,396],"back_elbow_l":[267,315,319,367],"back_elbow_r":[881,314,934,367],"back_grip_l":[195,606,314,813],"back_grip_r":[899,606,1018,813],"back_thigh_l":[439,567,571,697],"back_thigh_r":[641,562,773,697],"back_tail":[566,619,643,741],"back_calf_l":[444,678,569,866],"back_calf_r":[643,678,768,866]};
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
};
// Anschlusspunkte am Rumpf
const SLOTH_ANCHORS = {
  front: { neck: [600, 282], sh_l: [470, 318], sh_r: [730, 318], hip_l: [532, 545], hip_r: [668, 545], tail: [602, 585] },
  back: { neck: [603, 282], sh_l: [470, 318], sh_r: [732, 318], hip_l: [520, 584], hip_r: [686, 584], tail: [604, 616] },
};
// Zeichenreihenfolge (hinten -> vorne)
const SLOTH_ORDER = {
  front: ['tail', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'torso', 'head'],
  back: ['calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'elbow_l', 'elbow_r', 'torso', 'tail', 'head', 'grip_l', 'grip_r'],
};

const HANG_ARMS = { uarm_l: -110, farm_l: -98, grip_l: -94, uarm_r: -70, farm_r: -82, grip_r: -86 };
const STAND_LEGS = { thigh_l: 100, calf_l: 91, thigh_r: 80, calf_r: 89 };

/* view: Vorlage · pin: fester Punkt ('hands' = Mitte der Hände, 'feet') ·
   dur: Sekunden pro Durchgang · keys: Verlauf a(0) -> b(1) über die Zeit ·
   bar: Stange an den Händen · label: Bildbeschreibung */
const SLOTH_POSES = {
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
    view: 'front', pin: 'feet', dur: 4.2, label: 'Faultier steht und atmet durch',
    a: { torso: -90, head: -90, uarm_l: 108, farm_l: 96, uarm_r: 72, farm_r: 84, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -93, uarm_l: 104, farm_l: 94, uarm_r: 76, farm_r: 86, ...STAND_LEGS, tail: 0 },
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
  const J = SLOTH_JOINTS[pose.view], A = SLOTH_ANCHORS[pose.view];
  const rad = (d) => d * Math.PI / 180;
  const rot = (v, d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const place = (name, P, deg) => {
    const [p, d] = J[name];
    const r = deg - Math.atan2(d[1] - p[1], d[0] - p[0]) * 180 / Math.PI;
    return { P, r, p, map: (q) => add(P, rot(sub(q, p), r)), end: add(P, rot(sub(d, p), r)) };
  };
  // Liefert je Teil { P, r, p } (Welt = P + R(r)·(x - p)) für eine Stellung s
  return (s) => {
    const t = place('torso', [0, 0], s.torso);
    const q = { torso: t };
    q.head = place('head', t.map(A.neck), s.head);
    q.tail = place('tail', t.map(A.tail), s.torso + 180 + (s.tail || 0));
    for (const side of ['l', 'r']) {
      q['uarm_' + side] = place('uarm_' + side, t.map(A['sh_' + side]), s['uarm_' + side]);
      q['farm_' + side] = place('farm_' + side, q['uarm_' + side].end, s['farm_' + side]);
      if (J['grip_' + side]) q['grip_' + side] = place('grip_' + side, q['farm_' + side].end, s['grip_' + side]);
      q['thigh_' + side] = place('thigh_' + side, t.map(A['hip_' + side]), s['thigh_' + side]);
      q['calf_' + side] = place('calf_' + side, q['thigh_' + side].end, s['calf_' + side]);
      if (pose.view === 'back') {
        const b = SLOTH_PARTS['back_elbow_' + side], c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
        q['elbow_' + side] = { P: q['uarm_' + side].end, r: 0, p: c };
      }
    }
    const hand = (k) => (q['grip_' + k] || q['farm_' + k]).end;
    const pin = pose.pin === 'hands'
      ? [(hand('l')[0] + hand('r')[0]) / 2, Math.min(hand('l')[1], hand('r')[1])]
      : [(q.calf_l.end[0] + q.calf_r.end[0]) / 2, Math.max(q.calf_l.end[1], q.calf_r.end[1])];
    for (const k in q) q[k] = { P: sub(q[k].P, pin), r: q[k].r, p: q[k].p };
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
  // Umriss über alle Stellungen -> viewBox
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of frames) for (const k in f) {
    const b = SLOTH_PARTS[pose.view + '_' + k], { P, r, p } = f[k];
    const c = Math.cos(r * Math.PI / 180), s = Math.sin(r * Math.PI / 180);
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      const dx = x - p[0], dy = y - p[1], wx = P[0] + dx * c - dy * s, wy = P[1] + dx * s + dy * c;
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
    }
  }
  // Teil-Rechtecke sind grösser als die Figur: etwas enger schneiden
  const padX = (x1 - x0) * 0.02, padY = (y1 - y0) * 0.02;
  const box = [x0 - padX, y0 - padY, x1 - x0 + 2 * padX, y1 - y0 + 2 * padY].map((v) => Math.round(v));
  const n = (v) => +v.toFixed(1);
  // SVG-Attribut (Startstellung) und CSS-Transform (Keyframes) derselben Stellung
  const tfAttr = (e) => `translate(${n(e.P[0])} ${n(e.P[1])}) rotate(${+e.r.toFixed(2)}) translate(${n(-e.p[0])} ${n(-e.p[1])})`;
  const tfCss = (e) => `translate(${n(e.P[0])}px,${n(e.P[1])}px) rotate(${+e.r.toFixed(2)}deg) translate(${n(-e.p[0])}px,${n(-e.p[1])}px)`;
  const css = [];
  for (const k of SLOTH_ORDER[pose.view]) {
    const steps = frames.map((f, i) => `${+(i * 100 / N).toFixed(2)}%{transform:${tfCss(f[k])}}`).join('');
    css.push(`@keyframes srk-${name}-${k}{${steps}}.sr-${name} .sp-${k}{animation:srk-${name}-${k} ${pose.dur}s linear infinite}`);
  }
  const style = document.createElement('style');
  style.textContent = css.join('\n');
  document.head.appendChild(style);
  const parts = SLOTH_ORDER[pose.view].map((k) => {
    const b = SLOTH_PARTS[pose.view + '_' + k];
    return `<g class="sp-${k}" transform="${tfAttr(frames[0][k])}"><image href="${SLOTH_RIG_BASE}${pose.view}_${k}.png" x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}"/></g>`;
  }).join('');
  let bar = '';
  if (pose.bar) {
    const w = box[2] * 0.96;
    bar = `<rect class="sloth-rig-bar" x="${(-w / 2).toFixed(0)}" y="14" width="${w.toFixed(0)}" height="26" rx="13"/>`;
  }
  slothRigCache[name] = { box, body: bar + parts };
  return slothRigCache[name];
}

// SVG-Markup einer Pose, z. B. slothFigure('hang', 'ex-figure sloth-img')
function slothFigure(name, cls = '') {
  const r = slothRigPrepare(name), [x, y, w, h] = r.box;
  return `<svg class="sloth-rig sr-${name} ${cls}" viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w / 3)}" height="${Math.round(h / 3)}" role="img" aria-label="${SLOTH_POSES[name].label}">${r.body}</svg>`;
}

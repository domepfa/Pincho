/* Faultier-Gliederpuppe: setzt die Figur aus Einzelteilen (assets/sloth/rig,
   erzeugt von tools/sloth-rig/build.py) zusammen und stellt sie per Winkel.

   Eine Pose hat zwei Endstellungen a und b (Weltwinkel je Knochen in Grad,
   0° = nach rechts, 90° = nach unten) und pendelt a -> b -> a. Daraus werden
   einmalig CSS-Keyframes gerechnet; die Figur selbst ist ein statisches SVG,
   das sich per innerHTML einsetzen lässt und ohne JS-Schleife animiert. */

const SLOTH_RIG_BASE = '../assets/sloth/rig/';

/* PARTS:BEGIN */
const SLOTH_PARTS = {"front_head":[510,53,696,293],"front_torso":[456,248,745,582],"front_uarm_l":[296,251,478,388],"front_uarm_r":[723,251,904,388],"front_farm_l":[51,288,294,400],"front_farm_r":[907,288,1150,400],"front_thigh_l":[439,516,582,697],"front_thigh_r":[629,516,773,697],"front_tail":[566,584,643,725],"front_calf_l":[444,678,569,866],"front_calf_r":[643,679,768,866],"back_head":[510,53,696,293],"back_torso":[455,247,745,622],"back_uarm_l":[300,251,478,388],"back_uarm_r":[723,251,900,388],"back_farm_l":[163,288,294,396],"back_farm_r":[906,288,1039,396],"back_elbow_l":[267,315,319,367],"back_elbow_r":[881,314,934,367],"back_grip_l":[195,606,314,813],"back_grip_r":[899,606,1018,813],"back_thigh_l":[439,567,571,697],"back_thigh_r":[641,562,773,697],"back_tail":[566,619,643,741],"back_calf_l":[444,678,569,866],"back_calf_r":[643,678,768,866],"side_torso":[458,53,699,568],"side_tail":[372,453,473,535],"side_uarm":[791,80,910,268],"side_uarm_far":[791,80,910,268],"side_elbow":[811,261,857,307],"side_elbow_far":[811,261,857,307],"side_farm":[770,320,959,400],"side_farm_far":[770,320,959,400],"side_hand":[990,449,1166,539],"side_hand_far":[990,449,1166,539],"side_thigh":[629,516,773,687],"side_thigh_far":[629,516,773,687],"side_knee":[721,652,768,700],"side_knee_far":[721,652,768,700],"side_calf":[1020,689,1180,854],"side_calf_far":[1020,689,1180,854],"side_fist":[59,109,404,284],"side_fist_far":[59,109,404,284],"side_flat":[624,706,893,825],"side_flat_far":[624,706,893,825]};
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
  front: { neck: [600, 282], sh_l: [470, 318], sh_r: [730, 318], hip_l: [532, 545], hip_r: [668, 545], tail: [602, 585] },
  back: { neck: [603, 282], sh_l: [470, 318], sh_r: [732, 318], hip_l: [520, 584], hip_r: [686, 584], tail: [604, 616] },
  side: { shoulder: [544, 295], hip: [586, 513], tail: [505, 505] },
};
// Zeichenreihenfolge (hinten -> vorne)
const SLOTH_ORDER = {
  front: ['tail', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'torso', 'head'],
  back: ['calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'elbow_l', 'elbow_r', 'torso', 'tail', 'head', 'grip_l', 'grip_r'],
  side: ['farm_far', 'hand_far', 'uarm_far', 'elbow_far', 'calf_far', 'thigh_far', 'knee_far', 'tail', 'torso', 'calf', 'thigh', 'knee', 'farm', 'hand', 'uarm', 'elbow'],
};

const HANG_ARMS = { uarm_l: -110, farm_l: -98, grip_l: -94, uarm_r: -70, farm_r: -82, grip_r: -86 };
const STAND_LEGS = { thigh_l: 100, calf_l: 91, thigh_r: 80, calf_r: 89 };

/* view: Vorlage · pin: fester Punkt ('hands' = Mitte der Hände, 'feet';
   Seite: 'wrist', 'ankle') · dur: Sekunden pro Durchgang · keys: Verlauf
   a(0) -> b(1) über die Zeit · bar: Stange an den Händen · floor: Boden-
   schatten (y relativ zum festen Punkt) · label: Bildbeschreibung.
   Seite: pin auch 'grip', 'knee', 'elbow', 'shoulder', 'hip'; relArms: Arm-
   winkel relativ zum Rumpf; lean: { pt, y, from, to } Rumpfwinkel so, dass
   Punkt pt y über dem festen Punkt liegt; barEnd: Stange im Querschnitt;
   wall: { x } Wand; relLegs: Beinwinkel relativ zum Rumpf (Seite: 180 =
   gerade Verlängerung; vorne: Winkel wie im Stand, drehen mit dem Rumpf);
   dx/dy in der Stellung verschieben die ganze Figur.
   Vorne: pin auch 'hand_l', 'hand_r', 'foot_l', 'foot_r'.
   Seitenansicht: Winkel uarm/farm/hand/thigh/calf gelten für die vordere
   Seite, f… (fuarm, ffarm, …) für die hintere (sonst gleich wie vorne);
   grip: 'fist' (Faust) / 'flat' (flach am Boden) statt offener Hand;
   Vorne: armLift = Schultergelenk um so viele Vorlagen-Pixel höher (hängende Arme); solve: Rumpfwinkel so wählen, dass die
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
  plank: {
    view: 'side', pin: 'wrist', dur: 3.6, floor: 30, solve: { toe: 34 }, grip: 'flat', label: 'Unterarmstütz',
    a: { uarm: 90, farm: 0, hand: 0 },
    b: { uarm: 92, farm: 0, hand: 0 },
  },
  mountain: {
    view: 'side', pin: 'wrist', dur: 1.2, floor: 34, solve: { toe: 60 }, grip: 'flat', label: 'Mountain Climber',
    a: { uarm: 92, farm: 90, hand: 0, kneeThigh: 0, kneeCalf: 0 },
    b: { uarm: 92, farm: 90, hand: 0, kneeThigh: -115, kneeCalf: -20 },
  },
  bridge: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, lean: { pt: 'shoulder', y: 12, from: 150, to: 240 }, grip: 'flat', label: 'Glute Bridge',
    a: { torso: 180, uarm: 8, farm: 4, hand: 0, thigh: -38, calf: 72 },
    b: { torso: 180, uarm: 8, farm: 4, hand: 0, thigh: -8, calf: 88 },
  },
  situp: {
    view: 'side', pin: 'hip', dur: 2.8, floor: 60, relArms: true, label: 'Sit-up',
    keys: [[0, 0], [0.4, 1], [0.55, 1], [1, 0]],
    a: { torso: 186, uarm: 145, farm: -15, thigh: -52, calf: 58 },
    b: { torso: 292, uarm: 145, farm: -15, thigh: -52, calf: 58 },
  },
  crunch: {
    view: 'side', pin: 'hip', dur: 2.2, floor: 60, relArms: true, label: 'Crunch',
    a: { torso: 186, uarm: 145, farm: -15, thigh: -52, calf: 58 },
    b: { torso: 214, uarm: 145, farm: -15, thigh: -52, calf: 58 },
  },
  superman: {
    view: 'side', pin: 'hip', dur: 3, floor: 58, grip: 'flat', label: 'Superman',
    a: { torso: -2, uarm: -4, farm: -4, hand: -4, thigh: 180, calf: 180, fthigh: 182, fcalf: 182 },
    b: { torso: -14, uarm: -22, farm: -22, hand: -22, thigh: 192, calf: 194, fthigh: 194, fcalf: 196 },
  },
  hollow: {
    view: 'side', pin: 'hip', dur: 3.2, floor: 60, label: 'Hollow Hold',
    a: { torso: 196, uarm: 200, farm: 198, hand: 198, thigh: -16, calf: -14 },
    b: { torso: 194, uarm: 198, farm: 196, hand: 196, thigh: -14, calf: -12 },
  },
  deadbug: {
    view: 'side', pin: 'hip', dur: 3, floor: 60, label: 'Dead Bug',
    a: { torso: 180, uarm: -90, farm: -90, fuarm: -90, ffarm: -90, thigh: -90, calf: 0, fthigh: -90, fcalf: 0 },
    b: { torso: 180, uarm: 178, farm: 178, fuarm: -90, ffarm: -90, thigh: -90, calf: 0, fthigh: -8, fcalf: -6 },
  },
  birddog: {
    view: 'side', pin: 'knee', dur: 3, floor: 34, grip: 'flat', label: 'Bird Dog',
    a: { torso: -2, uarm: 90, farm: 90, hand: 0, fuarm: 90, ffarm: 90, fhand: 0, thigh: 90, calf: 178, fthigh: 90, fcalf: 178 },
    b: { torso: -2, uarm: -6, farm: -6, hand: -6, fuarm: 90, ffarm: 90, fhand: 0, thigh: 90, calf: 178, fthigh: 182, fcalf: 182 },
  },
  squathold: {
    view: 'side', pin: 'ankle', dur: 3.6, floor: 46, label: 'Tiefe Hocke',
    a: { torso: -62, uarm: 20, farm: -30, thigh: 2, calf: 112 },
    b: { torso: -64, uarm: 22, farm: -28, thigh: 2, calf: 112 },
  },
  splitsquat: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, label: 'Split Squat',
    a: { torso: -96, uarm: 96, farm: 92, thigh: 72, calf: 100, fthigh: 112, fcalf: 140 },
    b: { torso: -94, uarm: 96, farm: 92, thigh: 8, calf: 96, fthigh: 98, fcalf: 172 },
  },
  highknees: {
    view: 'side', pin: 'hip', dur: 0.9, floor: 210, label: 'High Knees',
    a: { torso: -96, uarm: 60, farm: -40, fuarm: 130, ffarm: 70, thigh: -8, calf: 88, fthigh: 90, fcalf: 94 },
    b: { torso: -96, uarm: 130, farm: 70, fuarm: 60, ffarm: -40, thigh: 90, calf: 94, fthigh: -8, fcalf: 88 },
  },
  legraise: {
    view: 'side', pin: 'grip', dur: 2.8, grip: 'fist', barEnd: true, label: 'Beinheben im Hang',
    a: { torso: -94, uarm: -86, farm: -88, hand: -80, thigh: 94, calf: 92 },
    b: { torso: -100, uarm: -86, farm: -88, hand: -80, thigh: -2, calf: -2 },
  },
  toestobar: {
    view: 'side', pin: 'grip', dur: 2.8, grip: 'fist', barEnd: true, label: 'Toes to Bar',
    a: { torso: -94, uarm: -86, farm: -88, hand: -80, thigh: 94, calf: 92 },
    b: { torso: -130, uarm: -100, farm: -95, hand: -85, thigh: -62, calf: -70 },
  },
  dips: {
    view: 'side', pin: 'grip', dur: 2.6, floor: 330, grip: 'fist', barEnd: true, label: 'Dips',
    a: { torso: -92, uarm: 94, farm: 90, hand: 0, thigh: 96, calf: 150 },
    b: { torso: -80, uarm: 150, farm: 64, hand: 0, thigh: 98, calf: 152 },
  },
  // ---- Mobility / Core / Lauf ohne Geräte ----
  scapula: {
    view: 'back', pin: 'hands', dur: 2.4, bar: true, label: 'Schulterblatt-Züge im Hang',
    a: { torso: -90, head: -90, ...HANG_ARMS, thigh_l: 97, calf_l: 92, thigh_r: 83, calf_r: 88, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: -100, farm_l: -95, grip_l: -93, uarm_r: -80, farm_r: -85, grip_r: -87, thigh_l: 97, calf_l: 92, thigh_r: 83, calf_r: 88, tail: 0 },
  },
  swimmer: {
    view: 'side', pin: 'hip', dur: 1.4, floor: 58, grip: 'flat', label: 'Swimmer',
    a: { torso: -8, uarm: -28, farm: -28, hand: -28, fuarm: -6, ffarm: -6, fhand: -6, thigh: 182, calf: 182, fthigh: 194, fcalf: 196 },
    b: { torso: -8, uarm: -6, farm: -6, hand: -6, fuarm: -28, ffarm: -28, fhand: -28, thigh: 194, calf: 196, fthigh: 182, fcalf: 182 },
  },
  ytw: {
    view: 'side', pin: 'ankle', dur: 3, floor: 46, label: 'Y-T-W',
    a: { torso: -42, uarm: 92, farm: 90, thigh: 76, calf: 96 },
    b: { torso: -42, uarm: -14, farm: -14, thigh: 76, calf: 96 },
  },
  sideplank: {
    view: 'front', pin: 'elbow_l', dur: 3.6, floor: 34, relLegs: true, label: 'Seitstütz',
    lean: { pt: 'foot_r', y: 10, from: -178, to: -100 },
    a: { torso: -150, head: -120, uarm_l: 90, farm_l: 184, uarm_r: -60, farm_r: -80, thigh_l: 92, calf_l: 90, thigh_r: 88, calf_r: 90, tail: 0 },
    b: { torso: -150, head: -116, uarm_l: 90, farm_l: 184, uarm_r: -70, farm_r: -88, thigh_l: 92, calf_l: 90, thigh_r: 88, calf_r: 90, tail: 0 },
  },
  frontlever: {
    view: 'side', pin: 'grip', dur: 3, grip: 'fist', barEnd: true, label: 'Front Lever (Tuck)',
    a: { torso: 176, uarm: -92, farm: -92, hand: -92, thigh: -128, calf: 30 },
    b: { torso: 180, uarm: -92, farm: -92, hand: -92, thigh: -70, calf: 20 },
  },
  calfraise: {
    view: 'side', pin: 'ankle', dur: 2, floor: 46, label: 'Wadenheben',
    a: { torso: -96, uarm: 96, farm: 92, thigh: 84, calf: 92, dy: 0 },
    b: { torso: -96, uarm: 96, farm: 92, thigh: 84, calf: 92, dy: -26 },
  },
  wallsit: {
    view: 'side', pin: 'ankle', dur: 3.6, floor: 46, wall: { x: -300 }, label: 'Wall Sit',
    a: { torso: -90, uarm: 94, farm: 20, thigh: 2, calf: 92 },
    b: { torso: -90, uarm: 94, farm: 22, thigh: 2, calf: 92 },
  },
  catcow: {
    view: 'side', pin: 'knee', dur: 3.4, floor: 34, grip: 'flat', label: 'Katze-Kuh',
    a: { torso: -10, uarm: 90, farm: 90, hand: 0, thigh: 90, calf: 178 },
    b: { torso: 8, uarm: 90, farm: 90, hand: 0, thigh: 90, calf: 178 },
  },
  wgs: {
    view: 'side', pin: 'ankle', dur: 3.2, floor: 46, grip: 'flat', label: 'Grösste Dehnung der Welt',
    a: { torso: -26, uarm: 100, farm: 130, hand: 0, fuarm: 96, ffarm: 92, fhand: 0, thigh: 12, calf: 96, fthigh: 160, fcalf: 166 },
    b: { torso: -26, uarm: -92, farm: -92, hand: -92, fuarm: 96, ffarm: 92, fhand: 0, thigh: 12, calf: 96, fthigh: 160, fcalf: 166 },
  },
  thoracic: {
    view: 'side', pin: 'knee', dur: 3.2, floor: 34, grip: 'flat', label: 'Brustwirbel-Rotation',
    a: { torso: -2, uarm: 118, farm: 170, hand: 170, fuarm: 90, ffarm: 90, fhand: 0, thigh: 90, calf: 178, fthigh: 90, fcalf: 178 },
    b: { torso: -2, uarm: -96, farm: -96, hand: -96, fuarm: 90, ffarm: 90, fhand: 0, thigh: 90, calf: 178, fthigh: 90, fcalf: 178 },
  },
  legswing: {
    view: 'side', pin: 'fankle', dur: 1.6, floor: 46, label: 'Beinpendel',
    a: { torso: -96, uarm: 96, farm: 92, thigh: 20, calf: 30, fthigh: 86, fcalf: 92 },
    b: { torso: -96, uarm: 96, farm: 92, thigh: 150, calf: 150, fthigh: 86, fcalf: 92 },
  },
  anklerock: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, label: 'Knöchel-Wippen',
    a: { torso: -94, uarm: 70, farm: 30, thigh: -2, calf: 92, fthigh: 94, fcalf: 180 },
    b: { torso: -90, uarm: 64, farm: 24, thigh: 14, calf: 70, fthigh: 108, fcalf: 180 },
  },
  neck: {
    view: 'front', pin: 'feet', dur: 3.2, floor: 26, armLift: 45, label: 'Nacken-Mobilisation',
    a: { torso: -90, head: -74, uarm_l: 108, farm_l: 96, uarm_r: 72, farm_r: 84, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -106, uarm_l: 108, farm_l: 96, uarm_r: 72, farm_r: 84, ...STAND_LEGS, tail: 0 },
  },
  jefferson: {
    view: 'side', pin: 'ankle', dur: 4, floor: 46, label: 'Jefferson Curl',
    a: { torso: -96, uarm: 92, farm: 90, thigh: 86, calf: 92 },
    b: { torso: 70, uarm: 92, farm: 90, thigh: 94, calf: 94 },
  },
  standwaage: {
    view: 'side', pin: 'fankle', dur: 3.6, floor: 46, label: 'Standwaage',
    a: { torso: -96, uarm: 96, farm: 92, thigh: 90, calf: 92, fthigh: 88, fcalf: 92 },
    b: { torso: -6, uarm: -6, farm: -6, thigh: 176, calf: 176, fthigh: 92, fcalf: 92 },
  },
  shuffle: {
    view: 'front', pin: 'feet', dur: 0.8, floor: 26, armLift: 45, label: 'Seitliches Shuffle',
    a: { torso: -90, head: -90, uarm_l: 120, farm_l: 40, uarm_r: 60, farm_r: 140, thigh_l: 118, calf_l: 100, thigh_r: 62, calf_r: 80, tail: 0, dy: 0 },
    b: { torso: -90, head: -90, uarm_l: 120, farm_l: 40, uarm_r: 60, farm_r: 140, thigh_l: 100, calf_l: 92, thigh_r: 80, calf_r: 88, tail: 0, dy: -14 },
  },
  quickfeet: {
    view: 'side', pin: 'hip', dur: 0.45, floor: 210, label: 'Quick Feet',
    a: { torso: -84, uarm: 70, farm: -20, fuarm: 120, ffarm: 50, thigh: 56, calf: 104, fthigh: 90, fcalf: 94 },
    b: { torso: -84, uarm: 120, farm: 50, fuarm: 70, ffarm: -20, thigh: 90, calf: 94, fthigh: 56, fcalf: 104 },
  },
  hops: {
    view: 'side', pin: 'ankle', dur: 1, floor: 46, label: 'Einbein-Hüpfer',
    keys: [[0, 0], [0.5, 1], [1, 0]],
    a: { torso: -92, uarm: 70, farm: 10, fuarm: 70, ffarm: 10, thigh: 74, calf: 104, fthigh: 110, fcalf: 170, dy: 0 },
    b: { torso: -96, uarm: 100, farm: 60, fuarm: 100, ffarm: 60, thigh: 88, calf: 94, fthigh: 110, fcalf: 170, dy: -60 },
  },
  bounds: {
    view: 'front', pin: 'feet', dur: 1.4, floor: 26, armLift: 45, relLegs: true, label: 'Seitsprünge',
    a: { torso: -80, head: -84, uarm_l: 140, farm_l: 110, uarm_r: 30, farm_r: 20, thigh_l: 104, calf_l: 94, thigh_r: 120, calf_r: 150, tail: 0 },
    b: { torso: -100, head: -96, uarm_l: 150, farm_l: 160, uarm_r: 40, farm_r: 70, thigh_l: 60, calf_l: 30, thigh_r: 76, calf_r: 86, tail: 0 },
  },
  sprint: {
    view: 'side', pin: 'hip', dur: 0.6, floor: 205, label: 'Sprint',
    a: { torso: -76, uarm: 40, farm: -40, fuarm: 150, ffarm: 90, thigh: 20, calf: 100, fthigh: 130, fcalf: 170 },
    b: { torso: -76, uarm: 150, farm: 90, fuarm: 40, ffarm: -40, thigh: 130, calf: 170, fthigh: 20, fcalf: 100 },
  },
  couch: {
    view: 'side', pin: 'fknee', dur: 3.6, floor: 30, wall: { x: -170 }, label: 'Couch Stretch',
    a: { torso: -92, uarm: 70, farm: 30, thigh: 2, calf: 92, fthigh: 92, fcalf: -96 },
    b: { torso: -100, uarm: 70, farm: 30, thigh: 6, calf: 88, fthigh: 100, fcalf: -96 },
  },
  figurefour: {
    view: 'side', pin: 'hip', dur: 3.6, floor: 60, label: 'Figur-4-Dehnung',
    a: { torso: 182, uarm: 20, farm: 10, fuarm: 20, ffarm: 10, thigh: -70, calf: 4, fthigh: -48, fcalf: 62 },
    b: { torso: 186, uarm: -10, farm: -30, fuarm: -10, ffarm: -30, thigh: -84, calf: 0, fthigh: -64, fcalf: 50 },
  },
  hipcircle: {
    view: 'front', pin: 'feet', dur: 2.4, floor: 26, armLift: 45, label: 'Hüftkreisen',
    a: { torso: -84, head: -90, uarm_l: 150, farm_l: 40, uarm_r: 30, farm_r: 140, thigh_l: 104, calf_l: 92, thigh_r: 84, calf_r: 88, tail: 0, dx: 10 },
    b: { torso: -96, head: -90, uarm_l: 150, farm_l: 40, uarm_r: 30, farm_r: 140, thigh_l: 96, calf_l: 92, thigh_r: 76, calf_r: 88, tail: 0, dx: -10 },
  },
  lateralLunge: {
    view: 'front', pin: 'feet', dur: 3, floor: 26, armLift: 45, label: 'Seitlicher Ausfallschritt',
    a: { torso: -90, head: -90, uarm_l: 70, farm_l: 30, uarm_r: 110, farm_r: 150, thigh_l: 140, calf_l: 96, thigh_r: 50, calf_r: 52, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 70, farm_l: 30, uarm_r: 110, farm_r: 150, thigh_l: 128, calf_l: 128, thigh_r: 40, calf_r: 84, tail: 0 },
  },
  quadstretch: {
    view: 'side', pin: 'fankle', dur: 3.6, floor: 46, label: 'Oberschenkel-Dehnung',
    a: { torso: -96, uarm: 150, farm: 120, fuarm: 96, ffarm: 92, thigh: 96, calf: -104, fthigh: 88, fcalf: 92 },
    b: { torso: -94, uarm: 150, farm: 118, fuarm: 94, ffarm: 90, thigh: 104, calf: -100, fthigh: 88, fcalf: 92 },
  },
  calfstretch: {
    view: 'side', pin: 'fankle', dur: 3.6, floor: 46, wall: { x: 420 }, label: 'Waden-Dehnung an der Wand',
    a: { torso: -54, uarm: -12, farm: -12, thigh: 44, calf: 96, fthigh: 128, fcalf: 128 },
    b: { torso: -50, uarm: -8, farm: -8, thigh: 40, calf: 92, fthigh: 130, fcalf: 130 },
  },
  adductor: {
    view: 'side', pin: 'knee', dur: 3, floor: 34, grip: 'flat', label: 'Adduktoren-Wippen',
    a: { torso: -2, uarm: 90, farm: 90, hand: 0, thigh: 90, calf: 178 },
    b: { torso: 14, uarm: 56, farm: 56, hand: 0, thigh: 58, calf: 178 },
  },
  nordic: {
    view: 'side', pin: 'knee', dur: 3.6, floor: 30, label: 'Nordic Hamstring Curl',
    keys: [[0, 0], [0.7, 1], [0.8, 1], [1, 0]],
    a: { torso: -90, uarm: 94, farm: 90, thigh: 90, calf: 180, fthigh: 90, fcalf: 180 },
    b: { torso: -42, uarm: 40, farm: 20, thigh: 138, calf: 180, fthigh: 138, fcalf: 180 },
  },
  heeltouch: {
    view: 'side', pin: 'hip', dur: 1.6, floor: 60, label: 'Heel Touches',
    a: { torso: 204, uarm: 8, farm: 8, fuarm: 20, ffarm: 20, thigh: -52, calf: 58 },
    b: { torso: 204, uarm: 20, farm: 20, fuarm: 8, ffarm: 8, thigh: -52, calf: 58 },
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
    view: 'front', pin: 'feet', dur: 4.2, floor: 26, armLift: 45, label: 'Faultier steht und atmet durch',
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
      const x = far ? '_far' : '', raw = (k) => (far ? s['f' + k] ?? s[k] : s[k]);
      // relArms: Armwinkel relativ zum Rumpf (Arme drehen beim Aufrichten mit)
      const v = (k) => (raw(k) != null && ((pose.relArms && /arm|hand/.test(k)) || (pose.relLegs && /thigh|calf/.test(k))) ? raw(k) + s.torso : raw(k));
      const sh = add(t.map(A.shoulder), far ? D : [0, 0]), hip = add(t.map(A.hip), far ? D : [0, 0]);
      q['uarm' + x] = place('uarm', sh, v('uarm'), 'side_uarm' + x);
      q['elbow' + x] = ball('side_elbow' + x, q['uarm' + x].end);
      q['farm' + x] = place('farm', q['uarm' + x].end, v('farm'), 'side_farm' + x);
      q['hand' + x] = place(hk, q['farm' + x].end, v('hand') ?? v('farm'), 'side_' + hk + x);
      q['thigh' + x] = place('thigh', hip, v('thigh'), 'side_thigh' + x);
      q['knee' + x] = ball('side_knee' + x, q['thigh' + x].end);
      q['calf' + x] = place('calf', q['thigh' + x].end, v('calf'), 'side_calf' + x);
    }
    return { q, pts: { wrist: q.farm.end, ankle: q.calf.end, grip: q.hand.end, knee: q.thigh.end, elbow: q.uarm.end,
      fwrist: q.farm_far.end, fankle: q.calf_far.end, fknee: q.thigh_far.end, shoulder: t.map(A.shoulder), hip: t.map(A.hip) } };
  }

  function frontBack(s) {
    const q = {};
    const t = q.torso = place('torso', [0, 0], s.torso);
    q.head = place('head', t.map(A.neck), s.head);
    q.tail = place('tail', t.map(A.tail), s.torso + 180 + (s.tail || 0));
    const arm = (k) => s[k] + (pose.relArms ? s.torso + 90 : 0), leg = (k) => s[k] + (pose.relLegs ? s.torso + 90 : 0);
    for (const x of ['l', 'r']) {
      const sh = A['sh_' + x];
      q['uarm_' + x] = place('uarm_' + x, t.map([sh[0], sh[1] - (pose.armLift || 0)]), arm('uarm_' + x));
      q['farm_' + x] = place('farm_' + x, q['uarm_' + x].end, arm('farm_' + x));
      if (J['grip_' + x]) q['grip_' + x] = place('grip_' + x, q['farm_' + x].end, arm('grip_' + x));
      q['thigh_' + x] = place('thigh_' + x, t.map(A['hip_' + x]), leg('thigh_' + x));
      q['calf_' + x] = place('calf_' + x, q['thigh_' + x].end, leg('calf_' + x));
      if (view === 'back') q['elbow_' + x] = ball('back_elbow_' + x, q['uarm_' + x].end);
    }
    const hand = (x) => (q['grip_' + x] || q['farm_' + x]).end;
    return { q, pts: {
      hand_l: hand('l'), hand_r: hand('r'), foot_l: q.calf_l.end, foot_r: q.calf_r.end, elbow_l: q.uarm_l.end, elbow_r: q.uarm_r.end,
      hands: [(hand('l')[0] + hand('r')[0]) / 2, Math.min(hand('l')[1], hand('r')[1])],
      feet: [(q.calf_l.end[0] + q.calf_r.end[0]) / 2, Math.max(q.calf_l.end[1], q.calf_r.end[1])],
    } };
  }

  const pose1 = view === 'side' ? side : frontBack;
  // Stütz: Rumpfwinkel suchen, bei dem die Zehen am Boden liegen
  // Stütz: Rumpfwinkel so wählen, dass die Zehen (hinteres, gestrecktes Bein) am Boden liegen.
  // Das vordere Bein kann per kneeThigh/kneeCalf (relativ zum gestreckten Bein) angezogen werden.
  const legs = (s, a) => ({ ...s, torso: a, fthigh: a + 180 + (s.legBend || 0), fcalf: a + 180,
    thigh: a + 180 + (s.legBend || 0) + (s.kneeThigh || 0), calf: a + 180 + (s.kneeCalf || 0) });
  const solve = (s) => {
    let best = 0, bd = Infinity;
    for (let a = -80; a <= 10; a += 0.25) {
      const { pts } = pose1(legs(s, a)), ankle = pose1({ ...legs(s, a), thigh: a + 180, calf: a + 180 }).pts.ankle;
      const d = Math.abs(ankle[1] + pose.solve.toe - pts.wrist[1]);
      if (d < bd) { bd = d; best = a; }
    }
    return legs(s, best);
  };
  // Rumpfwinkel so wählen, dass ein Punkt (z. B. Schulter) auf gegebener Höhe über dem festen Punkt liegt
  const lean = (s) => {
    const { pt, y, from, to } = pose.lean;
    let best = s.torso, bd = Infinity;
    for (let a = from; a <= to; a += 0.25) {
      const { pts } = pose1({ ...s, torso: a }), d = Math.abs(pts[pt][1] - pts[pose.pin][1] - y);
      if (d < bd) { bd = d; best = a; }
    }
    return { ...s, torso: best };
  };
  // Liefert je Teil { img, P, r, p, k } (Welt = P + k·R(r)·(x - p)), relativ zum festen Punkt
  return (s) => {
    const { q, pts } = pose1(pose.solve ? solve(s) : pose.lean ? lean(s) : s);
    // dx/dy: ganze Figur verschieben (Hüpfen, Fersen heben)
    const pin = sub(pts[pose.pin], [s.dx || 0, s.dy || 0]);
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
  const order = SLOTH_ORDER[pose.view];
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
  if (pose.wall) { x0 = Math.min(x0, pose.wall.x - 4); x1 = Math.max(x1, pose.wall.x + 30); }
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
  if (pose.floor != null) extra += `<ellipse class="sloth-rig-shadow" cx="${n(box[0] + box[2] / 2)}" cy="${pose.floor}" rx="${n(box[2] * (pose.view === 'side' ? 0.46 : 0.34))}" ry="${n(Math.max(10, box[2] * 0.035))}"/>`;
  if (pose.bar) {
    const w = box[2] * 0.96;
    extra += `<rect class="sloth-rig-bar" x="${(-w / 2).toFixed(0)}" y="14" width="${w.toFixed(0)}" height="26" rx="13"/>`;
  }
  // Wand (Seitenansicht) bei x, vom oberen Bildrand bis zum Boden
  if (pose.wall) extra += `<rect class="sloth-rig-bar" x="${pose.wall.x}" y="${box[1]}" width="26" height="${(pose.floor ?? box[1] + box[3]) - box[1]}"/>`;
  // Stange im Querschnitt (Seitenansicht) am festen Punkt, optional mit Pfosten bis zum Boden
  if (pose.barEnd) {
    if (pose.floor != null) extra += `<rect class="sloth-rig-bar" x="-9" y="0" width="18" height="${pose.floor}"/>`;
    extra += `<circle class="sloth-rig-bar" r="22"/>`;
  }
  slothRigCache[name] = { box, body: extra + parts };
  return slothRigCache[name];
}

// SVG-Markup einer Pose, z. B. slothFigure('hang', 'ex-figure sloth-img')
function slothFigure(name, cls = '') {
  const r = slothRigPrepare(name), [x, y, w, h] = r.box;
  return `<svg class="sloth-rig sr-${name} ${cls}" viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w / 3)}" height="${Math.round(h / 3)}" role="img" aria-label="${SLOTH_POSES[name].label}">${r.body}</svg>`;
}

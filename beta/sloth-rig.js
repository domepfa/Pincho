/* Faultier-Gliederpuppe: setzt die Figur aus Einzelteilen (assets/sloth/rig,
   erzeugt von tools/sloth-rig/build.py) zusammen und stellt sie per Winkel.

   Eine Pose hat zwei Endstellungen a und b (Weltwinkel je Knochen in Grad,
   0° = nach rechts, 90° = nach unten) und pendelt a -> b -> a. Daraus werden
   einmalig CSS-Keyframes gerechnet; die Figur selbst ist ein statisches SVG,
   das sich per innerHTML einsetzen lässt und ohne JS-Schleife animiert. */

const SLOTH_RIG_BASE = '../assets/sloth/rig/';
const SLOTH_RIG2_BASE = SLOTH_RIG_BASE.replace('/rig/', '/rig2/');
/* Neue Figur (v2, aus ganzen Zeichnungen geschnitten, siehe tools/sloth-rig/build_v2.py) – im Konto umschaltbar */
const SLOTH_FIG_KEY = 'pinchobeta_sloth_fig';
function slothV2On() { try { return localStorage.getItem(SLOTH_FIG_KEY) === 'v2'; } catch (e) { return false; } }
const slothPartBox = (im) => (im && im.startsWith('v2') ? SLOTH_V2.parts[im] : SLOTH_PARTS[im]);
const slothPartHref = (im) => (im.startsWith('v2') ? SLOTH_RIG2_BASE : SLOTH_RIG_BASE) + im + '.png';

/* PARTS:BEGIN */
const SLOTH_PARTS = {"front_head":[510,53,696,293],"front_torso":[456,248,745,582],"front_uarm_l":[296,251,478,388],"front_uarm_r":[723,251,904,388],"front_farm_l":[51,288,294,400],"front_farm_r":[907,288,1150,400],"front_thigh_l":[439,516,582,697],"front_thigh_r":[629,516,773,697],"front_tail":[566,584,643,725],"front_calf_l":[444,678,569,866],"front_calf_r":[643,679,768,866],"back_head":[510,53,696,293],"back_torso":[455,247,745,622],"back_uarm_l":[300,251,478,388],"back_uarm_r":[723,251,900,388],"back_farm_l":[163,288,294,396],"back_farm_r":[906,288,1039,396],"back_elbow_l":[267,315,319,367],"back_elbow_r":[881,314,934,367],"back_grip_l":[195,606,314,813],"back_grip_r":[899,606,1018,813],"back_thigh_l":[439,567,571,697],"back_thigh_r":[641,562,773,697],"back_tail":[566,619,643,741],"back_calf_l":[444,678,569,866],"back_calf_r":[643,678,768,866],"pose_russian_a":[209,33,499,221],"pose_russian_b":[679,29,968,221],"pose_ninety":[339,246,498,434],"pose_frog_a":[252,454,543,618],"pose_frog_b":[697,485,1018,614],"pose_extrot_a":[405,634,537,875],"pose_extrot_b":[633,634,817,876],"eq_plate":[570,40,688,159],"eq_kettlebell":[870,40,962,159],"eq_dumbbell":[184,51,365,151],"eq_dhandle":[178,193,273,328],"eq_rope":[515,183,622,331],"eq_ring":[866,182,955,336],"eq_barend":[66,379,285,434],"eq_bench":[326,418,558,499],"eq_incline":[604,353,821,499],"eq_decline":[887,404,1118,499],"eq_cable":[92,506,252,840],"eq_dipstation":[436,631,630,840],"eq_rack":[890,553,1108,840],"eq_latpull":[68,33,226,248],"eq_legpress":[312,68,575,239],"eq_legext":[657,67,851,241],"eq_legcurl":[917,67,1143,241],"eq_butterfly":[69,324,232,543],"eq_abduction":[362,329,510,543],"eq_calfseated":[657,417,844,543],"eq_calfstanding":[931,326,1134,541],"eq_hyperext":[71,688,280,839],"eq_pullover":[465,604,649,840],"eq_tbar":[877,653,1112,840],"eq_abwheel":[181,58,443,250],"eq_jumprope":[776,42,989,261],"eq_ladder":[93,361,534,514],"eq_stepbox":[748,354,1035,538],"eq_band":[93,682,531,759],"eq_mat":[627,666,1152,759],"eq_stack":[303,516,390,652],"eq_calfframe":[499,491,711,666],"eq_calfpad":[807,531,920,627],"eq_dipbars":[292,735,461,819],"eq_nordic":[535,711,724,819],"eq_abductseat":[1008,654,1141,819],"eq_edge":[818,753,954,823],"front_face_neutral":[106,22,253,213],"front_face_effort":[106,22,251,213],"front_face_blink":[106,22,253,213],"front_face_yawn":[106,22,253,213],"side_face_neutral":[104,40,335,317],"side_face_effort":[103,40,334,317],"side_face_blink":[104,40,332,317],"side_torso":[458,53,699,568],"side_body":[458,220,692,568],"side_tail":[372,453,473,535],"side_uarm":[791,80,910,268],"side_uarm_far":[791,80,910,268],"side_elbow":[811,261,857,307],"side_elbow_far":[811,261,857,307],"side_farm":[770,320,959,400],"side_farm_far":[770,320,959,400],"side_hand":[990,449,1166,539],"side_hand_far":[990,449,1166,539],"side_thigh":[629,516,773,687],"side_thigh_far":[629,516,773,687],"side_knee":[721,652,768,700],"side_knee_far":[721,652,768,700],"side_calf":[1020,689,1180,854],"side_calf_far":[1020,689,1180,854],"side_shin":[1020,689,1122,793],"side_shin_far":[1020,689,1122,793],"side_fist":[59,109,404,284],"side_fist_far":[59,109,404,284],"side_foot":[152,622,370,804],"side_foot_far":[152,622,370,804],"side_flat":[624,706,893,825],"side_flat_far":[624,706,893,825]};
/* PARTS:END */
/* V2:BEGIN */
const SLOTH_V2 = {"parts":{"v2front_torso":[149,183,351,481],"v2front_head":[173,15,331,198],"v2front_uarm_l":[86,206,200,366],"v2front_farm_l":[12,322,139,516],"v2front_farmfist_l":[16,322,138,468],"v2front_thigh_l":[142,400,251,584],"v2front_calf_l":[80,546,224,758],"v2front_uarm_r":[300,206,418,364],"v2front_farm_r":[365,322,497,516],"v2front_farmfist_r":[370,322,494,468],"v2front_thigh_r":[252,400,365,584],"v2front_calf_r":[284,546,428,758],"v2back_torso":[149,182,351,466],"v2back_head":[174,12,338,201],"v2back_uarm_l":[79,204,201,371],"v2back_farm_l":[30,326,142,440],"v2back_grip_l":[12,412,86,518],"v2back_thigh_l":[143,398,252,586],"v2back_calf_l":[78,546,224,753],"v2back_uarm_r":[300,204,429,367],"v2back_farm_r":[370,326,478,438],"v2back_grip_r":[426,412,499,518],"v2back_thigh_r":[250,397,370,585],"v2back_calf_r":[285,546,430,753],"v2hang_torso":[164,216,346,464],"v2hang_head":[196,120,317,263],"v2hang_uarm_l":[126,136,213,334],"v2hang_farm_l":[122,50,192,164],"v2hang_grip_l":[120,13,198,74],"v2hang_thigh_l":[152,400,261,581],"v2hang_calf_l":[136,540,235,754],"v2hang_uarm_r":[297,136,387,348],"v2hang_farm_r":[321,52,391,164],"v2hang_grip_r":[316,13,392,74],"v2hang_thigh_r":[250,400,360,582],"v2hang_calf_r":[277,540,376,754],"v2sit_torso":[153,184,361,403],"v2sit_head":[176,22,337,196],"v2sit_uarm_l":[78,215,181,389],"v2sit_farm_l":[49,352,150,539],"v2sit_thigh_l":[136,377,258,491],"v2sit_calf_l":[100,453,244,750],"v2sit_uarm_r":[330,216,435,389],"v2sit_farm_r":[362,352,464,539],"v2sit_thigh_r":[254,377,376,489],"v2sit_calf_r":[268,453,412,750],"v2side_torso":[30,238,263,592],"v2side_face":[92,11,254,191],"v2side_uarm":[157,180,325,270],"v2side_farm":[296,184,442,266],"v2side_hand":[422,190,496,238],"v2side_fist":[296,184,496,266],"v2side_flat":[422,190,496,238],"v2side_uarm_far":[157,180,325,270],"v2side_farm_far":[296,184,442,266],"v2side_hand_far":[422,190,496,238],"v2side_fist_far":[296,184,496,266],"v2side_flat_far":[422,190,496,238],"v2side_thigh":[89,510,229,718],"v2side_thigh_far":[89,510,229,718],"v2side_calf":[111,698,266,935],"v2side_calf_far":[111,698,266,935],"v2side_shin":[111,698,214,928],"v2side_shin_far":[111,698,214,928],"v2side_foot":[134,846,266,934],"v2side_foot_far":[134,846,266,934],"v2side_thighA":[390,522,572,704],"v2side_thighA_far":[390,522,572,704],"v2side_calfA":[412,637,561,869],"v2side_calfA_far":[412,637,561,869],"v2side_shinA":[412,637,561,859],"v2side_shinA_far":[412,637,561,859],"v2side_thighB":[711,581,949,748],"v2side_thighB_far":[711,581,949,748],"v2side_calfB":[702,628,857,846],"v2side_calfB_far":[702,628,857,846],"v2side_shinB":[702,628,857,823],"v2side_shinB_far":[702,628,857,823],"v2side_thighC":[1032,611,1314,751],"v2side_thighC_far":[1032,611,1314,751],"v2side_calfC":[903,553,1060,736],"v2side_calfC_far":[903,553,1060,736],"v2side_shinC":[903,553,1060,720],"v2side_shinC_far":[903,553,1060,720]},"joints":{"front":{"torso":[[250.0,445.0],[250.0,185.0]],"head":[[250.0,185.0],[250.0,20.0]],"farm_l":[[102.5,345.0],[40.0,495.0]],"uarm_l":[[165.0,240.0],[102.5,345.0]],"thigh_l":[[210.0,445.0],[180.0,575.0]],"calf_l":[[180.0,575.0],[155.0,695.0]],"farm_r":[[397.5,345.0],[462.5,495.0]],"uarm_r":[[335.0,240.0],[397.5,345.0]],"thigh_r":[[290.0,445.0],[320.0,575.0]],"calf_r":[[320.0,575.0],[345.0,695.0]]},"back":{"torso":[[250.0,445.0],[250.0,190.0]],"head":[[250.0,190.0],[250.0,15.0]],"grip_l":[[57.5,430.0],[42.5,500.0]],"farm_l":[[102.5,350.0],[57.5,430.0]],"uarm_l":[[165.0,240.0],[102.5,350.0]],"thigh_l":[[210.0,445.0],[180.0,575.0]],"calf_l":[[180.0,575.0],[155.0,695.0]],"grip_r":[[445.0,430.0],[465.0,500.0]],"farm_r":[[400.0,350.0],[445.0,430.0]],"uarm_r":[[335.0,240.0],[400.0,350.0]],"thigh_r":[[290.0,445.0],[325.0,575.0]],"calf_r":[[325.0,575.0],[350.0,695.0]]},"hang":{"torso":[[255.0,465.0],[255.0,235.0]],"head":[[255.0,235.0],[255.0,120.0]],"grip_l":[[152.5,55.0],[157.5,25.0]],"farm_l":[[150.0,140.0],[152.5,55.0]],"uarm_l":[[177.5,255.0],[150.0,140.0]],"thigh_l":[[222.5,465.0],[187.5,570.0]],"calf_l":[[187.5,570.0],[172.5,700.0]],"grip_r":[[355.0,55.0],[352.5,25.0]],"farm_r":[[357.5,140.0],[355.0,55.0]],"uarm_r":[[332.5,255.0],[357.5,140.0]],"thigh_r":[[287.5,465.0],[322.5,570.0]],"calf_r":[[322.5,570.0],[340.0,700.0]]},"sit":{"torso":[[255.0,415.0],[255.0,190.0]],"head":[[255.0,190.0],[255.0,25.0]],"farm_l":[[105.0,375.0],[75.0,525.0]],"uarm_l":[[145.0,257.5],[105.0,375.0]],"thigh_l":[[190.0,415.0],[192.5,482.5]],"calf_l":[[192.5,482.5],[169.0,660.0]],"farm_r":[[405.0,375.0],[435.0,525.0]],"uarm_r":[[365.0,257.5],[405.0,375.0]],"thigh_r":[[320.0,415.0],[320.0,482.5]],"calf_r":[[320.0,482.5],[340.0,660.0]]},"side":{"torso":[[159.2,546.0],[163.8,327.6]],"face":[[200.0,170.0],[165.0,30.0]],"flex":{"thigh":4.9,"thighA":51.0,"thighB":82.6,"thighC":100.2},"kneeBend":{"thigh":7.6,"thighA":69.5,"thighB":103.1,"thighC":125.3},"thighA":[[418.3,569.6],[520.7,669.3]],"calfA":[[517.1,664.7],[459.6,795.5]],"shinA":[[517.1,664.7],[459.6,795.5]],"thighB":[[755.8,653.2],[886.4,711.0]],"calfB":[[815.7,654.2],[729.8,768.4]],"shinB":[[815.7,654.2],[729.8,768.4]],"thighC":[[1126.1,674.5],[1265.9,703.8]],"calfC":[[1035.7,575.8],[931.0,673.0]],"shinC":[[1035.7,575.8],[931.0,673.0]],"uarm":[[200.0,222.5],[320.0,225.0]],"farm":[[320.0,225.0],[440.0,212.5]],"fist":[[320.0,225.0],[440.0,212.5]],"hand":[[440.0,212.5],[492.5,215.0]],"flat":[[440.0,212.5],[492.5,215.0]],"thigh":[[158.4,570.3],[167.7,712.8]],"calf":[[171.1,727.0],[161.6,869.6]],"shin":[[171.1,727.0],[161.6,869.6]],"foot":[[161.6,869.6],[254.7,914.2]]}},"anchors":{"front":{"neck":[250.0,185.0],"sh_l":[165.0,240.0],"sh_r":[335.0,240.0],"hip_l":[210.0,445.0],"hip_r":[290.0,445.0],"tail":[250.0,445.0]},"back":{"neck":[250.0,190.0],"sh_l":[165.0,240.0],"sh_r":[335.0,240.0],"hip_l":[210.0,445.0],"hip_r":[290.0,445.0],"tail":[250.0,445.0]},"hang":{"neck":[255.0,235.0],"sh_l":[177.5,255.0],"sh_r":[332.5,255.0],"hip_l":[222.5,465.0],"hip_r":[287.5,465.0],"tail":[255.0,465.0]},"sit":{"neck":[255.0,190.0],"sh_l":[145.0,257.5],"sh_r":[365.0,257.5],"hip_l":[190.0,415.0],"hip_r":[320.0,415.0],"tail":[255.0,415.0]},"side":{"shoulder":[163.8,327.6],"hip":[159.2,546.0],"tail":[54.6,591.5],"face":[186.6,265.7]}}};
/* V2:END */

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
    // Kopf aus dem Gesichter-Bogen (faces_front.jpg): Hals, Scheitel, Massstab auf die Vorlage
    face: [[177.6, 203.3], [177.6, 35.5], 1.263],
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
    fist: [[100, 205], [313, 195], 0.72], // Unterarm + Faust in einem Teil
    flat: [[655, 766], [880, 792], 0.62],
    thigh: [[668, 548], [745, 676]],
    calf: [[1068, 702], [1064, 812]],
    shin: [[1068, 702], [1075, 790]], // Unterschenkel ohne Fuss (feet: true)
    foot: [[205, 722], [355, 792], 0.65],
    // Kopf aus faces_side.jpg; Richtung wie der Rumpf (Hüfte -> Schulter), sitzt an ANCHORS.side.face
    face: [[317, 205], [275, -13], 0.83],
  },
};
// Anschlusspunkte am Rumpf
const SLOTH_ANCHORS = {
  front: { neck: [600, 282], sh_l: [470, 318], sh_r: [730, 318], hip_l: [532, 545], hip_r: [668, 545], tail: [602, 585] },
  // tail: direkt unter dem Chalkbag (Unterkante ~y 585), nicht erst unter dem Gesäss
  back: { neck: [603, 282], sh_l: [470, 318], sh_r: [732, 318], hip_l: [520, 584], hip_r: [686, 584], tail: [604, 588] },
  side: { shoulder: [544, 295], hip: [586, 513], tail: [505, 505], face: [685, 190] },
};
// Zeichenreihenfolge (hinten -> vorne)
// Gelenkkugeln liegen UNTER den Gliedern: sie füllen nur die Lücke im gebeugten Gelenk, statt als Kugel aufzusitzen
const SLOTH_ORDER = {
  front: ['tail', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'torso', 'head'],
  back: ['calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'elbow_l', 'elbow_r', 'farm_l', 'farm_r', 'uarm_l', 'uarm_r', 'torso', 'tail', 'head', 'grip_l', 'grip_r'],
  // Seite: vorderer Oberschenkel hinter dem Rumpf, damit die Hüfte rund bleibt (keine Schnittkante am Gesäss)
  side: ['elbow_far', 'farm_far', 'hand_far', 'uarm_far', 'knee_far', 'foot_far', 'calf_far', 'thigh_far', 'tail', 'knee', 'foot', 'calf', 'thigh', 'torso', 'head', 'elbow', 'farm', 'hand', 'uarm'],
};
/* Grundproportionen: Die Vorlage hat einen sehr grossen Rumpf und kurze Beine (Bein ~2/3 von Rumpf+Kopf).
   Beine länger, Rumpf und Kopf etwas kleiner, damit die Figur wie ein Athlet und nicht gebastelt wirkt. */
const SLOTH_SCALE = {
  side: { torso: 0.9, face: 0.9, tail: 0.9, uarm: 0.92, thigh: 1.16, calf: 1.16, shin: 1.16, foot: 1.1, ball: 1.7 },
  front: { torso: 0.92, face: 0.92, tail: 0.92, uarm_l: 0.95, uarm_r: 0.95, farm_l: 0.97, farm_r: 0.97, thigh_l: 1.14, thigh_r: 1.14, calf_l: 1.12, calf_r: 1.12 },
  back: { torso: 0.92, head: 0.92, tail: 0.92, uarm_l: 0.95, uarm_r: 0.95, farm_l: 0.97, farm_r: 0.97, grip_l: 0.97, grip_r: 0.97,
    thigh_l: 1.14, thigh_r: 1.14, calf_l: 1.12, calf_r: 1.12, ball: 0.95 },
};

// Kabelturm vor dem Faultier (gespiegelt, Rollen zeigen nach links) und Seil von einer Rolle zur Hand
const CABLE_PULLEY = { top: [213, 538], mid: [222, 643], low: [213, 810] };
const cableTower = (x) => ({ img: 'cable', at: [x, 46], a: [171, 838], k: 2.7, flip: true, layer: 'back' });
const cableLine = (pulley, to = 'grip', prop = 0) => ({ line: { prop, pt: CABLE_PULLEY[pulley] }, to });

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
   Vorne: len_<teil> verkürzt ein Glied (zeigt zum Betrachter), armsFront Arme vor dem Rumpf;
   pin auch 'hand_l', 'hand_r', 'foot_l', 'foot_r'.
   props: Geräte [{ img, at: Punkt ('grip', 'fgrip', 'hand_l', …) oder [x, y]
   fest (dx/dy: Versatz davon), k: Massstab, r: Drehung, a: Ankerpunkt im Blatt, turn: dreht mit
   dem Rumpf, flip: gespiegelt, layer: 'back' | 'mid' | 'front' } oder
   { line: [x, y], to: Punkt } für ein Seil vom festen Punkt zur Hand].
   Seitenansicht: Winkel uarm/farm/hand/thigh/calf gelten für die vordere
   Seite, f… (fuarm, ffarm, …) für die hintere (sonst gleich wie vorne);
   grip: 'fist' (Faust) / 'flat' (flach am Boden) statt offener Hand;
   feet: eigener Fuss mit Winkel foot (Zehen heben, Tibialis);
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
    b: { torso: 180, uarm: -182, farm: -182, fuarm: -90, ffarm: -90, thigh: -90, calf: 0, fthigh: -8, fcalf: -6 },
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
  // Bulgarian: hinterer Fuss liegt fest auf der Bank (farFoot), nur das vordere Bein beugt
  splitsquat: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, farFoot: [-235, -85], label: 'Bulgarian Split Squat',
    props: [{ img: 'bench', at: [-300, 46], a: [442, 499], k: 1.3, layer: 'back' }],
    a: { torso: -94, uarm: 96, farm: 92, thigh: 70, calf: 104 },
    b: { torso: -80, uarm: 100, farm: 94, thigh: 12, calf: 100 },
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
    // Dip-Station von der Seite: Holm waagrecht auf Griffhöhe (a = Oberkante Holm)
    view: 'side', pin: 'grip', dur: 2.6, floor: 330, grip: 'fist', label: 'Dips',
    props: [{ img: 'dipstation', at: [0, 10], a: [540, 637], k: 1.63, layer: 'back' }],
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
    view: 'side', pin: 'ankle', dur: 3.6, floor: 46, wall: { x: -300 }, drawnKnee: false, label: 'Wall Sit', // Schienbein bleibt senkrecht
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
    // Stützarm gerade nach unten neben den vorderen Fuss (Ellbogen nicht nach hinten durchgebogen)
    a: { torso: -26, uarm: 88, farm: 84, hand: 0, fuarm: 96, ffarm: 92, fhand: 0, thigh: 12, calf: 96, fthigh: 160, fcalf: 166 },
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
    // auf einer Box stehend, damit Kopf und Hände unter die Standfläche dürfen (echte Ausführung)
    view: 'side', pin: 'ankle', dur: 4, floor: 366, label: 'Jefferson Curl',
    props: [{ img: 'stepbox', at: [40, 42], a: [1006, 358], k: [1.1, 1.8], layer: 'back' }],
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
    view: 'front', pin: 'feet', dur: 1.4, floor: 26, armLift: 45, label: 'Seitsprünge',
    // Skater: seitlich von Bein zu Bein springen. Landung auf einem gebeugten Bein, das andere kreuzt schräg
    // hinter dem Standbein, die Arme schwingen gegengleich zur Seite des Standbeins.
    a: { torso: -96, head: -92, uarm_l: 96, farm_l: 100, uarm_r: 130, farm_r: 150, thigh_l: 100, calf_l: 86, thigh_r: 104, len_thigh_r: 0.8, calf_r: 112, len_calf_r: 0.85, dx: -70, tail: 0 },
    b: { torso: -84, head: -88, uarm_l: 50, farm_l: 30, uarm_r: 84, farm_r: 80, thigh_r: 80, calf_r: 94, thigh_l: 76, len_thigh_l: 0.8, calf_l: 68, len_calf_l: 0.85, dx: 70, tail: 0 },
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
    // Arme hängen locker (Hände nicht an der Hüfte verdreht)
    a: { torso: -90, head: -90, uarm_l: 104, farm_l: 98, uarm_r: 76, farm_r: 82, thigh_l: 140, calf_l: 96, thigh_r: 50, calf_r: 52, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 108, farm_l: 100, uarm_r: 72, farm_r: 80, thigh_l: 128, calf_l: 128, thigh_r: 40, calf_r: 84, tail: 0 },
  },
  quadstretch: {
    view: 'side', pin: 'fankle', dur: 3.6, floor: 46, drawLast: ['calf', 'knee', 'farm', 'hand'], label: 'Oberschenkel-Dehnung',
    // Hand hält den Fuss am Knöchel
    a: { torso: -96, uarm: 105, farm: 81, hand: 196, fuarm: 96, ffarm: 92, thigh: 108, calf: -92, fthigh: 88, fcalf: 92 },
    b: { torso: -94, uarm: 110, farm: 81, hand: 196, fuarm: 96, ffarm: 92, thigh: 114, calf: -88, fthigh: 88, fcalf: 92 },
  },
  calfstretch: {
    // Hände flach an der Wand (Finger nach oben)
    view: 'side', pin: 'fankle', dur: 3.6, floor: 46, wall: { x: 596 }, label: 'Waden-Dehnung an der Wand',
    a: { torso: -54, uarm: -12, farm: -12, hand: -84, thigh: 44, calf: 96, fthigh: 128, fcalf: 128 },
    b: { torso: -50, uarm: -10, farm: -6, hand: -84, thigh: 40, calf: 92, fthigh: 130, fcalf: 130 },
  },
  adductor: {
    view: 'side', pin: 'knee', dur: 3, floor: 34, grip: 'flat', label: 'Adduktoren-Wippen',
    a: { torso: -2, uarm: 90, farm: 90, hand: 0, thigh: 90, calf: 178 },
    b: { torso: 14, uarm: 56, farm: 56, hand: 0, thigh: 58, calf: 178 },
  },
  nordic: {
    // kniet auf der Bank, Fersen unter der Fussrolle (Bank gespiegelt: Rolle hinten)
    view: 'side', pin: 'knee', dur: 3.6, floor: 107, label: 'Nordic Hamstring Curl',
    props: [{ img: 'nordic', at: [-115, -28], a: [682, 730], k: 1.5, flip: true, layer: 'front' }],
    keys: [[0, 0], [0.7, 1], [0.8, 1], [1, 0]],
    a: { torso: -90, uarm: 94, farm: 90, thigh: 90, calf: 180, fthigh: 90, fcalf: 180 },
    b: { torso: -42, uarm: 40, farm: 20, thigh: 138, calf: 180, fthigh: 138, fcalf: 180 },
  },
  heeltouch: {
    view: 'side', pin: 'hip', dur: 1.6, floor: 60, label: 'Heel Touches',
    a: { torso: 204, uarm: 8, farm: 8, fuarm: 20, ffarm: 20, thigh: -52, calf: 58 },
    b: { torso: 204, uarm: 20, farm: 20, fuarm: 8, ffarm: 8, thigh: -52, calf: 58 },
  },
  // ---- Freihanteln und Bank ----
  benchpress: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 286, grip: 'fist', label: 'Bankdrücken', props: [{ img: 'bench', at: [-150, 108], a: [442, 422], k: 2.2, layer: 'back' }, { img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: 180, uarm: -90, farm: -90, hand: -90, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
    b: { torso: 180, uarm: 104, farm: -84, hand: -90, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
  },
  dbbench: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 286, grip: 'fist', label: 'Kurzhantel-Bankdrücken', props: [{ img: 'bench', at: [-150, 108], a: [442, 422], k: 2.2, layer: 'back' }, { img: 'plate', at: 'fgrip', k: 0.72, layer: 'mid' }, { img: 'plate', at: 'grip', k: 0.72 }],
    a: { torso: 180, uarm: -90, farm: -90, hand: -90, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
    b: { torso: 180, uarm: 104, farm: -84, hand: -90, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
  },
  inclinebench: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 250, grip: 'fist', label: 'Schrägbankdrücken',
    props: [{ img: 'incline', at: [-40, 40], a: [712, 470], k: 2.1, layer: 'back' }, { img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: -142, uarm: -120, farm: -120, hand: -120, thigh: 10, calf: 96, fthigh: 6, fcalf: 94 },
    b: { torso: -142, uarm: 100, farm: -110, hand: -120, thigh: 10, calf: 96, fthigh: 6, fcalf: 94 },
  },
  declinebench: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 260, grip: 'fist', label: 'Negativ-Bankdrücken',
    props: [{ img: 'decline', at: [-120, 96], a: [1000, 432], k: 2.1, layer: 'back' }, { img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: 166, uarm: -80, farm: -80, hand: -80, thigh: -20, calf: 80, fthigh: -24, fcalf: 78 },
    b: { torso: 166, uarm: 110, farm: -76, hand: -80, thigh: -20, calf: 80, fthigh: -24, fcalf: 78 },
  },
  skullcrusher: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 286, grip: 'fist', label: 'Skull Crusher', props: [{ img: 'bench', at: [-150, 108], a: [442, 422], k: 2.2, layer: 'back' }, { img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: 180, uarm: -104, farm: -100, hand: -100, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
    b: { torso: 180, uarm: -116, farm: -215, hand: -215, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
  },
  dbpullover: {
    view: 'side', pin: 'hip', dur: 3, floor: 286, grip: 'fist', label: 'Überzüge mit Kurzhantel', props: [{ img: 'bench', at: [-150, 108], a: [442, 422], k: 2.2, layer: 'back' }, { img: 'plate', at: 'grip', k: 0.72 }],
    a: { torso: 180, uarm: -90, farm: -92, hand: -92, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
    b: { torso: 180, uarm: -164, farm: -170, hand: -170, thigh: 62, calf: 96, fthigh: 58, fcalf: 94 },
  },
  deadlift: {
    view: 'side', pin: 'ankle', dur: 3, floor: 46, grip: 'fist', effort: 'a', label: 'Kreuzheben', props: [{ img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: -34, uarm: 94, farm: 92, thigh: 50, calf: 108 },
    b: { torso: -96, uarm: 94, farm: 92, thigh: 86, calf: 92 },
  },


  rdl: {
    view: 'side', pin: 'ankle', dur: 3, floor: 46, grip: 'fist', label: 'Rumänisches Kreuzheben', props: [{ img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: -96, uarm: 94, farm: 92, thigh: 86, calf: 92 },
    b: { torso: -26, uarm: 92, farm: 90, thigh: 96, calf: 96 },
  },


  barbellrow: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, grip: 'fist', label: 'Langhantel-Rudern', props: [{ img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: -36, uarm: 92, farm: 90, thigh: 70, calf: 102 },
    b: { torso: -36, uarm: 170, farm: 70, thigh: 70, calf: 102 },
  },


  dbrow: {
    view: 'side', pin: 'fknee', dur: 2.4, floor: 250, grip: 'fist', label: 'Einarmiges Kurzhantel-Rudern',
    props: [{ img: 'bench', at: [70, 26], a: [442, 422], k: 2, layer: 'back' }, { img: 'plate', at: 'grip', k: 0.72 }],
    a: { torso: -6, uarm: 92, farm: 92, hand: 92, fuarm: 92, ffarm: 90, thigh: 92, calf: 96, fthigh: 90, fcalf: 180 },
    b: { torso: -6, uarm: 164, farm: 78, hand: 90, fuarm: 92, ffarm: 90, thigh: 92, calf: 96, fthigh: 90, fcalf: 180 },
  },
  goblet: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, grip: 'fist', label: 'Goblet Squat', props: [{ img: 'kettlebell', at: 'grip', a: [916, 64], k: 1.3 }],
    a: { torso: -98, uarm: 104, farm: -58, hand: -40, thigh: 80, calf: 92 },
    b: { torso: -66, uarm: 70, farm: -80, hand: -60, thigh: 8, calf: 110 },
  },
  sumosquat: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, grip: 'fist', label: 'Sumo Squat', props: [{ img: 'plate', at: 'grip', k: 0.72 }],
    a: { torso: -98, uarm: 92, farm: 90, hand: 90, thigh: 80, calf: 92 },
    b: { torso: -82, uarm: 92, farm: 90, hand: 90, thigh: 12, calf: 100 },
  },
  lunge: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, grip: 'fist', label: 'Ausfallschritt mit Kurzhanteln', props: [{ img: 'plate', at: 'fgrip', k: 0.72, layer: 'mid' }, { img: 'plate', at: 'grip', k: 0.72 }],
    a: { torso: -96, uarm: 94, farm: 92, hand: 92, thigh: 72, calf: 100, fthigh: 112, fcalf: 140 },
    b: { torso: -94, uarm: 94, farm: 92, hand: 92, thigh: 8, calf: 96, fthigh: 98, fcalf: 172 },
  },
  stepup: {
    view: 'side', pin: 'fankle', dur: 2.8, floor: 46, grip: 'fist', label: 'Step-up',
    props: [{ img: 'stepbox', at: [150, -60], a: [891, 446], k: 1.1, layer: 'back' }],
    a: { torso: -94, uarm: 94, farm: 92, thigh: 8, calf: 96, fthigh: 92, fcalf: 94, dy: 0 },
    b: { torso: -96, uarm: 94, farm: 92, thigh: 82, calf: 94, fthigh: 60, fcalf: 140, dy: -150 },
  },
  hipthrust: {
    view: 'side', pin: 'ankle', dur: 2.8, floor: 46, grip: 'fist', label: 'Hip Thrust',
    lean: { pt: 'shoulder', y: -140, from: 150, to: 240 },
    props: [{ img: 'bench', at: [-330, -150], a: [442, 422], k: 1.6, layer: 'back' }, { img: 'plate', at: 'hip', k: 1.5 }],
    a: { torso: 180, uarm: 0, farm: 20, hand: 20, thigh: -30, calf: 84 },
    b: { torso: 180, uarm: -14, farm: 20, hand: 20, thigh: -4, calf: 92 },
  },
  ohp: {
    view: 'side', pin: 'ankle', dur: 2.6, floor: 46, grip: 'fist', label: 'Schulterdrücken', props: [{ img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: -96, uarm: 64, farm: -86, hand: -90, thigh: 86, calf: 92 },
    b: { torso: -96, uarm: -92, farm: -92, hand: -92, thigh: 86, calf: 92 },
  },
  curl: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, grip: 'fist', label: 'Bizepscurl', props: [{ img: 'plate', at: 'fgrip', k: 0.72, layer: 'mid' }, { img: 'plate', at: 'grip', k: 0.72 }],
    a: { torso: -96, uarm: 94, farm: 92, hand: 92, thigh: 86, calf: 92 },
    b: { torso: -96, uarm: 98, farm: -52, hand: -60, thigh: 86, calf: 92 },
  },
  bbcurl: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, grip: 'fist', label: 'Langhantel-Curl', props: [{ img: 'plate', at: 'grip', k: 1.3 }],
    a: { torso: -96, uarm: 94, farm: 92, hand: 92, thigh: 86, calf: 92 },
    b: { torso: -96, uarm: 98, farm: -52, hand: -60, thigh: 86, calf: 92 },
  },
  tricepsext: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, grip: 'fist', label: 'Trizepsdrücken am Kabel',
    props: [cableTower(400), cableLine('top')],
    a: { torso: -92, uarm: 100, farm: -30, hand: -30, thigh: 84, calf: 92 },
    b: { torso: -92, uarm: 100, farm: 84, hand: 84, thigh: 84, calf: 92 },
  },


  dbflyes: {
    view: 'front', pin: 'foot_l', dur: 3, armLift: -20, armsFront: true, relArms: true, relLegs: true, label: 'Kurzhantel-Fliegende (von oben)',
    props: [{ img: 'plate', at: 'hand_l', k: 0.72 }, { img: 'plate', at: 'hand_r', k: 0.72 }],
    a: { torso: 180, head: 180, uarm_l: 176, farm_l: 176, uarm_r: 4, farm_r: 4, ...STAND_LEGS, tail: 0 },
    b: { torso: 180, head: 180, uarm_l: 176, farm_l: 176, uarm_r: 4, farm_r: 4, len_uarm_l: 0.4, len_farm_l: -0.85, len_uarm_r: 0.4, len_farm_r: -0.85, ...STAND_LEGS, tail: 0 },
  },


  frontraise: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, grip: 'fist', label: 'Frontheben', props: [{ img: 'plate', at: 'grip', k: 0.72 }],
    a: { torso: -96, uarm: 88, farm: 86, hand: 86, thigh: 86, calf: 92 },
    b: { torso: -96, uarm: -4, farm: -6, hand: -6, thigh: 86, calf: 92 },
  },
  lateralraise: {
    view: 'front', pin: 'feet', dur: 2.4, floor: 26, armLift: 45, label: 'Seitheben',
    props: [{ img: 'plate', at: 'hand_l', k: 0.72 }, { img: 'plate', at: 'hand_r', k: 0.72 }],
    a: { torso: -90, head: -90, uarm_l: 104, farm_l: 96, uarm_r: 76, farm_r: 84, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 184, farm_l: 180, uarm_r: -4, farm_r: 0, ...STAND_LEGS, tail: 0 },
  },
  lateralcable: {
    view: 'front', pin: 'feet', dur: 2.6, floor: 26, armLift: 45, label: 'Seitheben am Kabel',
    props: [{ img: 'cable', at: [-420, 26], a: [171, 838], k: 2.7, layer: 'back' }, cableLine('low', 'hand_r')],
    a: { torso: -90, head: -90, uarm_l: 108, farm_l: 96, uarm_r: 80, farm_r: 96, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 108, farm_l: 96, uarm_r: -2, farm_r: 6, ...STAND_LEGS, tail: 0 },
  },
  sidebend: {
    view: 'front', pin: 'feet', dur: 2.6, floor: 26, armLift: 45, relArms: true, label: 'Seitbeuge mit Kurzhantel',
    props: [{ img: 'plate', at: 'hand_l', k: 0.72 }],
    a: { torso: -80, head: -80, uarm_l: 100, farm_l: 94, uarm_r: 60, farm_r: 150, ...STAND_LEGS, tail: 0 },
    b: { torso: -100, head: -100, uarm_l: 100, farm_l: 94, uarm_r: 60, farm_r: 150, ...STAND_LEGS, tail: 0 },
  },
  // ---- Kabelzug ----
  // Seitlich zum Kabelturm (links), Fussschlaufe am rechten Bein, Kabel läuft vor dem Standbein durch
  abductioncable: {
    view: 'front', pin: 'foot_l', dur: 2.6, floor: 26, armLift: 45, label: 'Abduktion am Kabel',
    props: [{ img: 'cable', at: [-490, 26], a: [171, 838], k: 2.7, layer: 'back' }, cableLine('low', 'foot_r')],
    a: { torso: -90, head: -90, uarm_l: 160, farm_l: 150, uarm_r: 72, farm_r: 84, thigh_l: 94, calf_l: 91, thigh_r: 90, calf_r: 92, tail: 0 },
    b: { torso: -94, head: -92, uarm_l: 160, farm_l: 150, uarm_r: 72, farm_r: 84, thigh_l: 94, calf_l: 91, thigh_r: 48, calf_r: 50, tail: 0 },
  },
  // Vorderansicht: Kabel oben rechts, beide Hände am Griff ziehen diagonal vor dem Körper nach unten links
  woodchop: {
    view: 'front', pin: 'feet', dur: 2.4, floor: 26, armLift: 45, armsFront: true, join: { arm: 'l', to: 'hand_r', bend: 1 }, label: 'Holzhacker am Kabel',
    props: [{ img: 'cable', at: [620, 26], a: [171, 838], k: 2.7, flip: true, layer: 'back' }, cableLine('top', 'hand_r')],
    a: { torso: -80, head: -84, uarm_l: -23.6, farm_l: -23.6, uarm_r: 45, farm_r: 268, ...STAND_LEGS, tail: 0 },
    b: { torso: -100, head: -96, uarm_l: 142.9, farm_l: 45.9, uarm_r: 127.5, farm_r: 127.5, ...STAND_LEGS, tail: 0 },
  },
  // Kabelturm links, Griff in der linken Hand; neigt sich gegen den Zug vom Turm weg
  sidebendcable: {
    view: 'front', pin: 'feet', dur: 2.6, floor: 26, armLift: 45, relArms: true, label: 'Seitbeuge am Kabel',
    props: [{ img: 'cable', at: [-460, 26], a: [171, 838], k: 2.7, layer: 'back' }, cableLine('low', 'hand_l')],
    a: { torso: -100, head: -98, uarm_l: 100, farm_l: 94, uarm_r: 60, farm_r: 150, ...STAND_LEGS, tail: 0 },
    b: { torso: -76, head: -80, uarm_l: 100, farm_l: 94, uarm_r: 60, farm_r: 150, ...STAND_LEGS, tail: 0 },
  },
  facepull: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, grip: 'fist', label: 'Face Pull',
    props: [cableTower(420), cableLine('top')],
    a: { torso: -92, uarm: -22, farm: -24, thigh: 84, calf: 92 },
    b: { torso: -94, uarm: 196, farm: -40, thigh: 84, calf: 92 },
    // neue Figur: Ellbogen wandert auf Schulterhöhe gerade nach hinten (len_uarm < 0: Oberarm zeigt hinter die Schulter)
    v2: { a: { uarm: -12, len_uarm: 1, farm: -14 }, b: { uarm: -12, len_uarm: -0.35, farm: -78 } },
  },
  cablerow: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 60, grip: 'fist', label: 'Rudern am Kabel',
    props: [cableTower(560), cableLine('low')],
    a: { torso: -60, uarm: 4, farm: 2, thigh: -4, calf: 10 },
    b: { torso: -94, uarm: 128, farm: 6, thigh: -4, calf: 10 },
  },
  straightarm: {
    view: 'side', pin: 'ankle', dur: 2.6, floor: 46, grip: 'fist', label: 'Überzug am Kabel',
    props: [cableTower(460), cableLine('top')],
    a: { torso: -70, uarm: -40, farm: -40, thigh: 80, calf: 96 },
    b: { torso: -70, uarm: 96, farm: 94, thigh: 80, calf: 96 },
  },
  cablecurl: {
    view: 'side', pin: 'ankle', dur: 2.4, floor: 46, grip: 'fist', label: 'Curl am Kabel',
    props: [cableTower(420), cableLine('low')],
    a: { torso: -96, uarm: 96, farm: 88, thigh: 86, calf: 92 },
    b: { torso: -96, uarm: 100, farm: -52, thigh: 86, calf: 92 },
  },
  cablecrunch: {
    view: 'side', pin: 'knee', dur: 2.6, floor: 30, grip: 'fist', relArms: true, label: 'Crunch am Kabel',
    props: [cableTower(470), cableLine('top')],
    a: { torso: -86, uarm: 170, farm: -10, thigh: 90, calf: 180, fthigh: 90, fcalf: 180 },
    b: { torso: -10, uarm: 170, farm: -10, thigh: 110, calf: 180, fthigh: 110, fcalf: 180 },
  },
  pallof: {
    view: 'side', pin: 'ankle', dur: 3, floor: 46, grip: 'fist', label: 'Pallof Press',
    props: [cableTower(470), cableLine('mid')],
    a: { torso: -94, uarm: 100, farm: -12, thigh: 80, calf: 96 },
    b: { torso: -94, uarm: -4, farm: -4, thigh: 80, calf: 96 },
  },
  kickback: {
    // feet: eigener Fuss, damit er beim Zurückdrücken nicht mit dem Unterschenkel mitdreht (Zehen zeigen zum Boden)
    view: 'side', pin: 'fankle', dur: 2.4, floor: 48, feet: true, grip: 'fist', label: 'Kickback am Kabel',
    props: [cableTower(330), cableLine('low', 'ankle')],
    a: { torso: -70, uarm: -8, farm: -8, fuarm: -8, ffarm: -8, thigh: 96, calf: 98, foot: 16, fthigh: 88, fcalf: 94, ffoot: 16 },
    b: { torso: -70, uarm: -8, farm: -8, fuarm: -8, ffarm: -8, thigh: 150, calf: 154, foot: 70, fthigh: 88, fcalf: 94, ffoot: 16 },
  },
  crossover: {
    view: 'front', pin: 'feet', dur: 2.6, floor: 26, armLift: 45, label: 'Kabel-Crossover',
    // zwei Kabeltürme, Seile von den oberen Rollen zu den Händen
    props: [{ img: 'cable', at: [-640, 26], a: [171, 838], k: 2.7, layer: 'back' }, { img: 'cable', at: [640, 26], a: [171, 838], k: 2.7, flip: true, layer: 'back' },
      { line: { prop: 0, pt: CABLE_PULLEY.top }, to: 'hand_l' }, { line: { prop: 1, pt: CABLE_PULLEY.top }, to: 'hand_r' }],
    a: { torso: -90, head: -90, uarm_l: -160, farm_l: -150, uarm_r: -20, farm_r: -30, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: -240, farm_l: -320, uarm_r: 60, farm_r: 140, ...STAND_LEGS, tail: 0 },
  },
  bandpull: {
    view: 'front', pin: 'feet', dur: 2.4, floor: 26, armLift: 45, label: 'Band auseinanderziehen',
    props: [{ line: 'hand_l', to: 'hand_r' }],
    a: { torso: -90, head: -90, uarm_l: 150, farm_l: 30, uarm_r: 30, farm_r: 150, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 180, farm_l: 180, uarm_r: 0, farm_r: 0, ...STAND_LEGS, tail: 0 },
  },
  bandcircle: {
    view: 'front', pin: 'feet', dur: 3, floor: 26, armLift: 45, label: 'Schulterkreisen mit Band',
    props: [{ line: 'hand_l', to: 'hand_r' }],
    a: { torso: -90, head: -90, uarm_l: 130, farm_l: 120, uarm_r: 50, farm_r: 60, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 240, farm_l: 250, uarm_r: -60, farm_r: -70, ...STAND_LEGS, tail: 0 },
  },
  // ---- Maschinen ----
  latpull: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 250, grip: 'fist', label: 'Latzug',
    props: [{ img: 'latpull', at: [-10, 50], a: [195, 200], k: 3.8, flip: true, layer: 'back' },
      { line: { prop: 0, pt: [188, 40] }, to: 'grip' }],
    a: { torso: -94, uarm: -80, farm: -84, thigh: -4, calf: 92 },
    b: { torso: -100, uarm: 112, farm: -70, thigh: -4, calf: 92 },
  },
  legpress: {
    view: 'side', pin: 'hip', dur: 2.8, floor: 180, effort: 'a', label: 'Beinpresse',
    props: [{ img: 'legpress', at: [0, 40], a: [430, 175], k: 2.6, flip: true, layer: 'back' }],
    a: { torso: -150, uarm: 60, farm: 20, thigh: -70, calf: 30 },
    b: { torso: -150, uarm: 60, farm: 20, thigh: -38, calf: -40 },
  },
  legext: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 230, label: 'Beinstrecker',
    props: [{ img: 'legext', at: [-10, 50], a: [745, 152], k: 3, layer: 'back' }],
    a: { torso: -100, uarm: 80, farm: 20, thigh: -4, calf: 92 },
    b: { torso: -100, uarm: 80, farm: 20, thigh: -6, calf: 0 },
  },
  legcurl: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 170, label: 'Beinbeuger liegend',
    props: [{ img: 'legcurl', at: [40, 50], a: [1040, 168], k: 2.8, flip: true, layer: 'back' }],
    a: { torso: -4, uarm: 70, farm: 0, thigh: 180, calf: 182 },
    b: { torso: -4, uarm: 70, farm: 0, thigh: 184, calf: 284 }, // über 270° (nach oben) zum Gesäss, nicht durch den Boden
  },
  // Wie an der Maschine: Oberarme waagrecht, Unterarme senkrecht an den Polstern. Die Ellbogen schwenken
  // nach vorne zur Mitte (Oberarm verkürzt sich perspektivisch), die Unterarme kommen vor die Brust und
  // werden dabei etwas grösser -> liest sich als Bewegung zum Betrachter, nicht nach hinten
  // Seitenansicht, sitzend: die Arme kommen von aussen (zeigen zum Betrachter bzw. vom ihm weg, darum kurz)
  // nach vorne, bis sie vor der Brust gestreckt nebeneinander liegen. Von vorne wäre "nach vorne" und
  // "nach hinten" im Bild nicht zu unterscheiden.
  pecdeck: {
    view: 'side', pin: 'hip', dur: 2.6, floor: 230, grip: 'fist', label: 'Butterfly',
    props: [{ img: 'bench', at: [70, 60], a: [442, 422], k: 2, layer: 'back' }],
    a: { torso: -96, uarm: 8, farm: 24, len_uarm: 0.5, len_farm: 0.55, near_uarm: 1.12, near_farm: 1.25, flen_uarm: 0.5, flen_farm: 0.55, fnear_uarm: 0.88, fnear_farm: 0.82, thigh: -4, calf: 92 },
    b: { torso: -96, uarm: 4, farm: 10, len_uarm: 1, len_farm: 1, near_uarm: 1, near_farm: 1, flen_uarm: 1, flen_farm: 1, fnear_uarm: 1, fnear_farm: 1, thigh: -4, calf: 92 },
  },

  reversefly: {
    // Rückansicht: Arme starten vorne vor der Brust (verdeckt, len < 0) und gehen auf Schulterhöhe nach hinten in die T-Position
    view: 'back', pin: 'feet', dur: 2.6, floor: 26, label: 'Reverse Butterfly',
    props: [{ img: 'butterfly', at: [0, 26], a: [125, 555], k: 3.6, layer: 'back' }],
    a: { torso: -90, head: -90, uarm_l: 180, len_uarm_l: -0.3, farm_l: 180, len_farm_l: -0.3, uarm_r: 0, len_uarm_r: -0.3, farm_r: 0, len_farm_r: -0.3, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 180, len_uarm_l: 1, farm_l: 180, len_farm_l: 1, uarm_r: 0, len_uarm_r: 1, farm_r: 0, len_farm_r: 1, ...STAND_LEGS, tail: 0 },
  },
  extrot: {
    // Aussenrotation am Kabel (Vorderansicht): Ellbogen bleibt am Körper, Unterarm dreht von vor dem Bauch nach aussen
    view: 'front', pin: 'feet', dur: 2.6, floor: 26, label: 'Aussenrotation am Kabel',
    props: [{ img: 'cable', at: [-420, 26], a: [171, 838], k: 2.7, layer: 'back' }, cableLine('mid', 'hand_r')],
    a: { torso: -90, head: -90, uarm_l: 100, farm_l: 96, uarm_r: 86, farm_r: 172, len_farm_r: 0.55, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 100, farm_l: 96, uarm_r: 86, farm_r: 4, len_farm_r: 0.85, ...STAND_LEGS, tail: 0 },
  },
  // Sitzend von vorne: Oberschenkel zeigen zum Betrachter (verkürzt), Knie drücken nach aussen gegen die Polster
  abduction: {
    view: 'front', pin: 'feet', dur: 2.6, floor: 20, armLift: 45, legsFront: true, label: 'Abduktoren-Maschine',
    props: [{ img: 'abductseat', at: [0, 20], a: [1075, 815], k: 3.9, layer: 'back' }],
    a: { torso: -90, head: -90, uarm_l: 104, farm_l: 96, uarm_r: 76, farm_r: 84, thigh_l: 104, len_thigh_l: 0.3, calf_l: 92, thigh_r: 76, len_thigh_r: 0.3, calf_r: 88, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 104, farm_l: 96, uarm_r: 76, farm_r: 84, thigh_l: 172, len_thigh_l: 0.6, calf_l: 94, thigh_r: 8, len_thigh_r: 0.6, calf_r: 86, tail: 0 },
    // neue Figur: sitzende Zeichnung, Oberschenkel schon verkürzt gezeichnet -> Knie gehen nur auseinander
    v2: {
      a: { uarm_l: 100, farm_l: 96, uarm_r: 80, farm_r: 84, thigh_l: 90, len_thigh_l: 1, calf_l: 90, thigh_r: 90, len_thigh_r: 1, calf_r: 90 },
      b: { uarm_l: 100, farm_l: 96, uarm_r: 80, farm_r: 84, thigh_l: 118, len_thigh_l: 1, calf_l: 96, thigh_r: 62, len_thigh_r: 1, calf_r: 84 },
    },
  },
  calfseated: {
    view: 'side', pin: 'hip', dur: 2, floor: 220, label: 'Wadenheben sitzend',
    props: [{ img: 'calfseated', at: [0, 50], a: [690, 447], k: 3, layer: 'back' }],
    a: { torso: -96, uarm: 70, farm: 10, thigh: 0, calf: 92 },
    b: { torso: -96, uarm: 70, farm: 10, thigh: -10, calf: 96 },
  },
  calfmachine: {
    view: 'side', pin: 'ankle', dur: 2, floor: 118, label: 'Wadenheben an der Maschine',
    // a = Knöchel über der Trittkante (Vorfuss auf der Kante), Polster liegt dann auf den Schultern
    props: [{ img: 'calfstanding', at: [0, 42], a: [1030, 518], k: 3.3, layer: 'back' }],
    a: { torso: -92, uarm: 76, farm: -84, thigh: 84, calf: 92, dy: 0 },
    b: { torso: -92, uarm: 76, farm: -84, thigh: 84, calf: 92, dy: -26 },
  },
  backext: {
    view: 'side', pin: 'hip', dur: 2.8, floor: 332, relArms: true, label: 'Rückenstrecker',
    props: [{ img: 'hyperext', at: [20, 40], a: [215, 668], k: 1.8, layer: 'back' }],
    a: { torso: 34, uarm: 150, farm: -20, thigh: 128, calf: 128 },
    b: { torso: -34, uarm: 150, farm: -20, thigh: 128, calf: 128 },
  },
  pullovermachine: {
    view: 'side', pin: 'hip', dur: 2.8, floor: 230, grip: 'fist', label: 'Pullover-Maschine',
    props: [{ img: 'pullover', at: [-20, 50], a: [615, 785], k: 2.8, layer: 'back' }],
    a: { torso: -104, uarm: -110, farm: -110, thigh: -4, calf: 92 },
    b: { torso: -104, uarm: 70, farm: 70, thigh: -4, calf: 92 },
  },
  abwheel: {
    view: 'side', pin: 'knee', dur: 3, floor: 30, grip: 'fist', label: 'Ab Wheel Rollout',
    props: [{ img: 'plate', at: 'grip', k: 0.8 }],
    a: { torso: -60, uarm: 80, farm: 82, thigh: 110, calf: 180 },
    b: { torso: -26, uarm: -8, farm: -8, thigh: 150, calf: 180 },
  },
  jumprope: {
    view: 'side', pin: 'ankle', dur: 0.6, floor: 46, grip: 'fist', label: 'Seilspringen',
    rope: true, // Seil als kreisende Linie um die Figur (siehe slothRigPrepare)
    a: { torso: -94, uarm: 100, farm: 20, thigh: 86, calf: 92, dy: 0 },
    b: { torso: -94, uarm: 100, farm: 30, thigh: 80, calf: 96, dy: -40 },
  },
  ladder: {
    view: 'side', pin: 'hip', dur: 0.6, floor: 205, label: 'Koordinationsleiter',
    props: [{ img: 'ladder', at: [0, 205], a: [314, 438], k: [1.6, 0.25], layer: 'back' }],
    a: { torso: -80, uarm: 40, farm: -40, fuarm: 150, ffarm: 90, thigh: 30, calf: 100, fthigh: 110, fcalf: 150 },
    b: { torso: -80, uarm: 150, farm: 90, fuarm: 40, ffarm: -40, thigh: 110, calf: 150, fthigh: 30, fcalf: 100 },
  },
  // ---- Fussgelenk, Handgelenk, Türrahmen ----
  tibialis: {
    view: 'side', pin: 'ankle', dur: 2, floor: 48, feet: true, wall: { x: -250 }, label: 'Tibialis Raise',
    a: { torso: -100, uarm: 100, farm: 94, thigh: 70, calf: 100, foot: 18, ffoot: 18 },
    b: { torso: -100, uarm: 100, farm: 94, thigh: 70, calf: 100, foot: -14, ffoot: -14 },
  },
  wristcurl: {
    view: 'side', pin: 'hip', dur: 2, floor: 230, label: 'Handgelenk-Curl',
    props: [{ img: 'bench', at: [0, 60], a: [442, 422], k: 2, layer: 'back' }, { img: 'plate', at: 'grip', k: 0.62 }],
    a: { torso: -70, uarm: 60, farm: 0, hand: 40, fuarm: 60, ffarm: 0, fhand: 40, thigh: -4, calf: 92 },
    b: { torso: -70, uarm: 60, farm: 0, hand: -40, fuarm: 60, ffarm: 0, fhand: -40, thigh: -4, calf: 92 },
  },
  wristmob: {
    view: 'side', pin: 'ankle', dur: 1.8, floor: 46, label: 'Handgelenk-Mobilisation',
    a: { torso: -96, uarm: 96, farm: 4, hand: 50, thigh: 86, calf: 92 },
    b: { torso: -96, uarm: 96, farm: 4, hand: -50, thigh: 86, calf: 92 },
  },
  doorway: {
    view: 'side', pin: 'ankle', dur: 3.6, floor: 46, wall: { x: -170 }, label: 'Brustdehnung im Türrahmen',
    a: { torso: -94, uarm: 184, farm: -90, hand: -90, thigh: 80, calf: 96, fthigh: 110, fcalf: 120 },
    b: { torso: -82, uarm: 190, farm: -86, hand: -86, thigh: 64, calf: 104, fthigh: 118, fcalf: 124 },
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
  // Einarmig hängen (Einarm-Griffe am Board): Griffhand fest, die andere hängt locker
  hang1l: {
    view: 'back', pin: 'hand_l', dur: 3.6, label: 'Faultier hängt einarmig (links)',
    props: [{ img: 'edge', at: 'hand_l', dy: 50, a: [886, 822], k: 1.1, layer: 'back' }],
    // len_farm ~0: der Greifhand-Teil bringt schon ein Stück Unterarm mit, sonst wirkt der Arm ein Glied zu lang
    a: { torso: -94, head: -96, uarm_l: -100, farm_l: -94, grip_l: -92, len_farm_l: 0.001, uarm_r: 76, farm_r: 88, grip_r: 96, len_farm_r: 0.001, thigh_l: 98, calf_l: 92, thigh_r: 84, calf_r: 88, tail: 4 },
    b: { torso: -95, head: -97, uarm_l: -101, farm_l: -95, grip_l: -93, len_farm_l: 0.001, uarm_r: 74, farm_r: 86, grip_r: 94, len_farm_r: 0.001, thigh_l: 101, calf_l: 96, thigh_r: 82, calf_r: 85, tail: 9 },
  },
  hang1r: {
    view: 'back', pin: 'hand_r', dur: 3.6, label: 'Faultier hängt einarmig (rechts)',
    props: [{ img: 'edge', at: 'hand_r', dy: 50, a: [886, 822], k: 1.1, layer: 'back' }],
    a: { torso: -86, head: -84, uarm_r: -80, farm_r: -86, grip_r: -88, len_farm_r: 0.001, uarm_l: 104, farm_l: 92, grip_l: 84, len_farm_l: 0.001, thigh_l: 96, calf_l: 92, thigh_r: 82, calf_r: 88, tail: -4 },
    b: { torso: -85, head: -83, uarm_r: -79, farm_r: -85, grip_r: -87, len_farm_r: 0.001, uarm_l: 106, farm_l: 94, grip_l: 86, len_farm_l: 0.001, thigh_l: 98, calf_l: 95, thigh_r: 79, calf_r: 84, tail: -9 },
  },
  // Lifting Pin: steht seitlich, Arm gestreckt, hält den Griffblock mit den
  // Fingern, darunter der Pin mit Scheibe. Statisch bis auf leichtes Atmen.
  pinlift: {
    view: 'side', pin: 'ankle', dur: 4, floor: 46, grip: 'fist', mirror: ['farm'], label: 'Lifting Pin', // mirror: Faust zum Körper statt nach aussen
    props: [{ img: 'plate', at: 'grip', dy: 100, k: 1.05 }, { line: { prop: 0, pt: [629, 99] }, to: 'grip' }, { img: 'plate', at: 'grip', dy: 100, dx: 12, k: 1.05, layer: 'back' }],
    a: { torso: -99, uarm: 66, farm: 74, thigh: 86, calf: 92 },
    b: { torso: -100, uarm: 66, farm: 74, thigh: 86, calf: 92 },
  },
  rest: {
    view: 'front', pin: 'feet', dur: 4.2, floor: 26, armLift: 45, yawn: true, label: 'Faultier steht und atmet durch',
    a: { torso: -90, head: -90, uarm_l: 108, farm_l: 96, uarm_r: 72, farm_r: 84, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -93, uarm_l: 104, farm_l: 94, uarm_r: 76, farm_r: 86, ...STAND_LEGS, tail: 0 },
  },
  // Ende der Pause: streckt die Arme Richtung Griff, macht sich bereit
  reach: {
    view: 'front', pin: 'feet', dur: 1.6, floor: 26, label: 'Faultier macht sich bereit',
    a: { torso: -90, head: -92, uarm_l: -110, farm_l: -96, uarm_r: -70, farm_r: -84, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -94, uarm_l: -114, farm_l: -98, uarm_r: -66, farm_r: -82, ...STAND_LEGS, tail: 0 },
  },
  wave: {
    view: 'front', pin: 'feet', dur: 1.4, mirror: ['farm_r'], label: 'Faultier winkt',
    a: { torso: -90, head: -92, uarm_l: 106, farm_l: 95, uarm_r: -30, farm_r: -70, ...STAND_LEGS, tail: 0 },
    b: { torso: -91, head: -88, uarm_l: 106, farm_l: 95, uarm_r: -34, farm_r: -110, ...STAND_LEGS, tail: 0 },
  },
  flex: {
    view: 'front', pin: 'feet', dur: 1.6, label: 'Faultier zeigt die Muskeln',
    a: { torso: -90, head: -90, uarm_l: 172, farm_l: -120, uarm_r: 8, farm_r: -60, ...STAND_LEGS, tail: 0 },
    b: { torso: -90, head: -90, uarm_l: 180, farm_l: -95, uarm_r: 0, farm_r: -85, ...STAND_LEGS, tail: 0 },
  },
};

// Hanteln räumlich: hinter jeder Scheibe in der Hand eine zweite, versetzte Scheibe mit Stange dazwischen,
// so liest man Kurz- und Langhantel statt einer einzelnen Scheibe (Seitenansicht zeigt die Stange von der Stirnseite)
for (const pose of Object.values(SLOTH_POSES)) {
  if (pose.view !== 'side') continue;
  const props = pose.props || [];
  props.slice().forEach((pr) => {
    if (pr.img !== 'plate' || typeof pr.at !== 'string' || pr.depth === false) return;
    const big = pr.k >= 1; // Langhantel: andere Scheibe auf der anderen Körperseite (hinter allem), Kurzhantel: dicht dahinter
    const d = big ? [26, -16] : [34, -20];
    // hinten anhängen: vorhandene Teil-Nummern (z. B. Seil an einem Gerät) bleiben gültig
    // Kurzhantel in der vorderen Hand: hinteres Ende liegt vor dem Rumpf, aber unter der Faust ('hand');
    // Kurzhantel in der hinteren Hand (layer mid) und Langhantel: hinter dem Körper
    const layer = big || pr.layer === 'mid' ? 'back' : 'hand';
    props.push({ bar: true, at: pr.at, dx: pr.dx || 0, dy: pr.dy || 0, d, w: big ? 16 : 12, layer },
      { ...pr, dx: (pr.dx || 0) + d[0], dy: (pr.dy || 0) + d[1], layer, far: true });
  });
}

// Kabeltürme bekommen einen eigenen Gewichtsstapel, der sich hebt, wenn das Seil länger wird
// (Stapel sitzt über den oberen Scheiben des Turmbilds; Masse in Turm-Blattkoordinaten)
for (const pose of Object.values(SLOTH_POSES)) {
  const props = pose.props || [];
  props.forEach((t, ti) => {
    if (t.img !== 'cable') return;
    const li = props.findIndex((p) => p.line && p.line.prop === ti);
    if (li < 0) return;
    const f = t.flip ? -1 : 1;
    props.push({ img: 'stack', at: [t.at[0] + f * (158 - 171) * t.k, t.at[1] + (787.5 - 838) * t.k], a: [347, 650], k: t.k * 0.585, flip: t.flip, layer: 'back', lift: li });
  });
}

/* Bewegungsbahn: welcher Punkt eine gestrichelte Hilfslinie bekommt (Hand am Gerät/Gewicht) */
function slothPathPoint(pose) {
  if (pose.path !== undefined) return pose.path;
  const ats = (pose.props || []).map((p) => p.at || p.to).filter((a) => typeof a === 'string');
  if (pose.view === 'side') return ats.includes('grip') ? 'grip' : ats.includes('fgrip') ? 'fgrip' : null;
  return ats.includes('hand_r') ? 'hand_r' : ats.includes('hand_l') ? 'hand_l' : null;
}
// Einheitliche Kamera: Bildausschnitt mindestens so hoch, damit liegende und stehende Figuren gleich gross wirken
const SLOTH_MIN_H = 780;

function slothRigBuild(pose, v2 = false) {
  const view = pose.view;
  const sit = v2 && view === 'front' && pose.legsFront; // sitzend von vorne: eigene Zeichnung (Oberschenkel zum Betrachter)
  // v2: Rückansicht mit erhobenen Armen nutzt die Hänge-Zeichnung (keine verbogene Schulter)
  const armsUp = view === 'back' && ((pose.a.uarm_l ?? 90) < 0 || (pose.a.uarm_r ?? 90) < 0);
  const vk = v2 ? (armsUp ? 'hang' : sit ? 'sit' : view) : view;
  const J = v2 ? { ...SLOTH_V2.joints[vk], ...(view === 'front' ? { face: SLOTH_V2.joints[vk].head } : {}) } : SLOTH_JOINTS[view];
  const A = v2 ? SLOTH_V2.anchors[vk] : SLOTH_ANCHORS[view];
  const tlen = (jj) => Math.hypot(jj.torso[1][0] - jj.torso[0][0], jj.torso[1][1] - jj.torso[0][1]);
  // Grösse wie die bisherige Figur, damit Geräte und Bänke weiter passen
  const KV = v2 ? tlen(SLOTH_JOINTS[view]) / tlen(SLOTH_V2.joints[vk === 'hang' ? 'back' : vk]) : 1;
  const holds = (pose.props || []).some((pr) => /^hand_/.test(pr.at || pr.to || '')); // Hantel oder Kabel in der Hand -> Faust
  const img2 = (n) => {
    if (!v2 || !n || n.startsWith('eq_')) return n;
    let m = n === 'side_body' ? 'v2side_torso' : n === 'side_face_neutral' ? 'v2side_face' : n === 'front_face_neutral' ? 'v2' + vk + '_head'
      : n.replace(/^(side|front|back)_/, 'v2' + vk + '_');
    if (vk === 'front' && holds) m = m.replace('_farm_', '_farmfist_');
    return SLOTH_V2.parts[m] ? m : null; // gibt es in v2 nicht (Schwanz, Gelenkkugeln) -> weglassen
  };
  const rad = (d) => d * Math.PI / 180;
  const rot = (v, d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (v, k) => [v[0] * k, v[1] * k];
  const a0 = (name) => { if (!J[name]) return 0; const [p, d] = J[name]; return Math.atan2(d[1] - p[1], d[0] - p[0]) * 180 / Math.PI; };
  // Teil so stellen, dass sein Nah-Gelenk auf P liegt und der Knochen in Weltrichtung deg zeigt
  // alt: Teil aus einer anderen v2-Zeichnung (z. B. hängender Arm beim einarmigen Hängen aus der Rückansicht)
  const place = (name, P, deg, img, km = 1, alt) => {
    const oldTail = v2 && name === 'tail'; // die neue Figur hat keinen eigenen Schwanz: den bisherigen nehmen
    const JJ = alt ? SLOTH_V2.joints[alt] : oldTail ? SLOTH_JOINTS[view] : J;
    if (!JJ[name]) return { skip: true, P, r: 0, p: [0, 0], k: 1, map: () => P, end: P };
    const [p, d, k0 = 1] = JJ[name], [q0, q1] = JJ[name], r = deg - Math.atan2(q1[1] - q0[1], q1[0] - q0[0]) * 180 / Math.PI;
    const k = k0 * km * (v2 && !oldTail ? KV : (SLOTH_SCALE[view][name] ?? 1));
    // sitzend von vorne verschwindet der Schwanz unter dem Gesäss
    let im = oldTail ? (vk !== 'sit' && SLOTH_PARTS[view + '_tail'] ? view + '_tail' : null) : img2(img || view + '_' + name);
    if (alt && im) im = SLOTH_V2.parts[im.replace('v2' + vk + '_', 'v2' + alt + '_')] ? im.replace('v2' + vk + '_', 'v2' + alt + '_') : im;
    return { img: im, skip: !im || undefined, P, r, p, k, map: (q) => add(P, mul(rot(sub(q, p), r), k)), end: add(P, mul(rot(sub(d, p), r), k)) };
  };
  const ball = (img, P) => { const im = img2(img), b = slothPartBox(im); if (!b) return { skip: true, P, end: P };
    return { img: im, P, r: 0, p: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], k: SLOTH_SCALE[view].ball ?? 1 }; };

  function side(s) {
    const q = {}, hk = pose.grip || 'hand', D = pose.depth || [-14, -8];
    const t = q.torso = place('torso', [0, 0], s.torso, 'side_body');
    q.head = place('face', t.map(A.face), s.torso + (s.nod || 0), 'side_face_neutral');
    // Schwanz-Winkel relativ zum Rumpf wie in der bisherigen Zeichnung
    const oa = (n) => { const [p, d] = SLOTH_JOINTS.side[n]; return Math.atan2(d[1] - p[1], d[0] - p[0]) * 180 / Math.PI; };
    q.tail = place('tail', t.map(A.tail), s.torso + oa('tail') - oa('torso') + (s.tail || 0));
    // v2: das hintere Bein liegt in der Zeichnung genau hinter dem vorderen. Bewegen sich beide Beine gleich,
    // zeigt eine versetzte zweite Kopie nur doppelte Umrisse -> dann hinteres Bein weglassen.
    const sameLegs = v2 && !pose.farFoot && ![pose.a, pose.b].some((k) => ['fthigh', 'fcalf', 'ffoot', 'legBend', 'kneeThigh', 'kneeCalf'].some((n) => k[n] != null));
    for (const far of [false, true]) {
      const x = far ? '_far' : '', raw = (k) => (far ? s['f' + k] ?? s[k] : s[k]);
      // relArms: Armwinkel relativ zum Rumpf (Arme drehen beim Aufrichten mit)
      const v = (k) => (raw(k) != null && ((pose.relArms && /arm|hand/.test(k)) || (pose.relLegs && /thigh|calf/.test(k))) ? raw(k) + s.torso : raw(k));
      const sh = add(t.map(A.shoulder), far ? D : [0, 0]), hip = add(t.map(A.hip), far ? D : [0, 0]);
      // len_/near_: Arm zeigt zum Betrachter bzw. von ihm weg (verkürzt, näher = grösser); hinten: flen_/fnear_
      const fore = (e, k) => { const L = raw('len_' + k) ?? 1, N = raw('near_' + k) ?? 1; if (L === 1 && N === 1) return e;
        const kk = Array.isArray(e.k) ? e.k : [e.k, e.k], d = sub(e.end, e.P);
        return { ...e, k: [kk[0] * L * N, kk[1] * N], end: add(e.P, mul(d, L * N)) }; };
      q['uarm' + x] = fore(place('uarm', sh, v('uarm'), 'side_uarm' + x), 'uarm');
      q['elbow' + x] = ball('side_elbow' + x, q['uarm' + x].end);
      if (hk === 'fist') { // Faust-Teil enthält den Unterarm: sitzt direkt am Ellbogen, kein eigener Unterarm
        q['farm' + x] = fore(place('fist', q['uarm' + x].end, v('farm'), 'side_fist' + x), 'farm');
        q['hand' + x] = { skip: true, end: q['farm' + x].end };
      } else {
        // Offene Hand: Unterarm und Krallenhand aus der Vorlage sind zusammen gut
        // doppelt so lang wie der Oberarm; auf menschliche Proportionen kürzen.
        const open = hk === 'hand';
        q['farm' + x] = place('farm', q['uarm' + x].end, v('farm'), 'side_farm' + x, open ? 0.82 : 1);
        q['hand' + x] = place(hk, q['farm' + x].end, v('hand') ?? v('farm'), 'side_' + hk + x, open ? 0.66 : 1);
      }
      q['thigh' + x] = place('thigh', hip, v('thigh'), 'side_thigh' + x);
      q['knee' + x] = ball('side_knee' + x, q['thigh' + x].end);
      if (pose.feet) { // eigener Fuss am Knöchel; foot = Weltwinkel Ferse -> Zehen (0 = flach nach vorne)
        q['calf' + x] = place('shin', q['thigh' + x].end, v('calf'), 'side_shin' + x);
        q['foot' + x] = place('foot', q['calf' + x].end, v('foot') ?? 20, 'side_foot' + x);
      } else {
        q['calf' + x] = place('calf', q['thigh' + x].end, v('calf'), 'side_calf' + x);
        q['foot' + x] = { skip: true, end: q['calf' + x].end };
      }
      // farFoot: [dx, dy] hinterer Knöchel bleibt fest relativ zum vorderen (z. B. auf der Bank),
      // Oberschenkel/Unterschenkel per Zweigelenk-IK, Knie zeigt nach unten
      if (far && pose.farFoot) {
        const T = add(q.calf.end, pose.farFoot), len = (e) => Math.hypot(e.end[0] - e.P[0], e.end[1] - e.P[1]);
        const L1 = len(q.thigh_far), L2 = len(q.calf_far), dv = sub(T, hip);
        const d = Math.min(Math.max(Math.hypot(dv[0], dv[1]), Math.abs(L1 - L2) + 1), L1 + L2 - 0.01);
        const base = Math.atan2(dv[1], dv[0]) * 180 / Math.PI, al = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)) * 180 / Math.PI;
        const th = [base + al, base - al].map((deg) => place('thigh', hip, deg, 'side_thigh_far')).sort((m, n) => n.end[1] - m.end[1])[0];
        const cv = sub(T, th.end);
        q.thigh_far = th;
        q.knee_far = ball('side_knee_far', th.end);
        q.calf_far = place('calf', th.end, Math.atan2(cv[1], cv[0]) * 180 / Math.PI + (pose.farFoot[2] || 0), 'side_calf_far');
      }
    }
    // v2: das ganze Bein (Gesäss/Oberschenkel, Unterschenkel mit Fuss) gibt es gezeichnet stehend und in drei
    // Beugungen aus einem Blatt. Je nach Hüftbeugung (Winkel Rumpf -> Oberschenkel) wird zur passenden Zeichnung
    // übergeblendet. Alle Stellungen haben dieselben Längen.
    if (sameLegs) for (const k of ['thigh_far', 'knee_far', 'calf_far', 'foot_far']) if (q[k]) q[k] = { skip: true, P: q[k].P, end: q[k].end };
    if (v2 && J.flex) for (const x of ['', '_far']) {
      const th = q['thigh' + x];
      if (!th || th.skip) continue;
      const [b0, b1] = J.thigh, deg = th.r + Math.atan2(b1[1] - b0[1], b1[0] - b0[0]) * 180 / Math.PI;
      const f = ((s.torso + 180 - deg) % 360 + 540) % 360 - 180, F = J.flex;
      const ks = Object.keys(F).sort((m, n) => F[m] - F[n]);
      // weicher Übergang (±6°) in der Mitte zwischen zwei Zeichnungen; die untere wird erst ausgeblendet,
      // wenn die obere ganz deckt (kein Durchscheinen nach hinten)
      const ramp = (lo, hi) => { const u = Math.min(1, Math.max(0, (f - lo) / (hi - lo))); return u * u * (3 - 2 * u); };
      const op = ks.map((k, i) => (i === 0 ? 1 : ramp((F[ks[i - 1]] + F[k]) / 2 - 6, (F[ks[i - 1]] + F[k]) / 2 + 6)));
      // Füsse am Boden (fester Knöchel): Knie beugt so stark wie in den Zeichnungen (stetig nach Hüftbeugung) –
      // so bleibt der Fuss flach und die Bewegung sieht aus wie gezeichnet
      const planted = (x === '' && pose.pin === 'ankle') || (x === '_far' && pose.pin === 'fankle');
      if (planted && !pose.feet && pose.drawnKnee !== false && J.kneeBend) {
        const kbv = ks.map((k) => J.kneeBend[k]), fv = ks.map((k) => F[k]);
        let rel = kbv[0];
        for (let i = 1; i < ks.length; i++) if (f >= fv[i - 1]) rel = kbv[i - 1] + (kbv[i] - kbv[i - 1]) * Math.min(1, (f - fv[i - 1]) / (fv[i] - fv[i - 1]));
        if (f < fv[0]) rel = kbv[0] * Math.max(0, f / fv[0]);
        q['calf' + x] = place('calf', th.end, deg + rel, 'side_calf' + x);
      }
      const ca = q['calf' + x], cDeg = ca && !ca.skip ? ca.r + a0('calf') : null;
      ks.forEach((k, i) => {
        const o = op[i + 1] >= 1 ? 0 : op[i], sfx = k.slice(5); // '' | 'A' | 'B' | 'C'
        // Unterschenkel je Stellung ohne Fuss; der Fuss ist für alle Stellungen derselbe (nie zwei Füsse)
        if (!sfx) { th.o = o; if (!pose.feet && cDeg != null) q['calf' + x] = { ...place('shin', th.end, cDeg, 'side_shin' + x), o }; return; }
        q[k + x] = { ...place(k, th.P, deg, 'side_' + k + x), o };
        if (!pose.feet && cDeg != null) q['calf' + sfx + x] = { ...place('shin' + sfx, th.end, cDeg, 'side_shin' + sfx + x), o };
      });
      if (!pose.feet && cDeg != null) {
        // Fuss am Knöchel: auf dem Boden flach wie gezeichnet, sonst mit dem Unterschenkel mitgedreht
        const fDeg = planted ? a0('foot') : cDeg + a0('foot') - a0('shin');
        q['foot' + x] = place('foot', q['calf' + x].end, fDeg, 'side_foot' + x);
      }
    }
    for (const k of pose.mirror || []) q[k].k = [q[k].k, -q[k].k]; // Teil an der Knochenachse spiegeln
    return { q, pts: { wrist: q.farm.end, ankle: q.calf.end, grip: q.hand.end, knee: q.thigh.end, elbow: q.uarm.end,
      fwrist: q.farm_far.end, fankle: q.calf_far.end, fknee: q.thigh_far.end, fgrip: q.hand_far.end,
      shoulder: t.map(A.shoulder), hip: t.map(A.hip) } };
  }

  function frontBack(s) {
    const q = {};
    const t = q.torso = place('torso', [0, 0], s.torso);
    q.head = view === 'front' ? place('face', t.map(A.neck), s.head, 'front_face_neutral') : place('head', t.map(A.neck), s.head);
    q.tail = place('tail', t.map(A.tail), s.torso + 180 + (s.tail || 0));
    const arm = (k) => s[k] + (pose.relArms ? s.torso + 90 : 0), leg = (k) => s[k] + (pose.relLegs ? s.torso + 90 : 0);
    // len_<teil>: Glied verkürzt (zeigt zum Betrachter, z. B. Arme kommen beim Butterfly nach vorne)
    // near_<teil>: Glied kommt zum Betrachter -> insgesamt etwas grösser (Perspektive)
    // v2: len_farm ~0 war nur ein Behelf der alten Greifhand (brachte Unterarm mit); die neue hat einen echten Unterarm
    const shorten = (e, key) => { const L0 = s['len_' + key] ?? 1, L = v2 && L0 > 0 && L0 < 0.05 && /^farm_/.test(key) ? 1 : L0, N = s['near_' + key] ?? 1; if (L === 1 && N === 1) return e;
      const d = sub(e.end, e.P); return { ...e, k: [e.k * L * N, e.k * N], end: add(e.P, mul(d, L * N)) }; };
    for (const x of ['l', 'r']) {
      const sh = A['sh_' + x];
      // armLift hob bei der alten Figur das Schultergelenk an (hängende Arme); die neue hat echte Schultern
      // hängender Arm in der Hänge-Ansicht (je Übung fest, nicht je Bild – sonst springt das Teil)
      const alt = vk === 'hang' && [pose.a, pose.b].every((k) => (k['uarm_' + x] ?? 90) > 45) ? 'back' : undefined;
      q['uarm_' + x] = shorten(place('uarm_' + x, t.map([sh[0], sh[1] - (v2 ? 0 : pose.armLift || 0)]), arm('uarm_' + x), undefined, 1, alt), 'uarm_' + x);
      q['farm_' + x] = shorten(place('farm_' + x, q['uarm_' + x].end, arm('farm_' + x), undefined, 1, alt), 'farm_' + x);
      if (J['grip_' + x]) {
        const gk = s['grip_' + x] != null ? 'grip_' + x : 'farm_' + x; // ohne eigenen Winkel: Hand in Verlängerung des Unterarms
        q['grip_' + x] = shorten(place('grip_' + x, q['farm_' + x].end, arm(gk), undefined, 1, alt), s['len_grip_' + x] != null ? 'grip_' + x : 'farm_' + x);
      }
      q['thigh_' + x] = shorten(place('thigh_' + x, t.map(A['hip_' + x]), leg('thigh_' + x)), 'thigh_' + x);
      q['calf_' + x] = shorten(place('calf_' + x, q['thigh_' + x].end, leg('calf_' + x)), 'calf_' + x);
      if (view === 'back') q['elbow_' + x] = ball('back_elbow_' + x, q['uarm_' + x].end);
    }
    // join: { arm, to, bend } — dieser Arm greift per Zweigelenk-IK an einen Punkt des anderen Arms
    // (beide Hände am selben Griff); bend ±1 wählt, auf welcher Seite der Ellbogen liegt
    if (pose.join) {
      const { arm: x, to, bend = 1 } = pose.join, u = q['uarm_' + x], f = q['farm_' + x];
      const T = q[to.replace('hand', 'farm')].end, S = u.P, len = (e) => Math.hypot(e.end[0] - e.P[0], e.end[1] - e.P[1]);
      const L1 = len(u), L2 = len(f), dv = sub(T, S);
      const d = Math.min(Math.max(Math.hypot(dv[0], dv[1]), Math.abs(L1 - L2) + 1), L1 + L2 - 0.01);
      const al = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)) * 180 / Math.PI;
      q['uarm_' + x] = place('uarm_' + x, S, Math.atan2(dv[1], dv[0]) * 180 / Math.PI + bend * al);
      const E = q['uarm_' + x].end, fv = sub(T, E);
      q['farm_' + x] = place('farm_' + x, E, Math.atan2(fv[1], fv[0]) * 180 / Math.PI);
    }
    // mirror: Teile an ihrer Knochenachse spiegeln (z. B. Hand beim Winken mit Krallen nach innen)
    for (const k of pose.mirror || []) { const kk = Array.isArray(q[k].k) ? q[k].k[0] : q[k].k; q[k].k = [kk, -kk]; }
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
    for (const k in q) q[k] = q[k].skip ? { skip: true } : { img: q[k].img, P: sub(q[k].P, pin), r: q[k].r, p: q[k].p, k: q[k].k, o: q[k].o };
    const pathPt = slothPathPoint(pose);
    if (pathPt && pts[pathPt]) Object.defineProperty(q, 'path', { value: sub(pts[pathPt], pin), enumerable: false });
    // Requisiten: an einem Punkt der Figur (z. B. 'grip') oder fest im Bild ([x, y] relativ zum festen Punkt)
    (pose.props || []).forEach((pr, i) => {
      const pt = (at) => (Array.isArray(at) ? at : sub(pts[at], pin));
      if (pr.bar) { // Hantelstange von der Scheibe in der Hand schräg nach hinten zur zweiten Scheibe
        const A0 = add(pt(pr.at), [pr.dx, pr.dy]);
        q['prop' + i] = { line: true, bar: true, P: A0, r: Math.atan2(pr.d[1], pr.d[0]) * 180 / Math.PI, p: [0, 0], k: [Math.hypot(pr.d[0], pr.d[1]), pr.w / 6] };
        return;
      }
      if (pr.line) { // Seil von line zum Punkt to (Rechteck, in der Länge gestreckt)
        // line: [x, y] fest, Punktname der Figur, oder { prop: i, pt: [x, y] } = Punkt auf einem Gerät (Blatt-Koordinaten)
        const onProp = (o) => { const e = q['prop' + o.prop], [kx, ky] = Array.isArray(e.k) ? e.k : [e.k, e.k];
          return add(e.P, rot([(o.pt[0] - e.p[0]) * kx, (o.pt[1] - e.p[1]) * ky], e.r)); };
        const A0 = pr.line.prop != null ? onProp(pr.line) : pt(pr.line), B = pt(pr.to), d = sub(B, A0);
        q['prop' + i] = { line: true, P: A0, r: Math.atan2(d[1], d[0]) * 180 / Math.PI, p: [0, 0], k: [Math.hypot(d[0], d[1]), 1] };
        return;
      }
      const b = SLOTH_PARTS['eq_' + pr.img], p = pr.a || [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], k = pr.k || 1;
      q['prop' + i] = { img: 'eq_' + pr.img, P: add(pt(pr.at), [pr.dx || 0, pr.dy || 0]), r: (pr.r || 0) + (pr.turn ? s.torso : 0), p, k: pr.flip ? [-k, k] : k, far: pr.far };
    });
    return q;
  };
}

/* Gesicht: blinzelt immer mal, schreit am härtesten Punkt ('b' = Stellung b, 'a' = Stellung a),
   gähnt in der Pause (yawn). Ruhige Übungen (Dehnen, Mobilität, Laufen, Pausen) ohne Schrei. */
const SLOTH_CALM = new Set(['plank', 'hollow', 'squathold', 'wallsit', 'catcow', 'wgs', 'thoracic', 'legswing', 'anklerock',
  'neck', 'jefferson', 'standwaage', 'shuffle', 'quickfeet', 'hops', 'bounds', 'sprint', 'couch', 'figurefour', 'hipcircle',
  'lateralLunge', 'quadstretch', 'calfstretch', 'adductor', 'highknees', 'mountain', 'jumprope', 'ladder', 'wristmob', 'doorway',
  'birddog', 'deadbug', 'swimmer', 'ytw', 'heeltouch', 'pinlift', 'rest', 'reach', 'wave', 'scapula']);
const SLOTH_EFFORT_THRESHOLD = 0.8;

/* Tempo wie im Training statt Gleichtakt: kraftvoll hin (konzentrisch), kurz halten, langsam zurück.
   SLOTH_ECC_AB: Übungen, bei denen a -> b das Absenken ist (dort a -> b langsam, b -> a zügig). */
const SLOTH_ECC_AB = new Set(['pushup', 'squat', 'splitsquat', 'lunge', 'goblet', 'sumosquat', 'benchpress', 'dbbench', 'inclinebench',
  'declinebench', 'skullcrusher', 'dbpullover', 'dips', 'rdl', 'abwheel']);
const SLOTH_NO_TEMPO = new Set(['hang', 'hang1l', 'hang1r', 'flex', 'wave', 'pinlift', 'sideplank', 'frontlever']);
const SLOTH_KEYS_CON = [[0, 0], [0.3, 1], [0.42, 1], [0.92, 0], [1, 0]];
const SLOTH_KEYS_ECC = [[0, 0], [0.5, 1], [0.58, 1], [0.9, 0], [1, 0]];
const slothKeys = (name, pose) => pose.keys || (SLOTH_CALM.has(name) || SLOTH_NO_TEMPO.has(name) || pose.view === 'back' ? [[0, 0], [0.5, 1], [1, 0]]
  : SLOTH_ECC_AB.has(name) ? SLOTH_KEYS_ECC : SLOTH_KEYS_CON);

const slothRigCache = {};
function slothRigPrepare(poseName) {
  const v2 = slothV2On(), name = v2 ? poseName + '-v2' : poseName; // eigener CSS-/Cache-Name je Figur
  if (slothRigCache[name]) return slothRigCache[name];
  const base0 = SLOTH_POSES[poseName], o2 = v2 && base0.v2; // v2: eigene Winkel, wo die neue Zeichnung anders sitzt
  const pose = o2 ? { ...base0, ...o2, a: { ...base0.a, ...o2.a }, b: { ...base0.b, ...o2.b } } : base0;
  const build = slothRigBuild(pose, v2);
  const keys = slothKeys(poseName, pose);
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
  const N = 24, frames = [], calmTail = [];
  for (let i = 0; i <= N; i++) {
    const m = amount(i / N), s = {};
    for (const k of new Set([...Object.keys(pose.a), ...Object.keys(pose.b)])) {
      const a = pose.a[k] ?? (/^(len|near)_/.test(k) ? 1 : pose.b[k]); // fehlt in a: Länge 1, sonst wie b
      s[k] = a + ((pose.b[k] ?? a) - a) * m;
    }
    calmTail.push(build({ ...s }).tail); // Stufe "Ruhig": Schwanz ohne Nachschwingen
    // Nachschwingen: der Schwanz pendelt der Bewegung etwas hinterher
    s.tail = (s.tail || 0) + 7 * Math.sin(2 * Math.PI * i / N - 1.2);
    frames.push(build(s));
  }
  // Drehwinkel über die Stellungen stetig machen: springt ein Winkel von 180° auf -178°, würde die
  // CSS-Animation das Teil einmal fast ganz herumdrehen (sichtbares Zucken)
  for (const key of Object.keys(frames[0])) {
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1][key], cur = frames[i][key];
      if (!prev || !cur || prev.skip || cur.skip || cur.r == null) continue;
      while (cur.r - prev.r > 180) cur.r -= 360;
      while (cur.r - prev.r < -180) cur.r += 360;
    }
  }
  // Überblend-Teile: nie sichtbar -> weglassen; immer ganz sichtbar -> ohne Deckkraft-Animation
  for (const key of Object.keys(frames[0])) {
    if (frames.every((f) => f[key].o == null)) continue;
    if (frames.every((f) => f[key].skip || f[key].o === 0)) frames.forEach((f) => { f[key] = { skip: true }; });
    else if (frames.every((f) => f[key].o === 1)) frames.forEach((f) => { delete f[key].o; });
  }
  // Gewichtsstapel heben: halbe Seilverlängerung gegenüber der kürzesten Stellung
  (pose.props || []).forEach((pr, i) => {
    if (pr.lift == null) return;
    const lens = frames.map((f) => f['prop' + pr.lift].k[0]), min = Math.min(...lens);
    frames.forEach((f, j) => { f['prop' + i].P = [f['prop' + i].P[0], f['prop' + i].P[1] - Math.min((lens[j] - min) * 0.5, 110)]; });
  });
  // Requisiten einsortieren: 'back' hinter allem, 'mid' zwischen hinterer und vorderer Seite, sonst vorne
  // armsFront: Arme vor dem Rumpf zeichnen (Vorderansicht, Arme kreuzen die Brust)
  let base = SLOTH_ORDER[pose.view];
  // gebeugte Oberschenkel-Zeichnungen direkt über dem stehenden Oberschenkel
  const flexKeys = Object.keys(SLOTH_V2.joints.side.flex || {}).filter((k) => k !== 'thigh').sort((m, n) => SLOTH_V2.joints.side.flex[m] - SLOTH_V2.joints.side.flex[n]);
  base = base.flatMap((k) => { const m = /^(thigh|calf)(_far)?$/.exec(k); return m && pose.view === 'side' ? [k, ...flexKeys.map((f) => m[1] + f.slice(5) + (m[2] || ''))] : [k]; });
  if (pose.armsFront) { const arms = base.filter((k) => /arm/.test(k)); base = base.filter((k) => !/arm/.test(k)); base.splice(base.indexOf('torso') + 1, 0, ...arms); }
  // drawLast: Teile ganz nach vorne holen (z. B. gefalteter Unterschenkel vor dem eigenen Oberschenkel)
  if (pose.drawLast) { base = base.filter((k) => !pose.drawLast.includes(k)); base.push(...pose.drawLast); }
  // legsFront: Beine vor dem Rumpf (sitzend von vorne, Oberschenkel kommen zum Betrachter)
  if (pose.legsFront) { const legs = base.filter((k) => /thigh|calf/.test(k)); base = base.filter((k) => !/thigh|calf/.test(k)); base.splice(base.indexOf('head') + 1, 0, ...legs.filter((k) => /calf/.test(k)), ...legs.filter((k) => /thigh/.test(k))); }
  const props = (pose.props || []).map((pr, i) => [pr.layer || 'front', 'prop' + i]);
  const mid = base.indexOf(pose.view === 'side' ? 'tail' : 'torso');
  const order = [...props.filter((x) => x[0] === 'back').map((x) => x[1]), ...base.slice(0, mid),
    ...props.filter((x) => x[0] === 'mid').map((x) => x[1]), ...base.slice(mid), ...props.filter((x) => x[0] === 'front').map((x) => x[1])];
  // 'hand': direkt unter dem vorderen Unterarm/Faust (Seitenansicht), z. B. hinteres Ende einer Kurzhantel
  const handProps = props.filter((x) => x[0] === 'hand').map((x) => x[1]);
  if (handProps.length) order.splice(order.indexOf(pose.view === 'side' ? 'farm' : 'torso') + (pose.view === 'side' ? 0 : 1), 0, ...handProps);
  // Umriss über alle Stellungen -> viewBox
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of frames) for (const key of order) {
    if (!f[key] || f[key].line || f[key].skip || f[key].o === 0) continue;
    const { img, P, r, p, k } = f[key], b = slothPartBox(img), [kx, ky] = Array.isArray(k) ? k : [k, k];
    const c = Math.cos(r * Math.PI / 180), s = Math.sin(r * Math.PI / 180);
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      const dx = (x - p[0]) * kx, dy = (y - p[1]) * ky, wx = P[0] + dx * c - dy * s, wy = P[1] + dx * s + dy * c;
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
    }
  }
  if (pose.floor != null) y1 = Math.max(y1, pose.floor + 6);
  if (pose.wall) { x0 = Math.min(x0, pose.wall.x - 4); x1 = Math.max(x1, pose.wall.x + 30); }
  if (y1 - y0 < SLOTH_MIN_H) y0 = y1 - SLOTH_MIN_H; // nach oben auffüllen, Boden bleibt unten
  const padX = (x1 - x0) * 0.02, padY = (y1 - y0) * 0.02;
  const box = [x0 - padX, y0 - padY, x1 - x0 + 2 * padX, y1 - y0 + 2 * padY].map((v) => Math.round(v));
  const n = (v) => +v.toFixed(1);
  const sc = (e) => (Array.isArray(e.k) ? ` scale(${n(e.k[0])}, ${n(e.k[1])})` : e.k !== 1 ? ` scale(${e.k})` : '');
  // SVG-Attribut (Startstellung) und CSS-Transform (Keyframes) derselben Stellung
  const tfAttr = (e) => `translate(${n(e.P[0])} ${n(e.P[1])}) rotate(${+e.r.toFixed(2)})${sc(e)} translate(${n(-e.p[0])} ${n(-e.p[1])})`;
  const tfCss = (e) => `translate(${n(e.P[0])}px,${n(e.P[1])}px) rotate(${+e.r.toFixed(2)}deg)${sc(e)} translate(${n(-e.p[0])}px,${n(-e.p[1])}px)`;
  const css = [];
  for (const key of order) {
    if (!frames[0][key] || frames[0][key].skip) continue;
    const op = (e) => (e.o != null ? `;opacity:${+e.o.toFixed(2)}` : '');
    const steps = frames.map((f, i) => `${+(i * 100 / N).toFixed(2)}%{transform:${tfCss(f[key])}${op(f[key])}}`).join('');
    css.push(`@keyframes srk-${name}-${key}{${steps}}.sr-${name} .sp-${key}{animation:srk-${name}-${key} ${pose.dur}s linear infinite;animation-delay:var(--srd,0s)}`);
  }
  if (frames[0].tail && !frames[0].tail.skip) {
    for (let i = 1; i < calmTail.length; i++) { while (calmTail[i].r - calmTail[i - 1].r > 180) calmTail[i].r -= 360; while (calmTail[i].r - calmTail[i - 1].r < -180) calmTail[i].r += 360; }
    const steps = calmTail.map((f, i) => `${+(i * 100 / N).toFixed(2)}%{transform:${tfCss(f)}}`).join('');
    css.push(`@keyframes srk-${name}-tail-calm{${steps}}.anim-calm .sr-${name} .sp-tail{animation-name:srk-${name}-tail-calm}`);
  }
  // Gesichter: Ebenen über dem neutralen Kopf, per Deckkraft umgeschaltet
  const effort = pose.effort ?? (SLOTH_CALM.has(poseName) ? false : 'b');
  const faceLayers = (img) => ['blink', ...(pose.yawn ? ['yawn'] : []), ...(effort ? ['effort'] : [])]
    .map((l) => [l, img.replace('_neutral', '_' + l)]).filter(([, im]) => SLOTH_PARTS[im]);
  if (effort) {
    // Schrei-Zeitfenster aus dem Bewegungsverlauf: sichtbar, solange die Stellung nahe am härtesten Punkt ist
    const on = (t) => { const m = amount(t); return effort === 'a' ? m < 1 - SLOTH_EFFORT_THRESHOLD : m > SLOTH_EFFORT_THRESHOLD; };
    const kf = []; let prev = null;
    for (let i = 0; i <= 200; i++) { const v = on(i / 200); if (v !== prev) { kf.push(`${i / 2}%{opacity:${v ? 1 : 0}}`); prev = v; } }
    css.push(`@keyframes srf-${name}{${kf.join('')}}.sr-${name} .sf-effort{animation:srf-${name} ${pose.dur}s steps(1,end) infinite;animation-delay:var(--srd,0s)}`);
  }
  if (!slothRigCache._faceCss) {
    slothRigCache._faceCss = true;
    css.push('.sloth-rig .sf-blink,.sloth-rig .sf-yawn,.sloth-rig .sf-effort{opacity:0}'
      + '@keyframes sr-blink{0%{opacity:0}93%{opacity:1}96.5%{opacity:0}}.sloth-rig .sf-blink{animation:sr-blink 4.3s steps(1,end) infinite}'
      + '@keyframes sr-yawn{0%{opacity:0}6%{opacity:1}24%{opacity:0}}.sloth-rig .sf-yawn{animation:sr-yawn 14s steps(1,end) infinite;animation-delay:-2s}');
  }
  const style = document.createElement('style');
  style.textContent = css.join('\n');
  document.head.appendChild(style);
  const parts = order.map((key) => {
    const e = frames[0][key];
    if (!e || e.skip) return '';
    if (e.line) return `<g class="sp-${key}" transform="${tfAttr(e)}"><rect class="${e.bar ? 'sloth-rig-handle' : 'sloth-rig-cable'}" x="0" y="-3" width="1" height="6"/></g>`;
    const img = (im, cls = '') => { const b = slothPartBox(im); return `<image${cls ? ` class="${cls}"` : ''} href="${slothPartHref(im)}" x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}"/>`; };
    const extra = key === 'head' && /_face_neutral$/.test(e.img) ? faceLayers(e.img).map(([l, im]) => img(im, 'sf-' + l)).join('') : '';
    return `<g class="sp-${key}${e.far ? ' sp-far' : ''}" transform="${tfAttr(e)}"${e.o != null ? ` opacity="${+e.o.toFixed(2)}"` : ''}>${img(e.img)}${extra}</g>`;
  }).join('');
  let extra = '';
  // Bahn der Hand über einen Durchgang, nur wenn sie sich merklich bewegt
  const path = frames.map((f) => f.path).filter(Boolean);
  if (path.length && Math.hypot(...[0, 1].map((a) => Math.max(...path.map((p) => p[a])) - Math.min(...path.map((p) => p[a])))) > 60) {
    extra += `<polyline class="sloth-rig-path" points="${path.map((p) => `${n(p[0])},${n(p[1])}`).join(' ')}"/>`;
  }
  // Seilspringen: Seil als Ellipse um die Figur, nur ein Bogen sichtbar, der einmal pro Sprung herumläuft
  if (pose.rope) {
    const rx = box[2] * 0.4, ry = box[3] * 0.47, cx = box[0] + box[2] / 2, cy = box[1] + box[3] * 0.5;
    style.textContent += `\n@keyframes srr-${name}{to{stroke-dashoffset:-100}}.sr-${name} .sloth-rig-rope{animation:srr-${name} ${pose.dur}s linear infinite;animation-delay:var(--srd,0s)}`;
    extra += `<ellipse class="sloth-rig-rope" pathLength="100" stroke-dasharray="46 54" cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/>`;
  }
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

/* Ganze Posen als Bilder (tools/sloth-rig/sheets/poses_extra.jpg): wechseln per
   Überblendung. anchor = Punkt am Boden unter der Körpermitte (Blatt-Koordinaten),
   damit beide Bilder deckungsgleich stehen. Nur ein Bild: leichtes Atmen. */
const SLOTH_SWAPS = {
  russian: { imgs: [['pose_russian_a', [355, 220]], ['pose_russian_b', [824, 220]]], dur: 2.4, label: 'Russian Twist' },
  ninety: { imgs: [['pose_ninety', [418, 434]]], dur: 4, label: '90/90-Dehnung' },
  frog: { imgs: [['pose_frog_a', [397, 619]], ['pose_frog_b', [858, 614]]], dur: 3.6, label: 'Frog Stretch' },
};
function slothSwapFigure(name, cls) {
  const sw = SLOTH_SWAPS[name];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const imgs = sw.imgs.map(([img, [ax, ay]], i) => {
    const b = SLOTH_PARTS[img], x = b[0] - ax, y = b[1] - ay, w = b[2] - b[0], h = b[3] - b[1];
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
    return `<image class="sw-${i}" href="${SLOTH_RIG_BASE}${img}.png" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  });
  if (!slothRigCache['swap:' + name]) {
    const st = document.createElement('style');
    st.textContent = sw.imgs.length > 1
      ? `@keyframes srs-${name}{0%,38%{opacity:1}50%,88%{opacity:0}100%{opacity:1}}.sr-${name} .sw-0{animation:srs-${name} ${sw.dur}s ease-in-out infinite;animation-delay:var(--srd,0s)}`
        + `@keyframes srs-${name}-b{0%,38%{opacity:0}50%,88%{opacity:1}100%{opacity:0}}.sr-${name} .sw-1{animation:srs-${name}-b ${sw.dur}s ease-in-out infinite;animation-delay:var(--srd,0s)}`
      : `@keyframes srs-${name}{0%,100%{transform:scale(1)}50%{transform:scale(1.015,1.03)}}.sr-${name} .sw-0{transform-box:fill-box;transform-origin:50% 100%;animation:srs-${name} ${sw.dur}s ease-in-out infinite;animation-delay:var(--srd,0s)}`;
    document.head.appendChild(st);
    slothRigCache['swap:' + name] = true;
  }
  const pad = 20, w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
  const shadow = `<ellipse class="sloth-rig-shadow" cx="0" cy="-4" rx="${Math.round((x1 - x0) * 0.4)}" ry="10"/>`;
  return `<svg class="sloth-rig sr-${name} ${cls}" data-dur="${sw.dur}" viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}" width="${Math.round(w / 1.5)}" height="${Math.round(h / 1.5)}" role="img" aria-label="${sw.label}">${shadow}${imgs.join('')}</svg>`;
}

// SVG-Markup einer Pose, z. B. slothFigure('hang', 'ex-figure sloth-img')
function slothFigure(name, cls = '') {
  if (SLOTH_SWAPS[name]) return slothSwapFigure(name, cls);
  const r = slothRigPrepare(name), [x, y, w, h] = r.box, nm = slothV2On() ? name + '-v2' : name;
  return `<svg class="sloth-rig sr-${nm} ${cls}" data-dur="${SLOTH_POSES[name].dur}" viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w / 3)}" height="${Math.round(h / 3)}" role="img" aria-label="${SLOTH_POSES[name].label}">${r.body}</svg>`;
}

/* Die App baut den Ablauf-Bildschirm immer wieder neu auf (innerHTML); jede neu
   eingesetzte Figur würde ihre Animation von vorne beginnen und springen. Darum
   läuft die Animation nach der Uhr: beim Einsetzen bekommt die Figur eine negative
   Verzögerung (--srd) passend zur aktuellen Zeit und macht nahtlos weiter. */
function slothRigSync(root) {
  const list = root.matches && root.matches('.sloth-rig[data-dur]') ? [root] : root.querySelectorAll ? root.querySelectorAll('.sloth-rig[data-dur]') : [];
  for (const svg of list) {
    // anderer Übungswechsel im selben Behälter: kurz einblenden statt hart umschalten
    const box = svg.parentElement, pose = [...svg.classList].find((c) => c.startsWith('sr-'));
    if (box) { if (box.__srPose && box.__srPose !== pose) svg.classList.add('sr-enter'); box.__srPose = pose; }
    const dur = +svg.dataset.dur;
    svg.style.setProperty('--srd', `${-((Date.now() / 1000) % dur).toFixed(3)}s`);
  }
}
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  const start = () => {
    slothRigSync(document.body);
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) slothRigSync(n); })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}

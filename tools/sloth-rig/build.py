"""Zerlegt die Faultier-Vorlagen (sheets/*.jpg) in Einzelteile für die Puppe.

Jede Vorlage: Teile durch weisse Lücken getrennt, weisser Hintergrund.
Ausgabe: assets/sloth/rig/<ansicht>_<teil>.png in Schwarzweiss (Graustufe +
Transparenz) und die Teil-Rechtecke im Block PARTS in beta/js/sloth-rig-data.js.

Aufruf aus dem Repo-Stamm:  python3 tools/sloth-rig/build.py
Braucht: pip install pillow numpy scipy
"""
import json, os, re
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'assets', 'sloth', 'rig')
RIG_JS = os.path.join(ROOT, 'beta', 'js', 'sloth-rig-data.js')

# Teil-Nummern = Zusammenhangskomponenten der Vorlage (siehe --list)
SHEETS = {
    'front': ('front.jpg', {'head': [5], 'torso': [25], 'uarm_l': [27], 'uarm_r': [28], 'farm_l': [29], 'farm_r': [30],
                            'thigh_l': [70], 'thigh_r': [71], 'tail': [72], 'calf_l': [87], 'calf_r': [88]}),
    'back': ('back.jpg', {'head': [5], 'torso': [25], 'uarm_l': [27], 'uarm_r': [28], 'farm_l': [29], 'farm_r': [30],
                          'elbow_l': [33], 'elbow_r': [31], 'grip_l': [97], 'grip_r': [100], 'thigh_l': [84], 'thigh_r': [83],
                          'tail': [102], 'calf_l': [103], 'calf_r': [104]}),
}

# Seitenansicht: aus zwei Blättern, hintere Gliedmassen = abgedunkelte Kopie (_far)
SIDE = [
    ('side.jpg', {'torso': [35], 'tail': [85], 'uarm': [36], 'elbow': [39], 'farm': [55], 'hand': [84],
                  'thigh': [89], 'knee': [132], 'calf': [172]}),
    ('side_extra.jpg', {'fist': [32], 'foot': [38]}),
    ('arms_extra.jpg', {'flat': [104]}),
]
SIDE_FAR = ['uarm', 'elbow', 'farm', 'hand', 'fist', 'flat', 'thigh', 'knee', 'calf', 'shin', 'foot']
FAR_DARK = 0.5
# Unterschenkel ohne Fuss: alles unterhalb des Knöchels wegschneiden
SIDE_SHIN_CUT = [(1000, 792, 1200, 900)]
# Weisse Ringe der Gelenk-Pfannen am Rumpf dunkel füllen: (Mitte, Radius)
SIDE_SOCKETS = [((544, 295), 40), ((586, 513), 40)]

# Ganze Posen (Überblendung zwischen zwei Bildern) für Übungen, die die Puppe nicht zeigen kann
POSES = ('poses_extra.jpg', {'russian_a': [2], 'russian_b': [1], 'ninety': [5], 'frog_a': [8], 'frog_b': [9],
                             'extrot_a': [15], 'extrot_b': [14]})

# Geräte (Requisiten), Teil-Nummern je Blatt in sheets/equipment/
EQUIP = {
    'geraete.jpg': {'plate': [1], 'kettlebell': [2], 'dumbbell': [3], 'dhandle': [54], 'rope': [53], 'ring': [52],
                    'barend': [96], 'bench': [98], 'incline': [95], 'decline': [97], 'cable': [114], 'dipstation': [168], 'rack': [167]},
    'maschinen.jpg': {'latpull': [1], 'legpress': [2], 'legext': [3], 'legcurl': [4], 'butterfly': [71], 'abduction': [73],
                      'calfseated': [74], 'calfstanding': [72], 'hyperext': [166], 'pullover': [164], 'tbar': [165]},
    'kleinteile.jpg': {'abwheel': [2], 'jumprope': [1], 'ladder': [29], 'stepbox': [28], 'band': [63], 'mat': [62]},
}

# Bereiche, die aus einem Gerät entfernt werden (x0, y0, x1, y1 im Blatt): Griff am Kabelturm, Stange am Latzug
EQUIP_ERASE = {'cable': [(214, 652, 256, 714)], 'latpull': [(115, 52, 242, 90)], 'stack': [(290, 651, 400, 680)]}

# Gesichter (Gemini-Bögen): Kopf-Varianten, alle in den Rahmen des neutralen Kopfes verschoben,
# damit sie in der Puppe deckungsgleich übereinander liegen
FACES_FRONT = ('faces_front.jpg', {'neutral': 1, 'effort': 2, 'blink': 3, 'yawn': 4})
FACES_SIDE = ('faces_side.jpg', {'neutral': 2, 'effort': 3, 'blink': 1})
# Kragen unter dem Seitenkopf abschneiden: Linie relativ zur linken oberen Ecke des Kopfes, weich auslaufend
SIDE_COLLAR = ((2, 245), (158, 275), 10)
# Seitenrumpf ohne eingezeichneten Kopf: alles oberhalb der Linie weg (vorne waagrecht, zum Rücken ansteigend)
SIDE_NECK_CUT = (560, 246, 0.5, 8)  # x ab dem waagrecht, y, Steigung nach hinten, Weichheit

# Weitere Geräte aus den Gemini-Bögen
EQUIP2 = {
    'geraete2.jpg': {'stack': [231], 'calfframe': [229], 'calfpad': [232], 'dipbars': [285], 'nordic': [284], 'abductseat': [248]},
    'geraete3.jpg': {'edge': [156]},
}

# Geräte etwas dunkler, damit sie neben dem Faultier zurücktreten
EQUIP_DARK = 0.62

# Schwarzweiss-Kurve: Helligkeit -> Grauwert (Stützpunkte bei 0, .25, .5, .75, 1)
CURVE = [0.06, 0.30, 0.68, 0.96, 1.0]


def label(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    white = (a.min(2) > 200) & (a.max(2) - a.min(2) < 30)
    lab, _ = ndi.label(~white)
    return a, lab


def gray(rgb):
    lum = (0.33 * rgb[..., 0] + 0.5 * rgb[..., 1] + 0.17 * rgb[..., 2]) / 255
    return np.interp(lum, np.linspace(0, 1, len(CURVE)), CURVE) * 255


def cut(rgb, lab, ids, g, out, fix=None, dark=1.0, erase=(), holes=True, soft=None, shift=(0, 0)):
    # holes: eingeschlossene weisse Flächen mitnehmen (Augen, Zähne); bei Geräten nicht (Lücken im Rahmen)
    # soft(xx, yy) -> 0..1: weich ausblenden (Kragen, Kopf am Rumpf); shift: Rechteck in einen anderen Rahmen verschieben
    m = np.isin(lab, ids)
    if holes:
        m = ndi.binary_fill_holes(m)
    for x0, y0, x1, y1 in erase:
        m[y0:y1, x0:x1] = False
    g = g.astype(float)
    if fix:
        # Gelenk-Pfannen mit dem umgebenden Fell zumalen (normierte Unschärfe von aussen nach innen)
        yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]
        hole = np.zeros(g.shape, bool)
        for (cx, cy), r in fix:
            hole |= np.hypot(xx - cx, yy - cy) < r
        known = (~hole & m).astype(float)
        num = ndi.gaussian_filter(g * known, 14); den = ndi.gaussian_filter(known, 14)
        fill = num / np.maximum(den, 1e-3)
        g[hole & m] = fill[hole & m]
    g = np.clip(g * dark, 0, 255).astype(np.uint8)
    mask = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    if soft is not None:
        yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]
        mask = Image.fromarray((np.asarray(mask).astype(float) * soft(xx, yy)).astype(np.uint8))
    box = mask.getbbox()
    Image.merge('LA', (Image.fromarray(g), mask)).crop(box).save(out, optimize=True)
    return [box[0] - shift[0], box[1] - shift[1], box[2] - shift[0], box[3] - shift[1]]


def faces(fname, comps, view, parts, soft_rel=None):
    rgb, lab = label(os.path.join(HERE, 'sheets', fname))
    g = gray(rgb)
    objs = ndi.find_objects(lab)
    ref = objs[comps['neutral'] - 1]
    for name, cid in comps.items():
        sl = objs[cid - 1]
        dx, dy = sl[1].start - ref[1].start, sl[0].start - ref[0].start
        soft = soft_rel(sl[1].start, sl[0].start) if soft_rel else None
        parts[f'{view}_face_{name}'] = cut(rgb, lab, [cid], g, os.path.join(OUT, f'{view}_face_{name}.png'), soft=soft, shift=(dx, dy))


def collar(x0, y0):
    (ax, ay), (bx, by), w = SIDE_COLLAR
    def f(xx, yy):
        yl = y0 + ay + (by - ay) * (xx - x0 - ax) / (bx - ax)
        return np.clip((yl - yy) / w, 0, 1)
    return f


def neck_cut(xx, yy):
    x0, y0, k, w = SIDE_NECK_CUT
    yl = np.where(xx >= x0, y0, y0 - (x0 - xx) * k)
    return np.clip((yy - yl) / w, 0, 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    parts = {}
    for view, (fname, comps) in SHEETS.items():
        rgb, lab = label(os.path.join(HERE, 'sheets', fname))
        g = gray(rgb)
        for name, ids in comps.items():
            parts[f'{view}_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'{view}_{name}.png'))
    rgb, lab = label(os.path.join(HERE, 'sheets', POSES[0]))
    g = gray(rgb)
    for name, ids in POSES[1].items():
        parts[f'pose_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'pose_{name}.png'))
    for fname, comps in EQUIP.items():
        rgb, lab = label(os.path.join(HERE, 'sheets', 'equipment', fname))
        g = gray(rgb)
        for name, ids in comps.items():
            parts[f'eq_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'eq_{name}.png'), dark=EQUIP_DARK, erase=EQUIP_ERASE.get(name, ()), holes=False)
    for fname, comps in EQUIP2.items():
        rgb, lab = label(os.path.join(HERE, 'sheets', 'equipment', fname))
        g = gray(rgb)
        for name, ids in comps.items():
            parts[f'eq_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'eq_{name}.png'), dark=EQUIP_DARK, erase=EQUIP_ERASE.get(name, ()), holes=False)
    faces(*FACES_FRONT, 'front', parts)
    faces(*FACES_SIDE, 'side', parts, soft_rel=collar)
    for fname, comps in SIDE:
        rgb, lab = label(os.path.join(HERE, 'sheets', fname))
        g = gray(rgb)
        if fname == 'side.jpg':  # Unterschenkel ohne Fuss (für ein bewegliches Fussgelenk)
            comps = {**comps, 'shin': comps['calf']}
        for name, ids in comps.items():
            fix = SIDE_SOCKETS if name == 'torso' else None
            er = SIDE_SHIN_CUT if name == 'shin' else ()
            parts[f'side_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'side_{name}.png'), fix, erase=er)
            if name == 'torso':  # Rumpf ohne Kopf (der Kopf kommt einzeln, mit Gesichtern)
                parts['side_body'] = cut(rgb, lab, ids, g, os.path.join(OUT, 'side_body.png'), fix, soft=neck_cut)
            if name in SIDE_FAR:
                parts[f'side_{name}_far'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'side_{name}_far.png'), dark=FAR_DARK, erase=er)
    js = open(RIG_JS).read()
    block = 'const SLOTH_PARTS = ' + json.dumps(parts, separators=(',', ':')) + ';'
    js = re.sub(r'/\* PARTS:BEGIN \*/.*?/\* PARTS:END \*/', '/* PARTS:BEGIN */\n' + block + '\n/* PARTS:END */', js, flags=re.S)
    open(RIG_JS, 'w').write(js)
    print(f'{len(parts)} Teile -> {OUT}')


if __name__ == '__main__':
    import sys
    if '--list' in sys.argv:
        for view, (fname, _) in SHEETS.items():
            _, lab = label(os.path.join(HERE, 'sheets', fname))
            sizes = ndi.sum(lab > 0, lab, range(1, lab.max() + 1)); objs = ndi.find_objects(lab)
            for i, s in enumerate(sizes):
                if s > 1500:
                    sl = objs[i]; print(view, i + 1, int(s), (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    else:
        main()

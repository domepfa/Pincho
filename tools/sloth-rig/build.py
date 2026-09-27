"""Zerlegt die Faultier-Vorlagen (sheets/*.jpg) in Einzelteile für die Puppe.

Jede Vorlage: Teile durch weisse Lücken getrennt, weisser Hintergrund.
Ausgabe: assets/sloth/rig/<ansicht>_<teil>.png in Schwarzweiss (Graustufe +
Transparenz) und die Teil-Rechtecke im Block PARTS in beta/sloth-rig.js.

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
RIG_JS = os.path.join(ROOT, 'beta', 'sloth-rig.js')

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
    ('side_extra.jpg', {'fist': [32]}),
    ('arms_extra.jpg', {'flat': [104]}),
]
# Vorderansicht mit hängenden Armen (Zusatzblatt)
FRONT_EXTRA = ('arms_extra.jpg', {'uarm2_l': [74], 'uarm2_r': [75], 'farm2_l': [76], 'farm2_r': [77]})
# Die Oberarm-Teile haben unten ein zweites Segment: nur bis zur Einkerbung verwenden
FRONT_EXTRA_YMAX = {'uarm2_l': 336, 'uarm2_r': 336}
SIDE_FAR = ['uarm', 'elbow', 'farm', 'hand', 'fist', 'flat', 'thigh', 'knee', 'calf']
FAR_DARK = 0.5
# Weisse Ringe der Gelenk-Pfannen am Rumpf dunkel füllen: (Mitte, Radius)
SIDE_SOCKETS = [((544, 295), 40), ((586, 513), 40)]

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


def cut(rgb, lab, ids, g, out, fix=None, dark=1.0, ymax=None):
    m = ndi.binary_fill_holes(np.isin(lab, ids))
    if ymax:
        m[ymax:] = False
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
    box = mask.getbbox()
    Image.merge('LA', (Image.fromarray(g), mask)).crop(box).save(out, optimize=True)
    return list(box)


def main():
    os.makedirs(OUT, exist_ok=True)
    parts = {}
    for view, (fname, comps) in SHEETS.items():
        rgb, lab = label(os.path.join(HERE, 'sheets', fname))
        g = gray(rgb)
        for name, ids in comps.items():
            parts[f'{view}_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'{view}_{name}.png'))
    rgb, lab = label(os.path.join(HERE, 'sheets', FRONT_EXTRA[0]))
    g = gray(rgb)
    for name, ids in FRONT_EXTRA[1].items():
        parts[f'front_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'front_{name}.png'), ymax=FRONT_EXTRA_YMAX.get(name))
    for fname, comps in SIDE:
        rgb, lab = label(os.path.join(HERE, 'sheets', fname))
        g = gray(rgb)
        for name, ids in comps.items():
            fix = SIDE_SOCKETS if name == 'torso' else None
            parts[f'side_{name}'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'side_{name}.png'), fix)
            if name in SIDE_FAR:
                parts[f'side_{name}_far'] = cut(rgb, lab, ids, g, os.path.join(OUT, f'side_{name}_far.png'), dark=FAR_DARK)
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

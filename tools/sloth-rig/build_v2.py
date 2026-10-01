"""Neue Faultier-Puppe (v2): zerlegt GANZE Figuren (sheets/v2/*.jpg) an den Gelenken.

Anders als build.py (einzeln gezeichnete Teile) stammen hier alle Teile einer Ansicht
aus derselben Zeichnung – Grösse, Fell und Konturen passen dadurch nahtlos zusammen.
Jede Figur steht in einer Pose, in der sich nichts überdeckt (A-Pose, Arm frei).

- Rumpf und Kopf: von Hand gesetzte Umrisse (TORSO/HEAD), alles andere gehört dem
  nächstgelegenen Knochen (Gelenk -> Gelenk).
- Überlappung am Gelenk: das Kind bekommt eine Scheibe um das Gelenk, gefüllt mit
  seinem EIGENEN Fell (nächster eigener Pixel) – so wandert beim Drehen kein fremdes Stück mit.
- Schwarzweiss mit derselben Kurve wie die bisherige Puppe, Bilder halb so gross gespeichert.

Ausgabe: assets/sloth/rig2/<ansicht>_<teil>.png und der Block SLOTH_V2 in beta/sloth-rig.js
(Teil-Rechtecke, Gelenke, Anschlusspunkte – im selben Format wie SLOTH_PARTS/JOINTS/ANCHORS).

Aufruf aus dem Repo-Stamm:  python3 tools/sloth-rig/build_v2.py
"""
import json, os, re
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from build import gray

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'assets', 'sloth', 'rig2')
RIG_JS = os.path.join(ROOT, 'beta', 'sloth-rig.js')
S = 0.5  # Speichergrösse der Teile (halbe Auflösung reicht fürs Handy)
FAR_DARK = 0.55

# Gelenke (Blatt-Pixel). L = im Bild links.
FB = lambda **k: k
VIEWS = {
    'front': dict(src='front.jpg', fist='front_fist.jpg', J=FB(
        top=(500, 40), neck=(500, 370), hip=(500, 890),
        shL=(330, 480), elL=(205, 690), wrL=(118, 850), fiL=(80, 990), shR=(670, 480), elR=(795, 690), wrR=(882, 850), fiR=(925, 990),
        hipL=(420, 890), knL=(360, 1150), anL=(310, 1390), toL=(250, 1490), hipR=(580, 890), knR=(640, 1150), anR=(690, 1390), toR=(750, 1490)),
        torso=[(360, 330), (640, 330), (690, 430), (700, 480), (655, 560), (640, 700), (652, 800), (575, 805), (570, 960), (430, 960), (425, 805), (348, 800), (360, 700), (345, 560), (300, 480), (310, 430)],
        head=[(330, 20), (680, 20), (680, 360), (560, 395), (440, 395), (330, 360)]),
    'back': dict(src='back.jpg', J=FB(
        top=(500, 30), neck=(500, 380), hip=(500, 890),
        shL=(330, 480), elL=(205, 700), wrL=(115, 860), fiL=(85, 1000), shR=(670, 480), elR=(800, 700), wrR=(890, 860), fiR=(930, 1000),
        hipL=(420, 890), knL=(360, 1150), anL=(310, 1390), toL=(240, 1470), hipR=(580, 890), knR=(650, 1150), anR=(700, 1390), toR=(790, 1470)),
        torso=[(350, 370), (650, 370), (700, 430), (700, 480), (660, 560), (650, 700), (650, 795), (565, 800), (560, 930), (440, 930), (440, 800), (350, 795), (350, 700), (340, 560), (300, 480), (300, 430)],
        head=[(340, 20), (690, 20), (680, 370), (560, 400), (440, 400), (330, 370)]),
    # Hängen am Board (Rückansicht, Arme oben): für Posen mit erhobenen Armen, keine verbogene Schulter
    'hang': dict(src='hang.jpg', J=FB(
        top=(510, 240), neck=(510, 470), hip=(510, 930),
        shL=(355, 510), elL=(300, 280), wrL=(305, 110), fiL=(315, 50), shR=(665, 510), elR=(715, 280), wrR=(710, 110), fiR=(705, 50),
        hipL=(445, 930), knL=(375, 1140), anL=(345, 1400), toL=(320, 1485), hipR=(575, 930), knR=(645, 1140), anR=(680, 1400), toR=(705, 1485)),
        torso=[(400, 440), (620, 440), (660, 500), (690, 560), (650, 700), (640, 800), (565, 810), (560, 925), (455, 925), (450, 810), (380, 800), (370, 700), (330, 560), (360, 500)],
        head=[(395, 225), (635, 225), (630, 470), (560, 525), (465, 525), (395, 470)]),
    # Seite (Blick nach rechts): nur der vordere Arm/das vordere Bein, hinten = abgedunkelte Kopie
    'side': dict(src='side.jpg', J=FB(
        top=(330, 60), neck=(400, 340), hip=(390, 895), shR=(400, 445), elR=(640, 450), wrR=(880, 425), fiR=(985, 430),
        hipR=(390, 895), knR=(490, 1170), anR=(520, 1390), toR=(740, 1470), hipL=(370, 910), knL=(300, 1170), anL=(215, 1390), toL=(380, 1485)),
        torso=[(210, 330), (460, 320), (472, 370), (495, 420), (518, 470), (535, 520), (540, 600), (505, 700), (512, 795), (420, 805), (310, 790), (305, 830), (295, 865), (275, 890), (240, 898), (195, 898), (195, 700), (240, 640), (205, 430)],
        shoulder_on_arm=75, arm_low=528,  # ganze runde Schulter gehört zum Arm (Arm liegt in der Seitenansicht vor dem Rumpf)
        head=[(180, 20), (520, 20), (520, 330), (420, 360), (300, 380), (190, 360)]),
}
CAP = {'sh': 70, 'el': 46, 'wr': 36, 'hip': 75, 'kn': 58, 'an': 44, 'neck': 60}


def figure(path):
    A = np.asarray(Image.open(os.path.join(HERE, 'sheets', 'v2', path)).convert('RGB')).astype(float)
    white = (A.min(2) > 225) & (np.ptp(A, 2) < 25)
    fig = ndi.binary_fill_holes(~white)
    lab, n = ndi.label(fig)
    fig = lab == (np.argmax(ndi.sum(fig, lab, range(1, n + 1))) + 1)
    light = A.min(2) / 255
    # heller Saum vom weissen Hintergrund weg
    alpha = np.where(ndi.binary_erosion(fig, iterations=3), 1.0, np.clip((0.92 - light) / 0.35, 0, 1)) * fig
    return A, gray(A), fig, alpha


def cut_view(view, cfg, parts, joints, anchors):
    J = cfg['J']
    A, G, fig, alpha = figure(cfg['src'])
    H, W = fig.shape
    yy, xx = np.mgrid[0:H, 0:W]

    def poly(pts):
        im = Image.new('L', (W, H), 0)
        ImageDraw.Draw(im).polygon(pts, fill=1)
        return np.asarray(im).astype(bool)

    def segd(a, b):
        a = np.array(J[a], float); b = np.array(J[b], float); d = b - a
        t = np.clip(((xx - a[0]) * d[0] + (yy - a[1]) * d[1]) / (d @ d), 0, 1)
        return np.hypot(xx - a[0] - t * d[0], yy - a[1] - t * d[1])

    head = poly(cfg['head']) & fig
    torso = poly(cfg['torso']) & fig & ~head
    sho = cfg.get('shoulder_on_arm')
    shoDisk = (np.hypot(xx - J['shR'][0], yy - J['shR'][1]) < sho) & fig & ~head if sho else None
    if sho:  # Schulterkugel + ganzer Armstreifen gehören dem Arm, nicht dem Rumpf
        # Arm = Schulterkugel + Armstreifen bis zur Unterkante des Arms (darunter beginnt die Brust)
        shoDisk = shoDisk | ((segd('shR', 'elR') < 85) & (yy <= cfg['arm_low']) & fig & ~head)
        torso = torso & ~shoDisk
    sides = 'R' if view == 'side' else 'LR'
    bones = {}
    for s in sides:
        bones['uarm' + s] = ('sh' + s, 'el' + s); bones['farm' + s] = ('el' + s, 'wr' + s); bones['hand' + s] = ('wr' + s, 'fi' + s)
        bones['thigh' + s] = ('hip' + s, 'kn' + s); bones['calf' + s] = ('kn' + s, 'an' + s); bones['foot' + s] = ('an' + s, 'to' + s)
    if view == 'side':  # hinteres Bein nur zum Ausschliessen
        bones.update(thighL=('thL', 'knL'), calfL=('knL', 'anL'), footL=('anL', 'toL'))
        J = dict(J, thL=(335, 1040))  # hinteres Bein erst ab Mitte Oberschenkel: Gesäss gehört zum vorderen Bein
    names = list(bones)
    own = np.argmin(np.stack([segd(*bones[k]) for k in names]), 0)
    rest = fig & ~head & ~torso
    M = {k: rest & (own == i) for i, k in enumerate(names)}
    # Rumpf reicht ein Stück unter den Kopf, damit der weich auslaufende Hals keine Lücke lässt
    torsoCut = torso.copy()
    torso = torso | (head & ndi.binary_dilation(torso, iterations=18))
    M['head'] = head; M['torso'] = torso
    if sho:
        M['uarmR'] = (M['uarmR'] | shoDisk) & ~M['farmR']
    if view == 'side':  # Oberschenkel oben rund um die Hüfte: beim Beugen steht keine Ecke ab
        M['thighR'] = M['thighR'] & ((yy > J['hipR'][1]) | (np.hypot(xx - J['hipR'][0], yy - J['hipR'][1]) < 125))

    def biggest(m):
        lb, nn = ndi.label(m)
        return lb == (np.argmax(ndi.sum(m, lb, range(1, nn + 1))) + 1) if nn > 1 else m

    def texfill(g, Gs, region, mask):
        """Füllt region mit Fell, an der nächsten Kante des eigenen Teils gespiegelt (keine Streifen)."""
        inner = ndi.binary_erosion(mask, iterations=8)  # Kontur nicht mitspiegeln
        if not inner.any():
            return False
        _, (iy, ix) = ndi.distance_transform_edt(~inner, return_indices=True)
        ry, rx = np.nonzero(region)
        qy, qx = iy[ry, rx], ix[ry, rx]
        my = np.clip(2 * qy - ry, 0, H - 1); mx = np.clip(2 * qx - rx, 0, W - 1)
        ok = inner[my, mx]
        # grosse Löcher: verschobene Kopie aus dem Inneren (Richtung Teil-Mitte)
        cy, cx = np.argwhere(inner).mean(0); oy, ox = cy - ry.mean(), cx - rx.mean()
        n = np.hypot(oy, ox) or 1.0; R = np.sqrt(region.sum() / np.pi)
        for f in (2.2, 2.8, 3.4, 1.6):
            sy = np.clip(ry + round(oy / n * R * f), 0, H - 1); sx = np.clip(rx + round(ox / n * R * f), 0, W - 1)
            take = ~ok & inner[sy, sx]
            my = np.where(take, sy, my); mx = np.where(take, sx, mx); ok = ok | take
        my = np.where(ok, my, qy); mx = np.where(ok, mx, qx)
        g[ry, rx] = Gs[my, mx]
        soft = ndi.gaussian_filter(g, 1.2)  # Spiegelnaht leicht weich
        g[ry, rx] = 0.5 * g[ry, rx] + 0.5 * soft[ry, rx]
        return True

    def save(name, mask, joint=None, src=None, dark=1.0, fade=None, ink=False):
        Gs = G if src is None else src
        # lose Fellsträhnen weg (Oberarm: Achselhaar hängt sonst als Strich herunter)
        mask = biggest(ndi.binary_opening(mask, iterations=6 if name.startswith('uarm') else 2))
        g = Gs.copy(); a0 = alpha.copy()
        if joint:  # Gelenk-Überlappung mit eigenem Fell
            r = CAP[re.sub('[LR]$', '', joint)]
            cap = (np.hypot(xx - J[joint][0], yy - J[joint][1]) < r) & ~mask
            if texfill(g, Gs, cap, mask):
                a0[cap] = 1.0
                mask = mask | cap
        if ink:  # Schnittkante wie gezeichnet: dunkle Kontur, wo das Teil mitten im Fell abgeschnitten ist
            cut = mask & ndi.binary_dilation(fig & ~mask, iterations=2) & (np.hypot(xx - J[ink][0], yy - J[ink][1]) < 200)
            band = ndi.gaussian_filter((ndi.distance_transform_edt(~cut) < 3).astype(float), 1.0) * mask
            g = g * (1 - 0.7 * band)
        # an Schnittkanten (mitten im Fell) 2 px Originalfell dazu, damit die weiche Kante keinen dunklen Strich zeichnet
        mask = mask | (ndi.binary_dilation(mask, iterations=2) & ndi.binary_erosion(fig, iterations=3))
        a = ndi.gaussian_filter(mask.astype(float), 0.8) * np.where(mask, a0, 0)
        if fade is not None:  # Schnittkante weich in das darunterliegende Teil auslaufen lassen (Hals)
            d = ndi.distance_transform_edt(~fade)
            a = a * np.clip(d / 16, 0.0, 1.0) ** 0.7
        im = Image.fromarray(np.dstack([np.clip(g * dark, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8), 'LA')
        bb = im.getchannel('A').getbbox()
        im = im.crop(bb)
        im = im.resize((max(1, round(im.width * S)), max(1, round(im.height * S))), Image.LANCZOS)
        key = f'v2{view}_{name}'
        im.save(os.path.join(OUT, key + '.png'), optimize=True)
        parts[key] = [round(bb[0] * S), round(bb[1] * S), round(bb[0] * S) + im.width, round(bb[1] * S) + im.height]

    sc = lambda p: [round(p[0] * S, 1), round(p[1] * S, 1)]
    jv = joints[view] = {}
    if view == 'side':
        # Rumpf aus eigener Zeichnung ohne Arme: in side.jpg verdeckt der Arm die Brust
        TJ = side_torso(parts, 'v2side_torso', SIDE_TORSO)
        save('face', M['head'], fade=torsoCut)
        jv['torso'] = [TJ['hip'], TJ['sh']]
        jv['face'] = [sc(J['neck']), sc(J['top'])]
        anchors[view] = {'shoulder': TJ['sh'], 'hip': TJ['hip'], 'tail': TJ['hip'], 'face': TJ['neck']}
        for far, dark in (('', 1.0), ('_far', FAR_DARK)):
            save('uarm' + far, M['uarmR'], dark=dark)  # ohne Kappe: die Schulter ist schon ganz dabei
            save('farm' + far, M['farmR'], 'elR', dark=dark)
            save('hand' + far, M['handR'], 'wrR', dark=dark)
            save('fist' + far, M['farmR'] | M['handR'], 'elR', dark=dark)  # Unterarm + Hand in einem Teil (wie bisher 'fist')
            save('flat' + far, M['handR'], 'wrR', dark=dark)
            save('thigh' + far, M['thighR'], dark=dark, ink='hipR')  # Rumpf endet am Gürtel, Gesäss gehört zum Bein: keine Kappe nötig
            save('calf' + far, M['calfR'] | M['footR'], 'knR', dark=dark)  # Unterschenkel mit Fuss
            save('shin' + far, M['calfR'], 'knR', dark=dark)
            save('foot' + far, M['footR'], 'anR', dark=dark)
        jv.update(uarm=[sc(J['shR']), sc(J['elR'])], farm=[sc(J['elR']), sc(J['wrR'])], fist=[sc(J['elR']), sc(J['wrR'])],
                  hand=[sc(J['wrR']), sc(J['fiR'])], flat=[sc(J['wrR']), sc(J['fiR'])],
                  thigh=[sc(J['hipR']), sc(J['knR'])], calf=[sc(J['knR']), sc(J['anR'])], shin=[sc(J['knR']), sc(J['anR'])],
                  foot=[sc(J['anR']), sc(J['toR'])])
        return
    save('torso', M['torso'])
    save('head', M['head'], fade=torsoCut)
    jv['torso'] = [sc(J['hip']), sc(J['neck'])]
    jv['head'] = [sc(J['neck']), sc(J['top'])]
    anchors[view] = {'neck': sc(J['neck']), 'sh_l': sc(J['shL']), 'sh_r': sc(J['shR']), 'hip_l': sc(J['hipL']), 'hip_r': sc(J['hipR']), 'tail': sc(J['hip'])}
    fistG = gray(np.asarray(Image.open(os.path.join(HERE, 'sheets', 'v2', cfg['fist'])).convert('RGB')).astype(float)) if cfg.get('fist') else None
    grip = view != 'front'  # Rückansicht/Hängen: eigene Greifhand (wie bisher grip_l/grip_r)
    for s in 'LR':
        x = s.lower()
        save('uarm_' + x, M['uarm' + s], 'sh' + s)
        if grip:
            save('farm_' + x, M['farm' + s], 'el' + s)
            save('grip_' + x, M['hand' + s], 'wr' + s)
            jv['grip_' + x] = [sc(J['wr' + s]), sc(J['fi' + s])]
            jv['farm_' + x] = [sc(J['el' + s]), sc(J['wr' + s])]
        else:  # vorne: Unterarm mit Hand (offen) und als Faust-Variante aus front_fist.jpg
            save('farm_' + x, M['farm' + s] | M['hand' + s], 'el' + s)
            if fistG is not None:
                save('farmfist_' + x, M['farm' + s] | M['hand' + s], 'el' + s, src=fistG)
            jv['farm_' + x] = [sc(J['el' + s]), sc(J['fi' + s])]
        save('thigh_' + x, M['thigh' + s], 'hip' + s)
        save('calf_' + x, M['calf' + s] | M['foot' + s], 'kn' + s)
        jv['uarm_' + x] = [sc(J['sh' + s]), sc(J['el' + s])]
        jv['thigh_' + x] = [sc(J['hip' + s]), sc(J['kn' + s])]
        jv['calf_' + x] = [sc(J['kn' + s]), sc(J['an' + s])]


# Seitlicher Rumpf ohne Arme (Brust frei). Gelenke in Blatt-Pixeln; sy streckt den Rumpf auf die Länge
# von side.jpg (Schulter -> Gürtel), damit Kopf, Arm und Beine von dort passen.
SIDE_TORSO = dict(src='side_torso.jpg', sx=0.95, sy=1.08, rot=6,
    J=dict(neck=(485, 485), sh=(450, 585), hip=(400, 985)),
    poly=[(290, 420), (540, 400), (560, 480), (610, 540), (645, 620), (630, 710), (600, 780), (575, 850), (548, 905), (420, 878), (312, 842),
          (298, 880), (285, 950), (250, 1000), (165, 1005), (140, 940), (150, 800), (195, 785), (285, 780), (290, 700), (290, 600), (285, 500)])


def side_torso(parts, key, cfg):
    A, G, fig, alpha = figure(cfg['src'])
    H, W = fig.shape
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon(cfg['poly'], fill=1)
    mask = np.asarray(im).astype(bool) & fig
    lb, nn = ndi.label(mask)
    if nn > 1:
        mask = lb == (np.argmax(ndi.sum(mask, lb, range(1, nn + 1))) + 1)
    a = ndi.gaussian_filter(mask.astype(float), 0.8) * np.where(mask, alpha, 0)
    img = Image.fromarray(np.dstack([np.clip(G, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8), 'LA')
    # Gürtel so schräg wie in side.jpg: Rumpf um die Schulter drehen (PIL: Winkel gegen den Uhrzeiger)
    c = cfg['J']['sh']; t = np.radians(cfg.get('rot', 0))
    img = img.rotate(cfg.get('rot', 0), resample=Image.BICUBIC, center=c)
    rotp = lambda q: (c[0] + (q[0] - c[0]) * np.cos(t) + (q[1] - c[1]) * np.sin(t), c[1] - (q[0] - c[0]) * np.sin(t) + (q[1] - c[1]) * np.cos(t))
    bb = img.getchannel('A').getbbox()
    img = img.crop(bb)
    fx, fy = S * cfg['sx'], S * cfg['sy']
    img = img.resize((round(img.width * fx), round(img.height * fy)), Image.LANCZOS)
    img.save(os.path.join(OUT, key + '.png'), optimize=True)
    x0, y0 = round(bb[0] * fx), round(bb[1] * fy)
    parts[key] = [x0, y0, x0 + img.width, y0 + img.height]
    return {k: [round(rotp(q)[0] * fx, 1), round(rotp(q)[1] * fy, 1)] for k, q in cfg['J'].items()}


def main():
    os.makedirs(OUT, exist_ok=True)
    parts, joints, anchors = {}, {}, {}
    for view, cfg in VIEWS.items():
        cut_view(view, cfg, parts, joints, anchors)
        print(view, 'ok')
    block = 'const SLOTH_V2 = ' + json.dumps({'parts': parts, 'joints': joints, 'anchors': anchors}, separators=(',', ':')) + ';'
    js = open(RIG_JS).read()
    if '/* V2:BEGIN */' in js:
        js = re.sub(r'/\* V2:BEGIN \*/.*?/\* V2:END \*/', '/* V2:BEGIN */\n' + block + '\n/* V2:END */', js, flags=re.S)
    else:
        js = js.replace('/* PARTS:END */', '/* PARTS:END */\n/* V2:BEGIN */\n' + block + '\n/* V2:END */', 1)
    open(RIG_JS, 'w').write(js)
    print(len(parts), 'Teile ->', OUT)


if __name__ == '__main__':
    main()

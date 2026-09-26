from PIL import Image, ImageFilter
from collections import deque
import json, pickle
im = Image.open('/root/.claude/uploads/e14bc4d1-737c-5d52-a0df-def8879e508d/d07a57dd-image.jpg').convert('RGB')
w, h = im.size
lab = pickle.load(open('rig/lab.pkl', 'rb'))
info = json.load(open('rig/comps.json'))
names = {5: 'torso', 26: 'forearm_l', 27: 'forearm_r', 67: 'thigh_l', 68: 'thigh_r', 84: 'calf_l', 85: 'calf_r', 69: 'tail'}
keep = set(names)
# Hintergrund = von den Rändern erreichbare unbeschriftete Pixel
bg = bytearray(w*h); q = deque()
for x in range(w):
    for y in (0, h-1):
        if lab[y*w+x] == 0: bg[y*w+x] = 1; q.append((x, y))
for y in range(h):
    for x in (0, w-1):
        if lab[y*w+x] == 0 and not bg[y*w+x]: bg[y*w+x] = 1; q.append((x, y))
while q:
    x, y = q.popleft()
    for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
        if 0 <= nx < w and 0 <= ny < h:
            j = ny*w+nx
            if not bg[j] and lab[j] == 0: bg[j] = 1; q.append((nx, ny))
# Eingeschlossene Löcher (Augen, Zähne) dem umgebenden Teil zuordnen
seen = bytearray(w*h)
for sy in range(h):
    for sx in range(w):
        i = sy*w+sx
        if lab[i] or bg[i] or seen[i]: continue
        comp = []; q = deque([(sx, sy)]); seen[i] = 1; owner = {}
        while q:
            x, y = q.popleft(); comp.append(y*w+x)
            for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny*w+nx
                    if lab[j]: owner[lab[j]] = owner.get(lab[j], 0) + 1
                    elif not bg[j] and not seen[j]: seen[j] = 1; q.append((nx, ny))
        if owner and len(comp) < 20000:
            o = max(owner, key=owner.get)
            for j in comp: lab[j] = o
out = {}
for cid, name in names.items():
    mask = Image.new('L', (w, h), 0); mp = mask.load()
    for y in range(h):
        row = y*w
        for x in range(w):
            if lab[row+x] == cid: mp[x, y] = 255
    mask = mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.7))
    bbox = mask.getbbox()
    part = im.convert('RGBA'); part.putalpha(mask)
    part.crop(bbox).save(f'rig/{name}.png')
    out[name] = bbox
json.dump(out, open('rig/bboxes.json', 'w'), indent=1)
print(out)

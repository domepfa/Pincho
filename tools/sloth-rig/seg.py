from PIL import Image
from collections import deque
import json
im = Image.open('/root/.claude/uploads/e14bc4d1-737c-5d52-a0df-def8879e508d/d07a57dd-image.jpg').convert('RGB')
w, h = im.size; px = im.load()
def fg(x, y):
    r, g, b = px[x, y]
    return not (min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 30)
lab = [0]*(w*h); comps = []
for sy in range(h):
    for sx in range(w):
        if lab[sy*w+sx] or not fg(sx, sy): continue
        cid = len(comps)+1; q = deque([(sx, sy)]); lab[sy*w+sx] = cid; pts = []
        while q:
            x, y = q.popleft(); pts.append((x, y))
            for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if 0 <= nx < w and 0 <= ny < h and not lab[ny*w+nx] and fg(nx, ny):
                    lab[ny*w+nx] = cid; q.append((nx, ny))
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        comps.append({'id': cid, 'n': len(pts), 'bbox': [min(xs), min(ys), max(xs)+1, max(ys)+1], 'c': [sum(xs)/len(xs), sum(ys)/len(ys)]})
big = [c for c in comps if c['n'] > 1500]
for c in sorted(big, key=lambda c: -c['n']): print(c)
json.dump({'w': w, 'h': h, 'big': big}, open('rig/comps.json', 'w'))
import pickle; pickle.dump(lab, open('rig/lab.pkl', 'wb'))

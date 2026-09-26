from PIL import Image, ImageFilter
from collections import deque
U = '/root/.claude/uploads/e14bc4d1-737c-5d52-a0df-def8879e508d/'
files = {
  'pull-top': '2b39b010-image.jpg', 'pull-bottom': '029efcbd-image.jpg', 'hang': '5b2a15dd-image.jpg',
  'flex': '59d0cd23-image.jpg', 'wave': '7c2a0d70-image.jpg', 'rest': '1b7db423-image.jpg',
}
def cut(path, enclosed_min=2500):
    im = Image.open(path).convert('RGB'); w, h = im.size; px = im.load()
    def white(x, y):
        r, g, b = px[x, y]
        return min(r, g, b) > 232 and max(r, g, b) - min(r, g, b) < 18
    seen = bytearray(w*h); bg = bytearray(w*h)
    for sy in range(h):
        for sx in range(w):
            i = sy*w+sx
            if seen[i] or not white(sx, sy): continue
            comp = []; q = deque([(sx, sy)]); seen[i] = 1; border = False
            while q:
                x, y = q.popleft(); comp.append(y*w+x)
                if x in (0, w-1) or y in (0, h-1): border = True
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny*w+nx
                        if not seen[j] and white(nx, ny): seen[j] = 1; q.append((nx, ny))
            if border or len(comp) >= enclosed_min:
                for j in comp: bg[j] = 1
    mask = Image.frombytes('L', (w, h), bytes(0 if b else 255 for b in bg))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = im.convert('RGBA'); out.putalpha(mask)
    return out.crop(mask.getbbox())
import os
os.makedirs('/home/user/Pincho/assets/sloth', exist_ok=True)
for name, f in files.items():
    c = cut(U + f)
    c = c.resize((round(c.width * 640 / c.height), 640), Image.LANCZOS)
    c.save(f'/home/user/Pincho/assets/sloth/sloth-{name}.png', optimize=True)
    prev = Image.new('RGBA', c.size, (11, 15, 20, 255)); prev.alpha_composite(c); prev.convert('RGB').save(f'pose-{name}.png')
    print(name, c.size, os.path.getsize(f'/home/user/Pincho/assets/sloth/sloth-{name}.png')//1024, 'KB')

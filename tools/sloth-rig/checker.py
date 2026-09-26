from PIL import Image, ImageFilter
from collections import deque
im = Image.open('/root/.claude/uploads/e14bc4d1-737c-5d52-a0df-def8879e508d/4aa2e41c-image.jpg').convert('RGB')
w, h = im.size
px = im.load()
def checker(x, y):
    r, g, b = px[x, y]
    return min(r, g, b) > 188 and max(r, g, b) - min(r, g, b) < 14
seen = [[False]*w for _ in range(h)]
bg = [[False]*w for _ in range(h)]
# alle zusammenhängenden Karo-Flächen finden; Rand-Flächen und grosse Innenflächen = Hintergrund
for sy in range(h):
    for sx in range(w):
        if seen[sy][sx] or not checker(sx, sy): continue
        comp = []; q = deque([(sx, sy)]); seen[sy][sx] = True; border = False
        while q:
            x, y = q.popleft(); comp.append((x, y))
            if x in (0, w-1) or y in (0, h-1): border = True
            for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and checker(nx, ny):
                    seen[ny][nx] = True; q.append((nx, ny))
        if border or len(comp) > 150:
            for x, y in comp: bg[y][x] = True
mask = Image.new('L', (w, h), 255); mp = mask.load()
for y in range(h):
    for x in range(w):
        if bg[y][x]: mp[x, y] = 0
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
out = im.convert('RGBA'); out.putalpha(mask)
out = out.crop(mask.getbbox())
out.save('/home/user/Pincho/assets/sloth/sloth-hang-back.png', optimize=True)
prev = Image.new('RGBA', out.size, (11, 15, 20, 255)); prev.alpha_composite(out); prev.convert('RGB').save('prev-back.png')
print(out.size)

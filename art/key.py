# 生成したシート（緑背景）を切り抜いて img/*.webp と img/sprites.json を作る。python key.py
# シートを列×行に割り、つながった塊の中心が入るマスへ振り分けて、塊の外接矩形で切る。同じシートは同じ倍率のまま（高さの比が保たれる）
import numpy as np, os, json, re
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'
os.makedirs(OUT, exist_ok=True)

def alpha(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = 1 - np.clip((k - 22) / (90 - 22), 0, 1)
    lim = np.maximum(r, b); g2 = np.where(g > lim, lim + (g - lim) * 0.0, g)   # 緑かぶりを消す
    return np.dstack([r, g2, b, al * 255]).clip(0, 255).astype(np.uint8)

def label(mask):   # 4近傍のラベリング（scipy なし・縮小して速く）
    h, w = mask.shape; lab = np.zeros((h, w), np.int32); n = 0; boxes = []
    for y in range(h):
        for x in np.flatnonzero(mask[y] & (lab[y] == 0)):
            if lab[y, x]: continue
            n += 1; st = [(y, x)]; lab[y, x] = n; c = 0; x0 = x1 = x; y0 = y1 = y; sx = 0; sy = 0
            while st:
                j, i = st.pop(); c += 1; sx += i; sy += j
                x0 = min(x0, i); x1 = max(x1, i); y0 = min(y0, j); y1 = max(y1, j)
                for a, b in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)):
                    if 0 <= a < h and 0 <= b < w and mask[a, b] and not lab[a, b]: lab[a, b] = n; st.append((a, b))
            boxes.append((x0, y0, x1 + 1, y1 + 1, c, sx / c, sy / c))
    return boxes

MAN = {}
def sheet(src, cols, rows, names, heights=None, max_h=720, order=None):
    im = Image.open(D + '/raw/' + src + '.png').convert('RGB'); A = alpha(np.asarray(im).astype(np.float32))
    im = Image.fromarray(A, 'RGBA'); a4 = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)); im.putalpha(a4)
    W, H = im.size; S = 4
    small = np.asarray(a4.resize((W // S, H // S), Image.BILINEAR)) > 90
    comps = [b for b in label(small) if b[4] > 12]
    cells = {}
    for b in comps:
        cx = (b[0] + b[2]) / 2 * S; cy = (b[1] + b[3]) / 2 * S
        c = min(cols - 1, int(cx / W * cols)); r = min(rows - 1, int(cy / H * rows)); cells.setdefault(r * cols + c, []).append(b)
    scale = None
    for i, name in enumerate(names):
        if name is None or i not in cells: 
            if name: print('MISSING', name)
            continue
        bs = cells[i]; x0 = min(b[0] for b in bs) * S - 6; y0 = min(b[1] for b in bs) * S - 6; x1 = max(b[2] for b in bs) * S + 6; y1 = max(b[3] for b in bs) * S + 6
        # このマスに属さない塊を消してから切る
        crop = im.crop((max(0, x0), max(0, y0), min(W, x1), min(H, y1)))
        if scale is None:
            scale = min(1, max_h / max(crop.size))
        out = crop.resize((max(1, round(crop.size[0] * scale)), max(1, round(crop.size[1] * scale))), Image.LANCZOS)
        out.save(OUT + name + '.webp', quality=86, method=6)
        MAN[name] = {'w': out.size[0], 'h': out.size[1]}
        print(name, out.size, os.path.getsize(OUT + name + '.webp') // 1024, 'KB')

def wall(name):
    im = Image.open(D + '/raw/' + name + '.png').convert('RGB'); W, H = im.size
    h = round(W * 2.6 / 6); y = (H - h) // 2
    im.crop((0, y, W, y + h)).save(OUT + name + '.webp', quality=78, method=6); print(name, os.path.getsize(OUT + name + '.webp') // 1024, 'KB')
    MAN[name] = {'w': W, 'h': h}

sheet('dad', 3, 1, ['dad_walk', 'dad_wind', 'dad_hit'])
sheet('mom', 3, 1, ['mom_walk', 'mom_wind', 'mom_hit'])
sheet('kid', 3, 1, ['kid_walk', 'kid_wind', 'kid_hit'])
sheet('gramps', 3, 1, ['gramps_walk', 'gramps_wind', 'gramps_hit'])
sheet('neighbor', 3, 1, ['neighbor_walk', 'neighbor_wind', 'neighbor_hit'])
sheet('cat', 3, 1, ['cat_walk', 'cat_wind', 'cat_hit'], max_h=560)
sheet('pig', 2, 1, ['pig_walk', 'pig_hit'], max_h=560)
sheet('mosquito', 3, 2, ['m_back', 'm_front', 'm_panic', 'm_cough', 'm_flat', 'm_wing'], max_h=420)
sheet('props', 3, 2, ['p_swatter', 'p_net', 'p_teeth', 'p_burst', 'p_puff', 'p_fan'], max_h=460)
for w in ['wall_n', 'wall_e', 'wall_s', 'wall_w']: wall(w)
Image.open(D + '/raw/title.png').convert('RGB').save(OUT + 'title.webp', quality=78, method=6)
json.dump(MAN, open(OUT + 'sprites.json', 'w'), separators=(',', ':'))

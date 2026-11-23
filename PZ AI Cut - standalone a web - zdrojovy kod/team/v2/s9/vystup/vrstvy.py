# S5: ktera vrstva je videt na kazdem snimku exportu (V1 / V2 / cerna / prolnuti) proti zdrojum s ocekavanym vyrezem.
# Zdroj se dekoduje NEZAVISLE na exporteru: vystupni -ss (dekodovani od zacatku souboru), 320x180 sede.
# python vrstvy.py <export> <sekvence> [vypis_snimku]
# vystup: souhrn po useckach + snimky, kde nejlepsi shoda nesedi s ocekavanou vrstvou; prolnuti: alfa po snimcich
import sys, os, json, subprocess, numpy as np, cv2
here = os.path.dirname(os.path.abspath(__file__))
SRC = {'tncz': 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4',
       'vyrez-5min.mp4': os.path.join(here, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4')}
FPS = 25
exp, name = sys.argv[1], sys.argv[2]
verbose = len(sys.argv) > 3
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))[name]
W, H = S['w'], S['h']
WC, HC = int(round(90 * W / H)), 90
R0, R1 = 9, 50  # pas 10-55 % vysky (bez titulku)
def srcpath(m): return SRC['tncz'] if m.startswith('tncz') else SRC[m]
cache = {}
def srcframes(m, a, n):
    key = (m, a, n)
    fn = os.path.join(os.environ.get('TEMP', '.'), 'pz-s5-src-%s-%d-%d.npy' % (m[:8], a, n))
    if key not in cache and os.path.exists(fn): cache[key] = np.load(fn)
    if key not in cache:
        b = subprocess.run(['ffmpeg', '-v', 'error', '-i', srcpath(m), '-ss', '%.3f' % (a / FPS), '-frames:v', str(n), '-an', '-vf', 'scale=320:180:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
        cache[key] = np.frombuffer(b, np.uint8).reshape(-1, 180, 320)
        np.save(fn, cache[key])
    return cache[key]
def crop(c):
    iw, ih = 1280, 720
    base = max(W / iw, H / ih) if c['fit'] == 'cover' else min(W / iw, H / ih)
    k = base
    sw, sh = max(2, round(iw * k / 2) * 2), max(2, round(ih * k / 2) * 2)
    cw, ch = min(W, sw), min(H, sh)
    x = round(max(0, (sw - cw) / 2 * (1 + (c.get('posX') or 0))))
    y = round(max(0, (sh - ch) / 2 * 1))
    f = 320 / iw
    return (x / k * f, y / k * f, cw / k * f, ch / k * f)
# snimky zdroje pro kazdy klip (s rezervou 1 s kvuli prolnuti)
clipsrc = []
for ti, t in enumerate(S['video']):
    for c in t:
        a = int(round(c['in'] * FPS)) - 25; n = int(round((c['out'] - c['in']) * FPS)) + 50
        a = max(0, a)
        clipsrc.append((ti, c, a, srcframes(c['media'], a, n)))
def expect(ti_want, k):
    t = k / FPS + 1e-4
    for ti, c, a, fr in clipsrc:
        if ti != ti_want: continue
        end = c['start'] + c['out'] - c['in']
        if c['start'] - 1e-4 <= t < end - 1e-4:
            j = int(round((c['in'] + t - c['start']) * FPS)) - a
            if 0 <= j < len(fr):
                x, y, w, h = crop(c)
                im = fr[j][int(round(y)):int(round(y + h)), int(round(x)):int(round(x + w))].astype(np.float32)
                return cv2.resize(im, (WC, HC), interpolation=cv2.INTER_AREA)[R0:R1], c
    return None, None
b = subprocess.run(['ffmpeg', '-v', 'error', '-i', exp, '-an', '-vf', 'scale=%d:%d:flags=area,format=gray' % (WC, HC), '-f', 'rawvideo', '-'], capture_output=True).stdout
E = np.frombuffer(b, np.uint8).reshape(-1, HC, WC).astype(np.float32)[:, R0:R1]
nV = len(S['video'])
rows = []
for k in range(len(E)):
    ex = [expect(ti, k) for ti in range(nV)]
    top = max([ti for ti in range(nV) if ex[ti][0] is not None], default=-1)
    d = [float(np.abs(E[k] - ex[ti][0]).mean()) if ex[ti][0] is not None else None for ti in range(nV)]
    rows.append((k, top, d, float(E[k].mean())))
# souhrn: usecky podle ocekavane horni vrstvy
print('%s (%s %dx%d): %d snimku' % (os.path.basename(exp), name, W, H, len(E)))
seg = []
for k, top, d, lum in rows:
    if seg and seg[-1][0] == top: seg[-1][2] = k
    else: seg.append([top, k, k])
bad = []
for top, a, z in seg:
    dt = [rows[k][2][top] for k in range(a, z + 1)] if top >= 0 else []
    other = [min([x for i, x in enumerate(rows[k][2]) if x is not None and i != top], default=None) for k in range(a, z + 1)]
    oth = [x for x in other if x is not None]
    print('  sn %4d-%4d (%6.2f-%6.2f s) ocekavano %s: chyba k ocekavane median %.1f max %.1f | k jine vrstve median %s | jas %.0f-%.0f' % (
        a, z, a / FPS, (z + 1) / FPS, ('V%d' % (top + 1)) if top >= 0 else 'cerna', np.median(dt) if dt else -1, max(dt) if dt else -1,
        ('%.1f' % np.median(oth)) if oth else '-', min(rows[k][3] for k in range(a, z + 1)), max(rows[k][3] for k in range(a, z + 1))))
    for k in range(a, z + 1):
        dd = rows[k][2]
        if top >= 0 and dd[top] is not None:
            alt = [x for i, x in enumerate(dd) if x is not None and i != top]
            if dd[top] > 12 or (alt and min(alt) < dd[top]): bad.append((k, top, [None if x is None else round(x, 1) for x in dd], round(rows[k][3])))
print('  snimky, kde ocekavana vrstva nesedi (chyba > 12 nebo jina vrstva blize): %d' % len(bad))
for x in bad[:60]: print('    sn %d (%.2f s) ocek. V%d chyby %s jas %d' % (x[0], x[0] / FPS, x[1] + 1, x[2], x[3]))
if verbose:
    for k, top, d, lum in rows: print('%d %.2f V%d %s %.0f' % (k, k / FPS, top + 1, [None if x is None else round(x, 1) for x in d], lum))

# S6: prolnuti V2 <-> V1 (vIn/vOut cross 'under') v libovolnem vyrezu: pro kazdy snimek v [t0, t1) ocekavany obraz V1 a V2
# (zdroje z mezipameti srccache.py, vyrez podle sekvence.json jako vrstvy.py, zdroje dekodovane nezavisle - vystupni -ss), fit E = (1-a)*V1 + a*V2 (nejmensi ctverce),
# zbytek, jas, krok alfy. python prolnutiV2.py <export> <sekvence> <t0> <t1>
import sys, os, json, subprocess, numpy as np, cv2
here = os.path.dirname(os.path.abspath(__file__))
SRC = {'tncz': 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4',
       'vyrez-5min.mp4': os.path.join(here, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4')}
FPS = 25
exp, name, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))[name]
W, H = S['w'], S['h']
WC, HC = int(round(90 * W / H)), 90
R0, R1 = 9, 50
def sp(m): return SRC['tncz'] if m.startswith('tncz') else SRC[m]
def frame(m, ts):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', sp(m), '-ss', '%.3f' % ts, '-frames:v', '1', '-an', '-vf', 'scale=320:180:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(180, 320)
def crop(c):
    iw, ih = 1280, 720
    k = max(W / iw, H / ih) if c['fit'] == 'cover' else min(W / iw, H / ih)
    sw, sh = max(2, round(iw * k / 2) * 2), max(2, round(ih * k / 2) * 2)
    cw, ch = min(W, sw), min(H, sh)
    x = round(max(0, (sw - cw) / 2 * (1 + (c.get('posX') or 0)))); y = round(max(0, (sh - ch) / 2))
    f = 320 / iw
    return (x / k * f, y / k * f, cw / k * f, ch / k * f)
def expect(ti, t):
    for c in S['video'][ti]:
        end = c['start'] + c['out'] - c['in']
        if c['start'] - 1e-4 <= t < end - 1e-4:
            a = max(0, int(round(c['in'] * 25)) - 25); n = int(round((c['out'] - c['in']) * 25)) + 50
            F = np.load(os.path.join(os.environ['TEMP'], 'pz-s5-src-%s-%d-%d.npy' % (c['media'][:8], a, n)))  # srccache.py / vrstvy.py
            fr = F[int(round((c['in'] + t - c['start']) * FPS)) - a]
            x, y, w, h = crop(c)
            im = fr[int(round(y)):int(round(y + h)), int(round(x)):int(round(x + w))].astype(np.float32)
            return cv2.resize(im, (WC, HC), interpolation=cv2.INTER_AREA)[R0:R1]
    return None
k0, k1 = int(round(t0 * FPS)), int(round(t1 * FPS))
b = subprocess.run(['ffmpeg', '-v', 'error', '-i', exp, '-an', '-vf', 'scale=%d:%d:flags=area,format=gray' % (WC, HC), '-f', 'rawvideo', '-'], capture_output=True).stdout
E = np.frombuffer(b, np.uint8).reshape(-1, HC, WC).astype(np.float32)[k0:k1, R0:R1]
print('%s (%s %dx%d) sn %d-%d' % (os.path.basename(exp), name, W, H, k0, k1 - 1))
prev = None
for i, k in enumerate(range(k0, k1)):
    t = k / FPS + 1e-4
    A, B = expect(0, t), expect(1, t)
    e = E[i]
    if A is None or B is None:
        print('  sn %d %.2f s: jen %s, chyba %.1f, jas %.0f' % (k, k / FPS, 'V1' if A is not None else 'V2' if B is not None else '-', float(np.abs(e - (A if A is not None else B)).mean()) if (A is not None or B is not None) else -1, e.mean())); prev = None; continue
    a, bb, ee = A.ravel(), B.ravel(), e.ravel()
    d = bb - a; al = float(np.dot(ee - a, d) / (np.dot(d, d) + 1e-9)); res = float(np.abs(ee - (a + al * d)).mean())
    print('  sn %d %.2f s: alfa V2 %.3f zbytek %.1f | chyba k V1 %.1f k V2 %.1f | jas %.0f (V1 %.0f V2 %.0f) krok %s' % (k, k / FPS, al, res, float(np.abs(ee - a).mean()), float(np.abs(ee - bb).mean()), e.mean(), A.mean(), B.mean(), '-' if prev is None else '%+.3f' % (al - prev)))
    prev = al

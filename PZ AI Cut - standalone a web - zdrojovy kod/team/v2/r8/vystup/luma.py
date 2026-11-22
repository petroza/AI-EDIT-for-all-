# Rozsah jasu exportu proti zdroji: surova rovina Y (extractplanes, bez prevodu rozsahu), stejne snimky, pas 0-70 % vysky
# (bez titulku). Linearni fit export = k*zdroj + q, p1/p99 obou. Pouziti: python luma.py <x> "<sekvence>" [export]
import sys, os, json, subprocess, numpy as np
key, seq = sys.argv[1], sys.argv[2]
exp = sys.argv[3] if len(sys.argv) > 3 else '../../../../web/test-out/vystup-r8-%s.mp4' % key
S = json.load(open('sekvence.json', encoding='utf-8'))[seq]
pf = {r['t']: r for r in json.load(open('m-%s-snimky.json' % key))}
W, H = S['w'], S['h']; qh = 180; qw = int(round(W * qh / H))
def Y(path, w, h, ss=None, t=None):
    cmd = ['ffmpeg', '-v', 'error'] + (['-ss', '%.3f' % max(0, ss - float(os.environ.get('PREROLL', '0')))] if ss is not None else []) + ['-i', path] + (['-ss', '%.3f' % min(ss, float(os.environ.get('PREROLL', '0')))] if ss is not None and float(os.environ.get('PREROLL', '0')) else []) + (['-t', '%.3f' % t] if t else []) + ['-an', '-vf', 'extractplanes=y,scale=%d:%d:flags=area' % (w, h), '-pix_fmt', 'gray', '-f', 'rawvideo', '-']
    b = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(-1, h, w).astype(np.float32)
E = Y(exp, qw, qh)
xs, ys = [], []
r0, r1 = (0, int(qh * 0.7)) if 'crop_x' not in next(iter(pf.values())) else (int(qh * 0.25), int(qh * 0.55))
for c in S['video'][0]:
    F = Y(os.environ.get('SRC', '../../../../test/media/vyrez-5min.mp4'), 320, 180, c['in'], c['out'] - c['in'] + 0.001)
    k0 = int(round(c['start'] * 25))
    for j in range(0, len(F), 5):
        k = k0 + j
        if k >= len(E): break
        r = pf.get(round(k / 25, 2))
        if r is None: continue
        if 'crop_x' in r:
            x = r['crop_x'] // 4; ref = F[j][r0:r1, x:x + qw]
        else:
            ref = F[j][r0:r1]
        e = E[k][r0:r1]
        if ref.shape != e.shape: continue
        xs.append(ref.ravel()); ys.append(e.ravel())
x = np.concatenate(xs).astype(np.float64); y = np.concatenate(ys).astype(np.float64)
k, q = np.polyfit(x, y, 1)
print('%s export = %.3f*zdroj %+.1f | zdroj p1/p99 %.0f/%.0f, export p1/p99 %.0f/%.0f | prum. abs. odchylka %.1f | export min/max %.0f/%.0f' % (
    key, k, q, np.percentile(x, 1), np.percentile(x, 99), np.percentile(y, 1), np.percentile(y, 99), np.abs(y - x).mean(), y.min(), y.max()))

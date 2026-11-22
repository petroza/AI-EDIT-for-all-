# Chyba kazdeho snimku exportu proti zdroji (stejny vyrez z m-<x>-snimky.json, ctvrtinove rozliseni, jen pas 25-55 % vysky
# bez nadpisu a titulku, export prepocten z plneho na TV rozsah). Spicky = artefakty kodovani / spatny snimek.
import sys, os, json, subprocess, numpy as np
key, W, H, seq = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
S = json.load(open('sekvence.json', encoding='utf-8'))[seq]
pf = json.load(open('m-%s-snimky.json' % key))
qh = 180; qw = int(round(W * qh / H))
def fr(path, w, h, ss=None, t=None):
    cmd = ['ffmpeg', '-v', 'error'] + (['-ss', '%.3f' % max(0, ss - float(os.environ.get('PREROLL', '0')))] if ss is not None else []) + ['-i', path] + (['-ss', '%.3f' % min(ss, float(os.environ.get('PREROLL', '0')))] if ss is not None and float(os.environ.get('PREROLL', '0')) else []) + (['-t', '%.3f' % t] if t else []) + ['-an', '-vf', 'scale=%d:%d' % (w, h), '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-']
    b = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(-1, h, w, 3).astype(np.float32)
# r8: export je po oprave v TV rozsahu (luma.py: 0,98*zdroj+4) -> bez prepoctu z plneho rozsahu
FILES = {'a':'vystup-s1-a.mp4','b':'vystup-s1-b.mp4','b265':'vystup-s1-b-h265.mp4','c':'vystup-s1-c.mov','d':'vystup-s1-d.mp4','dmxf':'vystup-s1-d.mxf','e':'vystup-s1-e.mp4','emxf':'vystup-s1-e.mxf','axd':'vystup-s1-a-xdcam.mxf'}
E = fr('../../../../web/test-out/' + FILES[key], qw, qh)
src = {}
for c in S['video'][0]:
    src[c['start']] = (c, fr(os.environ.get('SRC', '../../../../test/media/vyrez-5min.mp4'), 320, 180, c['in'], c['out'] - c['in'] + 0.001))
r0, r1 = int(qh * 0.25), int(qh * 0.55)
errs = []
for r in pf:
    k = int(round(r['t'] * 25))
    c, F = max(((c, F) for st, (c, F) in src.items() if st <= r['t'] + 1e-6), key=lambda x: x[0]['start'])
    j = k - int(round(c['start'] * 25))
    if j >= len(F) or k >= len(E): continue
    x = r.get('crop_x', 0) // 4
    ref = F[j][r0:r1, x:x + qw] if 'crop_x' in r else F[j][r0:r1]
    e = E[k][r0:r1]
    if ref.shape != e.shape: continue
    errs.append((r['t'], float(np.abs(e - ref).mean())))
v = np.array([e for _, e in errs]); med = float(np.median(v))
for t, e in errs:
    if any(abs(t - q) < 0.6 for q in map(float, sys.argv[5:])): print('  t=%.2f err=%.2f' % (t, e))
print(key, 'median err %.2f' % med, 'frames > 1.6x median:', [(t, round(e, 1)) for t, e in errs if e > 1.6 * med])

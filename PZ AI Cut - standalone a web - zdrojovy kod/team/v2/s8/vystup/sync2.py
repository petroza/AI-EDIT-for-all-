# S8: A/V sync exportu proti zdroji po klipech V1/A1 (zobecneny sync_snimky.py + sync_zvuk.py z S3 pro oba zdroje).
# Obraz: jen 16:9 (contain), pas 10-55 % vysky, posun -2..+2 snimky. Zdroj: VYSTUPNI -ss (dekodovani od zacatku; input -ss u 28min zdroje vraci jiny zaber - overeno S8, dbg-sim-*.png).
# Zvuk: krizova korelace okna 2 s od +0,3 s klipu, +-120 ms. python sync2.py <export> <sekvence> [jen_zvuk]
import sys, os, json, subprocess, numpy as np
here = os.path.dirname(os.path.abspath(__file__))
SRC = {'tncz': 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4', 'vyrez': os.path.join(here, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4')}
sp = lambda m: SRC['tncz'] if m.startswith('tncz') else SRC['vyrez']
W, H, SR = 160, 90, 8000
def dec(p, ss=None, n=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', p] + (['-ss', '%.3f' % ss] if ss is not None else []) + ['-an'] + (['-frames:v', str(n)] if n else []) + ['-vf', 'scale=%d:%d:flags=area,format=gray' % (W, H), '-f', 'rawvideo', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.uint8).reshape(-1, H, W)[:, 9:50].astype(np.int16)
def pcm(p, ss, t, ch=None):
    cmd = ['ffmpeg', '-v', 'error', '-ss', '%.4f' % ss, '-i', p, '-t', '%.4f' % t] + (['-map', '0:a:%d' % ch] if ch is not None else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32).astype(np.float64)
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8'))[sys.argv[2]]
f = sys.argv[1]; print('%s (%s)' % (os.path.basename(f), sys.argv[2]))
if len(sys.argv) < 4:
    E = dec(f)
    for c in S['video'][0]:
        k0, n, s0 = int(round(c['start'] * 25)), int(round((c['out'] - c['in']) * 25)), int(round(c['in'] * 25))
        a = max(0, s0 - 25); Sx = dec(sp(c['media']), a / 25, n + 50); s0 -= a
        r = {}
        for o in range(-2, 3):
            v = [np.abs(E[k0 + j] - Sx[s0 + j + o]).mean() for j in range(n) if k0 + j < len(E) and 0 <= s0 + j + o < len(Sx)]
            r[o] = round(float(np.mean(v)), 2)
        print('  obraz %6.2f-%6.2f (zdroj %.2f): posun %+d  chyby %s' % (c['start'], c['start'] + n / 25, c['in'], min(r, key=r.get), r))
ch = 0 if f.endswith('.mxf') else None
EF = pcm(f, 0, 1e4, ch); out = []
for c in S['audio'][0]:
    L = min(2.0, c['out'] - c['in'] - 0.4)
    if L < 0.3: out.append('%.2f:kratky' % c['start']); continue
    a0 = int(round((c['start'] + 0.3) * SR)); e = EF[a0:a0 + int(L * SR)]
    s = pcm(sp(c['media']), c['in'] + 0.3 - 0.12, L + 0.24)
    best = (-2, 0)
    for lag in range(0, len(s) - len(e) + 1):
        x = s[lag:lag + len(e)]; r = float(np.dot(e, x) / (np.linalg.norm(e) * np.linalg.norm(x) + 1e-12))
        if r > best[0]: best = (r, lag)
    out.append('%.2f:%+.1fms(r=%.2f)' % (c['start'], (best[1] / SR - 0.12) * 1000, best[0]))
print('  zvuk', ' '.join(out))

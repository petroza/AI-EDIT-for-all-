# Zvuk exportu proti zdroji po klipech: posun (ms) z krizove korelace (okno 2 s od +0,3 s klipu, +-120 ms) a korelace.
# python sync_zvuk.py <export> <sekvence>
import sys, os, json, subprocess, numpy as np
SR = 8000
def pcm(p, ss, t, ch=None):
    cmd = ['ffmpeg', '-v', 'error', '-ss', '%.4f' % ss, '-i', p, '-t', '%.4f' % t]
    if ch is not None: cmd += ['-map', '0:a:%d' % ch]
    cmd += ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32).astype(np.float64)
here = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(here, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4')
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8'))[sys.argv[2]]
ch = 0 if sys.argv[1].endswith('.mxf') else None
out = []
# cele soubory od zacatku bez -ss (seek v MXF/AAC muze byt nepresny)
EF = pcm(sys.argv[1], 0, 1e4, ch); SF = pcm(SRC, 0, 1e4)
for c in S['audio'][0]:
    L = min(2.0, c['out'] - c['in'] - 0.4)
    a0 = int(round((c['start'] + 0.3) * SR)); e = EF[a0:a0 + int(L * SR)]
    b0 = int(round((c['in'] + 0.3 - 0.12) * SR)); s = SF[b0:b0 + int((L + 0.24) * SR)]
    best = (-2, 0)
    for lag in range(0, len(s) - len(e) + 1):
        x = s[lag:lag + len(e)]; r = float(np.dot(e, x) / (np.linalg.norm(e) * np.linalg.norm(x) + 1e-12))
        if r > best[0]: best = (r, lag)
    out.append('%.2f:%+.1fms(r=%.2f)' % (c['start'], (best[1] / SR - 0.12) * 1000, best[0]))
print(os.path.basename(sys.argv[1]), ' '.join(out))

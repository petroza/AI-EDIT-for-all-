# S8: je v exportu 9:16 clovek? OpenCV Haar (frontal + profil oba smery) na kazdem 5. snimku (0,2 s), 540 px na sirku.
# Souhrn po klipech horni viditelne vrstvy (sekvence.json): podil vzorku s obliceji. python obliceje.py <export> <sekvence>
import sys, os, json, subprocess, numpy as np, cv2
here = os.path.dirname(os.path.abspath(__file__))
f, name = sys.argv[1], sys.argv[2]
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))[name]
W = 540; H = round(W * S['h'] / S['w'] / 2) * 2
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-an', '-vf', 'select=not(mod(n\,5)),scale=%d:%d,format=gray' % (W, H), '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
cf = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
cp = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
def face(g):
    g = g[: int(H * 0.62)]  # bez pasu titulku
    a = cf.detectMultiScale(g, 1.1, 5, minSize=(30, 30)); b = cp.detectMultiScale(g, 1.1, 5, minSize=(30, 30)); c = cp.detectMultiScale(np.ascontiguousarray(g[:, ::-1]), 1.1, 5, minSize=(30, 30))
    return len(a) + len(b) + len(c) > 0
hits = [face(g) for g in F]
segs = []
for ti, tr in enumerate(S['video']):
    for c in tr: segs.append((ti, c['start'], c['start'] + c['out'] - c['in'], c['in'], c.get('posX')))
def top(t):
    best = None
    for s in segs:
        if s[1] <= t < s[2] and (best is None or s[0] > best[0]): best = s
    return best
res = {}
for i, h in enumerate(hits):
    t = i * 5 / 25; s = top(t)
    k = ('V%d %6.2f-%6.2f zdroj %.2f posX %s' % (s[0] + 1, s[1], s[2], s[3], ('%.3f' % s[4]) if s[4] is not None else '-')) if s else 'mezera'
    res.setdefault(k, []).append((t, h))
print('%s (%s): %d vzorku, s obliceji %d (%.0f %%)' % (os.path.basename(f), name, len(hits), sum(hits), 100 * sum(hits) / max(1, len(hits))))
for k, v in sorted(res.items(), key=lambda kv: kv[1][0][0]):
    miss = [t for t, h in v if not h]
    print('  %s: %d/%d vzorku s obliceji; bez obliceje v %s' % (k, sum(h for _, h in v), len(v), ' '.join('%.1f' % t for t in miss[:30]) + (' …' if len(miss) > 30 else '')))

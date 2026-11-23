# S5: obraz exportu proti zdroji po klipech vsech video stop, posun -2..+2 snimky (jen 16:9 contain), bez prechodu (okraj 1,1 s od hran)
# zdroje z mezipameti vrstvy.py (%TEMP%\pz-s5-src-*.npy, 320x180, vystupni -ss); python sync_off.py <export> <sekvence>
import sys, os, json, subprocess, numpy as np, cv2
here = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))[sys.argv[2]]
b = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-an', '-vf', 'scale=160:90:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
E = np.frombuffer(b, np.uint8).reshape(-1, 90, 160).astype(np.float32)[:, 9:50]
print(os.path.basename(sys.argv[1]))
for ti, tr in enumerate(S['video']):
    for c in tr:
        a = max(0, int(round(c['in'] * 25)) - 25); n = int(round((c['out'] - c['in']) * 25)) + 50
        fr = np.load(os.path.join(os.environ['TEMP'], 'pz-s5-src-%s-%d-%d.npy' % (c['media'][:8], a, n)))
        k0 = int(round(c['start'] * 25)); m = int(round((c['out'] - c['in']) * 25)); s0 = int(round(c['in'] * 25)) - a
        ks = [k for k in range(k0 + 28, k0 + m - 28)]
        r = {}
        for o in range(-2, 3):
            v = [np.abs(E[k] - cv2.resize(fr[s0 + (k - k0) + o].astype(np.float32), (160, 90), interpolation=cv2.INTER_AREA)[9:50]).mean() for k in ks if 0 <= s0 + (k - k0) + o < len(fr) and k < len(E)]
            r[o] = round(float(np.mean(v)), 2) if v else None
        best = min((o for o in r if r[o] is not None), key=lambda o: r[o])
        print('  V%d %6.2f-%6.2f (zdroj %.2f): posun %+d snimku, chyby %s' % (ti + 1, c['start'], c['start'] + m / 25, c['in'], best, r))

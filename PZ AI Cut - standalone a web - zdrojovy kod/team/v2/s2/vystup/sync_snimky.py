# Obraz exportu proti zdroji po snimcich: pro kazdy klip sekvence nejlepsi posun (-2..+2 snimky) a chyba.
# Jen 16:9 sekvence (fit contain, cely obraz). Pas 10-55 % vysky (bez titulku).
# python sync_snimky.py <export> <nazev sekvence>   (sekvence.json; zdroj test/media/vyrez-5min.mp4)
import sys, os, json, subprocess, numpy as np
W, H = 160, 90
def dec(p):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-an', '-vf', 'scale=%d:%d:flags=area,format=gray' % (W, H), '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(-1, H, W)[:, 9:50].astype(np.int16)
here = os.path.dirname(os.path.abspath(__file__))
cache = os.path.join(os.environ.get('TEMP', '.'), 'pz-s2-src160.npy')
if not os.path.exists(cache): np.save(cache, dec(os.path.join(here, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4')))
S = np.load(cache)
S_ = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8'))[sys.argv[2]]
E = dec(sys.argv[1])
print('%s (%s): %d snimku' % (os.path.basename(sys.argv[1]), sys.argv[2], len(E)))
for c in S_['video'][0]:
    k0, n = int(round(c['start'] * 25)), int(round((c['out'] - c['in']) * 25)); s0 = int(round(c['in'] * 25))
    r = {}
    for o in range(-2, 3):
        v = [np.abs(E[k0 + j] - S[s0 + j + o]).mean() for j in range(n) if k0 + j < len(E) and 0 <= s0 + j + o < len(S)]
        r[o] = round(float(np.mean(v)), 2)
    best = min(r, key=r.get)
    # prvni a posledni snimek klipu zvlast (kraje)
    e1 = round(float(np.abs(E[k0] - S[s0]).mean()), 2); e2 = round(float(np.abs(E[min(k0 + n - 1, len(E) - 1)] - S[s0 + n - 1]).mean()), 2)
    print('  klip %6.2f-%6.2f (zdroj %.2f): posun %+d  chyby %s  1./posl. snimek %s/%s' % (c['start'], c['start'] + n / 25, c['in'], best, r, e1, e2))

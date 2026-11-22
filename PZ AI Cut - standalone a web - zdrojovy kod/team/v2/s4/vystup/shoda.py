# Pro kazdy snimek exportu najde nejpodobnejsi snimek zdroje v okne (bez -ss: dekodovani od od-3 s s presnym poctem snimku)
# python shoda.py export zdroj zdroj_od zdroj_do [od_snimku_exportu] [crop pas 10-55 %]
import sys, subprocess, numpy as np
def dec(p, ss=None, t=None):
    cmd = ['ffmpeg', '-v', 'error'] + (['-ss', '%.3f' % ss] if ss is not None else []) + ['-i', p] + (['-t', '%.3f' % t] if t else []) + ['-an', '-vf', 'scale=160:90:flags=area,format=gray', '-f', 'rawvideo', '-']
    b = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(-1, 90, 160)[:, 9:50].astype(np.int16)
E = dec(sys.argv[1]); a, b = float(sys.argv[3]), float(sys.argv[4]); k0 = int(sys.argv[5]) if len(sys.argv) > 5 else 0
# presne: dekodovat od a-10 s s -ss pred vstupem a overit pts pres showinfo by bylo drahe; pouzij -ss a pak kontrolu zarovnani na znamem snimku
S = dec(sys.argv[2], a, b - a)
for k in range(k0, len(E)):
    d = [np.abs(E[k] - s).mean() for s in S]; j = int(np.argmin(d))
    print('sn %d (%.2f s) -> zdroj %.2f (chyba %.1f)' % (k, k / 25, a + j / 25, d[j]))

# S5: plynulost prolinacky: alfa po snimcich (E = (1-a)*A + a*B, nejmensi ctverce), A = levy klip vc. materialu za Out,
# B = pravy klip vc. materialu pred In; zdroje dekodovane nezavisle (vystupni -ss).
# python prolnuti.py <export> <strih_s> <A_zdroj> <A_out> <B_zdroj> <B_in> <delka_prolnuti> [W H]
import sys, subprocess, numpy as np, cv2
exp, cut, Ap, Aout, Bp, Bin, D = sys.argv[1], float(sys.argv[2]), sys.argv[3], float(sys.argv[4]), sys.argv[5], float(sys.argv[6]), float(sys.argv[7])
FPS = 25; WC, HC = 160, 90
def dec(p, ss, n, out=True):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ss', '%.3f' % ss, '-frames:v', str(n), '-an', '-vf', 'scale=%d:%d:flags=area,format=gray' % (WC, HC), '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(-1, HC, WC).astype(np.float32)[:, 9:50]
k0 = int(round((cut - D / 2 - 0.2) * FPS)); n = int(round((D + 0.4) * FPS))
E = dec(exp, k0 / FPS, n)
A = dec(Ap, Aout + (k0 / FPS - cut), n)
B = dec(Bp, Bin + (k0 / FPS - cut), n)
print('%s: strih %.2f, prolnuti %.2f s (ocekavano %.2f-%.2f)' % (exp.split('\\')[-1].split('/')[-1], cut, D, cut - D / 2, cut + D / 2))
prev = None
for i in range(len(E)):
    a, b, e = A[i].ravel(), B[i].ravel(), E[i].ravel()
    d = b - a; al = float(np.dot(e - a, d) / (np.dot(d, d) + 1e-9))
    res = float(np.abs(e - (a + al * d)).mean())
    t = (k0 + i) / FPS
    exp_al = min(1, max(0, (t - (cut - D / 2)) / D))
    print('  sn %d %.2f s: alfa %.3f (lin. %.3f) zbytek %.1f krok %s' % (k0 + i, t, al, exp_al, res, '-' if prev is None else '%+.3f' % (al - prev)))
    prev = al

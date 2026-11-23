# S10: PCM 24 bit (export bez normalizace) - razor-g (kusy se zesilenim -0,01 dB => kazdy kus cten zvlast, bez slouceni) proti sim (bez rezu):
# posun vzorku za kazdym rezem (korelace) a rezidua po odecteni zisku -0,01 dB; ocekavani pri presnem cteni: posun 0, rezidua ~ -inf
import sys, subprocess, numpy as np
SR = 48000
rd = lambda f: np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '1', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).astype(np.float64)
x, r = rd(sys.argv[1]), rd(sys.argv[2]); cuts = [float(t) for t in sys.argv[3].split(',')]
k = 10 ** (-0.01 / 20)
print('vzorku', len(x), len(r))
for i, t in enumerate(cuts):
    n = int(round(t * SR)); e = cuts[i + 1] if i + 1 < len(cuts) else len(r) / SR
    w = x[n:n + 4800]; best = max(range(-96, 97), key=lambda L: float(np.dot(w, r[n + L:n + L + 4800])))
    seg = slice(n, int(e * SR)); d = x[seg] - k * r[seg]
    j = np.abs(np.diff(x[n - 3:n + 4])).max(); p = np.percentile(np.abs(np.diff(x[n - SR // 2:n + SR // 2])), 99.5)
    print('rez %.2f: posun %+d vz., max |export - 0,9988*ref| v kusu %.2e (%.0f dBFS), cvak %.2f' % (t, best, np.abs(d).max(), 20 * np.log10(np.abs(d).max() + 1e-12), j / p))

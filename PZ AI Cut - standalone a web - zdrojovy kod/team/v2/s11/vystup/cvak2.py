# S10: kazdy rez zvuku A1 (zacatky klipu A1 krome prvniho): (1) cvak = max skok vzorku +-3 kolem rezu / p99,5 skoku v okoli +-0,5 s (>1,5 slysitelne)
# (2) posun vzorku za rezem proti referencnimu exportu (krizova korelace 0,1 s za rezem, +-48 vzorku) a rozdil RMS (export - reference) +-50 ms kolem rezu
# python cvak2.py <export> <sekvence> <reference_export>
import sys, os, json, subprocess, numpy as np
SR = 48000; here = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).astype(np.float64)
x, r = rd(sys.argv[1]), rd(sys.argv[3])
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))[sys.argv[2]]
g = np.dot(x, r) / np.dot(r, r)  # zisk normalizace exportu proti referenci
out = []
for c in S['audio'][0][1:]:
    n = int(round(c['start'] * SR)); seg = x[n - SR // 2:n + SR // 2]
    p = float(np.percentile(np.abs(np.diff(seg)), 99.5)); j = float(np.max(np.abs(np.diff(x[n - 3:n + 4]))))
    w = x[n + 240:n + 240 + 4800]; best = max(range(-48, 49), key=lambda L: float(np.dot(w, r[n + 240 + L:n + 240 + L + 4800])))
    d = x[n - 2400:n + 2400] - g * r[n - 2400:n + 2400]
    rel = 20 * np.log10(np.sqrt(np.mean(d ** 2)) / (np.sqrt(np.mean(r[n - 2400:n + 2400] ** 2)) + 1e-12) + 1e-12)
    out.append('%.2f: cvak %.2f, posun %+d vz., rozdil %.0f dB' % (c['start'], j / max(p, 1e-9), best, rel))
print(os.path.basename(sys.argv[1]), '(zisk proti ref. %.4f)' % g, ' | '.join(out))

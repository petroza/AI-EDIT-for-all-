# S6: Shift+Delete - synchronizace po vyjmuti useku [s, s+d): export po smazani (R) proti exportu puvodni sekvence (M).
# Obraz: R[k] ~ M[k] pro k < s, R[k] ~ M[k + D] pro k >= s (D = d v snimcich), posun -2..+2 snimku po useckach 1 s.
# Zvuk (PCM solo stop A1/A2/A3 + mix): stejne, krizova korelace +-60 ms v oknech 1 s, rozdil v dB.
# python rdcmp.py <M_video> <R_video> <s> <d> <M_pcm_prefix> <R_pcm_prefix> [vynechat_od-do,...]
import sys, subprocess, numpy as np
Mv, Rv, s, d, Mp, Rp = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5], sys.argv[6]
FPS = 25; K = int(round(s * FPS)); D = int(round(d * FPS))
def vid(p):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-an', '-vf', 'scale=160:90:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(-1, 90, 160).astype(np.float32)[:, 9:50]
M, R = vid(Mv), vid(Rv)
print('obraz: M %d sn, R %d sn, ocekavano R = M - %d = %d' % (len(M), len(R), D, len(M) - D))
def mk(k): return k if k < K else k + D
rows = []
for a in range(0, len(R), FPS):
    ks = [k for k in range(a, min(a + FPS, len(R)))]
    err = {}
    for o in range(-2, 3):
        v = [np.abs(R[k] - M[mk(k) + o]).mean() for k in ks if 0 <= mk(k) + o < len(M)]
        err[o] = float(np.mean(v)) if v else 99
    best = min(err, key=err.get)
    rows.append((a / FPS, best, err[0], max(np.abs(R[k] - M[mk(k)]).mean() if mk(k) < len(M) else 99 for k in ks)))
for t, b, e0, mx in rows: print('  %5.2f s: nejlepsi posun %+d sn, chyba pri 0 median %.1f max %.1f%s' % (t, b, e0, mx, '' if b == 0 else '  <-- POSUN'))
print('obraz souhrn: useku 1 s %d, s posunem 0: %d, max chyba pri posunu 0: %.1f' % (len(rows), sum(1 for r in rows if r[1] == 0), max(r[3] for r in rows)))
SR = 48000
def pcm(p):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-map', '0:a:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).astype(np.float64)
db = lambda x: 20 * np.log10(max(x, 1e-12))
for tr in ('a1', 'a2', 'a3', 'mix'):
    try: m, r = pcm(Mp + tr + '.mov'), pcm(Rp + tr + '.mov')
    except Exception as e: print(tr, 'chybi'); continue
    if not len(m) or not len(r): print(tr, 'chybi'); continue
    S0, Ds = int(round(s * SR)), int(round(d * SR))
    lags, res = [], []
    for a in range(0, len(r) - SR, SR):
        w = r[a:a + SR]
        if np.sqrt(np.mean(w ** 2)) < 1e-4: continue
        mm = a if a < S0 else a + Ds
        if a < S0 < a + SR: continue  # okno pres strih
        lo = max(0, mm - 2880); seg = m[lo:mm + SR + 2880]
        if len(seg) < SR + 2880: continue
        cc = np.correlate(seg, w, 'valid'); j = int(np.argmax(cc)); lag = (lo + j - mm) / SR * 1000
        ref = m[mm:mm + SR]
        lags.append(lag); res.append(db(np.sqrt(np.mean((w - ref) ** 2))) - db(np.sqrt(np.mean(ref ** 2))))
    print('zvuk %-3s: oken %d, posun ms min %.2f max %.2f, rozdil proti puvodni (posunute) max %.1f dB pod signalem (median %.1f)' % (tr, len(lags), min(lags), max(lags), max(res), float(np.median(res))))

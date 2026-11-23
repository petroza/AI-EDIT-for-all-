# S5: mix vicestope sekvence. Exporty "solo" (ostatni zvukove stopy ztlumene, hlasitost off) proti zdrojum:
#  - zesileni kazdeho klipu (RMS exportu / RMS zdroje v dB, bez krajnich 0,15 s), posun (krizova korelace +-120 ms)
#  - linearita mixu: export vsech stop (off) - soucet solo exportu
#  - cvaknuti: max skok vzorku +-3 vzorky kolem hrany / p99,5 skoku v okoli +-0,5 s (> 1,5 = slysitelne)
# python mix.py <sekvence> <mix_off.mp4> <solo_a1> <solo_a2> <solo_a3>
import sys, os, json, subprocess, numpy as np
here = os.path.dirname(os.path.abspath(__file__))
SR = 48000
SRC = {'tncz': 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4',
       'vyrez-5min.mp4': os.path.join(here, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4'),
       'mus_stem.wav': 'O:/STRIH TEST/data/mus_stem.wav'}
def sp(m): return SRC['tncz'] if m.startswith('tncz') else SRC[m]
def pcm(p, ss=None, t=None, mono=True):
    cmd = ['ffmpeg', '-v', 'error', '-i', p] + (['-ss', '%.4f' % ss] if ss is not None else []) + (['-t', '%.4f' % t] if t else [])
    cmd += ['-map', '0:a:0', '-ac', '1' if mono else '2', '-ar', str(SR), '-f', 'f32le', '-']
    x = np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2)
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))[sys.argv[1]]
mixf, solos = sys.argv[2], sys.argv[3:6]
X = [pcm(f) for f in solos]
M = pcm(mixf)
db = lambda r: 20 * np.log10(max(r, 1e-12))
print('== zesileni a posun po klipech (solo exporty)')
for ti, tr in enumerate(S['audio']):
    for c in tr:
        d = c['out'] - c['in']; e = X[ti]
        a = int(round((c['start'] + 0.15) * SR)); n = int(round((d - 0.3) * SR))
        seg = e[a:a + n]
        src = pcm(sp(c['media']), c['in'] + 0.15 - 0.12, d - 0.3 + 0.24)
        # posun: korelace na prvnich 2 s (okno), krok 1 vzorek pres FFT
        L = min(len(seg), 2 * SR); w = seg[:L]
        best = (-2, 0)
        cc = np.correlate(src[:L + int(0.24 * SR)], w, 'valid')
        nrm = np.sqrt(np.convolve(src[:L + int(0.24 * SR)] ** 2, np.ones(L), 'valid')) * np.linalg.norm(w) + 1e-12
        r = cc / nrm; j = int(np.argmax(r))
        lag_ms = (j / SR - 0.12) * 1000
        s_al = src[j:j + len(seg)]
        g = db(np.sqrt(np.mean(seg ** 2)) / np.sqrt(np.mean(s_al[:len(seg)] ** 2)))
        print('  A%d %6.2f-%6.2f %-14s zadano %+5.1f dB | namereno %+6.2f dB | posun %+.2f ms (r=%.3f)' % (ti + 1, c['start'], c['start'] + d, c['media'][:14], c['gainDb'] or 0, g, lag_ms, r[j]))
n = min(len(M), *[len(x) for x in X])
res = M[:n] - sum(x[:n] for x in X)
print('== linearita mixu: RMS mixu %.1f dBFS, RMS (mix - soucet solo) %.1f dBFS -> %.1f dB pod mixem' % (db(np.sqrt(np.mean(M[:n] ** 2))), db(np.sqrt(np.mean(res ** 2))), db(np.sqrt(np.mean(M[:n] ** 2))) - db(np.sqrt(np.mean(res ** 2)))))
# hlasitost stop v mixu (RMS jen tam, kde stopa hraje)
for ti, tr in enumerate(S['audio']):
    idx = np.zeros(n, bool)
    for c in tr: idx[int(c['start'] * SR):int((c['start'] + c['out'] - c['in']) * SR)] = True
    print('  A%d v mixu: RMS %.1f dBFS (%.1f s)' % (ti + 1, db(np.sqrt(np.mean(X[ti][:n][idx] ** 2))), idx.sum() / SR))
print('== cvaknuti na hranach (pomer skok/p99,5; > 1,5 = slysitelne)')
edges = sorted(set(round(t, 3) for tr in S['audio'] for c in tr for t in (c['start'], c['start'] + c['out'] - c['in'])))
def click(x, t):
    k = int(round(t * SR)); a, b = max(0, k - SR // 2), min(len(x), k + SR // 2)
    if b - a < 1000: return None
    p = float(np.percentile(np.abs(np.diff(x[a:b])), 99.5)); j = float(np.max(np.abs(np.diff(x[max(0, k - 3):k + 4]))))
    return j / max(p, 1e-9)
for t in edges:
    r = [click(M, t)] + [click(x, t) for x in X]
    print('  %6.2f s: mix %s | A1 %s A2 %s A3 %s' % (t, *['-' if v is None else '%.2f' % v for v in r]))

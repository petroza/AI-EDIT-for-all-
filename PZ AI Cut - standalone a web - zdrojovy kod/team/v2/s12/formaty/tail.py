# RMS posledních 200 ms zvuku (po 10 ms) – je konec exportu tichý?
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ana
for f in sys.argv[1:]:
    x, ch = ana.audio(f)
    if x is None: print(f, 'bez zvuku'); continue
    sr = 48000; n = len(x)
    t = x[-int(0.2 * sr):, 0]
    rms = [round(20 * np.log10(max(1e-7, np.sqrt((t[i:i + 480] ** 2).mean()))), 1) for i in range(0, len(t), 480)]
    silent_from = None
    for i in range(len(x) - 480, 0, -480):
        if np.sqrt((x[i:i + 480, 0] ** 2).mean()) > 1e-3: silent_from = (i + 480) / sr; break
    print(os.path.basename(f), 'délka zvuku %.4f s' % (n / sr), 'zvuk končí v %.3f s' % silent_from, rms[-12:])

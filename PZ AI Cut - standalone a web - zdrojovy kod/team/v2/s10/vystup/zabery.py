# Strihy obrazu v exportu (skok jasu pasu 8-58 % vysky, bez titulku) a delky zaberu; kratsi nez 13 snimku = probliknuti.
# python zabery.py <export> [<export> ...]
import sys, subprocess, numpy as np
for f in sys.argv[1:]:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-an', '-vf', 'scale=96:96,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    F = np.frombuffer(raw, np.uint8).reshape(-1, 96, 96)[:, 8:56].astype(np.int16)
    d = np.abs(np.diff(F, axis=0)).mean((1, 2)); med = float(np.median(d))
    cuts = [i + 1 for i in np.where(d > max(10, 6 * med))[0]]
    b = [0] + cuts + [len(F)]
    shots = [(b[i], b[i + 1] - b[i]) for i in range(len(b) - 1)]
    short = [('%.2f' % (s / 25), n) for s, n in shots if n < 13]
    print('%s: %d snimku, strihy %s | kratke zabery (<13 sn.): %s' % (f.split('/')[-1], len(F), ' '.join('%.2f' % (c / 25) for c in cuts), short or 'zadne'))

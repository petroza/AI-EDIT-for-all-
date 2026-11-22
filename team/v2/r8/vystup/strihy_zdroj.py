# Strihy kamer ve zdroji (prvni snimek noveho zaberu) v useku <od> <do>, dekodovano s nabehem 12 s (ridke klicove snimky).
import sys, subprocess, numpy as np
src, a, b = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
pre = min(12.0, a)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % (a - pre), '-i', src, '-ss', '%.3f' % pre, '-t', '%.3f' % (b - a), '-an', '-vf', 'scale=160:90', '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(np.int16)
d = np.abs(np.diff(f, axis=0)).mean((1, 2)); med = np.median(d)
print(' '.join('%.2f' % (a + (i + 1) / 25) for i in np.where(d > max(12, 8 * med))[0]))

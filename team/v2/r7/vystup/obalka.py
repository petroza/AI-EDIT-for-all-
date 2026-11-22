# Obalka RMS (dBFS) po 10 ms +-150 ms kolem strihu v exportu; pouziti: python obalka.py <export> <t> [<t> ...]
import sys, subprocess, math
import numpy as np
f = sys.argv[1]
for t in map(float, sys.argv[2:]):
    a = max(0, t - 0.15)
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % a, '-i', f, '-t', '0.3', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    n = 480
    env = [20 * math.log10(max(1e-9, float(np.sqrt(np.mean(x[i:i + n] ** 2))))) for i in range(0, len(x) - n + 1, n)]
    k = int(round((t - a) / 0.01))
    print('%s t=%.2f  ' % (f.split('/')[-1], t) + ' '.join(('|' if i == k else '') + '%d' % round(e) for i, e in enumerate(env)))

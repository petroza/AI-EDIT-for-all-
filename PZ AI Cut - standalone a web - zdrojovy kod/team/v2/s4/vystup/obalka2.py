# Obalka RMS (dBFS) po 50 ms v okne [t-0.6, t+0.8] kolem casu t; '|' = t. python obalka2.py <export> <t> [<t>...]
import sys, subprocess, math, numpy as np
f = sys.argv[1]
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
for t in map(float, sys.argv[2:]):
    v = []
    for k in range(-12, 16):
        a = int((t + k * 0.05) * 16000); s = x[max(0, a):a + 800]
        v.append(('|' if k == 0 else '') + ('%d' % round(20 * math.log10(max(1e-9, float(np.sqrt(np.mean(s ** 2)))))) if len(s) else 'x'))
    print('%s t=%.2f  %s' % (f.split('/')[-1], t, ' '.join(v)))

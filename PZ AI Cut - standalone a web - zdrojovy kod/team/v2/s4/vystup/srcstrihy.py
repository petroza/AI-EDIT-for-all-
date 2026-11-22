# Strihy kamery v celem 28min zdroji (skok jasu 96x96, jako zabery.py) -> srcstrihy.json (casy zacatku noveho zaberu)
import sys, subprocess, numpy as np, json
f = sys.argv[1]
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', f, '-an', '-vf', 'scale=96:96,format=gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
prev = None; i = 0; ds = []
while True:
    b = p.stdout.read(96 * 96)
    if len(b) < 96 * 96: break
    g = np.frombuffer(b, np.uint8).reshape(96, 96)[8:56].astype(np.int16)
    if prev is not None: ds.append(float(np.abs(g - prev).mean()))
    prev = g; i += 1
d = np.array(ds); med = float(np.median(d))
cuts = [round((k + 1) / 25, 2) for k in np.where(d > max(10, 6 * med))[0]]
json.dump({'frames': i, 'median': med, 'cuts': cuts}, open(sys.argv[2], 'w'))
print(i, med, len(cuts))

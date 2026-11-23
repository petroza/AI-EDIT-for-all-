# Vodorovny posun obrazu mezi po sobe jdoucimi snimky (pas 5-45 % vysky, bez titulku), px v plnem rozliseni
import sys, subprocess, numpy as np
f, a = sys.argv[1], int(sys.argv[2])
pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip().split(',')
W, H = int(pr[0]), int(pr[1])
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-an', '-vf', 'format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W)[:, int(H * .05):int(H * .45)].astype(np.float32)
out = []
for i in range(a, len(F)):
    p, q = F[i - 1], F[i]; best = None
    for s in range(-40, 41):
        x = p[:, 60 + s:W - 60 + s]; y = q[:, 60:W - 60]
        e = np.abs(x - y).mean()
        if best is None or e < best[0]: best = (e, s)
    out.append('%d->%d:%+dpx(%.1f)' % (i - 1, i, best[1], best[0]))
print(f.split('/')[-1], ' '.join(out))

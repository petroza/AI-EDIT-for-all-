# Rozdil po sobe jdoucich snimku (cely obraz a oblast obliceje) na konci exportu: skok zpet pri zopakovani snimku
# python skok.py export od_snimku [x0 y0 x1 y1 v podilech sirky/vysky]
import sys, subprocess, numpy as np
f, a = sys.argv[1], int(sys.argv[2]); box = [float(v) for v in sys.argv[3:7]] if len(sys.argv) > 6 else [0, 0, 1, 1]
W, H = 320, None
pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip().split(',')
H = round(W * int(pr[1]) / int(pr[0]))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-an', '-vf', 'scale=%d:%d,format=gray' % (W, H), '-f', 'rawvideo', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.int16)
x0, y0, x1, y1 = int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)
G = F[:, y0:y1, x0:x1]
print(f.split('/')[-1], 'snimku', len(F))
print(' '.join('%d->%d:%.1f' % (i - 1, i, np.abs(G[i] - G[i - 1]).mean()) for i in range(max(1, a), len(F))))

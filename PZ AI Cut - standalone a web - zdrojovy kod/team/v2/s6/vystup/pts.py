# S5: casy snimku (pts) a jas pasu 10-55 % po snimcich v rozsahu; porovnani dekodovani passthrough vs. vychozi (cfr)
# python pts.py <export> od do
import sys, subprocess, numpy as np
f, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
pts = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time,pict_type', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.split()
print('snimku %d' % len(pts)); print('pts %d-%d: %s' % (a, b, ' '.join(pts[a:b + 1])))
for mode in (['-fps_mode', 'passthrough'], []):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', f] + mode + ['-an', '-vf', 'scale=54:96,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    x = np.frombuffer(r, np.uint8).reshape(-1, 96, 54)
    print(mode or 'cfr', len(x), [round(float(x[k][10:53].mean()), 1) for k in range(a, b + 1)])

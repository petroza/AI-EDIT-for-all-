# S11: snimky, kde se dva exporty lisi (sede 160x284/160x90..., prumer abs. chyby > prah), po pasech vysky (10 pasu), souvisle useky
import sys, subprocess, numpy as np
def dec(p):
    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip().split(',')
    w, h = int(pr[0]), int(pr[1]); W = 160; H = int(round(h * W / w / 2) * 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-an', '-vf', 'scale=%d:%d:flags=area,format=gray' % (W, H), '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.int16)
a, b = dec(sys.argv[1]), dec(sys.argv[2]); thr = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
n = min(len(a), len(b)); H = a.shape[1]
e = np.abs(a[:n] - b[:n]); bands = np.array([e[:, int(H * i / 10):int(H * (i + 1) / 10)].mean((1, 2)) for i in range(10)]).T
bad = np.where(bands.max(1) > thr)[0]
runs = []
for i in bad:
    if runs and i == runs[-1][1] + 1: runs[-1][1] = i
    else: runs.append([i, i])
print('%s: %d snimku, odlisnych (>%.1f v nekterem pasu) %d' % (sys.argv[2].split('/')[-1], n, thr, len(bad)))
for s, t in runs:
    m = bands[s:t + 1].max(0)
    print('  sn. %d-%d (%.2f-%.2f s) pasy s chybou: %s' % (s, t, s / 25, (t + 1) / 25, ' '.join('%d0%%:%.0f' % (i, v) for i, v in enumerate(m) if v > thr)))

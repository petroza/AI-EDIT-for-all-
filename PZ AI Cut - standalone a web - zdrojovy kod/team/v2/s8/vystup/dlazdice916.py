# S8: dlazdice snimku exportu v zadanych casech (vystupni -ss = presny snimek), popisek casu. python dlazdice916.py <export> <png> t1 t2 ...
import sys, subprocess, numpy as np, cv2
f, out, ts = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3:]]
pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip().split(',')
w, h = 270, round(270 * int(pr[1]) / int(pr[0]))
tiles = []
for t in ts:
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ss', '%.3f' % t, '-frames:v', '1', '-vf', 'scale=%d:%d' % (w, h), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    im = np.frombuffer(b, np.uint8).reshape(h, w, 3).copy()
    cv2.rectangle(im, (0, 0), (110, 30), (0, 0, 0), -1); cv2.putText(im, '%.2f s' % t, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    tiles.append(im)
cv2.imwrite(out, np.hstack(tiles))

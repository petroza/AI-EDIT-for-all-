# Poloha vypaleneho nadpisu a titulku ve snimcich exportu (pixely) + prekryv s obliceji (YuNet) + bezpecne zony.
# Pouziti: python zony.py <export> <w> <h> <casy...>
import sys, subprocess
import numpy as np, cv2
f, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
YN = cv2.FaceDetectorYN.create('O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod/models/opencv_face/face_detection_yunet_2023mar.onnx', '', (W, H), 0.6, 0.3, 50)
def rows_of_text(img, y0, y1):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    white = (g >= 240).astype(np.uint8)
    dark = cv2.dilate((g <= 40).astype(np.uint8), np.ones((5, 5), np.uint8))
    t = white & dark
    r = t[y0:y1].sum(1)
    ys = np.where(r > W * 0.01)[0]
    if not len(ys): return None
    cols = np.where(t[y0 + ys.min():y0 + ys.max() + 1].sum(0) > 0)[0]
    return (int(cols.min()), int(y0 + ys.min()), int(cols.max()), int(y0 + ys.max()))
for t in map(float, sys.argv[4:]):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    img = np.frombuffer(b, np.uint8).reshape(H, W, 3)
    title = rows_of_text(img, 0, int(H * 0.4)); cap = rows_of_text(img, int(H * 0.4), H)
    _, det = YN.detect(img)
    fc = [] if det is None else [tuple(int(v) for v in d[:4]) for d in det]
    ov = [fx for fx in fc if cap and not (fx[1] + fx[3] < cap[1] or fx[1] > cap[3] or fx[0] + fx[2] < cap[0] or fx[0] > cap[2])]
    print('t=%.2f titul(x0,y0,x1,y1)=%s  titulky=%s  -> titulky %s-%s %% vysky, nadpis od %s %%; obliceje(x,y,w,h)=%s; prekryv titulku s oblicejem=%s' % (
        t, title, cap, cap and round(cap[1] / H * 100, 1), cap and round(cap[3] / H * 100, 1), title and round(title[1] / H * 100, 1), fc, bool(ov)))

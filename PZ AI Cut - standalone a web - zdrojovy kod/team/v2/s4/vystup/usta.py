# Vyrez obliceje na snimcich od..do exportu (dekodovani celeho souboru, bez select): python usta.py export od n crop(w:h:x:y) meritko vystup.png [od_rep]
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
f, a, n, crop, sc, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], float(sys.argv[5]), sys.argv[6]
rep = int(sys.argv[7]) if len(sys.argv) > 7 else 10**9
w, h, x, y = [int(v) for v in crop.split(':')]
W, H = int(w * sc), int(h * sc) // 2 * 2
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-an', '-vf', 'crop=%s,scale=%d:%d' % (crop, W, H), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)[a:a + n]
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 18)
img = Image.new('RGB', (W * len(fr), H)); d = ImageDraw.Draw(img)
for i, z in enumerate(fr):
    img.paste(Image.fromarray(z), (i * W, 0)); d.rectangle([i * W, 0, i * W + 105, 22], fill=(0, 0, 0))
    d.text((i * W + 3, 1), 'sn %d%s' % (a + i, ' REP' if a + i >= rep else ''), fill=(255, 220, 0), font=font)
    d.line([(i * W, 0), (i * W, H)], fill=(255, 0, 0), width=2)
img.save(out); print(out, len(fr))

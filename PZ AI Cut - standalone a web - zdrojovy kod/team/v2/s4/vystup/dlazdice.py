# Dlazdice snimku s cislem snimku/casem: python dlazdice.py vstup od_snimku pocet sloupcu sirka_dlazdice vystup.png [ss_zdroj]
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
f, a, n, cols, tw, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
ss = float(sys.argv[7]) if len(sys.argv) > 7 else None
pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip().split(',')
W, H = int(pr[0]), int(pr[1]); th = round(tw * H / W / 2) * 2
cmd = ['ffmpeg', '-v', 'error']
if ss is not None: cmd += ['-ss', '%.3f' % ss]
cmd += ['-i', f, '-an', '-vf', 'scale=%d:%d' % (tw, th)] + (['-frames:v', str(n)] if ss is not None else []) + ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
raw = subprocess.run(cmd, capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, th, tw, 3)
if ss is None: fr = fr[a:a + n]  # bez filtru select (S4: select v seznamu argumentu vracel snimky od 0)
rows = (len(fr) + cols - 1) // cols
img = Image.new('RGB', (cols * tw, rows * th)); d = ImageDraw.Draw(img)
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', max(14, tw // 12))
for i, x in enumerate(fr):
    X, Y = (i % cols) * tw, (i // cols) * th
    img.paste(Image.fromarray(x), (X, Y))
    lab = ('%.2f' % (ss + i / 25)) if ss is not None else 'sn %d (%.2f s)' % (a + i, (a + i) / 25)
    d.rectangle([X, Y, X + tw * 0.62, Y + tw // 9], fill=(0, 0, 0)); d.text((X + 3, Y + 1), lab, fill=(255, 220, 0), font=font)
img.save(out); print(out, len(fr), 'snimku')

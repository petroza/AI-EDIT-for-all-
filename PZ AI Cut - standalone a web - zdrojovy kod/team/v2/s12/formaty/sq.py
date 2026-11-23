# Poměr stran referenčního čtverce (zdroj: čtverec 0,2 H v zobrazovacích pixelech) – zohlední SAR výstupu
import sys, os, json, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ana
for f in sys.argv[1:]:
    p = ana.probe(f); v = next(s for s in p['streams'] if s['codec_type'] == 'video')
    W, H = v['width'], v['height']
    rot = next((int(sd['rotation']) for sd in v.get('side_data_list', []) or [] if 'rotation' in sd), 0)
    if abs(rot) == 90: W, H = H, W
    o, _, _ = ana.run(['ffmpeg', '-v', 'error', '-ss', '0.5', '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], True)
    a = np.frombuffer(o, np.uint8).reshape(H, W)
    low = a[int(H * 0.62):, :] > 200
    ys, xs = np.where(low)
    sar = v.get('sample_aspect_ratio', '1:1'); sn, sd = (map(int, sar.split(':')) if sar and sar != '0:1' else (1, 1))
    w = xs.max() - xs.min() + 1; h = ys.max() - ys.min() + 1
    print(os.path.basename(f), f'{W}x{H} SAR {sar} DAR {v.get("display_aspect_ratio")}', f'čtverec {w}x{h} px', 'poměr na displeji %.3f' % (w * sn / sd / h))

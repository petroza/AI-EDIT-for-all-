"""Analýza exportu: počet snímků, záblesky (bílý snímek) a pípnutí (1 kHz) – rozestupy a A/V posun.
python sync.py soubor.mp4 [fps]"""
import json, subprocess, sys, struct, math

f = sys.argv[1]
fps = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,nb_read_frames,duration,r_frame_rate,width,height,sample_rate,channels:format=duration', '-of', 'json', f], capture_output=True, text=True).stdout)
# jas po snímcích
p = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', 'scale=32:18,format=gray', '-f', 'rawvideo', '-'], capture_output=True)
fr = 32 * 18
import numpy as np
_v = np.frombuffer(p.stdout[:len(p.stdout)//fr*fr], dtype=np.uint8).reshape(-1, fr)
lum = _v.mean(axis=1).tolist()
flash = [i for i in range(len(lum)) if lum[i] > 200 and (i == 0 or lum[i - 1] <= 200)]
# zvuk: obálka 1 kHz (jednoduše RMS po 1 ms; pípnutí 0.5 amplituda)
a = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', '48000', '-af', 'highpass=f=700,lowpass=f=1400', '-f', 's16le', '-'], capture_output=True).stdout
import numpy as np
smp = np.frombuffer(a[:len(a)//2*2], dtype='<i2').astype(np.float64)
W = 48
m = len(smp)//W
env = np.sqrt((smp[:m*W].reshape(m, W)**2).mean(axis=1)).tolist()
thr = 3000
beep = [i / 1000 for i in range(1, len(env)) if env[i] > thr and env[i - 1] <= thr]
# spárovat záblesk a pípnutí
offs = []
for fl in flash:
    t = fl / fps
    b = min(beep, key=lambda x: abs(x - t)) if beep else None
    if b is not None and abs(b - t) < 0.5:
        offs.append(round((b - t) * 1000))
sp = [flash[i + 1] - flash[i] for i in range(len(flash) - 1)]
from collections import Counter
res = {
    'probe': pr,
    'frames_decoded': len(lum),
    'flashes': len(flash), 'beeps': len(beep),
    'flash_spacing_frames': dict(Counter(sp)),
    'odd_spacing_at_frame': [(flash[i], sp[i]) for i in range(len(sp)) if sp[i] != round(fps)][:20],
    'av_offset_ms_beep_minus_flash': dict(Counter(offs)),
    'unpaired_flashes': len(flash) - len(offs),
    'first_flash_frame': flash[:3], 'first_beeps': beep[:3],
}
print(json.dumps(res, ensure_ascii=False))

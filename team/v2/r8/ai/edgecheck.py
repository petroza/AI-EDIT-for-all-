import os
for _d in ("cublas","cudnn","cuda_nvrtc"):
    _p = "O:/ADOBEPREMIERESTRIH/.venv/Lib/site-packages/nvidia/" + _d + "/bin"
    if os.path.isdir(_p): os.add_dll_directory(_p); os.environ["PATH"] = _p + os.pathsep + os.environ["PATH"]
import sys, json, subprocess, numpy as np
from faster_whisper import WhisperModel
SRC = 'O:/TN_strihatko/test/media/vyrez-5min.mp4'
clips = json.load(open(sys.argv[1], encoding='utf-8'))
model = WhisperModel('O:/ADOBEPREMIERESTRIH/models/whisper-large-v3', device='cuda', compute_type='int8_float16')
def audio(a, b):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-ss', f'{a:.3f}', '-t', f'{b-a:.3f}', '-i', SRC, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def db(x): return float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9))
out = []
for c in clips:
    x = audio(c['in'], c['out'])
    segs, _ = model.transcribe(x, language='cs', word_timestamps=True, beam_size=5, vad_filter=False)
    words = [w for s in segs for w in s.words]
    n = len(x); w40 = 640
    med = np.median([db(x[i:i + 480]) for i in range(0, n - 480, 480)]) if n > 960 else -99
    r = {'label': c['label'], 'in': c['in'], 'out': c['out'],
         'first': [words[0].word.strip(), round(float(words[0].start), 2)] if words else None,
         'last': [words[-1].word.strip(), round(float(words[-1].end), 2), round(c['out'] - c['in'], 2)] if words else None,
         'rmsIn_dB': round(db(x[:w40]), 1), 'rmsOut_dB': round(db(x[-w40:]), 1), 'median_dB': round(float(med), 1),
         'text': ''.join(w.word for w in words).strip()}
    out.append(r)
    print(json.dumps(r, ensure_ascii=False))
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

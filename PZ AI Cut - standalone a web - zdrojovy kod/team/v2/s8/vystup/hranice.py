# AI tok S2: faster-whisper large-v3 (int8_float16) - cely soubor po <=25 s + okna +-1.2 s kolem zadanych casu + RMS 20 ms.
# python hranice.py soubor.mp4 "t1,t2,..." [cely=1]
import subprocess, sys, os, glob
import numpy as np
R = 'O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod'
for _d in glob.glob(R + '/.venv/Lib/site-packages/nvidia/*/bin'):
    os.add_dll_directory(_d); os.environ['PATH'] = _d + os.pathsep + os.environ['PATH']
from faster_whisper import WhisperModel
model = WhisperModel(R + '/models/whisper-large-v3', device='cuda', compute_type='int8_float16')
def pcm(path, ss, t, pad=True):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % max(0, ss), '-i', path, '-t', '%.3f' % t, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(b, np.float32)
    return np.concatenate([np.zeros(8000, np.float32), x, np.zeros(8000, np.float32)]) if pad else x
def tr(x, off):
    segs, _ = model.transcribe(x, language='cs', word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
    return [(w.word.strip(), round(w.start - 0.5 + off, 2), round(w.end - 0.5 + off, 2), round(w.probability, 2)) for s in segs for w in (s.words or [])]
def rms(path, ss, t):
    x = pcm(path, ss, t, pad=False)
    n = 320
    return [round(20 * np.log10(np.sqrt(np.mean(x[i:i + n] ** 2)) + 1e-9), 1) for i in range(0, len(x) - n + 1, n)]
f = sys.argv[1]
times = [float(t) for t in sys.argv[2].split(',') if t] if len(sys.argv) > 2 else []
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
if len(sys.argv) > 3:
    a = 0.0; full = []
    while a < dur - 0.05:
        b = min(dur, a + 25); full += tr(pcm(f, a, b - a), a); a = b
    print('CELY:', ' '.join('%s[%.2f]' % (w[0], w[1]) for w in full))
for t in times:
    a, b = max(0, t - 1.2), min(dur, t + 1.2)
    ws = tr(pcm(f, a, b - a), a)
    r = rms(f, max(0, t - 0.2), 0.4)
    print('t=%.2f: %s' % (t, ' '.join('%s[%.2f-%.2f p%.2f]' % w for w in ws)))
    print('   RMS 20ms od %.2f: %s' % (max(0, t - 0.2), r))

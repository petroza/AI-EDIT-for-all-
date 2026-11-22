# Whisper (large-v3) na kratkych usecich: python whisper_spot.py <soubor> <od> <do> [<soubor> <od> <do> ...]
import sys, os, glob, subprocess, numpy as np
R = 'O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod'
for _d in glob.glob(R + '/.venv/Lib/site-packages/nvidia/*/bin'):
    os.add_dll_directory(_d); os.environ['PATH'] = _d + os.pathsep + os.environ['PATH']
from faster_whisper import WhisperModel
m = WhisperModel(R + '/models/whisper-large-v3', device='cuda', compute_type='int8_float16')
a = sys.argv[1:]
for i in range(0, len(a), 3):
    f, s, e = a[i], float(a[i + 1]), float(a[i + 2])
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(s), '-i', f, '-t', str(e - s), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    x = np.concatenate([np.zeros(8000, np.float32), x, np.zeros(8000, np.float32)])  # 0,5 s ticha kolem
    segs, _ = m.transcribe(x, language='cs', word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
    ws = [(w.word.strip(), round(w.start - 0.5 + s, 2), round(w.end - 0.5 + s, 2), round(w.probability, 2)) for sg in segs for w in (sg.words or [])]
    print(os.path.basename(f), s, e, ws, flush=True)

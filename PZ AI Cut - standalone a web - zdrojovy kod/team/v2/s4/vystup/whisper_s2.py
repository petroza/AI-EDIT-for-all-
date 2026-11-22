# Kontrolor vystupu S2: faster-whisper large-v3 (int8_float16) na exportech - cely export po <=25 s usecich se slovy a casy
# + vyrezy +-1 s kolem kazdeho strihu zvuku (vcetne zacatku a konce). Pouziti: python whisper_s2.py klic=export:sekvence ...
import json, subprocess, sys, os, glob
import numpy as np
R = 'O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod'
for _d in glob.glob(R + '/.venv/Lib/site-packages/nvidia/*/bin'):
    os.add_dll_directory(_d); os.environ['PATH'] = _d + os.pathsep + os.environ['PATH']
from faster_whisper import WhisperModel
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '..', '..', 'web', 'test-out')
SEQ = json.load(open(os.path.join(HERE, 'sekvence.json'), encoding='utf-8'))
model = WhisperModel(R + '/models/whisper-large-v3', device='cuda', compute_type='int8_float16')
def pcm(path, ss, t):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % max(0, ss), '-i', path, '-t', '%.3f' % t, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(b, np.float32)
    return np.concatenate([np.zeros(8000, np.float32), x, np.zeros(8000, np.float32)])
def tr(x, off):
    segs, _ = model.transcribe(x, language='cs', word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
    return [{'w': w.word.strip(), 's': round(w.start - 0.5 + off, 2), 'e': round(w.end - 0.5 + off, 2), 'p': round(w.probability, 2)} for s in segs for w in (s.words or [])]
res = json.load(open(os.path.join(HERE, 'whisper.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, 'whisper.json')) else {}
for job in sys.argv[1:]:
    key, rest = job.split('=', 1); f, name = rest.split(':', 1)
    f = os.path.join(OUT, f); s = SEQ[name]
    dur = max(c['start'] + c['out'] - c['in'] for c in s['audio'][0])
    full = []
    # usek konci na strihu nebo po 25 s
    bounds = sorted(set([0.0] + [c['start'] for c in s['audio'][0]] + [dur]))
    chunks, a = [], 0.0
    for b in bounds[1:]:
        if b - a > 25 or b == dur: chunks.append((a, b)); a = b
    for a, b in chunks: full += tr(pcm(f, a, b - a), a)
    cuts = []
    for t in bounds:
        a, b = max(0, t - 1), min(dur, t + 1)
        cuts.append({'t': round(t, 2), 'words': tr(pcm(f, a, b - a), a)})
    res[key] = {'file': os.path.basename(f), 'seq': name, 'full': full, 'cuts': cuts}
    print(key, ' '.join(w['w'] for w in full), flush=True)
    for c in cuts: print('   cut %.2f: %s' % (c['t'], ' '.join('%s[%.2f-%.2f %.2f]' % (w['w'], w['s'], w['e'], w['p']) for w in c['words'] if abs((w['s'] + w['e']) / 2 - c['t']) < 0.7)), flush=True)
json.dump(res, open(os.path.join(HERE, 'whisper.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

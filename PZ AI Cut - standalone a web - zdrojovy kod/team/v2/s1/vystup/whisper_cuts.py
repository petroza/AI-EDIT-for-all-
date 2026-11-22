# Kontrolor vystupu s1 (z r7/r8): lokalni faster-whisper (large-v3) na exportech - cely export (<= 35 s) se slovy a casy
# + vyrezy +-1 s kolem kazdeho strihu zvuku (a zacatek/konec). Kratke useky, GPU je sdileny.
# Pouziti: python whisper_cuts.py  (cte sekvence.json, exporty z web/test-out)
import json, subprocess, sys, os
import numpy as np
import glob
for _d in glob.glob('O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod/.venv/Lib/site-packages/nvidia/*/bin'):
    os.add_dll_directory(_d); os.environ['PATH'] = _d + os.pathsep + os.environ['PATH']
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '..', '..', 'web', 'test-out')
FILES = {'a':'vystup-s1-a.mp4','b':'vystup-s1-b.mp4','b265':'vystup-s1-b-h265.mp4','c':'vystup-s1-c.mov','d':'vystup-s1-d.mp4','dmxf':'vystup-s1-d.mxf','e':'vystup-s1-e.mp4','emxf':'vystup-s1-e.mxf','axd':'vystup-s1-a-xdcam.mxf'}
SEQ = json.load(open(os.path.join(HERE, 'sekvence.json'), encoding='utf-8'))
JOBS = json.loads(os.environ['JOBS']) if os.environ.get('JOBS') else [('a', 's1-a'), ('b', 's1-b'), ('c', 's1-c'), ('d', 's1-d'), ('e', 's1-e')]
SRC = os.environ.get('SRC') or os.path.join(HERE, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4')
dev = sys.argv[1] if len(sys.argv) > 1 else 'cuda'
model = WhisperModel(r'O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod/models/whisper-large-v3', device=dev, compute_type='int8_float16' if dev == 'cuda' else 'int8')


def pcm(path, ss, t):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % max(0, ss), '-i', path, '-t', '%.3f' % t, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(b, np.float32)


def tr(x, prompt=None):
    segs, _ = model.transcribe(x, language='cs', word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False, initial_prompt=prompt)
    return [{'w': w.word.strip(), 's': round(w.start, 2), 'e': round(w.end, 2), 'p': round(w.probability, 2)} for s in segs for w in (s.words or [])]


res = {}
for key, name in JOBS:
    f = os.path.join(OUT, FILES[key])
    s = SEQ[name]
    dur = max(c['start'] + c['out'] - c['in'] for c in s['audio'][0])
    r = {'full': tr(pcm(f, 0, dur + 0.1)), 'cuts': []}
    pts = [0.0] + [c['start'] for c in s['audio'][0] if c['start'] > 0] + [dur]
    for i, t in enumerate(pts):
        a = max(0, t - 1)
        b = min(dur, t + 1)
        cut = {'t': round(t, 2), 'excerpt': [a, b], 'words': [dict(w, s=round(w['s'] + a, 2), e=round(w['e'] + a, 2)) for w in tr(pcm(f, a, b - a))]}
        # zdroj kolem Out predchoziho / In tohoto klipu (co bylo ve zdroji tesne za / pred strihem)
        cl = s['audio'][0]
        if 0 < i < len(pts) - 1:
            prev, cur = cl[i - 1], cl[i]
            cut['src_around_prev_out'] = [dict(w, s=round(w['s'] + prev['out'] - 1, 2), e=round(w['e'] + prev['out'] - 1, 2)) for w in tr(pcm(SRC, prev['out'] - 1, 2))]
            cut['src_around_in'] = [dict(w, s=round(w['s'] + cur['in'] - 1, 2), e=round(w['e'] + cur['in'] - 1, 2)) for w in tr(pcm(SRC, cur['in'] - 1, 2))]
            cut['prev_out'] = prev['out']; cut['in'] = cur['in']
        elif i == 0:
            cur = cl[0]
            cut['src_around_in'] = [dict(w, s=round(w['s'] + cur['in'] - 1, 2), e=round(w['e'] + cur['in'] - 1, 2)) for w in tr(pcm(SRC, cur['in'] - 1, 2))]
            cut['in'] = cur['in']
        else:
            prev = cl[-1]
            cut['src_around_prev_out'] = [dict(w, s=round(w['s'] + prev['out'] - 1, 2), e=round(w['e'] + prev['out'] - 1, 2)) for w in tr(pcm(SRC, prev['out'] - 1, 2))]
            cut['prev_out'] = prev['out']
        r['cuts'].append(cut)
    res[key] = r
    print(key, ' '.join(w['w'] for w in r['full']), flush=True)
json.dump(res, open(os.path.join(HERE, os.environ.get('WOUT', 'whisper.json')), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# S5: titulky = jen rec A1? Whisper large-v3 (int8_float16) na solo exportech A1 a A2 (PCM), porovnani se slovy titulku;
# maska titulku (export s titulky - bez titulku, spodni pas) po snimcich -> kde je titulek opravdu videt.
# python titulky.py <sekvence> <solo_a1> <solo_a2> <export_s_titulky> <export_bez>
import sys, os, re, json, glob, subprocess, numpy as np
R = 'O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod'
for _d in glob.glob(R + '/.venv/Lib/site-packages/nvidia/*/bin'):
    os.add_dll_directory(_d); os.environ['PATH'] = _d + os.pathsep + os.environ['PATH']
here = os.path.dirname(os.path.abspath(__file__))
name, a1, a2, ew, eb = sys.argv[1:6]
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))[name]
norm = lambda w: re.sub(r'[^\wáčďéěíňóřšťúůýž]', '', w.lower())
wcache = os.path.join(here, 'whisper-%s.json' % name.replace('s8-', ''))
if os.path.exists(wcache): Wd = json.load(open(wcache, encoding='utf-8'))
else:
    from faster_whisper import WhisperModel
    model = WhisperModel(R + '/models/whisper-large-v3', device='cuda', compute_type='int8_float16')
    Wd = {}
    for k, f in (('A1', a1), ('A2', a2)):
        x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
        segs, _ = model.transcribe(x, language='cs', word_timestamps=True, beam_size=5, vad_filter=True, condition_on_previous_text=False)
        Wd[k] = [(w.word.strip(), round(w.start, 2), round(w.end, 2), round(w.probability, 2)) for s in segs for w in (s.words or [])]
    json.dump(Wd, open(wcache, 'w', encoding='utf-8'), ensure_ascii=False)
A1 = [(norm(w), s, e) for w, s, e, p in Wd['A1'] if norm(w)]
A2 = [(norm(w), s, e) for w, s, e, p in Wd['A2'] if norm(w)]
print('Whisper A1: %d slov, A2 (b-roll, -12 dB): %d slov' % (len(A1), len(A2)))
print('A2 slova:', ' '.join('%s[%.1f]' % (w, s) for w, s, e in A2))
caps = S['captions']
print('titulku: %d' % len(caps))
nA1 = nA2 = nX = 0; only2 = []; miss = []
for c in caps:
    for w in [norm(x) for x in c['text'].split()]:
        if not w: continue
        in1 = any(w == x and c['start'] - 1.0 <= s <= c['end'] + 1.0 for x, s, e in A1)
        in2 = any(w == x and c['start'] - 1.0 <= s <= c['end'] + 1.0 for x, s, e in A2)
        if in1: nA1 += 1
        elif in2: nA2 += 1; only2.append((w, c['start']))
        else: nX += 1; miss.append((w, c['start']))
    if c['end'] - c['start'] < 0.04: print('  ! titulek s nulovou delkou %.2f-%.2f "%s"' % (c['start'], c['end'], c['text'].replace('\n', ' / ')))
print('slova titulku: v reci A1 %d, jen v A2 %d %s, nenalezena %d %s' % (nA1, nA2, only2, nX, miss[:20]))
# slova A1, ktera nejsou pokryta zadnym titulkem (cas)
unc = [(w, s) for w, s, e in A1 if not any(c['start'] - 0.3 <= s < c['end'] + 0.3 and c['end'] - c['start'] > 0.04 for c in caps)]
print('slova A1 bez titulku v case: %d %s' % (len(unc), unc[:30]))
# maska
def dec(p):
    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip().split(',')
    w, h = int(pr[0]), int(pr[1]); W = 160; Hh = round(W * h / w)
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-an', '-vf', 'scale=%d:%d:flags=area,format=gray' % (W, Hh), '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(-1, Hh, W).astype(np.int16)
Ew, Eb = dec(ew), dec(eb); n = min(len(Ew), len(Eb))
m = (np.abs(Ew[:n] - Eb[:n]) > 40).reshape(n, -1).mean(1) > 0.003
on = []
for k in range(n):
    if m[k] and (not on or on[-1][1] != k - 1): on.append([k, k])
    elif m[k]: on[-1][1] = k
print('titulek viditelny (maska) v usecich: %s' % ' '.join('%.2f-%.2f' % (a / 25, (b + 1) / 25) for a, b in on))
for c in caps:
    a, b = int(round(c['start'] * 25)), int(round(c['end'] * 25))
    vis = m[a:b].sum() if b > a else 0
    if b - a > 0 and vis < 0.8 * (b - a): print('  ! titulek %.2f-%.2f viditelny jen %d/%d snimku' % (c['start'], c['end'], vis, b - a))

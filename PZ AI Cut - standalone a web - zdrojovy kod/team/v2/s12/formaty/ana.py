# Kolo S12 – analýza souborů: ffprobe, čárový kód čísla snímku (pořadí, ztráty/zdvojení), pípnutí (sync), kanály, ebur128.
# python ana.py <soubor> [--fields] [--src <zdroj> --srcfields --pieces "start:in:out,..."] [--json out.json]
import json, subprocess, sys, re
import numpy as np

def run(a, binary=False):
    r = subprocess.run(a, capture_output=True)
    return r.stdout if binary else r.stdout.decode('utf8', 'replace'), r.stderr.decode('utf8', 'replace'), r.returncode

def probe(f):
    o, e, c = run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f])
    return json.loads(o) if c == 0 else {'error': e.strip()[-300:]}

def frame_times(f):
    o, _, _ = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'csv=p=0', f])
    return [float(x.split(',')[0]) for x in o.split() if x.strip() and x.split(',')[0] not in ('N/A', '')]

def bbox(f, W, H):
    """Oblast obrazu bez černých okrajů (pozadí zdroje je šedé 0x40)."""
    o, _, _ = run(['ffmpeg', '-v', 'error', '-ss', '0.5', '-i', f, '-map', '0:v:0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], True)
    a = np.frombuffer(o, np.uint8)
    if a.size != W * H: return (0, 0, W, H)
    a = a.reshape(H, W)
    rows = np.where((a > 40).mean(1) > 0.3)[0]; cols = np.where((a > 40).mean(0) > 0.3)[0]
    if not len(rows) or not len(cols): return (0, 0, W, H)
    return (int(cols[0]), int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1))

def codes(f, fields=False):
    """Čísla snímků z čárového kódu: [(čas, kód|None, nejistota)] – u fields dvě položky na snímek (horní, dolní pole)."""
    p = probe(f)
    v = next((s for s in p.get('streams', []) if s['codec_type'] == 'video'), None)
    if not v: return [], None
    # rozměr po autorotaci
    W, H = v['width'], v['height']
    rot = 0
    for sd in v.get('side_data_list', []) or []:
        if 'rotation' in sd: rot = int(sd['rotation'])
    if abs(rot) == 90: W, H = H, W
    bx, by, bw, bh = bbox(f, W, H)
    y0 = by + int(bh * 0.465); y1 = by + int(bh * 0.535)
    y0 -= y0 % 2; h = (y1 - y0) - ((y1 - y0) % 2)
    x0 = bx + int(bw * 0.1); w = int(bw * 0.8)
    vf = f'crop={w}:{h}:{x0}:{y0},scale=320:{h}:flags=neighbor'
    o, e, _ = run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:v:0', '-fps_mode', 'passthrough', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], True)
    a = np.frombuffer(o, np.uint8)
    n = a.size // (320 * h)
    a = a[:n * 320 * h].reshape(n, h, 320)
    ts = frame_times(f)
    fps = eval(v.get('r_frame_rate', '25/1').replace('/', '/')) if v.get('r_frame_rate') else 25
    if len(ts) != n: ts = [i / fps for i in range(n)]
    out = []
    def dec(img):
        cells = [img[:, int((i + 0.3) * 20):int((i + 0.7) * 20)].mean() for i in range(16)]
        bits = [1 if c > 150 else 0 for c in cells]
        unsure = sum(1 for c in cells if 100 < c < 200)
        return sum(b << i for i, b in enumerate(bits)), unsure
    for i in range(n):
        if fields:
            for par, dt in ((0, 0), (1, 0.5 / fps)):
                c, u = dec(a[i, par::2, :]); out.append((ts[i] + dt, c, u))
        else:
            c, u = dec(a[i]); out.append((ts[i], c, u))
    return out, {'bbox': [bx, by, bw, bh], 'W': W, 'H': H, 'fps': fps, 'frames': n}

def audio(f, k=0, sr=48000):
    p = probe(f)
    a = [s for s in p.get('streams', []) if s['codec_type'] == 'audio']
    if k >= len(a): return None, 0
    ch = a[k]['channels']
    o, _, _ = run(['ffmpeg', '-v', 'error', '-i', f, '-map', f'0:a:{k}', '-ar', str(sr), '-f', 'f32le', '-acodec', 'pcm_f32le', '-'], True)
    x = np.frombuffer(o, np.float32)
    return x[:len(x) // ch * ch].reshape(-1, ch), ch

def bandpass(x, sr, lo, hi):
    out = np.zeros_like(x)
    C = sr * 20; M = sr
    for s in range(0, len(x), C):
        a = max(0, s - M); b = min(len(x), s + C + M)
        X = np.fft.rfft(x[a:b]); fr = np.fft.rfftfreq(b - a, 1 / sr)
        X[(fr < lo) | (fr > hi)] = 0
        y = np.fft.irfft(X, b - a)
        out[s:min(len(x), s + C)] = y[s - a:s - a + min(C, len(x) - s)]
    return out

def beeps(x, sr=48000):
    y = np.abs(bandpass(x.astype(np.float64), sr, 900, 1100))
    if len(y) < sr // 2: return []
    m = np.percentile(y, 99.9)
    if m < 1e-4: return []
    thr = 0.3 * m
    above = y > thr
    res = []; last = -1e9
    idx = np.where(above)[0]
    for i in idx:
        if i - last > 0.3 * sr: res.append(i / sr)
        last = i
    return res

def tones(x, sr=48000, freqs=(60, 220, 300, 500, 700, 1000, 1300, 1700)):
    seg = x[int(sr * 1.2):int(sr * 1.9)] if len(x) > sr * 2 else x
    if len(seg) < 1000: return {}
    X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) / (len(seg) / 4)
    fr = np.fft.rfftfreq(len(seg), 1 / sr)
    r = {}
    for f0 in freqs:
        j = (fr > f0 - 8) & (fr < f0 + 8)
        amp = X[j].max() if j.any() else 0
        r[f0] = round(20 * np.log10(max(amp, 1e-6)), 1)
    return {k: v for k, v in r.items() if v > -60}

def ebur(f):
    _, e, _ = run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', e); TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)
    return (float(I[-1]) if I else None, float(TP[-1]) if TP else None)

def ebur_mix(f, nstreams):
    if nstreams <= 1: return ebur(f)
    fc = ''.join(f'[0:a:{i}]' for i in range(nstreams)) + f'amerge=inputs={nstreams}[m]'
    _, e, _ = run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-filter_complex', fc + ';[m]ebur128=peak=true[o]', '-map', '[o]', '-f', 'null', '-'])
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', e); TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)
    return (float(I[-1]) if I else None, float(TP[-1]) if TP else None)

def summary_probe(f):
    p = probe(f)
    if 'error' in p: return p
    r = {'duration': float(p['format'].get('duration', 0)), 'format': p['format'].get('format_name')}
    for s in p['streams']:
        if s['codec_type'] == 'video':
            o, _, _ = run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f])
            r['v'] = {k: s.get(k) for k in ('codec_name', 'profile', 'width', 'height', 'sample_aspect_ratio', 'display_aspect_ratio', 'r_frame_rate', 'avg_frame_rate', 'pix_fmt', 'field_order', 'duration')}
            r['v']['nb_read_frames'] = o.strip().strip(',')
            r['v']['rotation'] = next((sd.get('rotation') for sd in s.get('side_data_list', []) or [] if 'rotation' in sd), None)
        elif s['codec_type'] == 'audio':
            r.setdefault('a', []).append({k: s.get(k) for k in ('codec_name', 'sample_rate', 'channels', 'channel_layout', 'duration')})
    return r

def src_time_table(src, fields):
    c, info = codes(src, fields)
    t = {}
    for (tm, code, u) in c:
        if u == 0 and code not in t: t[code] = tm
    return t

def analyze(f, fields=False, src=None, srcfields=False, pieces=None):
    R = {'file': f, 'probe': summary_probe(f)}
    if 'error' in R['probe']: return R
    c, info = codes(f, fields)
    R['geom'] = info
    if c:
        unsure = sum(1 for x in c if x[2])
        seq = [x[1] for x in c]
        steps = {}
        runs = []
        cur = [seq[0], seq[0], 1]
        for i in range(1, len(seq)):
            d = seq[i] - seq[i - 1]
            steps[d] = steps.get(d, 0) + 1
            if 0 <= d <= 3: cur[1] = seq[i]; cur[2] += 1
            else: runs.append(cur); cur = [seq[i], seq[i], 1]
        runs.append(cur)
        R['codes'] = {'n': len(c), 'unsure': unsure, 'first': seq[:6], 'steps': {str(k): v for k, v in sorted(steps.items(), key=lambda kv: -kv[1])[:8]}, 'runs': runs[:12]}
    # zvuk
    p = R['probe']
    na = len(p.get('a', []))
    aud = []
    for k in range(na):
        x, ch = audio(f, k)
        for ci in range(ch):
            aud.append({'stream': k, 'ch': ci, 'tones': tones(x[:, ci]), 'beeps': [round(b, 4) for b in beeps(x[:, ci])][:40]})
    R['audio'] = aud
    if na: R['ebur128'] = ebur_mix(f, na)
    # sync: pípnutí vs obraz (obojí proti časové ose podle pieces)
    if pieces and aud:
        st = src_time_table(src, srcfields) if (src and c) else {}
        end_ = R["probe"].get("duration", 1e9); bl = [b for b in next((a["beeps"] for a in aud if a["beeps"]), []) if b < end_ - 0.01]
        off_a, off_v = [], []
        T = [x[0] for x in c]; S = [st.get(x[1]) for x in c]
        for b in bl:
            # zdrojový čas pípnutí podle pieces
            pc = next(((s0, i0, o0) for (s0, i0, o0) in pieces if s0 - 0.05 <= b < s0 + (o0 - i0) + 0.05), None)
            if not pc: continue
            s0, i0, o0 = pc
            k = round(b - s0 + i0)
            exp = s0 + (k - i0)
            off_a.append(round((b - exp) * 1000, 1))
            # obraz: snímek se zdrojovým časem ≤ k (poslední), interpolace
            best = None
            for j in range(len(T)):
                if S[j] is None or not (s0 - 0.05 <= T[j] < s0 + (o0 - i0)): continue
                if S[j] <= k + 1e-6 and (best is None or S[j] > S[best] or (S[j] == S[best] and T[j] < T[best])): best = j
            if best is not None and k - S[best] < 0.1:
                vk = T[best] + (k - S[best])
                off_v.append(round((vk - exp) * 1000, 1))
        R['sync'] = {'audio_vs_timeline_ms': off_a, 'video_vs_timeline_ms': off_v,
                     'av_ms': [round(a - v, 1) for a, v in zip(off_a, off_v)] if len(off_a) == len(off_v) else None}
    return R

if __name__ == '__main__':
    a = sys.argv[1:]
    f = a[0]
    opt = lambda k: a[a.index(k) + 1] if k in a else None
    pieces = [tuple(map(float, p.split(':'))) for p in opt('--pieces').split(',')] if opt('--pieces') else None
    R = analyze(f, '--fields' in a, opt('--src'), '--srcfields' in a, pieces)
    s = json.dumps(R, ensure_ascii=False)
    if opt('--json'): open(opt('--json'), 'w', encoding='utf8').write(json.dumps(R, ensure_ascii=False, indent=1))
    print(s[:6000])

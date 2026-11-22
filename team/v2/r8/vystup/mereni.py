# Kontrolor vystupu r7 - strojove mereni exportu PZ AI Cut (zvuk na strizich, sync, obraz, vyrez).
# Pouziti: python mereni.py <export.mp4> <nazev sekvence v sekvence.json> <zdroj.mp4> <vystupni prefix>
import json, subprocess, sys, math, os
import numpy as np
import cv2

EXP, SEQNAME, SRC, PREFIX = sys.argv[1:5]
HERE = __file__.rsplit('\\', 1)[0] if '\\' in __file__ else __file__.rsplit('/', 1)[0]
SEQ = json.load(open(HERE + '/sekvence.json', encoding='utf-8'))[SEQNAME]
FPS = 25
SR = 48000
out = {'export': EXP, 'seq': SEQNAME}


def audio(path, ss=None, t=None):
    cmd = ['ffmpeg', '-v', 'error']
    if ss is not None: cmd += ['-ss', '%.4f' % ss]
    cmd += ['-i', path]
    if t is not None: cmd += ['-t', '%.4f' % t]
    cmd += ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32)


def rms_db(x):
    return 20 * math.log10(max(1e-9, float(np.sqrt(np.mean(x.astype(np.float64) ** 2))))) if len(x) else -180


def frames(path, w, h, ss=None, t=None, gray=True, vf_extra=''):
    cmd = ['ffmpeg', '-v', 'error']
    # r8: celý 28min zdroj má řídké klíčové snímky a ffmpeg -ss před -i v něm skočí na DALŠÍ klíčový snímek
    # (ověřeno: 920,12 s dekóduje jako 922,56) -> s PREROLL=n se hledá n s předem a dojede se dekódováním
    pre = float(os.environ.get('PREROLL', '0')) if ss is not None else 0
    if ss is not None: cmd += ['-ss', '%.4f' % max(0, ss - pre)]
    cmd += ['-i', path]
    if ss is not None and pre: cmd += ['-ss', '%.4f' % min(ss, pre)]
    if t is not None: cmd += ['-t', '%.4f' % t]
    cmd += ['-an', '-vf', (vf_extra + ',' if vf_extra else '') + 'scale=%d:%d' % (w, h), '-pix_fmt', 'gray' if gray else 'bgr24', '-f', 'rawvideo', '-']
    b = subprocess.run(cmd, capture_output=True, check=True).stdout
    ch = 1 if gray else 3
    n = len(b) // (w * h * ch)
    a = np.frombuffer(b[:n * w * h * ch], np.uint8)
    return a.reshape((n, h, w)) if gray else a.reshape((n, h, w, 3))


# ---------- zvuk ----------
ea = audio(EXP)
win = int(0.01 * SR)
wr = np.array([rms_db(ea[i:i + win]) for i in range(0, len(ea) - win, win)])
floor = float(np.percentile(wr, 10))
speech = float(np.median(wr[wr > floor + 15])) if np.any(wr > floor + 15) else None
out['audio'] = {'floor_db': round(floor, 1), 'speech_median_db': speech and round(speech, 1)}
aclips = SEQ['audio'][0]
cuts = []
for i, c in enumerate(aclips):
    t = c['start']
    prev = aclips[i - 1] if i else None
    rec = {'t': round(t, 3), 'src_in': round(c['in'], 3), 'src_prev_out': prev and round(prev['out'], 3)}
    n = int(round(t * SR))
    for name, a, b in [('exp_pre50', n - int(0.05 * SR), n), ('exp_post50', n, n + int(0.05 * SR)), ('exp_pre10', n - int(0.01 * SR), n), ('exp_post10', n, n + int(0.01 * SR))]:
        rec[name] = round(rms_db(ea[max(0, a):max(0, b)]), 1)
    # zdroj: co bylo hned za Out predchoziho klipu a hned pred In tohoto (je tam souvisla rec = useknuto)
    if prev:
        sa = audio(SRC, prev['out'] - 0.1, 0.2)
        rec['src_at_prev_out_-100_0'] = round(rms_db(sa[:int(0.1 * SR)]), 1)
        rec['src_at_prev_out_0_+100'] = round(rms_db(sa[int(0.1 * SR):]), 1)
    sb = audio(SRC, max(0, c['in'] - 0.1), 0.2)
    rec['src_at_in_-100_0'] = round(rms_db(sb[:int(0.1 * SR)]), 1)
    rec['src_at_in_0_+100'] = round(rms_db(sb[int(0.1 * SR):]), 1)
    # nespojitost vzorku na strihu
    if i:
        seg = ea[n - int(0.5 * SR):n + int(0.5 * SR)]
        d = np.abs(np.diff(seg))
        p99 = float(np.percentile(d, 99.5))
        jump = float(np.max(np.abs(np.diff(ea[n - 3:n + 3]))))
        rec['jump_vs_p995'] = round(jump / max(p99, 1e-9), 2)
    # A/V-sync zvuku: korelace exportu se zdrojem (ocekavany posun 0)
    dur = c['out'] - c['in']
    a0 = 0.3; L = min(2.5, dur - 0.6)
    if L > 0.5:
        x = ea[int((t + a0) * SR):int((t + a0 + L) * SR)].astype(np.float64)
        y = audio(SRC, c['in'] + a0 - 0.3, L + 0.6).astype(np.float64)
        x = (x - x.mean()) / (x.std() + 1e-9)
        best = None
        for lag in range(0, len(y) - len(x), 24):  # krok 0,5 ms
            yy = y[lag:lag + len(x)]
            r = float(np.dot(x, (yy - yy.mean()) / (yy.std() + 1e-9)) / len(x))
            if best is None or r > best[1]: best = (lag, r)
        rec['audio_offset_ms'] = round((best[0] / SR - 0.3) * 1000, 1)  # + = export je pozde proti zdroji
        rec['audio_corr'] = round(best[1], 3)
    cuts.append(rec)
out['audio_cuts'] = cuts
e_end = len(ea) / SR
out['audio_tail'] = {'last50_db': round(rms_db(ea[-int(0.05 * SR):]), 1), 'first50_db': round(rms_db(ea[:int(0.05 * SR)]), 1), 'len_s': round(e_end, 3)}

# ---------- obraz: snimky exportu ----------
W, H = SEQ['w'], SEQ['h']
qh = 180
qw = int(round(W * qh / H))
ev = frames(EXP, qw, qh)
nf = len(ev)
luma = ev.reshape(nf, -1).mean(1)
diff = np.r_[0, np.abs(ev[1:].astype(np.int16) - ev[:-1].astype(np.int16)).reshape(nf - 1, -1).mean(1)]
med = float(np.median(diff[1:]))
vcuts = [i for i in range(1, nf) if diff[i] > max(10, 6 * med)]
out['video'] = {'frames': nf, 'median_diff': round(med, 2), 'visual_cuts_s': [round(i / FPS, 2) for i in vcuts],
                'black_frames': [round(i / FPS, 2) for i in range(nf) if luma[i] < 20],
                'frozen_frames_near_cuts': []}
# sekvence: hranice klipu obrazu
vcl = SEQ['video'][0]
bounds = sorted(set(round(c['start'], 2) for c in vcl if c['start'] > 0))
out['video']['clip_bounds_s'] = bounds
shots = [0] + vcuts + [nf]
out['video']['short_shots'] = [{'from_s': round(a / FPS, 2), 'frames': b - a} for a, b in zip(shots[:-1], shots[1:]) if b - a < 13]
for b in bounds:
    f = int(round(b * FPS))
    for k in range(max(1, f - 3), min(nf, f + 4)):
        if diff[k] < 0.15 * med:
            out['video']['frozen_frames_near_cuts'].append(round(k / FPS, 2))
np.save(PREFIX + '-diff.npy', diff)

# ---------- obraz: snimek exportu proti zdroji (16:9 = posun snimku, vyrez = poloha vyrezu + obliceje) ----------
YN = cv2.FaceDetectorYN.create('O:/ADOBEPREMIERESTRIH/models/opencv_face/face_detection_yunet_2023mar.onnx', '', (1280, 720), 0.6, 0.3, 50)


def faces(img):
    # YuNet (OpenCV) na plnem snimku zdroje 1280x720 -> stredy obliceju (x, y, sirka)
    YN.setInputSize((img.shape[1], img.shape[0]))
    _, det = YN.detect(img)
    return [] if det is None else [(float(d[0] + d[2] / 2), float(d[1] + d[3] / 2), int(d[2])) for d in det]


per_frame = []
is169 = abs(W / H - 16 / 9) < 0.01
for c in vcl:
    k0 = int(round(c['start'] * FPS))
    n = int(round((c['out'] - c['in']) * FPS))
    sv = frames(SRC, 320, 180, c['in'], (c['out'] - c['in']) + 0.001)[:n]
    sfull = frames(SRC, 1280, 720, c['in'], (c['out'] - c['in']) + 0.001, gray=False)[:n]
    for j in range(len(sv)):
        k = k0 + j
        if k >= nf: break
        rec = {'t': round(k / FPS, 2), 'src': round(c['in'] + j / FPS, 2)}
        if is169:
            band = slice(0, int(qh * 0.7))
            best = None
            for off in range(-4, 5):
                jj = j + off
                if 0 <= jj < len(sv):
                    e = float(np.abs(ev[k][band].astype(np.int16) - sv[jj][band].astype(np.int16)).mean())
                    if best is None or e < best[1]: best = (off, e)
            rec['frame_offset'] = best[0]; rec['mad'] = round(best[1], 2)
        else:
            # vyrez: export (vyska 180) uvnitr zdroje 320x180, jen prostredni pas (bez nadpisu a titulku)
            r0, r1 = int(qh * 0.25), int(qh * 0.55)
            tpl = ev[k][r0:r1]
            if tpl.shape[1] <= 320:
                m = cv2.matchTemplate(sv[j][r0:r1], tpl, cv2.TM_CCOEFF_NORMED)
                x = int(np.argmax(m)); rec['crop_x'] = x * 4; rec['crop_w'] = qw * 4; rec['match'] = round(float(m.max()), 3)
                near_cut = any(abs(k / FPS - b) <= 0.13 for b in bounds) or any(abs(k - v) <= 3 for v in vcuts)
                if j % 5 == 0 or near_cut:
                    fs = faces(sfull[j])
                    rec['faces_src'] = len(fs)
                    rec['faces_in_crop'] = sum(1 for (fx, fy, fw) in fs if rec['crop_x'] + 0.15 * fw <= fx <= rec['crop_x'] + rec['crop_w'] - 0.15 * fw)
                    rec['near_cut'] = near_cut
        per_frame.append(rec)
json.dump(per_frame, open(PREFIX + '-snimky.json', 'w'), indent=0)
if is169:
    offs = {}
    for r in per_frame: offs.setdefault(r['frame_offset'], 0); offs[r['frame_offset']] += 1
    out['frame_offset_hist'] = offs
    out['frames_bad_match'] = [r for r in per_frame if r['mad'] > 12]
else:
    chk = [r for r in per_frame if 'faces_src' in r]
    out['crop'] = {'checked_frames': len(chk), 'low_match': [r for r in per_frame if r.get('match', 1) < 0.6],
                   'empty_crop_with_person_in_src': [r for r in chk if r['faces_src'] > 0 and r['faces_in_crop'] == 0],
                   'no_face_in_src': len([r for r in chk if r['faces_src'] == 0])}
json.dump(out, open(PREFIX + '-mereni.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(json.dumps(out, ensure_ascii=False, indent=1)[:6000])

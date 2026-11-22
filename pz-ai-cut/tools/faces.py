"""Kde je v záběru obličej mluvčího (pro převod na výšku 9:16 / 4:5 / 1:1).
Vstup (stdin, JSON): {"items": [{"path", "times": [s…], "range": [in, out], "transcript": cesta k přepisu s mluvčími | null}],
                      "yunet": cesta k face_detection_yunet*.onnx | null}
  (starý tvar – samotný seznam items – funguje dál)
Výstup (stdout, JSON): [{"x": 0..1 | null, "y", "w", "n": počet nálezů, "faces": počet osob, "why": proč tahle}, …]

Detekce: YuNet (OpenCV DNN, najde i malé obličeje z profilu v širokém záběru), bez modelu OpenCV Haar.
Víc osob v záběru (široký záběr rozhovoru):
  1) přepis s mluvčími: z několika širokých záběrů zdroje se hlasováním (kdo hýbe ústy, když podle přepisu mluví X)
     zjistí, kde kdo sedí, a záběr se vycentruje na toho, kdo v něm podle přepisu mluví,
  2) jinak ten, kdo zřetelně víc hýbe ústy (vůči pohybu hlavy),
  3) jinak největší obličej.
Měřeno (TALK 28 min, 24 širokých záběrů): samotná ústa ~70 % správně, hlasování přes záběry určí místa spolehlivě.
"""
import json
import os
import sys

import cv2
import numpy as np

FRONT = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
PROFILE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
_yunet = {"path": None, "det": None, "size": None}


def detect_haar(frame):
    h, w = frame.shape[:2]
    scale = 640.0 / w if w > 640 else 1.0
    small = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale != 1.0 else frame
    gray = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
    sh, sw = gray.shape[:2]
    mins = max(24, int(min(sw, sh) * 0.06))
    found = []
    for casc, flip in ((FRONT, False), (PROFILE, False), (PROFILE, True)):
        img = cv2.flip(gray, 1) if flip else gray
        for (x, y, fw, fh) in casc.detectMultiScale(img, scaleFactor=1.15, minNeighbors=6, minSize=(mins, mins)):
            if flip:
                x = sw - x - fw
            found.append((x / scale, y / scale, fw / scale, fh / scale))
    return dedupe(found)


def detect(frame):
    """Obličeje jako (x, y, w, h) v pixelech snímku."""
    if _yunet["path"]:
        h, w = frame.shape[:2]
        try:
            if _yunet["det"] is None or _yunet["size"] != (w, h):
                _yunet["det"] = cv2.FaceDetectorYN.create(_yunet["path"], "", (w, h), 0.6, 0.3, 5000)
                _yunet["size"] = (w, h)
            _, faces = _yunet["det"].detect(frame)
            return [] if faces is None else dedupe([tuple(float(v) for v in f[:4]) for f in faces])
        except Exception:
            _yunet["path"] = None  # model nejde načíst -> Haar
    return detect_haar(frame)


def dedupe(faces):
    out = []
    for f in sorted(faces, key=lambda f: -f[2] * f[3]):
        cx = f[0] + f[2] / 2
        if all(abs(cx - (g[0] + g[2] / 2)) > max(f[2], g[2]) * 0.6 for g in out):
            out.append(f)
    return out


def read_at(cap, t):
    """Snímek v čase t. Skok přímo na čas (POS_MSEC) se v MP4 s ne-IDR I-snímky, které stss značí jako klíčové
    (TN: střih kamery), trefí doprostřed GOP a vrátí zastaralý obraz – proto skok o 11 s dřív a pak čtení vpřed."""
    pos = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
    if not (pos <= t and t - pos < 12.0):
        cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, t - 11.0) * 1000.0)
    for _ in range(400):
        ok = cap.grab()
        if not ok:
            return None
        if cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0 >= t - 0.02:
            ok, frame = cap.retrieve()
            return frame if ok else None
    return None


def mouth_activity(cap, t, faces, span=0.9, step=0.08):
    """Pohyb spodní části obličeje (ústa, brada) vůči horní (čelo, oči) v okně [t, t+span] – kdo mluví."""
    grays = []
    u = t
    while u <= t + span:
        fr = read_at(cap, u)
        if fr is None:
            break
        grays.append(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY).astype(np.float32))
        u += step
    if len(grays) < 4:
        return [0.0] * len(faces)
    out = []
    for (x, y, w, h) in faces:
        lo = (int(x), int(y + h * 0.6), int(x + w), int(y + h * 1.02))
        up = (int(x), int(y), int(x + w), int(y + h * 0.4))

        def d(r):
            return float(np.mean([np.abs(grays[i + 1][r[1]:r[3], r[0]:r[2]] - grays[i][r[1]:r[3], r[0]:r[2]]).mean()
                                  for i in range(len(grays) - 1)]))
        out.append(d(lo) / (d(up) + 0.3))
    return out


def speakers_of(transcript):
    try:
        with open(transcript, encoding="utf-8") as f:
            t = json.load(f)
        segs = [s for s in (t.get("segments") or []) if s.get("speaker")]
        return segs if len({s["speaker"] for s in segs}) >= 2 else []
    except Exception:
        return []


def speaker_in(segs, a, b):
    cov = {}
    for s in segs:
        o = min(b, s["end"]) - max(a, s["start"])
        if o > 0:
            cov[s["speaker"]] = cov.get(s["speaker"], 0) + o
    if not cov:
        return None
    best = max(cov, key=cov.get)
    return best if cov[best] >= 0.5 * (b - a) else None  # v záběru se střídají – podle přepisu nerozhodovat


def seats(path, segs, scan=60, enough=5):
    """Kde kdo sedí: hlasování přes široké záběry zdroje (2+ osoby). -> {mluvčí: x 0..1}
    Projde až `scan` vět rovnoměrně po celém zdroji (detail = 1 osoba se přeskočí), skončí, až má každý mluvčí `enough` hlasů."""
    cand = [s for s in segs if s["end"] - s["start"] >= 2.2]
    if not cand:
        return {}
    n = min(scan, len(cand))
    pick = sorted({id(c): c for c in (cand[int(i * len(cand) / n)] for i in range(n))}.values(), key=lambda s: s["start"])
    names = {s["speaker"] for s in segs}
    cap = cv2.VideoCapture(path)
    votes = {}
    for s in pick:
        if all(len(votes.get(k, [])) >= enough for k in names):
            break
        t = s["start"] + 0.3
        fr = read_at(cap, t)
        if fr is None:
            continue
        faces = detect(fr)
        if len(faces) < 2:
            continue
        faces = faces[:3]
        act = mouth_activity(cap, t, faces)
        i = int(np.argmax(act))
        votes.setdefault(s["speaker"], []).append((faces[i][0] + faces[i][2] / 2) / fr.shape[1])
    cap.release()
    out = {}
    for spk, xs in votes.items():
        if len(xs) < 3:
            continue
        xs = sorted(xs)
        med = xs[len(xs) // 2]
        if sum(1 for x in xs if abs(x - med) < 0.12) / len(xs) >= 0.6:
            out[spk] = med
    if len(out) >= 2:  # dva mluvčí na stejném místě = hlasování nerozhodlo
        vals = sorted(out.values())
        if min(b - a for a, b in zip(vals, vals[1:])) < 0.15:
            return {}
    return out


def main():
    data = json.loads(sys.stdin.read() or "[]")
    items = data["items"] if isinstance(data, dict) else data
    if isinstance(data, dict) and data.get("yunet") and os.path.exists(data["yunet"]):
        _yunet["path"] = data["yunet"]
    caps, seat_cache, seg_cache = {}, {}, {}
    out = []
    for it in items:
        path = it["path"]
        cap = caps.get(path)
        if cap is None:
            cap = caps[path] = cv2.VideoCapture(path)
        per = []  # [(t, w, h, faces)]
        for t in sorted(it.get("times", [])):
            frame = read_at(cap, float(t))
            if frame is None:
                continue
            h, w = frame.shape[:2]
            per.append((float(t), w, h, detect(frame)))
        found = [p for p in per if p[3]]
        if not found:
            out.append({"x": None, "y": None, "w": None, "n": 0, "faces": 0, "why": "none"})
            continue
        if max(len(p[3]) for p in found) < 2:
            xs = sorted(((f[0] + f[2] / 2) / w, (f[1] + f[3] / 2) / h, f[2] / w) for (_, w, h, fs) in found for f in fs)
            x, y, fw = xs[len(xs) // 2]
            out.append({"x": x, "y": y, "w": fw, "n": len(xs), "faces": 1, "why": "single"})
            continue
        # víc osob: snímek s nejvíc obličeji, nejblíž středu záběru
        tm = sum(p[0] for p in found) / len(found)
        t, w, h, faces = max(found, key=lambda p: (len(p[3]), -abs(p[0] - tm)))
        faces = faces[:3]
        cx = [(f[0] + f[2] / 2) / w for f in faces]
        choice, why = None, ""
        tr, rng = it.get("transcript"), it.get("range")
        if tr and rng:
            if tr not in seg_cache:
                seg_cache[tr] = speakers_of(tr)
            segs = seg_cache[tr]
            if segs:
                if (path, tr) not in seat_cache:
                    seat_cache[(path, tr)] = seats(path, segs)
                where = seat_cache[(path, tr)]
                spk = speaker_in(segs, rng[0], rng[1])
                if spk in where:
                    j = min(range(len(cx)), key=lambda k: abs(cx[k] - where[spk]))
                    if abs(cx[j] - where[spk]) < 0.15:
                        choice, why = j, "transcript:" + spk
                elif spk and len(cx) == 2:
                    # místo mluvčího neznáme, ale víme, kde sedí ten druhý -> mluví ten, kdo tam nesedí
                    for other, ox in where.items():
                        if other == spk:
                            continue
                        j = min(range(2), key=lambda k: abs(cx[k] - ox))
                        if abs(cx[j] - ox) < 0.15 and abs(cx[1 - j] - ox) >= 0.15:
                            choice, why = 1 - j, "transcript-other:" + spk
                            break
        if choice is None:
            act = mouth_activity(cap, t, faces)
            order = sorted(range(len(act)), key=lambda k: -act[k])
            if act[order[0]] >= 1.25 * max(1e-6, act[order[1]]):
                choice, why = order[0], "mouth"
            else:
                choice, why = 0, "largest"
        f = faces[choice]
        out.append({"x": cx[choice], "y": (f[1] + f[3] / 2) / h, "w": f[2] / w, "n": len(found), "faces": len(faces), "why": why})
    for c in caps.values():
        c.release()
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()

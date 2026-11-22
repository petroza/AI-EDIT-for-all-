"""Kde je v záběru obličej (pro převod na výšku 9:16 / 4:5 / 1:1).
Vstup (stdin, JSON): [{"path": "...", "times": [s, s, ...]}, ...]
Výstup (stdout, JSON): [{"x": 0..1 střed obličeje vodorovně | null, "y": 0..1 | null, "w": šířka obličeje 0..1, "n": počet nálezů}, ...]
OpenCV Haar (frontální + profil z obou stran); při více obličejích vyhrává největší (detail mluvčího).
"""
import json
import sys

import cv2

FRONT = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
PROFILE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")


def detect(gray):
    h, w = gray.shape[:2]
    mins = max(24, int(min(w, h) * 0.06))
    found = []
    for casc, flip in ((FRONT, False), (PROFILE, False), (PROFILE, True)):
        img = cv2.flip(gray, 1) if flip else gray
        for (x, y, fw, fh) in casc.detectMultiScale(img, scaleFactor=1.15, minNeighbors=6, minSize=(mins, mins)):
            if flip:
                x = w - x - fw
            found.append((x, y, fw, fh))
    return found


def read_at(cap, t):
    """Snímek v čase t. Skok přímo na čas (POS_MSEC) se v MP4 s ne-IDR I-snímky, které stss značí jako klíčové
    (TN: střih kamery), trefí doprostřed GOP a vrátí zastaralý obraz – proto skok o 11 s dřív a pak čtení vpřed."""
    pos = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
    if not (pos <= t and t - pos < 12.0):
        cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, t - 11.0) * 1000.0)
    frame = None
    for _ in range(400):
        ok = cap.grab()
        if not ok:
            return None
        if cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0 >= t - 0.02:
            ok, frame = cap.retrieve()
            return frame if ok else None
    return None


def main():
    items = json.loads(sys.stdin.read() or "[]")
    caps = {}
    out = []
    for it in items:
        path = it["path"]
        cap = caps.get(path)
        if cap is None:
            cap = caps[path] = cv2.VideoCapture(path)
        xs, ys, ws = [], [], []
        for t in sorted(it.get("times", [])):
            frame = read_at(cap, float(t))
            if frame is None:
                continue
            h, w = frame.shape[:2]
            scale = 640.0 / w if w > 640 else 1.0
            small = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale != 1.0 else frame
            gray = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
            faces = detect(gray)
            if not faces:
                continue
            x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            sw, sh = gray.shape[1], gray.shape[0]
            xs.append((x + fw / 2) / sw)
            ys.append((y + fh / 2) / sh)
            ws.append(fw / sw)
        if xs:
            xs.sort(); ys.sort(); ws.sort()
            m = len(xs) // 2
            out.append({"x": xs[m], "y": ys[m], "w": ws[m], "n": len(xs)})
        else:
            out.append({"x": None, "y": None, "w": None, "n": 0})
    for c in caps.values():
        c.release()
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()

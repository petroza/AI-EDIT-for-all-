"""YouTuber verze dílu (9:16 + 16:9 v After Effects) – konfigurace dílu, mluvčí z hlasu, plán záběrů a plán pro AE.

Pipeline (MCP nástroje yt_*): struktura z Premiere (server) → yt_speakers → yt_plan → yt_build_ae (aerun.py) → …
Vše, co bylo v prvním dílu natvrdo (osoby, kotvy hlasu, rozestavení studia, kapitoly, fotky, opravy přepisu…),
je v YAML configu dílu (vzor: youtuber/detail-01.yaml). Výstupy jdou do cil.slozka/data.

Spuštění bez Workeru (server čte config): python -m worker.youtuber --print config.yaml
"""
from __future__ import annotations

import copy
import json
import os
import pickle
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from worker.common import ROOT, index_get, log, read_json, write_json  # noqa: E402
else:
    from .common import ROOT, index_get, log, read_json, write_json

FPS = 25
AW, AH = 480, 270          # rozlišení analýzy
NS = 48
SW = AW // NS
YUNET = ROOT / "models" / "opencv_face" / "face_detection_yunet_2023mar.onnx"
NO_WINDOW = 0x08000000 if os.name == "nt" else 0

DEFAULT_RULES = {
    "barvy": {
        "red": {"h": [[0, 12], [165, 180]], "s": [81, 255], "v": [71, 255]},
        "skin": {"h": [[3, 20]], "s": [61, 189], "v": [91, 255]},
        "navy": {"h": [[105, 130]], "s": [141, 255], "v": [0, 99]},
    },
    "pravidla": [
        {"typ": "logo", "kdyz": [{"navy": [0.6, 1], "skin": [0, 0.05]}]},
        {"typ": "wide", "kdyz": [{"red": [0.37, 1]}, {"red": [0.28, 1], "edge": [0.07, 1], "skin": [0.09, 1]}]},
        {"typ": "close", "kdyz": [{"red": [0.2, 0.37], "edge": [0, 0.055]}]},
    ],
    "vychozi_typ": "screen",
}


# ------------------------------------------------------------------ config

class ConfigError(ValueError):
    pass


def _nfd(x: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", x.lower()) if unicodedata.category(c) != "Mn")


def load_config(path: str) -> dict:
    import yaml

    p = Path(path)
    if not p.exists():
        raise ConfigError(f"Config dílu neexistuje: {path}")
    cfg = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    cfg["_path"] = str(p.resolve())
    miss = [k for k in ("zdroj", "cil", "osoby") if not cfg.get(k)]
    if miss:
        raise ConfigError(f"V configu chybí: {', '.join(miss)}")
    root = (cfg.get("vybava") or {}).get("koren", "")

    def vyb(x):
        if not x:
            return x
        return x if re.match(r"^[A-Za-z]:[\\/]|^\\\\", x) else str(Path(root) / x)

    cfg["_vyb"] = vyb
    W = Path(cfg["cil"]["slozka"])
    cfg["_dirs"] = {"work": W, "data": W / "data", "freeze": W / "freeze", "ae": W / "ae", "stills": W / "stills"}
    ids = [o["id"] for o in cfg["osoby"]]
    if len(set(ids)) != len(ids):
        raise ConfigError("osoby: id musí být jedinečná")
    mods = [o["id"] for o in cfg["osoby"] if o.get("role") == "moderator"]
    cfg["_moderator"] = mods[0] if mods else ids[0]
    return cfg


def public_config(cfg: dict) -> dict:
    """Podmnožina pro server (sekvence, stopy, cesty)."""
    d = cfg["_dirs"]
    return {"path": cfg["_path"], "dil": cfg.get("dil", ""), "zdroj": cfg["zdroj"], "premiere": cfg.get("premiere") or {},
            "work": str(d["work"]), "struktura": str(d["data"] / "struktura.json"), "nazev": cfg["cil"].get("nazev", "YT")}


def ensure_dirs(cfg):
    for d in cfg["_dirs"].values():
        d.mkdir(parents=True, exist_ok=True)


def load_transcript(cfg) -> dict:
    tp = cfg.get("prepis")
    f = Path(tp) if tp else index_get("transcripts", cfg["zdroj"])
    if not f or not Path(f).exists():
        raise ConfigError(f"Chybí přepis zdroje {cfg['zdroj']} – nejdřív transcribe_media (nebo prepis: v configu).")
    return read_json(f)


def load_structure(cfg) -> dict:
    f = cfg["_dirs"]["data"] / "struktura.json"
    if not f.exists():
        raise ConfigError(f"Chybí {f} – nejdřív yt_export_structure (struktura sekvence z Premiere).")
    D = read_json(f)
    # ruční opravy struktury: posun začátku klipu (prodloužení dozadu), vše za ním se posune
    for fx in cfg.get("opravy_struktury") or []:
        old, new = float(fx["klip_od"]), float(fx["novy_od"])
        clips = D["v1"]
        k = next((i for i, c in enumerate(clips) if abs(c["i"] - old) < 0.06 and _is_src(cfg, c)), None)
        if k is None:
            log(f"yt: oprava struktury {old} – klip nenalezen (už opravené v Premiere?)")
            continue
        L = old - new
        c = clips[k]
        pos = c["s"]
        c["i"] = new
        c["e"] = c["e"] + L
        for j in range(k + 1, len(clips)):
            clips[j]["s"] += L
            clips[j]["e"] += L
        for m in D["a2"]:
            if m["s"] >= pos + 0.01:
                m["s"] += L
                m["e"] += L
                m["k"] = [[t + L, v] for t, v in m["k"]]
            elif m["e"] > pos:
                m["e"] += L
        for t in D["v2"]:
            if t["s"] >= pos + 0.01:
                t["s"] += L
                t["e"] += L
        D["end"] += L
    return D


def _is_src(cfg, clip) -> bool:
    p = clip.get("p") or ""
    if p:
        return os.path.normcase(os.path.abspath(p)) == os.path.normcase(os.path.abspath(cfg["zdroj"]))
    return clip["n"] == os.path.basename(cfg["zdroj"])


def stationsets(cfg):
    sets = (cfg.get("studio") or {}).get("sestavy") or []
    if not sets:
        raise ConfigError("studio.sestavy: chybí rozestavení osob ve studiu")
    default = next((i for i, s in enumerate(sets) if "od" not in s), 0)

    def which(t):
        for i, s in enumerate(sets):
            if "od" in s and s["od"] <= t <= s.get("do", 1e9):
                return i
        return default

    return [s["pozice"] for s in sets], which


# ------------------------------------------------------------------ media helpers

def _ffmpeg_frame(src, t, w=960, h=540):
    import cv2

    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", "%.3f" % t, "-i", src, "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "image2pipe",
                        "-vcodec", "bmp", "-"], capture_output=True, creationflags=NO_WINDOW)
    return cv2.imdecode(np.frombuffer(p.stdout, np.uint8), 1) if p.stdout else None


def _decode(src, i, o):
    cmd = ["ffmpeg", "-v", "error", "-ss", "%.3f" % i, "-t", "%.3f" % (o - i), "-i", src, "-vf", "fps=25,scale=%d:%d" % (AW, AH),
           "-pix_fmt", "bgr24", "-f", "rawvideo", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=AW * AH * 3 * 40, creationflags=NO_WINDOW)
    k = 0
    while True:
        b = p.stdout.read(AW * AH * 3)
        if len(b) < AW * AH * 3:
            break
        yield k, np.frombuffer(b, np.uint8).reshape(AH, AW, 3)
        k += 1
    p.wait()


def _color_frac(hsv, spec):
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    hm = np.zeros(h.shape, bool)
    for lo, hi in spec["h"]:
        hm |= (h >= lo) & (h <= hi)
    s0, s1 = spec.get("s", [0, 255])
    v0, v1 = spec.get("v", [0, 255])
    return float((hm & (s >= s0) & (s <= s1) & (v >= v0) & (v <= v1)).mean())


def _feats(im, colors):
    import cv2

    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    f = {name: _color_frac(hsv, spec) for name, spec in colors.items()}
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    f["edge"] = float(cv2.Canny(g, 60, 150).mean() / 255)
    return f


def _match(rule_alts, feats):
    for alt in rule_alts:
        ok = True
        for k, (lo, hi) in alt.items():
            v = feats.get(k, 0.0)
            # dolní mez včetně, horní mez bez (kromě 1 = bez omezení) – stejně jako původní pravidla 1. dílu
            if v < lo or (v >= hi and hi < 1):
                ok = False
                break
        if ok:
            return True
    return False


class Faces:
    """Detekce obličejů YuNet (OpenCV DNN, zdarma) – přesnější než Haar, zvládá i natočení hlavy."""

    def __init__(self, src, cache_file):
        import cv2

        if not YUNET.exists():
            raise ConfigError(f"Chybí model YuNet: {YUNET} (install.ps1 ho stáhne, nebo zkopíruj face_detection_yunet_2023mar.onnx)")
        self.src = src
        self.det = cv2.FaceDetectorYN.create(str(YUNET), "", (960, 540), 0.6, 0.3, 5000)
        self.cache_file = cache_file
        self.cache = read_json(cache_file) if Path(cache_file).exists() else {}

    def frame(self, t):
        key = "f_%.3f" % t
        if key in self.cache:
            return self.cache[key]
        im = _ffmpeg_frame(self.src, t)
        out = []
        if im is not None:
            self.det.setInputSize((im.shape[1], im.shape[0]))
            _, faces = self.det.detect(im)
            for f in (faces if faces is not None else []):
                x, y, w, h = [float(v) for v in f[:4]]
                if w >= 22:
                    out.append([round((x + w / 2) * 2), round((y + h / 2) * 2), round(w * 2), round(float(f[-1]), 3)])
        self.cache[key] = out
        return out

    def save(self):
        write_json(Path(self.cache_file), self.cache)


# ------------------------------------------------------------------ mluvčí z hlasu (kotvy)

def speakers(params: dict, ctx) -> dict:
    """Každá věta přepisu dostane jméno podle podobnosti hlasu s kotvami (úseky, kde jistě mluví jen ta osoba).
    Běžná diarizace slila tři mužské hlasy – kotvy jsou spolehlivější."""
    import sherpa_onnx

    from .common import model_path

    cfg = load_config(params["config"])
    ensure_dirs(cfg)
    T = load_transcript(cfg)
    SR = 16000
    ctx.progress(0.02, "načítám zvuk")
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", cfg["zdroj"], "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, creationflags=NO_WINDOW)
    samples = np.frombuffer(p.stdout, np.float32)
    total = len(samples) / SR
    ex = sherpa_onnx.SpeakerEmbeddingExtractor(sherpa_onnx.SpeakerEmbeddingExtractorConfig(
        model=str(model_path("embedding")), num_threads=6, provider="cpu"))

    def embed(a, b):
        mid, half = (a + b) / 2, max((b - a) / 2, 0.8)
        st = ex.create_stream()
        st.accept_waveform(SR, samples[int(max(0.0, mid - half) * SR): int(min(total, mid + half) * SR)])
        st.input_finished()
        v = np.asarray(ex.compute(st), dtype="float32")
        return v / (np.linalg.norm(v) + 1e-9)

    chunks = []
    for si, s in enumerate(T["segments"]):
        cur = []
        for w in s.get("words", []):
            cur.append(w)
            if cur[-1]["e"] - cur[0]["s"] >= 2.5:
                chunks.append([cur[0]["s"], cur[-1]["e"], si])
                cur = []
        if cur:
            if cur[-1]["e"] - cur[0]["s"] < 0.6 and chunks and chunks[-1][2] == si:
                chunks[-1][1] = cur[-1]["e"]
            else:
                chunks.append([cur[0]["s"], cur[-1]["e"], si])
    E = []
    for n, (a, b, _) in enumerate(chunks):
        if n % 50 == 0:
            ctx.progress(0.05 + 0.85 * n / max(1, len(chunks)), f"hlas {n}/{len(chunks)}")
        E.append(embed(a, b))
    E = np.stack(E)
    mids = np.array([(a + b) / 2 for a, b, _ in chunks])
    C, info = {}, {}
    for o in cfg["osoby"]:
        rngs = o.get("kotvy") or []
        idx = [i for i, m in enumerate(mids) if any(a <= m <= b for a, b in rngs)]
        info[o["id"]] = len(idx)
        if not idx:
            continue
        v = E[idx].mean(0)
        C[o["id"]] = v / np.linalg.norm(v)
    names = list(C.keys())
    if len(names) < 2:
        raise ConfigError(f"Kotvy hlasu: potřeba aspoň 2 osoby s kotvami, mám {info}")
    S = E @ np.stack([C[n] for n in names]).T
    lab = []
    for i in range(len(chunks)):
        order = np.argsort(-S[i])
        lab.append((names[order[0]], float(S[i][order[0]]), float(S[i][order[0]] - S[i][order[1]])))
    seg_spk = {}
    for si in range(len(T["segments"])):
        acc = {}
        for (a, b, s), (n, c, mg) in zip(chunks, lab):
            if s == si:
                acc[n] = acc.get(n, 0) + (b - a) * max(c, 0.05)
        if acc:
            seg_spk[si] = max(acc.items(), key=lambda kv: kv[1])[0]
    out = {"chunks": [[a, b, s, n, round(c, 3), round(mg, 3)] for (a, b, s), (n, c, mg) in zip(chunks, lab)],
           "segments": {str(k): v for k, v in seg_spk.items()}, "names": names}
    f = cfg["_dirs"]["data"] / "speakers.json"
    write_json(f, out)
    dur = {}
    for si, n in seg_spk.items():
        sg = T["segments"][si]
        dur[n] = dur.get(n, 0) + sg["end"] - sg["start"]
    unsure = sum(1 for x in lab if x[2] < 0.05)
    sample = []
    for si in range(0, len(T["segments"]), max(1, len(T["segments"]) // 25)):
        sg = T["segments"][si]
        sample.append("#%d %.0f %s: %s" % (sg.get("id", si), sg["start"], seg_spk.get(si, "?"), sg["text"][:60]))
    return {"file": str(f), "anchorsChunks": info, "secondsBySpeaker": {k: round(v) for k, v in dur.items()},
            "unsureChunks": unsure, "chunks": len(chunks), "sample": sample}


# ------------------------------------------------------------------ plán záběrů + plán pro AE

def plan(params: dict, ctx) -> dict:
    cfg = load_config(params["config"])
    ensure_dirs(cfg)
    P = _Planner(cfg, ctx)
    cam = P.plan_cam()
    ae = _ae_plan(cfg, P, cam)
    return {**P.report, **ae}


class _Planner:
    def __init__(self, cfg, ctx):
        self.cfg, self.ctx = cfg, ctx
        self.src = cfg["zdroj"]
        self.D = load_structure(cfg)
        self.T = load_transcript(cfg)
        self.words = [w for sg in self.T["segments"] for w in sg["words"]]
        z = cfg.get("zabery") or {}
        self.z = z
        dl = z.get("delky") or {}
        self.LMAX = {"wide": dl.get("wide", 3.4), "close": dl.get("close", 3.8), "broll": dl.get("broll", 3.8), "screen": dl.get("screen", 4.4)}
        self.MINL = dl.get("min", 1.3)
        self.colors = z.get("barvy") or DEFAULT_RULES["barvy"]
        self.rules = z.get("pravidla") or DEFAULT_RULES["pravidla"]
        self.deftype = z.get("vychozi_typ", "screen")
        self.ST, self.which_st = stationsets(cfg)
        self.FY = {o["id"]: o.get("hlava_y", 450) for o in cfg["osoby"]}
        self.YR = {o["id"]: tuple(o.get("pasmo_y", [0, 720])) for o in cfg["osoby"]}
        self.MOD = cfg["_moderator"]
        self.PRESENTER = (cfg.get("studio") or {}).get("prezentuje") or []
        self.PRIOR_W = z.get("vaha_prezentujiciho", 2.5)
        self.clips = [c for c in self.D["v1"] if _is_src(cfg, c)]
        if not self.clips:
            raise ConfigError(f"Ve struktuře není žádný klip zdroje {self.src} (stopa V{(cfg.get('premiere') or {}).get('stopy', {}).get('obraz', 1)})")
        self.faces = Faces(self.src, cfg["_dirs"]["data"] / "face_cache_yunet.json")
        self.report = {"warnings": []}
        self.TRIMS, self.DROPS = {}, []

    def warn(self, s):
        self.report["warnings"].append(s)
        log("yt plan: " + s)

    # ---- analýza snímků (cache podle rozsahu klipu)
    def analyze(self):
        f = self.cfg["_dirs"]["data"] / "analysis_cache.pkl"
        try:
            cache = pickle.load(open(f, "rb"))
        except (OSError, EOFError, pickle.UnpicklingError):
            cache = {}
        ckey = json.dumps(self.colors, sort_keys=True)
        if cache.get("_colors") != ckey:
            cache = {"_colors": ckey}
        AN = {}
        for ci, c in enumerate(self.clips):
            key = "%s|%.3f|%.3f" % (os.path.normcase(self.src), c["i"], c["o"])
            if key not in cache:
                self.ctx.progress(0.03 + 0.4 * ci / len(self.clips), f"analýza obrazu {ci + 1}/{len(self.clips)}")
                import cv2

                ds, Ms, Fs, prev = [], [], [], None
                for k, im in _decode(self.src, c["i"], c["o"]):
                    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.int16)
                    if prev is None:
                        ds.append(0.0)
                        Ms.append(np.zeros(NS, np.float32))
                    else:
                        df = np.abs(g - prev)
                        ds.append(float(df.mean()))
                        dd = df.copy()
                        dd[dd < 10] = 0
                        Ms.append(dd[15:180].reshape(165, NS, SW).mean(axis=(0, 2)).astype(np.float32))
                    prev = g
                    if k % 5 == 0:
                        Fs.append((k, _feats(im, self.colors)))
                cache[key] = (np.array(ds), np.array(Ms), Fs)
                pickle.dump(cache, open(f, "wb"))
            AN[ci] = cache[key]
        self.AN = AN

    def shot_type(self, ci, a, b):
        c = self.clips[ci]
        d, M, Fs = self.AN[ci]
        ka, kb = int((a - c["i"]) * FPS), int((b - c["i"]) * FPS)
        sel = [f for f in Fs if ka <= f[0] < kb] or [min(Fs, key=lambda f: abs(f[0] - (ka + kb) / 2))]
        med = {k: float(np.median([f[1][k] for f in sel])) for k in sel[0][1]}
        for r in self.rules:
            if _match(r["kdyz"], med):
                return r["typ"]
        return self.deftype

    def presenter(self, t):
        for a, b, n in self.PRESENTER:
            if a <= t < b:
                return n
        return self.MOD

    def plan_cam(self):
        cfg, clips = self.cfg, self.clips
        self.analyze()
        AN = self.AN
        thr = self.z.get("strih_prah", 20)
        shots = []
        for ci, c in enumerate(clips):
            d, M, Fs = AN[ci]
            cuts = [k for k in range(2, len(d) - 2) if d[k] > thr and d[k] > 2.0 * max(d[k - 1], d[k + 1])]
            bounds = [0] + cuts + [len(d)]
            for a, b in zip(bounds[:-1], bounds[1:]):
                if b - a < 3 and shots and shots[-1][0] == ci:
                    shots[-1] = (ci, shots[-1][1], c["i"] + b / FPS)
                    continue
                shots.append((ci, c["i"] + a / FPS, c["i"] + b / FPS))
            shots[-1] = (ci, shots[-1][1], c["o"])
        types = [self.shot_type(*s) for s in shots]
        # ruční přepisy: podle src času (robustní) nebo čísla záběru
        OV = {}
        for o in self.z.get("prepsat") or []:
            n = o.get("zaber")
            if n is None and "src" in o:
                n = next((k for k, s in enumerate(shots) if s[1] <= o["src"] < s[2]), None)
            if n is None or n >= len(shots):
                self.warn(f"zabery.prepsat {o}: záběr nenalezen")
                continue
            OV[n] = {k: v for k, v in o.items() if k not in ("zaber", "src")}
        for n, o in OV.items():
            if "typ" in o:
                types[n] = o["typ"]
        self.OV, self.shots, self.types = OV, shots, types

        # zapečené logo na začátcích/koncích úseků
        zl = self.z.get("zapecene_logo", {"navy": 0.12, "skin_max": 0.05})
        head_end, tail_start = {}, {}
        if zl:
            def logoflag(f):
                return f[1].get("navy", 0) > zl.get("navy", 0.12) and f[1].get("skin", 1) < zl.get("skin_max", 0.05)

            for ci, c in enumerate(clips):
                Fs = AN[ci][2]
                n = 0
                while n < len(Fs) and logoflag(Fs[n]):
                    n += 1
                if 0 < n < len(Fs):
                    head_end[ci] = c["i"] + Fs[n][0] / FPS
                m = len(Fs) - 1
                while m >= 0 and logoflag(Fs[m]):
                    m -= 1
                if 0 <= m < len(Fs) - 1:
                    tail_start[ci] = c["i"] + Fs[m][0] / FPS + 0.08
        self.head_end, self.tail_start = head_end, tail_start

        # pohybová energie v pásmu každé osoby (záložní odhad mluvčího)
        base = {}
        for si_set, ST in enumerate(self.ST):
            acc = {n: [] for n in ST}
            for si, (ci, a, b) in enumerate(shots):
                if types[si] != "wide" or self.which_st((a + b) / 2) != si_set:
                    continue
                c = clips[ci]
                M = AN[ci][1]
                ka, kb = int((a - c["i"]) * FPS), int((b - c["i"]) * FPS)
                for n, x in ST.items():
                    lo, hi = int((x - 140) / 40), int((x + 140) / 40) + 1
                    acc[n].append(M[ka:kb, max(lo, 0):hi].mean() if kb > ka else 0)
            base[si_set] = {n: (np.mean(v) if v else 1.0) + 1e-3 for n, v in acc.items()}
        self.base = base

        spf = cfg["_dirs"]["data"] / "speakers.json"
        if not spf.exists():
            raise ConfigError(f"Chybí {spf} – nejdřív yt_speakers.")
        SP = read_json(spf)
        SENT, _prev = [], None
        for si, sg in enumerate(self.T["segments"]):
            spk = SP["segments"].get(str(si))
            if spk is None:
                continue
            if sg["end"] - sg["start"] < 1.0 and _prev:
                spk = _prev
            SENT.append((sg["start"], sg["end"], spk))
            _prev = spk
        self.SENT = SENT
        self.TURNS = [SENT[i][0] for i in range(1, len(SENT)) if SENT[i][2] != SENT[i - 1][2]]

        out = []
        prevspk = self.MOD
        prevclose = tuple(self.z.get("detail_vychozi", [900, 560]))
        for si, (ci, a0, b0) in enumerate(shots):
            self.ctx.progress(0.45 + 0.5 * si / len(shots), f"záběr {si + 1}/{len(shots)}")
            c = clips[ci]
            typ = types[si]
            o = OV.get(si, {})
            first_in_shot = True
            for (a, b, mode, logo) in self.segments(ci, a0, b0, typ):
                if logo:
                    tf = head_end.get(ci, b + 0.04) if mode == "head" else (tail_start.get(ci, a + 0.08) - 0.08)
                    out.append({"kind": "freeze", "typ": "freeze", "a": round(a, 3), "b": round(b, 3), "tl0": round(c["s"] + (a - c["i"]), 3),
                                "tl1": round(c["s"] + (b - c["i"]), 3), "shot": si, "variant": 0, "freezeAt": round(tf, 3), "mode": mode, "ci": ci})
                    continue
                t_eff = typ if typ != "logo" else "wide"
                lm = self.LMAX.get(t_eff, 3.8)
                forced = [t for t in self.TURNS if a + 0.7 < t < b - 0.7] if t_eff == "wide" else []
                bounds = [a] + forced + [b]
                pts = [a]
                for ia in range(len(bounds) - 1):
                    pa, pb = bounds[ia], bounds[ia + 1]
                    cuts = self.wordcuts(pa, pb)
                    cur = pa
                    while pb - cur > lm + 0.8:
                        cand = [x for x in cuts if cur + self.MINL <= x[0] <= cur + lm]
                        if not cand:
                            cand = [x for x in cuts if cur + lm < x[0] <= cur + lm + 2.0]
                        if not cand:
                            break
                        best = max(cand, key=lambda x: min(x[1], 0.6) * 1.5 + (0.5 if x[2] else 0) - 0.15 * abs((x[0] - cur) - 0.8 * lm))
                        pts.append(best[0])
                        cur = best[0]
                    pts.append(pb)
                for k in range(len(pts) - 1):
                    sa, sb = pts[k], pts[k + 1]
                    if sb - sa < 0.2:
                        continue
                    item = {"kind": "screen" if t_eff == "screen" else "cam", "typ": t_eff, "a": round(sa, 3), "b": round(sb, 3),
                            "tl0": round(c["s"] + (sa - c["i"]), 3), "tl1": round(c["s"] + (sb - c["i"]), 3), "shot": si, "variant": 0, "ci": ci}
                    if t_eff == "wide":
                        spk = self.speaker_of(ci, sa, sb, prevspk)
                        prevspk = spk
                        ST = self.ST[self.which_st((sa + sb) / 2)]
                        item["spk"] = spk
                        item["cx"] = ST.get(spk, 900)
                        item["fy"] = self.FY.get(spk, 450)
                        fp = self.face_pos(sa, sb, ST.get(spk, 900), 230, spk)
                        if fp:
                            item["cx"], item["fy"] = fp[0], fp[1]
                            item["face"] = fp[2]
                        else:
                            item["face"] = 0
                    elif t_eff == "close":
                        if "cx" in o:
                            prevclose = (o["cx"], o.get("fy", 560))
                        else:
                            fp = self.face_pos(sa, sb, None, 2000)
                            if fp:
                                prevclose = (fp[0], fp[1])
                        item["cx"], item["fy"] = prevclose
                    elif t_eff == "broll":
                        item["cx"] = o.get("cx", 960)
                        item["fy"] = o.get("fy", 540)
                        tr = self.track(sa, sb)
                        if tr:
                            item["track"] = tr
                            item["cx"], item["fy"] = tr[0][1], tr[0][2]
                    elif t_eff == "screen":
                        item["roi"] = self.screen_roi(sa, sb)
                        item["first"] = first_in_shot
                    first_in_shot = False
                    out.append(item)

        # zmrazené snímky přebírají kadrování od souseda
        for n, it in enumerate(out):
            if it["kind"] != "freeze":
                continue
            nb = None
            if it["mode"] == "head":
                nb = next((out[m] for m in range(n + 1, len(out)) if out[m]["kind"] != "freeze" and out[m]["ci"] == it["ci"]), None)
            if nb is None:
                nb = next((out[m] for m in range(n - 1, -1, -1) if out[m]["kind"] != "freeze" and out[m]["ci"] == it["ci"]), None)
            if nb is None:
                nb = {"kind": "cam", "typ": "wide", "cx": 900, "fy": 300}
            for k in ("kind", "typ", "cx", "fy", "roi", "spk"):
                if k in nb:
                    it[k] = nb[k]
            it["first"] = False
        last_shot, cnt = None, 0
        for n, it in enumerate(out):
            if it["shot"] != last_shot:
                cnt, last_shot = 0, it["shot"]
            it["variant"] = cnt % 2
            cnt += 1
            it["punch"] = (n % 3 == 0)
            it["shake"] = (n % 5 == 0 and it["typ"] not in ("screen", "freeze"))
        # bez obličeje → poloha hlavy téže osoby z nejbližšího dobrého záběru (do 20 s)
        good = [p for p in out if p.get("typ") == "wide" and p.get("face")]
        for p in out:
            if p.get("typ") == "wide" and not p.get("face") and p.get("spk"):
                cands = [g for g in good if g.get("spk") == p["spk"] and abs(g["tl0"] - p["tl0"]) <= 20]
                if cands:
                    g = min(cands, key=lambda g: abs(g["tl0"] - p["tl0"]))
                    p["cx"], p["fy"] = g["cx"], g["fy"]
                    p["face"] = -1
        self.faces.save()
        nw = sum(1 for p in out if p.get("typ") == "wide" and p["kind"] == "cam")
        nf = sum(1 for p in out if p.get("typ") == "wide" and p["kind"] == "cam" and p.get("face", 0) > 0)
        nfb = sum(1 for p in out if p.get("typ") == "wide" and p["kind"] == "cam" and p.get("face") == -1)
        hist = {}
        for t in types:
            hist[t] = hist.get(t, 0) + 1
        lines = ["%d\tsrc %.2f–%.2f\t%s%s" % (n, s[1], s[2], types[n], " (ručně)" if n in OV else "") for n, s in enumerate(shots)]
        sf = cfg["_dirs"]["data"] / "zabery.txt"
        sf.write_text("číslo\tsrc úsek\ttyp\n" + "\n".join(lines), encoding="utf-8")
        write_json(cfg["_dirs"]["data"] / "plan_cam.json", {"plan": out, "drops": self.DROPS, "trims": {str(k): v for k, v in self.TRIMS.items()},
                                                             "shots": shots, "types": types})
        self.report.update({"shots": len(shots), "shotTypes": hist, "shotList": str(sf), "camItems": len(out),
                            "faces": f"hlava nalezena u {nf} z {nw} záběrů na osobu, {nfb} převzato od souseda",
                            "logoCuts": [[round(a, 2), round(b, 2)] for a, b in self.DROPS]})
        return out

    # ---- pomocné části plánu
    def speaker_of(self, ci, a, b, prev):
        si_set = self.which_st((a + b) / 2)
        ST = self.ST[si_set]
        acc = {}
        for s, e, n in self.SENT:
            ov = min(b, e) - max(a, s)
            if ov > 0:
                acc[n] = acc.get(n, 0) + ov
        sp = max(acc.items(), key=lambda kv: kv[1])[0] if acc else None
        if sp and sp in ST:
            return sp
        c = self.clips[ci]
        M = self.AN[ci][1]
        ka, kb = int((a - c["i"]) * FPS), int((b - c["i"]) * FPS)
        pr = self.presenter((a + b) / 2)
        if pr not in ST:
            pr = self.MOD if self.MOD in ST else next(iter(ST))
        if kb - ka < 3:
            return pr
        sc = {}
        for n, x in ST.items():
            lo, hi = int((x - 140) / 40), int((x + 140) / 40) + 1
            sc[n] = float(M[ka:kb, max(lo, 0):hi].mean()) / self.base[si_set][n]
        sc[pr] *= self.PRIOR_W
        order = sorted(sc.items(), key=lambda kv: -kv[1])
        if len(order) > 1 and order[0][1] < 1.25 * order[1][1] and prev in ST:
            return prev
        return order[0][0]

    def face_pos(self, sa, sb, station_x=None, tol=230, spk=None):
        n = 4 if sb - sa > 1.6 else 3
        pts = []
        for k in range(n):
            t = sa + (sb - sa) * (k + 0.5) / n
            fs = self.faces.frame(t)
            if station_x is not None:
                y0, y1 = self.YR.get(spk, (0, 720))
                fs = [f for f in fs if abs(f[0] - station_x) <= tol and y0 <= f[1] <= y1]
                if fs:
                    mx = max(f[2] for f in fs)
                    fs = [f for f in fs if f[2] >= 0.6 * mx]
                    pts.append(min(fs, key=lambda q: abs(q[0] - station_x)))
                continue
            if fs:
                pts.append(max(fs, key=lambda q: q[2]))
        if not pts:
            return None
        return [int(np.median([p[0] for p in pts])), int(np.median([p[1] for p in pts])), len(pts)]

    def screen_roi(self, sa, sb):
        """Kde na obrazovce se něco děje (změny, psaní, kurzor) nebo kde je nejvíc textu → střed a přiblížení."""
        import cv2

        cmd = ["ffmpeg", "-v", "error", "-ss", "%.3f" % sa, "-t", "%.3f" % (sb - sa), "-i", self.src, "-vf",
               "fps=10,scale=%d:%d,format=gray" % (AW, AH), "-f", "rawvideo", "-"]
        p = subprocess.run(cmd, capture_output=True, creationflags=NO_WINDOW)
        n = len(p.stdout) // (AW * AH)
        if n < 2:
            return [960, 540, 122]
        arr = np.frombuffer(p.stdout[:n * AW * AH], np.uint8).reshape(n, AH, AW).astype(np.int16)
        df = np.abs(np.diff(arr, axis=0))
        df[df < 28] = 0
        act = df.sum(axis=0).astype(np.float32)
        mean = arr.mean(axis=0).astype(np.uint8)
        edge = cv2.Canny(mean, 60, 150).astype(np.float32) / 255
        A = cv2.GaussianBlur(act, (0, 0), 5)
        mA = float(A.max())
        E = cv2.GaussianBlur(edge, (0, 0), 9)
        E = E / (E.max() + 1e-6)
        active = mA > 2500
        score = (0.85 * A / (mA + 1e-6) if active else 0) + 0.35 * E
        box = cv2.boxFilter(score, -1, (150, 90))
        y, x = np.unravel_index(box.argmax(), box.shape)
        cx, cy = int(x * 4), int(y * 4)
        Z = 125
        if active:
            ys, xs = np.where(A > 0.3 * mA)
            if len(xs):
                wsrc = max(520, min(1100, (xs.max() - xs.min() + 40) * 4))
                Z = max(115, min(172, 100 * 1080 / wsrc))
        return [max(300, min(1620, cx)), max(200, min(880, cy)), round(float(Z), 1)]

    def track(self, sa, sb):
        for tr in self.z.get("drahy") or []:
            if tr["od"] <= sa <= tr["do"]:
                seg = tr["body"]
                xs = [t[0] for t in seg]
                out, t = [], sa
                while t < sb + 1e-6:
                    out.append([round(t, 3), int(np.interp(t, xs, [q[1] for q in seg])), int(np.interp(t, xs, [q[2] for q in seg]))])
                    t += 0.25
                if out[-1][0] < sb - 0.05:
                    out.append([round(sb, 3), int(np.interp(sb, xs, [q[1] for q in seg])), int(np.interp(sb, xs, [q[2] for q in seg]))])
                return out
        return None

    def wordcuts(self, a, b):
        out, words = [], self.words
        for n in range(len(words) - 1):
            e, s2 = words[n]["e"], words[n + 1]["s"]
            m = (e + s2) / 2
            if a + self.MINL <= m <= b - 0.9:
                out.append((m, max(s2 - e, 0), words[n]["w"][-1:] in ".?!,;:"))
        return out

    def trim_point(self, he):
        """Kde začít čistý obraz po zapečeném logu: po nejbližší interpunkci, jinak první slovo od he."""
        words = self.words
        for n in range(1, len(words)):
            if he - 0.03 <= words[n]["s"] < he + 1.3:
                if words[n - 1]["w"][-1:] in ",.?!;:" and words[n - 1]["s"] >= he - 1.3:
                    return words[n]["s"]
        for w in words:
            if w["s"] >= he - 0.03:
                return w["s"]
        return he

    def segments(self, ci, a, b, typ):
        c = self.clips[ci]
        if typ == "logo":
            head = abs(a - c["i"]) < 0.05
            if head and (b - a) > 0.45:
                na = self.trim_point(b)
                self.TRIMS[ci] = na
                self.DROPS.append([round(c["s"] + (a - c["i"]), 3), round(c["s"] + (na - c["i"]), 3)])
                return []
            return [(a, b, "head" if head else "tail", True)]
        if ci in self.TRIMS and a < self.TRIMS[ci]:
            a = self.TRIMS[ci]
            if a >= b - 0.05:
                return []
        segs, cur, end = [], a, b
        he, ts = self.head_end.get(ci), self.tail_start.get(ci)
        if he and a < he - 0.02:
            if he - a > 0.45 and abs(a - c["i"]) < 0.05:
                na = min(self.trim_point(he), b)
                self.TRIMS[ci] = na
                self.DROPS.append([round(c["s"] + (a - c["i"]), 3), round(c["s"] + (na - c["i"]), 3)])
                cur = na
            else:
                e = min(b, he)
                segs.append((a, e, "head", True))
                cur = e
        tail = None
        if ts and b > ts + 0.02:
            if ts > cur:
                end = ts
                tail = (ts, b, "tail", True)
            else:
                segs.append((cur, b, "tail", True))
                cur = end = b
        if end - cur > 0.04:
            segs.append((cur, end, "norm", False))
        if tail:
            segs.append(tail)
        return segs


def _ae_plan(cfg, P: _Planner, plan):
    """Titulky, jmenovky, kapitoly, CTA, fotky, vtipy, loučení, hudba, ripple → ae_plan.json (vstup pro AE)."""
    import cv2

    D, words = P.D, P.words
    v1 = D["v1"]
    data = cfg["_dirs"]["data"]
    warn = P.warn
    OV = P.OV
    for it in plan:
        o = OV.get(it["shot"])
        if o and it["kind"] != "freeze":
            it.update({k: v for k, v in o.items() if k != "typ"})

    gfx, jumps = [], []
    prev_o, prev_gfx = None, True
    for c in v1:
        if _is_src(cfg, c):
            if prev_o is not None and abs(c["i"] - prev_o) > 0.3 and not prev_gfx:
                jumps.append(round(c["s"], 3))
            prev_o, prev_gfx = c["o"], False
        else:
            gfx.append({"path": c["p"], "tl0": c["s"], "tl1": c["e"], "in": c["i"], "out": c["o"], "name": c["n"]})
            prev_gfx, prev_o = True, None
    for it in plan:
        it["jump"] = any(abs(it["tl0"] - j) < 0.04 for j in jumps)

    # ruční úseky
    for rz in cfg.get("rucni_zabery") or []:
        a0, a1 = rz["od"], rz["do"]
        base = next((p for p in plan if p["kind"] != "freeze" and p["a"] <= a0 + 0.2 and p["b"] > a0), None)
        if base is None:
            warn(f"rucni_zabery {a0}–{a1}: úsek není ve střihu")
            continue
        off, ci, shot = base["tl0"] - base["a"], base["ci"], base["shot"]
        out = []
        for p in plan:
            if p["kind"] == "freeze" or p["b"] <= a0 + 1e-6 or p["a"] >= a1 - 1e-6 or p["ci"] != ci:
                out.append(p)
                continue
            if p["a"] < a0 - 0.05:
                L = copy.deepcopy(p)
                L["b"] = round(a0, 3)
                L["tl1"] = round(a0 + off, 3)
                out.append(L)
            if p["b"] > a1 + 0.05:
                R = copy.deepcopy(p)
                R["a"] = round(a1, 3)
                R["tl0"] = round(a1 + off, 3)
                out.append(R)
        for s in rz["zabery"]:
            it = {"kind": s.get("kind", "cam"), "typ": s.get("typ", "wide"), "a": s["od"], "b": s["do"], "tl0": round(s["od"] + off, 3),
                  "tl1": round(s["do"] + off, 3), "shot": shot, "variant": s.get("variant", 0), "ci": ci, "manual": True, "punch": True, "shake": False}
            for k in ("cx", "fy", "spk", "fit", "jump"):
                if k in s:
                    it[k] = s[k]
            out.append(it)
            if s.get("svist"):
                jumps.append(round(s["od"] + off, 3))
        out.sort(key=lambda p: (p["tl0"], p["tl1"]))
        plan = out

    # titulky
    tc = cfg.get("titulky") or {}
    max_w, max_c, pause, hl_len = tc.get("max_slov", 3), tc.get("max_znaku", 17), tc.get("pauza", 0.35), tc.get("zlute_od_znaku", 9)
    fixw = {_k.lower(): v for _k, v in ((cfg.get("opravy_prepisu") or {}).get("slova") or {}).items()}
    fixw_nd = {_nfd(k): v for k, v in fixw.items()}

    def fixword(w):
        k = re.sub(r"[.,;:?!]+$", "", w).lower()
        return fixw.get(k) or fixw_nd.get(_nfd(k)) or w   # bez ohledu na diakritiku (Whisper píše klóda i kloda)
    fixp = [tuple(x) for x in ((cfg.get("opravy_prepisu") or {}).get("fraze") or [])]
    chunks = []
    TRIMS = P.TRIMS
    DROPS = sorted(tuple(x) for x in P.DROPS)
    srcclips = [c for c in v1 if _is_src(cfg, c)]
    for _ci, c in enumerate(srcclips):
        c_i_eff = max(c["i"], TRIMS.get(_ci, 0) - 0.02)
        ws = [w for w in words if w["s"] >= c_i_eff - 0.03 and w["e"] <= c["o"] + 0.03]
        cur = []

        def flush():
            if not cur:
                return
            txt = " ".join(re.sub(r"[.,;:]+$", "", fixword(x["w"])) for x in cur).upper()
            for _a, _b in fixp:
                txt = txt.replace(_a, _b)
            t0 = c["s"] + (cur[0]["s"] - c["i"])
            t1 = c["s"] + (cur[-1]["e"] - c["i"]) + 0.12
            hl = 1 if any(len(re.sub(r"\W", "", x["w"])) >= hl_len for x in cur) else 0
            chunks.append([round(t0, 2), round(t1, 2), txt, hl])
            cur.clear()

        for w in ws:
            if cur:
                gap = w["s"] - cur[-1]["e"]
                L = len(" ".join(x["w"] for x in cur + [w]))
                if gap > pause or len(cur) >= max_w or L > max_c or cur[-1]["w"][-1:] in ".?!":
                    flush()
            cur.append(w)
        flush()
    for n in range(len(chunks) - 1):
        chunks[n][1] = round(min(chunks[n][1], chunks[n + 1][0]), 2)
        if chunks[n][1] - chunks[n][0] < 0.22:
            chunks[n][1] = round(min(chunks[n][0] + 0.22, chunks[n + 1][0]), 2)

    # lišty z V2: jmenovky, kapitoly, CTA, zvýrazňovače
    L = cfg.get("listy") or {}
    SHORT = L.get("zkratky") or {}
    BIG = set(L.get("velke") or [])
    PERSON = {o["jmeno"]: o["id"] for o in cfg["osoby"] if o.get("jmeno")}
    MOD = cfg["_moderator"]
    tags = []
    for t in D["v2"]:
        if not t.get("t"):
            continue
        tags.append({"tl0": round(t["s"], 2), "text": SHORT.get(t["t"], t["t"]), "big": t["t"] in BIG, "dur": 4.9})
    for tg in tags:
        person = PERSON.get(tg["text"])
        if not person or person == MOD:
            continue
        later = [p for p in plan if p["kind"] == "cam" and p["typ"] == "wide" and not p.get("manual") and p.get("spk") == person
                 and tg["tl0"] - 1.0 <= p["tl0"] <= tg["tl0"] + 90]
        if later:
            tg["tl0"] = round(later[0]["tl0"] + 0.1, 2)
    for tg in tags:
        if PERSON.get(tg["text"]) == MOD:
            first_cam = [p for p in plan if p["kind"] == "cam" and p["typ"] == "wide"]
            tg["tl0"] = round(first_cam[0]["tl0"] + 0.2, 2) if first_cam else tg["tl0"]
            tg["dur"] = 3.4
    runs = []
    for p in sorted([p for p in plan if p["kind"] == "cam" and p["typ"] == "wide" and p.get("spk")], key=lambda p: p["tl0"]):
        if runs and runs[-1][2] == p["spk"] and abs(runs[-1][1] - p["tl0"]) < 0.08:
            runs[-1][1] = p["tl1"]
        else:
            runs.append([p["tl0"], p["tl1"], p["spk"]])
    for tg in tags:
        person = PERSON.get(tg["text"])
        tg["person"] = bool(person)
        if person:
            ref, best = tg["tl0"], None
            for r in runs:
                if r[2] != person or r[0] < ref - 3.0:
                    continue
                st = max(r[0], ref - 0.5) + 0.12
                if r[1] - st >= 2.0:
                    best = (st, r[1])
                    break
            if best:
                tg["tl0"] = round(best[0], 2)
                tg["dur"] = round(min(3.8, best[1] - best[0] - 0.05), 2)
            else:
                tg["dur"] = 2.5
                warn(f"jmenovka {tg['text']}: osoba nemá dost dlouhý záběr – krátká jmenovka")
        else:
            tg["dur"] = 4.4 if tg["big"] else 3.6

    def src2tl(src):
        for p in plan:
            if p["a"] - 0.02 <= src < p["b"]:
                return round(p["tl0"] + (src - p["a"]), 3)
        return None

    drop_txt = set(L.get("vyradit") or [])
    tags = [t for t in tags if t["text"] not in drop_txt]
    for ch in cfg.get("kapitoly") or []:
        tl = src2tl(ch["src"])
        if tl is None:
            warn(f"kapitola {ch.get('cislo')} {ch.get('nazev')}: src {ch['src']} není ve střihu")
            continue
        tags.append({"tl0": round(tl + 0.15, 2), "text": ch["nazev"], "kind": "chapter", "num": str(ch.get("cislo", "")), "who": ch.get("kdo", ""),
                     "dur": ch.get("delka", 2.8), "person": False, "big": False})
    for tg in tags:
        if tg.get("kind"):
            continue
        if tg["person"]:
            tg["kind"] = "person"
            continue
        tg["kind"] = "marker"
        for rule in L.get("cta") or []:
            if rule["obsahuje"].lower() in tg["text"].lower():
                tg.update(kind="cta", text=rule.get("text", tg["text"]), big2=rule.get("velke", ""), dur=rule.get("delka", 3.4))
                break
    chs = [t for t in tags if t["kind"] == "chapter"]
    for t in tags:
        if t["kind"] == "person":
            for c in chs:
                if c["tl0"] - 0.2 < t["tl0"] < c["tl0"] + c["dur"]:
                    t["tl0"] = round(c["tl0"] + c["dur"] + 0.1, 2)
                    t["dur"] = max(2.0, t["dur"] - 1.0)

    # zmrazené snímky (zapečené logo) přes ffmpeg PNG (časový remap na velkém zdroji AE shazoval)
    fz = cfg["_dirs"]["freeze"]
    for n, it in enumerate(plan):
        if it.get("freezeAt") is not None:
            png = fz / f"f_{n}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "%.3f" % it["freezeAt"], "-i", cfg["zdroj"], "-frames:v", "1", str(png)],
                           creationflags=NO_WINDOW)
            it["freezePng"] = str(png)

    # loučení: celek od slova
    lc = cfg.get("louceni")
    nfw = 0
    if lc:
        key = _nfd(lc.get("slovo", "díky"))
        fw = [w for w in words if w["s"] > lc.get("od", 0) and _nfd(w["w"]).startswith(key)]
        FAREWELL = fw[0]["s"] - 0.1 if fw else lc.get("vychozi", 1e9)
        for it in list(plan):
            if it["kind"] == "cam" and it["typ"] == "wide" and it["a"] >= FAREWELL - 0.05:
                it.update(kind="screen", fit=True, first=False)
                nfw += 1
            elif it["kind"] == "cam" and it["typ"] == "wide" and it["a"] < FAREWELL < it["b"] - 0.5:
                a = copy.deepcopy(it)
                b = copy.deepcopy(it)
                a["b"] = round(FAREWELL, 3)
                a["tl1"] = round(it["tl0"] + (FAREWELL - it["a"]), 3)
                b["a"] = round(FAREWELL, 3)
                b["tl0"] = a["tl1"]
                b.update(kind="screen", fit=True, first=False)
                i = plan.index(it)
                plan[i] = a
                plan.insert(i + 1, b)
                nfw += 1

    # vtipy (koruna) a fotky podle kontextu
    photos = []
    S0 = 177.78
    for v in cfg.get("vtipy") or []:
        if v.get("typ") != "koruna":
            continue
        lo, hi = v.get("okno", [v["cas"] - 5, v["cas"] + 9])
        cands = [p for p in plan if p["kind"] == "cam" and p["typ"] == "wide" and p.get("spk") == v["osoba"] and p["b"] > lo and p["a"] < hi]
        im = cv2.imread(v["obrazek"], cv2.IMREAD_UNCHANGED) if Path(v["obrazek"]).exists() else None
        if not cands or im is None:
            warn(f"koruna: {'obrázek chybí' if im is None else v['osoba'] + ' v záběru nenalezen'}")
            continue
        hc = min(cands, key=lambda p: abs((p["a"] + p["b"]) / 2 - v.get("stred", v["cas"])))
        st = max(hc["a"], min(v["cas"], hc["b"] - 1.4))
        photos.append({"id": "koruna", "path": v["obrazek"], "w": im.shape[1], "h": im.shape[0], "tl0": round(hc["tl0"] + (st - hc["a"]), 3),
                       "dur": min(v.get("delka", 2.4), round(hc["b"] - st, 2) + 0.9), "mode": "crown", "cx": hc["cx"], "fy": hc["fy"],
                       "S": S0 * (1.30 if hc.get("variant") else 1.0)})
    fcfg = cfg.get("fotky") or {}
    fdir = Path(fcfg.get("slozka", "."))
    for ph in fcfg.get("polozky") or []:
        f = Path(ph["soubor"]) if Path(ph["soubor"]).is_absolute() else fdir / ph["soubor"]
        im = cv2.imread(str(f)) if f.exists() else None
        if im is None:
            warn(f"foto {ph['id']}: soubor chybí ({f})")
            continue
        host = [p for p in plan if p["a"] <= ph["src"] < p["b"]]
        if not host:
            warn(f"foto {ph['id']}: src {ph['src']} není ve střihu")
            continue
        h = host[0]
        photos.append({"id": ph["id"], "path": str(f), "w": im.shape[1], "h": im.shape[0], "tl0": round(h["tl0"] + (ph["src"] - h["a"]), 3),
                       "dur": ph.get("delka", 2.0), "mode": ph.get("rezim", "corner")})

    # hudba: plato na cílovou hlasitost
    hcfg = cfg.get("hudba") or {}
    music = [{"path": m["p"], "tl0": m["s"], "tl1": m["e"], "in": m["i"], "keys": m["k"], "name": m["n"]} for m in D["a2"]]
    for m in music:
        vals = [k[1] for k in m["keys"] if k[1] > -40]
        plateau = max(vals) if vals else -20
        target = next((r["db"] for r in hcfg.get("pravidla") or [] if r["obsahuje"] in m["name"]), hcfg.get("vychozi_db", -22))
        shift = target - plateau
        m["keys"] = [[k[0], (k[1] + shift) if k[1] > -40 else k[1]] for k in m["keys"]]
    jumps = sorted(set(jumps))

    # ripple po vystřižení zapečeného loga
    def R(t):
        r = t
        for a, b in DROPS:
            if t > a:
                r -= min(t, b) - a
        return round(r, 3)

    tot_drop = sum(b - a for a, b in DROPS)
    if DROPS:
        for it in plan:
            it["tl0"], it["tl1"] = R(it["tl0"]), R(it["tl1"])
        for g in gfx:
            g["tl0"], g["tl1"] = R(g["tl0"]), R(g["tl1"])
        for m in music:
            m["tl0"], m["tl1"] = R(m["tl0"]), R(m["tl1"])
            m["keys"] = [[R(k[0]), k[1]] for k in m["keys"]]
        for t in tags:
            t["tl0"] = R(t["tl0"])
        for c in chunks:
            c[0], c[1] = R(c[0]), R(c[1])
        for ph in photos:
            ph["tl0"] = R(ph["tl0"])
        jumps = [R(j) for j in jumps]
        plan = [p for p in plan if p["tl1"] - p["tl0"] > 0.04]
    out = {"fps": FPS, "dur": round(D["end"] - tot_drop, 3), "photos": photos, "cam": plan, "gfx": gfx, "music": music, "tags": tags,
           "caps": chunks, "jumps": jumps}
    f = data / "ae_plan.json"
    write_json(f, out)
    return {"aePlan": str(f), "duration": out["dur"], "removedLogoSec": round(tot_drop, 2), "captions": len(chunks), "photos": len(photos),
            "tags": {k: sum(1 for t in tags if t["kind"] == k) for k in ("person", "chapter", "cta", "marker")},
            "nameTags": [[t["text"], t["tl0"], t["dur"]] for t in tags if t["kind"] == "person"], "jumps": len(jumps),
            "farewellItems": nfw}


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--print":
        try:
            print(json.dumps(public_config(load_config(sys.argv[2])), ensure_ascii=False))
        except Exception as e:  # noqa: BLE001
            print(json.dumps({"error": str(e)}, ensure_ascii=False))

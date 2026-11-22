"""After Effects pro YouTuber verzi: sestavení (9:16 / 16:9), kontrolní snímky, render (aerender + ffmpeg), collect.

Spolehlivé spouštění AE 2026 (ověřené na 1. dílu Detail):
- skript se posílá do běžící instance přes  AfterFX.exe -s "$.evalFile(new File('…'))"  (-r je nespolehlivé),
- soubor .jsx MUSÍ mít UTF-8 BOM (jinak se s diakritikou tiše neprovede) – BOM se přidává až tady při spuštění,
- skript sám zavírá projekt bez uložení (jinak AE čeká na dialog „Save As“),
- výsledek se zjišťuje přes „done“ soubor, ne přes log (log bývá zamčený),
- mezitím se hlídají dialogy (Crash Repair Options, Chybové hlášení, chybová okna AE) a pád/zamrznutí procesu;
  po pádu se AE spustí znovu a skript se zopakuje.
"""
from __future__ import annotations

import ctypes
import glob
import json
import os
import re
import subprocess
import time
from ctypes import wintypes
from pathlib import Path

import numpy as np

from .common import ROOT, log, read_json, write_json
from .youtuber import NO_WINDOW, ConfigError, ensure_dirs, load_config

JSX = ROOT / "worker" / "jsx"
FORMATS = {
    "9x16": {"jsx": "yt_vertical.jsx", "comp": "VERTIKAL 9x16", "w": 1080, "h": 1920},
    "16x9": {"jsx": "yt_wide.jsx", "comp": "WIDE 16x9", "w": 1920, "h": 1080},
}


def _fmt(params):
    f = str(params.get("format") or "9x16").replace(":", "x").lower()
    if f in ("vertical", "svisle", "vertikal"):
        f = "9x16"
    if f in ("wide", "sirka", "siroka"):
        f = "16x9"
    if f not in FORMATS:
        raise ConfigError(f"Neznámý formát {params.get('format')} – 9x16 nebo 16x9")
    return f


# ------------------------------------------------------------------ AE proces a dialogy

def find_ae(cfg=None) -> Path:
    exe = ((cfg or {}).get("ae") or {}).get("exe")
    if exe and Path(exe).exists():
        return Path(exe)
    cands = sorted(glob.glob(r"C:\Program Files\Adobe\Adobe After Effects 20*\Support Files\AfterFX.exe"))
    if not cands:
        raise ConfigError("After Effects nenalezen (nastav ae.exe v configu)")
    return Path(cands[-1])


def _ae_pids():
    p = subprocess.run(["tasklist", "/FI", "IMAGENAME eq AfterFX.exe", "/FO", "CSV", "/NH"], capture_output=True, text=True,
                       creationflags=NO_WINDOW)
    return [int(m.group(1)) for m in re.finditer(r'"AfterFX\.exe","(\d+)"', p.stdout)]


def _ae_responding() -> bool | None:
    p = subprocess.run(["tasklist", "/FI", "IMAGENAME eq AfterFX.exe", "/FI", "STATUS eq NOT RESPONDING", "/FO", "CSV", "/NH"],
                       capture_output=True, text=True, creationflags=NO_WINDOW)
    if not _ae_pids():
        return None
    return "AfterFX.exe" not in p.stdout


def kill_ae():
    for pid in _ae_pids():
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, creationflags=NO_WINDOW)
    time.sleep(3)


if os.name == "nt":
    _u32 = ctypes.windll.user32
    _ENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _text(h):
        n = _u32.GetWindowTextLengthW(h)
        b = ctypes.create_unicode_buffer(n + 1)
        _u32.GetWindowTextW(h, b, n + 1)
        return b.value

    def _cls(h):
        b = ctypes.create_unicode_buffer(256)
        _u32.GetClassNameW(h, b, 256)
        return b.value

    def _pid(h):
        pid = wintypes.DWORD()
        _u32.GetWindowThreadProcessId(h, ctypes.byref(pid))
        return pid.value

    def _windows():
        out = []

        def cb(h, _):
            if _u32.IsWindowVisible(h):
                out.append(h)
            return True

        _u32.EnumWindows(_ENUM(cb), 0)
        return out

    def _children(h):
        out = []

        def cb(c, _):
            out.append(c)
            return True

        _u32.EnumChildWindows(h, _ENUM(cb), 0)
        return out
else:  # pragma: no cover
    def _windows():
        return []

CRASH_TITLES = ("crash repair", "chybové hlášení", "error report", "crash reporter", "adobe crash", "oprava po pádu")
PROGRESS_TITLES = ("executing script", "spouštění skriptu", "provádění skriptu", "rendering", "vykreslování")
OK_BUTTONS = ("continue", "pokračovat", "neodesílat", "don't send", "do not send", "nezasílat", "ok", "zavřít", "close")


def handle_dialogs() -> list[str]:
    """Zavře známé dialogy, které by zablokovaly AE (po pádu, chybová hlášení, modální okna AE). Vrací co udělal."""
    if os.name != "nt":
        return []
    acted = []
    ae = set(_ae_pids())
    BM_CLICK, WM_KEYDOWN, WM_KEYUP, VK_RETURN = 0x00F5, 0x0100, 0x0101, 0x0D
    for h in _windows():
        title, cls = _text(h), _cls(h)
        tl = title.lower()
        crash = any(t in tl for t in CRASH_TITLES)
        ae_modal = _pid(h) in ae and cls == "#32770"          # standardní dialog patřící AE (chybová hláška, varování)
        if not (crash or ae_modal) or any(t in tl for t in PROGRESS_TITLES):
            continue
        clicked = None
        for c in _children(h):
            if _cls(c).lower() == "button":
                bt = _text(c).replace("&", "").strip().lower()
                if bt in OK_BUTTONS:
                    _u32.SendMessageW(c, BM_CLICK, 0, 0)
                    clicked = bt
                    break
        if clicked is None:
            if not crash:
                continue  # neznámé okno AE bez tlačítka OK – nesahat (mohl by to být průběh nebo dotaz)
            # dialog po pádu bez Win32 tlačítek: výchozí tlačítko je Continue / Neodesílat → Enter
            _u32.PostMessageW(h, WM_KEYDOWN, VK_RETURN, 0)
            _u32.PostMessageW(h, WM_KEYUP, VK_RETURN, 0)
            clicked = "Enter"
        msg = f"dialog „{title}“ → {clicked}"
        log("AE: " + msg)
        acted.append(msg)
    return acted


def ensure_ae(cfg, ctx, timeout=240) -> list[str]:
    """Spustí AE, pokud neběží, a počká na hlavní okno (cestou zavírá dialogy po pádu)."""
    acted = []
    if _ae_pids() and _ae_responding():
        return acted
    if _ae_pids():  # běží, ale neodpovídá → nejdřív chvíli počkat (načítání), pak tvrdě ukončit
        for _ in range(20):
            acted += handle_dialogs()
            time.sleep(3)
            if _ae_responding():
                return acted
        kill_ae()
        acted.append("AE neodpovídalo – ukončeno")
    exe = find_ae(cfg)
    ctx.progress(0.02, "spouštím After Effects")
    subprocess.Popen([str(exe)], cwd=str(exe.parent), creationflags=0x00000008)  # DETACHED_PROCESS
    t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(3)
        acted += handle_dialogs()
        pids = set(_ae_pids())
        if pids and _ae_responding():
            mains = [h for h in _windows() if _pid(h) in pids and "after effects" in _text(h).lower()]
            if mains:
                time.sleep(8)  # dokončení načítání panelů
                acted += handle_dialogs()
                return acted
    raise RuntimeError("After Effects se nespustil do %d s" % timeout)


def _aerender_running() -> bool:
    p = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, creationflags=NO_WINDOW)
    return bool(re.search(r'"(aerender\.exe|AfterFX\.com)"', p.stdout, re.I))


def _open_project_title() -> str:
    pids = set(_ae_pids())
    for h in _windows():
        t = _text(h)
        if _pid(h) in pids and t.lower().startswith("adobe after effects"):
            return t
    return ""


def wait_ae_free(cfg, ctx, max_wait=3600):
    """AE je sdílené (jiná relace, ruční práce): skript zavírá otevřený projekt, takže
    - během cizího renderu (aerender / AfterFX.com) čeká – příkaz -s by se mohl dostat do renderovací instance,
    - neuložený projekt mimo pracovní složku dílu odmítne zavřít."""
    t0 = time.time()
    while _aerender_running():
        if time.time() - t0 > max_wait:
            raise RuntimeError("AE je obsazené renderem (aerender) déle než %d min" % (max_wait // 60))
        ctx.progress(0.03, f"čekám, až doběhne jiný render v AE ({int(time.time() - t0)} s)")
        time.sleep(10)
    title = _open_project_title()
    work = str(cfg["_dirs"]["work"]).lower()
    if title.rstrip().endswith("*") and work not in title.lower():
        raise RuntimeError(f"V After Effects je otevřený neuložený projekt ({title}). Ulož ho nebo zavři – skript by ho zavřel bez uložení.")
    return title


def run_jsx(cfg, ctx, template: str, job: dict, done_file: Path, timeout: float, label: str, retries: int = 2) -> dict:
    """Pošle skript do AE a čeká na done soubor; hlídá dialogy, pád a zamrznutí, po pádu restart a nový pokus."""
    ae_dir = cfg["_dirs"]["ae"]
    job_file = ae_dir / f"_job_{label}.json"
    write_json(job_file, job)
    body = (JSX / template).read_text(encoding="utf-8").lstrip("\ufeff")
    head = "var YT_JOB = %s;\n" % json.dumps(str(job_file).replace("\\", "/"))
    run_file = ae_dir / f"_run_{label}.jsx"
    run_file.write_text("\ufeff" + head + body, encoding="utf-8")  # BOM nutný (AE jinak skript s diakritikou tiše přeskočí)
    exe = find_ae(cfg)
    acted, attempts = [], 0
    while True:
        attempts += 1
        try:
            done_file.unlink()
        except OSError:
            pass
        prev = wait_ae_free(cfg, ctx)
        if prev and attempts == 1:
            log(f"AE: zavírám otevřený projekt ({prev})")
        acted += ensure_ae(cfg, ctx)
        p = str(run_file).replace("\\", "/").replace("'", "\\'")
        subprocess.Popen([str(exe), "-s", f"$.evalFile(new File('{p}'))"], cwd=str(exe.parent), creationflags=NO_WINDOW)
        t0, hung_since, crashed = time.time(), None, False
        while True:
            time.sleep(2)
            if done_file.exists():
                time.sleep(0.5)
                res = done_file.read_text(encoding="utf-8", errors="replace").strip()
                return {"result": res, "attempts": attempts, "dialogs": acted, "sec": round(time.time() - t0, 1)}
            acted += handle_dialogs()
            r = _ae_responding()
            if r is None:
                crashed = True
                acted.append("AE spadlo")
                break
            if r is False:
                hung_since = hung_since or time.time()
                if time.time() - hung_since > max(180, timeout / 3):
                    acted.append("AE zamrzlo – restart")
                    kill_ae()
                    crashed = True
                    break
            else:
                hung_since = None
            if time.time() - t0 > timeout:
                acted.append(f"limit {int(timeout)} s vypršel – restart AE")
                kill_ae()
                crashed = True
                break
            started = bool(job.get("log")) and Path(job["log"]).exists() and Path(job["log"]).stat().st_mtime >= t0 - 5
            ctx.progress(min(0.9, 0.1 + 0.8 * (time.time() - t0) / timeout),
                         f"AE {label} běží {int(time.time() - t0)} s" + ("" if started else " (skript zatím nezačal – AE je zaneprázdněné?)"))
        if crashed and attempts <= retries:
            time.sleep(5)
            continue
        raise RuntimeError(f"AE skript {label} nedoběhl ({'; '.join(acted[-4:])})")


# ------------------------------------------------------------------ sestavení

def _fonts_ok(name="organica") -> bool:
    dirs = [Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts", Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Windows" / "Fonts"]
    return any(name in f.name.lower() for d in dirs if d.exists() for f in d.iterdir())


def build(params: dict, ctx) -> dict:
    cfg = load_config(params["config"])
    ensure_dirs(cfg)
    fmt = _fmt(params)
    F = FORMATS[fmt]
    D = cfg["_dirs"]
    plan = D["data"] / "ae_plan.json"
    if not plan.exists():
        raise ConfigError(f"Chybí {plan} – nejdřív yt_plan.")
    vyb = cfg["_vyb"]
    vy = cfg.get("vybava") or {}
    zn = cfg.get("znelka") or {}
    name = cfg["cil"].get("nazev", "YT")
    out_aep = D["ae"] / f"{name}_{fmt}.aep"
    warnings = []
    job = {
        "plan": str(plan), "outAep": str(out_aep), "source": cfg["zdroj"],
        "log": str(D["ae"] / f"build_{fmt}_log.txt"), "done": str(D["ae"] / f"build_{fmt}_done.txt"),
        "importProjects": [vyb(p) for p in vy.get("ae_projekty") or []],
        "navyFrom": vy.get("navy_z"), "gfxVertical": vy.get("grafika_svisle") or {},
        "jingle": {"match": zn.get("nahradit", ""), "vertical": vyb(zn.get("svisle")), "wide": vyb(zn.get("sirka"))} if zn.get("nahradit") else None,
        "whoosh": vyb(vy.get("svist")), "whooshDb": (cfg.get("hudba") or {}).get("svist_db", -21),
        "watermark": vyb(vy.get("vodoznak")), "font": (cfg.get("styl") or {}).get("pismo", "OrganicaM-Bold"),
    }
    for k in ("source", "whoosh", "watermark"):
        if job[k] and not Path(job[k]).exists():
            warnings.append(f"{k}: soubor neexistuje {job[k]}")
    for p in job["importProjects"]:
        if not Path(p).exists():
            warnings.append(f"AE projekt výbavy neexistuje: {p}")
    if job["jingle"]:
        jf = job["jingle"]["vertical" if fmt == "9x16" else "wide"]
        if not jf or not Path(jf).exists():
            warnings.append(f"znělka pro {fmt} neexistuje: {jf}")
    if not _fonts_ok():
        warnings.append("Písmo Organica není nainstalované – AE ho nahradí")
    r = run_jsx(cfg, ctx, F["jsx"], job, Path(job["done"]), timeout=params.get("timeoutSec", 1500), label=f"build_{fmt}")
    logtxt = Path(job["log"]).read_text(encoding="utf-8", errors="replace") if Path(job["log"]).exists() else ""
    errs = [l for l in logtxt.splitlines() if l.startswith("CHYBA") or l.startswith("FATAL")]
    if not r["result"].startswith("HOTOVO"):
        raise RuntimeError(f"Sestavení {fmt} selhalo: {r['result']} | {' | '.join(errs[:5])}")
    last = [l for l in logtxt.splitlines() if l.startswith("HOTOVO")]
    return {"aep": str(out_aep), "comp": F["comp"], "result": last[-1] if last else r["result"], "errors": errs[:15],
            "warnings": warnings, "dialogs": r["dialogs"], "attempts": r["attempts"], "sec": r["sec"], "log": job["log"]}


# ------------------------------------------------------------------ kontrolní snímky

def _default_times(cfg, n=24):
    P = read_json(cfg["_dirs"]["data"] / "ae_plan.json")
    dur = P["dur"]
    ts = [round(dur * (k + 0.5) / n, 2) for k in range(n)]
    ts += [round(t["tl0"] + min(1.0, t.get("dur", 2) / 2), 2) for t in P["tags"] if t.get("kind") == "person"]
    ts += [round(p["tl0"] + min(0.8, p["dur"] / 2), 2) for p in P["photos"]][:8]
    return sorted(set(ts))[:40]


def _label(im, txt):
    import cv2

    cv2.rectangle(im, (0, 0), (min(im.shape[1], 12 + 11 * len(txt)), 26), (0, 0, 0), -1)
    cv2.putText(im, txt, (5, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
    return im


def _sheet(tiles, cols, out: Path):
    import cv2

    h, w = tiles[0].shape[:2]
    rows = (len(tiles) + cols - 1) // cols
    S = np.full((rows * (h + 6), cols * (w + 6), 3), 40, np.uint8)
    for k, t in enumerate(tiles):
        r, c = divmod(k, cols)
        S[r * (h + 6): r * (h + 6) + h, c * (w + 6): c * (w + 6) + w] = cv2.resize(t, (w, h))
    cv2.imwrite(str(out), S, [cv2.IMWRITE_JPEG_QUALITY, 86])


def _vframe(video, t, w, h):
    import cv2

    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", "%.3f" % t, "-i", video, "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "image2pipe",
                        "-vcodec", "bmp", "-"], capture_output=True, creationflags=NO_WINDOW)
    im = cv2.imdecode(np.frombuffer(p.stdout, np.uint8), 1) if p.stdout else None
    return im if im is not None else np.zeros((h, w, 3), np.uint8)


def stills(params: dict, ctx) -> dict:
    """Přehled snímků: z AE projektu (před renderem) nebo z hotového videa; s reference = dvojice nový | referenční."""
    import cv2

    cfg = load_config(params["config"])
    ensure_dirs(cfg)
    fmt = _fmt(params)
    F = FORMATS[fmt]
    times = params.get("times") or _default_times(cfg)
    out_dir = cfg["_dirs"]["stills"] / fmt
    out_dir.mkdir(parents=True, exist_ok=True)
    tw, th = (270, 480) if fmt == "9x16" else (480, 270)
    per_page = 24 if not params.get("reference") else 16
    tiles, info = [], {}
    if params.get("video") or params.get("reference"):
        vid = params.get("video")
        ref = params.get("reference")
        for k, t in enumerate(times):
            ctx.progress(0.05 + 0.9 * k / len(times), f"snímek {k + 1}/{len(times)}")
            if vid:
                tiles.append(_label(_vframe(vid, t, tw, th), "%.1f s%s" % (t, " nove" if ref else "")))
            if ref:
                tiles.append(_label(_vframe(ref, t, tw, th), "%.1f s ref" % t))
        info["source"] = "video"
    else:
        aep = Path(params.get("aep") or cfg["_dirs"]["ae"] / f"{cfg['cil'].get('nazev', 'YT')}_{fmt}.aep")
        if not aep.exists():
            raise ConfigError(f"AE projekt neexistuje: {aep} – nejdřív yt_build_ae")
        for f in out_dir.glob("still_*.png"):
            f.unlink()
        job = {"aep": str(aep), "comp": F["comp"], "times": times, "dir": str(out_dir).replace("\\", "/"),
               "log": str(cfg["_dirs"]["ae"] / f"stills_{fmt}_log.txt"), "done": str(cfg["_dirs"]["ae"] / f"stills_{fmt}_done.txt")}
        r = run_jsx(cfg, ctx, "yt_stills.jsx", job, Path(job["done"]), timeout=params.get("timeoutSec", 900), label=f"stills_{fmt}")
        if not r["result"].startswith("HOTOVO"):
            raise RuntimeError(f"Snímky z AE selhaly: {r['result']}")
        # saveFrameToPng zapisuje se zpožděním – počkat na soubory
        for _ in range(60):
            if len(list(out_dir.glob("still_*.png"))) >= len(times):
                break
            time.sleep(1)
        time.sleep(1)
        for k, t in enumerate(times):
            im = cv2.imread(str(out_dir / f"still_{k}.png"))
            tiles.append(_label(cv2.resize(im, (tw, th)) if im is not None else np.zeros((th, tw, 3), np.uint8), "%.1f s" % t))
        info.update(source="ae", dialogs=r["dialogs"])
    sheets = []
    cols = 8 if fmt == "9x16" else 4
    for i in range(0, len(tiles), per_page):
        f = out_dir / f"prehled_{len(sheets) + 1}.jpg"
        _sheet(tiles[i:i + per_page], cols, f)
        sheets.append(str(f))
    return {"sheets": sheets, "times": times, **info}


# ------------------------------------------------------------------ render

def _loudness(f):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True,
                       text=True, encoding="utf-8", errors="replace", creationflags=NO_WINDOW)
    s = p.stderr[p.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s*(-?[\d.]+) LUFS", s)
    tp = re.search(r"Peak:\s*(-?[\d.]+) dBFS", s)
    return (float(i.group(1)) if i else None), (float(tp.group(1)) if tp else None)


def render(params: dict, ctx) -> dict:
    cfg = load_config(params["config"])
    ensure_dirs(cfg)
    fmt = _fmt(params)
    F = FORMATS[fmt]
    rc = cfg.get("render") or {}
    name = cfg["cil"].get("nazev", "YT")
    aep = Path(params.get("aep") or cfg["_dirs"]["ae"] / f"{name}_{fmt}.aep")
    if not aep.exists():
        raise ConfigError(f"AE projekt neexistuje: {aep} – nejdřív yt_build_ae")
    work = cfg["_dirs"]["work"]
    raw = work / f"{name}_{fmt}_aerender.mp4"
    final = Path(params.get("output") or work / f"{name}_{fmt}.mp4")
    aer = find_ae(cfg).parent / "aerender.exe"
    logf = cfg["_dirs"]["ae"] / f"render_{fmt}_log.txt"
    for f in (raw,):
        try:
            f.unlink()
        except OSError:
            pass
    cmd = [str(aer), "-project", str(aep), "-comp", F["comp"], "-output", str(raw),
           "-RStemplate", rc.get("rs_sablona", "Best Settings"), "-OMtemplate", rc.get("om_sablona", "H.264 - Match Render Settings - 15 Mbps")]
    P = read_json(cfg["_dirs"]["data"] / "ae_plan.json")
    dur = P["dur"]
    tw = time.time()
    while _aerender_running():  # dva rendery naráz si berou paměť (jeden AfterFX.com má i 40 GB)
        ctx.progress(0.005, f"čekám, až doběhne jiný render ({int(time.time() - tw)} s)")
        time.sleep(10)
    t0 = time.time()
    ctx.progress(0.01, "aerender start")
    with open(logf, "w", encoding="utf-8", errors="replace") as lf:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                creationflags=NO_WINDOW)
        for line in proc.stdout:
            lf.write(line)
            m = re.search(r"PROGRESS:\s+(\d+):(\d+):(\d+):(\d+)\s+\(\d+\)", line)
            if m:
                sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) + int(m.group(4)) / 25
                try:
                    ctx.progress(min(0.92, sec / dur * 0.92), f"render {fmt} {sec:.0f}/{dur:.0f} s")
                except Exception:
                    proc.kill()
                    raise
            if len(handle_dialogs()):
                lf.write("[dialog zavřen]\n")
        proc.wait()
    rsec = round(time.time() - t0)
    if not raw.exists() or raw.stat().st_size < 100000:
        tail = Path(logf).read_text(encoding="utf-8", errors="replace")[-1500:]
        raise RuntimeError(f"aerender nevytvořil video (kód {proc.returncode}). Konec logu: {tail}")
    ctx.progress(0.94, "zvuk: přebalení a hlasitost")
    vol = rc.get("zvuk_db", -1)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-c:v", "copy", "-af", f"volume={vol}dB", "-c:a", "aac", "-b:a", "256k",
                    "-movflags", "+faststart", str(final)], check=True, creationflags=NO_WINDOW)
    raw.unlink()
    lufs, tp = _loudness(str(final))
    target = rc.get("cil_lufs", -14)
    note = []
    if lufs is not None and abs(lufs - target) > 2:
        note.append(f"hlasitost {lufs} LUFS je daleko od cíle {target} – uprav render.zvuk_db")
    if tp is not None and tp > -0.5:
        note.append(f"špička {tp} dBFS nad −0,5 – sniž render.zvuk_db")
    return {"file": str(final), "sizeMB": round(final.stat().st_size / 1048576), "renderSec": rsec, "lufs": lufs, "truePeak": tp,
            "notes": note, "log": str(logf)}


# ------------------------------------------------------------------ collect

def collect(params: dict, ctx) -> dict:
    cfg = load_config(params["config"])
    ensure_dirs(cfg)
    fmt = _fmt(params)
    F = FORMATS[fmt]
    name = cfg["cil"].get("nazev", "YT")
    aep = Path(params.get("aep") or cfg["_dirs"]["ae"] / f"{name}_{fmt}.aep")
    dst_dir = Path(params.get("dir") or cfg["_dirs"]["work"] / "AE_projekt")
    dst_dir.mkdir(parents=True, exist_ok=True)
    job = {"src": str(aep), "comp": F["comp"], "footage": str(dst_dir / "Footage"), "dst": str(dst_dir / f"{name}_{fmt}.aep"),
           "log": str(cfg["_dirs"]["ae"] / f"collect_{fmt}_log.txt"), "done": str(cfg["_dirs"]["ae"] / f"collect_{fmt}_done.txt")}
    r = run_jsx(cfg, ctx, "yt_collect.jsx", job, Path(job["done"]), timeout=params.get("timeoutSec", 3600), label=f"collect_{fmt}")
    if not r["result"].startswith("HOTOVO"):
        raise RuntimeError(f"Collect selhal: {r['result']}")
    return {"aep": job["dst"], "footage": job["footage"], "result": r["result"], "dialogs": r["dialogs"]}

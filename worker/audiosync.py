"""Synchronizace kamer a mikrofonů podle zvuku (křížová korelace obálky nástupů, FFT)."""
from __future__ import annotations

import os

from .common import cache_file, write_json, read_json

SR = 16000
HOP = 80  # 5 ms


def _onset_envelope(x):
    import numpy as np

    n = len(x) // HOP
    frames = x[: n * HOP].astype("float32").reshape(n, HOP)
    e = np.log1p(np.sqrt(np.mean(frames * frames, axis=1)) * 100.0)
    d = np.diff(e, prepend=e[:1])
    d[d < 0] = 0
    return (d - d.mean()) / (d.std() + 1e-9)


def _energy_envelope(x):
    import numpy as np

    n = len(x) // HOP
    frames = x[: n * HOP].astype("float32").reshape(n, HOP)
    return np.sqrt(np.mean(frames * frames, axis=1))


def _has_audio(path: str) -> bool:
    import av

    with av.open(path) as c:
        return len(c.streams.audio) > 0


def _offset(ref_env, other_env, max_lag: int):
    """Vrátí (lag v hopech, jistota). lag = čas reference, kdy začíná 'other'."""
    import numpy as np

    n = 1
    while n < len(ref_env) + len(other_env):
        n *= 2
    corr = np.fft.irfft(np.fft.rfft(ref_env, n) * np.conj(np.fft.rfft(other_env, n)), n)
    lags = np.arange(n)
    lags[lags >= n // 2] -= n
    mask = np.abs(lags) <= max_lag
    cand = np.where(mask, corr, -np.inf)
    k = int(np.argmax(cand))
    peak = cand[k]
    guard = int(0.5 * SR / HOP)
    excl = cand.copy()
    idx = np.arange(n)
    near = np.minimum(np.abs(idx - k), n - np.abs(idx - k)) <= guard
    excl[near] = -np.inf
    second = np.max(excl)
    confidence = float(peak / second) if second > 0 else float("inf")
    return int(lags[k]), confidence


def sync(params: dict, ctx) -> dict:
    from faster_whisper import decode_audio

    ref = params["reference"]
    others = params["others"]
    max_offset = float(params.get("maxOffset", 600))
    for p in [ref, *others]:
        if not os.path.exists(p):
            raise FileNotFoundError(f"Soubor neexistuje: {p}")
        if not _has_audio(p):
            raise ValueError(f"Soubor nemá zvukovou stopu, nelze synchronizovat podle zvuku: {p}")
    out = cache_file("sync", ref, {"others": sorted(others), "max": max_offset})
    if out.exists() and not params.get("force"):
        return read_json(out)

    ctx.progress(0.02, "načítám referenční zvuk")
    ref_env = _onset_envelope(decode_audio(ref, sampling_rate=SR))
    results = []
    for i, p in enumerate(others):
        ctx.check()
        ctx.progress(0.1 + 0.85 * i / len(others), f"synchronizuji {os.path.basename(p)}")
        env = _onset_envelope(decode_audio(p, sampling_rate=SR))
        lag, conf = _offset(ref_env, env, int(max_offset * SR / HOP))
        results.append({
            "path": os.path.abspath(p),
            "offset": round(lag * HOP / SR, 3),
            "confidence": round(conf, 2),
            "reliable": conf >= 1.5,
            "duration": round(len(env) * HOP / SR, 2),
        })
    data = {"reference": os.path.abspath(ref), "note": "offset = čas v referenci, kdy soubor začíná", "results": results}
    write_json(out, data)
    return data


_PAUSE_CACHE: dict = {}


def boundary_pauses(path: str, pairs: list[tuple[float, float]]) -> list[bool] | None:
    """Je mezi koncem jedné věty a začátkem další skutečné ticho (≥ 40 ms pod prahem šumu z okolí ±1,5 s)?
    Mezera v časech Whisperu ticho nezaručuje – lidé mluví přes sebe, konce slov jsou v přepisu pozdě
    (Talk: „zlomilo?“ → „Jo“ 0,14 s mezera, ve zvuku souvislá řeč). None = zvuk nejde přečíst."""
    import numpy as np

    try:
        key = (os.path.abspath(path), os.path.getmtime(path))
        env = _PAUSE_CACHE.get(key)
        if env is None:
            from faster_whisper import decode_audio
            env = _energy_envelope(decode_audio(path, sampling_rate=SR))
            _PAUSE_CACHE.clear()
            _PAUSE_CACHE[key] = env
    except Exception:  # noqa: BLE001 – bez zvuku se rozhoduje podle časů slov
        return None
    fs = HOP / SR
    db = 20 * np.log10(np.maximum(env, 1e-7))
    out = []
    for a, b in pairs:
        c0, c1 = max(0, int((min(a, b) - 1.5) / fs)), min(len(env), int((max(a, b) + 1.5) / fs))
        if c1 - c0 < 20:
            out.append(False)
            continue
        floor_db, peak_db = np.percentile(db[c0:c1], 10), np.percentile(db[c0:c1], 95)
        thr = floor_db + 0.25 * max(0.0, peak_db - floor_db)
        s0, s1 = max(0, int((min(a, b) - 0.08) / fs)), min(len(env), int((max(a, b) + 0.08) / fs) + 1)
        quiet = db[s0:s1] < thr
        run = best = 0
        for q in quiet:
            run = run + 1 if q else 0
            best = max(best, run)
        out.append(best >= 8)
    return out


def edge_levels(params: dict, ctx) -> dict:
    """Hlasitost těsně u hranic střihu proti řeči v okolí (dB): [{t, kind: in|out}] -> [{t, kind, rel}].
    rel kolem -25 dB a níž = ticho/nádech, nad -12 dB = střih skrz zvuk (useknuté slovo). Stejné měření jako
    scripts/check-cuts.mjs, aby stavba sama hlásila podezřelé hranice."""
    import numpy as np
    from faster_whisper import decode_audio

    path = params["path"]
    if not os.path.exists(path) or not _has_audio(path):
        return {"edges": []}
    audio = decode_audio(path, sampling_rate=SR)

    def rms(a: float, b: float) -> float:
        seg = audio[max(0, int(a * SR)): max(0, int(b * SR))]
        return float(np.sqrt(np.mean(seg.astype("float64") ** 2))) if len(seg) else 0.0

    out = []
    for e in params.get("edges", []):
        t = float(e["t"])
        edge = rms(t, t + 0.012) if e.get("kind") == "in" else rms(t - 0.012, t)
        wins = [rms(x, x + 0.025) for x in np.arange(t - 2.0, t + 2.0, 0.025)]
        speech = float(np.percentile(wins, 90)) if wins else 0.0
        rel = 20 * np.log10(max(edge, 1e-7)) - 20 * np.log10(max(speech, 1e-7))
        out.append({"t": round(t, 3), "kind": e.get("kind"), "rel": round(float(rel), 1)})
    return {"edges": out}


def refine_edges(params: dict, ctx) -> dict:
    """Doladí konce/začátky střihů podle skutečné energie zvuku, ne jen podle časů slov z Whisperu
    (ty mívají u krátkých/tichých hlásek na konci věty systematickou nepřesnost). Pro každý požadovaný
    bod najde v okolí buď konec řeči (hledá dopředu od 'at', kde energie klesne pod práh ticha), nebo
    začátek (hledá zpátky). Nikdy neposune přes 'maxExtend' a nikdy 'proti' směru hledání (jen prodlužuje)."""
    import numpy as np
    from faster_whisper import decode_audio

    path = params["path"]
    points = params["points"]  # [{at, direction: "end"|"start", maxExtend}]
    if not os.path.exists(path):
        raise FileNotFoundError(f"Soubor neexistuje: {path}")
    if not _has_audio(path):
        raise ValueError(f"Soubor nemá zvukovou stopu: {path}")

    audio = decode_audio(path, sampling_rate=SR)
    total = len(audio) / SR
    frame_s = HOP / SR
    min_run = 3  # ticho = aspoň 3 rámce po 5 ms pod prahem (krátký pokles uvnitř slova ticho není)
    out = []
    for pt in points:
        at = float(pt["at"])
        direction = pt.get("direction", "end")
        max_extend = max(0.0, float(pt.get("maxExtend", 0.4)))
        # Práh ticha z širšího okolí (±1,5 s): šum pozadí (10. percentil) a řeč (95. percentil) v dB, ticho = pod
        # čtvrtinou rozsahu nad šumem. Dřív se práh bral z úzkého okna kolem hranice – když bylo celé v řeči,
        # „šum“ vyšel vysoko a hledání se zastavilo na prvním poklesu uvnitř slova (Talk 2026-11-20: začátek
        # „Rozhodně“ o 360 ms dřív, než říkal Whisper, střih ho usekl).
        clo, chi = max(0.0, at - max_extend - 1.5), min(total, at + max_extend + 1.5)
        ctx_env = _energy_envelope(audio[int(clo * SR): int(chi * SR)])
        if len(ctx_env) < 10:
            out.append({"at": at, "time": round(at, 3)})
            continue
        db = 20 * np.log10(np.maximum(ctx_env, 1e-7))
        floor_db, peak_db = float(np.percentile(db, 10)), float(np.percentile(db, 95))
        thr = 10 ** ((floor_db + 0.25 * max(0.0, peak_db - floor_db)) / 20)
        quiet = ctx_env < thr
        at_idx = min(len(ctx_env) - 1, max(0, round((at - clo) / frame_s)))
        limit = round(max_extend / frame_s)
        step = 1 if direction == "end" else -1
        refined, clean = None, False
        run = 0
        for k in range(0, limit + 1):
            i = at_idx + step * k
            if i < 0 or i >= len(ctx_env):
                break
            run = run + 1 if quiet[i] else 0
            if run >= min_run:
                # hranice = začátek tichého úseku (u konce) / jeho konec u začátku, tj. těsně u zvuku + 30 ms rezervy (tichý náběh souhlásky)
                edge = i - step * (min_run - 1)
                refined = clo + edge * frame_s + (0.03 if direction == "end" else -0.03)
                clean = True
                break
        if refined is None:
            # čisté ticho v dosahu není (plynulá řeč, ruch v pozadí) – střih do nejtiššího místa v dosahu; dřív šel na
            # okraj povoleného rozsahu, a ten padl i do náběhu dalšího slova (Talk A 280,17 s: „Mě“ useknuté)
            # bez čistého ticha jen v bezpečném rozsahu (fallbackExtend) – přesah za Whisperův konec předchozího slova
            # má smysl jen tehdy, když tam opravdu je ticho; jinak by střih padl do dozvuku slova (Talk B „práce.“)
            fb = round(min(max_extend, float(pt.get("fallbackExtend", max_extend))) / frame_s)
            idxs = [at_idx + step * k for k in range(0, fb + 1) if 0 <= at_idx + step * k < len(ctx_env)]
            if idxs:
                q = min(idxs, key=lambda i: ctx_env[i])
                refined = clo + q * frame_s + (frame_s if direction == "end" else 0.0)
            else:
                refined = at
        refined = min(max(refined, at), at + max_extend) if direction == "end" else max(min(refined, at), at - max_extend)
        out.append({"at": at, "time": round(refined, 3), "clean": clean})
    return {"points": out}

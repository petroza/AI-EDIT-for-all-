"""Hlasitost na hranicích střihu (pomocník pro scripts/check-cuts.mjs).
stdin: {"path": soubor, "edges": [{"t": čas ve zdroji, "kind": "in"|"out"}]}
stdout: [{"t", "kind", "edgeDb", "speechDb", "rel"}] – rel = hlasitost 25 ms u hranice (uvnitř klipu)
proti hlasitosti řeči v okolí (dB). Kolem -25 dB a níž = ticho/nádech, nad -12 dB = střih skrz zvuk."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from worker.common import add_nvidia_dll_dirs  # noqa: E402

add_nvidia_dll_dirs()
import numpy as np  # noqa: E402
from faster_whisper import decode_audio  # noqa: E402

SR = 16000
req = json.load(sys.stdin)
audio = decode_audio(req["path"], sampling_rate=SR)


def rms(a: float, b: float) -> float:
    seg = audio[max(0, int(a * SR)): max(0, int(b * SR))]
    return float(np.sqrt(np.mean(seg.astype("float64") ** 2))) if len(seg) else 0.0


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-7))


out = []
for e in req["edges"]:
    t = float(e["t"])
    W = 0.025
    E = 0.012  # hranice samotná: prvních/posledních 12 ms klipu (delší okno zachytí náběh slova těsně za střihem)
    edge = rms(t, t + E) if e["kind"] == "in" else rms(t - E, t)
    # úroveň řeči: 90. percentil 25ms oken v ±2 s
    wins = [rms(x, x + W) for x in np.arange(t - 2.0, t + 2.0, W)]
    speech = float(np.percentile(wins, 90)) if wins else 0.0
    out.append({"t": round(t, 3), "kind": e["kind"], "edgeDb": round(db(edge), 1),
                "speechDb": round(db(speech), 1), "rel": round(db(edge) - db(speech), 1)})
print(json.dumps(out))

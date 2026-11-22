# Lokální kontrola krajů (test/edges.js): přepíše krátké wav úseky faster-whisperem large-v3 se slovy a časy.
#   python test/edges_asr.py <seznam.json>   (seznam = ["a.wav", ...]) → JSON na stdout: [{file, words:[{w,s,e,p}]}]
import json, os, site, sys
from pathlib import Path

# cuBLAS/cuDNN z pip balíčků nvidia-* nejsou v PATH (stejně jako worker MY Premiere MCP)
if os.name == "nt":
    for root in list(site.getsitepackages()) + [site.getusersitepackages()]:
        for b in (Path(root) / "nvidia").glob("*/bin"):
            try:
                os.add_dll_directory(str(b))
            except OSError:
                pass
            os.environ["PATH"] = str(b) + os.pathsep + os.environ.get("PATH", "")
from faster_whisper import WhisperModel

files = json.load(open(sys.argv[1], encoding="utf8"))
try:
    model = WhisperModel("large-v3", device="cuda", compute_type="float16")
except Exception:
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
out = []
for f in files:
    segs, _ = model.transcribe(f, language="cs", word_timestamps=True, beam_size=5, vad_filter=False,
                               condition_on_previous_text=False)
    words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 2)}
             for s in segs for w in (s.words or [])]
    out.append({"file": f, "words": words})
sys.stdout.reconfigure(encoding="utf8")
print(json.dumps(out, ensure_ascii=False))

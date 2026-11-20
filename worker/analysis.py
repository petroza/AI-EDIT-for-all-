"""Porozumění dialogu: deterministická analýza (opakované pokusy, vata, nedokončené věty)
+ lokální LLM (gemma3 přes llama.cpp) pro kapitoly a plán střihu. Bez Ollamy a bez cloudu."""
from __future__ import annotations

import json
import os
import re
import time
import unicodedata
from difflib import SequenceMatcher

from . import audiosync, gpu
from .common import CONFIG, cache_file, index_get, index_set, log, read_json, write_json

FILLERS = {"ehm", "eh", "eee", "ee", "e", "hm", "hmm", "mhm", "ehh", "em", "emm"}
SOFT_FILLERS = {"jako", "vlastne", "proste", "takze", "no", "jo", "teda", "tak", "tady"}


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w\s]", " ", t)


def _words(text: str) -> list[str]:
    return _norm(text).split()


def load_transcript(path: str) -> tuple[dict, str]:
    f = index_get("transcripts", path)
    if not f:
        raise RuntimeError(f"Pro {path} neexistuje přepis – nejdřív transcribe.")
    return read_json(f), str(f)


def heuristics(segs: list[dict]) -> dict[int, list[str]]:
    flags: dict[int, list[str]] = {}

    def add(i, reason):
        flags.setdefault(i, [])
        if reason not in flags[i]:
            flags[i].append(reason)

    for i, s in enumerate(segs):
        ws = _words(s["text"])
        if not ws:
            add(s["id"], "prázdné")
            continue
        hard = sum(1 for w in ws if w in FILLERS)
        soft = sum(1 for w in ws if w in SOFT_FILLERS)
        if hard / len(ws) > 0.25 or (len(ws) <= 3 and (hard + soft) == len(ws)):
            add(s["id"], "vata")
        # opakovaný pokus: podobný začátek věty v následujících 45 s -> ponech pozdější verzi
        for j in range(i + 1, min(i + 4, len(segs))):
            t = segs[j]
            if t["start"] - s["end"] > 45:
                break
            wt = _words(t["text"])
            n = min(len(ws), len(wt), 8)
            if n >= 3 and SequenceMatcher(None, ws[:n], wt[:n]).ratio() >= 0.7:
                add(s["id"], f"opakovaný pokus (lepší #{t['id']})")
                break
        nxt = segs[i + 1] if i + 1 < len(segs) else None
        if not s["text"].rstrip().endswith((".", "!", "?", "…")) and nxt and nxt["start"] - s["end"] > 1.2:
            add(s["id"], "nedokončená věta")
    return flags


def _moderator_speakers(segs: dict[int, dict]) -> set[str]:
    """Kdo je moderátor: podle jména, jinak ten, kdo mluví nejmíň a nejčastěji se ptá."""
    stats: dict[str, dict] = {}
    for s in segs.values():
        sp = s.get("speaker")
        if not sp:
            continue
        d = stats.setdefault(sp, {"n": 0, "q": 0, "dur": 0.0})
        d["n"] += 1
        d["dur"] += s["end"] - s["start"]
        if s["text"].rstrip().endswith("?"):
            d["q"] += 1
    named = {sp for sp in stats if re.search(r"moder|reportér|reporter|redaktor|hlasatel|host(itel)?ka?\b", sp, re.I)}
    if named or len(stats) < 3:
        return named
    quiet = min(stats, key=lambda k: stats[k]["dur"])
    return {quiet} if stats[quiet]["q"] / max(1, stats[quiet]["n"]) >= 0.2 else set()


def _speakers_named(instruction: str, speakers: set[str]) -> set[str]:
    """Mluvčí, na které zadání výslovně omezuje ("jen Vašíř", "co říká vypravěč", "výroky Ferancové").
    Automatické značky S1, S2… se nehledají; jméno podle kmene (bez posledních 2 písmen), víceslovné podle prvního slova."""
    ins = _norm(instruction)
    cue = r"(jen|pouze|vyhradne|rika|rikaji|rekl|rekla|vyrok\w*|slova|promluv\w*|mluvi)"
    out = set()
    for sp in speakers:
        if re.fullmatch(r"S\d+", sp or ""):
            continue
        first = _norm(sp).split()
        if not first:
            continue
        w = first[0]
        stem = w[: max(4, len(w) - 2)] if len(w) > 4 else w
        if re.search(rf"\b{cue}\W+(\w+\W+){{0,3}}{re.escape(stem)}\w*", ins):
            out.add(sp)
    return out


_LANG_NAMES = {"cs": "češtiny", "sk": "slovenštiny", "en": "angličtiny", "de": "němčiny", "pl": "polštiny",
               "uk": "ukrajinštiny", "ru": "ruštiny", "fr": "francouzštiny", "es": "španělštiny"}


def translate(params: dict, ctx) -> dict:
    """Překlad krátkých textů (titulky) lokálním modelem. Po dávkách s číslováním a kontextem předchozích titulků;
    počet výstupů hlídá gramatika (minItems = maxItems), takže se titulky nerozjedou s časy."""
    texts = [str(t) for t in params["texts"]]
    maxlen = params.get("maxLen") if len(params.get("maxLen") or []) == len(texts) else None
    target = params.get("target") or "cs"
    backend = params.get("backend") or "auto"
    if backend == "auto":
        backend = gpu.auto_backend()
    gpu.CALL_STATS.clear()
    gpu.STAT_PHASE = "translate"
    name = _LANG_NAMES.get(target, target)
    out = list(texts)
    B = 30
    for b0 in range(0, len(texts), B):
        ctx.check()
        ctx.progress(b0 / max(1, len(texts)), f"překlad titulků {b0 + 1}–{min(len(texts), b0 + B)} z {len(texts)}")
        batch = texts[b0: b0 + B]
        prev = texts[max(0, b0 - 3): b0]
        d = _chat_json(
            f"Přelož titulky do {name}. Jsou to po sobě jdoucí úseky jedné řeči – věta může pokračovat v dalším titulku, "
            "proto překládej v kontextu, přirozeně a stručně, jak se píšou titulky. Zachovej tón i vulgarismy; jména "
            "a místní názvy přepiš obvyklým způsobem. Každý titulek přelož zvlášť – stejný počet a pořadí, nic "
            "nespojuj ani nevynechávej. Už přeložený text jen zkontroluj."
            + (("\nPředchozí titulky (jen kontext, nepřekládej): " + " / ".join(prev)) if prev else "")
            + ("\nU titulku je v závorce nejvýš znaků, které divák stihne přečíst – překlad drž do té délky "
               "(zhusti formulaci, vynech vatu, smysl zachovej)." if maxlen else "")
            + "\n\n" + "\n".join(f"{i + 1}. " + (f"(max {maxlen[b0 + i]} zn.) " if maxlen else "") + t
                                 for i, t in enumerate(batch))
            + f'\n\nVrať JSON {{"t":[{{"i":1,"t":"…"}}]}} – u každého titulku jeho číslo i a překlad t, všech {len(batch)}.',
            90 * len(batch) + 200,
            # s číslem titulku: jen pole textů se jednou posunulo o jeden (model spojil dva titulky, gramatika
            # vynutila počet a poslední doplnil originálem) – časy pak dostaly cizí věty
            schema={"type": "object", "properties": {"t": {"type": "array", "items": {
                "type": "object", "properties": {"i": {"type": "integer"}, "t": {"type": "string"}},
                "required": ["i", "t"]}, "minItems": len(batch), "maxItems": len(batch)}}, "required": ["t"]},
            backend=backend,
        )
        for it in d.get("t") or []:
            try:
                k = int(it.get("i")) - 1
            except (TypeError, ValueError, AttributeError):
                continue
            t = str(it.get("t") or "").strip()
            if 0 <= k < len(batch) and t:
                out[b0 + k] = t
    def runaway(src: str, t: str) -> bool:
        # model občas místo krátkého titulku „přeloží“ celý kontext (šum „1.30“ → odstavec předchozích titulků)
        return len(t) > 3 * len(src) + 25 or " / " in t

    # nepřeložené (chybí, model vrátil originál) nebo přerostlé -> každý zvlášť; text bez písmen se nepřekládá
    retried = 0
    for i, (src, t) in enumerate(zip(texts, out)):
        if not re.search(r"[^\W\d_]{2}", src):
            out[i] = src
            continue
        if (_norm(t) == _norm(src) and re.search(r"[^\W\d_]{3}", src)) or runaway(src, t):
            ctx.check()
            d = _chat_json(
                f"Přelož do {name} (titulek, přirozeně a stručně; vrať jen překlad tohoto textu, nic navíc):\n{src}"
                + (f"\n(kontext před: {texts[i - 1]})" if i and not runaway(src, t) else "")
                + '\nVrať JSON {"t":"…"}', 300,
                schema={"type": "object", "properties": {"t": {"type": "string"}}, "required": ["t"]}, backend=backend)
            nt = str(d.get("t") or "").strip()
            if nt and not runaway(src, nt):
                out[i] = nt
                retried += 1
            elif runaway(src, t):
                out[i] = src
    return {"texts": out, "target": target, "backend": backend, "retried": retried,
            "llmStats": gpu.stats_summary(gpu.CALL_STATS)}


def _chat_json(prompt: str, max_tokens: int = 1500, schema: dict | None = None, backend: str | None = None) -> dict:
    return gpu.chat_json(prompt, max_tokens, schema, backend)


# gramatická schémata pro llama-server (GBNF) – model fyzicky nemůže vrátit jiný tvar
_CHAPTERS_SCHEMA = {
    "type": "object",
    "properties": {
        "chapters": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "from": {"type": "integer"}, "to": {"type": "integer"},
                "title": {"type": "string"}, "summary": {"type": "string"},
                "best": {"type": "array", "items": {"type": "integer"}},
            },
            "required": ["from", "to"],
        }},
        # důvod jen jako kód: volně psané důvody byly dlouhé věty (~25 tokenů) a osnovu zpomalovaly ~4×
        "weak": {"type": "array", "items": {
            "type": "object",
            "properties": {"id": {"type": "integer"},
                           "reason": {"type": "string",
                                      "enum": ["přeřeknutí", "nedokončené", "opakování", "vata", "nesrozumitelné"]}},
            "required": ["id"],
        }},
    },
    "required": ["chapters"],
}


def _line(s: dict) -> str:
    spk = f" [{s['speaker']}]" if s.get("speaker") else ""
    return f"{s['id']}{spk} ({s['end'] - s['start']:.1f}s) {s['text']}"


def _median_dur(units: list[dict]) -> float:
    ds = sorted(u["dur"] for u in units if u.get("dur"))
    return ds[len(ds) // 2] if ds else 8.0


# Vady, kvůli kterým je věta do střihu opravdu nepoužitelná. "přeřeknutí"/"nedokončené" mezi ně NEPATŘÍ:
# u reálného materiálu to bývá hlavně šum přepisu (Whisper zkomolí slovo) nebo zápal řečníka – a právě
# nejostřejší výroky v debatě takovou drobnou vadu mívají. Dřív je prompt plošně zakazoval ("bez přeřeknutí"),
# takže se do střihu nedostalo to nejpodstatnější (2026-09-26: vyčítaná zastavená parkovací politika).
_HARD_WEAK = ("vata", "prázdné", "prazdne", "nesrozumitelné", "nesrozumitelne", "opakování", "opakovani")


def _weak_note(reasons: list[str] | None, is_best: bool) -> str:
    """Popisek vady za větu pro LLM. Věta, kterou osnova označila za nejlepší v kapitole, se
    za slabou neoznačuje vůbec – jinak si model protiřečí sám se sebou."""
    if not reasons or is_best:
        return ""
    txt = "; ".join(reasons)
    hard = any(h in r.lower() for r in reasons for h in _HARD_WEAK)
    return f"  <-- {'nepoužitelné' if hard else 'drobná vada'}: {txt}"


def _chunks(segs: list[dict], max_chars: int) -> list[list[dict]]:
    out, cur, size = [], [], 0
    for s in segs:
        if cur and size + len(s["text"]) > max_chars:
            out.append(cur)
            cur, size = [], 0
        cur.append(s)
        size += len(s["text"]) + 12
    if cur:
        out.append(cur)
    return out


def _fix_chapters(raw, first: int, last: int) -> list[dict]:
    ch = []
    for c in raw or []:
        try:
            a, b = int(c.get("from")), int(c.get("to"))
        except (TypeError, ValueError, AttributeError):
            continue
        if b < a:
            a, b = b, a
        a, b = max(a, first), min(b, last)
        if a <= b:
            ch.append({"from": a, "to": b, "title": str(c.get("title") or "").strip()[:80],
                       "summary": str(c.get("summary") or "").strip()[:300],
                       "best": [int(x) for x in (c.get("best") or []) if str(x).isdigit() and a <= int(x) <= b][:3]})
    ch.sort(key=lambda c: c["from"])
    if not ch:
        return [{"from": first, "to": last, "title": "", "summary": "", "best": []}]
    ch[0]["from"] = first
    for prev, nxt in zip(ch, ch[1:]):
        nxt["from"] = prev["to"] + 1 if nxt["from"] > prev["to"] + 1 or nxt["from"] <= prev["to"] else nxt["from"]
    ch = [c for c in ch if c["from"] <= c["to"]]
    ch[-1]["to"] = last
    return ch


def analyze(params: dict, ctx) -> dict:
    path = params["path"]
    tr, tr_file = load_transcript(path)
    segs = tr["segments"]
    use_llm = params.get("llm", True)
    backend = params.get("backend") or "auto"
    if backend == "auto":  # Hermes, když běží (vedle něj se vlastní gemma3 do VRAM nevejde a běží pomalu)
        backend = gpu.auto_backend()
    out = cache_file("analysis", path, {"tr": tr_file, "n": len(segs), "llm": use_llm,
                                         "spk": tr.get("speakerSource"), "be": backend, "v": 2})
    if out.exists() and not params.get("force"):
        index_set("analysis", path, out)
        return {"file": str(out), "cached": True}

    t0 = time.time()
    flags = heuristics(segs)
    gpu.CALL_STATS.clear()
    gpu.STAT_PHASE = "outline"
    chapters: list[dict] = []
    if use_llm and segs:
        chunks = _chunks(segs, int(CONFIG["llm"].get("chunkChars", 3200)))
        for ci, chunk in enumerate(chunks):
            ctx.check()
            ctx.progress(0.05 + 0.9 * ci / len(chunks), f"LLM kapitoly {ci + 1}/{len(chunks)}")
            first, last = chunk[0]["id"], chunk[-1]["id"]
            prompt = (
                "Jsi zkušený český střihač dokumentů a rozhovorů. Níže je úsek přepisu "
                "(číslo věty, [mluvčí], délka, text).\n\n"
                + "\n".join(_line(s) for s in chunk)
                + "\n\nÚkol: rozděl věty na souvislé tematické kapitoly (obvykle 1–4 na úsek). "
                f"Kapitoly musí navazovat a pokrýt všechny věty od {first} do {last}. "
                "Ke každé kapitole: title (max 6 slov), summary (jedna krátká věta česky, max 20 slov), "
                "best (1–3 čísla nejsilnějších vět). Dále weak: čísla vět, které jsou přeřeknutí, nedokončené, "
                "zbytečné opakování, vata nebo nesrozumitelné, s kódem důvodu. "
                'Vrať pouze JSON: {"chapters":[{"from":1,"to":5,"title":"","summary":"","best":[2]}],'
                '"weak":[{"id":3,"reason":"vata"}]}'
            )
            data = _chat_json(prompt, schema=_CHAPTERS_SCHEMA, backend=backend)
            chapters.extend(_fix_chapters(data.get("chapters"), first, last))
            for wk in data.get("weak") or []:
                try:
                    wid = int(wk.get("id"))
                except (TypeError, ValueError, AttributeError):
                    continue
                if first <= wid <= last:
                    flags.setdefault(wid, []).append("LLM: " + str(wk.get("reason") or "slabé")[:60])
    else:
        chapters = [{"from": segs[0]["id"], "to": segs[-1]["id"], "title": "", "summary": "", "best": []}] if segs else []

    by_id = {s["id"]: s for s in segs}
    for c in chapters:
        if not c["title"]:  # LLM občas název vynechá – použij začátek první věty
            words = by_id[c["from"]]["text"].split()
            c["title"] = " ".join(words[:6]) + ("…" if len(words) > 6 else "")
        c["start"] = by_id[c["from"]]["start"]
        c["end"] = by_id[c["to"]]["end"]
        c["speakers"] = sorted({by_id[i].get("speaker") for i in range(c["from"], c["to"] + 1) if i in by_id and by_id[i].get("speaker")})
    result = {
        "source": tr["source"],
        "transcript": tr_file,
        "duration": tr["duration"],
        "sentences": len(segs),
        "speakers": tr.get("speakers"),
        "llm": (gpu.llm_backends().get(backend, {}).get("label", backend) if backend != "local"
                else CONFIG["models"]["llm"]) if use_llm else None,
        "backend": backend if use_llm else None,
        "elapsedSec": round(time.time() - t0, 1),
        "llmStats": gpu.stats_summary(gpu.CALL_STATS),
        "chapters": chapters,
        "weak": {str(k): v for k, v in sorted(flags.items())},
    }
    write_json(out, result)
    index_set("analysis", path, out)
    return {"file": str(out), "cached": False}


def _instruction_topics(instruction: str, backend: str) -> tuple[list[str], bool, bool, bool]:
    """Témata, která zadání výslovně jmenuje ("o bydlení a parkování" -> [bydlení, parkování]), zda jde
    o samostatná témata vedle sebe (pak se vyvažují), nebo jen o aspekty jednoho tématu ("cena ovladače"),
    zda je zadání obecné bez konkrétního tématu ("přehled celé debaty") – pak se téma nekontroluje vůbec –
    a zda je vztahové ("hlavní spor", "co si vyčítají"): téma se taky nekontroluje, ale NENÍ to přehled,
    takže se výběr nesmí roztahovat po kapitolách – spor je naopak potřeba ukázat do hloubky."""
    d = _chat_json(
        f"Zadání střihu: {instruction}\n\nVypiš obsahová témata, která zadání výslovně jmenuje (0–4 krátká hesla, "
        "každé zvlášť) – věcné oblasti, o kterých se má ve střihu mluvit, např. „školství“, „doprava“. Nejsou to "
        "témata: co se z řeči vybírá (argumenty, názory, výroky, postoje, kdo mluví) ani formální požadavky (délka, "
        "bez moderátora, bez opakování). Pak urči samostatna: true jen když zadání výslovně chce víc různých témat "
        "vedle sebe (např. „o školství a dopravě“); false, když jde o jedno téma a hesla jsou jeho části. "
        "Nakonec obecne: true jen když zadání obsah na žádné téma neomezuje (přehled celého pořadu, nejsilnější "
        "momenty, shrnutí); jinak false. "
        'Vrať JSON {"temata":["…"],"samostatna":false,"obecne":false}',
        200,
        schema={"type": "object", "properties": {
            "temata": {"type": "array", "items": {"type": "string"}, "maxItems": 4},
            "samostatna": {"type": "boolean"},
            "obecne": {"type": "boolean"}}, "required": ["temata", "samostatna", "obecne"]},
        backend=backend,
    )
    # "sestřih o seniorském bydlení" obecný není, i když ho model tak jednou označil – obrat "o …" je omezení obsahu
    about = re.search(r"\b(o|ohledně|na téma|k tématu|týkající se)\s+\w", instruction, re.I)
    general = bool(d.get("obecne")) and not about
    out: list[str] = []
    for t in d.get("temata") or []:
        t = str(t).strip().strip(".").lower()[:40]
        if t and t not in out and t not in ("jiné", "okrajově"):
            out.append(t)
    # Vztahová/rétorická hesla nejsou obsahová témata, i když je model jako témata vrátí (prompt to zakazuje,
    # ale neudrží to). "Hlavní spor" není věcná oblast, je to druh výroku – kontrola tématu pak zahodí právě
    # konkrétní důkazy sporu ("za tu kampaň se utratilo tři čtvrtě milionu"), protože ty "o sporu" nejsou.
    # Nezbude-li po odfiltrování nic, zadání obsah tématem neomezuje -> chová se jako obecné.
    meta = ("spor", "konflikt", "polemik", "hádk", "výčitk", "vycitk", "kritik", "rozdíl", "rozdil", "odlišn",
            "odlisn", "argument", "názor", "nazor", "postoj", "výrok", "vyrok", "moment", "vzkaz", "sdělení",
            "sdeleni", "atmosfér", "atmosfer", "vyjádřen", "vyjadren")
    # Styl a forma střihu taky nejsou témata: „akční upoutávka“ dala téma „akce“ a kontrola tématu vyřadila 34 vět
    # (Robin Hood, 2026-09-29) – zbylo 37 s z 60. Upoutávka o čemkoli je výběr podle síly a tempa, ne podle obsahu.
    style = ("akc", "akčn", "akcn", "upoutáv", "upoutav", "trailer", "teaser", "promo", "dynami", "napět", "napet",
             "napín", "napin", "tempo", "rychl", "dramat", "vtip", "humor", "emoc", "strhuj", "sestřih", "sestrih",
             # „krátké střihy“ (debata, 2026-10-06) – forma střihu, ne obsah
             "krátk", "kratk", "střih", "strih", "údern", "udern", "svižn", "svizn")
    styled = [t for t in out if any(m in _norm(t) for m in style)]
    out = [t for t in out if t not in styled]
    filtered = [t for t in out if not any(m in _norm(t) for m in meta)]
    relational = bool(out) and not filtered
    if styled and not out and not about:
        general = True  # jen styl, žádné téma -> obsah neomezovat (jako „nejsilnější momenty“)
    out = [] if general else filtered[:4]
    # "o bydlení a parkování": témata spojená přímo spojkou jsou samostatná vždy – úsudek modelu tady kolísal
    # (stejné zadání jednou true, po úpravě promptu false). "masifikací a skutečnou demokratizací" (slovo mezi) ne.
    stems = [_norm(t).split()[0][:5] for t in out if _norm(t).split()]
    norm_ins = _norm(instruction)
    joined = any(re.search(rf"\b{re.escape(a)}\w*\s+(a|i|nebo)\s+{re.escape(b)}", norm_ins)
                 for a in stems for b in stems if a != b)
    return out, (bool(d.get("samostatna")) or joined) and len(out) >= 2, general, relational


def _verify_topic(instruction: str, topics: list[str], separate: bool, ids: list[int], segs: dict, an: dict,
                  chapter_of: dict, backend: str, dependent: set[int] | None = None) -> dict[int, str]:
    """Kontrola tématu bez kontextu výběru: v souvislé pasáži (např. o dopravě) model označí za téma zadání i věty
    o příbuzném tématu (tramvaje místo parkování). Úzká otázka na každou větu zvlášť je spolehlivější.
    Vrací {id věty: téma zadání nebo "jiné"}. Hesla jednoho tématu (separate=False) se nerozlišují – přiřazování
    k jemným heslům ("masifikace" vs. "demokratizace") bylo zbytečně přísné a vyřazovalo věty k věci."""
    separate = separate and len(topics) >= 2
    # Bez popisu "o čem věta je": s názvem kapitoly jako kontextem vycházel verdikt stejně (5/5 běhů) a 2,3× rychleji.
    # U jednoho tématu otázka ano/ne – popisek typu "téma zadání" v enumu model mátl (jednou dal "jiné" všemu).
    verdict_field = ({"tema": {"type": "string", "enum": topics + ["jiné"]}} if separate
                     else {"k_tematu": {"type": "string", "enum": ["ano", "ne"]}})
    # "odkaz": věta stojí na předchozí ("Tím si to zhoršujeme.", "ten partner") – do `dependent` (volitelně)
    odkaz = {"odkaz": {"type": "string", "enum": ["ne", "ano"]}}
    schema = {
        "type": "object",
        "properties": {"items": {"type": "array", "items": {
            "type": "object",
            "properties": {"id": {"type": "integer"}, **verdict_field, **odkaz},
            "required": ["id", *verdict_field, "odkaz"],
        }}},
        "required": ["items"],
    }
    task = ("přiřaď ji k tématu zadání, kterému slouží – i nepřímo, jako prostředek, podmínka nebo zdůvodnění. "
            "Je-li o jiném tématu, i když ze stejné oblasti a ve stejné pasáži, dej \"jiné\". "
            'Vrať JSON {"items":[{"id":12,"tema":"…","odkaz":"ne"}]}') if separate else (
            "rozhodni, zda slouží tématu zadání (ano) – i nepřímo, jako prostředek, podmínka nebo zdůvodnění – "
            "nebo je o jiném tématu, i když ze stejné oblasti a ve stejné pasáži (ne). "
            'Vrať JSON {"items":[{"id":12,"k_tematu":"ano","odkaz":"ne"}]}')
    task = ("odkaz = ano, když věta odkazuje na něco, co v ní samotné není řečeno (začíná „Tím…“, „To…“, „Proto…“, "
            "mluví o „tom partnerovi“ apod.), takže bez předchozí věty nedává smysl; jinak ne. Pak " + task)
    res: dict[int, str] = {}
    batches = [ids[b0: b0 + 40] for b0 in range(0, len(ids), 40)]
    retried = False
    while batches:
        batch = batches.pop(0)
        verdict = _chat_json(
            f"Zadání střihu: {instruction}\nTémata zadání: {', '.join(topics) or 'viz zadání'}\n\nVěty vybrané do střihu:\n"
            + "\n".join(f"{i} [kapitola: {an['chapters'][chapter_of[i] - 1]['title'] if chapter_of.get(i) else '?'}]: "
                        f"{segs[i]['text'].strip()}" for i in batch)
            + "\n\nU KAŽDÉ věty (ber v úvahu kapitolu) " + task,
            1200,
            schema=schema,
            backend=backend,
        )
        got: dict[int, str] = {}
        for it in verdict.get("items") or []:
            try:
                vid = int(it.get("id"))
            except (TypeError, ValueError, AttributeError):
                continue
            if vid not in batch:
                continue
            if dependent is not None and it.get("odkaz") == "ano":
                dependent.add(vid)
            if separate and it.get("tema") in topics + ["jiné"]:
                got[vid] = it["tema"]
            elif not separate and it.get("k_tematu") in ("ano", "ne"):
                got[vid] = "jiné" if it["k_tematu"] == "ne" else "téma zadání"
        # pojistka: vyřadit (skoro) všechny věty vybrané jako téma zadání je selhání modelu, ne výsledek
        # (stalo se: "jiné" u všech). Práh 90 %: při 60 % zahazovala i správný verdikt, když kandidáti z kapitoly
        # o příbuzném tématu (tramvaj) tvořili většinu – a ty pak prošly do střihu.
        if len(batch) >= 5 and sum(1 for t in got.values() if t == "jiné") >= 0.9 * len(batch):
            log(f"kontrola tématu vyřadila {sum(1 for t in got.values() if t == 'jiné')}/{len(batch)} vět – ignoruji ji")
            got = {i: t for i, t in got.items() if t != "jiné"}
        res.update(got)
        # věty, u kterých model verdikt vynechal, by jinak prošly bez kontroly – jednou se zeptej znovu jen na ně
        missing = [i for i in batch if i not in got]
        if missing and not retried:
            retried = True
            batches.append(missing)
    return res


def _pause_map(path: str, segs: dict[int, dict]) -> dict[int, bool]:
    """id věty -> je za ní skutečná pauza (ticho ve zvuku, ne jen mezera v časech Whisperu). Bez zvuku podle mezery."""
    ids = sorted(segs)

    def fs(i):
        w = segs[i].get("words") or []
        return w[0]["s"] if w else segs[i]["start"]

    def le(i):
        w = segs[i].get("words") or []
        return w[-1]["e"] if w else segs[i]["end"]

    pairs = [(le(ids[n]), fs(ids[n + 1])) for n in range(len(ids) - 1)]
    # úzké okno a 40 ms – střih tu pak padne na hranici podle časů slov a dolaďování ji najde v tomtéž tichu
    audio = audiosync.boundary_pauses(path, pairs, before=0.08, after=0.08, min_ms=40)
    out = {ids[-1]: True} if ids else {}
    for n in range(len(ids) - 1):
        # obojí: mezera v přepisu ≥ 0,12 s A ticho ve zvuku – samotný zvuk mate závěr souhlásky („nic.|Jsem“ 0,08 s),
        # samotná mezera přeslechne mluvení přes sebe („zlomilo?|Jo“ 0,14 s); ověřeno na 12 přechodech Talku
        # (čistě zvukové široké okno dalo v regresi 3/6 čistých hranic – ticho našlo jinde, než pak padl střih)
        gap_ok = pairs[n][1] - pairs[n][0] >= 0.12
        out[ids[n]] = gap_ok and (audio[n] if audio is not None else True)
    return out


def _snap_units_to_pauses(units: list[dict], segs: dict[int, dict], exclude: set,
                          pause_map: dict[int, bool] | None = None, budget: float = float("inf")) -> int:
    """Kraje vybraných celků dotáhne ke skutečné pauze (mezera ≥ 0,12 s): o větu dál (max. 3 věty,
    max. 16 s), jinak o větu zpět. Věta vystřižená ze souvislé řeči bez nádechu zní useknutě, i když střih neprotne
    slovo (Talk 2 min, 2026-11-20: 4 z 22 hranic slyšitelné). Vrací počet upravených krajů."""
    ids = sorted(segs)
    pos = {i: n for n, i in enumerate(ids)}
    PAUSE = 0.12

    def first_s(i):
        w = segs[i].get("words") or []
        return w[0]["s"] if w else segs[i]["start"]

    def last_e(i):
        w = segs[i].get("words") or []
        return w[-1]["e"] if w else segs[i]["end"]

    def pause_before(i):
        n = pos[i]
        if n == 0:
            return True
        p = ids[n - 1]
        if pause_map is not None and p in pause_map:
            return pause_map[p]
        gap = first_s(i) - last_e(p)
        # i při změně mluvčího jen skutečná mezera – v rozhovoru na sebe navazují i do 20 ms a mluví přes sebe
        return gap >= PAUSE

    def pause_after(j):
        n = pos[j]
        if n == len(ids) - 1:
            return True
        if pause_map is not None and j in pause_map:
            return pause_map[j]
        q = ids[n + 1]
        gap = first_s(q) - last_e(j)
        return gap >= PAUSE

    def usable(i, spk, taken):
        # i jiný mluvčí (otázka před odpovědí, souhlas za ní) – v rozhovoru na sebe navazují bez mezery a celá výměna
        # zní přirozeněji než střih doprostřed; jen ne mluvčí vyřazený zadáním („bez moderátora“)
        return i in segs and i not in taken and segs[i].get("speaker") not in exclude

    def dur(i):
        return segs[i]["end"] - segs[i]["start"]

    taken = {i for u in units for i in u["ids"]}
    fixed = 0
    # budget = kolik sekund smí dotažení přidat: když by prodloužení přesáhlo cíl, má přednost zkrácení o větu
    # (taky končí v pauze) – dřív se pak dorovnávalo vyhozením celých celků a ze střihu zmizelo celé téma
    left = budget
    for u in units:
        if not u.get("ids"):
            continue
        spk = segs[u["ids"][0]].get("speaker")
        # začátek
        a = u["ids"][0]
        if not pause_before(a):
            ext, n, add = [], pos[a], 0.0
            for k in range(1, 4):
                if n - k < 0 or not usable(ids[n - k], spk, taken):
                    break
                ext.insert(0, ids[n - k])
                add += dur(ids[n - k])
                if add > 16:
                    ext = []
                    break
                if pause_before(ids[n - k]):
                    break
            can_shrink = len(u["ids"]) > 1 and pause_before(u["ids"][1])
            grow = sum(dur(i) for i in ext) if ext else 0.0
            if ext and pause_before(ext[0]) and not (grow > left and can_shrink):
                u["ids"][:0] = ext
                taken.update(ext)
                left -= grow
                fixed += 1
            elif can_shrink:
                left += dur(u["ids"][0])
                taken.discard(u["ids"].pop(0))
                fixed += 1
        # konec
        b = u["ids"][-1]
        if not pause_after(b):
            ext, n, add, merged = [], pos[b], 0.0, False
            for k in range(1, 4):
                if n + k >= len(ids):
                    break
                nxt = ids[n + k]
                # dotahování narazilo na další vybraný celek -> spojit (souvislá řeč #20–#22, Talk 2 min)
                owner = next((x for x in units if x is not u and x.get("ids") and x["ids"][0] == nxt), None)
                if owner is not None:
                    u["ids"].extend(ext + owner["ids"])
                    taken.update(ext)
                    owner["ids"] = []
                    fixed += 1
                    merged = True
                    break
                if not usable(nxt, spk, taken):
                    break
                ext.append(nxt)
                add += dur(nxt)
                if add > 16:
                    ext = []
                    break
                if pause_after(nxt):
                    break
            end_ok = ext and pause_after(ext[-1]) and not re.search(r"(\.\.\.|…)\W*$", segs[ext[-1]]["text"].strip())
            can_shrink = len(u["ids"]) > 1 and pause_after(u["ids"][-2])
            grow = sum(dur(i) for i in ext) if ext else 0.0
            if merged:
                pass
            elif end_ok and not (grow > left and can_shrink):
                u["ids"].extend(ext)
                taken.update(ext)
                left -= grow
                fixed += 1
            elif can_shrink:
                left += dur(u["ids"][-1])
                taken.discard(u["ids"].pop())
                fixed += 1
        u["dur"] = sum(dur(i) for i in u["ids"])
    units[:] = [u for u in units if u.get("ids")]  # celky spojené do předchozího
    return fixed


def _passage_candidates(target: float, segs: dict[int, dict], chapters: list[dict], chosen: list[int],
                        exclude: set, pause_map: dict[int, bool] | None = None) -> list[dict]:
    """Souvislé pasáže jednoho mluvčího kolem cílové délky, které začínají i končí ve skutečné pauze
    (mezi větami bez nádechu zní každý střih useknutě, i když neprotne slovo)."""
    ids = sorted(segs)
    pos = {i: n for n, i in enumerate(ids)}

    def first_s(i):
        w = segs[i].get("words") or []
        return w[0]["s"] if w else segs[i]["start"]

    def last_e(i):
        w = segs[i].get("words") or []
        return w[-1]["e"] if w else segs[i]["end"]

    # 0,12 s: v ní už bývá ticho na čistý střih (ověří refine_edges + check-cuts); 0,25 s nechalo u plynulé
    # mluvčí jen 3 kandidáty na 5 minut
    PAUSE = 0.12
    ch_score = {}
    for k, c in enumerate(chapters, 1):
        for i in range(c["from"], c["to"] + 1):
            ch_score[i] = k
    allowed_ch = set(chosen)

    def clean_start(i):
        n = pos[i]
        if segs[i].get("speaker") in exclude or ch_score.get(i) not in allowed_ch:
            return False
        txt = segs[i]["text"].strip()
        if not txt or txt[0].islower():
            return False  # pokračování předchozí věty
        if n == 0:
            return True
        prev = segs[ids[n - 1]]
        if pause_map is not None and ids[n - 1] in pause_map:
            return pause_map[ids[n - 1]]
        gap = first_s(i) - last_e(ids[n - 1])
        return gap >= PAUSE

    def clean_end(j):
        n = pos[j]
        t = segs[j]["text"].strip()
        # konec věty, ne přerušená myšlenka („…v nejhorší možnou chvíli, kdy...“)
        if not re.search(r"[.!?]\W*$", t) or re.search(r"(\.\.\.|…)\W*$", t):
            return False
        if n == len(ids) - 1:
            return True
        nxt = segs[ids[n + 1]]
        if pause_map is not None and j in pause_map:
            return pause_map[j]
        gap = first_s(ids[n + 1]) - last_e(j)
        return gap >= PAUSE

    lo, hi = 0.6 * target, 1.25 * target
    cands = []
    for i in ids:
        if not clean_start(i):
            continue
        spk = segs[i].get("speaker")
        best = None
        for j in ids[pos[i]:]:
            if segs[j].get("speaker") != spk or segs[j].get("speaker") in exclude:
                break
            dur = last_e(j) - first_s(i)
            if dur > hi:
                break
            if dur >= lo and clean_end(j):
                if best is None or abs(dur - target) < abs(best["dur"] - target):
                    best = {"ids": ids[pos[i]: pos[j] + 1], "dur": round(dur, 1)}
        if best:
            cands.append(best)
    # stejný konec = stejná pointa, nech jen variantu nejbližší cíli
    by_end: dict[int, dict] = {}
    for c in cands:
        e = c["ids"][-1]
        if e not in by_end or abs(c["dur"] - target) < abs(by_end[e]["dur"] - target):
            by_end[e] = c
    return sorted(by_end.values(), key=lambda c: c["ids"][0])


def _plan_passage(instruction: str, target: float, segs: dict[int, dict], chapters: list[dict], chosen: list[int],
                  scores: dict[int, int], exclude: set, backend: str, ctx,
                  pause_map: dict[int, bool] | None = None, avoid: set | None = None,
                  path: str | None = None) -> dict | None:
    cands = [c for c in _passage_candidates(target, segs, chapters, chosen, exclude, pause_map)
             if not (avoid and set(c["ids"]) & avoid)]
    if path and target <= 15:
        # Výrok do 15 s: celé „věty“ přepisu bývají dlouhé (Whisper slepí 2–3 věty), na 10 s pak nic nesedí
        # (Talk B 10 s: jediná slabá věta 7 s). Navíc jemné jednotky = věty uvnitř segmentu (fromWord/toWord).
        for c in _teaser_candidates(path, segs, exclude, avoid, lo=0.6 * target, hi1=1.25 * target,
                                    hi2=1.25 * target, max_units=6):
            c["ids"] = sorted({u["id"] for u in c["units"]})
            cands.append(c)
    if not cands:
        return None
    if len(cands) > 60:  # dlouhý materiál: přednost jádrovým kapitolám
        ch_of = {i: k for k, c in enumerate(chapters, 1) for i in range(c["from"], c["to"] + 1)}
        cands = sorted(cands, key=lambda c: -scores.get(ch_of.get(c["ids"][0]), 0))[:60]
        cands.sort(key=lambda c: c["ids"][0])
    text = lambda c: (" ".join(u["text"] for u in c["units"]) if c.get("units")  # noqa: E731
                      else " ".join(segs[i]["text"].strip() for i in c["ids"]))
    gpu.STAT_PHASE = "passage"
    rated: list[tuple[int, dict]] = []
    B = 10
    for b0 in range(0, len(cands), B):
        ctx.check()
        part = cands[b0: b0 + B]
        ctx.progress(0.3 + 0.5 * b0 / len(cands), f"LLM hodnotí pasáže {b0 + 1}–{b0 + len(part)} z {len(cands)}")
        lines = "\n".join(f"P{n + 1} ({c['dur']:.0f} s): {text(c)}" for n, c in enumerate(part))
        # Hodnocení po kritériích (0–3): jedno číslo 0–9 bylo u lokálního modelu nestabilní – stejný úsek dal
        # při opakování jinou vítěznou pasáž. Váhy: samostatnost, síla a zadání 2×, pointa 1,5×.
        r = _chat_json(
            f"Jsi střihač televizních pořadů. Zadání: {instruction}. Cílová délka přibližně {target:.0f} s.\n\n"
            f"Kandidáti – souvislé pasáže z rozhovoru:\n{lines}\n\n"
            "Každou pasáž ohodnoť čtyřmi čísly 0–3 jako SAMOSTATNÝ klip pro sociální sítě:\n"
            "1) samostatnost – rozumí divák hned první větě bez předchozího kontextu? (0 = začíná odkazem na dřív "
            "řečené: to, tohle, proto, takže, taky, jo, nebo jako odpověď na otázku; 3 = úplně srozumitelné)\n"
            "2) síla – jak silný, konkrétní, emotivní nebo překvapivý je obsah (0 = úvod, zdvořilost, vata; 3 = výrazný)\n"
            "3) pointa – končí uzavřenou myšlenkou nebo pointou (0 = myšlenka zůstane viset; 3 = jasná pointa)\n"
            "4) zadání – jak přesně odpovídá zadání (0 = nesouvisí; 3 = přesně)\n"
            f'Vrať JSON {{"k":[[s,i,p,z], …]}} – {len(part)} čtveřic ve stejném pořadí jako pasáže.',
            40 + 14 * len(part),
            schema={"type": "object", "properties": {"k": {"type": "array", "minItems": len(part), "maxItems": len(part),
                    "items": {"type": "array", "minItems": 4, "maxItems": 4,
                              "items": {"type": "integer", "minimum": 0, "maximum": 3}}}}, "required": ["k"]},
            backend=backend)
        for n, k4 in enumerate((r.get("k") or [])[: len(part)]):
            if isinstance(k4, list) and len(k4) == 4 and all(isinstance(x, int) for x in k4):
                rated.append((2 * k4[0] + 2 * k4[1] + 1.5 * k4[2] + 2 * k4[3], part[n]))
    if not rated:
        return None

    def dependent(c: dict) -> bool:
        """Začátek navazuje na něco, co v klipu není („A najednou byl pryč.“, „Takže to bylo v tom životopise…“,
        „Absolutně.“). „Ale už jsem měla takový pocit…“ obstojí i samo – „ale“ a „pak“ se nepočítají."""
        first = (c["units"][0]["text"] if c.get("units") else segs[c["ids"][0]]["text"]).strip().lower()
        return bool(re.match(r"(a|takže|tak|proto|protože|no|jo|taky|to|tohle|tím|že)\b", first)) or len(first.split()) <= 2

    def adjusted(sc: float, c: dict) -> float:
        # model začátky odkazující dozadu podle promptu nestrhává
        if dependent(c):
            sc -= 3
        if c["dur"] > 1.15 * target or c["dur"] < 0.75 * target:
            sc -= 1.5
        return sc

    rated = [(adjusted(sc, c), c) for sc, c in rated]
    rated.sort(key=lambda x: (-x[0], abs(x[1]["dur"] - target)))
    # do finále jen pasáže, které po srážkách zůstaly nahoře – jinak model v přímém srovnání vrátil vyřazený
    # začátek („Absolutně. My jsme nechápali…“) a srážky by nic neznamenaly
    # Finále rozhoduje líp než dávkové hodnocení (to u úseku A dalo ucelené pasáži 13 bodů z 22), proto do něj
    # jde širší výběr. Navazující začátky jen tehdy, když jiné nejsou – v přímém srovnání je model bral za „dramatické“.
    near = [(sc, c) for sc, c in rated if sc >= rated[0][0] - 8]
    top = [c for _, c in near if not dependent(c)][:5] or [c for _, c in near][:4]
    pick = top[0]
    reason = None
    if len(top) > 1:
        # finále: přímé srovnání nejlepších (hodnocení po dávkách nemá společné měřítko). Model nejdřív krátce
        # zdůvodní (pole „uvaha“ před číslem = přemýšlení v mezích gramatiky) – bez toho bral doslovnou shodu
        # se slovy zadání („cesta na Novu“ z výčtu životopisu) před ucelenou myšlenkou s pointou.
        ctx.progress(0.85, "LLM vybírá nejlepší pasáž")
        lines = "\n".join(f"P{n + 1} ({c['dur']:.0f} s): {text(c)}" for n, c in enumerate(top))
        r = _chat_json(
            f"Jsi zkušený střihač televizních pořadů. Zadání: {instruction}. Cílová délka přibližně {target:.0f} s.\n\n"
            f"{lines}\n\n"
            "Vyber pasáž, která bude nejlepší jako samostatný klip na sociální sítě. Rozhoduje: 1) první věta je "
            "srozumitelná bez předchozího kontextu, 2) jde o osobní, silnou nebo překvapivou myšlenku (ne výčet faktů), "
            "3) končí pointou, 4) odpovídá zadání. Nejdřív v poli uvaha krátce (2–3 věty) porovnej pasáže, pak dej číslo.",
            350, schema={"type": "object", "properties": {"uvaha": {"type": "string", "maxLength": 600},
                                                          "p": {"type": "integer", "minimum": 1, "maximum": len(top)}},
                         "required": ["uvaha", "p"]}, backend=backend)
        if isinstance(r.get("p"), int) and 1 <= r["p"] <= len(top):
            pick = top[r["p"] - 1]
            reason = r.get("uvaha")
    alts = [i for c in top if c is not pick for i in c["ids"]]
    return {
        "note": None, "picks": _teaser_picks(pick) if pick.get("units") else pick["ids"], "estimatedSec": pick["dur"],
        "alternates": alts, "dropped": [],
        "mode": "passage", "passages": len(cands),
        # žebříček pro ladění: [skóre po srážkách, první–poslední věta, délka]
        "ranked": [[round(sc, 1), f"{c['ids'][0]}–{c['ids'][-1]}", c["dur"]] for sc, c in rated[:8]],
        "reason": reason,
        "editorial": [], "thesis": None, "keyChapters": [],
        "offTopic": [], "topics": [], "balanceTopics": False, "general": False, "topicSec": {},
        "addedForQuestionAnswer": [], "fixedFragments": [],
    }


_ANSWER_WORDS = re.compile(r"^(absolutně|jo|ano|ne|jasně|určitě|přesně|no|dobře|tak)\W*$", re.I)
_TEASER_SCORES: dict[tuple, float] = {}  # (zdroj, zadání, text úderu) -> skóre; platí po dobu běhu Workeru


def _teaser_candidates(path: str, segs: dict[int, dict], exclude: set, avoid: set | None = None,
                       lo: float = 1.2, hi1: float = 8.0, hi2: float = 9.0, max_units: int = 2) -> list[dict]:
    """Krátké samostatné výroky pro upoutávku. Jednotka = věta podle interpunkce slov, i uvnitř segmentu přepisu
    (Whisper slepí „Za tři týdny. Takže to přišlo…“ do jednoho – úder „Za tři týdny.“ by jinak neexistoval).
    Kandidát = 1–2 navazující věty jednoho mluvčího, 1,2–8 s, začátek i konec ve skutečné pauze (mezera ≥ 0,12 s
    a ticho ve zvuku), dokončená věta, za ní nepokračuje souvětí. „A najednou byl pryč.“ smí – v upoutávce je to úder."""
    units = []  # {id, w0, w1, s, e, text, spk}
    for sid in sorted(segs):
        ws = segs[sid].get("words") or []
        start = 0
        for k, w in enumerate(ws):
            end_tok = re.search(r"[.!?]$", w["w"]) and not re.search(r"(\.\.\.|…)$", w["w"])
            if end_tok or k == len(ws) - 1:
                piece = ws[start: k + 1]
                if piece:
                    units.append({"id": sid, "w0": start, "w1": k, "s": piece[0]["s"], "e": piece[-1]["e"],
                                  "text": " ".join(x["w"] for x in piece), "spk": segs[sid].get("speaker"),
                                  "full": start == 0 and k == len(ws) - 1, "closed": bool(end_tok)})
                start = k + 1
    if not units:
        return []
    pairs = [(units[n]["e"], units[n + 1]["s"]) for n in range(len(units) - 1)]
    audio = audiosync.boundary_pauses(path, pairs)
    pause_after = [(audio[n] if audio is not None else pairs[n][1] - pairs[n][0] >= 0.12)
                   for n in range(len(pairs))] + [True]

    def ok_start(n):
        u = units[n]
        t = u["text"].strip()
        if u["spk"] in exclude or not t or t[0].islower() or _ANSWER_WORDS.match(t):
            return False
        if n and not pause_after[n - 1]:
            return False
        # „To byl prostě můj nejbližší člověk.“ je v upoutávce úder (zvědavost) – „to/tohle“ se nevyřazuje, zkreslení
        # hlídá kontrola kontextu; spojky navazující na předchozí myšlenku ano
        return not re.match(r"(takže|tak|proto|protože|no|jo|taky|tím|že)\b", t.lower())

    def ok_end(n):
        u = units[n]
        if not u["closed"] or not pause_after[n]:
            return False
        nxt = units[n + 1] if n + 1 < len(units) else None
        # souvětí pokračuje malým písmenem u stejného mluvčího -> myšlenka by zůstala viset
        return not (nxt and nxt["spk"] == u["spk"] and nxt["text"][:1].islower())

    out = []
    for n in range(len(units)):
        if not ok_start(n) or (avoid and units[n]["id"] in avoid):
            continue
        for k in range(max_units):
            m = n + k
            if m >= len(units) or units[m]["spk"] != units[n]["spk"] or (avoid and units[m]["id"] in avoid):
                break
            d = units[m]["e"] - units[n]["s"]
            if d > hi2:
                break
            if lo <= d <= (hi1 if k == 0 else hi2) and ok_end(m):
                out.append({"units": units[n: m + 1], "dur": round(d, 1),
                            # okolí pro kontrolu vytržení z kontextu
                            "before": " ".join(u["text"] for u in units[max(0, n - 2): n]),
                            "after": " ".join(u["text"] for u in units[m + 1: m + 3])})
    return out


def _teaser_picks(c: dict) -> list:
    """Kandidát -> picks pro stavbu: celá věta přepisu jako číslo, část věty jako {id, fromWord, toWord}."""
    out = []
    for u in c["units"]:
        if out and isinstance(out[-1], dict) and out[-1]["id"] == u["id"] and out[-1]["toWord"] == u["w0"] - 1:
            out[-1]["toWord"] = u["w1"]  # dvě věty z jednoho segmentu za sebou
        else:
            out.append(u["id"] if u["full"] else {"id": u["id"], "fromWord": u["w0"], "toWord": u["w1"]})
    return out


def _plan_teaser(instruction: str, target: float, segs: dict[int, dict], exclude: set, backend: str, ctx,
                 path: str, avoid: set | None = None) -> dict | None:
    """Upoutávka ve stylu zpravodajství: údery ohodnotí model (hák, samostatnost, údernost), pak z nejlepších složí
    2–4 v pořadí hák → … → napětí na konec (s krátkou úvahou), délka se dorovná celými údery."""
    cands = _teaser_candidates(path, segs, exclude, avoid)
    if len(cands) < 2:
        return None
    text = lambda c: " ".join(u["text"] for u in c["units"])  # noqa: E731
    key = lambda c: {(u["id"], u["w0"]) for u in c["units"]}  # noqa: E731
    gpu.STAT_PHASE = "teaser"
    rated: list[tuple[float, dict]] = []
    # hodnocení úderů z dřívějšího plánu (opakování kvůli slyšitelné hranici) se nepočítá znovu – ušetří ~20 s
    todo = []
    for c in cands:
        sc = _TEASER_SCORES.get((path, instruction, text(c)))
        if sc is None:
            todo.append(c)
        else:
            rated.append((sc, c))
    B = 15
    for b0 in range(0, len(todo), B):
        ctx.check()
        part = todo[b0: b0 + B]
        ctx.progress(0.3 + 0.45 * b0 / max(1, len(todo)), f"LLM hodnotí údery {b0 + 1}–{b0 + len(part)} z {len(todo)}")
        lines = "\n".join(f"U{n + 1} ({c['dur']:.0f} s): {text(c)}" for n, c in enumerate(part))
        r = _chat_json(
            f"Jsi střihač zpravodajských upoutávek. Zadání: {instruction}\n\nKrátké výroky z rozhovoru:\n{lines}\n\n"
            "Každý výrok ohodnoť třemi čísly 0–3 jako ÚDER do upoutávky:\n"
            "1) hák – vzbudí emoci, napětí nebo zvědavost, chce se divák dívat dál? (0 = informační/nudné, 3 = silné)\n"
            "2) samostatnost – je srozumitelný sám a vytržený z kontextu NEZMĚNÍ význam? (0 = navazuje na něco "
            "nevyřčeného, nebo je to citace cizích slov, ironie či fráze, kterou mluvčí odmítá – např. co jí říkají "
            "druzí a ona to nechce slyšet; 3 = jasný vlastní výrok)\n"
            "3) údernost – krátký, citovatelný, bez vaty a odboček (0 = rozvláčný, 3 = úderný)\n"
            f'Vrať JSON {{"k":[[h,s,u], …]}} – {len(part)} trojic ve stejném pořadí.',
            30 + 11 * len(part),
            schema={"type": "object", "properties": {"k": {"type": "array", "minItems": len(part), "maxItems": len(part),
                    "items": {"type": "array", "minItems": 3, "maxItems": 3,
                              "items": {"type": "integer", "minimum": 0, "maximum": 3}}}}, "required": ["k"]},
            backend=backend)
        for n, k3 in enumerate((r.get("k") or [])[: len(part)]):
            if isinstance(k3, list) and len(k3) == 3 and all(isinstance(x, int) for x in k3):
                sc = 3 * k3[0] + 2 * k3[1] + 1.5 * k3[2]
                _TEASER_SCORES[(path, instruction, text(part[n]))] = sc
                rated.append((sc, part[n]))
    if len(rated) < 2:
        return None
    rated.sort(key=lambda x: -x[0])
    top: list[dict] = []  # bez překryvů (věta sama i s následující) – nechat lepšího
    for _, c in rated:
        if not any(key(c) & key(t) for t in top):
            top.append(c)
        if len(top) >= 12:
            break
    # Kontrola vytržení z kontextu s okolními větami: bez nich model nepozná citovanou frázi („Jí už je teď dobře.“ –
    # Bára tak cituje, co truchlící slyšet nechtějí; vytržené to zní, jako by máma byla v pořádku).
    ctx.progress(0.75, "LLM kontroluje kontext úderů")
    lines = "\n".join(f"U{n + 1}: „{text(c)}“\n   před: …{c['before'][-160:]}\n   po: {c['after'][:160]}…"
                      for n, c in enumerate(top))
    r = _chat_json(
        "Jsi editor zpravodajství a hlídáš, aby střih nezkreslil, co člověk řekl. U každého úderu vidíš, co zaznělo "
        f"před ním a po něm:\n{lines}\n\n"
        "Které údery by vytržené z kontextu změnily význam? Typicky: citace cizích slov nebo frází, které mluvčí "
        "odmítá (následuje „to nepotřebujeme slyšet“, „to nepomáhá“), ironie, nadsázka, řečnická otázka, na kterou "
        "hned odpoví opak, nebo věta, kterou okolí popírá. Vrať JSON {\"spatne\": [čísla úderů]} (prázdné pole, když nic).",
        80, schema={"type": "object", "properties": {"spatne": {"type": "array", "items": {"type": "integer",
                    "minimum": 1, "maximum": len(top)}}}, "required": ["spatne"]}, backend=backend)
    bad = {n for n in (r.get("spatne") or []) if isinstance(n, int) and 1 <= n <= len(top)}
    distorted = [text(top[n - 1]) for n in sorted(bad)]
    if len(top) - len(bad) >= 2:
        top = [c for n, c in enumerate(top, 1) if n not in bad]
    ctx.progress(0.8, "LLM skládá upoutávku")
    lines = "\n".join(f"U{n + 1} ({c['dur']:.0f} s): {text(c)}" for n, c in enumerate(top))
    r = _chat_json(
        f"Jsi střihač zpravodajských upoutávek (TV Nova). Zadání: {instruction}. Cílová délka {target:.0f} s.\n\n"
        f"Vybrané údery:\n{lines}\n\n"
        f"Sestav upoutávku ze 2–4 úderů v pořadí, jak půjdou za sebou, součet délek co nejblíž {target:.0f} s. "
        "První úder je hák (nejsilnější emoce nebo otázka), poslední nechá diváka v napětí a neprozradí rozuzlení. "
        "Údery se nesmí opakovat ani říkat totéž; dohromady mají naznačit příběh. Nesmí zkreslit, co mluvčí myslí: "
        "žádné citace cizích slov, ironie ani věty, které mluvčí odmítá (vytržené by znamenaly opak). "
        'Nejdřív v poli uvaha krátce zdůvodni, pak dej pořadí čísel úderů. JSON {"uvaha": "…", "poradi": [čísla]}.',
        400, schema={"type": "object", "properties": {"uvaha": {"type": "string", "maxLength": 600},
                                                      "poradi": {"type": "array", "minItems": 1, "maxItems": 5,
                                                                 "items": {"type": "integer", "minimum": 1, "maximum": len(top)}}},
                     "required": ["uvaha", "poradi"]}, backend=backend)
    order: list[dict] = []
    for n in r.get("poradi") or []:
        if isinstance(n, int) and 1 <= n <= len(top) and top[n - 1] not in order:
            order.append(top[n - 1])
    if not order:
        order = top[:2]
    # délka: nad 1,25× cíle ubírej prostřední údery (hák a konec drž), pod 0,85× přidej další nejlepší, který se vejde
    # (20s upoutávka měla s mezí 0,7× jen 15,5 s)
    while len(order) > 2 and sum(c["dur"] for c in order) > 1.25 * target:
        order.remove(max(order[1:-1], key=lambda c: c["dur"]))
    for c in top:
        if sum(x["dur"] for x in order) >= 0.85 * target:
            break
        if c not in order and sum(x["dur"] for x in order) + c["dur"] <= 1.15 * target:
            order.insert(max(1, len(order) - 1), c)
    total = sum(c["dur"] for c in order)
    return {
        "note": None, "picks": [p for c in order for p in _teaser_picks(c)], "estimatedSec": round(total, 1),
        "alternates": [u["id"] for c in top if c not in order for u in c["units"]], "dropped": [],
        "mode": "teaser", "passages": len(cands), "reason": r.get("uvaha"), "distorted": distorted,
        "ranked": [[round(sc, 1), text(c)[:60], c["dur"]] for sc, c in rated[:8]],
        "editorial": [], "thesis": None, "keyChapters": [], "offTopic": [], "topics": [], "balanceTopics": False,
        "general": False, "topicSec": {}, "addedForQuestionAnswer": [], "fixedFragments": [],
    }


def plan_edit(params: dict, ctx) -> dict:
    """Plán střihu čistě lokálně: LLM vybere kapitoly a věty podle zadání, pak dorovnání na cílovou délku."""
    path = params["path"]
    instruction = params["instruction"]
    target = float(params.get("targetSec") or 0)
    # věty, jejichž hranice stavba nahlásila jako slyšitelné (server je pošle při opakovaném plánu – uzavřená smyčka)
    avoid = {int(i) for i in (params.get("avoid") or [])}
    backend = params.get("backend") or "auto"
    if backend == "auto":  # Hermes (externí, rychlejší a přesnější), když běží; jinak vlastní model
        backend = gpu.auto_backend()
    t_start = time.time()
    gpu.CALL_STATS.clear()
    tr, _ = load_transcript(path)
    # skutečné pauzy mezi větami ze zvuku (jednou na plán, ~3 s u 30 min) – střih jen tam, kde je ticho
    pause_map = _pause_map(path, {s["id"]: s for s in tr["segments"]})
    # osnova musí být od stejného modelu (každý backend má vlastní cache; z cache je to okamžité)
    an = read_json(analyze({"path": path, "backend": backend}, ctx)["file"])
    segs = {s["id"]: s for s in tr["segments"]}
    weak = an.get("weak", {})
    chapters = an["chapters"]
    best_ids = {i for c in chapters for i in (c.get("best") or [])}
    n_ch = len(chapters)
    chapter_of = {i: k + 1 for k, c in enumerate(chapters) for i in range(c["from"], c["to"] + 1)}

    # "bez moderátora" v zadání -> jeho věty vyhoď natvrdo (model to sám nedodrží spolehlivě).
    # "bez úvodních a organizačních vět moderátora" – mezi "bez" a "moder…" může být víc slov (v rámci jedné fráze)
    # agent zadání občas přeformuluje ("Vynech … věty moderátora") – nejen "bez"
    no_moderator = re.search(r"(\bbez\b|vynech|nechci|žádn|nevybírej|nedávej)[^.;:(),]{0,60}?(moder|otázek|organiza)",
                             instruction, re.I)
    exclude = _moderator_speakers(segs) if no_moderator else set()
    # "co říká vypravěč", "jen výroky Vašíře" -> ostatní mluvčí model vůbec neuvidí. Sám to u filmu nedržel
    # (u "co říká vypravěč" vzal i 60 s jiného mluvčího). Jméno se hledá podle kmene (skloňování).
    only = _speakers_named(instruction, {s.get("speaker") for s in segs.values() if s.get("speaker")})
    if only:
        exclude |= {s.get("speaker") for s in segs.values() if s.get("speaker") and s.get("speaker") not in only}

    outline_lines = [
        f"K{i + 1}: věty {c['from']}–{c['to']} ({c['end'] - c['start']:.0f}s) [{', '.join(c.get('speakers') or [])}] "
        f"{c['title']} – {c['summary']}"
        for i, c in enumerate(chapters)
    ]
    goal = f" Cílová délka přibližně {target:.0f} s." if target else ""
    # hodnocení každé kapitoly zvlášť je u menšího modelu spolehlivější než volný výběr.
    # Po dávkách: u hodinového materiálu (50+ kapitol) se odpověď do limitu tokenů nevešla a kapitoly
    # za ~K16 dostaly automaticky 0 – celá druhá půlka pořadu se do výběru vůbec nedostala.
    # Bez zdůvodnění: generování je nejdražší část (~38 tok/s) a zdůvodnění psané až po skóre přesnosti nepomáhá.
    scores: dict[int, int] = {}
    BATCH = 12
    gpu.STAT_PHASE = "score"
    for b0 in range(0, n_ch, BATCH):
        ctx.check()
        m = min(BATCH, n_ch - b0)
        ctx.progress(0.02 + 0.08 * b0 / max(1, n_ch), f"LLM hodnotí kapitoly {b0 + 1}–{b0 + m}")
        # jen pole čísel v pořadí kapitol (délku hlídá gramatika): 1–2 tokeny na kapitolu místo ~18 u {"k":…,"score":…},
        # změřeno 2–3× rychleji při stejném výběru kapitol; u dávky 25 už model ke konci ztrácel pořadí
        sel = _chat_json(
            f"Jsi střihač. Zadání střihu: {instruction}.{goal}\n\nČást osnovy materiálu ({m} kapitol):\n"
            + "\n".join(outline_lines[b0: b0 + m]) + "\n\n"
            f"Ohodnoť každou z těchto {m} kapitol, jak moc patří do střihu podle zadání: 0 = nesouvisí, 1 = okrajově, "
            "2 = souvisí, 3 = přímo jádro zadání. Posuzuj podle názvu i shrnutí kapitoly. "
            f'Vrať JSON {{"s":[…]}} – pole {m} čísel ve stejném pořadí jako kapitoly (K{b0 + 1} až K{b0 + m}).',
            200,
            schema={"type": "object", "properties": {"s": {"type": "array", "items": {"type": "integer", "enum": [0, 1, 2, 3]},
                                                           "minItems": m, "maxItems": m}}, "required": ["s"]},
            backend=backend,
        )
        for j, sc in enumerate((sel.get("s") or [])[:m]):
            if isinstance(sc, int):
                scores[b0 + j + 1] = sc
    reasons = [f"K{k}={scores[k]}" for k in sorted(scores)]

    # i kapitoly se skóre 2: jen jádrové (3) zkusmo zrychlily plán, ale vzaly materiál vedlejšímu tématu
    # (bydlení vs. parkování 5:13) a krátkému materiálu (Diskuse1 74 s místo 120 s)
    chosen = ([k for k in range(1, n_ch + 1) if scores.get(k, 0) >= 2]
              or [k for k in range(1, n_ch + 1) if scores.get(k, 0) >= 1] or list(range(1, n_ch + 1)))

    # Krátký výrok / highlight (do 60 s): jedna souvislá pasáž místo skládání vět z celého materiálu.
    # Skládání vybralo „…napadlo mě úplně z ničeho nic.“ a pak skočilo jinam – to, co ji napadlo, vypadlo
    # (Talk 2026-11-20, 20 s); Claude bral jednu ucelenou pasáž s pointou. Upoutávka má vlastní dramaturgii.
    # Krátká upoutávka (do 40 s): 2–4 krátké údery ve stylu zpravodajství (hák, napětí na konec). Obecné skládání
    # vybralo 26 s souvislého vyprávění o diagnóze na 10s upoutávku (Talk 2026-11-20).
    if target and target <= 40 and re.search(r"upoutáv|upoutav|trailer|teaser|promo|pozvánk|pozvank", instruction, re.I):
        res = _plan_teaser(instruction, target, segs, exclude, backend, ctx, path, avoid)
        if res:
            res.update({"chapters": chosen, "why": "; ".join(reasons), "backend": backend,
                        "removedModerator": sorted(i for i in segs if segs[i].get("speaker") in exclude),
                        "elapsedSec": round(time.time() - t_start, 1), "llmStats": gpu.stats_summary(gpu.CALL_STATS)})
            return res

    if (target and target <= 60 and not params.get("noPassage")
            # „sestřih“ ne – česky tak zní skoro každé zadání („třicetisekundový sestřih: nejsilnější výrok…“)
            and not re.search(r"upoutáv|upoutav|trailer|teaser|promo|přehled|prehled|shrnut|víc témat|vic temat|všech",
                              instruction, re.I)):
        res = _plan_passage(instruction, target, segs, chapters, chosen, scores, exclude, backend, ctx, pause_map, avoid,
                            path)
        if res:
            res.update({"chapters": chosen, "why": "; ".join(reasons), "backend": backend,
                        "removedModerator": sorted(i for i in segs if segs[i].get("speaker") in exclude),
                        "elapsedSec": round(time.time() - t_start, 1), "llmStats": gpu.stats_summary(gpu.CALL_STATS)})
            return res

    gpu.STAT_PHASE = "topics"
    topics, balance_topics, general, relational = _instruction_topics(instruction, backend)
    # vztahové zadání ("hlavní spor", "co si vyčítají"): téma se nekontroluje (viz _instruction_topics),
    # ale na rozdíl od přehledu se výběr NEroztahuje po kapitolách – jinak z každé kapitoly vezme drobek
    # a nejostřejší pasáž (obvinění + obhajoba) se do střihu vůbec nevejde.
    no_topic_check = general or relational
    # Zadání na nejotřesnější/nejstrašnější místa: rozhoduje síla dopadu na diváka, ne informační hodnota.
    # Bez toho model odvodil obecnou tezi filmu („asymetrický boj, technologie“) a vybral drony a 3D tisk místo
    # Buči, E40 a divadla v Mariupolu (Ukraine from Above, Putin 2026-09-28). Samotné „nejsilnější“ to nespouští
    # – u debaty znamená silné argumenty, ne násilí.
    intense = bool(re.search(r"otřes|strašn|pekeln|krut|drastic|brutál|šokuj|děsiv|hrůz|horor", instruction, re.I))
    # upoutávka: jiná dramaturgie než sestřih – nekončí pointou, ale napětím, a nesmí prozradit konec
    trailer = bool(re.search(r"upoutáv|upoutav|trailer|teaser|promo", instruction, re.I))
    # výběr jen jako tři pole ID (2–3 tokeny na větu místo ~20 u objektu s tématem a prioritou – generování je
    # u lokálního modelu nejdražší); k tématům věty přiřadí až kontrola tématu
    ids_arr = {"type": "array", "items": {"type": "integer"}}
    pick_schema = {"type": "object", "properties": {"nutne": ids_arr, "dobre": ids_arr, "okrajove": ids_arr},
                   "required": ["nutne", "dobre", "okrajove"]}
    topic_hint = f" (témata zadání: {', '.join(topics)})" if topics else ""

    removed_moderator: list[int] = []
    WINDOW = 24

    def select(ks: list[int], skip: set[int], extra_rule: str = "") -> list[dict]:
        """LLM vybere věty v kapitolách ks (kromě vět ze skip); moderátora model ani nevidí.
        Malé kapitoly za sebou jdou do jednoho okna (s nadpisy) – pravidla v promptu se neopakují pro každou
        kapitolu o 7 větách zvlášť; velké kapitoly se dělí, aby se odpověď vešla do limitu tokenů."""
        windows: list[list[tuple[int, int]]] = [[]]  # okno = [(kapitola, id věty)]
        for k in ks:
            c = chapters[k - 1]
            ids = [i for i in range(c["from"], c["to"] + 1) if i in segs and i not in skip]
            removed_moderator.extend(i for i in ids if segs[i].get("speaker") in exclude and i not in removed_moderator)
            ids = [i for i in ids if segs[i].get("speaker") not in exclude]
            for i in ids:
                if len(windows[-1]) >= WINDOW:
                    windows.append([])
                windows[-1].append((k, i))
        windows = [w for w in windows if w]
        out: list[dict] = []
        for n, win in enumerate(windows):
            ctx.check()
            ctx.progress(0.12 + 0.7 * n / len(windows), f"LLM vybírá věty ({n + 1}/{len(windows)})")
            lines, prev_k = [], None
            for k, i in win:
                if k != prev_k:
                    lines.append(f"— Kapitola „{chapters[k - 1]['title']}“ —")
                    prev_k = k
                lines.append(_line(segs[i]) + _weak_note(weak.get(str(i)), i in best_ids))
            ids_in = {i: k for k, i in win}
            data = _chat_json(
                f"Jsi střihač. Zadání: {instruction}.\n"
                "Z vět níže vyber ty, které se hodí do střihu: celé myšlenky, otázka i odpověď. "
                "Věty označené „nepoužitelné“ nevybírej. Označení „drobná vada“ znamená jen přeřeknutí nebo chybu "
                "přepisu – takovou větu klidně vyber, pokud obsahově patří k zadání (nejsilnější výroky v debatě "
                "bývají řečené v zápalu, tedy s drobnou vadou). "
                "Nevybírej otázky ani organizační věty moderátora. Nevybírej věty začínající malým písmenem "
                "(jsou to pokračování předchozí věty), ledaže vybereš i tu předchozí. "
                "Vyber všechny věty, které k tématu zadání říkají něco podstatného – raději víc, na délku se zkracuje "
                "až potom. Věty o jiném tématu, i když jsou ve stejné kapitole, nevybírej. " + extra_rule
                + f"Rozděl vybrané věty: nutne = přímo k tématu zadání{topic_hint} a silné, dobre = přímo k tématu, "
                "okrajove = jen příbuzné téma, obecný výčet nebo kontext.\n\n"
                + "\n".join(lines)
                + '\n\nVrať pouze JSON {"nutne":[čísla vět],"dobre":[…],"okrajove":[…]} bez komentářů.',
                1500,
                schema=pick_schema,
                backend=backend,
            )
            for field, pr in (("nutne", 1), ("dobre", 2), ("okrajove", 3)):  # okrajové při zkracování půjdou první
                for pid in data.get(field) or []:
                    if isinstance(pid, int) and pid in ids_in:
                        out.append({"id": pid, "priority": pr, "chapter": ids_in[pid], "core": pr < 3, "topic": None})
        seen = set()
        out = [p for p in out if not (p["id"] in seen or seen.add(p["id"]))]
        out.sort(key=lambda p: p["id"])  # chronologicky – rozhovor zůstane srozumitelný
        for p in out:
            p["dur"] = segs[p["id"]]["end"] - segs[p["id"]]["start"]
        return out

    def is_question(sid: int) -> bool:
        s, nxt = segs.get(sid), segs.get(sid + 1)
        if not (s and nxt and s["text"].rstrip().endswith("?")):
            return False
        # bez diarizace/speakerTracks věty nemají mluvčího vůbec – pak nejde poznat,
        # že odpovídá někdo jiný, ale otázka pořád potřebuje odpověď, tak to nekontrolovat.
        if not s.get("speaker") and not nxt.get("speaker"):
            return True
        return bool(nxt.get("speaker") and nxt.get("speaker") != s.get("speaker"))

    def continues(sid: int) -> bool:
        """Věta navazuje na předchozí a bez ní nedává smysl: začíná malým písmenem (pokračování souvětí),
        nebo výčtem/odkazem ("Za druhé…", "Tím…") – dvakrát "Za druhé" za sebou bez "za prvé" zní jako chyba střihu."""
        text = segs[sid]["text"].strip()
        # i začátek interpunkcí: Whisper rozdělí „U.S.“ na „…u“ + „.s officials say…“
        return bool(text) and (text[0].islower() or re.match(r"[.,;:–-]", text) is not None
                               or bool(re.match(r"(za (druhé|třetí|další)|tím)\b", text, re.I)))

    added: list[int] = []
    fixed_fragments: list[int] = []

    def complete(picks: list[dict]) -> list[dict]:
        """Doplň k výběru, co k němu nutně patří: druhou polovinu dvojice otázka–odpověď a začátek souvětí."""
        # otázka a odpověď patří k sobě: chybějící polovinu doplň (se stejnou prioritou)
        kept = {p["id"] for p in picks}
        for sid in sorted(segs):
            if is_question(sid) and ((sid in kept) != ((sid + 1) in kept)):
                add = sid + 1 if sid in kept else sid
                if segs[add].get("speaker") in exclude:  # otázku moderátora zpět nepřidávej
                    continue
                src = next(p for p in picks if p["id"] in (sid, sid + 1))
                picks.append({"id": add, "priority": src["priority"], "chapter": src.get("chapter"), "core": src.get("core"),
                              "topic": src.get("topic"), "dur": segs[add]["end"] - segs[add]["start"]})
                kept.add(add)
                added.append(add)
        picks.sort(key=lambda p: p["id"])
        # věta začínající malým písmenem je pokračování předchozí – buď doplň předchozí, nebo ji vyhoď,
        # jinak střih začne uprostřed souvětí ("…možnost pro své investice někde jinde.")
        # A naopak: když vybraná věta pokračuje další (ta začíná malým písmenem – "…pro seniory," + "což je něco,
        # co bychom rádi napravili"), doplň i to pokračování, jinak souvětí skončí uprostřed.
        for _ in range(2):  # doplněná věta může sama být pokračováním
            kept = {p["id"] for p in picks}
            for p in list(picks):
                sid = p["id"]
                nxt = segs.get(sid + 1)
                if (nxt and (sid + 1) not in kept and nxt.get("speaker") == segs[sid].get("speaker")
                        and nxt["text"].strip()[:1].islower()):
                    picks.append({"id": sid + 1, "priority": p["priority"], "chapter": p.get("chapter"), "core": p.get("core"),
                                  "topic": p.get("topic"), "dur": nxt["end"] - nxt["start"]})
                    fixed_fragments.append(sid + 1)
                    kept.add(sid + 1)
                if not continues(sid) or (sid - 1) in kept:
                    continue
                prev = segs.get(sid - 1)
                if prev and prev.get("speaker") not in exclude:
                    picks.append({"id": sid - 1, "priority": p["priority"], "chapter": p.get("chapter"), "core": p.get("core"),
                                  "topic": p.get("topic"), "dur": prev["end"] - prev["start"]})
                    fixed_fragments.append(sid - 1)
                    kept.add(sid - 1)
                else:
                    picks = [q for q in picks if q["id"] != sid]
            picks.sort(key=lambda p: p["id"])
        return picks

    def to_units(picks: list[dict]) -> list[dict]:
        """Celky pro zkracování: dvojice otázka–odpověď ani věta s pokračováním se nikdy nerozdělí."""
        out: list[dict] = []
        for p in picks:
            prev_id = out[-1]["ids"][-1] if out else None
            if prev_id is not None and p["id"] == prev_id + 1 and (is_question(prev_id) or continues(p["id"])):
                u = out[-1]
                u["ids"].append(p["id"])
                u["priority"] = min(u["priority"], p["priority"])
                u["core"] = u["core"] or bool(p.get("core"))
                u["topic"] = u["topic"] or p.get("topic")
                u["dur"] += p["dur"]
            else:
                out.append({"ids": [p["id"]], "priority": p["priority"], "dur": p["dur"],
                            "score": scores.get(p.get("chapter"), 2), "core": bool(p.get("core")), "topic": p.get("topic")})
        for u in out:  # hlavní mluvčí celku (podle délky řeči)
            spk: dict[str, float] = {}
            for i in u["ids"]:
                spk[segs[i].get("speaker") or ""] = spk.get(segs[i].get("speaker") or "", 0) + segs[i]["end"] - segs[i]["start"]
            u["speaker"] = max(spk, key=spk.get)
        return out

    gpu.STAT_PHASE = "select"
    units = to_units(complete(select(chosen, set())))

    # "argumenty obou hostů" -> při zkracování hlídej, aby jeden mluvčí nepřevážil (jinak model i zkracování
    # sklouznou k tomu, kdo mluví víc a delšími větami)
    balance = bool(re.search(r"\b(ob(ou|a|ě)|všech|každ\w*)\b[^.;:]{0,30}?(host|mluvčí|stran|účastník|kandidát|řečník)",
                             instruction, re.I))
    speakers = {u["speaker"] for u in units if u["speaker"]}
    balance = balance and len(speakers) >= 2

    def over(u: dict) -> bool:
        """Mluvčí celku má v aktuálním výběru víc než férový podíl (+5 procentních bodů)."""
        if not balance or not u["speaker"]:
            return False
        cur = sum(x["dur"] for x in units)
        mine = sum(x["dur"] for x in units if x["speaker"] == u["speaker"])
        return cur > 0 and mine / cur > 1 / len(speakers) + 0.05

    def over_topic(u: dict) -> bool:
        """Téma celku má víc než férový podíl (+10 bodů) – zadání "o bydlení a parkování" chce obojí.
        Počítají se jen témata, ke kterým je materiál (prázdné téma by férový podíl rozmělnilo)."""
        live = {x["topic"] for x in units if x.get("topic")}
        if not balance_topics or len(live) < 2 or not u.get("topic"):
            return False
        cur = sum(x["dur"] for x in units if x.get("topic"))
        mine = sum(x["dur"] for x in units if x.get("topic") == u["topic"])
        return cur > 0 and mine / cur > 1 / len(live) + 0.1

    def over_chapter(u: dict) -> bool:
        """Obecné zadání (přehled celého pořadu): kapitola celku už je ve výběru zastoupená jiným celkem –
        přehled má pokrýt víc témat, ne tři úryvky z jedné pasáže."""
        if not general:
            return False
        k = chapter_of.get(u["ids"][0])
        return any(x is not u and chapter_of.get(x["ids"][0]) == k for x in units)

    viol = lambda u: int(over(u)) + int(over_topic(u)) + int(over_chapter(u))  # noqa: E731
    drop_key = lambda u: (u["core"], -viol(u), u["score"], -u["priority"], u["dur"])  # noqa: E731
    keep_key = lambda u: (not u["core"], viol(u), -u["score"], u["priority"])  # noqa: E731

    def verify(cand: list[dict]) -> list[int]:
        """Ověř téma vět v celcích; celky mimo téma vrať jako vyřazené ID, ostatním zpřesni téma."""
        if no_topic_check:  # přehled ani vztahové zadání nemají téma, podle kterého by se dalo vyřazovat
            return []
        dependent: set[int] = set()
        res = _verify_topic(instruction, topics, balance_topics, [i for u in cand for i in u["ids"]], segs, an,
                            chapter_of, backend, dependent)
        bad = [i for i, t in res.items() if t == "jiné"]
        taken = {i for x in units + cand for i in x["ids"]}
        merged: list[dict] = []
        for u in cand:
            got = [res[i] for i in u["ids"] if res.get(i) in topics]
            if got:
                u["topic"] = got[0]
            # celek začíná větou, která stojí na předchozí ("Tím si to zhoršujeme.") -> musí jít s předchozí větou
            # téhož mluvčího: je-li ta v jiném celku, celky se sloučí (jinak zkracování vyhodí jen ji a věta zůstane
            # viset), jinak se předchozí věta předřadí. Odpověď na otázku řeší párování otázka–odpověď.
            first = u["ids"][0]
            prev = segs.get(first - 1)
            if (first not in dependent or first in bad or not prev
                    or prev.get("speaker") != segs[first].get("speaker") or prev.get("speaker") in exclude):
                continue
            owner = next((x for x in cand if x is not u and x not in merged and (first - 1) in x["ids"]), None)
            if owner:
                owner["ids"] += u["ids"]
                owner["dur"] += u["dur"]
                owner["core"] = owner["core"] or u["core"]
                owner["priority"] = min(owner["priority"], u["priority"])
                merged.append(u)
            elif (first - 1) not in taken:
                u["ids"].insert(0, first - 1)
                u["dur"] += prev["end"] - prev["start"]
                taken.add(first - 1)
                fixed_fragments.append(first - 1)
                # předřazená věta může být sama pokračováním („But“ + „despite months of this…“) – doplň řetězově
                for _ in range(3):
                    h = u["ids"][0]
                    pp = segs.get(h - 1)
                    if not continues(h) or not pp or (h - 1) in taken or pp.get("speaker") in exclude:
                        break
                    u["ids"].insert(0, h - 1)
                    u["dur"] += pp["end"] - pp["start"]
                    taken.add(h - 1)
                    fixed_fragments.append(h - 1)
        if merged:
            cand[:] = [x for x in cand if not any(x is m for m in merged)]
        return bad

    def trim(hi: float, lo: float) -> list[dict]:
        """Vyhazuj celky, dokud se výběr nevejde pod hi. Nejdřív celky, které nejsou přímo o tématu zadání
        (okrajově), pak nadměrně zastoupeného mluvčího, pak z kapitol méně souvisejících se zadáním, v nich nejnižší
        priorita a nejkratší (vytržené krátké věty = víc střihů, méně myšlenky); jádro zadání přijde na řadu až nakonec. Celek, jehož vyhozením by střih spadl pod lo,
        se přeskočí (když to jde) – jinak by jedna dlouhá věta utnula stopáž o 20 s."""
        out = []
        total = sum(u["dur"] for u in units)
        while total > hi and len(units) > 1:
            order = sorted(units, key=drop_key)
            # vstup a pointa redakčního výběru (skóre 4) až úplně nakonec: dřív se přeskočil dlouhý střední úsek
            # (spadlo by to pod lo) a místo něj šly krátká pointa a vstup
            free = [u for u in order if u["score"] < 4]
            if free and len(free) < len(order):
                u = next((u for u in free if total - u["dur"] >= lo), None)
                if u is None:
                    if total <= hi * 1.09:
                        break
                    u = min(free, key=lambda u: abs(total - u["dur"] - (hi + lo) / 2))
                units.remove(u)
                out.append(u)
                total -= u["dur"]
                continue
            u = next((u for u in order if total - u["dur"] >= lo), None)
            if u is None:
                # nic nejde vyhodit bez pádu pod dolní mez: mírné přetažení (do +9 % nad horní mez) je lepší než
                # vyhodit vstup/pointu (skóre 4) – dřív „nejbližší k cíli“ vyhodilo právě pointu
                if total <= hi * 1.09:
                    break
                u = min(order, key=lambda u: (u["score"] >= 4, abs(total - u["dur"] - (hi + lo) / 2)))
            units.remove(u)
            out.append(u)
            total -= u["dur"]
        return out

    def refill(pool: list[dict], hi: float, lo: float) -> None:
        """Krátký výběr dorovnej celky z poolu (nejrelevantnější první), dokud se vejdou do horní meze."""
        for u in sorted(pool, key=keep_key):
            total = sum(x["dur"] for x in units)
            if total >= lo:
                break
            if total + u["dur"] <= hi:
                units.append(u)
                pool.remove(u)

    def rebalance(pool: list[dict], hi: float, lo: float) -> None:
        """Vyvážení výměnou: celek nadměrně zastoupeného mluvčího/tématu nahraď celky z poolu, které to nezhorší.
        Samotné zkracování to nezvládne, když jsou celky převažující strany dlouhé – vyhozením kteréhokoli by střih
        spadl pod dolní mez, a tak místo nich vyhazovalo krátké celky slabší strany (bydlení 140 s : parkování 35 s)."""
        def imbalance() -> float:
            return sum(u["dur"] for u in units if viol(u))

        for _ in range(8):
            before = imbalance()
            if not before:
                return
            improved = False
            for out_u in sorted([u for u in units if viol(u)], key=lambda u: (u["core"], -u["priority"], u["dur"])):
                base = sum(u["dur"] for u in units) - out_u["dur"]
                units.remove(out_u)  # podíly se počítají bez vyměňovaného celku
                add, t = [], base
                for c in sorted([c for c in pool if not viol(c) and (c["core"] or not out_u["core"])], key=keep_key):
                    if t + c["dur"] <= hi:
                        add.append(c)
                        t += c["dur"]
                        if t >= lo:
                            break
                units.extend(add)
                if t >= lo and imbalance() < before:
                    pool.append(out_u)
                    for c in add:
                        pool.remove(c)
                    improved = True
                    break
                for c in add:  # nevyšlo – vrátit
                    units.remove(c)
                units.append(out_u)
            if not improved:
                return

    # Redakční výběr: kandidátů je mnohem víc než cíl (film 90 min → 1 min: 900 s kandidátů) – zkracování podle
    # priority kapitol a délek pak nechá cokoli „k tématu“ (výkřiky z bojiště „Vylezte! Vylezte!“) a nevznikne
    # srozumitelný celek. Model proto uvidí kandidáty jako celky s textem a délkou a sestaví střih jako střihač:
    # úvod/kontext, jádro, pointa; souvislý komentář místo útržků. (Srovnání 2026-09-24: GPT, který přepis četl
    # sám a vybíral takhle, 8/10; lokální výběr bez tohoto kroku 4/10.)
    editorial: list[int] = []
    ed_left: list[dict] = []
    thesis = ""
    key_ch: set[int] = set()
    key_ch_pointa: set[int] = set()
    if target and len(units) > 6 and sum(u["dur"] for u in units) > 2 * target:
        gpu.STAT_PHASE = "thesis"
        ctx.progress(0.83, "LLM hledá hlavní myšlenku a pointu")
        # teze a klíčové kapitoly z osnovy: výběr vět po oknech nevidí celek – pointu filmu („stínová armáda
        # dobrovolníků… nevzdají se“) v kapitole se skóre 2 nevybral, i když na ni celý film směřuje
        th = _chat_json(
            f"Jsi střihač. Zadání: {instruction}. Cílová délka {target:.0f} s.\nOsnova materiálu:\n"
            + "\n".join(outline_lines)
            + "\n\nNapiš jednou větou hlavní myšlenku, kterou má střih divákovi předat (co je odpověď materiálu na "
            "zadání), a vyber kapitoly: úvod = nejlepší vstup do tématu (kontext, otázka), pointa = kde materiál "
            "tu myšlenku nejsilněji vysloví nebo shrne (často ke konci). "
            + ("Zadání nechce shrnutí poselství filmu, ale jeho nejotřesnější místa: myšlenka má pojmenovat to "
               "nejhorší, co materiál konkrétně dokládá (zločiny, oběti, svědectví), ne obecné téma (technika, "
               "strategie). " if intense else "")
            + 'Vrať JSON {"teze":"…","uvod":[čísla kapitol],"pointa":[čísla kapitol]}.',
            300,
            schema={"type": "object", "properties": {
                "teze": {"type": "string"},
                "uvod": {"type": "array", "items": {"type": "integer"}, "maxItems": 2},
                "pointa": {"type": "array", "items": {"type": "integer"}, "maxItems": 2}},
                "required": ["teze", "uvod", "pointa"]},
            backend=backend,
        )
        thesis = str(th.get("teze") or "").strip()
        key_ch_pointa = {k for k in (th.get("pointa") or []) if isinstance(k, int)}
        key_ch = {k for k in (th.get("uvod") or []) + (th.get("pointa") or []) if isinstance(k, int) and 1 <= k <= n_ch}
        # věty klíčových kapitol, které výběr po oknech nevzal, se přidají jako kandidáti (celé kapitoly, bez
        # moderátora/vyloučených mluvčích a bez slabých vět)
        have_ids = {i for u in units for i in u["ids"]}
        extra = []
        for k in sorted(key_ch):
            c = chapters[k - 1]
            for i in range(c["from"], c["to"] + 1):
                if i in segs and i not in have_ids and segs[i].get("speaker") not in exclude and not weak.get(str(i)):
                    extra.append({"id": i, "priority": 2, "chapter": k, "core": True, "topic": None,
                                  "dur": segs[i]["end"] - segs[i]["start"]})
        if extra:
            units[:] = sorted(units + [u for u in to_units(complete(extra)) if not set(u["ids"]) & have_ids],
                              key=lambda u: u["ids"][0])
        # výkřiky a povely („Гагарин! Пацани тримаєм!“, „OK, guys, jump in.“) do redakčního výběru nepouštěj –
        # model je i přes pokyn vybíral do „příběhu“; neplatí, když zadání chce atmosféru/akci
        if not re.search(r"atmosf|akc|emoc|bojov\w* scén|výkřik", instruction, re.I):
            def shout(u: dict) -> bool:
                text = " ".join(segs[i]["text"].strip() for i in u["ids"])
                nw = len(re.findall(r"\w+", text))
                if "!" in text and nw <= 10:
                    return True
                # krátká oznamovací věta („That person was shot.“) je u otřesného zadání pointa, ne výkřik
                return nw <= 6 and not (intense and nw >= 3 and text.rstrip().endswith("."))
            loud = [u for u in units if shout(u)]
            if len(units) - len(loud) >= 4:
                units[:] = [u for u in units if not shout(u)]
        # upoutávka = krátké střihy: dlouhé monology (Gummo: 11 s o otrávených kočkách, 30 s vyprávění) do ní
        # nepatří, i když jsou silné – model je bral, přestože prompt chce krátké údery
        if trailer:
            short_units = [u for u in units if u["dur"] <= 8.0]
            if sum(u["dur"] for u in short_units) >= 2 * target:
                units[:] = short_units
        # Uvozovací a organizační věty moderátora ("Začíná další vydání pořadu…", "Magistrát má 45 členů",
        # "vašich třicet vteřin pro diváky") nejsou obsah, ale mechanika pořadu – a model je i přes výslovný
        # zákaz v promptu bral jako "vstup s kontextem". Proto se do redakce vůbec nenabízejí. Otázky moderátora
        # zůstávají: když se vybere odpověď, complete() otázku sám doplní zpět.
        hosts = _moderator_speakers(segs)
        if hosts and len({s.get("speaker") for s in segs.values() if s.get("speaker")}) >= 3:
            def host_filler(u: dict) -> bool:
                if u.get("speaker") not in hosts:
                    return False
                return "?" not in " ".join(segs[i]["text"] for i in u["ids"])
            kept_units = [u for u in units if not host_filler(u)]
            if len(kept_units) >= 4:
                units[:] = kept_units
        gpu.STAT_PHASE = "edit"
        ctx.progress(0.85, "LLM skládá střih jako celek")
        _dbg = os.environ.get("PLAN_DEBUG")  # ladění redakční fáze: PLAN_DEBUG=<soubor> (vypíše celky + výběr)
        cand_lines = []
        unit_line: dict[int, str] = {}
        prev_k = None
        for n, u in enumerate(units, 1):
            k = chapter_of.get(u["ids"][0])
            if k != prev_k and k:
                cand_lines.append(f"— K{k} „{chapters[k - 1]['title']}“{' (klíčová)' if k in key_ch else ''} —")
                prev_k = k
            text = " ".join(segs[i]["text"].strip() for i in u["ids"])
            unit_line[n] = (f"U{n} ({u['dur']:.0f} s){' [' + u['speaker'] + ']' if u.get('speaker') else ''}: "
                            + (text[:420] + "…" if len(text) > 420 else text))
            cand_lines.append(unit_line[n])
        # podíl řeči mluvčích – model z toho pozná vypravěče (S2 = 45 % řeči) od hlasů z bojiště
        spk_dur: dict[str, float] = {}
        for x in segs.values():
            if x.get("speaker"):
                spk_dur[x["speaker"]] = spk_dur.get(x["speaker"], 0) + x["end"] - x["start"]
        tot_spk = sum(spk_dur.values()) or 1
        spk_line = ", ".join(f"{k} {100 * v / tot_spk:.0f} %" for k, v in sorted(spk_dur.items(), key=lambda kv: -kv[1])[:6])
        data = _chat_json(
            f"Jsi zkušený střihač dokumentu a zpravodajství. Zadání: {instruction}. Cílová délka {target:.0f} s.\n"
            + (f"Hlavní myšlenka, kterou má střih předat: {thesis}\n" if thesis else "")
            + (f"Podíl řeči mluvčích v materiálu: {spk_line} (kdo mluví nejvíc a souvisle, bývá vypravěč).\n"
               if len(spk_dur) > 1 else "")
            + "Níže jsou kandidátní úseky (v pořadí, jak jdou v materiálu, s nadpisy kapitol) s délkou v sekundách. "
            "Sestav z nich nejlepší střih jako mistr střihu: musí dávat smysl i divákovi, který materiál neviděl – "
            "silný vstup, jádro, které na něj odpovídá, a pointa na konec, která hlavní "
            "myšlenku vysloví (ne náhodná informace). Úseky na sebe logicky navazují, žádná myšlenka se neopakuje. "
            # "vstup (kontext nebo otázka)" svádělo model k moderátorovu úvodnímu výčtu ("Magistrát má 45 členů,
            # k většině je potřeba 23 křesel…") – divák z toho nepozná, o co ve střihu jde.
            "Vstup musí být výrok, který rovnou nastolí téma zadání (silné tvrzení, konkrétní výtka, jasně "
            "pojmenovaný problém) – NE uvozovací a organizační věty moderátora, představování hostů ani výčty "
            "čísel o složení zastupitelstva a podobná administrativa. "
            + ("Je to UPOUTÁVKA, ne shrnutí: začni hákem (nejsilnější replika nebo otázka), pak krátké úderné "
               "repliky, které stupňují napětí a naznačí konflikt a sázky. Krátké věty, výkřiky a repliky z akce "
               "jsou tu žádoucí. NEPROZRAZUJ rozuzlení ani konec příběhu (nic z poslední čtvrtiny, co odhaluje, "
               "jak to dopadne) a neskončí pointou – skonči napínavou replikou nebo otázkou. "
               if trailer else "")
            + ("Zadání chce nejotřesnější místa: řaď úseky podle síly dopadu na diváka, ne podle informační "
               "hodnoty. Přednost mají konkrétní svědectví o násilí, obětech a zločinech (co se komu stalo, kolik "
               "mrtvých, kdo to udělal) a výpovědi očitých svědků v první osobě – i krátká věta jako „Ten člověk "
               "byl zastřelen.“ Techniku, zbraně, strategii a historické pozadí nevybírej, nanejvýš jednu větu jako "
               "nutný kontext. Pokryj několik různých nejsilnějších událostí z celého materiálu (každou pár "
               "úseky), ne jeden dlouhý souvislý blok. Postavu uveď, než promluví. "
               if intense else
               "Dej přednost souvislým větám vypravěče, komentáře a výpovědím, které samy o sobě něco sdělí (fakta, "
               "souvislosti, osobní zkušenost); postavu uveď, než promluví. ")
            + "Nevybírej výkřiky, povely, citoslovce, "
            "krátké repliky bez kontextu, útržky ani opakování – ledaže zadání výslovně chce atmosféru nebo akci. "
            f"Součet délek vybraných úseků drž kolem {target:.0f} s (nejvýš {target * 1.15:.0f} s), "
            # Samotný součet sekund model neuhlídá (z 180 celků vybral 52 = 3× cíl) a mechanické zkracování
            # pak vyhodí právě ty nejostřejší krátké úseky. Konkrétní počet drží výběr mnohem líp.
            f"to je přibližně {max(3, round(target / max(4.0, _median_dur(units)))):.0f} úseků – vybírej po jednom "
            "to nejsilnější, neber souvislé bloky za sebou. Když je kapitola označená „(klíčová)“, musí v střihu "
            "být zastoupená konkrétním výrokem (jmenovaná věc, číslo, konkrétní výtka), ne obecnou větou.\n"
            # Vztahové zadání (spor, výčitky, rozdíly) bez tohohle sklouzlo k souvislému programu jedné strany
            # (Ferancová 75 s ze 119) – divák pak nevidí spor, ale monolog.
            + ("Zadání je o sporu/rozdílech: obě strany musí dostat zhruba stejný prostor a musí na sebe "
               "reagovat (tvrzení – protitvrzení), ne dva oddělené monology. Konkrétní vzájemná výtka má "
               "přednost před obecným popisem vlastního programu.\n" if relational else "")
            + "\n"
            + "\n".join(cand_lines)
            + '\n\nNejdřív jednou větou osnova střihu (čím začne, co je jádro, čím skončí), pak čísla úseků. '
            'Vrať JSON {"osnova":"…","u":[čísla vybraných úseků]}.',
            500,
            schema={"type": "object", "properties": {"osnova": {"type": "string"},
                                                     "u": {"type": "array", "items": {"type": "integer"}, "maxItems": 60}},
                    "required": ["osnova", "u"]},
            backend=backend,
        )
        pick = {n for n in (data.get("u") or []) if isinstance(n, int) and 1 <= n <= len(units)}
        psum = sum(units[n - 1]["dur"] for n in pick)
        if _dbg:
            with open(_dbg, "w", encoding="utf-8") as fh:
                fh.write("=== CELKY, KTERE REDAKCE VIDI ===\n" + "\n".join(cand_lines))
                fh.write(f"\n\n=== OSNOVA MODELU ===\n{data.get('osnova')}\n")
                fh.write(f"\n=== VYBRANE CELKY ===\n{sorted(pick)}\n")
                fh.write("\n".join(unit_line[n] for n in sorted(pick)))
        for _round in range(2):
            if not (pick and psum > 1.3 * target):
                break
            # model délku přestřelil (film: 37 úseků místo ~10) – mechanické zkracování by pak vyhodilo pointu;
            # ať svůj výběr zkrátí sám, se součtem délek před očima
            sub = sorted(pick)
            data = _chat_json(
                f"Jsi střihač. Zadání: {instruction}. Tvůj výběr má {psum:.0f} s, cíl je {target:.0f} s. Zkrať ho: "
                "nech jen úseky, bez kterých by střih nedával smysl – úvod, jádro a pointu na konec zachovej, "
                + ("vyhoď nejdřív techniku, strategii a obecný komentář, svědectví o obětech a zločinech nech, "
                   if intense else "")
                + f"součet délek {target * 0.9:.0f}–{target * 1.1:.0f} s.\n\n"
                + "\n".join(unit_line[n] for n in sub)
                + '\n\nVrať JSON {"u":[čísla ponechaných úseků]}.',
                300,
                schema={"type": "object", "properties": {"u": {"type": "array", "items": {"type": "integer"},
                                                               "maxItems": 40}}, "required": ["u"]},
                backend=backend,
            )
            short = {n for n in (data.get("u") or []) if isinstance(n, int) and n in pick}
            if short and sum(units[n - 1]["dur"] for n in short) >= 0.5 * target:
                pick = short
            psum = sum(units[n - 1]["dur"] for n in pick)
        # pointa je povinná: výběr bez jediného úseku z kapitol, které model sám označil za pointu, končil
        # náhodnou zprávou – doplň z poslední pointové kapitoly (až ~20 % cíle)
        # (u upoutávky ne – pointová kapitola bývá u konce filmu a prozradila by rozuzlení)
        if not trailer and pick and key_ch_pointa and not any(chapter_of.get(units[n - 1]["ids"][0]) in key_ch_pointa for n in pick):
            cand = [n for n, u in enumerate(units, 1) if chapter_of.get(u["ids"][0]) in key_ch_pointa]
            budget = 0.2 * target
            for n in reversed(cand):
                if units[n - 1]["dur"] <= budget:
                    pick.add(n)
                    budget -= units[n - 1]["dur"]
        # Stejně povinná je i každá další klíčová kapitola: model ji sám označil za nosnou, přesto ji uměl
        # přeskočit (u debaty vynechal celou "Kritika parkovací politiky" i s konkrétní výtkou a čísly
        # a nahradil ji obecným popisem programu). Doplň z ní jeden úsek – přednost má ten s číslem,
        # protože konkrétní výtka ("utratilo se tři čtvrtě milionu") unese víc než obecná věta.
        for k in sorted(key_ch - key_ch_pointa):
            if not pick or any(chapter_of.get(units[n - 1]["ids"][0]) == k for n in pick):
                continue
            # moderátora sem nepouštěj: kapitola "Úvod a hosté pořadu" bývá klíčová (thesis ji označí za vstup)
            # a její jediný úsek je znělka ("Začíná další vydání pořadu…", končí otazníkem, takže projde i
            # filtrem mechaniky) – vynucený vstup pak divákovi neřekne vůbec nic o tématu
            cand = [n for n, u in enumerate(units, 1)
                    if chapter_of.get(u["ids"][0]) == k and u["dur"] <= 0.2 * target
                    and u.get("speaker") not in hosts]
            if not cand:
                continue
            with_num = [n for n in cand if re.search(r"\d|milion|tisíc|procent",
                                                     " ".join(segs[i]["text"] for i in units[n - 1]["ids"]), re.I)]
            pick.add((with_num or sorted(cand, key=lambda n: -units[n - 1]["dur"]))[0])
        if pick and sum(units[n - 1]["dur"] for n in pick) >= 0.5 * target:
            ed_left = [u for n, u in enumerate(units, 1) if n not in pick]
            units[:] = [u for n, u in enumerate(units, 1) if n in pick]
            for u in units:  # redakčně vybrané mají při dorovnání délky přednost
                u["core"] = True
                u["priority"] = 1
                u["score"] = 3  # skóre kapitoly už nerozhoduje – vybíral redaktor celek
            # vstup a pointa se při dorovnání délky zahazují až úplně nakonec (zkracuje se ze středu)
            pointa_u = [u for u in units if chapter_of.get(u["ids"][0]) in key_ch_pointa] or units[-1:]
            for u in units[:1] + pointa_u[-1:]:
                u["score"] = 4
            editorial = [i for u in units for i in u["ids"]]


    def refers_back(sid: int) -> bool:
        """Věta stojí na předchozí: začíná spojkou nebo zájmenem, které odkazuje dozadu („And the question remains, how
        is this possible?“, „It's who they are.“, „Proto…“, „Tohle…“) – bez předchozí věty divák neví, o co jde."""
        t = segs[sid]["text"].strip()
        return bool(re.match(r"(and|but|so|then|this|that|these|those|it|it's|they|he|she|there|a|ale|proto|tak|tohle|"
                             r"to|ten|ta|ti|on|ona|oni|takže|tím|potom)\b", t, re.I))

    def attach_context(refs: bool = True) -> None:
        """Pojistka souvětí a kontextu, připojená PŘÍMO do celku (zkracování pak počítá se skutečnou délkou a kontext
        vyhodí jen spolu s jeho větou): začátek souvětí (řetězově), pokračování začínající malým písmenem a krátká
        předchozí věta téhož mluvčího u věty, která na ni odkazuje („how is THIS possible?“). Z plánu nikdy neodejde
        useknutá věta (Andrijivka: „medics could not believe…“ bez „But the / further they advanced…“)."""
        owner = {i: u for u in units for i in u["ids"]}
        for _ in range(4):
            grown = False
            for i in sorted(owner):
                u = owner[i]
                prv, nxt = segs.get(i - 1), segs.get(i + 1)
                if prv and (i - 1) not in owner and prv.get("speaker") not in exclude and (
                        continues(i) or (refs and refers_back(i) and prv.get("speaker") == segs[i].get("speaker")
                                         and segs[i]["start"] - prv["end"] < 2.5 and prv["end"] - prv["start"] < 9
                                         and not any(w in ("vata", "prázdné") for w in weak.get(str(i - 1), [])))):
                    u["ids"].insert(u["ids"].index(i), i - 1)
                    u["dur"] += prv["end"] - prv["start"]
                    owner[i - 1] = u
                    fixed_fragments.append(i - 1)
                    grown = True
                if (nxt and (i + 1) not in owner and nxt.get("speaker") == segs[i].get("speaker")
                        and re.match(r"[a-zà-ž]", nxt["text"].strip())):
                    u["ids"].insert(u["ids"].index(i) + 1, i + 1)
                    u["dur"] += nxt["end"] - nxt["start"]
                    owner[i + 1] = u
                    fixed_fragments.append(i + 1)
                    grown = True
            if not grown:
                break

    if editorial:
        attach_context()
    hi, lo = (target * 1.03, target * 0.97) if target else (float("inf"), 0.0)
    # kontrola tématu jen u celků, které mají šanci projít (~1,6× cíle), ne u všech kandidátů
    pre_pool = (trim(target * 1.6, target * 1.5) if target else []) + ed_left
    gpu.STAT_PHASE = "verify"
    ctx.progress(0.9, "LLM kontroluje téma vybraných vět")
    off_topic = verify(units) if units else []
    units[:] = [u for u in units if not any(i in off_topic for i in u["ids"])]
    pool = trim(hi, lo)
    refill(pool, hi, lo)
    if sum(u["dur"] for u in units) < lo and pre_pool:
        # po vyřazení mimo téma chybí materiál: ověř i nejlepší z předběžně vyřazených a dorovnej jimi
        cand = sorted(pre_pool, key=keep_key)[:12]
        pre_pool = [u for u in pre_pool if u not in cand]
        bad = verify(cand)
        off_topic += bad
        cand = [u for u in cand if not any(i in bad for i in u["ids"])]
        refill(cand, hi, lo)
        pool += cand
    if target and sum(u["dur"] for u in units) < lo:
        # málo materiálu (model byl přísný, kontrola tématu něco vyřadila): doplňkový výběr z vět jádrových
        # kapitol, které zatím nikdo nevybral
        gpu.STAT_PHASE = "topup"
        ctx.progress(0.95, "LLM doplňuje krátký střih")
        have = {i for u in units + pool + pre_pool for i in u["ids"]} | set(off_topic)
        ks = [k for k in chosen if scores.get(k, 0) >= 3] or chosen
        extra = [u for u in to_units(complete(select(ks, have, "Střih je zatím krátký – vyber další věty, které k tématu "
                                                               "zadání něco přidávají. ")))
                 if not any(i in have for i in u["ids"])]
        if extra:
            bad = verify(extra)
            off_topic += bad
            extra = [u for u in extra if not any(i in bad for i in u["ids"])]
            refill(extra, hi, lo)
            pool += extra
    if target:
        rebalance(pool, hi, lo)
        if any(viol(u) for u in units) and pre_pool:
            # slabší strana může mít materiál jen mezi předběžně vyřazenými (ty ještě nemají ověřené téma) –
            # ověř nejlepší z nich a zkus výměnu znovu
            gpu.STAT_PHASE = "rebalance"
            cand = sorted(pre_pool, key=keep_key)[:14]
            pre_pool = [u for u in pre_pool if u not in cand]
            bad = verify(cand)
            off_topic += bad
            pool += [u for u in cand if not any(i in bad for i in u["ids"])]
            rebalance(pool, hi, lo)
    attach_context(refs=False)
    units.sort(key=lambda u: u["ids"][0])
    snapped = _snap_units_to_pauses(units, segs, exclude, pause_map,
                                    budget=(target * 1.05 - sum(u["dur"] for u in units)) if target else float("inf"))
    if target and sum(u["dur"] for u in units) > target * 1.08:
        trim(target * 1.05, target * 0.9)  # dotažení k pauzám střih prodloužilo – dorovnat celými celky
    total = sum(u["dur"] for u in units)
    note = None
    if target and total < 0.85 * target:
        note = (f"K zadání se v materiálu našlo jen {total:.0f} s vhodného obsahu (cíl {target:.0f} s)"
                + (f" – omezeno na mluvčí {', '.join(sorted(only))}" if only else "") + ".")
    return {
        "note": note,
        "picks": [i for u in units for i in u["ids"]],
        "addedForQuestionAnswer": added,
        "chapters": chosen,
        "why": "; ".join(reasons),
        "estimatedSec": round(total, 1),
        "dropped": [i for u in pool + pre_pool for i in u["ids"]],
        # ověření náhradníci k tématu, nejrelevantnější první (pro kontrolu agentem)
        "alternates": [i for u in sorted(pool, key=keep_key) for i in u["ids"]],
        "removedModerator": removed_moderator,
        "fixedFragments": fixed_fragments,
        "snappedEdges": snapped,
        "editorial": editorial,
        "thesis": thesis,
        "keyChapters": sorted(key_ch),
        "offTopic": off_topic,
        "topics": topics,
        "balanceTopics": balance_topics,
        "general": general,
        "topicSec": {t: round(sum(u["dur"] for u in units if u.get("topic") == t), 1) for t in topics},
        "backend": backend,
        "elapsedSec": round(time.time() - t_start, 1),
        "llmStats": gpu.stats_summary(gpu.CALL_STATS),
    }

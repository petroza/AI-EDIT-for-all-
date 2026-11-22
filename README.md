# MY Premiere MCP

Střih v Adobe Premiere Pro pomocí Claude (Claude Code / Claude Desktop) nebo Codex (GPT):
**střih podle toho, co kdo říká** (český přepis s časy slov), **automatický střih více kamer podle mluvčího**
a **lokální porozumění dlouhému materiálu**, které šetří kredity. Vše běží na tomhle PC, bez Ollamy a bez cloudu.

```
Claude / Codex ──stdio──► server/index.js (MCP) ──HTTP :7880 + token──► CEP panel ──► host.jsx (ExtendScript v Premiere)
                                   │
                                   └──HTTP :7881 + token──► worker/server.py (lokální Worker, fronta úloh)
                                                              ├─ faster-whisper large-v3 (CUDA)      přepis + časy slov
                                                              ├─ sherpa-onnx pyannote + WeSpeaker    kdo kdy mluví
                                                              ├─ FFT korelace zvuku                   synchronizace kamer
                                                              └─ llama-server + gemma3 12B (CUDA)    kapitoly, slabá místa, plán střihu
```

## Instalace
```powershell
O:\ADOBEPREMIERESTRIH\INSTALL\Instalace.cmd
```
Vše se ukládá do složky aplikace: `.venv` (Python 3.11), `models/` (Whisper, diarizace, LLM), `tools/llama.cpp`.
Pak restartuj Premiere a otevři **Okno > Rozšíření > MY Premiere MCP**. Worker se spouští sám při prvním použití.

| Model | Složka | Velikost |
|---|---|---|
| Whisper large-v3 (CTranslate2) | `models/whisper-large-v3` | 2,9 GB |
| pyannote segmentace 3.0 (ONNX) | `models/diarization/sherpa-onnx-pyannote-segmentation-3-0` | 6 MB |
| 3D-Speaker CAM++ zh/en advanced (ONNX, hlasové otisky) | `models/diarization` | 27 MB |
| gemma3 12B Q4_K_M (GGUF) | `models/llm` | 6,8 GB |
| llama.cpp b10984 CUDA 12.4 | `tools/llama.cpp` | 1,1 GB |
| Hermes – Qwen3.6-35B-A3B Q4_K_XL + mmproj (GGUF) | `models/hermes` | 21,7 GB |
| llama.cpp build 11118 (pro Hermese) | `tools/llama.cpp-hermes` | 1,1 GB |

### Hermes (silnější lokální model)
Kvalitnější lokální plánování střihu (`plan_edit_local`) než gemma3. Je součástí složky projektu. Worker ho spouští
sám na požádání a po nečinnosti (`idleStopSec`) i před přepisem vypíná; ručně:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\hermes.ps1 start     # textově
powershell -ExecutionPolicy Bypass -File scripts\hermes.ps1 start -Vize   # + vidění (mmproj)
powershell -ExecutionPolicy Bypass -File scripts\hermes.ps1 stop|status
```

Běží na `127.0.0.1:8000`; `plan_edit_local` si ho vezme sám, jakmile odpovídá (`backend` se nezadává).
Kolik MoE vrstev nechat v RAM, volí Worker podle volné VRAM (30 / 36 / 40), aby se model nepřelil do sdílené
paměti (Windows to dělá potichu, rychlost pak spadne na polovinu). Před startem Hermese i před přepisem Worker
uvolní grafiku od cizích modelů: modely Ollamy vyloží (server běží dál) a cizí `llama-server.exe` ukončí –
na grafice tak nikdy neběží dva velké modely najednou. Automatické `--fit` na Windows VRAM přeplní (~10 tok/s).

## Použití
Příklady zadání (panel v Premiere, `claude` v terminálu, Claude Desktop):
- „Přepiš rozhovor, rozpoznej mluvčí a udělej 3minutovou verzi o cenách. Ať to dává smysl."
- „Tady jsou 3 kamery a zvuk od zvukaře – sestříhej to automaticky podle toho, kdo mluví."
- „Hodinový materiál: udělej osnovu a navrhni střih lokálně, ať nepálíme kredity."

Zadání jde i nadiktovat – tlačítko 🎤 v panelu nahraje řeč a lokálně ji přepíše (stejný Whisper jako na video, žádný cloud).

### Panel
- **Rychle:** šablony zadání 💬 Výrok, 🎬 Upoutávka, ✂ Zkrácená verze, 🔇 Bez pauz (vyplní zadání a délku).
- **Délka 10 / 20 / 30 s** – rychlá volba cílové délky (přidá se k zadání, u Hermese má přednost před délkou v textu).
- **Formát 16:9 / 9:16 / 1:1 / 4:5** – jiný než 16:9: po střihu se z nové sekvence sama udělá verze pro sociální sítě
  (nástroj `reframe_sequence`: Premiere Auto Reframe sleduje obličej, výsledek v plném rozlišení 1080×1920 / 1080×1080 /
  1080×1350). Původní 16:9 zůstává, Zpět smaže obě.
- **Fronta** – „+ Do fronty“ (Ctrl+Enter) nebo Spustit, když už něco běží. Úlohy běží po jedné; každá si při přidání
  zapamatuje agenta, model, délku a aktivní sekvenci, takže lze nachystat víc střihů z různých videí. Stop frontu pozastaví.
- **↶ Zpět** – smaže sekvence, které vytvořilo poslední zadání (opakovaným klikem i předchozí). Když zadání žádnou
  sekvenci nevytvořilo, vrátí jeden krok v Premiere (Ctrl+Z) s pojistkou proti opakování.
- **GPU / VRAM / RAM / CPU** – vytížení počítače každé 2 s (GPU jen s kartou NVIDIA). Pod Workerem pruh průběhu úlohy.
- **Zdroj:** vpravo nad zadáním – aktivní sekvence, ze které se bude stříhat.
- **▶ Otevřít / ⬇ Export MP4** pod každým hotovým střihem (export do složky `export` vedle projektu).
- **👍 / 👎** pod každým hotovým střihem – hodnocení se ukládá do `cacheeedback.jsonl` (zadání, agent, délka, sekvence)
  jako podklad pro ladění lokálního modelu.
- Nepřihlášený Claude Code: tlačítko „🔑 Přihlásit Claude Code“ (jednorázově, pak zadání zopakuje samo) nebo poslat do aplikace Claude.

### Krátký výrok / highlight (do 60 s) lokálně
Hermes u krátké cílové délky nevybírá jednotlivé věty z celého materiálu, ale **jednu souvislou pasáž**: kandidáti
začínají i končí ve skutečné pauze (≥ 0,15 s nebo změna mluvčího), končí dokončenou větou, model je ohodnotí po kritériích
(samostatnost, síla, pointa, zadání), začátky navazující na předchozí větu („A…“, „Takže…“, „Absolutně.“) se strhávají
a o vítězi rozhodne finále s krátkou úvahou. Pauzy uvnitř pasáže zůstanou. Plán s hotovou osnovou trvá 2–10 s.

**Zvukové prolnutí:** každá stavba dá na začátek a konec zvukových klipů 2snímkový přechod Constant Power (standard
u dialogu – hranice v plynulé řeči nezní tvrdě, žádné cvaknutí); `audioFades: 0` vypne.

**Pauza** = mezera v přepisu ≥ 0,12 s **a** aspoň 40 ms ticha ve zvuku (proti šumu z okolí). Samotný zvuk mate závěr
souhlásky, samotné časy přepisu přeslechnou mluvení přes sebe. Delší střihy (skládání vět) po výběru dotáhnou kraje
každého úseku k nejbližší pauze (o větu dál i přes jiného mluvčího – otázka před odpovědí –, jinak o větu zpět;
narazí-li na další vybraný úsek, spojí je) a pak dorovnají délku. Talk 2 min: slyšitelné hranice 4/22 → 0.
Neplatí pro upoutávky, přehledy a shrnutí.

### Upoutávka ve stylu zpravodajství (do 40 s) lokálně
Zadání se slovem upoutávka / teaser / promo / pozvánka: kandidáti jsou krátké samostatné výroky (1,2–8 s, i jednotlivé
věty uvnitř segmentu přepisu přes `fromWord`/`toWord`) s pauzou na obou koncích. Hermes je ohodnotí (hák, samostatnost,
údernost), zkontroluje s okolními větami, jestli by vytržené nezkreslily význam (citace cizích slov, ironie, fráze, kterou
mluvčí odmítá), a složí 2–4 údery: hák → … → napětí na konec, bez prozrazení rozuzlení, délka ±15 %. Plán 12–25 s.

### Dlouhý materiál a kredity
1. `transcribe_media` + `diarize_media` / `speakerTracks` + `rename_speakers` – vše lokálně.
2. `analyze_transcript` – lokální LLM vrátí **kompaktní osnovu** (kapitoly, shrnutí, nejsilnější a slabé věty).
   Claude pracuje s osnovou (stovky tokenů místo desítek tisíc) a plný text čte jen u vybraných kapitol
   (`get_transcript` s `format: "compact"`).
3. `plan_edit_local` – plán střihu lokálním modelem (Hermes/Qwen3.6-35B, když běží, jinak vlastní gemma3):
   hodnocení kapitol, výběr vět, kontrola tématu, vyvážení mluvčích a témat, dorovnání na cílovou délku (±3 %).
   S `format: "review"` vrátí krátký návrh s texty vět a náhradníky – **hybrid**: lokální model navrhne, Claude
   jen zkontroluje a postaví (změřeno ~4–5× levnější než vlastní čtení kapitol, stejná kvalita). S `build`
   postaví sekvenci úplně bez Claude (panel → „Hermes (lokálně, zdarma)“).

Panel spouští Claude v úsporném režimu (`--tools=ToolSearch --effort medium` + krátký prompt
`panel/agent-system.md`): popisy nástrojů se načítají až na vyžádání. Typický 3min sestřih hodinového
materiálu ~1 min a ~$0,10–0,16 (původně ~2 min a $0,85). Celá cesta u nového 42min videa (přepis, mluvčí,
osnova, plán, sekvence) ~5 min.

### Titulky a překlad titulků (cizojazyčný materiál)
- Přepis vícejazyčného videa: `transcribe_media` s `language: ""` – jazyk se zjišťuje po úsecích (film EN+UK+RU).
- `add_captions` s `translate: "cs"` – titulky rovnou česky (překlad lokálním modelem po celých větách, časy z řeči).
  V panelu tlačítko „💬 Přidat titulky“ s volbou „jen přepis“ / „překlad do češtiny“ – běží přímo bez AI agenta, zdarma.

### Více kamer
`build_multicam_sequence`: reference = hlavní zvuk, kamery `{source, role: wide|close, speakers:[jméno]}`.
Offsety kamer se dopočítají ze zvuku, obraz se přepíná na detail mluvčího (s náběhem 0,3 s), překryv řeči
a delší ticho jdou do celku, monology delší než 14 s se prostřihnou, nejkratší záběr 1,8 s.
Výsledek je obyčejná sekvence (V1 = obraz kamer bez jejich zvuku, A1 = hlavní zvuk) – dá se dál ručně upravit.
`dryRun: true` vrátí plán bez Premiere; `picks` kombinují střih příběhu s přepínáním kamer.

## Nástroje (50)
| Skupina | Nástroje |
|---|---|
| Stav a projekt | `premiere_status`, `get_project`, `list_project_items`, `import_media`, `save_project`, `undo`, `worker_status`, `job_status` |
| Sekvence | `get_sequence`, `open_sequence`, `set_playhead`, `add_markers`, `get_markers`, `export_sequence` |
| Přepis a mluvčí | `transcribe_media`, `transcribe_sequence`, `get_transcript`, `search_transcript`, `find_pauses`, `diarize_media`, `rename_speakers` |
| Porozumění (lokálně) | `analyze_transcript`, `get_outline`, `plan_edit_local` |
| Obrazová analýza | `get_frame` (vrátí snímek jako obrázek – pro Claude vidění), `describe_frame` (popis lokálním vision modelem Qwen3-VL, zdarma) |
| Externí AI (ChatGPT apod.) | `export_analysis` (jeden samostatný .md soubor – instrukce z `EXTERNI_AI_INSTRUKCE.md` + osnova + přepis, stačí vložit celý do ChatGPT v jedné zprávě), `build_from_plan` (sestříhá podle JSON plánu, co AI vrátí) |
| Střih (nedestruktivní) | `build_sequence_from_transcript`, `build_sequence_without_pauses`, `build_sequence`, `build_multicam_sequence`, `sync_media` |
| Detekce střihu (obraz) | `detect_scene_cuts` (najde skutečné vizuální řezy kamer zapečené v jednom zdroji – Premierina Scene Edit Detection, jen na výslovné přání) |
| Titulky | `add_captions` (titulky z přepisu podle timeline, s `translate` rovnou přeložené do češtiny) |
| Střih (destruktivní) | `remove_timeline_ranges`, `razor`, `remove_clips` |
| YouTuber verze dílu (AE 9:16 / 16:9) | `yt_export_structure`, `yt_speakers`, `yt_plan`, `yt_build_ae`, `yt_stills`, `yt_render`, `yt_collect` – config dílu a návod v [`youtuber/`](youtuber/README.md) |
| Vývoj | `run_extendscript`, `reload_bridge` |

## Konfigurace
- `config.json` – porty, cesty k modelům, Whisper, LLM (kontext, GPU vrstvy), diarizace.
- `corrections.txt` – slovník oprav přepisu (`chybně = správně`).
- `cache/` – přepisy, diarizace, synchronizace, analýzy, stav úloh (`jobs/`), `worker.log`, `llama-server.log`.

## Testy a ladění
| Skript | Co dělá |
|---|---|
| `py -3.11 scripts/make_multicam_test.py` | vyrobí testovací rozhovor na 3 kamery se známým výsledkem (`test/multicam/gt.json`) |
| `node scripts/test-worker.mjs [status transcribe diarize sync names multicam analyze llm premiere]` | Worker + více kamer, porovnání se správným výsledkem |
| `node scripts/verify-multicam.mjs` | kontrola vytvořené multicam sekvence v Premiere (sync, mezery, zvuk) |
| `node scripts/test-premiere.mjs [status build pauses seq markers remove]` | živé testy střihu v otevřeném projektu |
| `node scripts/smoke.mjs`, `node scripts/verify-host.mjs` | MCP handshake, kontrola host.jsx |
| `node scripts/es.mjs soubor.jsx` / `--reload`, `node scripts/cdp.mjs`, `node scripts/panel-run.mjs "zadání"` | ExtendScript, DevTools panelu, AI z panelu |

| `scripts\restart-worker.ps1` | natvrdo ukončí Worker a llama-server (MCP server jinak restartuje Worker se starým kódem sám) |
| `node scripts/test-multicam-unit.mjs` | jednotkové testy přepínání kamer (bez celku, pozdě zapnutá kamera, rychlé střídání, hodina za 18 ms) |
| `node scripts/test-worker-restart.mjs` | restart Workeru se starým kódem, žádný osiřelý llama-server |
| `node scripts/test-podcast2.mjs` | skutečný podcast: diarizace, osnova, lokální 5min střih, sestavení a export |
| `.venv\Scripts\python.exe scripts\diar_experiment.py` | srovnání modelů hlasových otisků a prahů |
| `node scripts/test-hermes-loop.mjs [kol]` | plán střihu lokálním modelem na debatě: délka, moderátor, useknuté věty, odbočky, vyvážení |
| `node scripts/test-plan-diskuse.mjs [kol] [backend]` | totéž na jiném materiálu a zadání (pojistka proti přeladění na jeden test) |
| `node scripts/test-plan-battery.mjs` | 6 různých zadání na 2 materiálech, texty do `test/hermes-loop/battery.md` k ručnímu posouzení |
| `node scripts/test-fresh-pipeline.mjs video "zadání" s` | celá cesta u nového videa s časy jednotlivých kroků |
| `node scripts/compare-agents.mjs "claude:sonnet:lean2:medium,codex:gpt-5.5"` | agenti na stejném střihu: čas, cena, tokeny, kvalita; průběh do `test/agent-compare/*.jsonl` |
| `.venv\Scripts\python.exe scripts\asr-batch-bench.py` | Whisper klasicky vs. dávkově: rychlost, přesnost textu a časů slov |
| `.venv\Scripts\python.exe scripts\srt-qa.py soubor.srt [znaků] [řádků]` | kontrola kvality titulků (délka řádků, předložky, rychlost čtení, osiřelá slova) |
| `node scripts/tool-sizes.mjs` | velikost popisů MCP nástrojů (tokeny, které agent platí) |
| `node scripts/panel-reload.mjs` | znovu načte stránku panelu (po úpravě `panel/main.js`) bez restartu Premiere |
| `node scripts/check-cuts.mjs "<sekvence>"` | **kontrola useknutých slov**: hlasitost 12 ms u každé hranice proti řeči v okolí + slova přepisu, která hranice protíná (rozhoduje zvuk – časy slov z Whisperu bývají o desítky ms vedle) |
| `node scripts/seq-text.mjs "<sekvence>" …` | co je ve střihu: klipy → věty přepisu s textem a mluvčím |
| `node scripts/test-highlight.mjs [filtr]` | regrese krátkých střihů Hermese proti referenci Clauda (`scripts/highlight-cases.json`): shoda, délka, čisté hranice, čas |
| `node scripts/plan-debug.mjs video s "zadání"` | plán lokálním modelem bez stavby: žebříček pasáží a úvaha finále |

### Naměřeno
| Test | Výsledek |
|---|---|
| Syntetický rozhovor, 3 kamery | synchronizace 0 ms, kdo mluví (jen hlas) 92 %, (mikrofony) 100 %, správná kamera 99,7 % |
| Skutečná panelová diskuse 26:39 (archive.org, CC BY-NC-ND) | přepis 116 s, diarizace 15 s (moderátor + 2 panelisté rozlišeni), osnova 112 s, lokální plán 47 s, střih + export 5:15 za 30 s |
| Talk (TN Live) 28:07, 2026-11-20 | přepis 145 s (dávkový + oprava 17 podezřelých míst: +44 % slov proti čistě dávkovému), diarizace 16 s, osnova 121 s, 30s výrok 2–20 s; 4 krátké střihy: čisté hranice 4/4 |
| Hermes podle volné VRAM (4070 Ti 12 GB) | 30 MoE vrstev v RAM: 8,7 GB, 42 tok/s · 36: 6,5 GB, 38 tok/s · 40: 4,6 GB, 33 tok/s · přelitý do sdílené paměti: 20 tok/s, vstup 8× pomaleji |

Diarizace „chunks“ (výchozí, když existuje přepis): hlasové otisky kousků vět modelem 3D-Speaker CAM++ a shlukování.
Na záznamu z místnosti je výrazně lepší než klasická pyannote pipeline (ta vše přiřadila jednomu mluvčímu).
Pro natáčení na více kamer je nejspolehlivější, když má každý host vlastní mikrofon (`speakerTracks`).

## Poznámky
- CEP/ExtendScript Adobe podporuje v Premiere do září 2026; architektura (MCP ↔ HTTP most) umožní přejít na UXP.
- `Time.getFormatted()` vrací u nestandardních fps špatný timecode, `razor` proto čte timecode z QE přehrávací hlavy.
- `panel/.debug` zapíná DevTools panelu na `127.0.0.1:8098` (jen pro vývoj).

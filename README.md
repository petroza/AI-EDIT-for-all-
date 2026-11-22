<p align="right">
  <a href="README.md"><img src="Obrazky%20a%20schemata%20pro%20navod/img/flag-cz.svg" width="30" height="20" alt="Čeština"> <b>Čeština</b></a>
  &nbsp;·&nbsp;
  <a href="README.en.md"><img src="Obrazky%20a%20schemata%20pro%20navod/img/flag-gb.svg" width="30" height="20" alt="English"> English</a>
</p>

# AI EDIT for all – AI střih videa třemi způsoby

Jeden repozitář, tři programy. Claude, Codex nebo lokální model Hermes stříhají video **podle toho, co se v něm říká**:
vyberou nejlepší výroky, složí upoutávku nebo zkrácenou verzi, přidají titulky a převedou záběr na 9:16 pro sítě.
Výsledek je vždy **nová sekvence** – originál zůstane netknutý. Videa nikdy neopustí počítač, AI dostane jen text přepisu.

| | Co to je | Pro koho |
|---|---|---|
| **1 · Premiere plugin** (MY Premiere MCP) | panel a AI nástroje přímo v **Adobe Premiere Pro**: přepis, střih podle obsahu, upoutávky, multicam podle mluvčího, titulky a překlad, Auto Reframe 9:16 | kdo má Premiere |
| **2 · Standalone** (PZ AI Cut) | samostatná střižna pro Windows, ovládání jako Premiere (stejné zkratky a rozložení) s AI panelem – **bez Adobe** | kdo nemá Premiere |
| **3 · Web** (PZ AI Cut Web) | stejná střižna v Chrome/Edge, nic se neinstaluje, přepis běží v prohlížeči; AI přes Claude Desktop nebo Codex | kdokoli, hned |

## Ukázka

<img src="Obrazky%20a%20schemata%20pro%20navod/img/demo-ai-cs.webp" alt="Zadání v panelu → Claude stříhá → hotová upoutávka a verze 9:16" width="100%">

Skutečný běh ve standalone verzi: zadání *„Z aktivní sekvence udělej 20s upoutávku na Instagram z nejsilnějších
výroků. Začni hákem.“* → Claude (Sonnet) přečetl přepis 28min rozhovoru, vybral výroky, ověřil, že žádný střih
neutíná slovo, a postavil novou sekvenci (2 min 22 s, 0,41 $). Panel z ní sám udělal verzi 9:16 podle obličeje.

<img src="Obrazky%20a%20schemata%20pro%20navod/img/before-after-cs.png" alt="Před: 28min rozhovor 16:9 → po: 20s upoutávka 9:16 s titulky" width="100%">

Titulky jsou z automatického přepisu – v ukázce je vidět i typická chyba rozpoznávání („máma byl“), kterou
před zveřejněním opraví člověk nebo AI (`get_captions` / `set_captions`).

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-overview-cs.svg" alt="Tři programy, jedno AI jádro" width="100%">

## Srovnání

| | 1 · Premiere plugin | 2 · Standalone | 3 · Web |
|---|---|---|---|
| **Potřebuješ** | Adobe Premiere Pro, Windows | Windows | Chrome nebo Edge |
| **Instalace** | ~15 GB (+23 GB s Hermesem) | aplikace ~350 MB + AI jádro z bodu 1 | nic (model přepisu ~1 GB se stáhne do prohlížeče) |
| **Přepis řeči** | Whisper large-v3 na GPU | Whisper large-v3 na GPU | Whisper v prohlížeči |
| **Kdo kdy mluví, multicam** | ✅ diarizace, střih kamer podle mluvčího | ✅ stejné nástroje | – |
| **AI agent** | Claude Code, Claude Desktop, Codex, **Hermes lokálně** | Claude Code, Claude Desktop, Codex, **Hermes lokálně** | Claude Desktop, Codex |
| **Bez kreditů (vše lokálně)** | ✅ Hermes | ✅ Hermes | – (přepis ano, střih potřebuje Claude/Codex) |
| **9:16 · 4:5 · 1:1** | Premiere Auto Reframe | výřez podle obličeje (OpenCV) | výřez podle obličeje a mluvčího (MediaPipe) |
| **Titulky** | ✅ i překlad do češtiny | ✅ | ✅ + nadpis nahoře |
| **Export** | vše, co umí Premiere | MP4, MOV (ProRes), MXF (XDCAM HD422), −14 / −23 LUFS | MP4 (H.264) |
| **Kde jsou videa** | jen na tvém PC | jen na tvém PC | jen na tvém PC (čtou se z disku, nic se nenahrává) |

## Rychle (Windows)

```powershell
git clone https://github.com/petroza/AI-EDIT-for-all-.git
```

Pak ve složce dvojklik na **`START.bat`** (rozcestník), nebo přímo na jeden ze tří souborů níž.
Hotová webová verze běží i online na **https://pz-ai-cut.pages.dev**, hotová přenosná aplikace je v **Releases**
(`PZ-AI-Cut-portable.zip` – rozbalit vedle `START.bat` a složku přejmenovat na `PZ AI Cut - hotova aplikace pro Windows`).

---

## 1 · Premiere plugin – `1 Premiere plugin - instalace.bat`

<img src="Obrazky%20a%20schemata%20pro%20navod/img/screen-premiere.png" alt="Adobe Premiere Pro s panelem MY Premiere MCP" width="100%">

Panel **MY Premiere MCP** v Premiere (Okno › Rozšíření): stav lokální AI (GPU, VRAM), délka a formát výsledku,
rychlé akce (Výrok, Upoutávka, Zkrácená verze, Bez pauz), zadání vlastními slovy, výběr agenta (Claude Code, Codex,
Hermes), titulky a převod na 9:16. Zadání z panelu provede agent přímo v otevřeném projektu.

**Co se nainstaluje** (vše do naklonované složky `MY Premiere MCP - plugin do Premiere - zdrojovy kod\`, bez práv správce):

| Co | Kam / odkud | Velikost |
|---|---|---|
| Node.js LTS, Python 3.11 – jen když chybí | winget | ~100 MB |
| npm a pip balíčky (faster-whisper, CUDA knihovny, sherpa-onnx, OpenCV…) | `node_modules\`, `.venv\` | ~1,5 GB |
| Whisper large-v3 – přepis s časy slov | `models\` (Hugging Face) | 3 GB |
| diarizace – kdo kdy mluví | `models\diarization` | 40 MB |
| gemma3 12B + vision model + llama.cpp – osnova, slabá místa | `models\llm`, `tools\llama.cpp` | ~10 GB |
| **Hermes** (Qwen3.6-35B) – plán střihu zdarma, volitelně (ptá se) | `models\hermes` | ~23 GB |
| panel do Premiere | odkaz `%APPDATA%\Adobe\CEP\extensions\com.pz.premieremcp`, `PlayerDebugMode` v `HKCU\Software\Adobe\CSXS.*` | – |
| MCP server `premiere` | registrace do Claude Code, Claude Desktop a Codexu | – |

Potřeba: Windows 10/11, Adobe Premiere Pro, ~15 GB místa (+23 GB s Hermesem), internet. NVIDIA GPU výrazně zrychlí
přepis, Hermes potřebuje ~12 GB VRAM. Po instalaci restartuj Premiere → **Okno › Rozšíření › MY Premiere MCP**
a v Claude začni novou relaci.

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-premiere-cs.svg" alt="Jak je zapojený Premiere plugin" width="100%">

---

## 2 · Standalone – `2 Standalone - postavit.bat`

<img src="Obrazky%20a%20schemata%20pro%20navod/img/screen-standalone-cs.png" alt="PZ AI Cut Standalone" width="100%">

**PZ AI Cut** – střižna pro Windows bez Adobe: Zdroj / Program / Projekt / Timeline jako v Premiere, stejné zkratky
(J/K/L, I/O, C, Q/W…), přechody, titulky, export MP4 · MOV (ProRes) · MXF (XDCAM pro TV), převod na 9:16 podle obličeje.
Vpravo AI panel – stejný jako v Premiere.

**Co se nainstaluje:** `npm install` stáhne Electron (~100 MB) do `PZ AI Cut - standalone a web - zdrojovy kod\node_modules`, skript sestaví přenosnou
aplikaci do složky `PZ AI Cut - hotova aplikace pro Windows\` (`PZ AI Cut.exe`, nic se nezapisuje do systému). Nastavení a automatické zálohy
jsou v `%APPDATA%\TN_strihatoko`. Potřeba Node.js 18+ a ffmpeg (přibalený v MY Premiere MCP, jinak
`winget install Gyan.FFmpeg`).

**AI ve standalone:** AI panel používá MY Premiere MCP (přepis, Hermes, Claude) – spusť nejdřív bod 1 (Premiere k tomu
mít nemusíš). Složku najde sám: `MY Premiere MCP - plugin do Premiere - zdrojovy kod\` vedle v repozitáři, `%APPDATA%\MYpremiereMCP\root.txt`,
proměnná `MYPREMIEREMCP_ROOT`, nebo `PZ AI Cut - standalone a web - zdrojovy kod\config.json` → `aiRoot`. Bez ní funguje střih, AI panel ne.

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-standalone-cs.svg" alt="Jak je zapojený Standalone" width="100%">

---

## 3 · Web – `3 Web - postavit a spustit.bat`

<img src="Obrazky%20a%20schemata%20pro%20navod/img/screen-web-cs.png" alt="PZ AI Cut Web v prohlížeči" width="100%">

Stejná střižna v prohlížeči (na obrázku sekvence převedená na 9:16 a průvodce připojením AI). Videa se čtou přímo
z disku, nic se nenahrává; řeč se přepisuje v prohlížeči (Whisper, model se stáhne jednou ~1 GB).

**Co se nainstaluje:** nic – skript jen sestaví `PZ AI Cut - standalone a web - zdrojovy kod\web\dist` a spustí ho na **http://127.0.0.1:8791/**
(potřeba Node.js 18+, Chrome nebo Edge). Pro AI si v AI panelu stránky stáhneš konektor:

- **Claude Desktop** – rozšíření `pz-ai-cut.mcpb` (dvojklik → Instalovat), nebo plugin
  `PZ AI Cut web - plugin pro Claude\PZ AI Cut web - plugin pro Claude.zip` (Customize › Plugins › Add › Upload plugin; funguje v Cowork a záložce Code),
- **Codex (ChatGPT)** – jeden příkaz z AI panelu.

Chrome se jednou zeptá na přístup k zařízením v místní síti – **Povolit** (stránka mluví s konektorem na 127.0.0.1).
Na vlastní web stačí nahrát `web\dist` jako statické soubory (např. Cloudflare Pages).

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-web-cs.svg" alt="Jak je zapojený Web" width="100%">

---

## Struktura repozitáře

| Složka | Obsah |
|---|---|
| `MY Premiere MCP - plugin do Premiere - zdrojovy kod\` | MY Premiere MCP: `panel\` (CEP panel Premiere), `server\` (MCP server, Node), `worker\` (Python: Whisper, diarizace, analýzy), `INSTALL\` (instalace: `Instalace.cmd`), `PLUGIN CLAUDE\` (plugin pro Claude), `youtuber\` (verze dílu pro After Effects). Návod `MY Premiere MCP - plugin do Premiere - zdrojovy kod\README.md`, pokyny pro AI `CLAUDE.md` |
| `PZ AI Cut - standalone a web - zdrojovy kod\` | PZ AI Cut: `src\` (střižna – jádro a UI), `web\` (webová verze, build bez bundleru), `connector\` (MCP konektor pro web), `tools\` (`pack-portable.js`, obličeje, synchronizace AI panelu), `test\`, `team\` (zápisy z vývoje) |
| `PZ AI Cut web - plugin pro Claude\` | hotový plugin pro Claude k webové verzi |
| `PZ AI Cut - hotova aplikace pro Windows\` | hotová přenosná aplikace (`PZ AI Cut.exe`) – vytvoří ji `2 Standalone - postavit.bat`, v gitu není (je v Releases) |

Plugin pro Claude k Premiere je ve složce MY Premiere MCP: `PLUGIN CLAUDE\my-premiere-mcp.zip`.
| `Obrazky a schemata pro navod\` | obrázky a schémata (`python "Obrazky a schemata pro navod\make_diagrams.py"` je vygeneruje znovu) |

Ručně (bez .bat): `cd "PZ AI Cut - standalone a web - zdrojovy kod"` → `npm install` → `npm start` (ze zdrojů) / `npm run pack` (přenosná) /
`npm run web:serve` (web) / `npm test` (testy).
MY Premiere MCP ručně: `powershell -ExecutionPolicy Bypass -File "MY Premiere MCP - plugin do Premiere - zdrojovy kod\INSTALL\install-online.ps1"`
(přepínače `-Hermes`, `-NoLocalLLM`, `-SkipModels`, `-Target <složka>`).

## Pro správce repozitáře
Vývoj probíhá přímo v těchto složkách. `Aktualizovat GitHub.bat` commitne změny, nahraje je sem a složku MY Premiere MCP
zkopíruje i do samostatného repozitáře [petroza/MY-Premiere-MCP](https://github.com/petroza/MY-Premiere-MCP), odkud si kód bere
online instalace (`MY Premiere MCP - plugin do Premiere - zdrojovy kod\scripts\sync-standalone-repo.mjs`).

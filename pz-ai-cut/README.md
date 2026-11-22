# TN Střihátko

Samostatný střih videa pro kolegy bez Adobe Premiere. Ovládá se stejně jako Premiere Pro (rozložení
Zdroj / Program / Projekt / Timeline, stejné klávesové zkratky) a má vestavěný **AI panel** z MY Premiere MCP:
přepis, střih podle obsahu lokálním modelem Hermes (zdarma), Claude / Codex, titulky, převod na 9:16.

## Spuštění

1. Dvojklik na `START.bat` (první spuštění doinstaluje Electron do složky aplikace).
2. Potřeba je **ffmpeg** (`ffmpeg` a `ffprobe`). Buď v PATH (`winget install Gyan.FFmpeg`), nebo
   zkopírované do `tools\ffmpeg\`, nebo cesta v `config.json` (`ffmpeg`, `ffprobe`).
3. AI panel potřebuje složku **MY Premiere MCP** (server, Worker, modely) – cesta v `config.json` → `aiRoot`
   (výchozí `O:\ADOBEPREMIERESTRIH`). Bez ní střih funguje, AI panel ne.

## Co umí

- **Projekt**: import (Ctrl+I, nebo přetáhnout soubory z Průzkumníka), náhledy, sekvence. MKV/MXF/ProRes a jiné
  formáty, které prohlížeč nepřehraje, dostanou proxy (H.264 720p) na pozadí – export jde vždy z originálu.
- **Zdroj**: dvojklik na klip, I/O, Vložit (,) / Přepsat (.), přetažení obrazu na timeline.
- **Timeline**: stopy V1–V3 / A1–A3 (+ přidání), cílení stop, zámek, skrytí/ztlumení, sólo; klipy s vlnovým
  průběhem, propojený obraz+zvuk (Alt = jen jedna strana), přesun s přichytáváním, trim okrajů (Ctrl = ripple),
  žiletka (C), Ctrl+K, Delete / Shift+Delete, mezera + Delete = zavřít mezeru, Q/W, zvednout/vyjmout (; '),
  výběr tažením, kopírovat/vložit, hlasitost klipu (G), prolnutí zvuku, značky (M), titulková stopa.
- **Program**: přehrávání sekvence s plynulými střihy, J/K/L, krokování, skoky na střihy (↑ ↓).
- **Export** (Ctrl+M): H.264 MP4, H.265/HEVC MP4, QuickTime MOV (ProRes 422 HQ / 422 / H.264), MXF OP1a
  (XDCAM HD422 50 Mb/s pro TV, DNxHR HQ); celá sekvence nebo I–O, x264/x265 nebo NVIDIA NVENC, srovnání hlasitosti
  na −14 LUFS (sítě) nebo −23 LUFS (TV, EBU R128), titulky vypálené a/nebo .srt vedle. Přesný na snímek.
- **Přechody**: Cross Dissolve (Ctrl+D), Dip to Black / White, Shift+D = obraz i zvuk, Fade In/Out sekvence,
  výchozí délka (Sequence → Default Transition Duration). Náhled v monitoru i v exportu.
- **Nástroje** (panel vlevo od timeline): Selection V, Track Select Forward A, Ripple B, Rolling N, Razor C, Slip Y,
  Hand H, Zoom Z. Hlavičky stop jako v Premiere (source patching, track targeting, zámek, oko, M/S).
- **Přetahování** z Průzkumníka / plochy rovnou na timeline (začátek klipu tam, kde je kurzor, obrys během tažení),
  sekvence z Projektu na timeline, Export Frame (fotoaparát v monitoru, Ctrl+Shift+E).
- Cíl aplikace: ruční střih a ovládání co nejvíc jako Premiere + AI panel. Barevné korekce a efekty záměrně ne.
- **Formát pro sítě** (Sekvence → Formát 9:16, nebo „Převést aktivní“ v AI panelu): nová sekvence 1080×1920,
  rozřízne video na střizích kamery a každý záběr vycentruje na obličej (jako Auto Reframe).
- Zpět/Znovu (Ctrl+Z / Ctrl+Shift+Z) pro všechno včetně úprav od AI, automatické ukládání každou minutu.
- Projekt se ukládá do `.tnproj` (JSON).

Všechny zkratky: **F1** v aplikaci.

## AI panel

Je to panel MY Premiere MCP – při každém startu se zkopíruje z `aiRoot\panel` a místo Premiere volá
Střihátko (`tools/sync-ai-panel.js`, `src/ai/shim.js`). Vylepšení panelu v MY Premiere MCP se tak projeví i tady.

- **Most**: Střihátko poslouchá jako panel v Premiere na `127.0.0.1:7880`. Když na stejném PC běží i Premiere
  s panelem, vezme si `7890` (vpravo nahoře „most :7890“) a agentům port předá (`PMCP_PORT`, vlastní `mcp.json`
  v `%APPDATA%\TN_strihatoko`). Natvrdo jde nastavit v `config.json` → `bridgePort`.
- Všechny nástroje MCP serveru (`build_sequence_from_transcript`, `plan_edit_local`, `add_captions`,
  `build_multicam_sequence`, `detect_scene_cuts` přes ffmpeg…) tak stříhají přímo ve Střihátku. Výsledek je vždy
  nová sekvence. Nefungují jen nástroje, které spouští ExtendScript v Premiere (`run_extendscript`, `yt_*`).
- „Claude (aplikace)“ s pluginem funguje, když most běží na 7880 (tedy když Premiere neběží).

## Pro vývoj

- `node test/run-tests.js [video.mp4]` – testy jádra (střihové operace, API mostu, export, 9:16 s obličeji).
- Spuštění s laděním: `node_modules\electron\dist\electron.exe . --remote-debugging-port=9333`, pak
  `node test/cdp.js eval "výraz"` / `shot soubor.png` / `key KeyK Ctrl` / `drag "x1,y1,x2,y2"`.
- Struktura: `src/core` (model, střihové operace, média, export, API mostu = náhrada host.jsx),
  `src/ui` (přehrávač, monitory, timeline, projekt), `src/renderer.js` (příkazy, zkratky, dialogy),
  `main.js` (okno, nabídky), `tools/faces.py` (obličeje pro 9:16, OpenCV z `aiRoot\.venv`).

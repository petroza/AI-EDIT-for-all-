# Tým v2 – kola S (standalone PZ AI Cut pro Windows)

Role, pravidla a formát reportů jako v `TEAM.md` (Redaktorka, Kontrolor výstupu, Vzhled a jazyk, AI tok; vývojář = hlavní relace).
Rozdíly proti webu:

## Prostředí
- Kód: `O:\AI STRIH ALL app\PZ AI Cut - standalone a web - zdrojovy kod` (dál „APP“). Vývoj probíhá přímo tady (git = `O:\AI STRIH ALL app`).
- **Vlastní izolovaná instance** (nastavení, autosave a cache uživatele zůstanou netknuté):
  `node APP\test\standalone.js start <port> %TEMP%\pz-s1-<role> --size 1366x768 --lang cs` … na konci `node APP\test\standalone.js stop <port>`.
  Porty: redaktorka 9371, výstup 9372, vzhled 9373, AI 9374. Další velikosti `--size 1920x1080`, `--size 1280x720`; jazyk `--lang en`.
- Ovládání: `CDP_PORT=<port> node APP\test\cdp.js eval "<JS, await funguje>"` | `shot soubor.png` | `key KeyK Ctrl` | `drag "x1,y1,x2,y2"`.
  Hlavní objekt `TN.app` (project, seq(), edit, editCore, openSequence(id), importPaths([cesta]), cmd(název)), `TN.lang`, `TN.evalScript`.
- **Nativní dialogy** (Import, Export, Uložit) automat neumí. Import: `await TN.app.importPaths(['O:/…/soubor.mp4'])`.
  Export: `await require('APP/src/core/exporter').exportSequence(TN.app.project, TN.app.seq(), { output: 'O:/…/web/test-out/<role>-….mp4', range: 'all',
  burnCaptions: true, srtSidecar: false, encoder: 'libx264', format: 'h264'|'h265'|'prores_hq'|'prores'|'mov_h264'|'xdcam'|'dnxhr', loudness: 'social'|'tv'|'off' })`
  (exporty do `APP\web\test-out\` s předponou role). Vždy napiš, že jsi použil tyhle pomůcky místo dialogu, a dialog aspoň otevři a prohlédni.
- **Nabídky okna jsou nativní (Electron)** – na snímku DevTools nejsou. Jejich obsah je v `APP\src\core\menu.js` (+ překlad `src\core\lang.js`);
  příkazy z nabídek spouštěj `TN.app.cmd('<název>')` (seznam v `src\renderer.js`, objekt `commands`).
- Média: `APP\test\media\vyrez-5min.mp4` (5 min z rozhovoru TALK) a `C:\Users\Petr\Downloads\tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4` (28 min).
  Přepis dělá lokální Worker MY Premiere MCP (GPU, sdílené – nepouštěj víc přepisů naráz; 5 min ≈ desítky s).
- AI panel = panel MY Premiere MCP uvnitř aplikace (most na 127.0.0.1:7880, když neběží Premiere; jinak 7890). Agenta (Claude/Codex/Hermes) spouští jen role AI tok, sama.
- ffmpeg/ffprobe v PATH; faster-whisper: `O:\AI STRIH ALL app\MY Premiere MCP - plugin do Premiere - zdrojovy kod\.venv\Scripts\python.exe`
  (model `…\models\whisper-large-v3`, cuda, `int8_float16`, krátké úseky).
- Reporty: `APP\team\v2\s<N>\<role>.md`, snímky `APP\team\v2\s<N>\shots-<role>\`.
- Nikdy uživatelova běžící aplikace PZ AI Cut, Premiere ani panel prohlížeče Claude. Nic neopravuj, nenasazuj, necommituj.

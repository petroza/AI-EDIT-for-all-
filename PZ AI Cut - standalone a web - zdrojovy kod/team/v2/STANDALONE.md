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

## Od kola S2 (opravy po S1, commity f29957c, d0ca5cd)
- **Přepis řeči ve standalone**: panel Přepis (vedle Projektu), pravý klik na klip → Přepsat řeč, automatický přepis po importu a
  Sekvence → Titulky → Vytvořit titulky z přepisu fungují bez AI. Motor = lokální Worker MY Premiere MCP (Whisper large-v3 na GPU,
  sdílená mezipaměť přepisů – 5min výřez je už přepsaný, 50 s nového záznamu ≈ 5 s). Rozhraní `window.__pzASR` (src/ai/asr-desktop.js).
  Izolovaná instance potřebuje `--ai` (token Workeru), jinak přepis hlásí chybu přístupu.
- Opraveno v S1 (ověř, jestli opravdu): zbytky cizího záběru na krajích klipů (i po AI sestřihu/Auto Reframe), MXF s vypálenými titulky
  na snímek přesně, hlasitost dvouprůchodově (TV −23, sítě −14), XDCAM jen 1920×1080 25/29,97/50 a 1280×720 50/59,94, dialog Export
  (staré Hotovo, posun tlačítka, MXF → TV hlasitost), Ctrl+R už nenačítá okno (Reload = Ctrl+Shift+F5), Ctrl+Q konec, čeština chyb
  a kroků AI, nová sekvence si pamatuje poslední velikost, nápověda bez „na webu“.
- **Bez AI panelu a MCP v kolech, kde běží víc instancí naráz** (most 7880/7890 by se pletl mezi okny). AI tok běží sám.

## Od kola S3 (commity f1f6d64, a84d073)
- Opraveno po S2 (ověř): titulky bez kousku slova z vedlejšího úseku (přesné časy Workeru), titulek kratší než 0,7 s se připojí k předchozímu,
  timecode v monitorech jde přepsat (klik; `1015` = 00:00:10:15, `+5` / `-1:00` posun), panel Přepis (po importu „načítám přepis“, bez skoku
  na poslední větu, odhad času, Zastavit bez slibu „hotové části“), dialog Export pevně široký, hlasitost podle formátu (MXF → TV, zpět vrátí),
  velikost česky, Esc zavře dialog i z textového pole, F1 nahoře, nová sekvence poprvé podle klipu, AI panel 340 px na obrazovkách ≤ 1500 px,
  prázdný Projekt / časová osa / karta Začni tady (bez posuvníku i při 1280×720), zbytek cizího záběru do 5 snímků převezme soused i při řeči,
  MCP `export_sequence` ve standalone vypálí titulky a srovná hlasitost (parametry burnCaptions, srt, loudness, format).
- Testovací instance mají vlastní úložiště okna (PZ_USERDATA) – nový profil = opravdu čisté první spuštění.
- Hermes (lokální LLM ve Workeru) teď padá na „CUDA error“ – AI tok a plan_edit_local v tomhle kole nespouštěj.

## Od kola S4 (commity 56dd814 … bc6a7a8 a další)
- Hermes opraven (cc9df28) – AI tok může Hermes používat. Automatické ukládání jen do zálohy (projekt přepíše až Ctrl+S, po pádu obnova),
  Zesílení G = Nastavit na / Změnit o, chybějící médium vidět (dlaždice, klip, monitor „Médium offline“, export to ohlásí předem),
  čitelné chyby importu, titulky se neslučují přes střih, konec sekvence bez probliknutí (prodloužení do pauzy / zopakované snímky),
  upoutávka: úder se spojkou jen za svou předchozí větou, moderátor max 1 úder; add_captions lines/charsPerLine ve standalone,
  timecode i na časové ose, AI panel na nízkém okně, drobnosti vzhledu S3.

## Od kola S6 (commit 99fd961 a předchozí)
- Shift+Delete (ripple delete) klipu: když je úsek na stopách smazaného klipu po smazání prázdný, vyjme se ze VŠECH odemčených stop
  (jako Extract) – b-roll na V2 nad ním se zkrátí, hudba a titulky se posunou; titulky přes hranu se rozdělí podle slov.
- Ctrl+D na kraji klipu ve V2+ bez souseda = prolnutí do stopy pod ním (export i náhled), dřív stmívačka do černé.
- Úklid krajů: zbytek cizího záběru na kraji samostatného klipu ve V2+ se odstřihne (vidět je stopa pod ním).
- Titulek začínající přesně na střihu patří k dalšímu klipu (dřív nulová délka posledního titulku).
- Export MXF: titulky výchozí jako .srt zvlášť, ne vypálené. Sestřih do konce souboru už most nezasekne (limit dekodéru).

## Od kola S9 (noc po 3:00, commity 70047c0 … 0c5bb1b)
- Široký záběr přetažený (Projekt/Zdroj → časová osa) do sekvence na výšku: výřez podle obličeje jen pro vložené klipy;
  vložení i výřez vrátí jedno Ctrl+Z (i první vložení do prázdné sekvence 9:16).
- Upoutávka přes MCP `plan_edit_local` + `build`: hranice úderů se ověřují zvukem už při výběru – upoutávka nemá spadnout
  pod ~80 % cíle a `edges` mají být prázdné; úder „…a proto…“ nesmí stát za pozdějším úderem; poděkování/pozdravy nejsou úder.
- Začátek úseku z MCP bez úlomku předchozího slova (#22 po „a tak.“ začíná v pauze, ne v „k“).
- Jednořádkové titulky 9:16 rozdělené podle skutečné doby zobrazení (nejkratší ~0,2 s místo 0,1 s; rychlá řeč dál pod 0,7 s).
- Chyby mostu pro AI česky (i při anglickém rozhraní), `import_media` neexistujícího souboru = chyba, `reason` plánu bez azbuky.

## Od kola S11 (commity 32dd765 … 1ff0463)
- **Obraz a zvuk zůstávají propojené** i po výřezu podle obličeje (9:16), Auto Reframe (menu i MCP `reframe_sequence`) a úklidu
  krajů: zvuk se rozřízne spolu s obrazem na střihu kamery, každý kus obrazu má svůj zvuk; žiletka, Shift+Delete, ořez, Extract
  působí na obojí. Úklid krajů může nechat kraj obrazu o pár snímků posunutý proti zvuku (L/J-střih) – stále propojené.
- **Zopakovaný konec** (zbytek cizího záběru na konci sekvence pod řečí) je vlastnost klipu `hold`, ne samostatný klip – po
  smazání / zkrácení / W nic nezůstane. Export i náhled ukazují zopakované snímky.
- Export čte navazující kusy zvuku téhož zdroje vcelku; titulky berou navazující kusy jako jeden úsek (žádné zdvojené slovo).
- **Nadpis nahoře jde vypnout/zapnout**: okno Text v obraze → Nadpis nahoře → přepínač Zobrazit (text zůstane uložený).
- B-roll na V2 v 9:16 se zase čistí od cizího záběru; první vložení do prázdné 9:16 má po výřezu úklid krajů; předvybrané MXF = −23 LUFS.
- Testovací instance spouštěj s `--ai` (klíč Workeru pro přepis řeči); AI panel / Claude / Codex / Hermes spouští jen role AI tok.

# Regrese – kolo S14 (2026-11-23)

**Otázka:** Zůstaly všechny dříve opravené chyby opravené po velkých změnách S12–S13?
**Verdikt: ano, s jednou výhradou.** Znovu jsem zkusil 62 dříve opravených nálezů (záv. 2–3, pár záv. 1 navíc).
- **59 drží.**
- **1 je nestabilní:** zámek jedné instance. Napoprvé se druhé okno nad stejným profilem otevřelo, další 4 pokusy byly odmítnuté.
- **0 potvrzených regresí.**
- **8 nálezů nejde ověřit**, protože přepis řeči v tomhle prostředí nefunguje (sdílený Worker odmítá klíč, viz Prostředí).
- Jednotkové testy: `node test/run-tests.js` = **38 prošlo, 0 selhalo**.

## Prostředí a pomůcky
- **Instance:** `standalone.js start 9387 %TEMP%\pz-s14-regrese --size 1366x768 --lang cs --ai`. AI panel, Claude, Codex ani Hermes jsem nespouštěl. Na konci `stop 9387` (kopie tokenu smazána).
- **Verze kódu:**
  - První běh 13:28–13:57 = HEAD b6c9cfa. Patří sem testy 1–55.
  - Při testech po restartu (56–62) byl na disku HEAD 4ffa355 **plus neuložené změny vývojáře** v `src/renderer.js`, `lang.js`, `index.html`, `project-panel.js`, `app.css`. Vývojář během kola commitoval.
- **Ovládání:**
  - Vlastní `run.js` (tělo souboru jako async eval přes CDP) a `inp.js` (CDP klik, psaní, Enter).
  - `test/cdp.js` pro `key` (Ctrl+D, Ctrl+Shift+D) a `drag` s Ctrl.
  - Nativní dialogy (dotaz na síť, pád okna) přes Windows UI Automation.
  - Skripty jsou v `team/v2/s14/regrese/`, snímky v `team/v2/s14/shots-regrese/`.
- **Exporty:** pomůckou `exporter.exportSequence`, dva přímo dialogem Export (klik na Exportovat). Všechny jsou v `web/test-out/regrese-s14-*` (31 souborů). Měřil jsem ffprobe, ebur128, scdet, idet, volumedetect/astats a PSNR proti zdroji.
- **Média:**
  - `test/media/vyrez-5min.mp4` a 28min rozhovor z Downloads (jen čtení).
  - Syntetická média z ffmpeg lavfi ve scratchpadu: anamorf 1440×1080 SAR 4:3, 2× mono, PNG, MP3, 29,97p, 1080i TFF, bez zvuku, VFR.
  - Kopie výřezu pro test přejmenování.
- **⚠ Přepis nejde: sdílený Worker odmítá klíč.** Stav „Worker přepisu odmítl přístupový klíč – restartuj PZ AI Cut“ se objevil od startu, i po restartu.
  - Kopie `token.txt` v profilu je bajtově shodná s `%APPDATA%\MYpremiereMCP\token.txt`.
  - Worker (python `worker\server.py`) běží od 13:26:37. Profil `%TEMP%\pz-s14-novacek` má vlastní, **jiný** `token.txt` vytvořený 13:29:35.
  - Nejspíš Worker spustila nebo přegenerovala instance jiné role bez `--ai`, a teď jede s cizím klíčem. Worker je sdílený, proto jsem ho nerestartoval a klíč jsem neověřoval.
  - **Dopad:** přepis a titulky z přepisu jsou v S14 mimo hru pro všechny instance s `--ai`. Doporučuji Worker restartovat se skutečným `%APPDATA%`.

## Tabulka

| # | Nález (původně) | Kolo / záv. | Výsledek | Důkaz |
|---|---|---|---|---|
| 1 | TV −23 LUFS vyšlo −21,7 (H.264 i MXF) | S1 red #3, výstup #5 / 3 | **drží** | 60 s: `60s-tv` −22,9 LUFS, `60s-social` −14,1, MCP 9:16 −14,1, MCP MXF (pár) −23,3. Pozn. O2 |
| 2 | XDCAM ztracený snímek 399/400, obraz o snímek napřed | S1 výstup #3 / 3 | **drží** | `xdcam-1080.mxf` 400/400 snímků, video i 2× PCM 16,000 s |
| 3 | DNxHR bez posledního snímku 690/691, zvuk kratší | S1 výstup #4 / 2 | **drží** | `dnxhr.mxf` 400/400, zvuk 16,000 s |
| 4 | XDCAM povolí 1280×720 25p bez varování | S1 výstup #7 / 2 | **drží** | `xdcamOk` = false. Export hlásí „XDCAM HD422 needs 1920×1080 at 25/50 fps … or change the sequence to 1920×1080“ |
| 5 | Po XDCAM nabídne export 9:16 „XDCAM 1080×1920“ | S1 red #6 / 2 | **drží** | Dialog na 9:16: formát h264, XDCAM `disabled` „– jen 1920×1080 nebo 1280×720 při 25/50 fps“, −14 LUFS |
| 6 | Staré „✔ Hotovo“ po přepnutí formátu, dialog se zmenší | S1 red #7 / 2 | **drží** | Po exportu H.264 přepnutí na XDCAM: zpráva prázdná, pruh 0 %, řádek Kodér `visibility:hidden` (místo zůstane) |
| 7 | Timecode v monitoru nejde přepsat | S1 red #8 / 2 | **drží** | Skutečný klik na `#prgTc`, napsáno `1015`, Enter: playhead 10,60 s, „00:00:10:15“, fokus BODY |
| 8 | Nová sekvence pro klip 1280×720 předvybere 9:16 | S1 red #5 / 2 | **drží** | Klik na dlaždici v Projektu, pak `newSequence`: předvolba „1280×720 (HD 16:9)“, 25 fps |
| 9 | 7 snímků moderátorky na začátku klipu (In 7 sn. před střihem kamery) | S1 red #4, výstup #1 / 3 | **drží** | 145,68 → V1 začíná 145,96, předchozí klip převzal 0,28 s (L-střih, propojené). `s1-145.mp4` scdet jen 5,28 |
| 10 | Konec sekvence: 5 snímků celku pod řečí | S2 výstup #3, S3 výstup #5 / 2 | **drží** | 178–185,16 → `hold` 0,20 s. `konec-185.mp4` scdet bez střihu |
| 11 | Konec #219: 4 snímky celku | S3 výstup #4 / 2 | **drží** | `hold` 0,16 s. `k219.mp4` bez střihu |
| 12 | MXF → −23 jen z „Vypnuto“, ze sítí zůstalo −14 | S2 red #7 / 2 | **drží** | Dialog: social → XDCAM = `tv`, titulky jako .srt |
| 13 | Export H.264 po MXF si nechal −23 | S8 red #3 / 2 | **drží** | XDCAM → H.264: `social` (vrátí předchozí). Po znovuotevření z MXF na H.264 také `social` |
| 14 | Dialog předvybere MXF s −14 | S9 red #3 / 2 | **drží** | Znovuotevření po exportu MXF: `xdcam` + `tv` |
| 15 | MCP export ve standalone bez titulků a −30 LUFS | S2 AI / 2 | **drží** | `api.exportSequence` 9:16: `captionsBurned:true`, `loudness:social`, −14,1 LUFS, titulek v obraze (`mcp916-2s.png`) |
| 16 | MXF s vypálenými titulky místo .srt | S5/S6 / 2 | **drží** | MCP MXF: `captionsBurned:false`, `srt:true`, `regrese-s14-mcp.srt` existuje |
| 17 | Autosave přepisuje `.pzcut` | S3 red #1 / 2 | **drží** | Uloženo, značka M: `.pzcut` mtime beze změny (0 značek), `autosave.tnproj` +43 s (1 značka, `autosaveOf` = projekt), `dirty=true` |
| 18 | G „Změnit o“ nastavuje absolutně | S3 red #2 / 2 | **drží** | Klip +3 dB, G: „Nastavit zesílení na“ = 3, „Změnit zesílení o“ = 0. +2 → 5 dB. Věta česky |
| 19 | Ripple delete na V1 rozjede V2/hudbu/titulky; Shift+Delete smaže nevybraný b-roll | S5 red #1, S6 red #1 / 3 | **drží** | B (8–16) s b-rollem V2 9–12: B pryč, V2 zůstal, mezera otevřená, hláška „mezera zůstane… Extract“ |
| 20 | Shift+Delete 2 nesousedních klipů = obyčejný Delete | S6 red #2 / 3 | **drží** | A + C: obě mezery zavřené, V1 0–8, b-roll V2 9–12 → 1–4 (posun s ním) |
| 21 | Titulek se smazanými slovy po Shift+Delete, značky | S5 red #3, S6 red #3 / 2–3 | **drží** | „konec A začátek B“ → „konec A“, „jen v B“ pryč, „ve C“ o −8 s. Značka v B pryč, za ním −8 s |
| 22 | Titulky se smazanými slovy po ripple trimu | S6 red #3 / 3 | **drží** | Q na 18 s: „raz dva“ pryč, „tři čtyři“ 16,00–18,00 |
| 23 | Zpět/Znovu nevrací přesný stav | S8 výstup #3 / revize | **drží** | Shift+Delete → Ctrl+Z = JSON shoda stop, titulků i značek. Ctrl+Shift+Z = shoda po úpravě |
| 24 | Ctrl+D na kraji V2 = zatmívačka do černé | S5 red #10, výstup #1 / 3 | **drží** | Skutečná klávesa Ctrl+D: `vOut {cross, 1 s, under}`. `v2-prolnuti.mp4` YAVG 5,5–7,7 s = 120–122 (žádný propad) |
| 25 | b-roll V2 začíná 7 snímky cizího záběru | S5 výstup #4, S6 výstup #1 / 2 | **drží** | dropMedia na V2 In 145,68 → V2 i A3 od 145,96, propojené, hláška česky |
| 26 | Zopakované snímky `rep` osiří po smazání / zkrácení | S10 red #1 / 3 | **drží** | Shift+Delete klipu s `hold`: na ose nic nezůstane, délka 4,60. Delete jen V: nic po něm na V1 |
| 27 | Ctrl+K / W uvnitř zopakovaného konce ukáže 2 snímky celku | S11 výstup #3 / 2 | **drží** | Ctrl+K 6,04: levý kus `hold 0,08`. W 6,04: `hold 0,08`. Exporty `h-k`/`h-w`: snímek 5,96 = zdroj 1264,88 (PSNR 50 dB), proti celku 13,6 dB |
| 28 | API Auto Reframe rozřízne klip s `hold`, výřez poskočí | S11 výstup #2 / 3 | **drží** | `reframeSequence` k219: 1 klip, `hold`, posX 0,315 |
| 29 | Obraz/zvuk rozpojené po výřezu (API reframe) | S9 red #1, S10 výstup #2 / 3 | **drží** | 60 s → 9:16: 5 kusů V, 5 A, 0 nepropojených, 0 osiřelých zvuků |
| 30 | 9:16 po Auto Reframe: 1 snímek se starým výřezem na střihu kamery | S11 red #1 / 3 | **drží** | Kraje klipů na mřížce snímků (0 mimo). `916-60s.mp4` scdet přesně 21,92 / 26,36 / 53,88 / 57,84 (bez zdvojení o snímek) |
| 31 | Široký klip přetažený do 9:16 přes střih kamery: 0,28 s celku, rozpojený V2 | S9 výstup #1 / 3 | **drží** | dropMedia 120–123 → V2 20,28–23 [120,28], A2 stejně, propojené, hláška. Ctrl+Z ×1 = úklid, ×2 = vložení i výřez naráz |
| 32 | Ctrl+tažení = přepsání (smazal 5 s řeči) | S11 Premiere #1 / 3 | **drží** | Skutečné tažení s Ctrl: C na 6,00, B posunutý na 16, nic nesmazáno, V/A shodně (`ctrl-drag.png`) |
| 33 | Ctrl+Shift+D: 6sn. fade na všech krajích, propad −53 dB | S11 Premiere #2 / 2 | **drží** | Klávesa: jen klip na 11 s `xIn 1`, ostatní kraje 0. `crossfade.mp4` RMS 10,84–11,16 s = −22,9 až −30,7 dB |
| 34 | Solo se v exportu ignoruje | S11 Premiere #3 / 2 | **drží** | Solo prázdné A2 → `solo-a2.mp4` bez zvuku (A1 nezní). Pozn. O4 |
| 35 | Match Frame nechá staré In/Out zdroje | S11 Premiere #4 / 2 | **drží** | Zdroj 200/205 → F na 9 s: In 60, Out 70, čas 63 (= klip) |
| 36 | Vložený nadpis zůstane skrytý; nadpis nejde vypnout | S10, S11 vzhled #1 / 2 | **drží** | Zobrazit ☐ → `title.off:true`. Jedna událost input (vložení) → `off` pryč, ☑ |
| 37 | Relink: přejmenované médium za běhu, import = duplikát | S12 zátěž #5, pád #6 / 2 | **drží** | Přejmenování → export „Media offline: … naimportuj“, dialog to hlásí předem česky. Import nového názvu: „Media relinked“, počet médií stejný (bez duplikátu) |
| 38 | Po „Médium znovu připojeno“ černý Program | S7 vzhled #1 / 3 | **drží** | `<video>` s novým souborem readyState 4, Program ukazuje obraz, 0× „Médium offline“ (`relink-program.png`) |
| 39 | Zpět po znovupřipojení rozbije klipy | revize 41e7a73 / 2 | **drží** | Po relinku Ctrl+K + Ctrl+Z: klip na stejném, existujícím a neoffline médiu |
| 40 | Neštvercové pixely: export zmáčknutý 4:3 | S12 formáty #1 / 3 | **drží** | Médium 1920×1080. `anam.mp4` 1920×1080 SAR 1:1 DAR 16:9 |
| 41 | Druhá mono stopa se ztratí | S12 formáty #2 / 3 | **drží** | `2mono.mp4` stereo, 300 Hz i 1700 Hz −24,1 dB |
| 42 | PNG = 1 snímek, JPG pád | S12 formáty #3 / 3 | **drží** | PNG médium 5 s. `img.mp4` 125 snímků / 5,0 s (JPG nezkoušen) |
| 43 | XDCAM 29,97 ztrácí snímky | S12 formáty #4 / 2 | **drží** | `xdcamOk` 29,97 = false (formát zakázán) |
| 44 | 29,97 + hlasitost: zvuk o 94 ms kratší | S12 formáty #5 / 2 | **drží** | `2997-social.mp4` video 6,006 s / 180 sn., zvuk 6,006 s, RMS posledních 120 ms −16 dB (ne ticho) |
| 45 | Prokládaný zdroj bez odstranění prokladu | S12 formáty #6 / 2 | **drží** | Zdroj idet TFF 100. `i25.mxf` idet Progressive 100, field_order progressive |
| 46 | VFR z mobilu → 29,605 fps | S12 formáty #7 / 2 | **drží** | VFR avg 175/6 (29,17) → médium i sekvence 29,97 |
| 47 | MP3: 15–20 ms ticha na začátku každého kusu | S12 formáty #8 / 2 | **drží** | `mp3.mp4` (kusy 3–5 + 6–8 s): RMS 0–15 ms −24,5 dB, na spoji 2,000 s −24,3 dB (dřív −140 dB) |
| 48 | MXF bez zvuku nemá zvukovou stopu | S12 zátěž #9 / 1–2 | **drží** | `bezzvuku.mxf`: 2× pcm_s24le mono, max −91 dB |
| 49 | In/Out jen In → exportuje se celá sekvence | S12 zátěž #4 / 2 | **drží** | 10 s sekvence, In 5: `jen-in.mp4` 5,0 s |
| 50 | Druhý export do stejného souboru = poškozené MP4 | S12 zátěž #3 / 3 | **drží** | „This file is already being exported…“ (cs v lang.js) |
| 51 | Úprava během exportu = soubor ze dvou stavů | S12 zátěž #2 / 3 | **drží** | Export 120 s a během něj Extract 10–70 s: video i zvuk 120,000 s, snímek 40 s i 100 s = zdroj (PSNR 56/55 dB) |
| 52 | Přepnutí jazyka během exportu = zamrznutí | S12 zátěž #1 / 3 | **drží** | `setLang en` během exportu: jazyk zůstal cs, export dokončen 120 s, pak en, zpět cs |
| 53 | Zrušený export nechá rozbité MP4 + 210 MB v cache | S12 pád #4 / 3 | **drží** | Zrušit po 1,5 s: „Export cancelled.“ (cs „Export zrušen.“), cíl ani `.pzpart` neexistují, `cache\export` prázdná |
| 54 | Export přepíše zdrojové médium | S12 bezp. #4 / 2 | **drží** | „The output would overwrite the source media vyrez-5min.mp4…“ |
| 55 | Zamčený soubor: surové „Permission denied“ | S12 zátěž #7 / 2 | **drží** | Výhradní zámek nešel (aplikace má soubor otevřený), proto odepřené čtení přes ACL: „Soubor je otevřený v jiném programu nebo k němu není přístup – zavři ho a exportuj znovu.“, žádný soubor. ACL vrácen |
| 56 | Neúspěšné uložení tiché, zůstane `.tmp` | S12 pád #1 / 3 | **drží** | Ctrl+S do souboru jen pro čtení: hláška „Cannot save the project… read-only… Save As“ (cs v lang.js), `.tmp` není, soubor beze změny |
| 57 | Obnova po pádu se ztratí, když projekt není na místě | S12 pád #2 / 3 | **drží** | Pád (stop) a přesun `.pzcut`, start: projekt bez cesty, `dirty`, značka zachovaná (`obnova-presunuty.png`). Hlášku jsem nezachytil (zmizela před snímkem) |
| 58 | Dvě okna = jedna záloha (bez zámku) | S12 pád #3 / 2 | **⚠ nestabilní 1/5** | 13:51 se druhý start na **stejném profilu** (9388) otevřel jako plné okno: `/json` vrátil index.html, 2 procesy. Další 4 pokusy (9388 ×3, čerstvý pár 9389/9390) odmítnuté. Příčinu nevím, viz O1 |
| 59 | Cizí JSON se otevře jako prázdný projekt a Ctrl+S ho přepíše | S12 pád #10 / 2 | **drží** | Start s cizím `.pzcut`: „Poslední projekt nejde otevřít: cizi.pzcut není projekt PZ AI Cut.“, prázdný projekt bez cesty, md5 souboru beze změny (`cizi-json.png`) |
| 60 | Poškozená záloha, surová chyba JSON | S12 pád #7 / 2 | **drží** | Useknutá `autosave.tnproj` → `autosave.damaged-….tnproj`, otevřen poslední projekt. Hlášku jsem nezachytil |
| 61 | Pád okna (rendereru) = mrtvé okno bez hlášky | S12 pád #5 / 2 | **drží** | Zabitý renderer → nativní „Okno aplikace spadlo.“ + Znovu načíst / Zavřít. Znovu načíst → nový renderer, projekt otevřený |
| 62 | Projekt z cizí ruky: XSS→RCE, UNC únik hashe, navigace | S12 bezp. #1, #2, #12, S13 #7 / 3 | **drží** | Projekt `zly.pzcut` (HTML v názvu, `gainDb` řetězec, `id` s atributem, `__proto__`): payload nespuštěn, `gainDb` = 0 (číslo), id nahrazeno, záložka escapovaná, prototyp čistý. UNC `\\s14-neexistuje-host`: nativní dotaz Připojit/Nepřipojovat, po Nepřipojovat offline, žádný proces s UNC cestou (`zly-projekt.png`). CSP bez inline skriptu i handleru. `window.open` = null, `location.href` nenaviguje. Most `constructor` = Unknown function |

**Nejde ověřit** (přepis nefunguje, viz Prostředí; původní kroky potřebují přepis z Workeru):
- S2 výstup #1/#2 – titulek se slovem z vedlejšího úseku,
- S3/S4 výstup #1 – jednořádkové titulky 9:16 pod 0,7 s,
- S5 výstup #2 – poslední titulek nulové délky,
- S10/S11 výstup #1 – titulky na neviditelném řezu zvuku,
- S4 red #3, S8 red #2 – varování při řezu uprostřed slova,
- S11 red #2 – výběr z Přepisu začíná slovem jiného mluvčího,
- S11 AI #1 – `add_captions` vynechá slovo,
- S12 zátěž #8 – přepis tónu, IndexError.

Část logiky titulků pokrývají jednotkové testy (38/38).

## Poznámky (ne regrese)
- **O1 – zámek jedné instance (#58):** jediné selhání byl první pokus proti instanci, která běžela 23 min. Hlavní proces přitom nic viditelného nedělal.
  - Možná příčina (neověřeno): Chromium ProcessSingleton nedostal od prvního procesu včas odpověď, a druhý proces pak zámek dostal.
  - Druhé okno nad stejnou zálohou je přesně původní riziko.
  - Doporučení: opakovaný test (10× start proti běžící instanci), log `requestSingleInstanceLock` v main.js, v `second-instance` i zápis do logu.
- **O2 – TV hlasitost u krátké sekvence:** 16 s ze dvou úseků vyšlo podle ebur128 na −23,9 LUFS (sítě −13,6). loudnorm samotný měří výstup −23,00.
  - Je to rozdíl měřidel (loudnorm vs. ebur128 na krátkém materiálu): vstup podle loudnorm −28,03, podle ebur128 −28,9.
  - Kód hlasitosti se od S11 nezměnil (jen `apad`). Na 60 s je to −22,9 / −14,1.
  - QC s ebur128 by krátký spot (pod 20 s) mohlo vrátit. Návrh: měřit 1. průchod ebur128 a zesílení počítat z něj, nebo ověřit výstup a dorovnat.
- **O3:** Zdroj u zablokovaného síťového média ukazuje v záložce „sitovy.mp4 · creating proxy...“ (anglicky a zavádějící, proxy nevzniká – `proxy` null, žádný proces). Záv. 1.
- **O4:** Solo prázdné stopy dá MP4 úplně bez zvukové stopy (ne tichou stopu). Pro sítě to může vadit. Záv. 1.
- **O5:** Trvá známý otevřený bod S4 #6: k30 (8 snímků celku na konci, řeč pokračuje) zůstává bez `hold` – v souhrnu je jako otevřený, nejde o regresi.

## Doporučené automatické testy (run-tests.js)
Exporter, media i edit jsou v node testech už použitelné (sada exportuje přes ffmpeg). Média generovat ffmpeg lavfi do `media.CACHE/test` (pár sekund).

1. **Bezpečný Shift+Delete** (#19, #20, #21): `E.removeClips(seq, ids, true)`.
   - B-roll přes mazaný úsek → mezera zůstane, `removeClips.blocked === 1`, V2 beze změny.
   - Nesousední A+C → obě mezery zavřené, V2 posunutý.
   - Titulky s `ws`: slova z úseku pryč, za ním −d, značky v úseku pryč.
   - Totéž `rippleTrimToPlayhead` (Q/W) s titulky (#22).
2. **Zopakovaný konec `hold`** (#26, #27): klip s `hold {d:0.16,out}`.
   - `razor` a `rippleTrimToPlayhead('next')` uvnitř → levý kus má `hold` se zbytkem a `vSrc` nikdy neukáže zdroj ≥ `out − d`.
   - `removeClips` → na stopě nic nezůstane.
3. **Ctrl+tažení / Alt+tažení** (#32): `E.moveClips(seq,[C],dt,0,'video',{insert:true})` → počet klipů stejný, B za C. `{copy:true}` → +1 klip, originál na místě.
4. **Prolnutí na V2** (#24): `applyTransitionAt` na volném kraji klipu V2 nad V1 → `vOut.type==='cross' && under`. Bez stopy pod ním → `dipBlack`.
5. **Prolnutí zvuku** (#33): logiku `commands.audioFade` přesunout do `edit.js` (čistá funkce). Test: jen střih u hlavy dostane `xIn`, ostatní kraje 0, bez rezervy krátký fade.
6. **Export – ochrany** (#49–#54): mini sekvence 2 s z lavfi.
   - Druhý `exportSequence` do stejného výstupu během prvního → chyba.
   - Výstup = zdroj → chyba.
   - `range:'inout'` jen s In → délka = konec − In.
   - `signal.cancelled` + `kill()` → cíl ani `.pzpart` neexistují, pracovní složka smazaná.
   - Úprava `seq` po startu exportu → výstup má délku původního stavu.
7. **xdcamOk a videoFilter** (#4, #5, #43, #45): tabulka velikostí a fps (720p25, 1080p29,97, 1080×1920 → false; 1080p25, 720p50 → true). `videoFilter` u `interlaced` média obsahuje `bwdif`.
8. **Formáty přes probe + export** (#40–#42, #44, #46–#48), ffprobe na výstupu:
   - SAR 4:3 → `width` 1920,
   - 2× mono → obě frekvence v exportu,
   - PNG → 5 s / 125 sn.,
   - MP3 kus od 3 s → RMS prvních 15 ms > −60 dB,
   - 29,97 + `loudness:social` → konec zvuku = konec obrazu,
   - VFR → fps 29,97,
   - MXF bez zvuku → 2 mono stopy.
9. **Hlasitost** (#1, O2), pomalejší, třeba jen nightly: 30–60 s z `vyrez-5min.mp4`, `tv` → ebur128 −23 ±0,5, `social` −14 ±0,5. Případ 2× 8 s jako známá hranice měřidel.
10. **Načítání projektu** (#59, #60, #62): `loadProjectFile` a výběr zálohy vytáhnout z `renderer.js` do modulu.
    - Cizí JSON → chyba „není projekt“.
    - Useknutá záloha → odložena `.damaged-*`.
    - `uncHost()` pro `\\server\…`, `//server/…`, `\\?\UNC\…` (síť) a `\\?\C:\…` (ne) → `uncBlocked`, bez `fs.existsSync` na UNC.
11. **Relink importem** (#37, #39): párování chybějícího média (délka, rozměry, název u zvuku) přesunout do `importer.js`. Test: jeden kandidát → přesměrování se stejným id, bez duplikátu. Dva kandidáti → nic.
12. **Dialog Export – hlasitost podle formátu** (#12–#14): pravidlo (MXF → tv, zpět → předchozí, předvybrané MXF → tv, 9:16 → social, XDCAM disabled) vytáhnout do čisté funkce `exportDefaults(seq, settings, fmt)` a otestovat tabulkou.

Zámek jedné instance (#58) a pád okna (#61) jsou mimo node testy. Hodí se do skriptu nad `test/standalone.js` (start téhož profilu 10× → 0 oken na druhém portu).

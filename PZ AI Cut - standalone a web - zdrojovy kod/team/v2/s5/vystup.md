# Kolo S5 – Kontrolor výstupu: „Je export vícestopých sekvencí bezchybný?“

**Skládání vrstev, mix, synchronizace, hlasitost a MXF jsou přesné. Bezchybné to ale není:**
- **prolínačka na kraji klipu V2 vede do černé**, ne do V1 pod ním,
- **poslední věta 16:9 sekvence nemá titulek** (titulek má nulovou délku),
- **b-roll na V2 může začít 7 snímky cizího záběru**,
- **API `buildSequence` neumí překryv**.

Konec zdrojového souboru už most nezasekne: postavení sekvence trvá 3,3 s, Auto Reframe 2–4 s.

Jak jsem testoval:
- Instance: `standalone.js start 9372 %TEMP%\pz-s5-vystup --size 1600x900 --lang cs --ai`, na konci `stop 9372`. MCP ani AI panel jsem nepoužil.
- **Stavba sekvence `s5-multi`** (`build.js`, 1280×720, 25 fps, 50,08 s):
  - V1/A1: `TN.app.api.buildSequence` (`audioFades: 2`) ze 3 výroků 28min rozhovoru: 1544,4–1574,2, 1596,0–1612,1 a 749,52–753,32. Úklid krajů prodloužil Out třetího výroku na 753,68.
  - V2/A2: b-roll z `vyrez-5min.mp4` přes `TN.app.dropMedia(m, in, out, at, false, {video:1, audio:1})`. Je to stejná funkce jako přetažení z Projektu. Úseky na časové ose: 8–12 s (zdroj 30), 27–33 s (zdroj 200) a 40–43 s (zdroj 120).
  - A3: hudba `O:\STRIH TEST\data\mus_stem.wav`, 0–50,08 s, přes `dropMedia(…, {audio:2})`.
  - Zesílení: `clip.gainDb` A2 = −12 dB, A3 = −18 dB, přímým zápisem v `TN.app.edit`.
  - Přechody příkazy nabídky `TN.app.cmd`:
    - `applyCross` na střizích V1 29,80 a 45,92 (29,80 je pod V2),
    - `applyCross` na obou krajích b-rollu 1 (klip vybraný),
    - `applyDipBlack` na konci.
- **Další sekvence:**
  - `s5-multi1080` = JSON kopie s 1920×1080 pro XDCAM,
  - 9:16 a 1:1 přes `window.__pzReframe` (cesta nabídky Formát pro sítě),
  - titulky **dialogem** Titulky z přepisu (klik „Vytvořit titulky“).
- **Exporty:** pomůckou `exporter.exportSequence` místo dialogu. Dialog Export jsem otevřel a prohlédl: `05-dialog-export-s5-multi.png`, „Celá sekvence (00:00:50:02)“, XDCAM pro 720p zašedlé.
  - 37 souborů `web/test-out/vystup-s5-*`.
  - Navíc „solo“ exporty: kopie sekvence se ztlumenými ostatními zvukovými stopami, AAC i PCM (ProRes).
- **Měření** (skripty v `s5/vystup/`). Zdroj se vždy dekóduje nezávisle na exportéru, výstupním `-ss` od začátku souboru:
  - `vrstvy.py`: která vrstva je vidět na každém snímku,
  - `sync_off.py`: posun ±2 snímky,
  - `prolnuti.py`: alfa po snímcích,
  - `mix.py`: zesílení, linearita a cvaknutí,
  - `titulky.py`: Whisper large-v3 int8_float16 na solo A1/A2 + maska titulků,
  - `ptsdiff.py` / `pts.py`: časy snímků,
  - `delka.py`,
  - `zabery.py` (z S4),
  - ebur128.

## Tři nejdůležitější nálezy
1. **Prolínačka (Ctrl+D) na kraji klipu V2 udělá zatmívačku do černé uprostřed videa (3).**
   - Postup: b-roll na V2 (8–12 s) vybrat a dát `applyCross` u jeho začátku a konce.
   - Stavový řádek hlásí „Cross Dissolve applied at 00:00:08:00“, v modelu je ale `vIn/vOut = dipBlack 1 s` (`build.log`). Příčina: `applyTransitionAt` → „prolínačka bez souseda = roztmívání z černé“, V1 pod klipem se nebere v úvahu.
   - V exportu jde obraz na 7,96 s z V1 (jas 118) **tvrdým střihem do čisté černé** (sn. 200, jas 0). Pak se 1 s roztmívá do b-rollu. Na konci je to obráceně: zatmí se do jasu 4 (sn. 299) a na 12,00 tvrdě skočí zpět na V1 (jas 116) (`vrstvy-multi.txt`, `23-169-V2-prolinacka-na-kraji-sn197-230.png`).
   - Stejně je to v MXF, 9:16 i 1:1 (sn. 200–222 a 278–299). Monitor Program ukazuje totéž (`04-monitor-8.08.png` jas 9,6), takže náhled a export se shodují.
   - Premiere tu prolíná do V1 (průhlednost). Uživatel dostane 2× „blik do černé“ uprostřed rozhovoru.
2. **Poslední věta sekvence nemá titulek: titulek 45,92–45,92 s nulovou délkou (3).**
   - V 16:9 `s5-multi` je 12. titulek „A pak jsem začala dělat / moderátorku v rádiu.“ s nulovou délkou. Maska exportu ukazuje titulky jen do 45,92 a **45,92–50,08 je bez titulku**, přestože se mluví (`titulky-multi.txt`, `03-multi-titulek-45.92-chybi.png`).
   - **Není to vícestopé:** stejně dopadla jednostopá kontrola `s5-ctrl` a `s5-ctrl-23`, kde je titulek na 16,12–16,12.
   - Kdy to nastává:
     - jen když poslední úsek pochází z **dřívějšího místa zdroje** než předchozí (749,52 po 1596),
     - stejný úsek jako první (`s5-ctrl-32`) nebo samotný (`s5-ctrl3`) má titulek správně,
     - poslední úsek z pozdějšího místa (`s5-ctrl-2d`) také (`caps-ctrl*.log`).
   - Auto Reframe titulky přeskládá a v 9:16/1:1 je titulek zase vidět (45,92–49,30).
   - Vedlejší, není vada aplikace: Whisper Workeru v tomhle místě vynechal „to tak hezky jako prolínalo, jo“ (slovo „pak“ trvá 749,86–751,24). Titulek 9:16 proto ukazuje „A pak jsem začala“ asi o 1,6 s dřív, než to zazní.
3. **API `buildSequence` neumí překryv a b-roll na V2 si nechá cizí záběr (2).**
   - `videoTrack: 1` položí segment **za** předchozí (5,6–8,6), ne přes něj. Parametr `at` neexistuje.
   - Zvuk takového segmentu jde na **A1**, `audioTrack: 1` se ignoruje. `placed` ten zvuk vůbec neuvádí (`apivt.log`).
   - Překryv tedy přes `buildSequence` (MCP `build_sequence`) nepostavíš, šel jen přes `dropMedia` nebo `buildTimeline` (ten jsem nespouštěl, neověřeno).
   - **Cizí záběr na začátku b-rollu:** b-roll 3 (zdroj 120,00) má ve zdroji střih kamery na 120,28. **Prvních 7 snímků je celek**, pak detail (`zabery.txt`: krátký záběr 40,00 / 7 sn. v 16:9, 9:16, 1:1 i XDCAM; `25-169-V2-b3-zacatek-sn998-1009.png`).
   - Úklid krajů (`edgeShots`) na V2 nezasáhl, `merged 0`. Na V1 by se takový zbytek převzal od souseda.

## Nálezy
| # | výstup | čas | vada | naměřeno | záv. | důkaz |
|---|---|---|---|---|---|---|
| 1 | multi 16:9/1080/9:16/1:1, MXF | 8,00–9,00, 11,00–12,00 | prolínačka na kraji V2 = dip do černé, tvrdý střih do černé | jas 118 → 0 (sn. 200), 4 → 116 (sn. 299/300) | 3 | vrstvy-*.txt, 23-*.png, 04-monitor-*.png |
| 2 | multi 16:9 (+ ctrl, ctrl-23 jednostopé) | 45,92–50,08 | poslední titulek nulové délky, věta bez titulku | 45,92–45,92 / 16,12–16,12 | 3 | titulky-multi.txt, caps-ctrl*.log, 03-*.png |
| 3 | API `buildSequence` | – | `videoTrack` nepřekrývá, zvuk V2 segmentu na A1, `placed` bez zvuku | segment 5,6–8,6, zvuk A1 | 2 | apivt.log |
| 4 | multi všechny formáty | 40,00–40,28 | b-roll V2 začíná 7 snímky cizího záběru, `edgeShots` V2 neřeší | 7 sn. | 2 | zabery.txt, 25-*.png |
| 5 | H.264 **bez vypálených titulků** (multi916-bez, multi11-bez) | od 46,46 | nepravidelný čas snímku: krok 20 ms, zbytek videa o půl snímku dřív. Při převodu na CFR se snímek zdvojí / zahodí | posl. pts 50,020 místo 50,040 | 2 | ptsdiff.txt, pts-916-bez.txt |
| 6 | multi 16:9 | 49,08–50,08 | stmívačka začne o snímek později (sn. 1228 ještě plný jas) a poslední snímek není černý | sn. 1251 jas 9 (8 %) | 1 | vrstvy-multi.txt |
| 7 | multi (sítě) | 50,08 | hudba A3 na konci utne, i když obraz stmívá (A1 je už v pauze) | posl. 0,2 s: mix −19,0 dBFS, A3 sólo −32,7, A1 sólo −67,1 | 1 | konec-zvuk.txt |
| 8 | solo A2 | 33,00 | konec b-rollu na A2 bez prolnutí (dropMedia nedává fade) → cvaknutí jen při sólu | 2,60 (mix 0,39) | 1 | mix-pcm.txt |
| 9 | eofL, eofOver | konec | Out = délka zvuku zdroje 1686,976, obraz končí 1686,96 → sekvence 6,976 s (ne na snímek), zvuk o 16 ms delší | 174 sn. / 6,976 s | 1 | delka-zvuku.txt, eof.log |
| 10 | multi (API) | – | `buildSequence` hlásí `duration` 49,72, skutečná po úklidu krajů 50,08 | – | 1 | build.log |

Nález 5 podrobně:
- `ffprobe` u `vystup-s5-multi916-bez.mp4` dává pts 46,44 → **46,46** → 46,50 …, poslední snímek 50,020.
- Dekódování do CFR (výchozí ffmpeg) pak zopakuje snímek 1160 třikrát a jeden vynechá. Proto `vrstvy-916.txt` hlásí sn. 1162 jako cizí. V passthrough je obraz správně.
- Vzniká to v cestě `-c:v copy` (bez titulků i nadpisu) za jednosnímkovým úsekem: konec prolínačky 46,42 (půl snímku) a řez Auto Reframe 46,48.
- H.265, DNxHR, XDCAM a ProRes stejné sekvence jsou v pořádku. 16:9 bez titulků také (`ptsdiff.txt`).

## Co je v pořádku (měřeno)
| oblast | výsledek |
|---|---|
| viditelná vrstva V2 nad V1 | **V2 přesně na sn. 200–299, 675–824, 1000–1074** (8,00/12,00/27,00/33,00/40,00/43,00 s, žádný snímek navíc ani chybějící). Chyba k očekávané vrstvě medián 0,5 (16:9), 1,0 (XDCAM), 1,6–1,9 (9:16, 1:1); k druhé vrstvě 8–47. Prolínačka V1 29,80 pod V2 neprosvítá (27–33 s max. 0,5). Odchylky jen v přechodech (`vrstvy-*.txt`) |
| A/V sync obrazu | posun **0 snímků** u všech 6 klipů V1/V2 (16:9, XDCAM, MP4 s titulky; `sync.txt`) |
| zvuk po stopách | A1 0,00 dB, **A2 −12,00 dB**, **A3 −18,00 dB** (PCM). AAC −12,01 / −18,06. Posun 0,00 ms, r = 1,000 u všech 7 klipů (`mix-pcm.txt`, `mix.txt`) |
| mix | mix − (A1+A2+A3) = −175 dBFS (PCM), tedy přesný součet. V mixu A1 −29,3, A2 −41,4, A3 −35,9 dBFS RMS |
| cvaknutí na hranách | mix 0,04–0,43 na všech 10 hranách (práh 1,5). Jen sólo A2 33,00 = 2,60 (nález 8) |
| LUFS | sítě **−13,9** (16:9, 9:16, 1:1; TP −1,4), −14,0 (eofMulti). TV **−23,0** MP4, **−22,9** XDCAM/DNxHR 1080/720, −23,0 eofMulti MXF. Krátké klipy: eofL −13,8, start0 −13,4 (7 s) (`hlasitost.txt`) |
| MXF | XDCAM 1080 a DNxHR 1080/720: **1252/1252 snímků**, 2 mono PCM 24 bit, 50,080 s; zvuk = obraz (0 ms). eofMulti MXF 264/264. XDCAM 720p25 správně odmítnut s vysvětlením. MXF bez titulků (copy) také 1252, pravidelné |
| prolínačka V1 (45,92) | **plynulá**: alfa 0,000 → 0,999 po krocích 0,038–0,041 na sn. 1136–1161 (25 sn., 45,44–46,44), zbytek 0,6–0,9 (`prolnuti-multi.txt`) |
| titulky jen z A1 | 0 slov titulků jen z A2. Whisper slyší 34 slov b-rollu (−12 dB) a žádné v titulcích není. 16:9: 121 slov titulků v řeči A1 (10 nenalezeno = nulový titulek + 2 tvary). 9:16/1:1: 128 slov (`titulky-multi*.txt`) |
| výřez 9:16 / 1:1 u V2 | obličej nalezen v 11/11 záběrech, Bára ve středu ve všech záběrech V2, i v celku (`20-916-v2-vyrez.png`, `21-11-v2-vyrez.png`). Úklid krajů s V2 nespadl |
| konec zdrojového souboru | `buildSequence` do 1686,976: **3,3 s** (eofL), 3,4 s (eofV 296–300), 3,3 s (Out 1690 → oříznuto na 1686,976), vícestopá eofMulti 3,4 s; Auto Reframe 9:16 2,1 s a 4,1 s. Celý `eof.js` 22,4 s. Exporty 0,6–2,2 s. Obraz = zdroj do posledního snímku (eofL/eofV max. chyba 0,9/0,5). Přes MCP most **neověřeno** (zakázáno) |
| začátek na 0,0 s | start0 (V1 L 0–4 + V 0–3, V2 V 0–1,6 od 0,0, roztmívání): 175 sn., od sn. 25 přesná shoda (0,6). Krátké „záběry“ 1,60–1,68 jsou znělka TALK ve zdroji (`30-start0-kazdy8.png`). 9:16 také |

Neověřeno:
- MCP most a `buildTimeline`,
- příkaz „Fade In / Fade Out Sequence“ (stmívá i zvuk?),
- 4:5,
- přechod mezi dvěma sousedními klipy na V2,
- víc než 3 zvukové stopy,
- poslech (vše jen měřením).

Důkazy a skripty: `team\v2\s5\vystup\`. Exporty: `web\test-out\vystup-s5-*` (MP4, MXF, MOV).

# Kolo S2 – Kontrolor výstupu: „Je hotový export ze standalone bezchybný pro diváka a pro vysílání?“

**Skoro. Všechny čtyři opravy z S1 platí:**
- uprostřed sestřihu už nic neproblikne,
- MXF s titulky má přesný počet snímků a sync,
- hlasitost sedí na cíl,
- XDCAM se odmítne u nestandardní velikosti.

Divák ale pořád uvidí dvě věci:
- **titulek slova, které v sestřihu skoro nezazní** (v 9:16 dokonce samostatný 4snímkový titulek „dále.“ na úplném začátku),
- **5 snímků celku na úplném konci** klipu, který končí v řeči.

Jak jsem testoval:
- Instance `standalone.js start 9372 %TEMP%\pz-s2-vystup --size 1600x900 --lang cs --ai`, na konci `stop 9372`. MCP ani AI panel jsem nepoužil.
- Import `test/media/vyrez-5min.mp4`. Přepis byl už v mezipaměti Workeru (stav done do 20 s).
- Sekvence jsem stavěl přes `TN.app.api.buildSequence` s úseky ze S1:
  - **a** 16:9 (scéna S1, 4 úseky), **b** = Auto Reframe 9:16 z a, **c** = 1:1 z a (`reframeSequence` s 1080×1080),
  - **d** = 1:1 ze scény S1-d, **e** 16:9 (scéna S1-e),
  - **a1080 / e1080**: totéž v 1920×1080 kvůli XDCAM,
  - **long**: 71 s, 3 úseky.
- Titulky jsem dělal **dialogem** `TN.app.cmd('captionsFromTranscript')` → klik na „Vytvořit titulky“ (`01-titulky-dialog.png`).
- Exportoval jsem pomůckou `exporter.exportSequence` (15 exportů v `web/test-out/vystup-s2-*`). Dialog Export jsem otevřel a nasnímal (`02`–`04`).
- Měření (skripty v `s2/vystup/`):
  - `zabery.py`: délky záběrů v exportu,
  - `sync_snimky.py`: posun obrazu proti zdroji po klipech,
  - `sync_zvuk.py`: korelace zvuku,
  - `cvak.py`, `obalka2.py`: RMS,
  - `whisper_s2.py`: large-v3 int8_float16 po ≤25 s,
  - `titulky.py` a `titulky_rms.py`: titulky proti řeči,
  - ebur128 a ffprobe.

## Tři nejdůležitější nálezy
1. **Titulky z přepisu berou i slovo, ze kterého je v klipu jen 10–90 ms. Divák čte slovo, které neslyší.**
   - Jak: hranice klipu 104,60 a slovo „dále.“ v přepisu 104,39–104,69. V úseku je jen 0,09 s konce slova, Whisper ho v exportu neslyší.
   - 16:9 (a): titulek začíná „**dále.** A zjistilo se to…“.
   - **9:16 (b): samostatný titulek „dále.“ 0,00–0,13 s (4 snímky) jako první obraz videa.** Je to probliknutí titulku (`b-titulek-dale-0.00.png`).
   - Stejně „**poprat** a byla to…“ (a/b 12,72): ze slova zbývá 0,02 s, slyšet je jen „-at“.
   - A „**že** nebyla možnost…“ (d 0,00): v klipu je 0,01 s slova.
   - Naopak „neřekla.“ (e 6,28, v klipu 0,08 s) titulek správně vynechal, takže pravidlo je nekonzistentní.
   - Závažnost 2 (9:16: 3).
2. **Zbytek cizího záběru na úplném konci sekvence zůstává (5 snímků celku s moderátorkou), jako v S1.**
   - Kde: d 1:1 27,44–27,64 a e 16:9 / e1080 XDCAM 9,60–9,80.
   - Proč: klip končí 185,16 a střih kamery ve zdroji je 184,98. Oprava konec neodstřihne, protože v posledních 0,2 s ještě doznívá „pryč.“ (RMS −8 až −12 dB, `quietHead` = řeč).
   - Výsledek: poslední snímky videa jsou jiný záběr (`d-snimky-27.44.png`, `e-snimky-9.6.png`).
   - Uprostřed sestřihu je oprava v pořádku: 0 záběrů kratších než 13 snímků v a, b, c, a1080, long (S1: 7 snímků moderátorky v a, b, d).
   - Závažnost 2.
3. **Pro vysílání je teď MXF technicky čisté. Zbývají body S1, které nebyly v opravách.**
   - Počty snímků jsou přesné: XDCAM 400/400 a 245/245, DNxHR 400/400 a 691/691.
   - Obraz má na každém klipu posun 0 snímků proti zdroji, zvuk 0,0 ms (korelace 1,00).
   - TV hlasitost: −23,3 / −23,0 / −22,9 LUFS.
   - Nezměněno ze S1:
     - **TC 00:00:00:00**,
     - **jen 2 mono stopy**,
     - **XDCAM bez titulků (cesta kopie) má na spojích nepravidelné GOP** (`…BBPP I…`, `IBBPBP`).
   - Bez TV specifikace Novy to nerozhodnu, proto jen závažnost 2.

## Nálezy
| # | výstup | čas | vada | naměřeno | záv. | důkaz |
|---|---|---|---|---|---|---|
| 1 | b 9:16 | 0,00–0,13 | samostatný titulek „dále.“ (4 sn.), slovo neslyšet | v klipu 0,09 s slova, Whisper nic | 3 | b-titulek-dale-0.00.png, titulky-vs-whisper.txt |
| 2 | a, a1080, d | 0,00 / 12,72 | titulek obsahuje slovo z vedlejšího úseku („dále.“, „poprat“, „že“) | v klipu 0,09 / 0,02 / 0,01 s slova | 2 | titulky-vs-whisper.txt, a-titulek-poprat-12.72.png |
| 3 | d, e, e1080 | konec (27,44 / 9,60) | 5 snímků celku na konci | střih kamery 184,98, Out 185,16, v tom řeč | 2 | zabery.txt, d-snimky-27.44.png |
| 4 | a, d, e | 12,72 / 0,00 / 6,28 / 16,00 | úlomky slov na krajích: „-at“ (RMS −6 dB hned za střihem), „Že…“, „-kla“ (0,15 s, −19 až −31 dB), na konci náběh „a“ | stejné hranice jako S1, tedy stejný výsledek. Stavěl jsem přes API bez MCP `cutBounds` | 2 | obalka.txt, whisper-a-d-e.txt |
| 5 | d | 4,67 | titulek „co nám zbylo…“ o 0,30 s později než řeč | nástup řeči 4,37 | 1 | obalka.txt |
| 6 | d, long (sítě) | konec | zvuk AAC kratší o 60 / 40 ms (27,58 vs 27,64; 71,12 vs 71,16). TV verze a ProRes jsou přesné. Nejspíš dynamický `loudnorm` v režimu sítí | dekódované vzorky | 1 | delka-zvuku.txt |
| 7 | MXF | – | TC 00:00:00:00, 2× mono, GOP na spojích (bez titulků) | ffprobe | 2 | ffprobe.txt |
| 8 | a, a1080, long | 12,72 / 40,00 | cvaknutí na střihu 6,1× / 2,7× p99,5 | `api.buildSequence` bez `audioFades`. Přes MCP se přidávají 2 snímky prolnutí, ručně postavené sekvence ale ne | 1 | cvak.txt |
| 9 | dialog Export | – | 16:9 sekvence má výchozí hlasitost „Vypnuto“ (9:16 −14, MXF −23 se přepne samo) | – | 1 | 04-export-dialog-720.png |

## PŘED (S1) / PO (S2)
| oblast | S1 | S2 |
|---|---|---|
| probliknutí uprostřed (scéna 145,68) | 7 snímků moderátorky v a 16:9, b 9:16, d 1:1 | **0**: a, b, c (1:1), d. Předchozí záběr převezme 7 snímků, pod nimi je ticho (−44 až −50 dB), takže nevzniká nesoulad rtů |
| zbytek na konci sekvence | 5 sn. d, e | **5 sn. d, e** (nezměněno, řeč v nich) |
| MXF s titulky, počet snímků | XDCAM 399/400, DNxHR 690/691 | **400/400, 245/245, 691/691, 400/400** |
| XDCAM posun obrazu | +1 snímek od klipu 4, obraz napřed o 40 ms | **0 na všech klipech**, zvuk 0,0 ms |
| TV hlasitost (cíl −23 ±0,5) | −22,0 / −22,3 / −23,0 | **−23,3 / −23,3 / −22,9 / −23,0 / −22,9 / −22,9** (9,8–71 s) |
| sítě (cíl −14) | −13,4 až −13,6, TP −1,4 | **−13,9 až −14,0**, TP −1,4 až −1,5 dBTP |
| XDCAM nestandardní | 1280×720 25p prošlo | **odmítne** 720p25 i 1080×1920 (chyba anglicky). V dialogu je volba šedá s textem „ne pro tuhle velikost obrazu“ a výchozí je H.264. Při volbě MXF se hlasitost přepne na −23 |
| titulky proti řeči | +0,32 / +0,91 / +0,59 s pozdě | nástup po pauze −0,27 až +0,16 s, jednou +0,30. Konce ±0,15 s. Žádné slyšené slovo nechybí (jen výplňová „jako/vlastně“, záměrně) |
| slova navíc v titulcích | – | **„dále.“, „poprat“, „že“** (nález 1–2) |
| A/V sync, černé snímky, barvy | 0,0 ms, 0, tv/bt709 | 0,0 ms (9 exportů), 0 (15 exportů), tv/bt709 |

**Bez chyby:**
- H.264, H.265 a ProRes: snímky a délky přesné, sync 0.
- MXF XDCAM a DNxHR s titulky: snímky a sync přesné.

**Zbývá:**
- titulky slov ze sousedního úseku,
- konec sekvence se zbytkem záběru,
- TV metadata MXF (TC, stopy).

# Kolo S6 – Kontrolor výstupu: „Jsou opravy po S5 správně a nic se nezhoršilo?“

**Shrnutí:** prolínačka na V2, titulek poslední věty a Shift+Delete jsou v exportu správně. Regresi jsem nenašel.
**Nevyřešený zůstal b-roll 3.** Jeho 7 snímků celku je dál v 16:9 i 9:16/1:1, protože úklid krajů se sám nespustí.

**Co jsem testoval:**
- Instance a kód:
  - `standalone.js start 9372 %TEMP%\pz-s6-vystup --size 1600x900 --lang cs --ai`, na konci `stop`. MCP ani AI panel jsem nepoužil.
  - Hlavní měření běželo na **kódu 99fd961**.
  - Commit **6bce4ac** (01:50, Shift+Delete znovu změněn) přišel až po mém měření. Na něm jsem v 2. instanci (`%TEMP%\pz-s6-vystup2`) zopakoval jen bod 4.
- Stavba `s6-multi` stejně jako v S5 (`s6/vystup/build.js`, výsledek `build.log`):
  - V1/A1 přes `api.buildSequence`, b-roll V2/A2 přes `dropMedia`, hudba A3,
  - zesílení −12/−18 dB,
  - `applyCross` na 29,80 a 45,92, na obou krajích b-rollu 1 a `applyDipBlack` na konci.
- Titulky jsem vytvořil kliknutím v dialogu Titulky z přepisu (`caps.js`).
- 9:16 a 1:1 vznikly přes `__pzReframe`.
- Exporty:
  - pomůckou `exporter.exportSequence` místo dialogu. Dialog Export jsem otevřel a prohlédl: `shots-vystup/05-dialog-export-mxf.png`,
  - 34 + 10 souborů `web/test-out/vystup-s6-*` a `vystup-s6b-*`.
- Měření (skripty v `s6/vystup/`):
  - z S5: `vrstvy.py`, `sync_off.py`, `mix.py`, `titulky.py` (Whisper large-v3 int8_float16), `zabery.py`, `ptsdiff.py` a ebur128,
  - nové: `prolnutiV2.py` (alfa V2↔V1 po snímcích v libovolném výřezu), `rdcmp.py` (export po smazání proti posunutému originálu, obraz i PCM po stopách) a `srccache.py` (snímky zdroje jedním průchodem dekodéru; ověřeno proti výstupnímu `-ss`, rozdíl 0,0).

## Tři nejdůležitější nálezy
1. **b-roll 3 pořád začíná 7 snímky celku. Oprava funguje jen při ručním spuštění úklidu v 16:9 (2).**
   - Bez zásahu jsou v exportu na 40,00–40,28 stále **7 snímků celku**, a to v 16:9, XDCAM 1080, 9:16 i 1:1 (`zabery.txt`, `shots-vystup/13-b3-zacatek-multi916-bez-*.png`).
   - Ruční `window.__pzEdgeShots(s6-multiES)` to opraví:
     - trvá 1,0 s a hlásí `merged 1`,
     - V2 je pak 40,28–43,00 (zdroj 120,28),
     - export má 0 krátkých záběrů a `vrstvy-ES.txt` ukazuje V2 přesně od sn. 1007.
   - Auto Reframe 9:16 z takto uklizené sekvence je také čistý (`vystup-s6-multiES916-bez.mp4`: 0 krátkých záběrů).
   - **Auto Reframe z neuklizené sekvence zbytek neodstřihne.** b-roll rozdělí na střihu kamery na klip 40,00–40,28 (zdroj 120,00) a 40,28–43,00 a hlásí `merged 0`. Krátký kus má navíc **jiný výřez** (9:16 posX 0,752 proti 0,286; 1:1 1,000 proti 0,446) (`rf.log`).
   - **Má se úklid spouštět sám? Ano, u klipu vloženého do V2+ přes jiný obraz.**
     - `cutHead`/`cutTail` jen ořízne obraz. Pod ním je vidět spodní stopa, nic se neposouvá a soused se nemění, takže je to bezpečné.
     - Uživatel 7 snímků nevidí, dokud video nepřehraje snímek po snímku.
     - Stačí krátká hláška „odstřiženo 7 snímků jiného záběru, Ctrl+Z vrátí“.
     - Stejnou kontrolu by měl udělat Auto Reframe, protože zbytek z V2 sám nepozná.
   - Vedlejší (1): po `cutHead` je V2 odpojené od A2. Zvuk b-rollu začíná na 40,00, obraz až na 40,28, takže zvuk běží 0,28 s napřed (−12 dB). Klip se pak nehýbe se svým zvukem.
2. **Prolínačka (Ctrl+D) na kraji V2 je opravená: plynulé prolnutí do V1, žádná černá (dřív 3).**
   - Ve všech 7 exportech jde začátek (sn. 201–224) a konec (sn. 276–299) po krocích alfy **0,029–0,048 na snímek**:
     - 16:9 bez titulků i s titulky,
     - 9:16, 1:1,
     - MXF DNxHR 720, XDCAM 1080, DNxHR 1080.
   - Zbytek po proložení je nejvýš 0,8 (16:9) až 2,3 (1:1). **Jas se drží na 115–148** a mezi snímky skočí nejvýš o 1 (dřív skok 118 → 0) (`prolnuti-v2-souhrn.txt`, `shots-vystup/10-*`, `11-*`, `12-*`).
   - Náhled se shoduje s exportem. Jas monitoru Program je 123,2–124,5 na 7,96–12,04 s (dřív 9,6), průhlednost horního videa 0,04 → 0,48 → 0,96 (`monitor.txt`, `shots-vystup/mon-*.png`).
   - `zabery.py` už nenachází tvrdé střihy na 8,00 a 12,00, které v S5 vznikaly skokem do černé.
3. **Shift+Delete: export je synchronní na snímek a vzorek. Pozor, od 6bce4ac se chování zase změnilo (2, informativní).**
   - Na 99fd961 jsem vyzkoušel dvě mazání s vybraným V1+A1:
     - RD1: kus V1 9,64–10,68 pod b-rollem 1,
     - RD2: celý V1 klip 29,80–45,92 pod b-rolly 2 a 3.
   - Výsledek obou se shoduje s originálem posunutým o 26, resp. 403 snímků:
     - **posun 0 snímků ve všech úsecích po 1 s** (50/50, 34/34), chyba nejvýš 0,3, resp. 3,1 v prolínačce 29,3–30,3, která se změnila podle očekávání,
     - **zvuk A1/A2/A3/mix posun 0,00 ms, rozdíl −66 až −176 dB pod signálem** (`rdcmp-rd1.txt`, `rdcmp-rd2.txt`).
   - Titulky po mazání sedí na řeč: 127 slov v řeči A1, 0 slov jen z A2 (`titulky-rd1.txt`). Zesílení klipů je přesné (`mix-rd1-pcm.txt`).
   - **6bce4ac** (po mém měření) mezeru s b-rollem přes ni už nezavře. V modelu zůstane 9,64–10,68 prázdné na V1/A1 (RD2: 29,80–45,92) a objeví se hláška „Mezera zůstala … přes Extract (I a O kolem něj, pak ')“.
   - **Extract (I 9,64 / O 10,68, `cmd('extract')`) na 6bce4ac** dává model shodný s RD1 a export **shodný s RD1 na pixel** (max. chyba 0,0). Proti originálu má posun 0 a zvuk −66 až −176 dB (`rdcmp-rx1-6bce4ac.txt`).
   - Export Shift+Delete s otevřenou mezerou na 6bce4ac jsem neměřil (neověřeno).
   - Drobnost (1): titulek rozdělený přes hranu **ztratí zalomení řádku** a ukáže se na jednom řádku. Například „komu se tohle stalo, tak neříkat tyhle fádní věci,“. V 9:16 vychází na zhruba 9/10 šířky obrazu, ještě se vejde (`shots-vystup/s6-rd1-tit-*.png`, `s6-rd916-tit-*-dole.png`).

## PŘED S5 / PO S6
| # | co | PŘED (S5) | PO (S6, měřeno) | stav |
|---|---|---|---|---|
| 1 | Ctrl+D na kraji V2 | dip do černé, jas 118 → 0 (sn. 200), 4 → 116 (sn. 299/300) | prolnutí V1↔V2, krok 0,029–0,048 na sn., jas 115–148, 16:9/9:16/1:1/MXF i monitor | **opraveno** |
| 2 | poslední titulek | 45,92–45,92, věta bez titulku. ctrl-23: 16,12–16,12 | 45,92–**49,87**, maska 35,56–49,88. ctrl-23: 16,12–**20,07** (maska do 20,08). 9:16/1:1 do 49,92 | **opraveno** |
| 3 | b-roll 3 – 7 sn. celku | 40,00 / 7 sn. všude | bez zásahu stále 7 sn. (16:9, XDCAM, 9:16, 1:1). Po ručním `__pzEdgeShots` 0 (16:9 i následný 9:16) | **částečně** (nález 1) |
| 4 | Shift+Delete vícestopé | posunulo jen V1/A1 (redaktorka S5) | 99fd961: vše synchronní (0 sn., 0,00 ms). 6bce4ac: mezera zůstane, Extract synchronní | **opraveno**, 6bce4ac jiné chování |
| 5 | MXF titulky | vypálené | dialog s XDCAM: vypálit vypnuto, .srt zapnuto, hlasitost TV. Zpět na MP4 vypálit zapnuto. `.srt` vznikl, poslední titulek 45,920–49,870 | **opraveno** |

## Regrese S5 (nic se nezhoršilo)
| oblast | S6 naměřeno |
|---|---|
| vrstvy | V2 přesně na sn. 200–299, 675–824, 1000–1074. Medián chyby 0,5 (16:9, DNxHR 720), 1,0 (XDCAM 1080), 0,9–1,9 (9:16, 1:1). Neshody jen v přechodech (sn. 200–212, 288–299, 1143–1154, stmívačka 1231–1251) (`vrstvy-*.txt`) |
| A/V sync | posun **0 snímků** u všech klipů V1/V2: 16:9 bez titulků, s titulky, XDCAM 1080, ES (`sync.txt`). U rd1 skript spadl na krátkém klipu, sync ověřen v `rdcmp` |
| mix (PCM) | A1 +0,00, **A2 −12,00**, **A3 −18,00 dB**, posun 0,00 ms, r = 1,000. Mix − součet = −175,2 dBFS. Cvaknutí v mixu 0,00–0,41 (`mix-pcm.txt`). AAC −12,01/−18,06 (`mix.txt`) |
| LUFS | sítě **−13,9** (16:9, 9:16, 1:1, rd1, rd2, rd916; TP −1,4/−1,5), ctrl-23 −14,1. MXF (A1+A2 sloučené) **−22,9** XDCAM/DNxHR 1080/720, TP −7,9 (`hlasitost.txt`) |
| MXF | XDCAM 1080, DNxHR 1080 i 720: **1252/1252 snímků**, 2× mono PCM 24 bit, 50,080 s (`mxf.txt`) |
| titulky jen z A1 | **0 slov jen z A2.** Whisper slyší 34 slov b-rollu. 130/131 slov titulků je v řeči A1 (16:9, 9:16, 1:1, ctrl) (`titulky-*.txt`) |
| zvuk 9:16/1:1 | shodný s 16:9 (rozdíl −240 dBFS) |
| Auto Reframe | 9:16 6,4 s, 1:1 4,4 s, ES 9:16 i s exportem 11,4 s. Obličej 11/11 (`rf.log`, `rfes.log`) |

## Trvá ze S5 (beze změny, nehlásím znovu jako nové)
- **S5 #5:** H.264 bez vypálených titulků 9:16/1:1 (cesta copy) má pts 46,46 (krok 20 ms) a poslední snímek 50,020 (`ptsdiff.txt`). Platí i pro ES 9:16. 16:9, XDCAM, rd1 a rd2 jsou pravidelné.
- **S5 #6:** poslední snímek stmívačky není černý, jas 9 (sn. 1251).
- **S5 #8:** sólo A2 cvakne na 33,00 (2,60). V mixu 0,39.
- **S5 #10:** `buildSequence` hlásí 49,72 místo 50,08.
- **Okolo přepisu (ASR):**
  - Worker vynechal „to tak hezky jako prolínalo, jo“ (Whisper exportu 46,22–47,5), takže poslední titulek ukazuje text zhruba o 1,6 s dřív.
  - Slovo „jako“ na 35,16 je bez titulku. Bylo tak i v S5.
- Při mazání RD1 jsem řezal 9,64/10,68 těsně u slov (Whisper slyší „…věci. Je teď líp“). Řez A1 nemá zvukové prolnutí, cvaknutí v mixu je ale jen 0,21 (sólo A3 1,46, A1 0,46), tedy pod prahem.

## Neověřeno
- Export Shift+Delete s otevřenou mezerou na 6bce4ac.
- MCP most a API `buildSequence` s překryvem (S5 #3).
- 4:5.
- Přechod mezi dvěma sousedními klipy na V2.
- Poslech (vše je jen měřené).

Důkazy: `team\v2\s6\vystup\` (skripty, logy, `sekvence.json` / `sekvence2.json`) a `team\v2\s6\shots-vystup\`. Exporty: `web\test-out\vystup-s6-*` a `vystup-s6b-*` (6bce4ac).

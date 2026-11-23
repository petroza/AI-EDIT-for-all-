# Kolo S8 – Kontrolor výstupu: „Je finální stav bez regrese proti nejlepším naměřeným výsledkům noci?“

**Odpověď: ano, regresi jsem nenašel.** Všechno, co jsem změřil, je stejné jako nejlepší hodnota noci (S3, S4 a S6), nebo lepší.

Nové věci fungují:
- **Sekvence 9:16 z dialogu Nová sekvence + vkládání z Přepisu** dostane výřez podle obličeje. Celek je stejný jako po Auto Reframe, „jen stůl“ už nevzniká.
- **b-roll na V2** se sám očistí od cizího záběru (obraz i zvuk) a V1 zůstane beze změny.
- **Zpět/Znovu** vrací přesný stav sekvence.

Neopravené zůstávají jen známé drobnosti z dřívějška: zopakované snímky na konci (cuknutí rtů) a titulek přes prolínačku o 0,05 s.

**Jak jsem testoval:**
- **Instance:** `standalone.js start 9372 %TEMP%\pz-s8-vystup --size 1600x900 --lang cs --ai`, na konci `stop 9372`. MCP ani AI panel jsem nepoužil.
- **Kód:** HEAD e7698a3, okno načtené 02:4x.
- **Commit 3291973** přišel během měření (03:01). Mění jen varování o střihu uprostřed slova a paměť hlasitosti v dialogu Export (`renderer.js`, `timeline.js`). Cesty, které jsem měřil, nemění, ale na 3291973 jsem nic nepouštěl.
- **Import** přes `TN.app.importPaths`.
- **Jednostopé sekvence:**
  - stavba přes `api.buildSequence` (`audioFades: 2`),
  - 9:16 a 1:1 přes `api.reframeSequence`,
  - titulky **dialogem** Titulky z přepisu (klik na „Vytvořit titulky“).
- **Vícestopá sekvence** `s8-multi` je kopie S6 (`build-multi.js`):
  - dropMedia b-rollu na V2/A2, hudba na A3, −12/−18 dB,
  - prolínačky přes `cmd('applyCross')` a `cmd('applyDipBlack')`.
- **Shift+Delete, Extract, Zpět a Znovu** přes `TN.app.cmd(...)`.
- **9:16:**
  - **dialog Nová sekvence** (`cmd('newSequence')`, předvolba 1080×1920, klik OK),
  - pak `m.srcIn/srcOut`, `TN.app.openSource(m)` a `TN.app.insertFromTranscript('end')`,
  - b-roll přes `TN.app.dropMedia(m, 120, 123, 20, false, {video:1, audio:1})`.
- **Exporty:**
  - pomůckou `exporter.exportSequence` místo dialogu. **Dialog Export jsem v tomhle kole neotevřel** (neověřeno),
  - 32 souborů `web/test-out/vystup-s8-*`.
- **Měření** (skripty z S3, S4 a S6, nové v `s8/vystup/`):
  - `zabery.py`, `whisper_s2.py` (large-v3, int8_float16, jen 4 exporty), `titulky_souhrn.py`, `titulky_multi.py`,
  - `sync2.py` (zobecněný sync z S3 pro oba zdroje), `sync_off.py`, `vrstvy.py`, `prolnutiV2.py`, `mix.py`, `rdcmp.py`,
  - `skok.py` a `posun.py`, `cvak.py`, ebur128 a ffprobe,
  - `obliceje.py` + `dlazdice916.py` (nové: je v 9:16 člověk).

## Tři nejdůležitější nálezy
1. **Žádná regrese.** Kontroloval jsem 19 exportů (16:9, 9:16, 1:1, XDCAM 1080, DNxHR 720) z jednostopých scén S2/S4, z vícestopé `s8-multi` a z nové 9:16.
   - **Záběry:** 0 kratších než 13 snímků.
   - **A/V sync:** 0 snímků, 0,0 ms.
   - **Hlasitost:** sítě −13,9 až −14,1 LUFS, TV −22,9 až −23,4 LUFS.
   - **MXF:** všechny snímky sedí.
   - **Titulky:** žádný kratší než 0,7 s, žádný ze sousedního úseku.
   - **Řeč na střizích:** Whisper kolem střihů slyší slovo od slova totéž co v S3/S4.
   - **Mix:** −12,00 / −18,00 dB.
   - **Vrstvy:** přesné.
   - **Extract:** na snímek a na vzorek.
   - Podrobnosti v tabulce níže.
2. **NOVÉ 9:16 z dialogu funguje (dřív záv. 3, redaktorka S7).**
   - **Výřez:** po `insertFromTranscript('end')` dostane široký záběr do 3,6–5,9 s výřez podle obličeje. `posX` je 0,752 pro celek 1596,00–1599,76 a 0,752 pro celek z výřezu 115,60–119,36; detaily mají 0,27–0,32.
   - **Hlášky:** stav „Výřez podle obličeje: hledám obličeje (1/1)“ a pak „Připraveno“.
   - **Zpět:** jedno vložení = jeden krok „Insert“, kroky výřezu jsou sloučené.
   - **Export:** v celku je mluvčí, ne stůl (`shots-vystup/21-v916-snimky.png`).
     - Kontrolní kopie se středovým výřezem (`posX 0`, stav před opravou) ukazuje jen stůl (`22-v916-stred-kontrola-snimky.png`).
     - Obraz celku se shoduje s Auto Reframe ze 16:9 (`s8-sim916`): průměrná chyba 1,45, středový výřez 56,87 (`v916-vs-autoreframe.txt`).
   - **b-roll na V2:**
     - Hned po vložení je 20,00–23,00 (zdroj 120,00).
     - Do 1 s se ořízne na **20,28–23,00 na V2 i A2** (zdroj 120,28) a objeví se hláška „Na kraji b-rollu bylo odstřiženo pár snímků jiného záběru kamery (Ctrl+Z vrátí).“
     - **V1/A1 se nezmění** (porovnání JSON = shoda).
     - Export: střih na 20,28, 0 krátkých záběrů.
3. **Zpět/Znovu vrací přesný stav (obsah sekvence: stopy, titulky, značky = JSON shoda).**
   - **9:16:** 5× Zpět jde přesně přes stavy po b-rollu (oříznutí → vložení b-rollu → 3. / 2. / 1. vložení) až na prázdnou sekvenci. 5× Znovu se vrátí na stav po b-rollu. První Zpět vrátí jen ořez b-rollu, jak slibuje hláška (`v916e.log`).
   - **Shift+Delete** RD1 (3 kroky: 2× Add Edit a Ripple Delete), **Shift+Delete** RD2 (1 krok) i **Extract** (In/Out a Extract): Zpět = stav před operací, Znovu = stav po ní, celý projekt (`snapshot`) je shodný (`rd.log`).

## Nejlepší dosud / PO S8
| oblast | nejlepší dosud (kolo) | PO S8 (měřeno) | stav |
|---|---|---|---|
| probliknutí (záběr < 13 sn.) | 0 (S4, S6) | **0** v 19 exportech: a, sim, k219 × 16:9/9:16/1:1, a1080 a sim1080 XDCAM, sim DNxHR, multi 16:9/9:16/1:1/XDCAM, rx1, v916 (`zabery.txt`) | = |
| konec sekvence #219 | 0 sn. cizího celku. Zopakované snímky: výřez poskočí +23 px (9:16), +14 px (1:1) (S4) | 0 sn. celku. **Výřez −2 px (9:16), −2 px (1:1), 0 px (16:9)**. Skok obrazu na sn. 33→34 je dál vidět: 13,9 proti 5,0–8,1 (9:16), 11,0 proti 3,5–7,8 (1:1), 5,6 proti 1,6–3,5 (16:9) (`konec-k219.txt`) | lepší, cuknutí rtů trvá (známé) |
| titulek ze sousedního úseku | žádný (S3, S4) | **žádný** (a, sim, k219 × 3 formáty, v916, multi) (`titulky-souhrn.txt`) | = |
| titulek < 0,7 s (2 řádky) | 0 (S4) | **0** ve 13 sekvencích, nejkratší 0,74 s (v916) a 0,80 s (multi916) | = |
| titulek přes střih | 0 (S4) | 0 u tvrdých střihů. multi916/multi11: „něco. prostě.“ do 29,85 přes prolínačku 29,80, **stejně jako S6** | = (záv. 1) |
| chybějící řeč v titulcích | jen výplně (S4, S6) | jen „jako“, „vlastně“ (záměrně) a „A“ v předběhu Whisperu (−0,50 s, p 0,42, i v S3) | = |
| useknutá slova na střizích | „A“ na 0,00 u a (S3, S4) | **slovo od slova stejné** jako S3/S4 (a 2,76 / 7,24 / 12,72, sim 29,80). v916 má hranice jako sim (`whisper.txt`, `whisper-v916.txt`) | = |
| cvaknutí na střihu | 0 (S4) | 0,00 (a, sim). v916 0,22 a 0,09 (< 1,5) (`cvak.txt`) | = |
| A/V sync obraz | 0 sn. (S4, S6) | **0 sn.** u všech klipů: a, a1080 XDCAM, sim, sim DNxHR, sim1080 XDCAM, k219, multi V1+V2, multi1080 XDCAM (`sync.txt`, `sync-multi.txt`) | = |
| A/V sync zvuk | 0,0 ms, r = 1,00 | **0,0 ms**, r = 0,99–1,00 (12 exportů včetně 9:16 a v916) | = |
| LUFS sítě | −13,9 až −14,0 (S4, S6) | **−13,9** (a, sim, multi × 3 formáty), **−14,1** (v916), TP −1,4/−1,5. k219 (1,52 s) −16,4, krátký klip, stejně jako S4 | = |
| LUFS TV | −22,9 až −23,4 (S4, S6) | **−23,4** (a1080 XDCAM), **−22,9** (sim1080 XDCAM, sim DNxHR, multi1080 XDCAM) | = |
| MXF snímky | 400/400, 1252/1252 (S4, S6) | **400/400, 1148/1148 (2×), 1252/1252**, 2× mono PCM 24 bit (`mxf.txt`) | = |
| zvuk 9:16/1:1 = 16:9 | −240 dBFS (S6) | −240 dBFS (a, sim, k219) | = |
| vrstvy (multi) | V2 přesně, medián 0,5 (16:9), neshody jen v přechodech (S6) | stejné: medián 0,5 / 1,0 XDCAM / 1,1–1,9 (9:16, 1:1). **V2 b-roll 3 přesně od sn. 1007**. Neshody jen 200–212, 288–299, 1142–1155, 1231–1251 (`vrstvy-*.txt`) | = |
| b-roll 3 – 7 sn. celku | 7 sn. bez zásahu, A2 o 0,28 s napřed (S6) | **0 sn.:** V2 **i A2** 40,28–43,00 (zdroj 120,28) samo, s hláškou. 9:16 i 1:1 bez krátkého kusu | **opraveno** |
| prolínačka V2 (Ctrl+D) | krok 0,029–0,048, skok jasu 1 (S6) | krok 0,029–0,044, zbytek 0,8–1,8, skok jasu 1 (16:9, 9:16, XDCAM) (`prolnuti-v2-souhrn.txt`) | = |
| mix | A2 −12,00, A3 −18,00, posun 0,00 ms, lin. −175,2 dBFS (S6) | **přesně stejné** (`mix-pcm.txt`) | = |
| titulky jen z A1 | 0 slov jen z A2 (S6) | **0**. Titulky jsou shodné se S6 (12/12) (`titulky-multi.txt`) | = |
| Shift+Delete pod b-rollem | 6bce4ac: mezera zůstane, export neověřen (S6) | mezera 9,64–10,68 (RD1) a 29,80–45,92 (RD2) zůstane, červená hláška česky. **Export RD1:** v mezeře chybí jen A1, RD1 − (A2+A3) = −70,6 dBFS; mimo mezeru = originál (−67 dB, AAC); obraz V2 nad mezerou, 50,08 s (`rd1-mezera-zvuk.txt`, `vrstvy-rd1.txt`) | **ověřeno** |
| Extract (I/O + ') | posun 0 sn., zvuk −66 až −176 dB (S6) | posun 0 sn. (50/50 s), max. chyba 0,3. Zvuk a1 −65,8, a2 −177,9, a3 −174,8, mix −66,3 dB (`rdcmp-rx1.txt`) | = |
| **NOVÉ** 9:16 z dialogu + vložení z Přepisu | středový výřez, „jen stůl“ (redaktorka S7) | výřez podle obličeje, celek shodný s Auto Reframe (chyba 1,45 proti 56,87) | **opraveno** |
| **NOVÉ** b-roll V2 v 9:16 | – | ořez 0,28 s na V2+A2, V1/A1 beze změny, hláška | OK |
| **NOVÉ** Zpět/Znovu | – | přesný stav po všech 5 a 3 operacích | OK |

## Ostatní nálezy (záv.)
- (1) b-roll vložený přes `dropMedia` do sekvence 9:16 dostane **středový výřez** (`posX 0`). Výřez podle obličeje se dělá jen u vkládání z Přepisu. Tady to nevadí, protože b-roll 120,28 je detail a obličej je 13/13 vzorků. Široký b-roll by ukázal střed (neověřeno).
- (1) Zvuk b-rollu přes `dropMedia` jde na A2 v 0 dB. Whisper pak pod b-rollem na 20,3–22,6 slyší místo „komu se tohle stalo, tak“ → „možnostce na to“. Titulky jsou správně z A1. Je to věc mixu (v Premiere stejné), ne chyba aplikace.
- **Pozor pro další měření:** u 28min zdroje vrací `ffmpeg -ss` **před** `-i` jiný záběr (1596,6 s: detail místo celku, `shots-vystup/dbg-sim-src-1596.6-*.png`). `sync2.py` proto dekóduje zdroj s výstupním `-ss`. První běh dal falešnou chybu 11,7 u sim klipu 2, opraveno, viz `sync.txt`.

## Neověřeno
- Dialog Export v tomhle kole (exporty jen pomůckou).
- Jednořádkové titulky 9:16 (nejlepší dosud: 7 × < 0,7 s, min. 0,46 s po c03cddf).
- Zbytek 6–12 sn. celku na konci (k30, S4).
- Kód 3291973.
- 4:5.
- MCP.
- Pts H.264 bez titulků přes copy (S5 #5).
- Poslech (vše je jen měřené).
- Whisper na 9:16/1:1 jsem nepouštěl. Zvuk je bitově shodný se 16:9, slova titulků jsem porovnal proti Whisperu 16:9.

Důkazy a skripty: `team\v2\s8\vystup\`:
- logy `build*.log`, `caps*.log`, `rd.log`, `v916c–e.log`,
- data `sekvence.json`, `whisper*.json`,
- výsledky `*.txt`.

Snímky: `team\v2\s8\shots-vystup\` (20–23, dbg). Exporty: `web\test-out\vystup-s8-*`.

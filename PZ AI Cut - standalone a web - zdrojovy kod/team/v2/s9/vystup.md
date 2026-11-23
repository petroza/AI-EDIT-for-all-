# Kolo S9 – Kontrolor výstupu: závěrečná regrese exportů před vydáním

**Verdikt: NEPOUŠTĚT bez opravy jedné regrese (záv. 3).** Výstupy jsou jinak beze změny proti S8 (19 exportů bitově shodných).
Ale nový výřez podle obličeje při přetažení (70047c0) **vyřadil úklid cizího záběru na kraji klipu v sekvenci 9:16**.
Na začátku b-rollu proto problikne 7 snímků celku. V S8 to bylo opravené.

## Nálezy

| # | záv. | nález | důkaz | S8 → S9 |
|---|---|---|---|---|
| 1 | **3** | **Široký klip přetažený přes střih kamery do 9:16 už se neočistí.**<br>`dropMedia(vyrez-5min, 120, 123, …)` (zdroj 120,00–120,28 je jiný záběr):<br>• klip se rozdělí na **0,28 s celku (posX 0,752)** a detail,<br>• na V2 i V1 chybí hláška „odstřiženo pár snímků“ a krok „Clean up camera-cut leftovers“,<br>• rozpadne se propojení: **obraz V2 má `linkId null`, zvuk A2 si propojení nechá** a dál začíná na 20,00.<br>V 16:9 (s9-a) úklid funguje dál: 2,28–5,00, hláška. | `vystup-s9-v916.mp4`: **krátký záběr 20,00 (7 sn.)**, S8: žádný (`zabery.txt`)<br>snímky `shots-vystup/01` (S9 celek 20,00–20,24) a `02` (S8)<br>monitor na 20:03: `04`<br>`v916d.log`, `drop916c.log` | **regrese** (S8 opraveno, 0 sn.) |
| 2 | 2 | **Jednořádkové titulky 9:16** (styl 1 řádek, dialog Titulky z přepisu):<br>• **sim916-L1:** 46 titulků, nejkratší **0,54 s**. Pod 0,7 s je 12/46 (26 %), z toho 6 je přesně 0,70 (0,6999). Pod 0,69 s je 6/46 (13 %).<br>• **v916-L1:** nejkratší **0,30 s** („Bych jako“ 16,07–16,37 hned po střihu 16,08, za ním 0,40 s bez titulku). | `titulky-L1.txt`, `titulky-souhrn.txt` | S4 (měřeno): 15/46, min. 0,20 s<br>Commit c03cddf (neověřeno): 7/46, min. 0,46 s<br>**S9: min. 0,54 s, ale 0,30 s po střihu** |
| 3 | 1 | Zvuk b-rollu na A2 kvůli #1 začíná o 0,28 s dřív (20,00). Hlasitost v916 je −14,1 LUFS jako v S8.<br>Whisper pod b-rollem slyší „někými možnostce na to“ (mix A2 0 dB, známé z S8). | `whisper.txt`, `hlasitost.txt` | = (souvisí s #1) |

## Ověřeno OK (proti S8)

**(a) Výřez podle obličeje při `TN.app.dropMedia` do 1080×1920 (sekvence z dialogu Nová sekvence):** OK.
- **Postup** (`drop916.js` → `drop916.log`):
  1. první vložení celku do prázdné sekvence,
  2. přepsání na konec V1 detailem,
  3. celek za detail,
  4. celek na V2 nad detail.
- **Výřez:** posX 0 hned po vložení, za 3–4 s je **posX 0,752** u celku a 0,271 u detailu. Hláška „Výřez podle obličeje: hledám obličeje (1/1)“.
- **Historie:** vždy jen 1 krok „Overwrite“. **Jedno `cmd('undo')` vrátí přesný stav před vložením** (JSON stop, titulků i značek se shoduje), `redo` vrátí stav po výřezu. Platí to ve všech 4 krocích.
- **Pozor na test:** sekvence je po Zpět/Znovu nový objekt, kontrolu je proto potřeba hledat podle id. První běh to nedělal a dal falešné „nevrátí“.

**Exporty bitově shodné s S8 (MD5, `md5-vs-s8.txt`), celkem 19:**
- **16:9 / 9:16 / 1:1 a/sim/k219** s vypálenými titulky i bez nich,
- **multi:** prolínačky V1, Ctrl+D do stopy pod klipem, b-roll V2, hudba A3, −12/−18 dB,
- **PCM sóla.**

Bitová shoda znamená, že pro tyhle soubory platí beze změny měření z S8: záběry, sync, Whisper na střizích, prolnutí V2 a mix. Titulky (počet, časy, text) a stopy všech těchto sekvencí se s S8 shodují (`sekvence-vs-s8.txt`).

| měření (S9) | výsledek | S8 |
|---|---|---|
| délka / fps (ffprobe) | všechno 25/1:<br>• a 16,00 s (400 sn.),<br>• sim 45,92 s (1148),<br>• multi 50,08 s (1252),<br>• k219 1,52 s (38),<br>• v916 50,36 s (1259),<br>• **In/Out 23,00 s (575)** | = |
| LUFS sítě (ebur128) | −13,9 (a, sim, multi, In/Out), −14,1 (v916), k219 −16,4 (1,5 s), peak −1,4/−1,5 | = |
| LUFS TV | XDCAM a1080 −23,4, sim1080 −22,9, multi1080 −22,9; DNxHR −22,9; **ProRes HQ −22,9** | = |
| MXF | 400/1148/1252 snímků, 2× mono PCM 24 bit. Zvukové stopy framemd5 = S8. DNxHR dekódovaně = S8. XDCAM obraz mimo spodní pás je proti S8 prům. 0,10–0,16 (max 0,48). Spodní pás se liší jen tím, že S9 má titulky jako **.srt** (výchozí od S6), S8 je měl vypálené | = |
| MXF .srt | 6/11/12 titulků, časy i texty = sekvence (odchylka 0,0 s) (`srt.txt`) | nové |
| In/Out 10–33 s (`range:'inout'`) | obraz včetně titulků = plný export od 10 s (max. chyba 0,64, 0 snímků ve spodním pásu > 3). Zvuk posun 0,0 ms, r 1,00. Zisk proti plnému exportu kolísá −0,74 až +0,15 dB, protože se normalizuje samostatně (`inout.txt`) | nové |
| ProRes HQ | 1148 sn., sync obrazu i zvuku +0 sn. / 0,0 ms, střihy 29,80 a 33,56, krátké záběry žádné | nové |
| A/V sync | XDCAM a1080/sim1080 posun +0 u všech klipů, zvuk 0,0 ms. v916 zvuk 0,0 ms (`sync.txt`) | = |
| probliknutí | 0 krátkých záběrů ve 4 MXF, ProRes, In/Out, sim916, multi916. **v916: 1 (#1)** | **horší (#1)** |
| useknutá slova (Whisper large-v3, CUDA int8_float16) | v916 na střizích stejně jako S8: „cokoliv. \| Bych jako“, „prostě. \| Takže“. In/Out 19,80 = sim 29,80: „něco prostě, \| ale my“ (`whisper.txt`) | = |
| cvaknutí | v916: 0,22 a 0,09 (`cvak.txt`) | = |
| titulky 2řádkové | 0 pod 0,7 s, 0 přes střih. Nejkratší 0,74 s (v916), 0,80 s (sim916) | = |

## Jak jsem testoval
- **Instance:** `node test/standalone.js start 9372 %TEMP%\pz-s9-vystup --size 1366x768 --lang cs`, **bez --ai**. Na konci `stop 9372`, port je ověřeně volný. HEAD e5942e6.
- **Přepisy:** bez `--ai` je Worker odmítne, proto jsem před startem zkopíroval IndexedDB přepisů z profilu `pz-s8-vystup`. Je to stejný Whisper výstup, stav „done“ u všech 3 médií.
- **AI panel:** Claude, Codex ani Hermes jsem nespustil. AI panel je v okně vidět sám (záhlaví ukazuje „bridge :7890“), nepoužíval jsem ho.
- **Stavba a titulky:**
  - stavba přes `api.buildSequence`, 9:16 a 1:1 přes `api.reframeSequence` / `__pzReframe`,
  - titulky **dialogem** Titulky z přepisu (klik na tlačítko),
  - jednořádkové: kopie sekvencí se `captionStyle.lines = 1`, pak stejný dialog.
- **Exporty:**
  - pomůckou `exporter.exportSequence` **místo dialogu Export**,
  - dialog jsem otevřel a prohlédl (`shots-vystup/03`, H.264 9:16: vypálit + .srt zaškrtnuté, hlasitost −14),
  - 30 souborů `web/test-out/vystup-s9-*` (27 médií + 3 .srt).
- **Skripty** v `s9/vystup/`:
  - z S8: `zabery.py`, `sync2.py`, `cvak.py`, `titulky_souhrn.py`, `dlazdice916.py`,
  - nové: `cmp_obraz.py`, `whisper_s9.py` (CPU záloha přes `DEV=cpu`, CUDA šla), `drop916.js`, `drop916c.js`, `l1copy.js`.

## Neověřeno
- Příčina #1 v kódu. Podle čtení `src/renderer.js` `dropMedia` je větev „výřez pro širší záběr“ v řetězu `else if` před `__pzEdgeShots`, takže se úklid krajů pro 9:16 nespustí. Nezkoušel jsem to.
- Shift+Delete / Extract (v S9 se nezměnily, nespouštěl jsem je).
- 4:5, H.265, MOV H.264, dialog Export jako cesta exportu, MCP `export_sequence`, poslech.
- Whisper na 9:16/1:1: zvuk je bitově shodný se 16:9.

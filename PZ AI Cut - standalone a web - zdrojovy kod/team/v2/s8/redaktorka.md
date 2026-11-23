# Redaktorka – kolo S8 (závěrečné): celý den v PZ AI Cut místo Premiere (2026-11-23)

**Otázka:** Je PZ AI Cut po noci připravený, aby ho kolegyně v redakci zítra použila místo Premiere na krátké věci?

**Odpověď: Ano, na krátké věci (výpověď 16:9, verze 9:16 na sítě, MXF do vysílání), za tří podmínek níž.**
- Celý den (a)–(e) proběhl bez jediného zaseknutí: 02:43:10 → 02:58:30, tedy 15 min i s mým měřením.
- Všechny tři hlavní nálezy z S6/S7 jsou opravené:
  - Shift+Delete už nemaže nevybraný materiál.
  - Titulky po ripple trimu nemají smazaná slova.
  - Svislá sekvence z dialogu má výřez podle obličeje.
- Nic z dnešního dne nepoškodilo materiál.
- Obnova po pádu i znovupřipojení přesunutého souboru fungují.

**Instance:** 9371, `--size 1920x1080 --lang cs --ai`, čistý profil `%TEMP%\pz-s8-redaktor`, HEAD e7698a3. AI panel jsem hned zavřela (✦ AI) a nepoužila.

**Ovládání:** vlastní `ui.js` ve scratchpadu přes CDP `Input.dispatchMouseEvent/KeyEvent/insertText`: klik, Shift+klik, dvojklik, pravý klik, kolečko, tažení, klávesy, psaní. Stav jsem jen četla přes `eval` a strojově ho porovnávala před a po každé operaci.

**Pomůcky místo nativních prvků:**
- **Import** (dialog jsem neotevřela): `TN.app.importPaths`, 2×.
  - Na začátku 3 soubory: rozhovor, kopie b-rollu v `%TEMP%\pz-s8-media` a hudba `O:\STRIH TEST\SPRT168_181….wav`.
  - Pak import z nového místa (krok e).
- **Nabídky okna:**
  - `TN.app.cmd('reframe916')` = Sekvence → Auto Reframe → 9:16.
  - `cmd('save')` = Soubor → Uložit. Při prvním uložení jsem `project.path` nastavila v `eval`, protože nativní dialog Uložit automat neumí. Ctrl+S je nativní akcelerátor a přes CDP nefunguje.
- **Export:** vždy přes dialog ⇪ Export v aplikaci, cestu jsem vepsala do pole. Tlačítko „…“ jsem nepoužila.
- **Nativní rozbalovací seznamy** (Předvolba, Formát, Hlasitost) jsem ovládala klávesami: focus a šipky.
- **Tažení klipu z Projektu na časovou osu** (HTML drag&drop) přes CDP nejde. Hudbu jsem proto vložila jako v Premiere: dvojklik, cíl zdroje A2, playhead 0, „.“.

## 3 nejdůležitější nálezy

1. **Shift+Delete s hudbou pod celou sekvencí nikdy nezavře mezeru (záv. 2).**
   - **Postup:** výrok na V1/A1 rozstřižený Ctrl+K (17,96–24,60), hudba na A2 přes celou sekvenci, Shift+Delete.
   - **Výsledek:** zůstane díra 6,64 s a hláška „Mezera zůstala: přes ni leží jiný klip (b-roll, hudba). Úsek ze všech stop vyjmeš přes Extract (I a O kolem něj, pak klávesa apostrof).“ (snímek 25).
   - Je to bezpečné a hláška radí správně. Extract pak funguje bezvadně (snímek 26).
   - **Dopad:** redaktorka s hudbou na A2 musí místo jednoho stisku pokaždé značit I/O a dát `'`, nebo zamknout A2. S podkresem je to běžná situace, tak se to stane skoro vždycky.
   - Jak se v tomhle případě chová Premiere (sync lock), jsem neověřila.
2. **Ripple trim (B) uřízne slovo bez varování (záv. 2).**
   - **Postup:** B, tažení konce výroku o 1,16 s doleva. Kraj se přichytil na 25,48, tedy zdroj 553,98.
   - **Whisper zdroje:** „zajímavým“ 553,80–554,66. Střih padl doprostřed slova.
   - **V exportu `redaktorka-s8-d-upravy.mp4`** Whisper slyší „rozpovídat dělství.“ (24,96–25,44). Titulek přitom ukazuje „…dělit se jako“.
   - Žiletka podle souhrnu noci před řezem uprostřed slova varuje. Ripple trim varování nemá: stav „Připraveno“.
   - Je to moje volba kraje, ale u krátkých věcí se to stane snadno.
3. **Export H.264 si po MXF ponechá hlasitost −23 LUFS (záv. 2).**
   - **Postup:** v sekvenci 16:9 export MXF (sám přepne na −23, správně) a pak export MP4 jiné sekvence 16:9.
   - **Výsledek:** dialog nabídl H.264 s „Normalizovat na −23 LUFS (TV)“.
   - Video pro web/sítě by tak vyšlo o 9 LU tišší, pokud si toho redaktorka nevšimne.
   - Pro 9:16 dialog správně nabízí −14.
   - U první sekvence 1920×1080 bylo výchozí „Vypnuto (ponechat úrovně)“ (jako S7 #7). Výchozí hlasitost pro 16:9 MP4 je tedy pořád nejasná.

## Průběh dne (hodiny, výsledek)

| Čas | Krok | Výsledek | Záv. |
|---|---|---|---|
| 02:43:23 | start, zavřít AI panel, import 3 souborů (01, 02) | Přepis rozhovoru hned z mezipaměti (409 vět). Přepis kopie b-rollu a hudby proběhl sám na pozadí | ok |
| 02:44 | **(a)** hledání „zajímavou osobnost“, klik + Shift+klik ř. 128–142 | „15 vět · 1:02“ (03) | ok |
| 02:44:40 | ▾ → Do nové sekvence…, předvolba 1920×1080, název | Dialog nabídl 1280×720 podle klipu. Přepnula jsem šipkami (04, 05). Sekvence 62,32 s (06) | ok |
| 02:45:30 | b-roll: dvojklik, TC 500/1000, I/O, cíl zdroje V2, A1 zdroje vypnout, TC 1000, „.“; druhý kus TC 10000/10500 → 40 s | V2 10,00–15,04 a 40,00–45,04 (07, 08). Můj překlep: TC `100000` = 10 min, oprava přes Ctrl+Z ✓ | ok |
| 02:46 | Ctrl+D na konci a začátku b-rollu 40–45 | „Prolínačka použita v 00:00:45:01 / 00:00:40:00“, `crossU` (prolnutí do V1) (09) | ok |
| 02:46:30 | hudba: dvojklik, cíl A2, playhead 0, „.“, G → Změnit o −18 dB | A2 0–60,32, −18 dB (10, 11). Zdrojový monitor u .wav ukazuje jen černou, bez vlny | 1 |
| 02:47 | Titulky → Vytvořit titulky z přepisu | Hudbu správně ignoruje („1 úsek z klipu tncz…“). 21 titulků (12, 13) | ok |
| 02:47:30 | Text v obraze → Nadpis nahoře | Hned v monitoru (14, 15) | ok |
| 02:48 | ⇪ Export MP4 (−14 ručně), pak MXF | MP4 hotovo za 10 s, MXF za 9 s. MXF samo vypne vypalování, zapne .srt a −23 (16, 17) | ok |
| 02:49:15 | **(b)** Auto Reframe 9:16 | Za 10 s: „záběrů: 9, obličej nalezen v 9“. Titulky znovu, 2×20 zn. (19). Export za 16 s | ok |
| 02:50:15 | **(c)** dvojklik rozhovoru, hledání, výrok ř. 227 → Do nové sekvence… → 1080×1920 | Výřez podle obličeje: posX 0,75 / 0,29, rozdělený na střihu záběru 922,57 (22) | ok |
| 02:51 | druhý výrok ř. 199–201 → Přidat na konec sekvence, titulky, export | V exportu ve všech 10 kontrolních snímcích obličej (24). **S7 nález 1 opraven** | ok |
| 02:52 | **(d)** pravý klik na sekvenci → Duplikovat | „Výpověď Šimková 16x9 **kopie**“ (S7 #6 opraven) | ok |
| 02:52–02:55 | Ctrl+K, Shift+Delete, Extract, B, Zpět/Znovu | viz tabulka (d) | – |
| 02:56:31 | **(e)** uložit, pak neuložené změny (značka 5 s, nadpis „Neuložený nadpis po pádu“) | Záloha `autosave.tnproj` zapsaná v 02:57:10 (do 60 s) | ok |
| 02:57:14 | `stop 9371` (pád), znovu spustit | Projekt se otevřel se změnami a hláškou „Obnoveny neuložené změny z automatické zálohy. Uložíš je Ctrl+S, nebo je zahodíš zavřením bez uložení.“ (31) | ok |
| 02:57:38 | uložit, zavřít, b-roll přesunout do `…\pz-s8-media\presunuto\`, spustit | Hláška „Médium offline: broll-vyrez.mp4 – soubor byl přesunut…“, červené klipy, dlaždice i monitor (32). Dialog Export to ohlásí předem | ok |
| 02:58:02 | import z nového místa | „Médium znovu připojeno: broll-vyrez.mp4“. Obraz hned v monitoru (33). Přehrávání 10,0 → 12,98 s: b-roll hraje (`t=7,91`, readyState 4) (34) | ok |

## (d) Úpravy v půlce, sekvence „… kopie“, strojově porovnané

| # | Operace | Výsledek | Záv. |
|---|---|---|---|
| 1 | Ctrl+K při zacílené A2 | Rozstřihne i hudbu (bez skoku). Jako Premiere u zacílené stopy. Pak jsem cílení A2 a V2 vypnula | ok |
| 2 | Shift+Delete výroku, hudba pod ním (25) | Mezera zůstane + hláška (nález 1). Titulky z mezery pryč, ostatní stojí | 2 |
| 3 | Extract I 17,96 / O 24,56 / `'` (26) | Vše −6,64 s: V1, A1, V2 (40 → 33,36), hudba (rozstřižená se skokem 17,96 → 24,60, jako v Premiere), titulky ✓ | ok |
| 4 | Shift+Delete výroku pod okrajem b-rollu (34,16–43,52), A2 zamčená (27) | Mezera zůstane + hláška. **B-roll netknutý** (S6 nález 1b opraven) | ok |
| 5 | Shift+Delete výroku bez b-rollu (17,96–25,48), A2 zamčená (28) | Mezera zavřená, V1/A1/V2/titulky −7,52 s, zamčená hudba stojí ✓. Konec hudby pak přesahuje obraz o 5,5 s (správně, je zamčená). Titulek „a ty ho musíš…“ končí 26,66, klip 26,64: o půl snímku přes střih | 1 |
| 6 | Shift+Delete b-rollu na V2 | Smaže jen b-roll, rozhovor a titulky stojí (S6 nález 1a opraven) | ok |
| 7 | Ripple trim B, konec výroku −1,16 s (29) | Vše za střihem −1,16 ✓. Titulek „…dělit se jako zajímavý věci.“ → „…dělit se jako“: **smazaná slova pryč** (S6 nález 3 opraven). Řez uprostřed slova (nález 2). B-roll, který přes střih přesahuje, se neposune (jako Premiere) | 2 |
| 8 | Zkrácený titulek | Spojil se do jednoho řádku o 44 znacích (nastaveno 40), v 16:9 se vejde (35). Ve 2×20 pro 9:16 neověřeno | 1 |
| 9 | Zpět/Znovu | Po každé operaci Ctrl+Z = stav před ní a Ctrl+Shift+Z = stav po ní: klipy, in/out, přechody, zesílení, titulky, značky, délka. 8× Ctrl+Z a 8× Ctrl+Shift+Z za sebou ✓. Zámek stopy už v historii není (S6 #24 opraven) | ok |

## Exporty (`web/test-out/`)

| Soubor | Obsah | Ověřeno ffprobe/ffmpeg/Whisper |
|---|---|---|
| `redaktorka-s8-a-vypoved-16x9.mp4` + .srt | výpověď 62,32 s, 2× b-roll V2, prolnutí do V1, hudba −18 dB, 21 titulků, nadpis | H.264 1920×1080 25p, −14,0 LUFS. Začátek „Takže si vybereš…“ celé, konec „…úplně nepovedly.“ (slovo končí 0,1 s před koncem). Prolnutí v 40,3 a 44,5 s vidět (18) |
| `redaktorka-s8-a-vypoved-16x9.mxf` + .srt | totéž pro TV | MXF mpeg2video 1920×1080 25p progressive, 2× mono PCM 24 bit, 62,32 s, −22,8 LUFS (obě stopy sloučené), titulky jen v .srt |
| `redaktorka-s8-b-reframe-916.mp4` + .srt | Auto Reframe 9:16 | 1080×1920, 62,32 s, −14,0 LUFS. 42 titulků, žádný kratší než 0,7 s, max 20 zn./ř. V 10 z 10 snímků je ve výřezu obličej osoby ze záběru. Ve 20 a 54 s je to moderátorka, protože ji tam ukazuje už zdrojový záběr. **Ve 12 s (b-roll, široký záběr se dvěma lidmi) výřez vybral moderátorku, ne mluvčí** (20): jako cutaway to snese, záv. 1 |
| `redaktorka-s8-c-916-z-dialogu.mp4` + .srt | sekvence 9:16 z dialogu, 2 výroky z přepisu | 1080×1920, 22,32 s. Obličej v 10/10 snímků (24). 12 titulků ≥ 0,7 s |
| `redaktorka-s8-d-upravy.mp4` + .srt | kopie po Extract / Shift+Delete / B | 53,68 s, 17 titulků, žádné smazané slovo v titulcích. Úlomek „zají-“ v 25,4 s (nález 2) |

## Ostatní drobnosti (záv. 1)
- Po „Přidat na konec sekvence“ zůstane časová osa posunutá na 22–28 s, takže klipy nejsou vidět (23). Tlačítko ▾ vedle „Titulky z přepisu…“ se zalomilo na další řádek.
- Varování „Začátek i konec jsou uprostřed věty / Přichytit na celé věty“ se zobrazuje i u b-rollu, ze kterého beru jen obraz (09, jako S7 #9).
- Zdrojový monitor u zvukového souboru je černý, bez vlny (10).
- V DOM zůstává po znovupřipojení starý `<video>` s chybou 4 (stará cesta). Vidět to není, přehrávání funguje.

## Verdikt

**Ano, kolegyně může zítra PZ AI Cut použít místo Premiere na krátké věci:** výpověď do 2 min, verzi 9:16 na sítě, MXF do vysílání. Platí to za těchto podmínek:
1. **Při exportu MP4 zkontroluje řádek Hlasitost:** −14 pro web/sítě. Po MXF zůstává −23 (nález 3).
2. **S hudbou nebo podkresem na A2 maže úseky přes I/O + `'` (Extract),** nebo hudbu předem zamkne. Shift+Delete tam mezeru nezavře (nález 1). Hláška to řekne.
3. **Po ripple trimu (B) si kraj poslechne,** protože aplikace nevaruje před useknutým slovem (nález 2).

**Co funguje bez výhrad:**
- střih podle přepisu,
- b-roll přes cíl zdroje a I/O,
- prolnutí do V1,
- titulky z přepisu i po úpravách,
- nadpis,
- Auto Reframe i 9:16 z dialogu (obličej),
- MXF −23 s .srt,
- Zpět/Znovu,
- obnova po pádu,
- znovupřipojení přesunutého média.

**Co ještě brání bezvýhradnému „ano“:**
- nálezy 1–3 výše,
- nativní dialogy Import a Uložit a nabídky okna jsem neověřila (automat je neumí), Ctrl+S/Ctrl+N taky ne,
- poslech sluchem neověřen, jen Whisper a měření,
- v Premiere jsem srovnání v tomhle kole neověřovala.

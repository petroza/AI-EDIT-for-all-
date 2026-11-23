# Redaktorka – kolo S6: úpravy na časové ose po zásahu do jádra (2026-11-23)

**Otázka:** Fungují po zásahu do jádra střihu (commit 99fd961) všechny úpravy na časové ose správně a jako v Premiere, a nerozbilo se nic, co dřív fungovalo?

**Odpověď: z velké části ano, ale nový Shift+Delete umí potichu zničit materiál.**
- Shift+Delete na V1 teď drží V2, hudbu, titulky i značky v synchronu. To byl nález S5 a je opraven.
- Opravené jsou i prolnutí b-rollu do V1 (náhled i export) a Zpět/Znovu u všech 23 operací.
- Nově ale Shift+Delete vystřihne úsek ze všech stop i tam, kde to redaktorka nechce: rozhovor pod b-rollem, celý nevybraný b-roll a kus hudby.
- U nesousedních klipů nezavře mezery vůbec.
- Ripple trim (B) a zavření mezery dál nechávají titulky se smazanými slovy.

**Instance:** 9371, `--size 1920x1080 --lang cs --ai`, profil `%TEMP%\pz-s6-redaktor`, HEAD 99fd961. AI panel jsem hned zavřela a nepoužila.

**Ovládání:** vlastní `ui.js` ve scratchpadu přes CDP `Input.dispatchMouseEvent/KeyEvent/insertText`: klik, Shift/Alt+klik, tažení, klávesy, psaní timecodu. Stav jsem jen četla přes `eval` (klipy, in/out, přechody, titulky, značky, zámky). Po každé operaci jsem ho strojově porovnala se základem.

**Pomůcky místo nativních dialogů a nabídek:**
- `TN.app.importPaths` (3 soubory),
- `TN.app.cmd('newSequence' | 'captionsFromTranscript' | 'applyDipBlack')`,
- první uložení: `project.path` + `cmd('save')`,
- 3 exporty přes `exporter.exportSequence` (rozsah In/Out). Dialog ⇪ Export jsem otevřela a prohlédla (snímek 28).

**Projekt** (snímek 02):
- **V1/A1:** 4 výroky z 28min rozhovoru, vložené ze Zdroje přes I/O a tečku. Leží v 0–8,24, 8,24–16,56, 16,56–23,60 a 23,60–29,08 s.
- **V2:** b-roll `vyrez-5min.mp4` ve 2–5 s (celý nad výrokem 1), 14–19 s (přes střih 16,56) a 24,48–26,96 s (celý nad výrokem 4).
- **A2:** hudba přes celou sekvenci, −18 dB.
- **Titulky a značky:** 10 titulků z přepisu, značky v 6, 20 a 27 s.

## 3 nejdůležitější nálezy

1. **⚠ Shift+Delete vystřihne materiál, který redaktorka nevybrala (záv. 3).**
   - **a) Shift+Delete na b-rollu ve V2 (2–5 s)** vyřízne 3 s rozhovoru z V1/A1, hudbu a titulky. Zmizí „že já jsem si vlastně uvědomila velmi kriticky“.
     - Střih v 2,00 padne doprostřed slova „říct,“ (zdroj 172,98–173,24, řez v 173,20).
     - Žádné varování, sekvence se zkrátí na 26,08 s (snímek 32).
   - **b) Shift+Delete výroku na V1** smaže **celý nevybraný b-roll**, který nad ním leží. Platí pro výrok 1 s b-rollem 2–5 s (snímky 06a/06b) i pro dva vybrané výroky s b-rollem 14–19 s (snímek 07).
   - **c) Hudba přes celou sekvenci se rozstřihne natvrdo**: zdroj skočí 18,24 → 26,56 v 8,24 s (test 2).
   - **Premiere:** ripple delete podle mé znalosti nemaže nevybrané klipy ani obsah jiných stop. V Premiere jsem to v tomhle kole neověřovala.
   - Ctrl+Z vrátí vše přesně.

2. **⚠ Shift+Delete dvou nesousedních klipů = obyčejný Delete (záv. 3).**
   - Postup: výrok 1 a výrok 3, Shift+klik, Shift+Delete.
   - Na V1/A1 zůstanou dvě díry (0–8,24 a 16,56–23,60) a nic se neposune.
   - Titulky smazaných výroků zůstanou nad černou (snímek 08: v 5,00 s černý obraz s titulkem „že já jsem si vlastně uvědomila…“).
   - Žádné hlášení.
   - **Premiere:** zavře obě mezery.

3. **⚠ Titulky se smazanými slovy po ripple trimu (B) a po zavření mezery (záv. 3).** Oprava z S5 platí jen pro Shift+Delete, Extract a Q/W.
   - **B:** zkrátila jsem konec výroku 2 o 1,08 s. Titulek „asi není jako tak, / jak jsem si vždycky myslela.“ zůstal v 13,93–16,56 a kryje se s dalším (15,55–19,35).
     - V 16,00 s mluví už výrok 3, ale obraz ukazuje „…vždycky myslela.“, slovo, které bylo ustřižené (snímek 19).
   - **Delete + zavření mezery:**
     - Postup: Delete výroku 3, zámek V2 a A2, klik do mezery, Delete.
     - Titulky smazaného výroku zůstaly a posunuté titulky výroku 4 přes ně najely.
     - V 18,00 s zní „umíš pracovat s textem“, ale v obraze je „Mistrovala jsem konzervator…“ (snímek 11).

## Tabulka (každá operace: stav po ní, pak Ctrl+Z / Ctrl+Shift+Z / Ctrl+Z strojově porovnané se základem)

| # | Operace | Očekávání (Premiere) | Výsledek | Záv. |
|---|---|---|---|---|
| 1 | Shift+Delete výroku 1, nad ním nic (snímek 03) | vše za ním −8,24 s | V1/A1/V2 −8,24 ✓. Titulky výroku 1 pryč, ostatní −8,24 ✓. Značky 20/27 → 11,76/18,76 ✓. Hudba ustřižena o 8,24 s od začátku (zdroj od 18,24) | ok |
| 2 | Shift+Delete výroku 2, b-roll V2 14–19 přes jeho hranu (04) | synchron drží | Z b-rollu zůstal kus 16,56–19 → od 8,24 bez skoku ✓. Titulky/značky ✓. Hudba rozstřižena se skokem (nález 1c) | 2 |
| 3 | Shift+Delete výroku nad nímž leží celý b-roll (05, 06) | b-roll zůstane | b-roll smazán (nález 1b) | 3 |
| 4 | Shift+Delete 2 sousedních výroků (07) | zavře úsek | zavře, ale smaže i b-roll 14–19 uvnitř. Značka 20 (byla v úseku) zůstala na 20 > konec 13,72, pole značek neseřazené `[6, 20, 11.64]`. Shift+M z 6 skočí na konec a značku 11,64 přeskočí | 3 / 2 |
| 5 | Shift+Delete 2 nesousedních (08) | zavře obě mezery | nic neposune (nález 2) | 3 |
| 6 | Delete výroku 3 (bez posunu) | díra, ostatní stojí | ✓. Titulky nad dírou zůstanou (Premiere taky) | ok |
| 7 | Klik do mezery + Delete, V2/A2 v ní mají materiál (09) | nejde | „Mezeru nejde zavřít – na jiné stopě v ní je materiál.“ ✓ | ok |
| 8 | Totéž se zamčenou V2 a A2 (10, 11) | zavře V1/A1 | zavře, zamčené stojí ✓. Titulky se překryjí (nález 3) | 3 |
| 9 | Zámek A2 + Shift+Delete výroku 2 (12) | A2 stojí | A2 netknutá, zbytek −8,32, titulky a značky ✓ | ok |
| 10 | Extract: I 10:00, O 12:00, `'` (13) | vyjme úsek | 2,04 s pryč ze všech stop. Titulek rozdělen podle slov („Takže i to podle mě byl“). Značky −2,04, playhead na In ✓ | ok |
| 11 | Lift `;` | díra jen na cílových stopách | díra ✓, titulky zůstanou. **Ignoruje cílení stop:** A2 vypnutá v hlavičce, hudba se stejně vyřízne (15a). B-roll ve V2 se vyřízne taky | 2 |
| 12 | Q v 10,00 (16) | 8,24–10,00 pryč | ✓, titulek rozdělen, playhead 8,24 | ok |
| 13 | W v 15,00 (17) | 15,00–16,56 pryč | ✓ na V1. B-roll 14–19 rozstřižen se **skokem v obraze** (zdroj 31,00 → 32,56). Bod W bere i hrany V2 | 2 |
| 14 | Ripple trim B, konec výroku 2 −1,08 s (18, 19) | posun všeho za ním | V1/A1/V2/titulky/značky za střihem posunuté ✓. Titulek ve zkráceném úseku zůstal (nález 3). Hudbu nezkrátí, takže sekvence trvá 29,08 s, i když obraz končí v 28,00: na konci 1,08 s černé s hudbou. Jinak než Shift+Delete, který hudbu stříhá | 3 / 2 |
| 15 | Rolling N +0,52 s (20) | V1+A1, délka stejná | ✓ (237,40 → 237,92) | ok |
| 16 | Slip Y, tažení doprava (21) | obsah dřív | in −0,48 s, poloha stejná ✓ | ok |
| 17 | Alt+tažení výroku 4 (22) | jen obraz, ukazatel posunu synchronu | jen V1 +0,88 s (přichytí se na b-roll) ✓. Žádný červený ukazatel posunu synchronu | 1 |
| 18 | Ctrl+D na střihu V1 8,24 (23) | Cross Dissolve 1 s | monitor i export 1: prolnutí ✓ (snímky 33, 35) | ok |
| 19 | Ctrl+D na začátku a konci b-rollu 14–19 nad V1 (24, 25) | prolnutí do V1 | `crossU`. Monitor ✓. Export 2: b-roll prolne do širokého záběru V1 (jas 121 → 90 v 5,0–6,0 s, snímek 34) ✓. **Nález 2 z S5 opraven** | ok |
| 20 | Ctrl+D na b-rollu bez V1 pod ním: začátek (29), konec (26) | z/do černé | roztmívačka/zatmívačka ✓. Export 3: jas 122 → 24 za poslední 1 s ✓. Stav píše „Prolínačka použita“ | ok |
| 21 | Shift+D na vybraném výroku 3 (27) | přechody na obou krajích | obraz jen na jednom kraji (23,60, blíž playheadu). Zvuk: stmívání 0,24 s **na obou krajích** do ticha | 2 |
| 22 | Zatmívačka (nabídka) + Ctrl+Shift+D v 16,56 (30) | zvukový přechod na tom střihu | zatmívačka ✓. Ctrl+Shift+D ale ztlumí oba konce obou sousedních klipů, tedy i střihy 8,24 a 23,60. Stav se nezmění | 2 |
| 23 | Přehrání 13,8 → 17,8 přes přechody (31) | plynulé | playhead běží (~1:1), obraz bez chyb ✓ | ok |
| 24 | Zpět/Znovu | přesný návrat | Všech 23 operací: Ctrl+Z = základ a Ctrl+Shift+Z = stav po operaci ve všech sledovaných údajích (klipy, in/out, zesílení, přechody, fade, titulky, značky, délka). 13× Ctrl+Z za sebou ✓. **Ale** Ctrl+Z vrací i zámky stop: zámek zapnutý po úpravě se odemkne nebo zamkne zpět. V Premiere zámek v historii není | 1 |
| 25 | Stavový řádek | aktuální text | po Extract zůstalo „Zpět: Smazat a posunout“, po Ctrl+Shift+D text zatmívačky | 1 |

## Exporty (`web/test-out/`)

Všechny exporty: H.264 1920×1080 25p + AAC, titulky vypálené, −14 LUFS.

| Soubor | Co ukazuje | Délka | Kódování |
|---|---|---|---|
| `redaktorka-s6-1-prolinacka-V1.mp4` | Cross Dissolve na střihu V1 (6,24–10,28) | 4,04 s | 2,6 s |
| `redaktorka-s6-2-prolnuti-V2.mp4` | b-roll ve V2 se prolne z V1 a zpět do V1 (13,00–20,04) | 7,04 s | 2,8 s |
| `redaktorka-s6-3-V2-bez-V1-konec.mp4` | prolnutí b-rollu nad V1, pak zatmívačka b-rollu, pod kterým nic není (26,00–30,48) | 4,48 s | 2,1 s |

## Verdikt

**Co se nerozbilo:**
- Delete,
- Extract, Lift (kromě cílení), Q/W,
- Rolling, Slip, Alt+tažení,
- Ctrl+D na V1,
- přehrávání,
- Zpět/Znovu.

**Opravy z S5 fungují:**
- Shift+Delete na V1 drží V2, hudbu, titulky i značky,
- b-roll ve V2 se prolíná do V1.

**Nová logika Shift+Delete** („úsek prázdný na stopách smazaného klipu → vyjmout ze všech stop“) ale potřebuje mantinely, jinak redaktorka přijde o materiál, aniž to pozná:
- nevyjímat ze stop, kde leží nevybraný klip celý uvnitř nebo přes celý úsek (b-roll, hudba),
- Shift+Delete na V2 nesmí vyříznout rozhovor pod ním,
- nesousední výběr má zavřít každou mezeru zvlášť.

**Totéž dělení titulků podle slov** chybí u ripple trimu (B) a u zavření mezery.

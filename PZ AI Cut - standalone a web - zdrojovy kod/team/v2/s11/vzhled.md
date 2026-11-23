# Kolo S11 – Vzhled a jazyk (standalone)

**Verdikt:** S11 je česky i anglicky čisté. Sken DOM po sestavení sekvence, titulcích a dialozích nenašel v CZ žádnou novou angličtinu a v EN žádnou češtinu, kromě obsahu, tedy přepisu, titulků a nadpisu.
Přepínač Zobrazit funguje: ztlumí pole i velikost, Ctrl+Z / Ctrl+Shift+Z vrátí stav i zaškrtnutí, CZ „Zpět: Nadpis“, EN „Undo: Headline“.
Propojený výběr funguje i po výřezu 9:16 a Auto Reframe: klik na obraz vybere i zvuk a L-střih z úklidu krajů zůstane propojený.
Má to jednu skutečnou chybu, kdy vložený nadpis zůstane skrytý, a dvě rozbité drobnosti při 1280×720.

Postup:
- Instance 9373 s `--ai`, každá kombinace má vlastní profil: `cs1366`, `en1366`, `cs1280` (+ přepnutí na EN za běhu), `cs1920`, `en1920`.
- Import jsem dělal přes `TN.app.importPaths`, klipy přes `TN.app.dropMedia` a příkazy přes `TN.app.cmd(…)`.
- Text jsem psal přes `value` + událost `input`/`change`. Jedna událost `input` odpovídá vložení Ctrl+V.
- Kliky a klávesy šly přes CDP (`cdp.js drag/key`).
- Nabídky jsem kontroloval z `menu.js` přes `lang.tr`. Všech 80 položek je přeložených.
- AI panel ani agenta jsem nespouštěl. Instance je zastavená.

## Tři nejdůležitější nálezy
1. **Vložený nadpis zůstane skrytý (2).** Nadpis vypnu (Zobrazit ☐) a do pole vložím nový text přes Ctrl+V, tedy jednu událost `input`.
   - Výsledek: `title.off` zůstane `true`, pole je dál ztlumené (opacity 0,45) a v Programu nadpis není (`cz-1366-09b`).
   - Při psaní ho zapne až **druhý** znak (`cz-1366-09a`).
   - Příčina je v `src/ui/captionstyle.js:134`: `ti.off = false` se nastaví před `setTitle`. `begin()` (:115) pak `ti` načte ze sekvence znovu a `off:true` vrátí zpátky.
2. **Při 1280×720 CZ se tlačítko „Bezpečné zóny“ zalomí na dva řádky (2).** Druhý řádek „zóny“ přeteče pod červené tlačítko vysoké 20 px (`cz-1280-06b`). EN „Safe zones“ se vejde (`en-1280-06`).
3. **Při 1280×720 je pole AI panelu „Zadání“ moc nízké (2).**
   - Pole má výšku 56 px, ale obsah potřebuje 76 px (`scrollHeight`).
   - Ukáže se posuvník a ikona mikrofonu leží přes slovo „sestřih“ na druhém řádku textu (`cz-1280-06c`). Napsaný text dopadne stejně.

## Tabulka
| # | jazyk / rozlišení | kde | co je špatně | přesný text / číslo | záv. | snímek | návrh |
|---|---|---|---|---|---|---|---|
| 1 | obě / vše | Text v obraze, skrytý nadpis | vložený text nadpis nezapne, psaný až druhým znakem | `{"text":"Primátor: Tramvaj pojede od září","off":true}`, pole ztlumené | 2 | cz-1366-09b, cz-1366-09a | v `oninput` nejdřív `begin()`, pak `ti.off = false` |
| 2 | CZ / 1280 | Program, lišta monitoru | tlačítko se zalomí, „zóny“ přeteče | „Bezpečné / zóny“ (71×20 px) | 2 | cz-1280-06b, cz-1280-06 | `white-space: nowrap`, případně kratší „Zóny“ |
| 3 | CZ / 1280 | AI panel – Zadání | mikrofon přes text, posuvník | „Např.: Vyber nejlepší momenty a udělej krátký **s̶estřih** pro Instagram.“ | 2 | cz-1280-06c | min. výška ~80 px, nebo kratší placeholder „Např.: krátký sestřih nejlepších momentů pro Instagram“ |
| 4 | CZ / vše | časová osa, rozpojený klip | ikona řetězu ⛓ (stejný symbol jako tlačítko Propojený výběr = „propojeno“) a bublina anglicky | `title="unlinked"`, protože `i18n-app.js:12` přeskakuje `.cl` | 1 | cz-1366-17b | ikona přerušeného řetězu a `title` „Rozpojeno – Ctrl+L propojí“ (přeložit v `timeline.js:220` přes LL) |
| 5 | obě / vše | Text v obraze, prázdný nadpis | „Zobrazit“ je zaškrtnuté, zašedlé jen zaškrtávátko, popisek plnou barvou, kurzor ruka. Vypadá to jako „nadpis zapnutý“, klik nic neudělá | ☑ Zobrazit / ☑ Show při prázdném poli | 1 | cz-1366-05, en-1920-21 | bez textu odškrtnout a ztlumit i popisek; `title` „Nejdřív napiš nadpis“ |
| 6 | obě / vše | stavový řádek | po akci zůstane stará hláška | „Znovu: Rozpojit“ po Ctrl+L (klipy už propojené); „Znovu: Nadpis“ po vypnutí nadpisu; EN „Undo: Headline“ po „Captions ready (16)“ | 1 | cz-1366-18, cz-1366-09b, en-1366-13 | psát výsledek akce („Propojeno“, „Nadpis skrytý“), nebo stav po pár s vrátit na „Připraveno“ |
| 7 | obě / vše | Titulky z přepisu | počet úseků bere kusy rozříznuté na střihu kamery (S11), ne to, co uživatel vložil | 3 vložení → „6 úseků z klipu vyrez-5min.mp4“; EN 2 vložení → „4 parts of …“ | 1 | cz-1366-12, en-1366-12 | počítat navazující kusy jako jeden (`audioRuns`), `renderer.js:1937` |
| 8 | obě / vše | Projekt, dlaždice | délka bez hodin se plete s hodinami a minutami, Program ukazuje 00:00:40:03 | sekvence 40 s = „00:40:03“, médium 5 min = „05:00:00“ | 1 | cz-1366-19, cz-1366-22 | stejný formát jako monitory (00:00:40:03), nebo bez úvodních nul „0:40:03“ |
| 9 | CZ (EN obdobně) / vše | pojmenování jednoho okna | jedno okno má čtyři jména | menu „Sekvence → Titulky → Styl titulků…“ a „Nadpis nahoře…“; `Aa` u stopy „Styl titulků“; panel Titulky „Vzhled…“; záložka „Text v obraze“ | 1 | cz-1366-13 (Vzhled…, Text v obraze), menu.js | menu „Text v obraze…“, `Aa` a tlačítko „Text v obraze…“ |
| 10 | obě / 1920 (i 1366) | AI panel – karta Titulky vs. okno Text v obraze | dvě různé délky řádku pro tutéž sekvenci 9:16 | „40 znaků · 2 řádky“ × „Délka řádku 20 zn.“ (EN „40 chars“ × „20 ch“) | 1 | cz-1920-07, en-1920-21 | karta má ukázat styl sekvence, nebo text „podle formátu sekvence“ |

## Nové věci S11 – co je v pořádku
- **Zobrazit:** popisek je srozumitelný, bublina „Zobrazit nebo skrýt nadpis v obraze (text zůstane uložený)“. Vypnuto znamená, že pole i řádek velikosti mají opacity 0,45. Nadpis z Programu zmizí a po Ctrl+Z se zase ukáže (`cz-1366-06/07/08`, EN `en-1366-06/07`). Rozložení se nerozbije ani při 1280 (`cz-1280-06`) a 1920 (`cz-1920-07`). Po přepnutí jazyka se okno přestaví (EN „HEADLINE AT THE TOP · Show“).
- **Propojení:** klik na obraz vybere i zvuk (`cz-1366-10`, `cz-1366-22`, kde je L-střih: obraz 33,16 / zvuk 33,00).
  - Rozpojit (Ctrl+L) ukáže ve stavu „Zpět: Rozpojit“, výběr dál funguje.
  - Kontextové menu klipu má CZ 19 položek a končí při 1366 na 699/703 px a při 1280 na 651/655 px (`cz-1366-16`, `cz-1280-16`, `en-1366-16`).
- **Toasty:** všechny toasty jsou v obou jazycích:
  - Auto Reframe: „Vytvořena sekvence „Rozhovor 169 9x16“ (1080×1920) · záběrů: 5, obličej nalezen v 5“ / „Created sequence … · 4 shots, face found in 4“.
  - Titulky: „Titulky hotové (19). Zkontroluj je v záložce Titulky – Enter uloží a skočí na další.“
  - Chyba importu: „Nejde importovat: package.json (poškozený nebo nepodporovaný soubor)“ (`cz-1366-23`).
  - Hlášku úklidu krajů („Na kraji klipu bylo opraveno…“) jsem nevyvolal. Úklid při Auto Reframe proběhl tiše, protože hlásí jen toast výsledku sekvence.
- **Dialogy:** všechny dialogy jsou bez přetečení v obou jazycích:
  - Nová sekvence (`cz-1366-03`, `en-1366-03`).
  - Export 640×355 (`cz-1366-15`, `en-1366-15`, `cz-1280-15`).
  - Titulky z přepisu 458×223 (`cz-1366-12`).
  - Zesílení 420×186 (`cz-1366-14`, `en-1366-14`).
- **Opravy ze S7, ověřené v kódu:**
  - #4: nativní dialog má `noLink: true`.
  - #5: zmizel starý EN text „Find it again (File → Import)…“.
  - #6: z hlášky zmizel apostrof „pak ')“.
- **Trvá beze změny:**
  - „Aktivní sekvence ŽÁDNÁ AKTIVNÍ S…“ / „ROZHOVOR 169 9…“ je uříznuté (S4 #11).
  - Nástroj „T“ leží přes stavový řádek při 1280 (S1 #29, 632–664 px při výšce 655).

## Poznámka mimo roli (pro kontrolora výstupu, neověřeno exportem)
V sekvenci 9:16 jsem vložil úsek se začátkem 8,88 s, tedy 4 snímky před střihem kamery v 9,04 s. Kousek 8,88–9,04 zůstal na V1 jako samostatný klip (0,16 s, toast úklidu se neukázal).
Totéž v 16:9 po Auto Reframe se uklidilo, protože obraz předchozího klipu se prodloužil do 75,16 a vznikl L-střih (`cz-1366-11` × `cz-1366-22`).

Snímky jsou v `team\v2\s11\shots-vzhled\` (`cz|en-<šířka>-NN-*`, detaily `*b/*c-*-detail`).

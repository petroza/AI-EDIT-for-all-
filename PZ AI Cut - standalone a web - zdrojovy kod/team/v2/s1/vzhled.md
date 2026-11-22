# Kolo S1 – Vzhled a jazyk (standalone)

Otázka: vypadá standalone profesionálně v obou jazycích na běžných obrazovkách, včetně panelu AI a nativních nabídek?
Instance: `test/standalone.js start 9373 %TEMP%\pz-s1-ui` – 1366×768 CZ (bez `--ai`), 1366×768 EN, 1920×1080 EN→CZ, 1280×720 CZ→EN (s `--ai`).
Obsah: import `test/media/vyrez-5min.mp4` přes `TN.app.importPaths`, sekvence 4 úseků přes `TN.app.api.buildSequence` (místo nativního dialogu),
prázdná 9:16 sekvence přes dialog Nová sekvence. Prošlo: první spuštění, přepnutí jazyka za běhu oběma směry (vlaječky), dialogy Export (všech 7 formátů),
Nová sekvence, Nastavení sekvence, Klávesové zkratky (F1), Jak na video, Výchozí délka přechodu, Text v obraze / Nadpis, kontextová menu (klip, zobrazení
osy, médium, sekvence), toasty (chybný import, prázdný export), stavový řádek, panel AI (Asistent, Titulky, Média, Nastavení). Sken DOM
(text, title, placeholder, aria-label, alt) aplikace i `#aiFrame`, statický sken řetězců v `src/` proti slovníku `tr()`, nabídky z `src/core/menu.js`
přeložené `tr()` a porovnané s `Adobe Premiere Pro Defaults.kys` (výpis `shots-vzhled/premiere-defaults-kys.txt`). Konzole přes CDP (Runtime + Log)
po celou dobu, logy `shots-vzhled/con-*.log`.

Opravené od webového kola r7 (ve standalone už neplatí): přepnutí jazyka za běhu nechávalo Text v obraze / Přepis v původním jazyce (r7 #1–5),
vodorovný posuvník a uříznutý „Podklad“ (r7 #8), „sekund (25 frames)“ (r7 #12), chybějící „\“ v zkratkách (r7 #14), úvod Programu po přepnutí (r7 #7 –
při zobrazení se přestaví), chyby 7895–7897 v konzoli (r7 #11 – standalone je nemá, konzole je čistá).

## Tři nejdůležitější nálezy
1. **Ctrl+R (v Premiere „Rychlost/Trvání“) celou aplikaci tiše znovu načte a zahodí poslední úpravy (3).** Nativní nabídka Okno obsahuje
   `{ role: 'reload' }` a `{ role: 'toggleDevTools' }`; Electron jim dá výchozí zkratky Ctrl+R a Ctrl+Shift+I. Ctrl+R okno nezpracuje, takže
   proběhne reload: ověřeno (CDP klávesa s VK 82) – `performance.timeOrigin` se změnil, toast „Obnoven neuložený projekt z automatické zálohy.“,
   ale sekvence vytvořená ~3 min předtím zmizela (2 → 1 sekvence), historie Zpět je pryč (`cz-1366-10-po-ctrl-r.png`). Ctrl+Shift+I naštěstí vyhraje
   okno (Smazat In). Navíc „Načíst znovu“ a „Vývojářské nástroje“ v nabídce koncového uživatele nepůsobí profesionálně.
   Zdroj: `src/core/menu.js:75`, `main.js:45` (role se předá bez `accelerator`, Electron doplní výchozí).
2. **Nápověda a prázdné stavy popisují webovou verzi – ve standalone vedou do slepé uličky (3).** Ve standalone není záložka Přepis (`window.__pzASR`
   chybí), přesto: Jak na video krok 2 „V záložce Přepis hledej slovo (Ctrl+F) a klikni na větu…“, krok 5 „Sekvence → Titulky → Vytvořit titulky
   z přepisu … Bez AI.“ – tahle položka nativní nabídky ale jen ukáže toast „Titulky z přepisu: v této verzi přes panel AI (Titulky).“, krok 7
   „Poslechni místa střihů – na webu jsou přibližná.“; prázdné Titulky „Nejdřív vlož úsek do sekvence – třeba kliknutím na větu v záložce Přepis.“;
   patička Text v obraze „Text titulků opravíš v záložce Titulky (vedle Přepisu)…“ (titulky jsou vedle Projektu); zkratky „Hledat v přepisu Ctrl+F“.
   Snímky `cz-1366-d-socialGuide.png`, `en-1366-d-captionsFromTranscript.png`, `cz-1280-01-prvni-spusteni.png`, `cz-1920-03-zavrena-sekvence.png`.
3. **Nepřeložené texty, které uživatel opravdu uvidí (2).** EN: hlavní pole Zadání v panelu AI má i po čistém startu v angličtině český placeholder
   „Např.: Vyber nejlepší momenty a udělej krátký sestřih pro Instagram.“ (první obrazovka, `en-1366-01-prvni-spusteni.png`; `src/ai/layout.js:113`,
   chybí v `src/ai/i18n.js`). CZ: chybové hlášky zůstanou anglicky – toast „soubor.mp4: File not found: O:/…“ (`cz-1366-08`), v Exportu
   „✖ The sequence is empty – nothing to export.“ (`cz-1366-09`), dle kódu i „Export cancelled.“ a nativní dialog „Delete sequence “…”? / You can bring
   it back with Edit → Undo. / Delete“. Obojí: stavový řádek po každém volání AI ukáže interní název funkce „AI: addMarkers“, po Zpět „Zpět: AI: Add Markers“.

## Ostatní
- **Rozložení:** při 1366×768 a 1280×720 zabírá panel AI ~400 px, na klipy na časové ose zbývá 270 px (1366) resp. 190 px (1280) – názvy klipů „vy…“
  (`cz-1280-02`, `en-1280-03`); 1920×1080 je v pořádku (`en-1920-01`). Prázdný Projekt má text ve sloupci mřížky ikon 122 px („Projekt je / prázdný. /
  Přetáhni sem…“) ve všech rozlišeních. Prázdná časová osa: text začíná pod hlavičkami stop, přes něj vede svislá dělicí čára a vpravo se ořízne (1366, 1280).
  Při 1280×720 má karta „Začni tady“ v Programu vnitřní posuvník a tlačítko „Panel AI“ je uříznuté. Klávesové zkratky (F1) se otevřou posunuté na konec
  (fokus na „Zavřít“), nadpis není vidět.
- **Nativní nabídky** (obsah a překlad z kódu, nejde snímkovat): zkratky odpovídají výchozím v Premiere 2027 (Ctrl+K, Q/W, ;/', Shift+;, \, Ctrl+Alt+Shift+M,
  Ctrl+M, Ctrl+Alt+N…), kromě: Reload Ctrl+R (výše), Konec bez Ctrl+Q (okno ho přitom zpracuje, `src/renderer.js:842`), Klávesové zkratky F1 (Premiere
  Ctrl+Alt+K, F1 = Nápověda). Všechny popisky mají překlad (jen „9:16 – Reels, TikTok, Shorts“ a jazyky záměrně beze změny). Terminologie: „Vložit s posunem“
  znamená v CZ zároveň Insert (,) i Paste Insert (Ctrl+Shift+V); „Použít zvukový přechod“ (nabídka) × „Zvukové prolnutí“ (zkratky); „Najít snímek ve zdroji“
  je v nabídce Klip i Sekvence; „Konec“ (Windows zvyk „Ukončit“).
- **Stav mostu klame:** když 7880 i 7890 drží jiná okna (zde instance jiných rolí), lišta ukáže zelené „bridge :7890“ (ping odpoví cizí okno PZ AI Cut),
  ale Nastavení panelu AI červeně „port 7890 is in use“ (`en-1366-ai-settings.png`) – agent by stříhal v jiném okně. `src/renderer.js:1371` (7890 se nekontroluje), `:1497`.
- **Konzole:** ve 4 bězích žádná chyba aplikace; jen 3 varování „Electron Security Warning“ při každém startu (vývojová verze) a 2× „Uncaught“ bez popisu
  v běhu 1280 kolem přepnutí jazyka (nezopakováno, `con-1280cs.log`).
- Pozn. pro ostatní role: běh 1280 dostal port 7880 a pill ukazoval „Claude connected“ (globální stav pluginu); most měl 0 požadavků – do cizí práce nic nepřišlo.

## Tabulka
| # | jazyk | rozlišení | kde | co je špatně | přesný text | záv. | snímek | zdroj |
|---|---|---|---|---|---|---|---|---|
| 1 | obě | – | nativní menu Okno / klávesa Ctrl+R | reload aplikace, ztráta posledních úprav a historie | „Načíst znovu“ (Ctrl+R), „Vývojářské nástroje“ (Ctrl+Shift+I) | 3 | cz-1366-10-po-ctrl-r.png | src/core/menu.js:75, main.js:45 |
| 2 | obě | vše | Nápověda → Jak na video | kroky pro web (záložka Přepis, titulky bez AI, „na webu“) | „V záložce Přepis hledej slovo (Ctrl+F)…“, „Vytvořit titulky z přepisu … Bez AI.“, „Poslechni místa střihů – na webu jsou přibližná.“ | 3 | cz-1366-d-socialGuide.png, en-1366-d-socialGuide.png | src/renderer.js:1127–1135 |
| 3 | obě | vše | nabídka Sekvence → Titulky → Vytvořit titulky z přepisu… | položka nic neudělá, jen odkáže jinam | „Titulky z přepisu: v této verzi přes panel AI (Titulky).“ | 2 | en-1366-d-captionsFromTranscript.png | src/renderer.js:1718, src/core/menu.js:56 |
| 4 | obě | vše | Titulky (prázdné), patička Text v obraze, zkratky | odkaz na neexistující záložku Přepis | „…kliknutím na větu v záložce Přepis.“, „…v záložce Titulky (vedle Přepisu)…“, „Hledat v přepisu Ctrl+F“ | 2 | cz-1280-01-prvni-spusteni.png, cz-1920-03-zavrena-sekvence.png | src/ui/caption-list.js:41, src/ui/captionstyle.js:40, src/renderer.js:1142 |
| 5 | EN | vše | panel AI – pole Zadání | český placeholder i po čistém startu EN | „Např.: Vyber nejlepší momenty a udělej krátký sestřih pro Instagram.“ | 2 | en-1366-01-prvni-spusteni.png, en-1920-01-sekvence.png | src/ai/layout.js:113 (chybí v src/ai/i18n.js) |
| 6 | CZ | vše | toast po importu | anglická chyba | „soubor.mp4: File not found: O:/neexistuje/soubor.mp4“ | 2 | cz-1366-08-toast-import.png | src/core/media.js:64 |
| 7 | CZ | vše | Export – chyba | anglicky | „✖ The sequence is empty – nothing to export.“ (dle kódu i „Export cancelled.“) | 2 | cz-1366-09-export-prazdna.png | src/core/exporter.js:182, :191 |
| 8 | CZ | – | nativní dialog Smazat sekvenci (Projekt → Smazat) | celý anglicky (ověřeno `tr()`, nesnímkováno) | „Delete sequence “…”?“, „You can bring it back with Edit → Undo.“, „Delete“ | 2 | – | src/renderer.js:1109 |
| 9 | obě | vše | stavový řádek po akci AI / po Zpět | interní název funkce, nepřeložené | „AI: addMarkers“, „Zpět: AI: Add Markers“ („AI: Build Sequence“ aj. – 6 popisků bez překladu) | 2 | (sken DOM) | src/renderer.js:1397, src/core/pmcp-api.js (popisky edit), src/core/lang.js |
| 10 | obě | vše | Klávesové zkratky (F1) | otevře se posunuté na konec, nadpis skrytý | scrollTop 305/305 | 2 | en-1366-d-help.png | src/renderer.js:944–945 (fokus na první tlačítko = Zavřít) |
| 11 | obě | vše | Projekt – prázdný | text zalomený v úzkém sloupci mřížky ikon (122 px) | „Projekt je / prázdný. / Přetáhni sem…“ | 2 | cz-1366-01-prvni-spusteni.png, en-1366-01-prvni-spusteni.png | src/ui/project-panel.js:76 |
| 12 | obě | 1366, 1280 | časová osa – prázdná | text přes sloupec hlaviček a dělicí čáru, vpravo oříznutý | „Není otevřená žádná sekvence – přetáhni sem klip…“ | 2 | cz-1366-01-prvni-spusteni.png, cz-1280-01-prvni-spusteni.png | src/app.css:228, src/premiere-look.css:66 |
| 13 | obě | 1280×720 | Program – „Začni tady“ | vnitřní posuvník, tlačítko „Panel AI“ uříznuté | „Panel AI“ | 2 | cz-1280-01-prvni-spusteni.png | src/ui/monitors.js:76–86 |
| 14 | obě | 1366, 1280 | celé okno s panelem AI | na klipy zbývá 270 / 190 px, názvy nečitelné | „vy…“ | 2 | cz-1366-02-sekvence.png, cz-1280-02-sekvence.png | rozložení (panel AI min. ~400 px) |
| 15 | obě | – | lišta „bridge“ × Nastavení AI | zelený stav, i když most nejede (odpovídá cizí okno) | „bridge :7890“ × „port 7890 is in use“ | 2 | en-1366-ai-settings.png | src/renderer.js:1371, :1497 |
| 16 | CZ | vše | menu Úpravy, monitor, zkratky | jeden název pro dva příkazy | „Vložit s posunem“ = Insert (,) i Paste Insert (Ctrl+Shift+V) | 2 | cz-1366-d-help.png | src/core/lang.js:10, :34 |
| 17 | EN | 1366, 1280 | panel AI – Aktivní sekvence (bez sekvence) | popisek uříznutý na „…“ (CZ „ŽÁDNÁ AKTIVNÍ SEKVENCE…“) | „no active sequence – open a sequence with a clip“ | 2 | en-1366-01-prvni-spusteni.png, cz-1366-01-prvni-spusteni.png | src/ai/layout.css:47 |
| 18 | EN (po CZ→EN) | vše | Projekt – název souboru | zůstane česky do další změny titulku | „Bez názvu.pzcut“ | 1 | en-1366-04-po-prepnuti-z-cz.png | src/renderer.js:354 (setLanguage :1434 nevolá updateTitle) |
| 19 | obě | – | nativní menu | chybí/odlišné zkratky proti Premiere | Konec bez Ctrl+Q; Klávesové zkratky F1 (Premiere Ctrl+Alt+K) | 1 | – | src/core/menu.js:22, :30 |
| 20 | CZ | – | nativní menu × zkratky | nejednotné názvy | „Použít zvukový přechod“ × „Zvukové prolnutí“; „Najít snímek ve zdroji“ v Klip i Sekvence; „Konec“ | 1 | – | src/core/menu.js:34, :40, :45 |
| 21 | CZ | – | lišta nahoře | anglické slovo | „bridge :7890“, „bridge …“ | 1 | cz-1366-01-prvni-spusteni.png | src/renderer.js:1500, src/index.html:15 |
| 22 | obě | – | panel AI – Nastavení | žargon Premiere a vývojáře | „reload host.jsx“, zaškrtávátko „tools“, bublina „…Hermes (also from another folder, e.g. O:\Hermes)…“ | 1 | en-1366-ai-settings.png | src/ai/index.html, src/ai/i18n.js:32, :71 |
| 23 | EN | – | panel AI – bubliny indikátorů | česky | „Claude pracuje“, „Codex (GPT) pracuje“ | 1 | (sken DOM) | src/ai/index.html:93 |
| 24 | CZ | vše | Klávesové zkratky | nepřeložené / neúplné | „Space“, „Alt+click“ (vedle „Ctrl+tažení okraje“), „O 1 snímek (Shift = 5 snímků)“, „Smazat (mezera = zavřít)“ | 1 | cz-1366-d-help.png | src/renderer.js:1144 a dál |
| 25 | CZ | vše | Jak na video | nejednotné nadpisy a pojmy | „Import“ × „Exportovat“; „Stopáž“ × v panelu „Délka“ | 1 | cz-1366-d-socialGuide.png | src/renderer.js:1120–1127 |
| 26 | obě | vše | pojmenování panelu AI | 4 tvary | „AI panel“ (menu), „Panel AI“ (tlačítko), „v panelu AI“, „v AI panelu“ (osa), „PZ AI“ (hlavička) | 1 | cz-1366-01-prvni-spusteni.png | src/core/lang.js:24, src/ui/monitors.js:84, src/index.html:121 |
| 27 | EN | vše | Titulky (prázdné) | Titulky nejsou rychlá akce, ale záložka/karta | „Captions are made by the AI panel (quick action Captions).“ | 1 | en-1366-05-text-titulky.png | src/ui/caption-list.js:48 |
| 28 | EN | vše | úvod Programu, Jak na video | nejasné / nejednotné | „Or let the AI cut…“; „colour“ (průvodce) × „Color“ (Text on video) | 1 | en-1366-01-prvni-spusteni.png | src/ui/monitors.js:84, src/renderer.js:1134 |
| 29 | obě | 1366, 1280 | lišta nástrojů | poslední nástroj (T) uříznutý / zasahuje do stavového řádku | – | 1 | cz-1280-02-sekvence.png | rozložení #tools |
| 30 | obě | 1280 | pravítko osy, Formát v panelu AI | oříznuté | „00:00:3“, „9:16 Reels · TikTok · Sho“ | 1 | en-1280-03-sekvence.png | src/ui/timeline.js (pravítko), src/ai/layout.css |
| 31 | obě | vše | Text v obraze po zavření sekvence | dál ukazuje ovládání zavřené sekvence | „Test edit“ | 1 | cz-1920-03-zavrena-sekvence.png | src/ui/captionstyle.js |
| 32 | obě | 1366 | Text v obraze | panel ~270 px, Barva/Podklad/Zvýraznit až po posunu (r7 #9 trvá) | – | 1 | en-1366-05-text-titulky.png | rozložení #sourcePanel |
| 33 | – | – | konzole | varování vývojové verze při každém startu; 2× Uncaught bez popisu (nezopakováno) | „Electron Security Warning (Disabled webSecurity)“ … | 1 | con-*.log | main.js:60–66 |

Snímky: `team\v2\s1\shots-vzhled\` (`cz|en-<rozlišení>-NN-*` stavy, `-d-*` dialogy, `-c-*` kontextová menu, `-ai-*` panel AI), logy konzole `con-*.log`,
výchozí zkratky Premiere `premiere-defaults-kys.txt`. Instance 9373 zastavena.

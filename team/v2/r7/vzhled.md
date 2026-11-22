# Kolo 7 – Vzhled a jazyk

Otázka: vypadá to profesionálně v obou jazycích a na běžných obrazovkách?
Verze `app.js?v=mws2qvzb`, vlastní headless Chrome (profil `pz-r7-ui`, port 9373), 127.0.0.1:8791.
Stav: prázdný projekt + import `vyrez-5min.mp4` + 2 sekvence (16:9 a 9:16 s titulky a nadpisem, přes `__pzDev.tools`).
Prošlo: všech 7 menu (i podmenu), 11 dialogů (Nová sekvence, Export, Klávesové zkratky, Zesílení zvuku, Délka přechodu,
Nastavení sekvence, Titulky z přepisu, Jak na video, O aplikaci, Uložit změny?), kontextová menu (klip, položka Projektu,
prázdný Projekt, ▾ Vložit), záložky Přepis / Titulky / Text v obraze, panel AI (Zadání, Připojení), CZ i EN,
1366×768, 1920×1080, 1280×720. Sken DOM: texty, `title`, `placeholder`, `aria-label`, `option`, iframe panelu AI.

## Tři nejdůležitější nálezy
1. **Přepnutí jazyka za běhu nechá velké části UI v původním jazyce (3).** Po CZ→EN zůstane česky celá záložka *Text on video*
   („Nadpis nahoře, Titulky, Řádky, Délka řádku, Velikost písma, Výška, Barva, Podklad, Zvýraznit vyslovované slovo, Výchozí…“),
   celý panel Přepis (placeholder „Hledat v 69 větách (Ctrl+F)“, patička „Klikni na větu = začátek a konec úseku…“, bubliny
   „Předchozí (Shift+Enter)“, „Další (Enter)“, „69 vět · přesný přepis“) i bublina AI lišty „Otevřít panel AI (F4) – AI není připojená“.
   Po EN→CZ je to obráceně (snímek `cz-1366-06`: „Headline at the top“, „Line length“, „Text size“ vedle „Titulky“, „Řádky“).
   V prázdném projektu je po přepnutí do EN česky celý úvod Přepisu včetně tlačítka **„Importovat video…“** (`en-1366-01`).
   Po obnovení stránky / novém projektu je vše správně (`en-1366-01b`, `en-1920-01`, `cz-1366-07`) – chyba je jen v překreslení.
   Příčiny: `src/ui/captionstyle.js:13` (`const cs` se vyhodnotí jednou při stavbě panelu, `setLanguage` panel nepřestaví);
   Přepis `src/ui/transcript-panel.js` – v pracovní kopii je rozdělaná oprava `relang()` (`:723`, volání v `src/renderer.js:1429`),
   **ale v servírovaném `web/dist/app.js` (17:51) ještě není** (grep „relang“ = 0); bublina AI lišty `src/renderer.js:1470` se
   přepíše až při další změně stavu AI.
2. **Text v obraze: vodorovný posuvník a uříznutý „Podklad/Background“ ve všech rozlišeních (2).** Řádek Barva má barvy přes 2
   sloupce a zaškrtávátko „Podklad“ ve 3. sloupci širokém 46 px (`grid-template-columns: 92px 1fr 46px`, `.cs-box` nowrap) →
   text vyteče (1920: „Podkla|“, „Backg|“) a panel má scrollWidth > clientWidth (1366: 676>646, 1920: 783>753, 1280: 448>418).
   Při 1366×768 má panel jen ~280 px výšky, takže Barva/Podklad/Zvýraznit/Výchozí jsou až pod posuvníkem.
   Zdroj: `src/ui/captionstyle.js:35–37`, `src/app.css:124` (`.cs-row`), `:134` (`.cs-box`), `:410` (`.capstyle.docked` overflow-y:auto bez overflow-x:hidden).
3. **Konzole: 3 červené chyby každých 15 s bez konektoru (2).** `GET http://127.0.0.1:7895|7896|7897/hello net::ERR_CONNECTION_REFUSED`
   – 189 chyb za ~15 min (≈ 720/h), od načtení stránky. Kdo otevře DevTools (IT, podpora), vidí stránku „plnou chyb“.
   Zdroj: `web/ai/bridge.js:97` (`hello`), smyčka `:164–168` (bez spojení max 15 s). Jiné chyby aplikace při průchodu nebyly
   (viz níže), log: `shots-vzhled/konzole.log`.

## Ostatní
- Menu (všechna, i podmenu), kontextová menu a dialogy se při 1280×720 vejdou (Sekvence: dole 596 px, podmenu Titulky 701 px;
  Klávesové zkratky 619 px vysoké s vnitřním posuvníkem). EN po čistém vykreslení bez češtiny; CZ po čistém vykreslení bez angličtiny
  kromě níže uvedených (a záměrných: názvy menu Claude Desktop v návodu připojení, „⇪ Export“).
- 1280×720 s otevřeným panelem AI: časová osa jen ~400 px (vidět ~2 s 9:16 sekvence), Text v obraze ~250 px vysoký se dvěma
  posuvníky (`en-1280-01`, `cz-1280-01`). Funkční, ale stísněné.
- Konzole mimo konektor: `ERR_FILE_NOT_FOUND blob:…` při načtení (staré blob URL chybějícího média, 2× / 12×) a
  `waveform Media file is not available` – jen po obnovení stránky s médiem importovaným přes dev import; mediapipe GL log (cizí knihovna).
  `showDirectoryPicker` SecurityError jen při syntetickém kliku testu (ne chyba aplikace). Export pro sítě nešlo projít – otevře nativní výběr složky.
- Pozor pro testery: obnovení stránky s neuloženým projektem v headless Chrome zablokovalo kartu (beforeunload), musel jsem ji zavřít přes CDP.

## Tabulka
| # | jazyk | rozlišení | kde | co je špatně | přesný text | záv. | snímek | zdroj |
|---|---|---|---|---|---|---|---|---|
| 1 | EN (po CZ→EN) | vše | Text on video | celý panel zůstane česky | „Nadpis nahoře“, „Řádky“, „Délka řádku“, „Velikost písma“, „Výška“, „Barva“, „Podklad“, „Zvýraznit vyslovované slovo“, „Výchozí“, „Vytvořit znovu z přepisu…“, „Text titulků opravíš v záložce Titulky…“ | 3 | en-1366-11-po-prepnuti-z-cz.png | src/ui/captionstyle.js:13, :25–38 |
| 2 | CZ (po EN→CZ) | vše | Text v obraze | míchaná EN/CZ | „Headline at the top“, „Headline size“, „Line length“, „Text size“, „Height“, „Create again from transcript…“, placeholder „E.g. Mayor: The bridge will be ready in summer“ | 3 | cz-1366-06-po-prepnuti.png | src/ui/captionstyle.js:13 |
| 3 | EN (po CZ→EN) | vše | Přepis – prázdný projekt | úvod česky | „Tady uvidíš, co se ve videu říká“, „Importuj video – řeč se přepíše sama…“, tlačítko „Importovat video…“, „Automaticky přepisovat nová videa“ | 3 | en-1366-01-prazdny.png | src/ui/transcript-panel.js:158, :166 (oprava relang jen v src, ne v dist) |
| 4 | EN (po CZ→EN) | vše | Přepis – se seznamem | placeholder, patička, bubliny česky | „Hledat v 69 větách (Ctrl+F)“, „Klikni na větu = začátek a konec úseku. Shift+klik přidá další věty.“, „Předchozí (Shift+Enter)“, „Další (Enter)“, „69 vět · přesný přepis“ | 3 | en-1366-11-po-prepnuti-z-cz.png | src/ui/transcript-panel.js:180–181, :221, :515 |
| 5 | CZ (po EN→CZ) | vše | Přepis | totéž anglicky | „Search 69 sentences (Ctrl+F)“, „Click a sentence = start and end of the part…“, „Click a caption and fix it…“, „Play caption (Ctrl+Space)“ | 3 | cz-1366-06-po-prepnuti.png | src/ui/transcript-panel.js, src/ui/caption-list.js |
| 6 | EN (po CZ→EN) | vše | AI lišta vpravo (bublina) | česky | „Otevřít panel AI (F4) – AI není připojená“ | 2 | – (sken DOM) | src/renderer.js:1470 |
| 7 | EN/CZ (po přepnutí) | – | úvod v Programu (skrytý, je-li sekvence) | zůstal v původním jazyce; neověřeno, zda se po zavření sekvencí přestaví | „Otevři klip, nebo nech stříhat AI“ / „Open a clip or let the AI cut“ | 1 | – | src/ui/monitors.js:67 |
| 8 | obě | 1366, 1920, 1280 | Text v obraze | vodorovný posuvník + uříznuté zaškrtávátko | „Podkla…“ / „Backg…“ | 2 | en-1920-01-sekvence-ai.png, cz-1920-01-sekvence-ai.png, cz-1366-08-text-v-obraze.png | src/ui/captionstyle.js:35–37, src/app.css:124, :134, :410 |
| 9 | obě | 1366×768 | Text v obraze | panel jen ~280 px vysoký, Barva/Podklad/Zvýraznit/Výchozí pod posuvníkem | – | 2 | cz-1366-08-text-v-obraze.png | rozložení #sourcePanel |
| 10 | obě | 1280×720 | celé okno s panelem AI | časová osa ~400 px, Text v obraze ~250 px se 2 posuvníky | – | 2 | en-1280-01-sekvence-ai.png, cz-1280-01-sekvence-ai.png | – |
| 11 | – | – | konzole | 3 chyby každých 15 s bez konektoru | „net::ERR_CONNECTION_REFUSED http://127.0.0.1:7895/hello“ (+7896, 7897) | 2 | konzole.log | web/ai/bridge.js:97, :164–168 |
| 12 | CZ | vše | Výchozí délka přechodu | anglické slovo | „sekund (25 frames)“ | 2 | cz-1366-d-delka-prechodu.png | src/renderer.js:587 (`seconds (… frames)`) |
| 13 | CZ | vše | Klávesové zkratky | nepřeložené klávesy (kbd se nepřekládá) | „Space“, „Ctrl+drag edge“, „Alt+click“ | 1 | cz-1366-d-zkratky.png, cz-1280-d-zkratky.png | src/renderer.js:1131, :1134; SKIP_SEL `kbd` v src/i18n-app.js:12 |
| 14 | obě | vše | Klávesové zkratky | u „Zobrazit celou sekvenci / Zoom to Sequence“ prázdná klávesa (chybí „\“) | `'\|Zoom to Sequence'` → klávesa „“ | 2 | cz-1280-d-zkratky.png | src/renderer.js:1135 (`'\|…'` v JS = `'|…'`, chce `'\\|…'`) |
| 15 | CZ | vše | Klávesové zkratky + Jak na video | nekonzistentní: „Import“ vs. jinde „Importovat“, nadpis „Import“ vedle „Exportovat“ | „Import“ (Ctrl+I), nadpis kroku „Import“ | 1 | cz-1366-d-jak-na-video.png | src/renderer.js:1135; průvodce socialGuide |
| 16 | CZ | vše | Přepis (prázdný), Jak na video | předložka | „v tomto počítači“ → „na tomto počítači“ | 1 | cz-1366-01-prazdny.png, cz-1366-d-jak-na-video.png | src/ui/transcript-panel.js:166, průvodce |
| 17 | CZ | – | bublina klipu v Projektu | zdvojené, kostrbaté | „Klip má přepis – otevři ho a hledej – klikni a otevře se Přepis“ | 1 | – (title) | src/ui/project-panel.js:96 + :102 |
| 18 | CZ | – | AI lišta vs. panel AI | nejednotný tvar | „AI není připojená“ (bublina) × „AI není připojena“ (štítek panelu) | 1 | cz-1366-09-ai-panel.png | src/renderer.js:1470, web/static/ai-web.js |
| 19 | CZ | – | ▾ Vložit (Přepis) | žargon „hlava“ místo „přehrávací hlava“ | „Vložit na hlavu – hlava je uvnitř klipu“ | 1 | cz-1366-c-vlozit.png | transcript-panel.js (menu vložení) |
| 20 | EN | vše | Text on video, How to… | britské „Colour/colour“, jinak US („Normalize“) | „Colour“ | 1 | en-1920-01-sekvence-ai.png | src/ui/captionstyle.js:35 |
| 21 | EN | vše | Audio Gain | „(s)“ místo množného čísla | „Applies to 1 selected audio clip(s).“ | 1 | en-1366-d-gain.png | dialog gain v src/renderer.js |
| 22 | EN | vše | úvod Programu | nejasná věta („let the AI cut“ = AI střih?) | „Or let the AI cut: connect Claude or Codex…“ | 1 | en-1366-02-import.png | src/ui/monitors.js:84 |
| 23 | obě | 1920×1080 | pravítko časové osy | poslední popisek uříznutý | „00:00:14:0“ | 1 | en-1920-01-sekvence-ai.png | src/ui/timeline.js (pravítko) |
| 24 | obě | 1366×768 | toast „Nenalezená média…“ | překrývá hlavičku monitoru Program | „Nenalezená média: 1 – naimportuj je znovu (Soubor → Importovat).“ | 1 | cz-1366-07-po-reload.png | – |

Snímky: `O:\TN_strihatko\team\v2\r7\shots-vzhled\` (54 souborů: `cz|en-<rozlišení>-NN-*` stavy, `-d-*` dialogy, `-c-*` kontextová menu), log konzole `konzole.log`.

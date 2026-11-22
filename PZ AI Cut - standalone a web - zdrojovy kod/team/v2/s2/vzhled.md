# Kolo S2 – Vzhled a jazyk (standalone)

Otázka: vypadá standalone profesionálně v obou jazycích na běžných obrazovkách – hlavně nový panel Přepis?
Instance `test/standalone.js start 9373 … --ai`: 1366×768 CZ (profil `pz-s2-ui`), 1366×768 EN (nový profil `pz-s2-ui-en`), 1920×1080 CZ→EN
a 1280×720 CZ→EN (profil `pz-s2-ui` s obnoveným autosave). Ovládání `test/cdp.js` + skutečné kliky myší přes CDP (věty, Shift+klik, Vložit, ▾,
Zastavit, Pokračovat, pravý klik). Import přes `TN.app.importPaths` (místo nativního dialogu). Průběh přepisu na 3 nových výřezech z 28min rozhovoru
(90 s, 240 s, 150 s, ffmpeg do `%TEMP%\pz-s2-ui-media`), vždy jen jeden přepis naráz. Export 15 s přes **dialog Export** (cesta přepsaná do
`web/test-out/vzhled-s2-1366.mp4`, tlačítko Exportovat kliknuté). AI panel jsem nespouštěl. Konzole přes CDP po celou dobu (`con-*.log`).

**Opravy z S1 ověřené jako opravené:** Ctrl+R už okno nenačte (`performance.timeOrigin` stejný, sekvence zůstala; `cz-1366-09`); Jak na video popisuje
standalone (Přepis, titulky bez AI, „Před exportem si střih jednou celý poslechni“; `cz-1366-d-socialGuide`, `en-1366-d-socialGuide`); prázdné Titulky /
Začni tady / Hledat v přepisu Ctrl+F teď odkazují na existující záložku; Sekvence → Titulky → Vytvořit titulky z přepisu otevře dialog; toast importu česky
(„soubor nenalezen“, `cz-1366-10`); „Sekvence je prázdná…“, „Export zrušen.“, nativní Smazat sekvenci (wrapper `src/i18n-app.js:83`) a všech 16 kroků
„AI: …“ / „Zpět: AI: …“ mají překlad (`tr()` ověřen); placeholder Zadání v EN anglicky i po čistém startu (`en-1366-01`); dialog Export: MXF → −23 LUFS,
po exportu „✔ Hotovo za 3 s“, tlačítka na místě (`cz-1366-d-export-hotovo`); Ctrl+Q v nabídce; název „Untitled“ po přepnutí do EN se přepíše.

## Tři nejdůležitější nálezy
1. **Po dokončení přepisu skočí seznam vět na konec (2).** U každého nového přepisu (3/3: 90 s, 240 s, 150 s; CZ i EN) se po „hotovo“ ukáže poslední
   věta, ne první – uživatel čeká začátek rozhovoru a musí rolovat nahoru (scrollTop 2059/2059, 1245/1249; `cz-1366-14-prepis-hotovo.png`,
   `en-1366-10`). Stejně po importu už přepsaného klipu v první relaci (`cz-1366-02-po-importu.png`, 4:33 místo 0:01). Příčina: během přepisu je seznam
   prázdný, takže `atEnd` je pravda a nový seznam se odroluje na konec. `src/ui/transcript-panel.js:189, :193`.
2. **Po otevření projektu / importu už přepsaného klipu to několik sekund vypadá, že přepis není (2).** Restart s autosave: Přepis ukáže
   „Řeč v klipu ještě není přepsaná · Přepsat řeč“ (`cz-1920-01-start.png`), při 1280 dokonce „Čeká na přepis · nejdřív se dopíše „vzhled-s2-novy-90s.mp4““
   a stavový řádek „Přepis … – čeká na Worker“ (`cz-1280-01-prepis.png`) – u klipů, které jsou dávno přepsané. Za 3–8 s se vše přepne na hotovo
   (Worker vrátí přepis z mezipaměti). V EN po importu 5min výřezu totéž „The speech in this clip is not transcribed yet · Transcribe speech“
   (`en-1366-04-po-importu.png`). Působí to, jako by aplikace zapomněla práci a přepisovala znovu; tlačítko Přepsat řeč v tu chvíli láká ke zbytečné akci.
   `src/ai/asr-desktop.js` `scan()` (start až po 2,5 s, `loadForMedia` mine → `start()`), `src/ui/transcript-panel.js:172`.
3. **Zastavit slibuje „hotovou část můžeš používat“, ale žádná není (2).** Po Zastavit při 4 %: „Přepis zastaven (4 %) · hotovou část můžeš používat“
   + toast „Přepis zastaven. Hotovou část můžeš používat.“, pod tím prázdný panel (`cz-1366-12-prepis-zastaven.png`, EN `en-1366-09`). Worker vrací
   výsledek až celý, takže zastavení zahodí vše a „Pokračovat“ začne od 0 % (ne od 4 %). K tomu průběh: 0 % → 4 % (stojí 4–20 s) → 56 % → hotovo,
   a „odhaduji čas…“ se do konce nezmění (`cz-1366-11`). Texty z webové verze (stahuje se po kouscích) ve standalone neplatí.
   `src/ui/transcript-panel.js:251, :266`, `src/ai/asr-desktop.js` (`backend`, onProgress).

## Ostatní
- **Panel Přepis jinak vypadá dobře** v CZ i EN, 1280–1920: výběr vět (fialové pozadí, rámeček poslední), patička „3 věty · 0:15 · Přehrát · Vložit do nové
  sekvence ▾“, menu vložení, po vložení „✓ V nové sekvenci · 0:00–0:14“ + „Titulky z přepisu…“, hledání se zvýrazněním a „1 / 23“ / „Nenalezeno“, štítky
  „✓ Přepis“ / „Přepis 1 %“ v Projektu, „Přepis 4 %“ v záložce. Nic nepřetéká (sken patičky bez přetečení). Při 1920 je panel Projekt/Přepis užší (≈320 px)
  než při 1366 (≈410 px) – „Přehrát“ se zúží na ▶ (`cz-1920-02`). Bez přepisu svítí dole „Klikni na větu = začátek a konec úseku…“, i když vět není (`cz-1366-11`).
- **Dialog Titulky z přepisu**: srozumitelný v CZ i EN; pod popisem prázdné místo ≈40 px (rezerva `min-height:72px` pro webové stahování,
  `src/renderer.js:1764`), s varováním „already has captions“ je varování širší než text (`en-1280-d-doplnit-titulky`). EN „Look follows the format“ (lépe „Style“),
  „2 parts of a.mp4, b.mp4“. Nadpis „Captions from the transcript“ × tlačítko „Captions from transcript…“ × menu „Create Captions from Transcript…“.
  Délka v dialogu „0:15“ × patička „0:00–0:14“ (zaokrouhlení × useknutí).
- **Dialog Export**: po přepnutí MP4 → MXF → MP4 zůstane Hlasitost „−23 LUFS (TV)“ (výchozí pro MP4 je Vypnuto) – export pro sítě pak vyjde potichu
  (`cz-1366-d-export-hotovo.png`, `src/renderer.js:1216–1218`). „Hotovo za 3 s · 5.149 MB“ – v češtině tečka = tisíce (5149 MB?), 3 desetinná místa
  (`src/core/exporter.js:389`). Esc dialog nezavře, protože fokus je v poli Výstupní soubor (`src/renderer.js:851`); pole ukazuje začátek cesty, název souboru je uříznutý.
- **Po přepnutí jazyka** zůstane stavový řádek v původním jazyce („Přepis hotový: …“ v EN, `en-1920-01`, `en-1280-01`) a v konzoli 2× `Uncaught "illegal access"`
  (index.html, při každém přepnutí – i v S1; uživatel nevidí).
- **Prostředí testů (pro vývojáře, 2):** `test/standalone.js` mění jen proměnnou APPDATA, ale Chromium (localStorage, IndexedDB) zapisuje do skutečného
  `%APPDATA%\PZ AI Cut Standalone` (DevToolsActivePort a LOG aktualizované naším během). Všechny role i uživatelova aplikace tak sdílí `pzProjTab`,
  `pzAutoAsr2`, `pzAsrSpeedDesk`… – „čistý“ EN profil se otevřel na záložce Titulky, protože ji předtím zvolila jiná instance (`en-1366-01`). První spuštění
  tak nejde poctivě ověřit a testy mohou měnit nastavení uživatele.
- **Rozložení z S1 – trvá:** úzká časová osa (klipy ≈240 px při 1366, ≈185 px při 1280, A2 skrytá, pravítko „:00:00“ / „00:00:10:“ uříznuté); prázdný Projekt
  v úzkém sloupci („The project is / empty. / Drag video…“, `en-1366-02`); text prázdné osy přes sloupec hlaviček a dělicí čáru (všechny 3 velikosti);
  karta Začni tady má posuvník a uříznuté tlačítko „Panel AI“ **nově už i při 1366** (text kroku 2 je delší; 190/169 px, při 1280 223/146 px – krok 3 skrytý);
  F1 se otevře posunuté na konec (scrollTop 317/317, fokus Zavřít). EN „NO ACTIVE SEQUENCE – OP…“ uříznuté. Po zavření sekvence AI panel dál ukazuje
  „Active sequence VYREZ-5MIN“ (`en-1280-04`).
- Konzole: kromě varování vývojové verze a „illegal access“ čistá ve všech 4 bězích.

## Tabulka
| # | jazyk | rozlišení | kde | co je špatně | přesný text / číslo | záv. | snímek | zdroj |
|---|---|---|---|---|---|---|---|---|
| 1 | obě | vše | Přepis – po dokončení přepisu | seznam odrolovaný na poslední větu | scrollTop 2059/2059, 1245/1249 | 2 | cz-1366-14-prepis-hotovo.png, en-1366-10-prepis-hotovo.png, cz-1366-02-po-importu.png | src/ui/transcript-panel.js:189, :193 |
| 2 | obě | vše | Přepis / stavový řádek po otevření projektu či importu přepsaného klipu | 3–8 s tvrdí, že přepis není / čeká ve frontě | „Řeč v klipu ještě není přepsaná · Přepsat řeč“, „Čeká na přepis · nejdřív se dopíše…“, „The speech in this clip is not transcribed yet“ | 2 | cz-1920-01-start.png, cz-1280-01-prepis.png, en-1366-04-po-importu.png | src/ai/asr-desktop.js scan(), src/ui/transcript-panel.js:172 |
| 3 | obě | vše | Přepis – Zastavit | slibuje hotovou část, žádná není; Pokračovat začne od 0 % | „Přepis zastaven (4 %) · hotovou část můžeš používat“, toast „Hotovou část můžeš používat.“ | 2 | cz-1366-12-prepis-zastaven.png, en-1366-09-prepis-zastaven.png | src/ui/transcript-panel.js:251, :266; src/ai/asr-desktop.js backend |
| 4 | obě | vše | Přepis – průběh | 0 → 4 % (stojí) → 56 % → hotovo, odhad se neukáže | „Přepisuji řeč… 4 % · odhaduji čas…“ | 1 | cz-1366-11-prepis-probiha.png, en-1366-08-prepis-probiha.png | src/ai/asr-desktop.js (onProgress), transcript-panel.js:248 |
| 5 | obě | vše | dialog Export | hlasitost TV zůstane po návratu z MXF na MP4 | „Normalizovat na −23 LUFS (TV, EBU R128)“ u H.264 | 2 | cz-1366-d-export-hotovo.png | src/renderer.js:1216–1218 |
| 6 | CZ (i EN) | vše | dialog Export – hotovo | desetinná tečka a 3 místa | „Hotovo za 3 s · 5.149 MB“ | 1 | cz-1366-d-export-hotovo.png | src/core/exporter.js:389, src/core/lang.js:185 |
| 7 | obě | vše | dialog Export (i Nová sekvence) | Esc nezavře – fokus v textovém poli | – | 1 | cz-1366-d-export.png | src/renderer.js:851 |
| 8 | obě | vše | dialog Titulky z přepisu | prázdné místo pod popisem; různé šířky textu a varování | min-height 72px | 1 | cz-1366-07-d-titulky-z-prepisu.png, en-1280-d-doplnit-titulky.png | src/renderer.js:1764 |
| 9 | EN | vše | dialog Titulky z přepisu | neobratné / nejednotné | „Look follows the format…“, „2 parts of a.mp4, b.mp4“, „Captions from the transcript“ × „Captions from transcript…“ | 1 | en-1366-d-titulky-z-prepisu.png | src/renderer.js:1741 a dál |
| 10 | obě | vše | patička Přepisu × dialog | délka 0:15 × 0:00–0:14 | „V nové sekvenci · 0:00–0:14“ × „vyrez-5min · 0:15“ | 1 | cz-1366-06-sekvence.png, cz-1366-07 | src/ui/transcript-panel.js:552 |
| 11 | obě | vše | Přepis bez vět | nápověda k výběru vět, i když nejsou | „Klikni na větu = začátek a konec úseku…“ | 1 | cz-1366-11-prepis-probiha.png | src/ui/transcript-panel.js:515 |
| 12 | EN (po CZ→EN) | vše | stavový řádek | zůstane česky | „Přepis hotový: vzhled-s2-novy-240s.mp4“ | 1 | en-1920-01-po-prepnuti.png, en-1280-01-vyber.png | src/ai/asr-desktop.js (app.status), setLanguage |
| 13 | – | – | konzole při přepnutí jazyka | 2× výjimka | `Uncaught "illegal access"` (index.html) | 1 | con-1920cs.log | přepnutí jazyka / aiFrame |
| 14 | – | – | testovací instance | localStorage/IndexedDB sdílené s uživatelem a ostatními rolemi | `%APPDATA%\PZ AI Cut Standalone\Local Storage` | 2 | en-1366-01-prvni-spusteni.png (záložka Titulky) | test/standalone.js, main.js:26 |
| 15 | obě | 1366, 1280 | Program – Začni tady | posuvník, tlačítko „Panel AI“ uříznuté – nově i při 1366 | 190/169 px (1366), 223/146 px (1280) | 2 | cz-1366-01-prvni-spusteni.png, en-1280-04-bez-sekvence.png | src/ui/monitors.js:76–86 |
| 16 | obě | 1366, 1280 | časová osa | úzká, A2 skrytá, pravítko uříznuté (trvá S1 #14, #30) | klipy ≈240 / ≈185 px, „:00:00“ | 2 | cz-1366-06-sekvence.png, cz-1280-02-vyber.png | rozložení |
| 17 | obě | vše | Projekt – prázdný | úzký sloupec (trvá S1 #11) | „The project is / empty.“ | 2 | en-1366-02-prazdny-projekt.png | src/ui/project-panel.js:76 |
| 18 | obě | vše | prázdná časová osa | text přes hlavičky a dělicí čáru (trvá S1 #12) | „No sequence open – drag a clip…“ | 2 | en-1366-01-prvni-spusteni.png, en-1280-04 | src/app.css:228, src/premiere-look.css:66 |
| 19 | obě | vše | Klávesové zkratky (F1) | otevře se na konci (trvá S1 #10) | scrollTop 317/317 | 2 | cz-1366-d-help.png | src/renderer.js:944–945 |
| 20 | EN | 1366, 1280 | AI panel – Active sequence | uříznuté (trvá S1 #17); po zavření sekvence dál stará | „NO ACTIVE SEQUENCE – OP…“, „VYREZ-5MIN“ bez otevřené sekvence | 1 | en-1366-01-prvni-spusteni.png, en-1280-04-bez-sekvence.png | src/ai/layout.css:47 |
| 21 | obě | – | nabídka Okno | „Načíst znovu“ (Ctrl+Shift+F5) a „Vývojářské nástroje“ pro koncového uživatele (Ctrl+R už opraven) | – | 1 | – | src/core/menu.js:75 |
| 22 | EN | vše | AI panel – lišta | česká desetinná čárka | „VRAM 6,0/12 GB“ | 1 | en-1366-01-prvni-spusteni.png | src/ai (lišta systému) |

Snímky: `team\v2\s2\shots-vzhled\` (`cz|en-<rozlišení>-NN-*` stavy, `-d-*` dialogy, `-c-*` kontextové menu), logy konzole `con-*.log`.
Export pro kontrolu: `web\test-out\vzhled-s2-1366.mp4` (+ .srt). Instance 9373 zastavena.

# Kolo S3 – Vzhled a jazyk (standalone)

Otázka: vypadá standalone po opravách S2 profesionálně v obou jazycích – i při opravdu čistém prvním spuštění?
Instance `test/standalone.js start 9373 %TEMP%\pz-s3-ui-<…> --ai`, **každý běh nový profil** (PZ_USERDATA – localStorage byl prázdný, ověřeno):
1366×768 CZ (`cs1366`, pak restart téhož profilu s přejmenovaným médiem), 1366×768 EN (`en1366`), 1280×720 CZ (`cs1280`) a EN (`en1280`),
1920×1080 CZ (`cs1920`), 2560×1440 EN (`en2560`), 1366×768 CZ (`cs1366b`, nový 75s klip – přepis, Zastavit, Pokračovat, export).
Ovládání: skutečné kliky / klávesy / psaní přes CDP (`Input.dispatch*`), import přes `TN.app.importPaths` (místo nativního dialogu), export **přes dialog Export**
(cesta přepsaná v poli, tlačítko Exportovat). F1 je nativní akcelerátor nabídky – CDP ho nespustí, proto `TN.app.cmd('help')`. O aplikaci je nativní
okno – jen z kódu. Sken DOM (text, title, placeholder, aria-label) aplikace i `#aiFrame` v CZ i EN, konzole přes CDP po celou dobu (`con-*.log`).
AI panel (agenta) jsem nespouštěl. Chybějící médium: kopie 20 s v `%TEMP%\pz-s3-ui-media`, po importu a vložení do sekvence přejmenovaná;
poškozený soubor = useknutý MP4 + textový soubor s příponou .mp4; export bez práv = `C:\Program Files\…` (proces bez admin práv, ověřeno).

## Tři nejdůležitější nálezy
1. **Chybějící médium je skoro neviditelné a export s ním tiše „zamrzne“ (3).** Po přejmenování souboru: Program i Zdroj jen černé (žádné „Médium chybí“
   jako v Premiere), klip na ose beze změny, dlaždice v Projektu (výchozí zobrazení ikon) beze změny – i po restartu (`cz-1366-19`, `-22`, `-23`, `-24`).
   Červený název je jen v zobrazení seznamu a tam **anglicky „media offline“** (`cz-1366-25`). Panel Přepis radí „Najdi ho přes lištu Nenalezená média“
   – taková lišta ve standalone není (`cz-1366-22`). Export sekvence s chybějícím klipem: dialog skončí na „14 % video“, tlačítko Exportovat je zase aktivní,
   žádná chyba (`cz-1366-d-export-chybejici-medium.png`) – chyba ffmpeg přijde v 44,8 s a za 0,4 s ji přepíše průběh dalšího úseku (ostatní úlohy `pool`
   běží dál po selhání). Zdroj: `src/app.css:165` (`.pi.missing .nm`, dlaždice má `.tname`), `src/ui/project-panel.js:65`, `src/ui/transcript-panel.js:168`,
   `src/core/exporter.js:164–170` + `onProgress` v `src/renderer.js` exportDialog.
2. **Technické anglické chyby ffmpeg přímo uživateli (2–3).** Import poškozeného souboru: toast „textovy-soubor.mp4: ffprobe exited with code 1:
   [mov,mp4,m4a,3gp,3g2,mj2 @ 000001e7f8b51280] moov atom not found | C:/…: Invalid data found when processing input“, ze dvou chybných souborů je vidět jen
   poslední toast, stavový řádek „Importováno: 0“ (`cz-1366-17`). Export do složky bez práv: nejdřív se vyrenderuje 60 %, pak „✖ ffmpeg exited with code
   4294967283: [out#0/mp4 @ 000002a4ca865800] Error opening output C:\Program Files\pz-vzhled-s3.mp4: Permission denied | …“ (`cz-1366-d-export-bez-prav`) –
   cesta se neověří předem. Zdroj: `src/core/media.js:46` (`run`), `src/renderer.js:124` (`importPaths`), `src/core/exporter.js` (žádná kontrola zápisu).
3. **Notebook: v AI panelu 340 px je hlavní tlačítko pod okrajem a stav uříznutý (2).** Při 1366×768 i 1280×720 je „Spustit“ až na y 682 px při výšce
   panelu 649 px (panel se musí posunout, 775/519 px) – na první obrazovce ho uživatel nevidí (`cz-1366-01`, srovnej `cz-1920-01`). Patička
   „Systém připraven“ → „Systém při…“ (79/102 px), EN „System rea…“; „ŽÁDNÁ AKTIVNÍ S…“ / „NO ACTIVE SEQUE…“ uříznuté (i při 1920 „…SEKVENCE –…“).
   Zdroj: `src/app.css` (`@media (max-width:1500px) #aiPanel {width:340px}`), `src/ai/layout.css:138` (`.pz-sys max-width:55%`), `src/ai/layout.css:47`.

## Ověření oprav z „Od kola S3“
- **Opraveno:** F1 se otevře nahoře (scrollTop 0, CZ i EN, i 1280); Esc zavře Export, Novou sekvenci, Nastavení sekvence i Titulky z přepisu s kurzorem
  v poli; Export pevně 640 px, hlasitost MP4→MXF→MP4 vrací původní (off→tv→off, −14→tv→−14), „Hotovo za 1 s · 0,5 MB“ česky; nová sekvence z klipu
  1280×720 podle klipu; seznam vět po dokončení přepisu nahoře (scrollTop 0/546, `cz-1366-30`); karta Začni tady bez posuvníku (130/130 px při 1280 CZ,
  145/145 EN), tlačítko Panel AI vidět; prázdný Projekt přes celou šířku; text prázdné osy už nejde přes hlavičky; klipy na ose širší (1366: ≈300 px místo 240,
  1280: 216 místo 185); Zastavit – toast „Přepis zastaven. Spustíš ho znovu kdykoli.“; Pokračovat navázal (1 %); konzole bez „illegal access“ při přepnutí jazyka.
- **Neopraveno / jen napůl:** (a) panel Přepis po Zastavit dál „Přepis zastaven (0 %) · **hotovou část můžeš používat**“ (`cz-1366-27`, opraven jen toast);
  (b) po importu přepsaného klipu do čistého profilu „Čeká na přepis · Zastavit“ → „Přepisuji řeč… 0 % · odhaduji čas…“ → hotovo (≈2 s) – text „načítám přepis…“
  se nikdy neukáže, stav `queued` zprávu ignoruje (`cz-1366-02`, `en-1366-02`); (c) stavový řádek po přepnutí jazyka zůstane v původním jazyce
  („Přepis hotový: chybejici-klip.mp4“ v EN, `en-1366-30`), v EN zůstane i „Bez názvu.pzcut“ (záložka přitom „Project: Untitled“) a titulky tlačítek Přepisu
  „Předchozí (Shift+Enter)“, „Další (Enter)“, „Přesný přepis“; (d) odhad času u nového klipu na čistém profilu se neukáže („odhaduji čas…“ do konce).

## Nové věci
- **Editovatelný timecode:** vzhled dobrý (modrý rámeček, stejné písmo, vše označené), `1015` → 00:00:10:15, `+5`, `-1:00`, `99999999` → konec, Esc vrátí,
  Enter vrátí fokus oknu (zkratky fungují) – `cz-1366-04`, `-11`. Drobnosti: bublina jen anglicky i v CZ „Click and type a time (Enter = go, +15 = 15 frames
  forward)“; chybný vstup `abc` se tiše zahodí; **při přehrávání klik nic neudělá** (pole hned smaže překreslení timecode každý snímek); timecode časové osy
  (`#tlTc`) přepsat nejde (v Premiere ano).
- **Titulky z přepisu:** délka teď sedí (0:17 = 0:00–0:17), titulky za ≈2 s; trvá prázdné místo ≈40 px pod popisem, název souboru zalomený „vyrez-/5min.mp4“,
  EN „Look follows the format…“, „Captions from the transcript“ × „Captions from transcript…“. Po vytvoření stavový řádek dál „Přepis hotový: …“.
- **Kontextová menu** (klip, mezera, zobrazení osy, médium, sekvence, titulek na ose i v seznamu) – vše přeložené, nic nepřetéká. Nejednotné: titulek na ose
  „Smazat titulek“ bez zkratky × v seznamu „Smazat titulek (Del)“ (zkratka v textu, jiný styl než hlavní menu); hlavička stopy pravý klik nemá (Premiere:
  přidat/smazat/přejmenovat stopu); „Přidat na konec aktivní sekvence“ bez sekvence tiše vytvoří novou.
- **Nastavení sekvence, Text v obraze, Nadpis, Jak na video, zkratky:** v pořádku v CZ i EN; při 1366 je Text v obraze dál na posouvání (Barva, Podklad až dole);
  Jak na video krok 2 „Pak Vložit do sekvence“, tlačítko se jmenuje „Vložit na začátek“ / „Do nové sekvence…“.
- **O aplikaci** (z kódu `src/core/menu.js:91`): „Verze 0.1.0 / Samostatný střihový program s AI panelem PZ (přepis, Claude, titulky, 9:16).“ – „AI panel PZ“ ×
  hlavička „PZ AI“; „Otevřít složku aplikace“ otevře složku se zdrojovým kódem (`main.js:47`).
- **Rozlišení:** 1920 a 2560 v pořádku; při 2560 zůstane Projekt/Přepis 330 px (dlouhé věty ve 3 řádcích vedle obřích monitorů). Při 1280×720 nástroj „T“
  přetéká přes stavový řádek (`cz-1280-01`).

## Tabulka
| # | jazyk | rozlišení | kde | co je špatně | přesný text / číslo | záv. | snímek | zdroj |
|---|---|---|---|---|---|---|---|---|
| 1 | obě | vše | Projekt (ikony), Program, Zdroj, osa – chybějící médium | žádná viditelná známka, jen černý obraz | – | 3 | cz-1366-19, -22, -23, -24 | src/app.css:165 (`.nm`, dlaždice `.tname`) |
| 2 | obě | vše | Export sekvence s chybějícím klipem | chyba přepsaná průběhem, dialog stojí na 14 %, Exportovat aktivní | „14 % video“ | 3 | cz-1366-d-export-chybejici-medium.png | src/core/exporter.js:164–170, :234; src/renderer.js exportDialog (onProgress po chybě) |
| 3 | CZ | vše | Přepis – chybějící médium | odkaz na neexistující lištu | „Najdi ho přes lištu Nenalezená média, pak se přepis ukáže.“ | 2 | cz-1366-22 | src/ui/transcript-panel.js:168 |
| 4 | CZ | vše | Projekt – zobrazení seznamu | anglicky (překlad `'· media offline'` nesedí na celý řádek) | „00:00:20:03 · 1280×720 · 25 fps · media offline“ | 2 | cz-1366-25 | src/ui/project-panel.js:65, src/core/lang.js:49 |
| 5 | obě | vše | toast po importu poškozeného souboru | surová chyba ffprobe, adresa v paměti; z 2 chyb vidět 1 | „ffprobe exited with code 1: [mov,mp4,… @ 000001e7f8b51280] moov atom not found …“ | 2 | cz-1366-17 | src/core/media.js:46, src/renderer.js:124 |
| 6 | obě | vše | Export do složky bez práv | cesta se neověří předem (render 60 %), surová chyba ffmpeg | „✖ ffmpeg exited with code 4294967283: … Permission denied …“ | 2 | cz-1366-d-export-bez-prav | src/core/exporter.js (výstup až na konci), src/core/media.js:46 |
| 7 | obě | 1366, 1280 | AI panel – Spustit | hlavní tlačítko pod okrajem, panel na posouvání | top 682 px > výška 649 px; 775/519 | 2 | cz-1366-01, cz-1280-01 (× cz-1920-01) | src/app.css (`#aiPanel 340px`), src/ai/layout.js:155 |
| 8 | obě | 1366, 1280 | AI panel – patička, Aktivní sekvence | uříznuté | „Systém při…“ 79/102 px, „System rea…“; „ŽÁDNÁ AKTIVNÍ S…“ (i 1920) | 2 | cz-1366-01, en-1366-01, cz-1920-01 | src/ai/layout.css:138, :47 |
| 9 | obě | vše | Přepis – po Zastavit | slib hotové části zůstal v panelu (toast opraven) | „Přepis zastaven (0 %) · hotovou část můžeš používat“ | 2 | cz-1366-27 | src/ui/transcript-panel.js:252 |
| 10 | obě | vše | stavový řádek / Projekt po přepnutí jazyka | zůstane v původním jazyce (trvá S2 #12, S1 #18) | „Přepis hotový: chybejici-klip.mp4“, „Bez názvu.pzcut“ v EN | 1 | en-1366-30 | src/renderer.js setLanguage :1469, asr-desktop.js (app.status) |
| 11 | EN (po CZ→EN) | vše | Přepis – bubliny tlačítek | česky | „Předchozí (Shift+Enter)“, „Další (Enter)“, „Přesný přepis“ | 1 | (sken DOM) | src/ui/transcript-panel.js (L() při vykreslení) |
| 12 | obě | vše | Přepis po importu přepsaného klipu (čistý profil) | „načítám přepis“ se neukáže, ≈2 s „Čeká na přepis · Zastavit“ / „0 %“ | „Waiting to transcribe“, „Transcribing speech… 0 % · estimating the time…“ | 1 | cz-1366-02, en-1366-02 | src/ui/transcript-panel.js:236–239 (queued ignoruje msg) |
| 13 | obě | vše | Přepis – průběh nového klipu, čistý profil | odhad se neukáže | „Přepisuji řeč… 4 % · odhaduji čas…“ | 1 | cz-1366-26 | src/ai/asr-desktop.js (est bez změřené rychlosti) |
| 14 | CZ | vše | timecode monitorů – bublina | anglicky | „Click and type a time (Enter = go, +15 = 15 frames forward)“ | 1 | (sken DOM) | src/ui/monitors.js:149 |
| 15 | obě | vše | timecode při přehrávání | klik nic neudělá (pole smaže překreslení) | – | 1 | cz-1366-06 | src/ui/monitors.js:95, :187 × editableTc |
| 16 | obě | vše | timecode – chybný vstup; timecode osy | tiše zahozeno; `#tlTc` nejde přepsat | „abc“ | 1 | cz-1366-05 | src/ui/monitors.js:163, src/ui/timeline.js |
| 17 | obě | vše | dialog Titulky z přepisu | prázdné místo, zalomený název (trvá S2 #8, #9) | „vyrez-/5min.mp4“, „Look follows the format…“ | 1 | cz-1366-d-titulky-z-prepisu, en-1366-d-titulky-z-prepisu | src/renderer.js:1764 |
| 18 | obě | vše | titulek – kontextové menu | osa bez zkratky × seznam se zkratkou v textu | „Smazat titulek“ × „Smazat titulek (Del)“ | 1 | cz-1366-c-titulek-osa, -seznam | src/ui/timeline.js:729, src/ui/caption-list.js:249 |
| 19 | obě | vše | hlavička stopy | pravý klik bez menu | – | 1 | – | src/ui/timeline.js (contextmenu jen na lanes) |
| 20 | obě | vše | Projekt – Přidat na konec aktivní sekvence (bez sekvence) | tiše vytvoří novou, stav nic neřekne | – | 1 | cz-1366-07 | src/renderer.js:911 |
| 21 | CZ | vše | menu klipu, Nastavení sekvence | neobratné / desetinná tečka | „Použít zatmívačku do černé“, „Vyplnit snímek / přizpůsobit velikosti“, „23.976“, „29.97“ | 1 | cz-1366-c-klip, cz-1366-d-nastaveni-sekvence | src/core/lang.js, src/renderer.js seqDialog |
| 22 | obě | vše | Jak na video krok 2 | jiný název tlačítka | „Pak Vložit do sekvence“ × „Vložit na začátek“ | 1 | cz-1366-d-jak-na-video | src/renderer.js socialGuide |
| 23 | CZ | vše | lišta nahoře | jazyk podle stavu | zelené „bridge :7890“ × červené „most neběží (AI panel)“ | 1 | cz-1366-01, cz-1366-d-export | src/renderer.js:1500 |
| 24 | obě | vše | AI panel – čistý profil | „Claude připojen“ bez připojení (sdílený stav pluginu, mezi běhy se mění) | „Claude connected“ × „Connect Claude“ | 1 | en-1366-01, en-1280-01 | src/ai (stav pluginu) |
| 25 | obě | vše | prázdná sekvence | osa bez nápovědy, Exportovat aktivní (chyba česky až po kliku – OK) | – | 1 | cz-1366-20, cz-1366-d-export-prazdna | src/ui/timeline.js |
| 26 | obě | 1280×720 | lišta nástrojů | „T“ přes stavový řádek (trvá S1 #29) | – | 1 | cz-1280-01, en-1280-01 | rozložení #tools |
| 27 | obě | 1366 | Text v obraze | Barva / Podklad až po posunu (trvá S1 #32) | 411/269 px | 1 | cz-1366-14, -15 | rozložení #sourcePanel |
| 28 | CZ | – | O aplikaci, Otevřít složku aplikace | jiný název panelu; otevře zdrojový kód | „s AI panelem PZ“ | 1 | – | src/core/menu.js:91, main.js:47 |
| 29 | obě | 2560×1440 | Projekt / Přepis | panel zůstane 330 px | – | 1 | en-2560-02 | rozložení #projectPanel |

Snímky: `team\v2\s3\shots-vzhled\` (`cz|en-<rozlišení>-NN-*` stavy, `-d-*` dialogy, `-c-*` kontextová menu), konzole `con-*.log` (čisté – jen
ERR_FILE_NOT_FOUND u přejmenovaného klipu a varování `unknown command playToggle` z mého testu). Export pro kontrolu `web\test-out\vzhled-s3-1366.mp4`.
Testovací média `%TEMP%\pz-s3-ui-media`. Instance 9373 zastavena.

# Kolo S4 – Vzhled a jazyk (standalone, závěrečná regrese)

Otázka: vypadá standalone po nočních opravách profesionálně a nic se nerozbilo?
Instance `test/standalone.js start 9373 %TEMP%\pz-s4-ui-<tag> --size … --lang … --ai`, **každý běh nový profil** (localStorage na startu 2 položky
od aplikace): `cs1366`, `en1366`, `cs1280`, `en1280`, `cs1920`, `en1920`. V každém profilu: první spuštění → import 5min výřezu → 3 věty → Vložit
do nové sekvence → timecode → Zesílení (G) → menu klipu → F1 / Export / Jak na video / Titulky z přepisu → 20s klip na konec sekvence → automatická
záloha (42 s) → „pád“ (`stop`) → přejmenování klipu → restart **téhož** profilu → offline klip všude + export. V `cs1366` navíc uložený projekt
(cesta nastavená místo nativního dialogu Uložit) → obnova neuložených změn, poškozené soubory, export bez práv, Zastavit/Spustit znovu na 5 nových
70s výřezech z 28min rozhovoru (vždy jen jeden přepis), přepnutí CZ→EN→CZ. Kliky / klávesy / psaní přes CDP `Input.dispatch*`, import přes
`TN.app.importPaths` (místo nativního dialogu), export **přes dialog Export** (cesta přepsaná v poli). AI panel (agenta) jsem nespouštěl.

## Tři nejdůležitější nálezy
1. **„Spustit znovu“ hned po Zastavit občas přepis tiše ztratí (2).** 2 z 5 pokusů (CZ 1366 `novy-70s-s4b`, EN 1920 `novy-70s-s4e`, oba klik
   ≈0,6 s po Zastavit): po kliku přepis naskočí (1 % / 4 %), za 0,6–2,6 s se panel vrátí na „Přepis zastaven · Spustit znovu“ a **tak zůstane** (30 s+,
   žádné věty), stavový řádek visí na „Přepis novy-70s-s4b.mp4 – 1 %“ / „Transcribing … – 4 %“, patička AI panelu přitom „Přepis 4 % – přepisu…“
   (`cz-1366-17`, `cz-1366-18-po-spustit-znovu-zaseknute`, `-19`, `en-1920-w0-18-po-start-again-zaseknute`). Až druhý klik projde (5,6 s → 17 vět,
   `cz-1366-20`). V pořádku: pauza 3 s (1/1), 0,8 s (1/1) a jeden ze tří pokusů s okamžitým klikem – závisí na časování. Pravděpodobně
   pozdě doběhnutý zrušený běh (smyčka po 1 s / cancel úlohy na stejnou cestu) shodí nový běh na `AbortError` → `j.state = 'stopped'`.
   Zdroj: `src/ai/asr-desktop.js:91–110` (`backend`, `running` podle cesty, `backend.stop`), `:138`, `:149`; `src/ui/transcript-panel.js:257`.
2. **Offline médium: Zdroj pořád černý a rada „naimportuj ho znovu“ vede do slepé uličky (2).** Program, klip na ose, dlaždice i seznam už
   „Médium offline“ / „Media Offline“ ukazují (dlaždice a seznam ve všech 6 restartech, klip a Program v cs1366, cs1280, cs1920, en1920). Ale dvojklik na offline klip → Zdroj jen černý, bez nápisu (`cz-1366-15`, `cz-1920-06`,
   `en-1920-05`). Export i panel Přepis radí „Naimportuj ho znovu (Soubor → Importovat), nebo klip odstraň“ – import přejmenovaného souboru
   přidá **nové** médium (`chybejici-klip-PRESUNUTO.mp4`), klipy v sekvenci zůstanou offline (2 klipy `.offline` dál) a export dál selže. Chybí
   „Najít / Propojit médium“ jako v Premiere. Zdroj: `src/ui/monitors.js:187` (createSource bez `.mon-offline`, ten je jen v `:88`),
   `src/core/importer.js:46–51` (relink jen podle původní cesty), texty `src/core/exporter.js:207`, `src/core/lang.js:173`, `src/ui/transcript-panel.js:168`.
3. **AI panel při 1280×720: Spustit pořád pod okrajem (2).** Oprava S3 #7 platí jen pro 1366: při 1366 `Spustit` dole 620 px < výška panelu 649 ✓,
   při 1280×720 (CZ i EN) dole 620 px > **601 px** – tlačítko není na první obrazovce vidět, panel má posuvník (`cz-1280-01`, `cz-1280-03`,
   `en-1280-01`). Zdroj: `src/ai/layout.css:161` (`@media (max-height:700px)` – úspora nestačí na 601 px).

## Ověření oprav S3 (tabulka „opraveno“)
| S3 # | co | S4 výsledek |
|---|---|---|
| 1 | chybějící médium viditelné | **ano** – dlaždice „Médium offline“ / „Media Offline“, klip červeně, Program červená plocha, CZ 1280–1920, EN 1920 (`*-05-offline`). **Ne** ve Zdroji (nález 2). |
| 2 | export s chybějícím klipem | **opraveno** – chyba za 0,2 s, česky, tlačítko Exportovat zůstane (`cz-1366-d-export-offline`). Text jen šedý (`.dim`), ne červený. |
| 3 | odkaz na lištu Nenalezená média | **opraveno** – „Soubor byl přesunut nebo přejmenován – naimportuj ho znovu…“ (ale viz nález 2). |
| 4 | „media offline“ v seznamu | **opraveno** – „· médium offline“ (`cz-1366-14`). |
| 5 | chyba importu poškozeného souboru | **opraveno** – jedna zpráva, česky: „Nejde importovat: useknuty.mp4 (poškozený nebo nepodporovaný soubor), textovy-soubor.mp4 (…)“ (`cz-1366-10`). |
| 6 | export bez práv | **opraveno** – za 0,2 s, bez renderu: „✖ Do složky C:/Program Files nejde zapisovat – vyber jiné místo pro uložení.“ (`cz-1366-d-export-bez-prav`). |
| 7 | AI panel Spustit | **1366 ano, 1280 ne** (nález 3). Výpis výsledku pod Spustit (5bd438e) neověřen – vyžaduje běh agenta. |
| 8 | patička / Aktivní sekvence | patička **opravena** („Systém připraven · VRAM 8,0/12 GB“ celé, 1280–1920). „ŽÁDNÁ AKTIVNÍ S…“ dál uříznuté i při 1920 (201/368 px). |
| 9 | Zastavit bez slibu | **opraveno** – „Přepis zastaven“ + „Spustit znovu“ / „Start again“, toast „Spustíš ho znovu kdykoli.“ (ale nález 1). |
| 10, 11 | stav a bubliny po přepnutí jazyka | **opraveno** – po CZ→EN „Ready“, žádná čeština mimo přepis (`cz-1366-21`), zpět „Připraveno“. |
| 12 | „načítám přepis“ | **napůl** – „Načítám přepis…“ se ukáže (0,2 s), pak ale ≈1 s „Přepisuji řeč… 0 % · odhaduji čas… · Zastavit“ a „– čeká na Worker“ u dávno přepsaného klipu (6/6 běhů). |
| 13 | odhad času | trvá – „odhaduji čas…“ do konce u všech 5 nových klipů. |
| 14 | bublina timecode | **opraveno** – „Klikni a napiš čas (Enter = skok, +15 = o 15 snímků dál)“ na monitorech i ose. |
| 15 | timecode při přehrávání | **opraveno** – pole zůstane (`cz-1366-09`). |
| 16 | chybný vstup, timecode osy | **opraveno** – osa: `1015` → 00:00:10:15, `+5`, `00:00:02:00`; `abc`/`xyz` → červeně „Neplatný čas – napiš třeba 00:01:02:10, 1015 nebo +5“. Zpráva ale zůstane i po dalších správných zadáních. |
| 17 | dialog Titulky z přepisu | prázdné místo **opraveno** (36 px); název dál zalomený „vyrez-/5min.mp4“ (`cz-1366-d-titulky-z-prepisu-2`). |
| 21 | fps s čárkou | **opraveno** – CZ „23,976 … 29,97 … 59,94“, EN s tečkou. |
| 22 | Jak na video krok 2 | **opraveno** – „Pak tlačítko Vložit… pod přepisem“. |
| 29 | 2560 | netestováno (zadání 1280–1920). |

## Nové věci
- **Zesílení (G):** vzhled jako Premiere, CZ/EN přeložené, fokus v „Změnit o“ (0 označená), klik do „Nastavit na“ přepne volbu, −6 → −6 dB, „+3“ → −3 dB,
  bez výběru „Nejdřív vyber klipy“. Nic nepřetéká (1280–1920). Drobnost: „Pro vybrané zvukové klipy: **1. 0 dB** = původní hlasitost“ – čte se jako „1.0 dB“
  (`cz-1366-d-zesileni`); EN „Applies to 1 selected audio clip(s)“ ok.
- **Obnova po startu:** text přeložený („Obnoveny neuložené změny z automatické zálohy. Uložíš je Ctrl+S, nebo je zahodíš zavřením bez uložení.“, u neuloženého
  „Obnoven neuložený projekt z automatické zálohy.“), titulek „vzhled-s4.pzcut *“, značka zachovaná. Jenže je to jen toast na **2,6 s** hned při startu
  (105 znaků) – ve 4 z 6 restartů byl po ≈3 s (první možné připojení) už skrytý (`cz-1366-12` bez toastu) a stavový řádek ukáže „Připraveno“. Uživatel neví, proč má projekt „*“.
  Zdroj `src/renderer.js:56` (2600 ms), `:1911`, `:1913`.
- **Klip „Médium offline“ na ose:** červený, tučný štítek + název, bublina s cestou (`cz-1366-13`); úzký klip uřízne název („Médium offline of…“), štítek má přednost – ok.
- **Monitor s červenou plochou:** Program „Médium offline: offline-cs1280.mp4“ čitelné, zalamuje se na pomlčce („offline-/cs1280.mp4“) – drobnost.

## Regrese (nic se nerozbilo)
První spuštění CZ/EN 1280–1920 v pořádku: karta Začni tady bez posuvníku (130/130 px CZ, 145/145 EN při 1280; 216/216 při 1920), tlačítka viditelná,
prázdný Projekt přes celou šířku, text prázdné osy začíná za hlavičkami (left 662 = right hlaviček). F1 nahoře (scrollTop 0, i 1280), Esc zavře F1, Export,
Jak na video, Titulky, Nastavení sekvence. Export dialog 640 px, česky („Software (nejlepší kvalita)“, „Vypnuto (ponechat úrovně)“). Kontextová menu
(klip 26 položek, médium, sekvence) uvnitř okna i při 1280 (198–651 / 655 px), nic uříznutého. Přepis po dokončení nahoře (scrollTop 0). Žádná nová
angličtina v CZ (sken DOM textů, title, placeholder, aria-label aplikace i `#aiFrame`). Konzole: jen `ERR_FILE_NOT_FOUND` + varování `waveform ffmpeg
exited … No such file` u offline klipu (průběh vlny se zkouší i pro chybějící soubor – uživatel nevidí).
Trvá z dřívějška (bez zhoršení): nástroj „T“ přes stavový řádek při 1280 (S1 #29), „Claude připojen“ podle sdíleného stavu pluginu (S3 #24), EN „VRAM 8,0/12 GB“
s čárkou (S2 #22), „bridge :7890“ v CZ liště (S3 #23), EN Jak na video při 1366/1280 posuvník 16–58 px (CZ bez).

## Tabulka
| # | jazyk | rozlišení | kde | co je špatně | přesný text / číslo | záv. | snímek | zdroj |
|---|---|---|---|---|---|---|---|---|
| 1 | obě | vše | Přepis – Spustit znovu hned po Zastavit | 2/5 se nový běh přepne zpět na „zastaven“ a zůstane; stav visí na % | „Přepis zastaven · Spustit znovu“ + „Přepis … – 1 %“, AI patička „Přepis 4 %“ | 2 | cz-1366-17, cz-1366-18-po-spustit-znovu-zaseknute, -19, -20, en-1920-w0-18-po-start-again-zaseknute | src/ai/asr-desktop.js:91–110, :138, :149; src/ui/transcript-panel.js:257 |
| 2 | obě | vše | Zdroj – offline klip | černý obraz bez „Médium offline“ | – | 2 | cz-1366-15, cz-1920-06, en-1920-05 | src/ui/monitors.js:187 (overlay jen :88) |
| 3 | obě | vše | export / Přepis – rada u offline klipu | „naimportuj znovu“ nepropojí klip, export dál selže; chybí Propojit médium | „Naimportuj ho znovu (Soubor → Importovat), nebo klip odstraň.“ | 2 | cz-1366-d-export-offline | src/core/exporter.js:207, src/core/lang.js:173, src/core/importer.js:46–51 |
| 4 | obě | 1280×720 | AI panel – Spustit | pod okrajem, panel na posouvání (1366 opraveno) | dole 620 px > 601 px | 2 | cz-1280-01, cz-1280-03, en-1280-01 | src/ai/layout.css:161 |
| 5 | obě | vše | obnova neuložených změn po startu | jen toast 2,6 s při startu, stavový řádek nic | „Obnoveny neuložené změny z automatické zálohy…“ | 2 | cz-1366-12 (toast už zmizel) | src/renderer.js:56, :1911 |
| 6 | obě | vše | Přepis po importu přepsaného klipu | po „Načítám přepis…“ ≈1 s „Přepisuji 0 % · Zastavit“ + „čeká na Worker“ | „Přepisuji řeč… 0 % · odhaduji čas…“ | 1 | cz-1366-02-po-importu-3 | src/ai/asr-desktop.js:128–139 |
| 7 | obě | vše | Přepis – nový klip | odhad se neukáže (trvá S3 #13) | „odhaduji čas…“ do konce | 1 | cz-1366-w3-16 | src/ai/asr-desktop.js:134, :141 |
| 8 | obě | vše | dialog Export – chyba | šedým textem jako průběh | „✖ Médium offline: …“ | 1 | cz-1366-d-export-offline | src/renderer.js:1221, :1276 (`.dim`) |
| 9 | CZ | vše | Zesílení zvuku | číslo + tečka splývá s „0 dB“ | „Pro vybrané zvukové klipy: 1. 0 dB = původní hlasitost“ | 1 | cz-1366-d-zesileni | src/renderer.js:972 |
| 10 | obě | vše | timecode – chybný vstup | červená zpráva zůstane i po správném zadání | „Neplatný čas – napiš třeba …“ | 1 | cz-1366-08 | src/ui/monitors.js:179 |
| 11 | obě | vše | AI panel – Aktivní sekvence | uříznuté i při 1920 (trvá) | „ŽÁDNÁ AKTIVNÍ S…“ 131/368, 201/368 px | 1 | cz-1366-01, cz-1920-01 | src/ai/layout.css:47, :159 |
| 12 | obě | vše | Titulky z přepisu | název zalomený (trvá S3 #17) | „vyrez-/5min.mp4“ | 1 | cz-1366-d-titulky-z-prepisu-2 | src/renderer.js:1794 a dál |
| 13 | EN | 1366, 1280 | Jak na video | posuvník (CZ bez) | 619/603, 619/561 px | 1 | en-1366-d-jak-na-video, en-1280-d-jak-na-video | src/renderer.js socialGuide |
| 14 | obě | 1280 | lišta nástrojů | „T“ přes stavový řádek (trvá S1 #29) | – | 1 | en-1280-01 | rozložení #toolsPanel |
| 15 | – | – | konzole u offline klipu | vlna zvuku se zkouší pro chybějící soubor | „waveform ffmpeg exited … No such file“, `ERR_FILE_NOT_FOUND` | 1 | con-*-restart.log | src/renderer.js (loadWave / otevření zdroje) |

Snímky `team\v2\s4\shots-vzhled\` (`cz|en-<rozlišení>-NN-*` stavy, `-d-*` dialogy, `-c-*` menu, `-w0/-w3/-w08-*` Zastavit/Spustit znovu), konzole `con-*.log`.
Pozn.: v `en-1366` a `en-1280` se offline klip na osu nedostal (můj skript hledal jiný popisek menu „Append to Active Sequence“), proto tam export
„✔ Done“ – offline na ose a export s offline klipem v EN ověřeny jen při 1920.
Testovací média `%TEMP%\pz-s4-ui-media`. Instance 9373 zastavena.

# Návrh UX – kolo 6: 9:16 náhradní záběr, široký Přepis bez sekvence, ⤢, patička v jednom řádku
(Uloženo vývojářem z textu agenta – UX designér, 2026-11-22. Měřeno na 127.0.0.1:8791, projekt redaktora-5 „rozhovor-rano.mp4“ (67 vět, sekvence 9:16), stránka mwrc8zdt; varianty dočasným CSS (odstraněno). Snímky `team/design/shots-5/`.)

## 0. Naměřeno
- Metrika: celé věty pro všechny polohy posuvníku, min / medián. Seznam 1366×768 274 px (řádky 24/41/58, šířka 393 px); 1040×1100 364 px (26/44/62), navíc řádek `.tr-clip` 26 px.
- **Stav 07 při 1040×1100 = 6 vět:** patička má **3 řádky** (varování `.tr-flow`; „✓ V nové sekvenci · 0:00–0:15“ 156 px + „▶ Přehrát“ 74 px; „Titulky z přepisu…“ 157 px + ▾). Rozpočet 388 px, potřeba 429 px. Seznam dá 7 vět při 334 px → stačí patička v 1 řádku (41 px).
- **Nová chyba (mwrc8zdt):** po zavření sekvence zůstala patička „✓ Na konci · 0:17–0:26 / Doplnit titulky…“; `paintFoot()` překreslit při zavření sekvence.

## 1. Úkol 2 – 9:16 náhradní „celý záběr“
### 1.1 Vzhled (`916-srovnani.jpg`, `916-celyzaber-42-doporuceno.png`)
| Vrstva | Hodnota |
|---|---|
| Pozadí | Stejný snímek (živé video) zvětšený na výplň (cover) 1080×1920 |
| Rozmazání | Silné (gauss σ ≈ 45–50 px při 1080); levně: plátno 1/16 (68×120), `filter: blur(3px)`, zvětšit s `imageSmoothingQuality: 'high'` |
| Ztmavení | jas pozadí 45 % (×0,45), sytost beze změny |
| Obraz | celý záběr bez ořezu, **na celou šířku** (1080 × 608 u 16:9), bez rámečku/stínu/zaoblení |
| Svislá poloha | **střed obrazu ve 42 % výšky** (y 502–1110 px) – mezi nadpisem (~464 px) a titulky (~1160 px) |
| Bezpečné zóny | Meta 14 % / 35 % – celý uvnitř; TikTok ikony vpravo zakryjí pravých ~20 % v pásu 40–58 % (u celku přijatelné) |
| 4:5 a 1:1 | stejná funkce, střed v **50 %** |
| Pevná poloha | nezávisí na titulcích/nadpisu (obraz neposkakuje) |
| Přechod | střih natvrdo; náhled = export (jedna funkce v player.js i exportu, např. `clip.fit = 'blurfill'`) |
Varianta 50 % nedoporučena (titulky přes spodní okraj obrazu).

### 1.2 Hláška po převodu – toast
- Vložení do nové sekvence 9:16: obličej všude → bez toastu; aspoň 1 celý záběr → toast 8 s. Auto Reframe: vždy (4 s / 8 s s celým záběrem). Najetí myší pozastaví; běžný (ne chybový) styl.
- Časy sekvence m:ss (začátek dolů, konec nahoru, stejná sekunda jen „0:17“), nejvýš 3 úseky, pak „+N“; **každý čas je odkaz** (`#a78bfa`) – klik postaví hlavu na začátek záběru.
| Případ | CZ | EN |
|---|---|---|
| Obličej všude (jen Auto Reframe) | Výřez 9:16: všechny záběry podle obličeje (4). | 9:16 crop: all shots follow the face (4). |
| Část celá | **Výřez 9:16: 3 záběry podle obličeje · 1 celý (0:17–0:18)** | 9:16 crop: 3 shots follow the face · 1 shown whole (0:17–0:18) |
| Víc celých | Výřez 9:16: 5 záběrů podle obličeje · 2 celé (0:17–0:18, 0:42) | … · 2 shown whole (…) |
| Žádný obličej | Výřez 9:16: obličej se nenašel – záběry jsou celé (0:00–0:26). | 9:16 crop: no face found – shots shown whole (0:00–0:26). |
| Auto Reframe, předpona | Vytvořena sekvence „{název}“ · Výřez 9:16: … | Created sequence “{name}” · 9:16 crop: … |
Skloňování záběr/záběry/záběrů, celý/celé/celých; u 4:5 a 1:1 jen „9:16“ jinak. Popisek: „Celý záběr = v záběru se nenašel obličej, proto je vidět celý, zmenšený na šířku s rozmazaným pozadím. Začátek ani konec klipu se nemění. Zpět: Ctrl+Z.“

## 2. Úkol 3
### 2.1 (a) Přepis bez sekvence přes místo prázdné osy (doplnění design-4 §4)
- Kdy: `!app.seq()` a `bottomRow − 300 ≥ 410 px`; i po zavření všech sekvencí, pro všechny tři záložky panelu.
- Skryje se jen `#toolsPanel` (46 px). `#projectPanel` = `bottomRow − 300 px` (1030 px při 1366, 704 px při 1040), `#timelinePanel` 300 px. Ruční šířka z táhla se během (a) nemění, po otevření sekvence se vrátí.
- Text věty `max-width: 760px`; pole hledání `max-width: 480px`, šipky hned za ním.
- Kontejner ≥ 600 px: řádek `.tr-clip` a řádek `.tr-st.offer` (stav 13) přesunout doprava do řádku hledání (šedě 11,5 px, ellipsis, plný text v popisku) → +26 px. Řádky průběhu zůstanou samostatně.
- Osa 300 px (prázdný stav), na střed, `max-width: 240px`:
| | CZ | EN |
|---|---|---|
| Nadpis 13 px / 600 `#d6d6d6` | Sekvence zatím není | No sequence yet |
| Text 12 px `#8e8e8e` | ← Vyber v Přepisu větu → Vložit do nové sekvence. | ← Pick a sentence in the Transcript → Insert into new sequence. |
| Drobně 11,5 px | Nebo sem přetáhni klip z Projektu. | Or drag a clip here from the Project. |
| Sekvence existují, žádná otevřená | Žádná sekvence není otevřená. Otevři ji dvojklikem v Projektu, nebo vyber v Přepisu větu → Vložit do nové sekvence. | No sequence is open. Double-click one in the Project, or pick a sentence → Insert into new sequence. |
- Osa dál přijímá přetažení klipu. Varování v (a) inline v řádku patičky (2.2), patička 41 px.
- Přechod při prvním vložení: šířka panelu **najednou** (bez animace); zapamatovat y první vybrané věty a po změně nastavit `scrollTop` na stejné y (±4 px); osa a nástroje prolnutím `opacity 0 → 1` 150 ms ease-out; přepnout až když sekvence opravdu existuje (po OK).
- Naměřeno dočasným CSS (67 vět): (a) **9 / 11** (1366×768), **11 / 13** (1040×1100); s řádkem stavu 8 / 10 a 10 / 12; se sloučeným řádkem klipu 12 / 14 (1040); bez stropu 760 px 10 / 11.

### 2.2 Patička v jednom řádku i s varováním (container query `#projectPanel`)
| Kontejner | Varování | Po vložení (vlevo) | Přehrát |
|---|---|---|---|
| **≥ 600 px** (a, ⤢) | inline štítek s celou větou (`flex: 1 1 auto; min-width: 0; max-width: 480px`, ellipsis) | „✓ V nové sekvenci · 0:00–0:15“ | „▶ Přehrát“ |
| **< 600 px** (běžných 410 px) | **štítek ⚠ 28×28** za počtem vět / ✓ textem + bublina | **„✓ Vloženo · 0:00–0:15“** (kde se vložilo v popisku) | **jen ikona ▶ 28×28** |
- Mezery 4 px, hlavní tlačítko `min-width: 157px`, počet vět může ustoupit ellipsis. EN „Captions from transcript…“ → **„Create captions…“**.
- Rozpočet 388 px: 06 = 316 ✔, 07 „✓ Vloženo · 10:20–10:45“ + ⚠ = 380 ✔, 07 bez ⚠ 352 ✔, EN 375 ✔.
- **Štítek ⚠**: 28×28, pozadí `#372c1b`, okraj 1 px `#f59e0b`, ⚠ 14 px `#fcd34d`, rohy 3 px, hover `#4a3a1f`, fokus `outline 2px #a78bfa`, `aria-label` = celá věta. **Klik přehraje rizikový kraj** (začátek In → In+2 s, konec Out−2 s → Out, oba: 2 s + pauza 0,3 s + 2 s); výběr ani In/Out se nemění.
- **Bublina**: nad štítkem, ≤ 300 px, uvnitř panelu, `#372c1b`, levý okraj 2 px `#f59e0b`, text `#fcd34d` 11,5 px, stín, šipka 6 px. Ukáže se najetím (300 ms), fokusem a **sama na 4 s při novém varování** (jednou na výběr); Esc ji schová. Obsah: věta varování + šedě „Klik na ⚠ = poslechnout začátek (2 s).“; případný text úkolu 1 o pauze uvnitř výběru jen jako text.

### 2.3 ⤢ Zvětšit panel
- Hlavička panelu vpravo vlevo od ≡, mezera 2 px; 24×24, SVG 14 px (dvě šipky ven), `#bdbdbd`, hover `#fff` na `#2a2a2a`; ≡ zvětšit z 24×19 na 24×24.
- Popisky: „Zvětšit panel na celé okno (`)“ / „Maximize panel (`)“; zvětšený ⤡, `aria-pressed="true"`, „Zmenšit zpět (Esc nebo `)“.
- Chování: stávající `maximizeFrame` (`.panel.maxed`). Odhad ~25 vět (1366×768), ~35 (1040×1100).
- Esc: 1. bublina/menu, 2. text v hledání, 3. zmenšit panel. Vložení ze zvětšeného panelu ho vrátí (stejná kotva věty jako 2.1).

### 2.4 ▾ a hlava na konci sekvence (C10)
Stálé pořadí, položka hlavního tlačítka **tučně**, šedé s důvodem:
| Hlava | Položka 1 | Položka 2 | Položka 3 |
|---|---|---|---|
| na konci (±0,5 s) | **Přidat na konec sekvence · 0:16** | Vložit na hlavu – hlava je na konci (šedě) | Vložit na začátek |
| uvnitř klipu | **Přidat na konec sekvence · 0:16** | Vložit na hlavu – hlava je uvnitř klipu (šedě) | Vložit na začátek |
| na vnitřní hranici | Přidat na konec sekvence · 0:16 | **Vložit na hlavu · 0:19** | Vložit na začátek |
| na začátku (≤ 0,5 s) | Přidat na konec sekvence · 0:16 | Vložit na hlavu – hlava je na začátku (šedě) | **Vložit na začátek** |
Za položkami ― a „Do nové sekvence…“. Menu umisťovat podle skutečné výšky.

### 2.5 Štítek klipu v Projektu = stav Přepisu (`asrLabel(m)`)
Funkce vrací `{line, tag, short, info, title, frac, cls}`; Projekt i Přepis ji volají ve stejném tiku. Proužek 3 px dole na dlaždici (MB / % / neurčitý).
| Stav | Přepis | Štítek (CZ / EN) | < 100 px | Seznam | Popisek |
|---|---|---|---|---|---|
| ve frontě | Čeká na přepis · nejdřív se dopíše „X“ | Čeká na přepis / Waiting | ⋯ | · přepis čeká | Čeká na přepis – nejdřív se dopíše „X“. |
| **stahování (poprvé)** | Stahuji rozpoznávání řeči… 74 z 240 MB · jen jednou | **Stahuji 74/240 MB** / Download 74/240 MB | 31 % | · stahuji 74 / 240 MB | … (jen jednou). Pak se přepis spustí sám. |
| příprava | Připravuji přepis… 0:12 | **Příprava 0:12** | … | · příprava 0:12 | Připravuji přepis… 0:12 |
| běží | Přepisuji řeč… 45 % · zbývá asi 1 min | **Přepis 45 %** | 45 % | · přepis 45 % | … |
| přesněji | Přepisuji přesněji… 45 % | Přesněji 45 % | 45 % | · přesněji 45 % | … · zatím platí dosavadní přepis |
| zastaveno | Přepis zastaven u 1:20 (30 %) | Zastaveno 30 % | ‖ | · zastaveno 30 % | Hotovou část můžeš používat. |
| chyba | Přepis se nepodařil. … | Přepis selhal | ! | · přepis selhal | Přepis se nepodařil – {důvod}. |
| hotovo | – | ✓ Přepis | ✓ | · přepis ✓ | Klip má přepis. |
Všechny popisky končí „ Klikni = otevře záložku Přepis.“; „klikni pro přepis“ zmizí úplně.

### 2.6 Drobnosti
- C11: „✓ Staženo…“ jen jeden prvek (`#trPf` / `#projPf`), 5 s od prvního `done`; nesmí vzniknout druhý při `build()`.
- C9: patička „Smazán titulek … Vrátit“ zmizí okamžitě po Ctrl+Z / Vrátit, jakékoli další úpravě nebo výběru jiného titulku, přepnutí záložky či sekvence (bez časovače).

## 3. Změna | px v rámu Přepisu | celé věty min / medián
| Změna | px | 1366×768 | 1040×1100 | Cíl |
|---|---|---|---|---|
| (a) bez sekvence – 04 / 05 | šířka +620 / +294 | 6 / 8 → **9 / 11** | ~7–8 → **11 / 13** | ≥ 8 / ≥ 10 ✔ |
| (a) 06 výběr + varování (inline štítek) | +30 | 5 / 7 → **9 / 11** | → **11 / 13** | ✔ |
| (a) 03b stahování (20 px) | −20 | **8 / 10** | **10 / 12** | ✔ |
| (a) 13 slabý PC (nabídka v řádku hledání) | 0 (jinak −26) | **9 / 11** | **11 / 13** | ✔ |
| (a) řádek klipu v řádku hledání (> 860 px výšky) | +26 | – | **12 / 14** | rezerva |
| 07 vloženo: patička 3 → 1 řádek | +~60 | 4 / 6 → **5 / 8** | 6 → **7 / 9** | 07 @1040 ≥ 7 ✔ |
| 08, 12 (stejná patička) | +~60 | 4 / 6 → **5 / 8** | → **7 / 9** | ✔ |
| 12b druhý výrok | 0 až +30 | ≥ 5 / 8 | ≥ 8 | ✔ |
| 09 Titulky, 12c | 0 | 5 / 7, 6 / 8 | beze změny | ✔ |
| ⤢ zvětšený panel | celé okno | **~25** (odhad) | **~35** (odhad) | ≥ 20 ✔ |
| ▾, štítek Projektu, C9, C11, toast 9:16 | 0 | – | – | ✔ |
Žádný stav se sekvencí není horší než kolo 5; 07, 08, 12 o +1 lepší. Zásady H1, H4, H6, H8, stálá poloha tlačítek, WCAG 2.5.8 (≥ 24 px).

Snímky (`team/design/shots-5/`): `916-srovnani.jpg`, `916-celyzaber-42-doporuceno.png`, `916-celyzaber-42-zony.png`, `916-celyzaber-50-stred-nedoporuceno.png`, `916-pred-stredovy-vyrez.png` (ffmpeg z `test/media/vyrez-5min.mp4` ve 43 s, celek se dvěma lidmi).

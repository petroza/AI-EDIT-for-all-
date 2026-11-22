# Návrh UX – kolo 5: vkládání z Přepisu, přesné titulky na notebooku, drobnosti + design-5 (rozvržení Přepisu)
(Uloženo vývojářem z textu agenta – UX designér, 2026-11-22. Měřeno v aplikaci 127.0.0.1:8791, projekt „rozhovor-rano.mp4“, 5min výřez, standardní přepis, 69 vět. Snímky `team/design/shots-4/`.)

## 0. Naměřeno a nalezeno
- **Metrika vět:** celé věty v seznamu pro všechny polohy posuvníku (zarovnané na řádek), **min / medián**. Výšky řádků: 1366×768 = 24 / 41 / 58 px (1 / 2 / 3 řádky textu), 1040×1100 = 26 / 44 / 62 px. Šířka obsahu seznamu 393 px (panel 408 px minus posuvník). Kontrola: kolo 4, stav 06 (211 px) = 4 / 5, tester naměřil 4.
- **Patička Přepisu:** 41 px. S varováním ⚠ (`.tr-flow` na celou šířku) 71 px. Rozpočet řádku 388 px: počet 59 + Přehrát 74 + Vložit 153.
- **Chyba související s B1:** text tlačítka se po zavření nebo otevření sekvence nepřekreslí (po zavření „Vložit do sekvence“, po otevření „Vložit do nové sekvence“, klik by zavolal `insert` uvnitř klipu). Oprava: `paintFoot()` při otevření, zavření, přepnutí sekvence a při pohybu hlavy (nejvýš 1× za 150 ms).
- **Nekonzistentní klávesa:** popisek nabízí „(,)“, ale čárka je obecné vkládání na hlavu (Premiere) a klip rozřízne. Buď čárka po výběru z Přepisu dělá totéž co tlačítko, nebo „(,)“ z popisku zmizí.
- **Text v obraze:** po zavření sekvence zůstalo okno zadokované ve Zdroji s tlačítkem „Vytvořit titulky z přepisu“, i když žádná sekvence není otevřená.

## 1. Úkol 1 (B1) – tlačítko v patičce Přepisu
### 1.1 Stavy hlavního tlačítka (rozdělené tlačítko: hlavní část + ▾)
| Stav | CZ | EN | Popisek (title) |
|---|---|---|---|
| Žádná otevřená sekvence | **Vložit do nové sekvence** | Insert into new sequence | Vytvoří novou sekvenci s tímto úsekem. |
| Sekvence otevřená, hlava uvnitř klipu | **Přidat na konec sekvence** | Add to end of sequence | Přidá úsek za poslední klip sekvence „{název}“. Nic se nerozřízne, titulky zůstanou u svých klipů. Hlava stojí uvnitř klipu ({0:07}), proto se úsek přidá na konec. Jinam ho vložíš, když hlavu postavíš na hranici klipů (↑ / ↓ na časové ose). |
| Hlava na konci sekvence (±0,5 s) | **Přidat na konec sekvence** | Add to end of sequence | Přidá úsek za poslední klip… (bez věty o hlavě) |
| Hlava na vnitřní hranici (±0,5 s) | **Vložit na hlavu · 0:19** | Insert at playhead · 0:19 | Vloží úsek na hranici klipů v 0:19. Klipy a titulky za ní se posunou o {0:19} dál. |
| Hlava na začátku (≤ 0,5 s) | **Vložit na začátek** | Insert at start | Vloží úsek před první klip. Všechno ostatní se posune o {0:19}. |
- Čas „· 0:19“ = čas hranice (přichycený). Překreslení při pohybu hlavy, změně sekvence a výběru. Hlavní část `min-width: 157px`.
- Úzký panel (container < 360 px): „Na konec“ / „Na hlavu 0:19“ / „Na začátek“ / „Nová sekvence“, celý text v popisku.

### 1.2 Do nové sekvence jedním klikem: šipka ▾ (0 px navíc)
- ▾ součást primárního tlačítka, 24×28 px, levý okraj 1 px `#6d28d9`, fialová `#7c3aed`. Popisek „Další možnosti vložení (Alt+↓)“.
- Šířka: 59 + 6 + 74 + 6 + 157 + 24 = 326 px ≤ 388 px, patička v jednom řádku (41 px).
- Menu nahoru, vpravo, 260 px, položky 28 px: Přidat na konec sekvence · Vložit na hlavu · 0:19 (šedě „hlava je uvnitř klipu“, když je uvnitř) · Vložit na začátek · ― · **Do nové sekvence…** (dialog nové sekvence s 9:16).
- Bez otevřené sekvence ▾ zůstane: „Do nové sekvence…“ + volitelně „Na konec sekvence „{název}““ pro ≤ 3 zavřené sekvence.

### 1.3 Co patička řekne po vložení (stejný řádek, 0 px)
- Vlevo místo počtu vět: „✓ Na konci · 0:19–0:38“, „✓ Vloženo na 0:19 · 0:19–0:38“, „✓ V nové sekvenci · 0:19“ (✓ `#22c55e`).
- Hlavní tlačítko se změní na **další krok** (proti dvojímu vložení): bez titulků → „Titulky z přepisu…“, titulky jsou a nový klip ne → „Doplnit titulky…“ (otevřou stávající dialog). ▾ dál nabízí vložení.
- Stav končí novým klikem na větu, Ctrl+Z nebo změnou sekvence.

## 2. Úkol 2 – notebook: texty průběhu a odhady
### 2.1 Stahování přesného modelu na pozadí – jeden prvek, stejný text v Přepisu i v Projektu
- Tenký řádek 20 px: 11,5 px `#a19fb3`, pozadí `#1f1e26`, odsazení 0 10 px, dole pruh 2 px `#8b5cf6` podle MB, bez tlačítka. V Přepisu pod `#trStatus`, v Projektu dole pod seznamem klipů.
- Jedna funkce `asrLabel()` pro oba panely (kolo 4: Projekt 7 % × Přepis „Připravuji…“). Štítek klipu: „Připravuji přepis… 0:12“ ↔ „Příprava 0:12“, „Přepisuji řeč… 45 %“ ↔ „Přepis 45 %“.
| Stav | CZ | EN |
|---|---|---|
| Stahuje se | **Připravuji přesné titulky: stahuji 420 / 1 037 MB** | Preparing accurate captions: downloading 420 / 1,037 MB |
| Žádný nový MB > 10 s | … stahuji 420 / 1 037 MB · čekám na síť 0:12 | … · waiting for network 0:12 |
| Staženo (5 s, pak zmizí) | ✓ Staženo – titulky z přepisu budou přesné | ✓ Downloaded – captions from the transcript will be accurate |
| Chyba (26 px, levý okraj 3 px `#f59e0b`) | Přesné titulky se nestáhly – zkontroluj internet. [Zkusit znovu] | Accurate captions could not be downloaded – check the internet. [Try again] |
- Popisek: „Jen poprvé, asi 1 GB. Počítač to nezdržuje, můžeš pracovat. Titulky z přepisu pak přepíšou použité úseky přesně.“ Čísla CZ „1 037“, EN „1,037“. „minule …“ jen u přípravy uloženého modelu, nikdy během stahování.

### 2.2 Dialog „Titulky z přepisu“ (notebook)
`#cfMsg` 420 px, `min-height` **72 px** (řádek 1 `#ecebf3`, řádek 2 šedě, 3 px na pruh).
| Stav | Řádek 1 | Řádek 2 (šedě) |
|---|---|---|
| Model stažený | **Titulky se přepíšou přesně – asi 30 s.** | Přesně se přepíše jen 0:19 použitých úseků (2 úseky z klipu …). Přepis v záložce Přepis zůstane standardní. |
| Stahování běží | **Titulky se přepíšou přesně – asi 1 min 40 s.** | Nejdřív se dostáhne 420 / 1 037 MB (asi 1 min 10 s, jen poprvé), pak přepis úseků asi 30 s. |
| Nestaženo, nestahuje se | **Titulky se přepíšou přesně – asi 2 min 30 s.** | Poprvé se stáhne asi 1 GB (asi 2 min), pak přepis úseků asi 30 s. |
| Doplnění (druhý výrok) | **Doplní se titulky úseku bez titulků (1) – přepíše se přesně, asi 20 s.** | Hotové titulky (10) i tvoje opravy zůstanou. Vrátíš to Ctrl+Z. |
| Slabý počítač | **Titulky vzniknou ze standardního přepisu.** | Na tomto počítači přesný nejde – zkontroluj je, bývá v nich víc chyb. |
- Zaokrouhlení: do 45 s „asi N s“ (po 10 s), 45–75 s „asi minutu“, do 2 min „asi 1 min N0 s“, nad 2 min celé minuty.
- Průběh (dialog otevřený, řádek 1 se mění, pruh 3 px): „Stahuji pro přesné titulky: 640 / 1 037 MB · pak asi 30 s“ → „Připravuji přesný přepis… 0:06“ → „Přepisuji úseky přesně… 40 % · zbývá asi 20 s“. Tlačítka [Zrušit] a sekundární „Skrýt – dokončí se samo“. Po skrytí stejný text v záložce Titulky a ve stavovém řádku. Hotovo: dialog zavřít, záložka Titulky, toast „Titulky hotové (10) – z přesného přepisu. …“.
- Chyby: „Přesný přepis úseků se nepodařil – počítači došla paměť. Zavři jiné karty a zkus to znovu.“ [Zkusit znovu]; bez stažení „Přesné titulky se nestáhly.“ [Zkusit znovu] + odkaz „Vytvořit ze standardního přepisu (víc chyb)“.

### 2.3 Menu ≡ a pravý klik: „Přepsat přesněji“
- Položka „Přepsat přesněji celý klip…“; pod ní šedý řádek: nestaženo „stažení ~2 min (jen poprvé) + přepis ~4 min“, staženo „přepis ~4 min“, během stahování „dostahuje se ~1 min + přepis ~4 min“.
- Dialog, 1. odstavec: „Přesný přepis celého klipu: stažení asi 2 min (jen poprvé, asi 1 GB) + přepis asi 4 min. Mezitím můžeš normálně pracovat.“ + „Na titulky to potřeba není – Titulky z přepisu přepíšou přesně jen použité úseky (asi 30 s).“
- Popisek počtu vět / hledání: „Standardní přepis – celý klip přesněji: menu ≡ → Přepsat přesněji. Na titulky to není potřeba.“

### 2.4 Patička Titulků, když opravu nejde propsat do standardního Přepisu
- „Opraveno: 2 titulky · jen v titulcích“; popisek „Titulky jsou z přesného přepisu úseků. Přepis klipu zůstal standardní, proto se do něj opravy nepropíšou.“ Smíšeně „Opraveno: 3 · 1 i v přepisu klipu, 2 jen v titulcích“.
- Pozor: žlutý box „Nahradit titulky“ tvrdí „opravy zůstanou, protože se ukládají i do přepisu“ – na notebooku platí, jen když se opravy uloží k přesnému úseku (doporučeno); jinak „Tvoje opravy (2) se ztratí – Přepis klipu je standardní.“

## 3. Úkol 4 – drobnosti
- **4.1 Automatický přepis vypnutý:** Program/karta/nápověda „Přepis spustíš: pravý klik na klip → Přepsat řeč. Výrok pak najdeš v záložce Přepis…“; prázdný Přepis „Importuj video. Přepis pak spustíš tlačítkem Přepsat řeč – v tomto počítači, bez AI.“; klip bez přepisu „Automatický přepis je vypnutý. …“ [Přepsat řeč] ☐ Automaticky přepisovat nová videa.
- **4.2 Nápověda v editaci titulku:** běžně „Enter uloží a další · Esc zruší · Ctrl+A, Delete smaže titulek“; celý text označený „Delete smaže celý titulek · Esc zruší“ (žlutě); prázdné pole „Prázdný titulek – Enter nebo Delete ho smaže, Esc vrátí text“.
- **4.3 Text v obraze:** záložka trvale v hlavičce Zdroje, kdykoli je otevřená sekvence, bez ×, ~110 px; bez sekvence skrýt a rám vrátit na Zdroj; Okno → Text v obraze otevře a aktivuje.
- **4.4 Export:** „Ukládání zrušeno – video se neuložilo. Klikni na Exportovat a vyber místo.“ (`#a19fb3`, ne červeně), pruh na 0, fokus na Exportovat.
- **4.5 Řádek „nepřepsáno“ (B6):** mřížka jako věta, výška 24 / 26 px, `nowrap`; čas ♪ `#8e8e8e`, text „0:00–0:08 nepřepsáno (hudba / možná řeč)“, vpravo ▶ 24×24; kurzíva 12 px, levý okraj 3 px čárkovaný `#5a5a5a`, šrafované pozadí; popisek „Rozpoznávání tu slyšelo jen hudbu, nebo si vymyslelo text („…“) – proto je vynechaný. Může tu být řeč: klikni a poslechni si to.“; klik přehraje s→e (▶ → ❚❚, druhý klik zastaví); nemění výběr, nepočítá se do vět, ↑/↓ přeskakují; každý vynechaný úsek ≥ 1 s; „vynecháno 2“ zmizí.

## 4. design-5 (kolo 6, bez implementace) – rozvržení Přepisu
| Varianta | 1366×768 | 1040×1100 | Cena |
|---|---|---|---|
| Kolo 4 (nabídka + varování) | 211 px → 4 / 5 | 302 px → 5 / 8 | – |
| Kolo 5 bez nabídky | 244 px → 5 / 7 | 335 px → 6 / 8 | – |
| **(a) Přepis zabere místo prázdné osy** (bez sekvence) | panel 1030 px, všech 69 vět na 1 řádek → **10 / 10** (s varováním v řádku patičky 11) | panel 704 px → 11 / 12 | jen do prvního vložení |
| (b) Výška monitorů podle poměru videa | +0 px (16:9 omezené výškou) | +148 px → 10 / 13 bez sekvence; 9:16 +0 | menší náhled 9:16 – vlastník nechce |
| (c) Ikona ⤢ (klávesa `) | 23 | 33 | skrývá náhled i osu |
**Doporučuji (a)** + ⤢ jako doplněk. Specifikace (a): spouštěč `!app.seq()`; `#projectPanel` šířka `bottomRow − 300 px` (min 410), `#toolsPanel` skrýt, osa 300 px s textem „Sekvence zatím není. Vyber v Přepisu větu → Vložit do nové sekvence.“; text věty `max-width: 760px`; varování v řádku patičky při containeru ≥ 700 px; přechod 150 ms, první vybraná věta na stejném y.

## 5. Co se mění v rámu Přepisu (px)
| Změna | px v rámu | 1366×768 | 1040×1100 | OK |
|---|---|---|---|---|
| Řádek nabídky zmizí | +28 | 4 / 5 → 5 / 7 | 5 / 8 → 6 / 8 | ✔ |
| Tenký řádek stahování (první ~2 min) | −20 | 5 / 6 | 6 / 8 | ✔ |
| Chyba stahování (26 px) | −26 | 5 / 6 | 6 / 8 | ✔ |
| B1 ▾ + stav po vložení | 0 | – | – | ✔ |
| Výběr bez varování | +30 proti varování | 5 / 7 | 7 / 9 | ✔ |
| Řádek „nepřepsáno“ | 0 v rámu | −1 věta jen u 0:00 a konce | totéž | ✔ |
| design-5 (a) | šířka 410 → 1030 / 704 | 10 / 10 | 11 / 12 | kolo 6 |
| design-5 (c) | 0 | 23 po kliknutí | 33 | kolo 6 |
Zásady: H1 (čekání s měnícím se číslem), H3/H5 (z Přepisu se nic nerozřízne, Zpět jedním krokem), H4 (jedna funkce pro oba panely), H6 (další krok v patičce), stálá poloha cílů, WCAG 2.5.8 (cíle ≥ 24 px).

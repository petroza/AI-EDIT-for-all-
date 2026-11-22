# Návrh UX – kolo 2: Seznam titulků, rozvržení bez AI, Text v obraze ukotvený, přesnost přepisu
(Uloženo vývojářem z textu agenta – UX designér, 2026-11-21. Aplikaci neotevíral; četl kód a snímky.)

## 0. Shrnutí
- **Titulky = třetí záložka v levém dolním rámu: `Projekt | Přepis | Titulky`** (jako panel Text v Premiere). Program nic nezakrývá.
  Řádek: čas + text rozdělený na řádky jako v obraze.
- **Oprava v řádku:** klik do textu = psaní; Enter uloží a otevře další, Esc zruší, ↑/↓ uloží a přejdou. Oprava do titulku i přepisu = jeden krok Zpět.
- **Bez AI je AI panel sbalený do pruhu 36 px s „✦ AI“** – při 1366×768 osa 944 px = 69 % okna.
- **Text v obraze = záložka v rámu Zdroje: `Zdroj | Text v obraze ×`** – monitory ani export nikdy nepřekryje.
- „Přepis“ na kartě, klik na štítek u klipu i první import otevřou klip ve Zdroji a jeho přepis.
- Volba přesnosti, auto přepis a „Přepsat přesněji…“ do menu ≡ záložky Přepis.
Zásady: H1, H3, H5 (ukázat rozdělení před uložením), H6 (tip na místě), H8, WCAG 2.5.8.

## 1. Seznam titulků (úkol 2)
### 1.1 Kde
- `[Projekt: Bez názvu] [Přepis 45 %] [Titulky] ≡`; `#tabCap` 28 px jako Přepis; `#tabProj` max-width 40 %.
- Titulky vidět vždy (i desktop). **Samy se přepnou** po „Vytvořit/Nahradit titulky“ (fokus na první řádek, bez psaní).
- „Upravit titulek pod přehrávací hlavou“ a **F2** → záložka Titulky + psaní v řádku pod hlavou; bez titulků dialog Titulky z přepisu.
- Ctrl+F v Titulkách → Přepis + hledání. Volba záložky `pzProjTab` = project / tr / cap.
### 1.2 Obsah
a) řádek sekvence 26 px: název, vpravo dim `13 titulků · 0:20`; b) `.cap-list` (flex 1, scroll, tabindex 0); c) patička 40 px. Vždy aktivní sekvence.
### 1.3 Řádek
Grid `44px 1fr 24px`, gap 8, padding 4/10/4/7, levý okraj 3 px, min 26 px. Čas `0:02` 11 px #8e8e8e; text 12,5/1,45 #d6d6d6 `pre-line`;
▶ 24×24 (jen fokus/hover/psaní, „Přehrát titulek (Ctrl+mezerník)“). Stavy: hover #262626; hraje: okraj #8e8e8e, text #fff (drží viditelný);
aktivní/upravovaný #372c51 + okraj #8b5cf6 + čas #c4b5fd; fokus outline 2 px #a78bfa; po Zpět/Znovu odrolovat a 1 s bliknout. Nejistá slova nezvýrazňovat.
### 1.4 Psaní
- Klik do textu = hlava na titulek (start + 0,05), pole s kurzorem v místě kliku; klik na čas jen posune hlavu. Enter/F2 = psaní s kurzorem na konci.
- Pole: textarea auto výška, bez ručních zalomení, #161616, okraj #a78bfa, rohy 3, padding 3/6, 12,5 #ecebf3, spellcheck off.
- Živý náhled v Programu (bez kroku Zpět do uložení).
- Pod polem 11 px: `Enter uloží a další · Esc zruší` (#a19fb3) / nevejde se: `Nevejde se do 2 řádků – rozdělí se na 2 titulky` (#fcd34d).
- Klávesy (stopPropagation): **Enter** uložit + psát v dalším (po rozdělení za oběma polovinami; na posledním ukončit, patička „konec“);
  **↑/↓** uložit + předchozí/další; **Esc** zrušit (druhé Esc fokus na osu); **Ctrl+mezerník** přehrát; Ctrl+Z/Y nativně v poli;
  opuštění pole = uložit (nikdy ztráta; když selže, toast). Beze změny = žádné uložení ani krok Zpět (celý seznam jde projít Enterem).
- Bez psaní: ↑/↓ předchozí/další (hlava, bez přehrávání), Enter/F2 psát, mezerník přehrát titulek, Home/End.
### 1.5 Uložení, přepis, Zpět
- Jedna oprava = jeden krok Zpět „Oprava titulku“ (titulek, rozdělení i zápis do přepisu). Ctrl+Z/Y mimo pole všude stejně.
- Stejnou cestou i oprava z Programového monitoru.
- Rozdělení: obě poloviny hned jako 2 řádky, 1,5 s bliknou; pod druhou `.tr-flow`: „Text se nevešel do 2 řádků – je teď ve 2 titulcích. Zpět vrátíš Ctrl+Z.“
### 1.6 Patička (40 px)
- Bez oprav: tip „Klikni do textu titulku a oprav ho. Enter uloží a skočí na další, Esc zruší, ↑ ↓ předchozí / další.“ + [Vzhled…] (otevře Text v obraze).
- Po opravách: „Opraveno: 3 titulky · opravy platí i v přepisu klipu“ + [Vzhled…]. Konec: „Konec titulků · opraveno: 7. Hotovo? Exportuj (Ctrl+M).“
- Nepropsáno do přepisu: „Uloženo jen v titulku – v přepisu klipu se tahle slova nenašla.“ (#fcd34d). Číslovky 1 / 2–4 / 5+.
### 1.7 Prázdné stavy
Bez sekvence: „Titulky patří k sekvenci“ / „Nejdřív vlož úsek do sekvence – třeba kliknutím na větu v záložce Přepis.“ [Otevřít Přepis].
Bez titulků: „Sekvence zatím nemá titulky“ / „Vzniknou z přepisu – jen ze slov, která v sekvenci zazní. Bez AI.“ **[Vytvořit titulky z přepisu]**
(desktop: „Titulky vytvoří AI panel (rychlá akce Titulky).“). Čekání: „Titulky čekají na přepis – 40 %“ + průběh + „Objeví se tu samy…“.
Bez zvuku: „Sekvence nemá klipy se zvukem“ / „Titulky není z čeho vytvořit.“
### 1.8 Navazující texty
Toast „Titulky hotové (13). Zkontroluj je v záložce Titulky – Enter uloží a skočí na další.“; patička Textu v obraze „Text titulků opravíš
v záložce Titulky (vedle Přepisu) nebo kliknutím na titulek v obraze.“; title titulku v Programu „Klikni a oprav text titulku“; varování
v dialogu (až opravy opravdu přežijí): „…Vytvoří se znovu z přepisu – tvoje opravy textu zůstanou, protože se ukládají i do přepisu…“;
nápověda „…Pak je zkontroluj v záložce Titulky…“.

## 2. Rozvržení (úkol 3)
### 2.1 AI panel bez AI: pruh 36 px
`#aiPanel.collapsed` 36 px, #17161c, okraj #000; iframe skrytý (nenačítá se znovu); `#aiSplit` skrytý. Tlačítko 28×52 (✦ 16 px #a78bfa nad „AI“
11/600 #ecebf3, #26252f, okraj #34323f, hover #8b5cf6), pod ním tečka 8 px: #f87171 nepřipojená / #22c55e připojená / #fbbf24 pulz pracuje.
Title „Otevřít panel AI (F4) – AI není připojená“ apod. V hlavičce iframe „»“ 24×24 „Sbalit panel AI (F4)“. „✦ AI“ v liště a F4 přepínají
otevřeno/sbaleno. `settings.aiPanel` = open/collapsed jen po kliku; bez volby: nepřipojená → sbaleno, připojení → otevřít; sbalil-li sám,
zůstane sbaleno (zelená tečka). `aiHidden` → collapsed.
Šířky 1366×768 bez AI: osa 948 px = 69 %; po prvním vložení přiblížit s 5% okrajem → 20s úsek ~90 % plochy. „\“ přes e.code Backslash.
### 2.2 Text v obraze – záložka v rámu Zdroje (ukotvit, ne schovávat)
`[Zdroj: rozhovor.mp4] [Text v obraze ×]`; × 24×24 „Zavřít Text v obraze“. Otevření (Aa, Sekvence → Titulky → Styl…, klik na nadpis, AI panel,
[Vzhled…]) aktivuje záložku. Návrat na Zdroj: klik na Zdroj, dvojklik na klip, klik na větu. Aktivní záložka schová monitor/lištu/scrub/transport Zdroje.
Obsah = dnešní `.capstyle` bez plovoucí hlavičky, static, #1f1e26, scroll; nahoře „Sekvence: …“; grid `repeat(auto-fit, minmax(280px, 1fr))`
gap 16 (Nadpis nahoře | Titulky), patička Výchozí přes celou šířku. Esc → fokus na Program (nezavře). Export a přepnutí záložky dokončí úpravu.
Nový projekt zavře bez uložení. Pole nadpisu `autocomplete="off"`, placeholder „Např. Starostka: Most bude hotový v létě“.
### 2.3 Přepis vždy ukáže konkrétní klip
Štítek u klipu = tlačítko (otevřít ve Zdroji + Přepis), klikací plocha 24 px, title „Zobrazit přepis“; v seznamu totéž u „· přepis 45 %“.
„Přepis“ na kartě: klip ve Zdroji → jediný → vybraný → naposledy importovaný. První import do prázdného projektu sám otevře klip a Přepis
(jednou za projekt). Další importy nepřepínají (kromě prázdného stavu bez klipu).
### 2.4 Patička Přepisu v malém okně
≥ 360 px jeden řádek 40 px; < 360 px dva řádky: `6 vět · 0:20` · ▶ ikona 28×28 / [Vložit do (nové) sekvence] přes celou šířku 28 px (74 px).
`.tr-foot { flex: none }`, `#bottomRow` min-height 220 px; zmenšuje se seznam, ne patička. Kontrola: trFoot.bottom ≤ innerHeight − 22.
### 2.5 Desktop
Ano: pruh AI, Text v obraze jako záložka, Titulky (opravy jen v titulcích). Ne: Přepis a volba přesnosti.

## 3. Texty pro úkol 1
### 3.1 Volba přesnosti
Menu ≡ Přepisu: `✓ Automaticky přepisovat nová videa` / Přesnost přepisu: `Přesné – méně chyb, trvá déle` / `Standardní – rychlejší` /
`Přepsat přesněji…` (jen u standardního) / `Přepsat znovu…`. AI panel select „Přesné – méně chyb“ / „Standardní – rychlejší“.
Řádek klipu: `412 vět · přesný přepis` / `· standardní přepis`; title štítku „Přepis hotový (přesný)“.
### 3.2 První stažení
„Stahuji rozpoznávání řeči… 210 / 600 MB“ · jen jednou, pak už se nestahuje [Zastavit]; „Připravuji rozpoznávání řeči…“ · chvilku;
velikost pod 1000 MB po 10 MB, od 1000 „asi 1,2 GB“.
### 3.3 „Přepsat přesněji…“
Dialog „Přepsat přesněji?“: „Přesný přepis dělá méně chyb, ale trvá déle – u tohoto klipu (28 min) asi 10 min.“; „Dosavadní přepis platí,
dokud nebude nový – dál v něm můžeš hledat. Titulky v sekvencích se nezmění.“; „Poprvé se stáhne asi 600 MB – jen jednou.“; [Zrušit] [Přepsat přesněji].
Běh: „Přepisuji přesněji… 45 %“ · zbývá asi 6 min · zatím platí dosavadní přepis; zastaveno: „Přesný přepis zastaven“; toast „Přesný přepis hotový…
Titulky se nezměnily – nové vytvoříš přes Vytvořit znovu z přepisu.“
### 3.4 Bez vhodné grafiky
„Na tomto počítači jde jen standardní přepis – přesný potřebuje výkonnější grafickou kartu.“; menu „Přesné – na tomto počítači nejde“ (neaktivní);
toast „Přesný přepis tu nejde – přepisuji standardně.“

## 4. Hodnoty
Barvy z aplikace (primární #7c3aed/#6d28d9, akcent #8b5cf6, fokus #a78bfa, vybraný #372c51, čas #c4b5fd, varování #372c1b/#f59e0b/#fcd34d,
chyba #f87171, AI pruh #17161c/#26252f/#34323f). Kontrasty spočítané (vše ≥ 4,5, okraj pole ≥ 3). Rozměry: pruh 36, tlačítko 28×52, záložky 28,
× 24, řádek ≥ 26, ▶ 24, patička 40/74, štítek 18 (plocha 24), menu 27, bottomRow min 220.

## 5. Otevřené body
1. „Přepsat přesněji“ vs. opravy v přepisu: ukládat opravy zvlášť (úsek času → text) a přenést do nového přepisu.
2. „Další“ titulek po rozdělení (index + počet nových). 3. Původ příkladu „Ze Snídaně…“ (našeptávač / starý s.title).
4. Pruh AI na desktopu – stav připojení z iframe. 5. ↓ v Programu dál na další střih (chování Premiere).

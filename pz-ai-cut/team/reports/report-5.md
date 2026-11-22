# Report testera – kolo 5 (PZ AI Cut, 127.0.0.1:8791)
(Uloženo vývojářem z textu agenta.)

**Verze:** Na začátku testu (průzkum DOM, asi 05:25) běžela `app.js?v=mwrc8zdt`. V 05:46 vývojář nasadil **mwrctz0d** (oprava `trCapNext` po redaktorovi-5). Všechna měření níže jsou z **mwrctz0d**, pokud není napsáno jinak.

**Prostředí:** vlastní headless Chrome (porty 9401–9460, profily v %TEMP%, na konci ukončeny a smazány); ovládání skutečnou myší a klávesnicí přes CDP `Input.*` (klik, Shift+klik, Ctrl+Z/Y, Ctrl+A, Delete, ↑, Esc); import `__pzDevImport`; u stanice vložen přesný přepis do úložiště (jako `test/b1.js`); export `__pzDevExport`; rozhodčí faster-whisper large-v3 (GPU), těžké přepisy vždy po jednom. Vlastní skripty ve scratchpadu (`nb5t.js` = kopie notebook5.js + ukládá přepisy a časy, `tb1.js`, `tsmall.js`, `tcases.js`, `capcheck.py`, `manual8.py`, `ceiling.py`), kód projektu neměněn.

**Seedy krajů zvolené před měřením:** přesný přepis **2718 a 6174**, standardní výřez **1729 a 8128**, každý 14 náhodných výroků.

---

## Co se mi líbilo
- **B1 opravené i při „lidském“ ovládání:** hlava na hranici klávesou ↑, „Vložit na začátek“ z ▾, hlava uvnitř klipu, nová sekvence přes ▾ při otevřené sekvenci – klip se nikdy nerozřízl, titulky jezdí se svým klipem (±0,04 s), Ctrl+Z/Y po jednom kroku.
- **Popisky tlačítka říkají, co se stane:** „Přidat na konec sekvence“, „Vložit na hlavu · 0:16“; bublina „Hlava stojí uvnitř klipu… (↑ / ↓ na časové ose)“; po vložení „✓ Vloženo na 0:16 · 0:16–0:36“ a „Doplnit titulky…“.
- **Titulky z přesných úseků rychlé a přesné:** 16,7 s (8 CPU), 25,1 s (4 CPU); průběh „Přepisuji úseky přesně… 6 s z asi 17 s“ se mění po 3 s; výrok redaktora začíná „A zjistilo se to…“ bez „dále.“; 9/9 titulků na své řeči, WER proti rozhodčímu 4,1 %.
- **Dialog titulků poctivý i při prvním stažení:** „asi 2 min. Nejdřív se dostáhne 95 / 1 035 MB (asi 1 min 50 s, jen poprvé), pak přepis úseků asi 10 s“ – skutečnost 116 s / 114,7 s (−4 %).
- **Řádek stahování** „Připravuji přesné titulky: stahuji 568 / 1 035 MB“ v Přepisu a Projektu shodný ve všech vzorcích (0/142, 0/174).
- **Drobnosti úkolu 4 fungují:** Ctrl+A → Delete s „Vrátit“, Esc v uložení, řádky „nepřepsáno“, záložka Text v obraze, automatický přepis do 1 s.
- Nové texty mají anglickou verzi („Add to end of sequence“, „Insert at playhead – …“, „Add captions“).

## Co se mi nelíbilo / zdrželo (váha 1–3)
1. **(3) Varování krajů skoro nepokrývá chyby:** nové seedy – špatné konce 10, varovaný 0; špatné začátky 9, varované 2; planých varování stanice 9, notebook 7 (cíl ≤ 3). B2a, B3a, B4a, B4b, B4d dál ✘.
2. **(3) Titulek se slovem, které v klipu nezazní:** B4a „Já se taky moc těším.“ (zazní „-ším“, ⚠), B4b „obrečela, hodně…“ (⚠), B4d konec „Jo, vím přesně,“ (zazní „Jo, vím p-“), 2718 N4 konec „že“ (útržek, bez varování).
3. **(2) „Přepsat přesněji celý klip“ (8 CPU):** odhad „asi 5 min“, skutečnost **3:20** (−33 %); procenta skáčou po ~8 % každých ~15 s, prvních ~20 s „0 % · odhaduji čas…“ (~12 intervalů > 10 s).
4. **(2) Projekt během prvního stahování standardního modelu:** štítek 30 s „Příprava… – klikni pro přepis“ bez MB (Přepis „Stahuji… 74 z 240 MB“); na 4 CPU „Přepisuji řeč… 79 %“ 11,7 s a „86 %“ 13,9 s; „klikni pro přepis“ zavádí, když přepis běží.
5. **(2) Stav 07 při 1040×1100: 6 vět místo 7** (kolo 4); také 08 a 12 (4/6).
6. **(1–2) „✓ Staženo – titulky z přepisu budou přesné“ v Přepisu dvakrát pod sebou** během standardního přepisu (`nb/nb4-31-menu-postaen.png`).
7. **(1) „Text v obraze“ chybí v menu Okno** (tasks-4 4.3).
8. **(1) Patička „Smazán titulek … Vrátit“ zůstává po Ctrl+Z**; „Vrátit“ pak nic nedělá; zůstala i přes druhý výrok (12c).
9. **(1) Menu ▾ s hlavou na konci sekvence** píše „Vložit na hlavu – hlava je uvnitř klipu“.
10. **(1) Nesoulady čísel:** dialog „asi 20 s“ × průběh „z asi 17 s“; patička „✓ V nové sekvenci · 0:00–0:15“ × sekvence 00:00:16:00.
11. **(1–2) 0,6 s celku na začátku V5 v 9:16** – Auto Reframe rozřízne na střihu kamery (20:00,3), blikne jiný záběr (redaktor-5: 1,2 s).

## Chyby s kroky k zopakování
- **C1 (opraveno v mwrctz0d):** #317–#320 → Vložit do nové sekvence → OK → „Titulky z přepisu…“ nic (dvě `id="trNext"`); snímek `shots-5/b1-bug-titulky-tlacitko.png`. Na mwrctz0d 6/6 ✔.
- **C2 – B4a:** přesný přepis, #14 → Shift+#16 → Vložit → Titulky: In 50,095, první titulek „Já se taky moc těším.“, zazní jen „-ším“ (úzké okno „Těším,@50,09 hele…“, široké „těším.@49,98“), ⚠.
- **C3 – B4b:** jen #247 → In 928,518, titulek „obrečela, hodně se mi nechtělo ze snídaně“, „obrečela“ skončila před In (široké okno 927,36), ⚠.
- **C4 – B4d:** jen #24 → Out 97,81, poslední titulek „Jo, vím přesně,“, zazní „Jo, vím p-“, ⚠ konec.
- **C5 – B2a:** #4–#6 → In 21,295, titulek „na tom místě“; zazní „(se)dívává“ (RMS ticho −0,10…+0,12 s, řeč od +0,15 s), bez varování.
- **C6 – B3a:** #131 → In 500,18, útržek „-ce,“ z „práce,“ (~0,13 s), bez varování.
- **C7 – slovenská diakritika na notebooku:** standardní výřez, `__pzAsrSlow`, 8 CPU, věta #20 → první titulek z přesného úseku „Což je prostě věc, o který já jsem **do Posavať**“.
- **C8 – menu Okno bez „Text v obraze“** (`u4/08-menu-okno.png`).
- **C9 – stará patička:** Titulky → Ctrl+A, Delete → Ctrl+Z → titulek zpět (7), patička dál „Smazán titulek … Vrátit“ (`u4/15-…`, `16-…`).
- **C10 – ▾ na konci sekvence:** hlava 16,32 = konec → šedá „Vložit na hlavu – hlava je uvnitř klipu“ (`b1/b1-04-menu-sipka-R.png`).
- **C11 – dvojitý řádek „✓ Staženo“** v Přepisu během standardního přepisu.
- **C12 – nepřehrání řádku 0:00 (nejisté):** hned po importu první klik nespustil přehrávání; v nové relaci přehrává 1,3 → 8,4 s; neopakovatelné (1).

## 1. B1 (`shots-5/b1/`, `b1.json`) – skutečnou myší a klávesami
| krok | výsledek |
|---|---|
| V5 → nová sekvence → Titulky z přepisu (patička) | 7 titulků, hlava 16,32 → 16,32 ✔ |
| R (#363–369), hlava na konci → „Přidat na konec sekvence“ | R od 16,32, titulky V5 beze změny ✔; Doplnit 7 → 16 ✔ |
| ↑ přesune hlavu 33,64 → 16,32 | ✔ |
| V2 (#412–415) → „Vložit na hlavu · 0:16“ | V2 na 16,32, R +19,88 s, titulky R přesně +19,88 (±0,04) ✔, 0 titulků přes V2 ✔ |
| Doplnit titulky | 16 → 25, V2 dostal 9 ✔ |
| Ctrl+Z, Ctrl+Z, Ctrl+Y, Ctrl+Y | 25 → 16, vložení pryč, zpět 3 klipy, pak 25 ✔ |
| hlava uvnitř klipu (7,28) | „Přidat na konec sekvence“ + bublina, vloženo na 36,2 ✔ |
| ▾ → „Vložit na začátek“ | 25 titulků posunuto přesně o 5,24 s ✔, Ctrl+Z ✔ |
| ▾ → „Do nové sekvence…“ při otevřené sekvenci | „rozhovor 2“, původní nedotčena ✔ |
| zvukové klipy < 1 s | žádný ✔ |
| export 3 výroků (53,5 s) + faster-whisper | **25/25 titulků na vlastní řeči** ✔ (`b1/capcheck-3.json`) |
| export 2 výroků (36,2 s) | **16/16** ✔ |
Poznámka: přesný přepis v titulcích vynechává výplňová slova („vlastně“, „prostě“).

## 2. Notebook (čistý profil, `__pzAsrSlow`, 5min výřez)
| | 8 CPU | 4 CPU | vývojář |
|---|---|---|---|
| auto přepis | do 1 s | ✔ | do 2 s |
| standardní přepis hotový | 152,1 s | 188,8 s | 149 / 193 s |
| přesný model stažený (1 035 MB) | 144,7 s | 145,0 s | 144,7 s |
| odhad dialogu | „asi 20 s“ | „asi 30 s“ | |
| klik → titulky | **16,7 s** (+20 %) | **25,1 s** (+20 %) | 16,7 / 27,7 s |
| **import → MP4 skriptem** | **3:01** | **3:47** | 2:57 / 3:51 |
| > 10 s bez změny čísla, Přepis celkem | **0** | **0** | 0 / 2 |
| jen řádek stavu „Přepisuji řeč… N %“ | 4× (10,6–10,7 s) | 7× (11,9–15,0 s) | – |
| Projekt (štítek klipu) | 1× („Příprava…“ 30,9 s) | 3× (30 / 11,7 / 13,9 s) | – |
| Projekt × Přepis, řádek stahování | 0/142 | 0/174 | 1/180 |
| „Přepsat přesněji celý klip“ | odhad ~5 min, **skutečnost 3:20** (−33 %) | ~6 min (neměřeno) | neměřeno |
| rozdělený odhad v menu | neviděl (stažení skončilo dřív než standardní přepis) | | |
**Titulky (9):** z přesného úseku WER **4,1 %** („ji→jí“, navíc „my“); přesný přepis celého klipu 8,2 %; standardní ~18–20 %. Kritérium ≤ +2 p. b. ✔. 0 slov ť/ľ/ô/ä pro tento výrok ✔, jinde ✘ (C7). K poslechu: „jí hospitalizovali“, „rozvěděli“, „jak my jsme“.
Standardní přepis výřezu obsahově shodný s kolem 4 (WER 24,5 %, „bolesť“, „veľmi“) – konzistentní s tím, že čeština už byla nastavená.

## 3. Kraje titulků
**Stanice** (přesný přepis, `edges.js`): 2718 10/14 začátků, 11/14 konců; 6174 13/14, 9/14; **celkem 23/28 (82 %), 20/28 (71 %)**, pojmenované 6/6 ✔✔; po ručním odečtení omylů rozhodčího ~24/28, 23/28.
**Notebook** (`edges-web.js --cpu 8 --slow`, standardní výřez, přesné úseky): 1729 12/14, 14/14; 8128 12/14, 12/14; **celkem 24/28 (86 %), 26/28 (93 %)** (sady sdílejí 5 výroků; V1 In 15,79 ✘ v obou – známý hraniční).
**Varování:** špatné začátky 9 → varované 2; špatné konce 10 → 0; planá stanice 9, notebook 7. Cíl 3.3 ✘.
| případ | In/Out | 1./posl. titulek | co zazní | varování | verdikt |
|---|---|---|---|---|---|
| B2a #4–6 (stanice) | In 21,30 | „na tom místě…“ | „(se)dívává na tom místě“ | – | ✘ |
| B2b std #28 (notebook) | In 119,71 | „My jsme vlastně…“ | „My jsme“ | – | ✔ opraveno |
| B3a #131 (stanice) | In 500,18 | „Protože…“ | útržek „-ce,“ | – | ✘ |
| B3b std #20 (notebook) | In 81,54 | „Což je prostě věc… do Posavať“ | „což je prostě“ | – | titulek sedí, In v předchozí větě; „ť“ ✘ |
| B4a #14–16 | In 50,10 | „Já se taky moc těším.“ | jen „-ším“ | ⚠ | ✘ |
| B4b #247 | In 928,52 | „obrečela, hodně…“ | „-ně se mi…“ | ⚠ | ✘ |
| B4c #3 | In 16,52 | „Velmi často…“ | útržek „-ná“ | ⚠ | ✔ |
| B4d #24 | Out 97,81 | „Jo, vím přesně,“ | „Jo, vím p-“ | ⚠ konec | ✘ (varováno) |
| B5 #103 | Out 405,15 | „…Já jsem“ | překrývající řeč | ⚠ oba | ✔ |
| R 23:20, V1–V5, „dále.“ | – | – | – | – | ✔✔ |
**8 krajů ručně** (RMS po 25 ms ±0,5 s, široké okno 3,5 s, úzké od střihu; `kraje/manual8.txt`): rozhodčí pravdu 4/8 (2718 N10 In 340,79 útržek „-vec“ bez varování; N8 In 1264,78 „-č“ varováno; 6174 N2 In 1211,58 titulek „A“ v tichu; 2718 N4 Out 1359,97 „že“ útržek bez varování), mýlil se 4/8 (N14 In 26,10 konec „Kristýnku“ < 40 ms, titulek „Tak“ správně; 6174 N10 Out 163,82 úzké okno ztratilo „jako není“; N13 Out 1081,19 tichá druhá replika + halucinace „www.hradeckralove.org“; N9 Out 301,25 „No, jo“ → „stuď“).
**Strop shody rozhodčího sám se sebou** (32 výroků, `kraje/ceiling-stanice.json`): okno +80 ms 29/32, 28/32; −40 ms 28/32, 29/32; beam 1 30/32, 30/32 → **~88–94 % (≈ 25–26/28)**, ne ~80 %. Posun o 40 ms převrátí N14, N10, N8 (útržky 40–150 ms). Cíl ≥ 22/28 je reálný.

## 4. Drobnosti (`shots-5/u4/`)
| bod | výsledek |
|---|---|
| auto přepis | `auto: true`, start do 1 s ✔ |
| texty vypnuto / zapnuto | ✔ / ✔ |
| migrace staré hodnoty | netestováno |
| Delete v titulku | Ctrl+A, Delete 7 → 6, Ctrl+Z → 7 ✔; prázdné pole ✔; nápověda ✔; stará patička (C9) ✘ drobně |
| Text v obraze | záložka ✔; v menu Okno ✘ |
| Esc v uložení | simulováno AbortError + skutečná Esc: dialog zůstal ✔, druhý pokus uloží 10,9 MB ✔ |
| řádky „nepřepsáno“ | 0:00 i 28:01 ✔, konec přehraje 1682,9 → 1686,8 a zastaví ✔; 0:00 viz C12 |
| ≡ „Přepsat přesněji celý klip…“ | položka a dialog ✔; odhad −33 % ✘; rozdělený odhad neviděl |

## 5. Regrese (celé věty, 1366×768 / 1040×1100)
| stav | notebook 8 CPU (tester) | vývojář | kolo 4 | stanice |
|---|---|---|---|---|
| 04 hotovo | 6/8 | 5/8 | 5/7 | 5/9 |
| 05 hledání | 6/8 | 6/8 | 6/7 | 7/9 |
| 06 výběr + varování | 5/7 | 5/7 | 4/7 | 8/10 |
| **07 vloženo** | **4/6** ✘ | 4/6 | 4/7 | 7/9 |
| 08 dialog titulků | 4/6 | – | – | 7/9 |
| 09 titulky | 5/7 | 5/7 | 5/7 | 3/3 |
| 12 po exportu | 4/6 | – | – | 7/9 |
| 12b / 12c | 5/8 / 6/8 | 5/8 / 6/8 | – | 6/8 / 6/6 |
| 13 slabý počítač | 5/7 | 5/7 | 4/7 | 6/8 |
Hledání, seznam titulků, export ✔; slabý počítač ✔; stanice přesný výchozí ✔ (271 s vč. stažení, vývojář 260 s).

## Nápady
- Slovo, ze kterého v klipu zazní < ~40 % délky (útržek), z titulku vypustit; když před prvním slovem titulku je 50–200 ms energie řeči, varovat nebo posunout In do nejbližší pauzy uvnitř výběru (B2a, B3a, N10).
- Varování konce na stejné logice jako začátek.
- Text v obraze do menu Okno; patičku „Smazán… Vrátit“ po Ctrl+Z / další akci schovat.
- Nápovědu „↑ / ↓ = hrana klipu“ i v patičce.
- Odhad „Přepsat přesněji celý klip“ brát z naměřené rychlosti titulků z úseků (17 s na 19 s zvuku ≈ 4,5 min na 5 min; skutečnost 3:20).
- Rozhodčí kola 6: úzké okno začínat 40 ms za střihem a ✘ jen při shodě obou oken.

## Ověření tvrzení vývojáře
| tvrzení | měření testera | souhlasí? |
|---|---|---|
| B1 9/9 ✔ | ✔ klávesami + varianty; exporty 25/25, 16/16 | ano |
| import → MP4 2:57 / 3:51 | 3:01 / 3:47 | ano |
| titulky 16,7 / 27,7 s | 16,7 / 25,1 s | ano |
| odhad ±25 % | +20 % / +20 %; průběh „z asi 17 s / 27 s“ | ano (drobný nesoulad) |
| model 1 037 MB v 144,7 s | 144,7 / 145,0 s, UI „1 035 MB“ | ano |
| stuck opraveno, neměřeno | Přepis celkem 0/0 ✔; řádek stavu 4× / 7×; Projekt 1× / 3×; přesný celý klip ~12× | částečně |
| Projekt × Přepis 1/180 | 0/142, 0/174; štítek Projektu 30 s „Příprava…“ bez MB | částečně |
| 0 slov ť/ľ/ô/ä | výrok redaktora ✔; jinde „do Posavať“ | jen pro jeden výrok |
| WER 15,7 → 5,9 % | ~18–20 → 4,1 % | ano (trend) |
| WER proti přesnému celému klipu neověřeno | 4,1 % × 8,2 % | splněno |
| čeština nastavená | konzistentní | ano |
| stanice beze změny 260 s | 271 s | ano |
| Přepis 06 = 5/7, 07 @1040 = 6 ✘ | 5/7; 07, 08, 12 4/6 | ano |
| kraje notebook 23/28, 25/28 | nové seedy 24/28, 26/28 | ano |
| kraje stanice 18/28, 21/28 | nové 23/28, 20/28 (~24, ~23 po odečtení) | v rozptylu |
| strop ~80 % | 88–94 % | ne |
| B5 neděláno | B4d, B5 ⚠ konec ano; náhodné konce 0/10 | částečně |
| Ctrl+A → Delete, Ctrl+Z | ✔ | ano |
| Esc v uložení | ✔ (simulováno) | ano |
| řádky „nepřepsáno“ | ✔ (1× nepřehrálo po importu) | ano |
| Text v obraze záložka | ✔; menu Okno ✘ | částečně |
| auto přepis do 2 s | do 1 s | ano |
| oprava `trCapNext` | 6/6, žádná duplicitní id | ano |
| doplňování „N s z asi M s“ | „0/3/6… s z asi 17 s“ | ano |

## Snímky a soubory
`team/reports/shots-5/`: `b1/` (25 snímků, b1.json, capcheck-2/3.json), `b1-bug-titulky-tlacitko.png`, `nb/` (nb8-*, nb4-*, t5nb8.json, t5nb4.json, capcheck-nb8.json), `kraje/` (cases-*.json, manual8.txt, manual-B.txt, ceiling-stanice.json), `u4/` (00–16, u4.json), `rr-nb8/`, `rr-stanice/` + logy, `x-en-menu.png`, `x-en-dialog.png`.
`web/test-out/`: t5-nb-8cpu.mp4, t5-nb-4cpu.mp4, t5-b1-3vyroky.mp4, t5-b1-2vyroky.mp4, t5-nb8-standard.json, t5-nb8-accurate-full.json, t5-edges-presny-{2718,6174}.*, t5-ew-nb-{1729,8128}.json, t5-edges-nb-{1729,8128}.*, t5-edges-cache.json. Pozor: `regress.js` přepsal regress-4-8cpu.mp4, regress-4-32cpu.mp4, vyrez-5min-standard.json a vyrez-5min-accurate.json (obsahově stejné).

## Shrnutí
1. B1 opravené i při „lidském“ ovládání; exporty 16/16 a 25/25 titulků na své řeči.
2. Notebook potvrzen: 3:01 / 3:47 skriptem, titulky 16,7 / 25,1 s, odhady +20 %, WER titulků 4,1 %.
3. Průběh: Přepis bez 10s výpadku; Projekt 30 s „Příprava… – klikni pro přepis“; „Přepsat přesněji celý klip“ odhad 5 min × 3:20.
4. Kraje: stanice 23/28, 20/28; notebook 24/28, 26/28; varování 2/9 začátků, 0/10 konců, 16 planých; B2a, B3a, B4a, B4b, B4d ✘.
5. Rozhodčí: strop 88–94 %; ručně 4× omyl (útržky < 40 ms, tichá replika).
6. Nové chyby: Text v obraze v menu Okno, patička po Ctrl+Z, ▾ na konci sekvence, dvojitý „✓ Staženo“, „do Posavať“.
7. Regrese: stav 07 (08, 12) při 1040×1100 6 místo 7.
8. Duplicitní id zachyceno i testerem, oprava mwrctz0d ověřena.

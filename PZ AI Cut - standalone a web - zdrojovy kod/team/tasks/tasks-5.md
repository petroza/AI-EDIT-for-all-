# Zadání – kolo 6 (vlastník → vývojář)
(Uloženo vývojářem z textu agenta – vlastník produktu, 2026-11-22.)

Podklady: report-5, redaktor-5, review-4, log.md (Kolo 5 – vývojář, Kolo 5 – oprava po redaktorovi), tasks-4, design-4 (vč. §4 design-5), developer-rules.md, `team/reports/shots-5/kraje/ceiling-stanice.json` (strop přepočítán vlastníkem). Adresa pro všechny: **http://127.0.0.1:8791/**.

**Petrovi: commit hned, před začátkem kola 6.** Je to 6. kolo s 0 commity. Stav `app.js?v=mwrctz0d`, testy 37/37, B1 ověřený ředitelem i testerem. Kolo 6 mění rozvržení Přepisu a výřez 9:16, takže bez bodu návratu do toho nejdu. Vývojář commit udělá jen na Petrovo výslovné přání (pravidlo 9). Když Petr neodpoví, vývojář začne, ale do první věty logu napíše „bez commitu“.

## Verdikt kola 5
- **Redaktor: ANO za 6:44** od importu po MP4, z toho čekání 2:33 (cíl ≤ 3 min ✔). ~1 min ztratil na mrtvém tlačítku „Titulky z přepisu…“ (duplicitní `id`), opraveno v mwrctz0d, tester ověřil 6/6. Bez ní ~5:45 (odhad, potvrdí redaktor-6).
- Druhá odpověď po titulcích nic nerozbila (B1 ✔, 25/25 a 16/16 titulků na své řeči).
- Zůstalo: **2 chyby slov** přesného přepisu („zvolával“, „narozenina“, cíl ≤ 1); **~1,2 s prázdného stolu v 9:16** na začátku druhé odpovědi.
- Tester: **kraje titulků na stanici dál slabé** (konce 20/28), **varování skoro nechytá chyby** (konce 0/10, začátky 2/9, planých 9 / 7), **titulky se slovem, které nezazní** („-ším“, „obrečela“, „Jo, vím p-“, „že“), na notebooku přesný úsek „do Posavať“.

## Strop měření (ověřeno před stanovením cíle)
- `ceiling-stanice.json`, 32 výroků, rozhodčí sám se sebou: široké okno 29/32, 28/32; úzké 28/32, 29/32; beam 1 30/32, 30/32 → **88–94 % ≈ 25–26/28**. Rozptyl ±1–2 → **cíl = 23/28 (82 %)**.
- Když vývojář změní rozhodčího (úzké okno od +40 ms, ✘ jen při shodě obou oken), musí stejným skriptem (`ceiling.py`, 32 výroků) přeměřit strop a stejným rozhodčím přepočítat PŘED (pravidlo 15). Cíl nejvýš strop − 2.
- **„Špatný kraj“** pro varování a 0-útržky = rozhodčí ✘ **a** ruční kontrola RMS to potvrdí (formát `manual8.txt`). Omyly rozhodčího se nepočítají ani jako chyba, ani jako plané varování.

## Pořadí a proč
1. **Kraje titulků** („nikdy useknuté slovo“, tester 2× váha 3, zaměření ředitele 1).
2. **9:16 bez prázdného záběru** (vada ve výstupu pro diváky).
3. **Přepis ≥ 8 vět + úklid patiček** (zaměření ředitele 2 + drobnosti testera ve stejném rámu).

---

## Úkol 1 – Titulky jen ze slov, která v klipu zazní, a varování, které chytá chyby (obě cesty) (UX: ne)
**Proč:**
- report-5 §3: stanice 23/28 začátků, **20/28 konců**; varování chytí 2/9 špatných začátků a **0/10 konců**; planých 9 (stanice) a 7 (notebook). Notebook 24/28 a 26/28 nesmí se zhoršit.
- Titulky se slovem, které nezazní (pravidlo 3): **C2 / B4a** #14 → Shift+#16, In 50,095 – „Já se taky moc těším.“, zazní jen „-ším“ (⚠); **C3 / B4b** #247, In 928,518 – „obrečela,“ skončila před In (⚠); **C4 / B4d** #24, Out 97,81 – „Jo, vím přesně,“, zazní „Jo, vím p-“ (⚠ konec); **2718 N4** Out 1359,97 – útržek „že“ bez varování; **6174 N2** In 1211,58 – titulek „A“ v tichu.
- Začátek v řeči bez varování: **C5 / B2a** #4–#6, In 21,295 – zazní „(se)dívává“, titulek „na tom místě“; **C6 / B3a** #131, In 500,18 – útržek „-ce,“ (~0,13 s); **2718 N10** In 340,79 – útržek „-vec“.
- **C7**: notebook, standardní výřez, `__pzAsrSlow`, 8 CPU, věta #20 – titulek z přesného úseku „**do Posavať**“.

**Co chci:**
1. **Slovo, ze kterého v klipu zazní jen útržek** (podle zvuku na In/Out, ne podle času slova), v titulku není: „-ším“, „obrečela“, „přesně,“ → „Jo, vím“, „že“, „A“ v tichu. Slovo, které zazní celé, zůstane („sedívává“, „My“). Patička řekne, co aplikace vynechala (pravidlo 12).
2. **Varování začátku i konce stejnou logikou podle zvuku**: energie řeči 50–200 ms od střihu → varuj („poslechni začátek / konec“). Kde je do ±0,6 s **uvnitř výběru** pauza, nabídni ji, nikdy neraď mimo výběr (pravidlo 3).
3. **Titulky z přesných úseků mají pevnou češtinu** (C7), stejně jako standardní přepis (`language: 'cs'`).
4. Měř na cestě, kterou titulky skutečně jdou: notebook = přesné úseky, stanice = přesný přepis celého klipu.

**Hotovo, když:**
1. **Nové seedy** (2 × 14 na každou cestu) vygenerované a **zapsané do logu před měřením** (pravidlo 13), bez ladění na nich: stanice ≥ 23/28 začátků **i** ≥ 23/28 konců (kolo 5: 23 a 20); notebook ≥ 23/28 a ≥ 23/28 (kolo 5: 24 a 26). Tabulka PŘED (mwrctz0d) / PO stejným rozhodčím; při změně rozhodčího nový strop.
2. Pojmenované případy ✔ rozhodčí + ✔ RMS ručně, cestou klik + Shift+klik: B2a, B2b (std #28 In 119,71), B3a, B3b (std #20 In 81,54), B4a, B4b, B4c (#3 In 16,52), B4d, B5 (#103 Out 405,15), 2718 N4, N10, 6174 N2, redaktorův „dále.“ (1:44–2:03 na výřezu), 23:20 (R) a V1–V5. Varovaný kraj je ✔ jen tehdy, když titulek obsahuje jen slyšená slova.
3. **0 titulků se slovem, které v klipu nezazní**, na všech 56 krajích nových seedů obou cest (RMS u každého kraje, kde se titulek liší od rozhodčího).
4. Varování: **≥ 70 % potvrzených špatných začátků a ≥ 70 % potvrzených špatných konců** opraveno nebo varováno; planých **≤ 4 na 28 výroků a cestu** (kolo 5: 9 / 7).
5. **0 slov s ť/ľ/ô/ä/cyrilicí** ve všech titulcích nových seedů na notebooku a na C7.
6. Testy v `test/`: „dále.“, „-ším“, „sedívává“ (zůstane), „práce,“, „že“ na konci, „Jo, vím p-“, „A“ v tichu, varování konce. Každý musí selhat na kódu mwrctz0d (ověřit vrácením).
7. Regrese: `test/b1.js` 9/9 a `test/notebook5.js` (import → MP4 8 CPU ≤ 3:20, kolo 5: 3:01); titulky z úseků nejvýš o 10 % pomalejší než 16,7 s.

**NEDĚLAT:** opravovat chyby slov („zvolával“, „narozenina“, „jí/ji“, „rozvěděli“); přesné úseky na stanici (kolo 5: horší, ~17 s na výrok); „klik na slovo = In/Out“; nové tlačítko „posunout na pauzu“; posouvat In/Out mimo výběr.

---

## Úkol 2 – 9:16 bez prázdného záběru na začátku klipu (UX: ano – jen vzhled náhradního záběru a jedna věta hlášky)
**Proč:**
- redaktor-5: druhá odpověď (výřez 4:17) začíná ~1,2 s celku, výřez 9:16 ukazuje prázdný stůl bez obličeje (`web/test-out/redaktor-5.mp4` od 17,07 s, `shots-redaktor-5/export-t17.5.png`, `w-17-19.png`). Tester: V5 (zdroj 19:59), střih kamery 20:00,3, blikne ~0,6 s celku.
- Příčina podle kódu (`web/ai/reframe.js`): záběr, kde `shotTarget` nenajde obličej, má `x: null` → středový výřez (`posX = 0`); `cameraCuts` krokuje po 0,5 s, záběr < 0,5 s může vypadnout.
- Petr: „9:16 musí vypadat profesionálně.“

**Co chci:**
1. Záběr bez nalezeného obličeje nikdy nedostane slepý středový výřez. Pořadí: hledej znovu (víc snímků, vyšší rozlišení analýzy, malé obličeje v celku); když osobu stejně nenajde, ukaž **celý záběr** (zmenšený na šířku s rozmazaným pozadím, vzhled navrhne UX).
2. Krátký záběr na kraji klipu (< 1,5 s) stejně. In/Out se kvůli obrazu **nikdy nehýbe**.
3. Hláška po převodu řekne pravdu, např. „Obličej ve 3 ze 4 záběrů · 1 záběr celý (0:17–0:18)“.
4. Platí pro „Vložit do nové sekvence“ s 9:16 i pro Sekvence → Auto Reframe. Desktop sdílí `reframe.js` – jedna věta do logu (pravidlo 11).

**Hotovo, když:**
1. PŘED (mwrctz0d) / PO stejnou cestou klik + Shift+klik: redaktorova sekvence (2:25–2:43 + 4:17–4:26, 9:16) a V5; export, kontaktní arch po 0,2 s v okně ±2 s kolem každého začátku klipu a střihu kamery. **PO: 0 snímků s výřezem bez člověka, když je člověk ve zdrojovém snímku.** PŘED počet zapsat (redaktor ~6, V5 ~3).
2. **10 výroků z nového seedu** (zapsat předem) na obou testovacích zdrojích: tabulka záběrů obličej / náhradní celý / prázdný výřez, PŘED / PO; PO prázdný výřez = 0; kontrola okem na archu vývojářem (pravidlo 2).
3. Čas převodu 9:16 na notebooku (8 CPU) nejvýš +3 s proti PŘED.
4. Test: záběr bez obličeje nedostane `posX = 0` naslepo, krátký záběr na začátku klipu se zachytí.
5. Regrese: obličej na středu tam, kde PŘED byl (redaktorova odpověď 1, V1–V5); titulky a nadpis mimo obličej.

**NEDĚLAT:** posouvat In/Out nebo měnit výběr kvůli záběru; automaticky měnit věty; sledování obličeje uvnitř záběru; jiné formáty než chování výřezu (4:5 a 1:1 stejnou funkcí); Premiere MCP.

---

## Úkol 3 – Přepis ≥ 8 vět podle design-5 (a) + ⤢ a pravdivé patičky (UX: ano)
Návrh (a) a (c) je v design-4 §4. UX doplní: patičku po vložení v jednom řádku, umístění ⤢, texty ▾ na konci sekvence a štítku v Projektu.

**Proč:** review-4 zaměření 2 (1366×768 5 celých vět, cíl ≥ 8); report-5 §5: **07 při 1040×1100 = 6** (kolo 4: 7), 08 a 12 4/6 při 1366×768 (varování + „✓ V nové sekvenci“ na 2 řádky). Drobnosti: C11 „✓ Staženo“ dvakrát; C9 patička „Smazán titulek … Vrátit“ po Ctrl+Z; C10 ▾ s hlavou na konci sekvence „hlava je uvnitř klipu“; Projekt při prvním stahování 30 s „Příprava… – klikni pro přepis“ bez MB (váha 2).

**Co chci:**
1. **(a)** Bez otevřené sekvence zabere Přepis i místo prázdné časové osy. Osa zůstane 300 px s textem „Sekvence zatím není. Vyber v Přepisu větu → Vložit do nové sekvence.“ Text věty `max-width: 760px`. Při prvním vložení přechod 150 ms, vybraná věta na stejném y.
2. **(c)** ⤢ maximalizuje Přepis (jako `), stejným prvkem nebo Esc zpět. Cíle ≥ 24 px.
3. Patička po vložení **v jednom řádku** i s varováním.
4. „✓ Staženo“ jen jednou.
5. Patička „Smazán … Vrátit“ zmizí po Ctrl+Z nebo další akci.
6. ▾ na konci sekvence nabídne „Přidat na konec sekvence“.
7. Štítek v Projektu stejný stav jako Přepis (`asrLabel()`): MB nebo %, nikdy „klikni pro přepis“, když přepis běží.

**Hotovo, když (`test/regress.js` 1366×768 i 1040×1100, notebook 8 CPU i stanice, celé věty min):**
1. Stavy bez sekvence (04, 05, 06, 13) při 1366×768 **≥ 8**; při 1040×1100 ≥ 10.
2. Stavy se sekvencí **žádný horší než kolo 5**, **07 při 1040×1100 ≥ 7**; 08 a 12 ≥ kolo 4, kde je známé.
3. ⤢ při 1366×768 ≥ 20 vět, návrat jedním klikem / Esc, snímky.
4. Přechod při prvním vložení: y vybrané věty ±4 px; `test/b1.js` 9/9.
5. C9, C10, C11 a štítek Projektu: snímky PŘED/PO; Projekt × Přepis 0 rozdílů ve vzorcích po 5 s během prvního stahování (8 i 4 CPU).
6. Test: „bez sekvence = široký Přepis“, „patička po vložení 1 řádek“, „▾ na konci sekvence“.

**NEDĚLAT:** (b) výšku monitorů podle videa a menší náhled; zkracovat věty „…“; přestavovat jiné panely.

---

## Co do kola 6 nepatří (rozhodnutí)
- Chyby slov přesného přepisu – cíl „≤ 1 oprava slova“ v kole 6 **pozastaven**, jen se zapisuje.
- Odhad „Přepsat přesněji celý klip“ −33 % a procenta po ~8 % (mimo cestu redaktora).
- Text v obraze v menu Okno (záložka funguje).
- Balík textů na kolo 7: „asi 20 s“ × „z asi 17 s“, „0:00–0:15“ × 0:16, „(1)“ × „(2 úseky)“, Opus/AAC a LUFS do „Podrobností“.
- Systémové okno uložení (omezení prohlížeče); C12 (neopakovatelné); řádek stavu „Přepisuji řeč… N %“ 10–15 s.

## Pravidla kola
Log úkolu „Výsledek: …“, tabulka kritérií doslova (5, 7), ✔ jen doslova (13), přeměřit opravu (14), PŘED/PO stejnou metrikou (15), testy + `node --check`, verze v logu, stav pro testery (10), regrese ve všech stavech včetně „bez sekvence (a)“, „⤢“, „9:16 s náhradním záběrem“ (4).

## NEDĚLAT (celé kolo)
Nové funkce mimo úkoly, desktop a konektory, styly v `captionlayout.js`; přesný výpočet na pozadí, přesný přepis na grafice, měnit výchozí chování stanice/notebooku; nic mimo počítač, žádné jméno, vše vratné, **commit jen na Petrovo přání**.

---

## Zadání pro testera – kolo 6
127.0.0.1:8791, bez AI, čistý profil, váhy 1–3, výstup `report-6.md` + `shots-6/`.
1. **Kraje:** vlastní nové seedy zapsané předem, obě cesty; pojmenované případy úkolu 1 (RMS, kde se titulek liší od rozhodčího); titulky se slovem, které nezazní (cíl 0); pokrytí a planá varování; strop při změně rozhodčího; C7.
2. **9:16:** redaktorova sekvence z kola 5 a V5; ≥ 6 vlastních výroků se střihem kamery do 1,5 s od kraje klipu; kontaktní arch po 0,2 s (prázdný výřez / obličej / celý záběr), vzhled náhradního záběru, hláška, čas převodu.
3. **Přepis:** celé věty ve všech stavech 1366×768 a 1040×1100 (07 ≥ 7), bez sekvence ≥ 8, přechod při vložení, ⤢ tam a zpět, C9, C10, C11, štítek Projektu při prvním stahování.
4. **Regrese:** B1 lidsky (↑, ▾, Ctrl+Z/Y), notebook import → MP4 skriptem, export dvou výroků + rozhodčí.

## Zadání pro redaktora TN – kolo 6
**„Nový 5min rozhovor, redakční notebook, první den (nic stažené). Do porady Reels 20–30 s 9:16 ze dvou odpovědí: první s titulky, pak přidáš druhou. Titulky bez chyb, nadpis, export přes menu, bez AI.“**
Vývojář nastaví simulaci 8 CPU, čistý profil a nový výřez (cesta v logu). Výroky jiné než v kolech 2–5. Jedna odpověď začíná do 1,5 s od střihu kamery a jedna hrana leží těsně za předchozí větou (redaktorovi neříkat). Výstup `redaktor-6.md` + `shots-redaktor-6/`: hledání výroku v širokém Přepisu bez sekvence a přechod po vložení; záběr bez člověka / „celý záběr“ v 9:16; titulky (slovo, které nezazní / chybějící / chyba slova); zvuk na hranách; časy po krocích, import → MP4, čekání; ANO/NE.
**Cíl:** ≤ 6 min, čekání ≤ 3 min, 0 titulků se slovem, které nezazní, 0 prázdných záběrů v 9:16, sekvence se nerozbije. Chyby slov jen zapsat.

---

## Doporučení pro Petra
- **Commit teď (6. kolo bez commitu)** – předtím do `.gitignore` `team/reports/shots-*` a `team/design/shots-*`.
- **Co vidět (5 min):** `web/test-out/redaktor-5.mp4` od 17 s (prázdný stůl v 9:16); `team/reports/shots-5/kraje/B4a-tesim-14-16-titulky.png` a `B4d-presne-out97-titulky.png`; `team/reports/shots-5/kraje/manual8.txt`.
- **Jednou změřit skutečný redakční notebook** (import 5min výřezu → titulky → MP4 se stopkami).
- Cíl „≤ 1 oprava slova“ pozastaven na kolo 6.

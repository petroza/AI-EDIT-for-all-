# Zadání – kolo 5 (vlastník → vývojář)
(Uloženo vývojářem z textu agenta – vlastník produktu, 2026-11-22.)

Podklady: report-4, redaktor-4, review-3, log.md (Kolo 4 – vývojář), tasks-3, developer-rules.md. Adresa pro všechny: **http://127.0.0.1:8791/**.

**Petrovi: navrhuji první commit hned teď, před začátkem kola 5.** Stav je `app.js?v=mwr84vf5`, testy 34/34. Jsou za námi 4 kola s 0 commity a toto kolo mění vkládání do sekvence a cestu k titulkům. Bez bodu návratu do toho nejdu. Vývojář commit udělá jen na Petrovo výslovné přání (pravidlo 9).

## Verdikt kola 4
Redaktor na simulovaném notebooku řekl **ANO**: 9:46 od importu po MP4, z toho 5:50 čekání na přepisy, oprava 46 s. Video by ale bez úprav neposlal: ze 10 titulků byly 3 špatně, z toho „dále.“ z předchozí věty.
- Všech 6 pojmenovaných výroků i 23:20 je čistých. Na nových výrocích přesný přepis trefí jen 64 % začátků (cíl ≥ 86 %).
- Nejvážnější chyba je **B1**: druhý výrok vložený po titulcích rozřízne první klip a nechá cizí titulek. Přesně tohle redaktor udělá („ještě přidám jednu odpověď“).
- Standardní přepis je na notebooku na titulky nepoužitelný (slovenština, ruština). Přesný přepis celého klipu trvá 5:25, z toho 2:40 „Připravuji… · minule pár sekund“ bez jakéhokoli průběhu.

## Rozhodnutí vlastníka: notebook už ne „Standardní + nabídka“
Dosavadní výchozí chování nutí redaktora čekat dvakrát (2:00 + 5:25), přitom přesný text potřebuje jen pro 15–30 s, které jdou do titulků. **Nové výchozí chování na notebooku (4–15 vláken):**
1. **Standardní přepis celého klipu** dál slouží k hledání a výběru výroku a spouští se sám po importu.
2. **Přesný přepis se stáhne sám na pozadí** (jen poprvé, ~1 GB) hned po stažení standardního. Stahování nezatěžuje procesor a průběh je vidět v MB.
3. **„Titulky z přepisu“ přepíšou přesně jen úseky klipů v sekvenci** (19 s ≈ desítky sekund, ne 5 minut) a titulky postaví z tohoto přesného textu.
4. **„Přepsat přesněji“ celý klip** zůstává v menu ≡ a v pravém kliku. Samostatný řádek nabídky v Přepisu zmizí (uvolní místo, viz úkol 2).

Stanice (≥ 16 vláken) beze změny: přesný přepis celého klipu je dál výchozí. Přesný výpočet celého klipu na pozadí se dál **nespouští**. Automaticky se jen stahuje.

**Cíl kola 5 pro redaktora:** na notebooku s novým klipem udělá Reels ze **dvou odpovědí** (druhou přidá až po titulcích první) za **≤ 6 min od importu po MP4**, z toho čekání ≤ 3 min. Titulky budou z přesného textu, bez titulku z cizí věty, s nejvýš 1 opravou slova. Sekvence se nerozbije a export projde přes menu bez obcházení.

---

## Úkol 1 – Druhý výrok po titulcích nesmí rozbít sekvenci (B1, váha 3) (UX: ano – jen texty tlačítek)
**Proč:** Postup je v report-4, B1, snímek t13. Postup testera: #317–#320 → Vložit do nové sekvence → Titulky z přepisu (hlava skočí na 0,20 s) → #412–#415 → „Vložit do sekvence“. Výsledek:
- na začátku útržek V5 0,00–0,20 s („My“),
- V2 je na 0,20 s, zbytek V5 až od 20,08 s,
- titulek V5 „My jsme vůbec neměli“ zůstal na 0,15–1,84 s přes řeč V2,
- V2 nemá titulky.

Varianta R + V2 + V5 dala útržky 0,32 s a 0,04 s. Novou sekvenci pro druhý výrok redaktor tlačítkem neudělá, nejdřív musí Ctrl+W, a nic mu to neřekne.

**Co chci:**
- **Z Přepisu se vkládá vždy jen na hranici klipů.** Když hlava stojí na hranici (±0,5 s), vloží se na hlavu. Jinak se vloží na konec sekvence. Tlačítko říká, co udělá: „Přidat na konec sekvence“ / „Vložit na hlavu“. Rozříznutí klipu z Přepisu se nikdy nestane.
- Po „Vytvořit titulky“ hlava nezůstane uvnitř prvního klipu, vrátí se tam, kde byla.
- **Titulky patří ke svému klipu:** při vložení se posunou o délku vloženého úseku. Žádný titulek nesmí ležet přes cizí klip.
- „Vložit do nové sekvence“ je při otevřené sekvenci dosažitelné **jedním klikem** (bez Ctrl+W).
- Druhé „Titulky z přepisu“ doplní titulky jen klipům bez titulků. Existující titulky ani opravy se nezdvojí ani nepřepíšou.
- Ctrl+Z vrátí vložení jedním krokem, tedy klipy i posun titulků.

**Hotovo, když (PŘED/PO stejnou cestou klik + Shift+klik, pravidlo 1):**
1. PŘED: zopakovat t13 a do logu zapsat časy klipů a titulků.
2. PO, stejné kroky:
   - žádný klip < 1 s,
   - V5 je celý od 0,00 s, V2 za ním,
   - všechny titulky V5 mají stejné časy vůči svému klipu jako před vložením (±1 snímek),
   - 0 titulků přes V2 před doplněním.
3. Druhé „Titulky z přepisu“: V2 dostane titulky, V5 má stejný počet a stejné opravy jako předtím.
4. Varianta R + V2 + V5 a varianta s hlavou na hranici mezi R a V5 (V2 doprostřed): titulky V5 se posunou přesně o délku V2.
5. Export dvou výroků + kontrola rozhodčím (`test/edges.js` nebo export → faster-whisper): každý titulek se časem překrývá s vlastní řečí, 0 titulků přes cizí klip.
6. Ctrl+Z / Ctrl+Y vložení (klipy + titulky), snímky `shots-dev-5/b1-*`.
7. Test v `test/`, který by B1 chytil (vložení po titulcích → žádný útržek, žádný cizí titulek).

**NEDĚLAT:** obecné vkládání a rozřezávání na ose (přetažení, klávesy). Mění se jen tlačítko z Přepisu a chování titulků při vložení.

---

## Úkol 2 – Notebook: přesné titulky bez čekání na celý klip a poctivý průběh (UX: ano – texty průběhu a dialogu titulků)
**Proč:**
- Redaktor-4: přesný přepis trval 5:25 místo „asi 3 min“. Z toho 2:40 svítilo „Připravuji přesný přepis… · minule pár sekund“ bez procent a bez průběhu stahování, pak „trvá déle než obvykle“.
- Projekt přitom ukazoval „Přepisuji řeč… 7 %“ a Přepis ještě „Připravuji…“.
- Standardní přepis má „bolesť“, „veľmi zajímavé obdoby“, „príč“, „chyja“, „mnohočetný milom“.
- Tester: 1 GB se stahuje ~125 s, celý přesný přepis trvá 5,4 / 7,2 min (8 / 4 CPU), nabídka slibovala 5 / 6 min.

**Co chci (podle Rozhodnutí výše):**
1. Na notebooku po stažení standardního modelu začne stahování přesného na pozadí. Průběh je vidět v Přepisu i v Projektu **stejným textem**, například „Připravuji přesné titulky: stahuji 420 / 1 037 MB“.
2. „Titulky z přepisu“ přepíšou přesně jen úseky klipů v sekvenci (okraj kolem In/Out nech na sobě) a titulky postaví z tohoto textu. Kraje řeší `clipCaptionWords` / úkol 3.
   - Dialog řekne poctivě, co se stane: „Titulky se přepíšou přesně – asi 30 s“.
   - Když stahování ještě běží, dialog ukáže MB a odhad stažení + přepisu.
3. Žádný stav nesmí ukazovat stejný text déle než 10 s bez měnícího se čísla (MB nebo %). „Minule …“ se smí ukázat jen tam, kde se opravdu měří stejná věc (ne čas přípravy uloženého modelu během stahování).
4. Odhad pro „Přepsat přesněji“ celého klipu (menu ≡) se rozdělí: „stažení ~2 min (jen poprvé) + přepis ~4 min“.
5. Řádek nabídky „Přepsat přesněji · asi X min“ v Přepisu zmizí. Nápověda zůstane v menu ≡ a v popisku.
6. **Zjistit, jestli standardní přepis běží s pevně nastavenou češtinou.** Pokud ne a projekt je český, nastavit ji a změřit dopad.
7. Opravy titulků: kde se oprava nedá propsat do (standardního) Přepisu, patička nesmí tvrdit „opravy platí i v přepisu klipu“.

**Hotovo, když (čistý profil, afinita 8 i 4 CPU, `__pzAsrSlow`, 5min výřez, redaktorův výrok 1:44–2:03 + jeden další výrok z výřezu):**
1. Tabulka PŘED (kolo 4: 9:46 celkem, 5:50 čekání) / PO po krocích, pro 8 i 4 CPU:
   - import → standardní hotov,
   - stažení přesného (MB, s),
   - klik „Vytvořit titulky“ → titulky hotové: **≤ 45 s (8 CPU), ≤ 60 s (4 CPU)** při staženém modelu,
   - import → MP4 skriptem cestou redaktora: **≤ 6 min (8 CPU)**.
2. Odhad v dialogu titulků i v „Přepsat přesněji“ sedí ±25 % (tabulka odhad vs. skutečnost, i první stažení).
3. Snímky každých 5 s během stahování a přípravy: 0 intervalů > 10 s bez změny čísla. Dvojice snímků Projekt + Přepis ve stejném okamžiku ukazují stejný stav.
4. Titulky redaktorova výroku:
   - 0 slov se slovenskou nebo ruskou diakritikou či cyrilicí,
   - WER titulků proti referenci (rozhodčí + ruční oprava) PŘED (standardní titulky) / PO (přesný úsek) je nejvýš o 2 p. b. horší než přesný přepis celého klipu,
   - tabulka do logu.
5. Standardní přepis výřezu, PŘED/PO bod 6: počet slov s ť/ľ/ô/ä/cyrilicí a WER. Pokud byla čeština už nastavená, napsat to a přiložit důkaz.
6. Stanice (≥ 16 vláken): výchozí dál přesný přepis celého klipu, čas beze změny (±10 %).
7. Přepis 1366×768, stav „výběr + varování“ (dřív 06): ≥ 5 celých vět (kolo 4: 4) a v žádném stavu méně než v tabulce kola 4.
8. Bez slov Whisper/model/vlákna/WebGPU v UI. Desktop: jednou větou, co uvidí (pravidlo 11).
9. Test: titulky z přesného úseku (mock) a stav stahování s čísly.

**NEDĚLAT:**
- přesný výpočet celého klipu automaticky na pozadí,
- přepis Přepisu podle přesného úseku (věty v Přepisu zůstávají standardní),
- přesný přepis na grafické kartě,
- měnit výchozí chování stanice.

---

## Úkol 3 – Kraje titulků: ani „dále.“, ani chybějící první slovo (B2–B5)
**Proč:**
- Redaktor-4: první titulek „dále.“ (konec věty 1:39, ve zvuku jen slabý zbytek ~10 dB pod řečí 0,1–0,35 s), stejný typ jako „stalo.“ v kole 3.
- Tester na nových výrocích přesného přepisu naměřil začátky 18/28 (64 %) a konce 21/28.
- Varování chytí 8/16 špatných začátků a jen 3/13 konců a 9× varuje planě.

Konkrétní případy:
- **B2:** #4–#6, In 21,30: zazní „sedívává“, titulek začíná až „na tom místě“. Standardní výřez In 119,71: zazní „My“, titulek začíná „jsme“.
- **B3:** #131, In 500,18: zazní „práce,“ z předchozí věty, bez varování. Standardní výřez In 81,55: „což je prostě“.
- **B4:** #14–#16, In 50,10: zazní jen „-ším“, titulek „Já se taky moc těším.“. Dále 928,52 „obrečela,“, 16,51 „krásná.“, Out 97,82 „přesně,“.
- **B5:** Out 404,23 uprostřed tiché repliky „To je za mě | nic nebylo?“, bez varování.

**Co chci:**
1. **Nejdřív férový rozhodčí:** v `test/edges.js` porovnávat bez diakritiky a s editační vzdáleností ≤ 2. Přepočítat PŘED na testerových sadách (přesný 4242 a 9090, standardní 31337 a 555) a čísla dát do logu.
2. **In/Out se při vložení z Přepisu přichytí do pauzy na hranici vybrané věty** (do ±0,6 s), když tam pauza je. Případy B3/B4: In za „práce,“ / za „těším.“, ne před ně. Rada nesmí vést mimo výběr (pravidlo 3).
3. Slovo, ze kterého v klipu zazní jen útržek nebo slabý zbytek (případ „dále.“, „-ším“), v titulcích není. Slovo, které zazní celé („sedívává“, „My“), v titulcích je.
4. Varování na konci funguje stejně jako na začátku, a to i u tiché repliky (B5). Planá varování se sníží.
5. Měří se na cestě, kterou titulky skutečně jdou: notebook = přesný úsek z úkolu 2, stanice = přesný přepis celého klipu.

**Hotovo, když:**
1. Tabulka PŘED/PO s férovým rozhodčím: přesný přepis na sadách 4242 + 9090 **začátky ≥ 24/28 a konce ≥ 24/28**. Standardní přepis (stanice ho nepoužívá, ale hledání ano) se nesmí zhoršit.
2. Pojmenované případy jsou ✔✔ cestou klik + Shift+klik:
   - redaktorův 1:44–2:03 na výřezu (první titulek „A zjistilo se to…“),
   - B2 ×2, B3 ×2, B4 ×4, B5,
   - 6 pojmenovaných výroků z kola 4 a 23:20.
3. Varování: ≥ 10/13 špatných konců a ≥ 12/16 špatných začátků je opraveno, nebo má varování. Planých varování je ≤ 3 (kolo 4: 9).
4. 0 titulků se slovem, které v klipu nezazní, i u varovaných krajů (B4).
5. Nové sady seedů, které vývojář předtím neviděl (2 × 14), bez ladění na nich. Výsledek zapsat i kdyby byl horší.
6. Testy na „dále.“, „-ším“, „sedívává“ a „práce,“.
7. Oddíl „Rozhodčí vs. titulky“: protože notebook teď přepisuje úsek podobně jako rozhodčí, přidej u 8 krajů RMS po 20–30 ms jako nezávislý důkaz.

**NEDĚLAT:**
- opravovat chyby slov přesného přepisu („jí/ji“, „rozvěděli“),
- „klik na slovo = In/Out“,
- nové tlačítko „posunout na pauzu“.

---

## Úkol 4 – Drobnosti, které redaktora zdržely (≤ 45 min; UX: ne, podle textu níže)
1. **Automatický přepis po importu:**
   - nový profil = zapnuto,
   - stará uložená hodnota z doby bez volby se migruje (pravidlo 10),
   - texty v Programu (`src/ui/monitors.js:81`), na úvodní kartě a v prázdném Přepisu říkají „přepíše se sama“ jen tehdy, když je automatický přepis zapnutý. Jinak ukážou „Přepis spustíš: pravý klik na klip → Přepsat řeč“.
   - **Hotovo:** čistý profil → import → přepis se spustí do 2 s. S vypnutou volbou žádný text netvrdí „přepíše se sama“ (snímky obou stavů).
2. **Delete v otevřeném titulku:**
   - když je označený celý text (Ctrl+A) nebo je pole prázdné, Delete smaže titulek s [Vrátit],
   - nápověda v editaci to říká.
   - **Hotovo:** klik do titulku → Ctrl+A → Delete → „9 titulků“ + Vrátit, Ctrl+Z vrátí.
3. **„Text v obraze“** je vidět jako záložka i při 1366×768 a je i v menu Okno.
   - **Hotovo:** snímek 1366×768 po vložení do sekvence, záložka viditelná bez menu.
4. **Esc v systémovém okně uložení** nezavře dialog Export. Dialog zůstane otevřený s řádkem „Ukládání zrušeno“.
   - **Hotovo:** Export → Exportovat → Esc → dialog je dál otevřený, druhý pokus uloží MP4.
5. **B6 – vynechaná „halucinace“ nesmí potichu skrýt řeč:**
   - místo bubliny se v Přepisu na místě ukáže řádek „0:00–0:08 nepřepsáno (hudba / možná řeč) ▶“,
   - klik na něj přehraje úsek.
   - **Hotovo:** rozhovor Šimková – řádek na 0:00 je vidět a klik přehraje 6,1 s. Řádek na konci (28:01, hudba) je vidět stejně. Počet řádků Přepisu se nezhorší.

**NEDĚLAT:** technické hlášky v Exportu (Opus/AAC, LUFS), drobnosti váhy 1 z report-4 (scroll po přepisu, Shift+klik vystředění, barva tlačítka). Zůstávají na další kolo.

---

## Rozvržení Přepisu (4 věty při 1366×768) – rozhodnutí
V kole 5 se dělá jen to, co plyne z úkolu 2 (zmizí řádek nabídky). Cíl ≥ 8 vět přesouvám do kola 6. Do té doby platí pravidlo 4 takto: žádný stav nesmí být horší než tabulka kola 4 (stav 06: 4 / 7) a za ✘ se počítá zhoršení.

Rozhodnutí o variantě:
- **nechci** zkrácené řádky s „…“ (redaktor potřebuje číst celý text),
- **nechci** menší náhled.

**UX designér připraví `design-5.md` (bez implementace)** pro kolo 6:
- (a) Přepis zabere i místo prázdné časové osy, když není otevřená sekvence,
- (b) výška monitorů podle poměru stran videa (1040×1100: +~3 věty),
- (c) ikona ⤢ pro maximalizaci (klávesa ` dnes dá 24 vět).

Každou variantu změří v aplikaci v pixelech a větách.

## Pravidla kola (připomenutí)
- Log úkolu začíná řádkem „Výsledek: …“ a ke každému úkolu patří tabulka všech kritérií doslova (pravidla 5 a 7).
- PŘED/PO cestou uživatele, strojová ověření dělá vývojář sám (pravidla 1 a 2).
- Regresní průchod `test/regress.js` 1366×768 i 1040×1100 ve všech stavech, nově i „stahuji přesné titulky“ a „dva výroky + titulky“ (pravidlo 4).
- `node test/run-tests.js` + `node --check`, verze nasazení v logu.
- Stav pro testery: výchozí chování notebook/stanice, co je v OPFS a IndexedDB (pravidlo 10).

## NEDĚLAT (celé kolo)
- nové funkce mimo úkoly: klik na slovo = In/Out, časový kód, dialog Exportu, Opus/AAC, názvy sekvencí, opravy pro AI, tolerantní hledání,
- přesný výpočet na pozadí, přesný přepis na grafice,
- styly v captionlayout.js, desktop a konektory,
- velké přestavby rozvržení (kolo 6),
- nic mimo počítač, žádné jméno, vše vratné, **commit jen na Petrovo přání**.

## Zadání pro testera – kolo 5
127.0.0.1:8791, bez AI, čistý profil, váhy 1–3, výstup `report-5.md` + `shots-5/`.
1. **B1:** testerovy kroky z kola 4 + varianty: hlava na hranici, konec sekvence, nová sekvence jedním klikem, druhé „Titulky z přepisu“, Ctrl+Z/Y. Export dvou a tří výroků a kontrola, že každý titulek leží na své řeči.
2. **Notebook (afinita 8/4, `__pzAsrSlow`, první stažení):** průběh stahování v MB (snímky po 5 s) a shoda Projekt × Přepis, čas klik → titulky, odhad vs. skutečnost, WER titulků a slova ve slovenštině či ruštině ve standardním přepisu, celkový čas import → MP4.
3. **Kraje:** nové seedy (ne vývojářovy), opravený rozhodčí, případy „dále.“, B2–B5, pokrytí varování a planá varování. 8 krajů ručně (RMS + široké/úzké okno).
4. **Drobnosti:** automatický přepis po importu a texty, Delete v otevřeném titulku, záložka Text v obraze, Esc v uložení, řádek „nepřepsáno“ s přehráním.
5. **Regrese:** počet celých vět Přepisu ve všech stavech (nesmí klesnout pod kolo 4), seznam titulků, hledání, slabý počítač, stanice (přesný přepis výchozí).

## Zadání pro redaktora TN – kolo 5
**„Ráno přišel nový rozhovor (jiný 5min výřez, bez přepisu), máš redakční notebook a je to tvůj první den s aplikací (nic není stažené). Do porady Reels 20–30 s ze dvou odpovědí: nejdřív udělej první s titulky, pak si vzpomeň, že přidáš ještě jednu. Titulky bez chyb, nadpis, export přes menu, bez AI.“**

Vývojář nastaví simulaci 8 CPU, čistý profil a výřez (cesta v logu), výroky jiné než v kolech 2–4. Výstup `redaktor-5.md` + `shots-redaktor-5/`. Redaktor zapíše: co aplikace během čekání říkala a jestli tomu rozuměl; časy po krocích, import → uložené MP4; jestli přidání druhé odpovědi něco rozbilo; kolik titulků bylo špatně a jakého druhu (cizí věta / chybějící slovo / chyba slova); jestli export šel bez obcházení (blokaci zapsat, neobcházet); ANO/NE na svém notebooku, poslal bych bez úprav / po opravách.

**Cíl:** ≤ 6 min, čekání ≤ 3 min, 0 titulků z cizí věty, ≤ 1 oprava slova, sekvence se po druhé odpovědi nerozbije.

---

**Shrnutí pro vývojáře (pořadí):**
1. B1: vkládání z Přepisu jen na hranici klipů a titulky patří ke klipu.
2. Notebook: přesné titulky jen z úseků v sekvenci, stahování na pozadí s MB, poctivé odhady, čeština ve standardním přepisu.
3. Kraje titulků: férový rozhodčí, přichycení In/Out do pauzy, žádné útržky („dále.“) ani chybějící první slovo, varování konce.
4. Drobnosti: automatický přepis a texty, Delete v titulku, záložka Text v obraze, Esc v Exportu, viditelný řádek „nepřepsáno“.

Rozvržení Přepisu (≥ 8 vět) jde do kola 6 přes design-5. **Před kolem 5 navrhuji Petrovi první commit.**

# Pravidla pro vývojáře (od kola 4 – výměna způsobu práce po review-3)
Kola 2 a 3: dvakrát hodnocení 3 kvůli stejnému vzoru – povinné ověření vynecháno nebo „předáno testerovi“, regresní průchod neúplný,
kritéria v logu chybí, viditelná chyba nasazena. Proto platí tato pravidla; porušení kteréhokoli z bodů 1–5 = úkol se počítá jako nesplněný.

1. **Nejdřív zopakuj stížnost uživatele přesně.** Ke každému úkolu z reportu najdi konkrétní případ (výrok, čas, snímek) a před opravou ho
   zopakuj stejnou cestou jako tester/redaktor (klik + Shift+klik, ne jen přes nástroj). Do logu „PŘED: …“ a po opravě „PO: …“ se stejným měřením.
   Oprava, která neprojde přesně na případu uživatele (kolo 3: „stalo.“ ve výroku 23:20), není hotová, i když prošla jinde.
2. **Strojová ověření děláš sám.** Testerovi smíš předat jen poslech a lidský úsudek. Přepis exportu lokálním modelem
   (faster-whisper / Parakeet na tomto PC), RMS, WER, snímky a měření DOM jsou tvoje práce. „Prohlížeč je obsazený“ není důvod:
   použij druhý profil (`test/shot.js`, `test/notebook.js`) nebo počkej. Na kraje výroků napiš skript (`test/edges.js`): vstup = seznam výroků
   (ID vět), výstup = tabulka první/poslední slovo titulku | první/poslední slovo ve zvuku (lokální model) | RMS na In/Out | varování.
   Výstup skriptu jde celý do logu.
3. **Titulky = jen to, co v klipu zazní.** Slovo, které podle zvuku (RMS/lokální model) v klipu nezazní, v titulcích být nesmí.
   Slovo, které zazní, v titulcích být musí. Časy slov z přepisu nejsou důkaz, rozhoduje zvuk. Rada uživateli nesmí vést mimo jeho výběr
   (ne „přidej předchozí větu“, když stačí posunout In o 0,1 s nebo vynechat titulek).
4. **Regresní průchod ve všech stavech.** Před nasazením `test/shot.js` celá cesta při 1366×768 i 1040×1100: import → Přepis → hledání →
   klik + Shift+klik **s varováním** → Vložit do nové sekvence → Titulky → oprava → smazání → Export. Navíc stavy: stahování, „Připravuji…“,
   nabídka „Přepsat přesněji“, slabý počítač (`__pzAsrSlow`, `__pzAsrWeak`). Ke každému stavu snímek `shots-dev-N/rr-<krok>-<stav>-<rozlišení>.png`
   a počet celých viditelných řádků seznamu. Pod 8 řádků = ✘. Každý nový prvek v rámu Přepisu/Titulků se musí vejít do tohoto pravidla.
5. **Kontrolní tabulka v logu ke každému úkolu:** `kritérium (doslova ze zadání) | ✔/✘/neověřeno | důkaz (číslo, soubor, snímek) | kdo ověřil`.
   Každé kritérium ze zadání má řádek. Chybějící řádek = ✘. „Neověřeno“ jen u poslechu, s důvodem.
6. **Text, který uživatel uvidí, čti.** Po každém novém přepisu projdi první a poslední 3 věty a vyhledej URL, „Titulky vytvořil“, „www.“,
   opakující se fráze a věty v cizím jazyce. Viditelnou halucinaci nenasazuj bez opravy nebo bez ✘ v první větě logu.
7. **Špatná zpráva patří na začátek.** Log úkolu začíná řádkem „Výsledek: hotovo / částečně (co chybí) / nesplněno“, teprve pak detaily.
8. **Testy.** `node test/run-tests.js` + `node --check web/dist/app.js` před nasazením (výsledek do logu). Nová logika = aspoň jeden test,
   oprava chyby z reportu = test, který by tu chybu chytil (např. „slovo před In v propadu zvuku → bez titulku“).
9. **Git.** Commit jen na výslovné přání Petra. Na začátku každého předání kola mu v první větě navrhni commit (po 3 kolech 0 commitů =
   nasazení bez možnosti návratu). Do logu verzi nasazení (app.js?v=…).
10. **Stav pro testery.** Před předáním zapiš adresu (vždy 127.0.0.1:8791), výchozí kvalitu přepisu, co je v IndexedDB/OPFS, a které klipy
    mají přepis. Stará uložená hodnota z doby bez volby není volba uživatele – migruj ji.
11. **Desktop.** U funkcí jen pro web napiš, co uvidí uživatel desktopu.
12. **Automatika nesmí mazat ani přidávat obsah potichu.** Vyhozené nebo přidané slovo ověř aspoň na 10 začátcích a 10 koncích proti zvuku
    (bod 2). Při pochybnosti řiď se zvukem a v patičce napiš, co aplikace udělala.
13. **✔ jen při doslovném splnění.** „Nové seedy“ = vygenerované a zapsané do logu před měřením; sada, kterou už někdo z týmu měřil, se nepočítá. (review-4)
14. **Oprava nasazená po měření musí být přeměřena** stejným skriptem před předáním. Jinak ✘ a nenasazovat. (review-4)
15. **PŘED/PO jen se stejnou metrikou:** skript × skript, člověk × člověk. Lidský čas odhadni jako čas skriptu + časy kroků z reportu redaktora a napiš, že jde o odhad. (review-4)

# Zadání – kolo 2 (vlastník → vývojář)
(Uloženo vývojářem z textu agenta; opraven překlep asr-wet.js → asr-wer.js.)

Datum: 2026-11-21. Podklady: report-2, redaktor-2, review-1, log.md, design-1, web/README.md.

## Verdikt kola 1
Redaktor **„ANO, ale těsně“** (kolo 0: NE). Cesta bez AI je celá průchozí. Na sítě TN to ale nejde poslat – **titulky plné chyb
rozpoznávání** (tester 6/48 slov = 12,5 %, redaktor 7 ze 13 titulků; chyby hledal posouváním náhledu po 1 s).
Dál: AI panel a plovoucí okno pletou; hák začíná 0,9 s ticha a karaoke předbíhá řeč.
Zaměření (ředitel): titulky, které jdou poslat – změřit chybovost, přesnější model, oprava na jednom místě. **Zákaz měnit model ruším.**
Hotové opravy (Text v obraze po Novém projektu, stavový řádek a zadání AI, „,“ do prázdné sekvence, Auto Reframe na 9:16, Enter, „Bez názvu“,
*.exe v dialogu) nasaď s tímto kolem, do logu jak ověřeno. Úkoly 2 a 3: jeden společný návrh UX (`team/design/design-2.md`).

## Úkol 1 – Přesnější přepis, změřený na pevném vzorku (UX: ano, jen texty a volba)
**Proč:** největší překážka (tester 6/48, redaktor 7/13), hledání selhává na pravopisu („děváci“). „Přesné“
(`whisper-large-v3-turbo_timestamped`) existuje, ale schované v AI panelu a nezměřené.
**Co chci:**
1. **Pevný měřicí vzorek** v `test/asr-ref/`: rozhovor Šimková **18:00–20:00** (obsahuje výrok 18:16–18:32) + referenční text – kde se
   oba modely shodují, přijmi; kde se liší, rozhodni podle kontextu a označ `[?]` (pro testera v kole 3); testerovu opravu výroku (48 slov) převezmi.
   Druhý vzorek: redaktorův výrok **25:51–26:10** opravený podle redaktor-2 (`[?]` u odhadů jako „Je jí teď líp“).
2. **Skript** `node test/asr-wer.js` – WER (záměny + vypuštění + vložení; malá písmena, bez interpunkce) pro Standardní i Přesné.
3. **Rozhodnutí podle čísel:** Přesné výchozí, pokud WER ≤ 5 % (nebo aspoň o 40 % nižší než Standardní) **a** 28 min se na tomto PC
   přepíše do 12 min. Bez vhodné grafiky (WebGPU) zůstane Standardní a v panelu Přepis jedna věta proč, bez technických slov.
4. **Klip se starým přepisem:** v kontextovém menu „Přepsat přesněji“; starý přepis platí, dokud není nový; titulky se nezmění;
   uložený přepis nese model, starý se nevydává za přesný.
5. **První stažení modelu:** uživatel vidí, že se stahuje jen jednou, a přibližnou velikost v MB.
**Hotovo, když:**
1. V logu tabulka: model | WER 18:00–20:00 | WER 25:51–26:10 | čas přepisu 28 min na tomto PC | velikost stažení – z `asr-wer.js` a skutečného běhu.
2. V logu počet chybných slov v testerově výroku 18:16–18:32 u obou modelů (dřív 6/48).
3. Výchozí model podle pravidla z bodu 3; rozhodnutí a důvod v logu.
4. „Přepsat přesněji“: během přepisu jde hledat ve starém; po dokončení nový text; titulky beze změny (ověřeno porovnáním).
5. Vynucení bez WebGPU (simulace): přepíše Standardním a ukáže českou větu bez slov Whisper, model, WebGPU.
6. Mimo stažení modelu z Hugging Face nula síťových požadavků ven (seznam z Performance do logu).
7. `node test/run-tests.js` projde a nový test chybovosti je v něm.

## Úkol 2 – Seznam titulků, oprava na jednom místě (UX: ano)
**Proč:** redaktor nejvíc chtěl „opravovat titulky jako text v seznamu“; chybí seznam i skok na další titulek (šipka dolů skočila na konec);
dvojklik v náhledu nikde nenapsán; po „Nahradit titulky“ se ruční opravy ztratí. Ředitel: oprav slovo jednou a platí všude.
**Co chci:**
- **Seznam titulků** aktivní sekvence: čas + text, hraný titulek zvýrazněný; klik = hlava na titulek; oprava přímo v řádku –
  **Enter uloží a skočí na další, Esc zruší, ↑/↓ předchozí/další**. Kde – rozhodne UX; nesmí zakrýt Programový monitor.
- **Oprava se propíše do přepisu zdroje** (pro slova, která v titulku zazní): hledání v Přepisu najde opravené slovo; „Vytvořit znovu z přepisu“ opravu neztratí.
- Zpět = jedna oprava jedním krokem (titulek i přepis). Viditelný tip, jak titulek opravit.
- Zvýraznění nejistých slov **ne** (model jistotu nedává).
**Hotovo, když:**
1. Redaktorův výrok 25:51–26:10 v 9:16 s titulky: automat opraví 7 titulků **jen klávesnicí** do 2 min; čas, 7/7 uloženo.
2. Po „slišet“ → „slyšet“ Ctrl+F v Přepisu najde opravené slovo a staré ne.
3. „Nahradit titulky“ (Vytvořit znovu z přepisu): všech 7 oprav zůstane.
4. Ctrl+Z vrátí poslední opravu v seznamu, náhledu i přepisu; Ctrl+Y zpět.
5. Oprava, která se nevejde, se rozdělí na dva titulky a seznam to hned ukáže.
6. Při 1366×768 i 1040×1100 je seznam vidět a Programový monitor celý odkrytý (snímky do shots-dev-2).
7. Česky, kontrast ≥ 4,5 : 1, cíle ≥ 24 px.

## Úkol 3 – Obrazovka, ve které se redaktor hned vyzná (UX: ano)
**Proč:** redaktor: AI panel bez AI zabírá třetinu šířky, 20s klip ~30 px (č. 3); Text v obraze plave přes Zdroj a zakryl název souboru při exportu (č. 2);
„Přepis“ na úvodní kartě vede do prázdného panelu (č. 4); příklad v poli nadpisu je obsah rozhovoru (č. 5); „Vložit do nové sekvence“ napůl pod okrajem (č. 6).
Tester: Přepis nepřepne na nově importovaný klip; klik na štítek „Přepis 0 %“ nic (č. 7).
**Co chci:**
- **Bez připojené AI je AI panel sbalený** do úzkého pruhu s tlačítkem „AI“; otevře se klikem, volba se zapamatuje. S AI jako dnes.
- **Text v obraze nezakrývá monitory ani okno exportu** (ukotvené v rozvržení, nebo se při exportu schová – rozhodne UX).
- „Přepis“ na kartě, klik na štítek přepisu u klipu a první import: vždy Přepis **toho klipu**.
- Neutrální příklad v poli nadpisu. Patička Přepisu celá vidět i v malém okně.
**Hotovo, když:**
1. Bez AI při 1366×768 osa ≥ 60 % šířky okna a vložený 20s úsek ≥ 70 % šířky osy (změřit, snímek).
2. Okno exportu ani monitory nikdy překryté oknem Text v obraze (export s otevřeným oknem, snímek).
3. Čistý projekt → import jednoho klipu → „Přepis“ na kartě ukáže přepis toho klipu; totéž klik na štítek.
4. Při 1040×1100 a 1366×768 tlačítka patičky Přepisu celá v okně.
5. Připojená AI (nebo simulace): AI panel jako dnes, nic rozbité.
6. Do logu, co z toho uvidí uživatel desktopu.

## Úkol 4 – Hák bez ticha, karaoke na řeči
**Proč:** tester [1] první věta 0,9 s ticha; [2] karaoke „Tady“ v 0,5 s, řeč v 0,9 s; „to.“ z předchozí věty v titulku, nezazní.
Příčina: časy slov rozpočítané podle délky. Konec těsný (~70 ms). Hák musí začít hned, nikdy useknuté slovo.
**Co chci:**
- Začátek úseku z věty: před řečí jen krátký nádech (~0,15 s), nástup řeči podle zvuku (stejný práh jako pauza v cutBounds).
- Konec: doznění ~0,2 s, ne další slovo.
- Karaoke a titulky: první slovo každé fráze po pauze začne s nástupem řeči podle zvuku; ostatní slova fráze se rozpočítají v posunutém úseku.
- Slovo, jehož čas po úpravě leží celé v tichu mimo úsek, do titulků nepatří.
**Hotovo, když:**
1. 20 výběrů vět (mezi nimi 18:16 a 25:51): ticho před prvním slovem v sekvenci 0,05–0,30 s, po posledním 0,10–0,35 s (RMS); tabulka v logu.
2. Nad úrovní řeči **0 hran** ze 40; hran méně než 10 dB pod řečí ne víc než v kole 1 (9/60 v poměru).
3. U 20 titulků začínajících po pauze začátek zvýraznění prvního slova ±0,15 s od nástupu řeči (RMS); tabulka.
4. Výrok 18:16–18:32: v prvním titulku není „to.“.
5. Test v `test/run-tests.js` hlídá nástup řeči a doznění.
6. Slova uvnitř souvislé řeči změřit nejdou – otevřeně napsat a předat testerovi.

## Kontrola z kola 1 (bez vývoje, ~10 min)
Auto Reframe u střihu kamery v 7,64 s: snímky 7,5 / 7,7 / 8,0 s z exportu 9:16, obličej ve středové třetině; opravit jen když selže; snímky do logu.

## Co v tomhle kole NEDĚLAT
- Zvýraznění nejistých slov – jen zjistit (max 15 min), jestli transformers.js dá pravděpodobnost slov; zapsat, nestavět.
- Hledání tolerantní k překlepům. Převádět/trénovat vlastní modely; jiný model jen pokud už je na Hugging Face v ONNX s časy slov. Posílat zvuk ven.
- Dialog Exportu, jemnější průběh přepisu, „Zrušit zadání“ AI, názvy sekvencí, režim „Video pro sítě“ – další kola.
- Konektory, AI nástroje, styly v `captionlayout.js` (jen použít), přepis na desktopu.
- Nic mimo počítač, žádné jméno, neměnit sekvence uživatele, vše vratné přes Zpět.
- Commit jen na výslovné přání Petra (navrhnout; do té doby verze nasazení v logu).
- `__pzDevExport`: smíš jen doplnit příponu .mp4.
Nasazení po ověření; do log.md u každého úkolu všechna kritéria s ✔ / ✘ / „neověřeno, ověří tester/redaktor“.

## Zadání pro testera – kolo 3
Šimková 28 min, bez AI, čistý projekt; váhy 1–3; výstup report-3.md + shots-3/.
1. Referenční text: projdi `[?]` ve vzorcích 18:00–20:00 a 25:51–26:10 proti zvuku, oprav referenci, přepočítej `node test/asr-wer.js`; chybná slova ve výroku 18:16–18:32 (dřív 6/48). Patří titulky ještě mezi překážky?
2. Přesný přepis: první stažení (MB, čas), čas přepisu 28 min, co dělá počítač; „Přepsat přesněji“; simulace bez grafiky – srozumitelná hláška?
3. Seznam titulků: 5 oprav jen klávesnicí (Enter → další), Ctrl+F najde opravené slovo, „Nahradit titulky“ opravy nesmaže, Ctrl+Z / Ctrl+Y; časy.
4. Hák a karaoke: 5 výroků – ticho před prvním slovem a doznění (RMS + snímky), karaoke vůči řeči (snímky po 0,1 s), nic useknuté.
5. Rozvržení 1366×768 a 1040×1100: šířka osy bez AI, Text v obraze vs. export, tlačítko Přepis na kartě, štítek u klipu, patička Přepisu.
6. Regrese oprav z report-2 (Text v obraze po Novém projektu, stavový řádek a zadání AI, „,“ do prázdné sekvence, Auto Reframe na 9:16, Enter, „Bez názvu“, typy souborů).
7. Auto Reframe přes střih kamery v 7,64 s: snímky.

## Zadání pro redaktora TN – kolo 3
**„Za 10 minut do porady: Reels 15–20 s, titulky bez chyb, nadpis, bez AI.“** Jiný výrok než v kole 2, hledat jako v redakci. Import sám,
čekání na přepis měřit zvlášť. Výstup redaktor-3.md + shots-redaktor-3/.
- Čas import → soubor; zvlášť nalezení výroku a oprava titulků.
- Kolik titulků bylo špatně před opravou, jak dlouho oprava v seznamu.
- **ANO/NE: zvládl bych to sám?** Pokud NE, jediná věc, která chyběla.
- Každé zaváhání; rušilo něco na obrazovce?
- Poslal bys výsledek bez úprav / po opravách?
- Export přes menu; zablokuje-li ho ochrana Claude Code, napsat a neobcházet – vývojář vyexportuje potom.

**Cíl kola 3:** redaktor ANO bez „těsně“; ve výroku 15–20 s před opravou ≤ 2 chybná slova; oprava titulků do 1 min; celkem pod 6 min (bez čekání na přepis).

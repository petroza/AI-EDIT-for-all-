# Zadání – kolo 3 (vlastník → vývojář)
(Uloženo vývojářem z textu agenta.)

Datum 2026-11-22. Podklady: report-3, redaktor-3, review-2, log.md, developer-rules.md, README. Adresa pro všechny **http://127.0.0.1:8791/**.

## Verdikt
Redaktor poprvé **ANO bez „těsně“** (4:37, výrok 38 s, 3/13 titulků špatně, oprava 1:54); přesný model pomáhá (18:16: 1 chyba místo 6).
Zbývá: titulek „stalo.“ nejde smazat (75 s); slova na krajích (V5 „to.“, V3 úlomek, V2 „Tak“); přesný přepis jen na procesoru (10,8 min, 96 % CPU, 5 GB) – notebook neměřen.
Nasazené opravy (mwr44gqo) se nezadávají, živě se ověří v úkolu 2. Pořadí: měření první.

## Úkol 1 – Přesný přepis na redakčním notebooku: změřit a rozhodnout (UX: ano – jen texty)
**Co chci:**
1. Simulace: samostatný Chrome s vlastním `--user-data-dir`, afinita 4 a 8 logických CPU (`start "" /affinity 0xF …` / `0xFF`), `window.__pzAsrWorkers = 1`,
   nový `window.__pzAsrThreads = N`; vzorek 5min výřez Šimková 18:00–23:00 (nový soubor, jiný otisk).
2. Tabulka: profil (4/8 CPU) | model | první stažení (MB, s) | příprava | přepis 5 min | odhad 28 min (×5,6) | odhad notebook (×1,5, **označit jako odhad**) | CPU % | RAM stránky.
3. Rozhodnutí: Přesné výchozí, kde odhad 28 min **≤ 14 min**; jinde Standardní hned, po dokončení v Přepisu věta + tlačítko „Přepsat přesněji (asi X min, můžeš dál pracovat)“
   (odhad z naměřené rychlosti); hranici „slabý počítač“ podle tabulky; automaticky na pozadí **nespouštět**.
4. Odhad času poctivý: včetně přípravy, po prvním okně přepočítat podle skutečné rychlosti.
5. Příprava 124 s při modelu v OPFS: zjistit proč, opravit, nebo pravdivě v dialogu.
6. README (max 5 řádků): jak to Petr změří na skutečném notebooku bez instalace.
**Hotovo, když:** (1) tabulka 4 běhů v logu; (2) rozhodnutí, hranice, důvod; snímky `shots-dev-3/r1-*-<profil>.png`; (3) odhad v dialogu i průběhu ±25 % u každého běhu;
(4) druhé „Přepsat přesněji“ na 20s klipu: příprava ≤ 15 s, nebo pravdivě v dialogu, bez „stáhne 1 GB“; (5) regrese: stanice dál Přesné (čas); (6) bez slov Whisper/model/vlákna/WebGPU.

## Úkol 2 – Kraje výroku: žádné cizí ani chybějící slovo
**Co chci:** první titulek = první slovo první vybrané věty, poslední = poslední slovo poslední věty; ve zvuku nezazní slovo sousední věty; hranice v souvislé řeči
(pauza < 0,08 s) → slovo celé + existující varování; „Přichytit na začátek věty“ u slepené věty neradí mimo výběr (25:43). Bez sluchu: přepis exportovaného zvuku
lokálním modelem (faster-whisper large-v3 / Parakeet) + RMS 30 ms.
**Hotovo, když:** (1) tabulka 6 výroků (V1 18:16, V2 25:51 ruční In i klikem, V3 20:58, V4 23:23, V5 19:59, redaktorův 23:20–23:37): první/poslední slovo titulku vs. přepis |
ticho před/po | cizí slovo zazní – **6/6 bez cizího a chybějícího**, nic useknuté, jinak varování; (2) dalších 10 začátků + 10 konců vět, 0 chybějících, 0 useknutých;
(3) test na „to.“ (V5) a „stalo.“; (4) snímek patičky s varováním u V3 `shots-dev-3/r2-V3-1366x768.png`.

## Úkol 3 – Seznam titulků: smazat, nic neskáče, české uvozovky (UX: ano)
**Co chci:** smazat titulek (Delete na řádku, prázdný text + Enter, „Smazat titulek“ v pravém kliku v seznamu i na ose; jen titulek; jeden krok Zpět);
Esc nechá seznam na místě, Enter hned otevře další a nic se neztratí, ↑/↓ v editaci na sousední řádek, „Opraveno“ sedí i po Ctrl+Z/Y; uvozovky „…“ v titulcích
z přepisu i v opravách (apostrofy nech); dialog „Titulky z přepisu“ stálá velikost od otevření.
**Hotovo, když:** (1) výrok 23:20–23:37 v 9:16: smazání titulku klávesou Delete ≤ 5 s, Ctrl+Z vrátí, Ctrl+Y smaže, platí na ose i v náhledu i po přehrání;
(2) 5 oprav za sebou s psaním hned po Enteru 5/5; po Esc stejný `scrollTop`; 5× ↓ v editaci = o 5 řádků; (3) po 2 opravách „Opraveno: 2“, po Ctrl+Z „1“;
(4) 0 rovných uvozovek v titulcích i .srt; (5) tlačítko „Vytvořit“ stejná poloha 0 ms i 1 s po otevření; (6) regresní průchod 1366×768 i 1040×1100, snímky shots-dev-3, Přepis ≥ 8 řádků.

## Úkol 4 – Přesný přepis bez děr, s větami, které jdou vybrat
**Co chci:** kontrola děr (řeč podle zvuku a > 3 s bez slova, nebo „slovo“ nesmyslně dlouhé) → přepsat znovu v kratším okně, žádná tichá díra; věta > 8 s se v Přepisu
rozdělí na pauze ≥ 0,25 s (přednostně u čárky) na kusy 3–8 s (text ani titulky se nemění); asrFixes a hledání po rozdělení fungují.
**Hotovo, když:** (1) Šimková 28 min Přesné: úvod 0–25 s má slova (≥ vět jako Standardní); skript v `test/` vypíše úseky s řečí bez slov > 3 s → **0** (před ≥ 1), výstup v logu;
(2) žádná věta > 8 s kromě míst bez pauzy (počet a seznam); výrok 25:51–26:10 klikem + Shift+klik, In ±0,3 s od nástupu „Tak“; (3) test rozdělení + oprava + hledání;
(4) `node test/asr-wer.js` na nové referenci není horší než v report-3 (v aplikaci 9,1 % / 10,7 %).

## Úklid (≤ 10 min)
Testerovy opravené reference z report-3 do `test/asr-ref/` + přepočítat WER; `__pzDevExport` přípona .mp4.

## NEDĚLAT
Přesné na grafice; automatický přesný přepis na pozadí (hledání v rozpracovaném přepisu jen zjistit); nové funkce (klik na slovo = In/Out, časový kód, dialog Exportu,
Opus/AAC, názvy sekvencí, opravy pro AI, tolerantní hledání, nejistá slova); přenášet smazání titulku do přepisu; drobnosti [1] mimo zadání; desktop, konektory,
captionlayout.js styly; nic mimo počítač, žádné jméno, vše vratné; **commit jen na Petrovo přání – navrhnout první commit stavu před kolem 3**.
Do log.md ke každému úkolu všechna kritéria ✔/✘/„neověřeno“; stav pro testery (developer-rules 9).

## Zadání pro testera – kolo 4
127.0.0.1:8791, Šimková 28 min + 5min výřez (cesta v logu), bez AI, čistý projekt, váhy 1–3; report-4.md + shots-4/.
1. Simulace notebooku (afinita 4/8, vlastní profil, `__pzAsrThreads`): stažení, příprava, přepis výřezu, odhad vs. skutečnost, co aplikace nabídla, CPU/RAM, plynulost Zdroje (getVideoPlaybackQuality).
2. Kraje výroku: V1–V5, redaktorův 23:20 a 4 nové – první/poslední slovo, kontrola exportu lokálními modely, RMS; nic cizího/chybějícího/useknutého; varování u souvislé řeči.
3. Seznam titulků: smazat (Delete, prázdný Enter, pravý klik, osa), Ctrl+Z/Y, rychlé psaní po Enteru, Esc, ↓, „Opraveno“, uvozovky v titulcích i .srt, dialog bez poskočení.
4. Přepis: úvod 0–25 s, věty > 8 s, výběr 25:51 klikem, hledání a oprava po rozdělení vět.
5. Regrese 1366×768 a 1040×1100: celý průchod; WER na nové referenci.

## Zadání pro redaktora TN – kolo 4
**„Ráno přišel nový rozhovor (5min výřez, ještě bez přepisu). Máš redakční notebook. Do porady Reels 15–20 s, titulky bez chyb, nadpis, bez AI.“**
Vývojář nastaví simulaci 8 CPU a výřez (cesta v logu); jiný výrok než v kolech 2 a 3; redaktor-4.md + shots-redaktor-4/.
Čekání na přepis zvlášť (co aplikace říkala, rozuměl jsi, čekal bys, použil bys „Přepsat přesněji“); čas import → uložení, nalezení výroku, oprava; kolik titulků špatně,
šlo smazat nepatřičný titulek; **ANO/NE na svém notebooku**; poslal bys bez úprav / po opravách; export přes menu (blokace → napsat, neobcházet).
**Cíl kola 4:** ANO i na simulovaném notebooku s novým klipem, celkem pod 10 min včetně čekání na přepis, oprava pod 1 min, žádný titulek, který nejde opravit/smazat.

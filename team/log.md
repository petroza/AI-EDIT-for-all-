# Log týmu (tester → vlastník → vývojář)

Každé kolo: tester (team/reports/report-N.md) → redaktor TN (team/reports/redaktor-N.md) → vlastník
(team/tasks/tasks-N.md) → vývojář implementuje, ověří, nasadí na https://pz-ai-cut.pages.dev a sem zapíše výsledek.
Cíl: pro všechny v týmu jednoduchý a velice užitečný nástroj; redaktor se musí hned zorientovat.
UX designér (team/ux-designer.md, znalosti team/design/knowledge.md) navrhuje vzhled a ovládání pro úkoly označené
„UX: ano“ (team/design/design-N.md + mockupy).
Nad týmem ředitel projektu (team/director.md): po každém kole hodnotí členy (team/reviews/review-N.md), slabého
vymění (přepíše jeho roli) a určí zaměření dalšího kola. Vývojář čte team/developer-rules.md (pokud existuje).

## Stav před 1. kolem (2026-11-21)
Hotovo: web + desktop, AI přes Claude Desktop / Codex (konektor), výřez podle obličeje (MediaPipe), všechny formáty
pro sítě, nadpis nahoře, okno Text v obraze, karaoke titulky, bezpečné zóny, Export verzí pro sítě, průběžný přepis,
souběžný přepis, ochrana více karet, úvodní obrazovka, Nápověda → Jak na video pro sítě.
Známá omezení: přesnost střihu na webu ±0,2 s; přepis na webu ~1–1,5× délka záznamu.

## Kolo 1 (2026-11-21)
Podklady: report-1 (tester), redaktor-1 (verdikt **NE** – titulky bez AI nejdou, výrok nejde najít), tasks-1 (vlastník),
design-1 (UX designér). Nasazeno: https://pz-ai-cut.pages.dev (verze app.js?v=mwqyvxza). Desktop restartován, naběhl bez chyb
(záložka Přepis tam skrytá – přepis v aplikaci je jen na webu).

### Vývojář – co je hotové a ověřené
**Úkol 1 – přepis bez AI** (web/ai/transcripts.js, web/ai/bridge.js → `window.__pzASR`)
- Přepis se spustí sám po importu i bez AI (volba výchozí zapnutá; je i v prázdném stavu záložky Přepis).
  Změřeno: stav „přepisuji“ do **0,5 s** po importu; průběh u klipu (štítek „Přepis 45 %“ + proužek), v nadpisu záložky a v pruhu
  záložky s odhadem času („zbývá asi 2 min“, prvních 20 s „odhaduji čas…“). 28 min rozhovor ≈ 9 min přepisu (2 vlákna).
- Kontextové menu klipu (projekt i osa): Přepsat řeč / Zastavit přepis / Pokračovat v přepisu / Přepsat znovu… (s potvrzením) / Zobrazit přepis.
- **Zastavit: 0,1 s**, pak žádné další události (vlákna ukončena). Hotová část (po 4min úsecích) se ukládá do úložiště
  prohlížeče – **Pokračovat naváže**: ověřeno 14 % → pokračuje od 14 %; dokonce po F5 navázal na 71 %.
- **Stejný obsah = hotový přepis**: identita podle obsahu (otisk začátku/středu/konce + velikost), ne jména. Druhý import téhož
  videa pod jiným jménem: přepis hotový za **0,4 s**, bez přepisování.
- Síť: kromě jednorázového stažení modelu žádný požadavek mimo počítač (Performance resource list prázdný).
- Texty o přepisu sjednoceny (design-1 §7): nápověda „Jak na video pro sítě“ (nový krok „Najdi výrok“ a „Titulky“),
  úvodní karta („Řeč se přepíše sama. Výrok najdeš v záložce Přepis…“), AI panel („Řeč se přepisuje tady, i bez AI…“).

**Úkol 2 – záložka Přepis** (nový src/ui/transcript-panel.js; záložka vedle Projekt, rozvržení beze změny)
- Věty s časem, hledání bez diakritiky a velikosti písmen (Ctrl+F odkudkoli; „snidane“ → 4× „Snídaně“), fráze i přes hranici vět,
  ▲▼ / Enter, nález zvýrazněný, nic se nefiltruje; během přepisu se text doplňuje.
- Klik = In/Out na hranicích věty, Shift+klik = víc vět, dvojklik = přehrát výběr; patička „2 věty · 0:19 · ▶ Přehrát ·
  Vložit do sekvence“ (bez sekvence „Vložit do nové sekvence“ → dialog s předvyplněným úsekem).
- Najít výrok a nastavit In/Out: **pod 30 s** (Ctrl+F, slovo, klik, Shift+klik) – automatem, bez poslechu.
- Ruční In/Out uprostřed věty → v liště Zdroje „⚠ Uprostřed věty [Přichytit]“; Přichytit rozšíří na celou větu (ověřeno: Out 202,48 → 203,65).
- **Hranice podle zvuku (nový algoritmus)**: pauza = 60ms okno 15 dB pod řečí; když v okně u odhadu pauza není, hledá se nejbližší pauza
  směrem VEN (kousek ticha navíc, ne useknuté slovo). Měření RMS ±40 ms kolem hran, 30 výběrů = 60 hran:
  hran méně než 10 dB pod řečí **24/60 → 9/60**, nad úrovní řeči (přímo ve slově) **2 → 0**. Zbylých 9 = souvislá řeč bez pauzy
  do 0,75 s → panel to řekne: „⚠ Konec padá do souvislé řeči – přidej další větu (Shift+klik)“.
  ⚠ Poslechem jsem to ověřit nemohl (nemám sluch) – **tester/redaktor ať poslechnou hranice**.

**Úkol 3 – titulky z přepisu bez AI**
- Sekvence → Titulky → **Vytvořit titulky z přepisu…** (první položka), tlačítko v okně Text v obraze (velké, když titulky nejsou;
  „Vytvořit znovu z přepisu…“ když jsou), v AI panelu bez AI **„Titulky (bez AI)“**; „Upravit titulek…“ bez titulků otevře tentýž dialog.
- Jen slova, která v sekvenci zazní; samotné pomlčky (střídání mluvčích) vyřazeny. Dialog: karaoke volba (zapamatuje se),
  varování „Sekvence už má titulky (N). Nahradí se…“, stav „Klip ještě nemá přepis – spustím ho“ → **„Vytvořit, až bude přepis“**:
  ověřeno – klip bez přepisu, titulky vznikly samy po 10 s (stav v liště „Titulky čekají na přepis… 40 %“).
- **Jeden krok Zpět** („Titulky z přepisu“); Ctrl+Z → 0 titulků, Ctrl+Y → zpět. Vytvoření pod 1 s.
- 16:9 → titulky → Auto Reframe 9:16: titulky ve 30 % výšky, **karaoke zůstane** (dřív se při převodu formátu ztratilo – opraveno
  ve web/ai/reframe.js i src/core/pmcp-api.js: zvýraznění, barva a podklad se přenesou, výška/velikost podle tvaru).
- Export 9:16 s vypálenými titulky a nadpisem: team/reports/shots-dev-1/export-916-3s.png, -15s.png (obličej na středu).
  Hlasitost **−14,0 LUFS, true peak −1,1 dBTP** (strop limiteru snížen: −1,0 dBFS dával po Opusu −0,8 dBTP).
- Rychlé opravy titulků: **2 kola × 5 oprav (Ctrl+A, psát, Enter), 10/10 uloženo**, i s písmeny L/A/S/J (zkratky). Příčina dřívější ztráty:
  psaní začínalo 30 ms po kliknutí → první písmena šla jako zkratky (L = přehrát…). Teď okamžitě. (Třetí kolo neprovedeno.)

**Úkol 4 – čistý začátek**
- Nový projekt: žádná lišta Nenalezená média, smazaná automatická záloha, monitor/osa/projekt vyčištěné. Export nové sekvence po
  projektu s nadpisem „STARY NADPIS“: **bez textu** (shots-dev-1/novy-projekt-export.png). „Neviditelný text“ = skrytý starý nadpis
  v DOM – teď se maže.
- Nová sekvence (Ctrl+N): výchozí **prázdná 1080×1920**, předvolba 9:16 první; „Vložit do ní vybraný klip (úsek In–Out, 0:17)“ jen zaškrtnutím;
  celý klip > 2 min → varování. Klip na šířku v sekvenci na výšku vyplní obraz (cover) místo malého pruhu.
- První vložení do prázdné sekvence: osa přiblížená, úsek přes **93 %** šířky (opravena chyba: přiblížení běželo, když osa ještě měla šířku 0).
- „,“ / „.“: automat testera posílá klávesu s prázdným `code` → nic se nestalo. Teď i podle znaku (`e.key`). Skutečnou českou klávesnici
  jsem fyzicky nezkoušel (skutečný stisk posílá `Comma`, to fungovalo vždy).
- Drobnosti z p_bugs1 nasazené: lišta pod menu (z-index), limiter, české předvolby a štítek zón, Průzkumník skrytý na webu, hláška u Poslat AI bez AI.

### Neprošlo / zbývá (otevřeně)
- Hranice: 9/60 hran v souvislé řeči (bez pauzy do 0,75 s) – jen upozornění, nic víc nejde bez přesných časů slov.
- Poslech exportu jsem neudělal (nemám sluch) – úkol 2 bod 3 nechávám na testerovi/redaktorovi.
- Nová sekvence 9:16 bez Auto Reframe = středový výřez (v širokém záběru stůl). Obličej srovná až Auto Reframe.
- Projekt v cestě pořád „Untitled.pzcut“ anglicky (drobnost na příští kolo).
- Chyby rozpoznávání („dosnidaně snovu“) – přepis řeči samotný se v tomto kole neměnil (zadání to zakazovalo).

### Ředitel
Hodnocení: tester 4, redaktor 5, vlastník 4, UX 4, vývojář 4 – bez výměn; vývojáři nová pravidla v team/developer-rules.md
(kontrolní seznam „hotovo, když“; commit jen se souhlasem Petra – zatím žádný). Rizika: přepis ~18 % chybných slov (hrubý odhad
z prvních vět) → titulky se nedají poslat bez oprav; repozitář bez jediného commitu.
Zaměření kola 2: ověření kola 1 redaktorem (cíl ANO, výrok do 2 min) + titulky bez chyb (změřit chybovost, přesnější model
nebo oprava slova na jednom místě; zákaz změny modelu zrušen) + Auto Reframe u střihu kamery 7,64 s. Viz team/reviews/review-1.md.

## Kolo 2 (2026-11-21/22)
Reporty: report-2 (tester – cesta bez AI poprvé celá průchozí; překážka: 6/48 chybných slov ve výroku), redaktor-2 (**ANO, ale těsně**;
7 ze ~13 titulků s chybou, oprava pracná – chybí seznam titulků; AI panel zabírá třetinu šířky).

### Vývojář – opravy z reportů před zadáním (nasazeno, app.js?v=mwqzz3le; testy 17/17)
- ✔ Okno Text v obraze se po Novém projektu / otevření projektu zavře **bez uložení** (dřív šlo propsat „STARY NADPIS“ do nového projektu).
- ✔ Nový projekt vyčistí stavový řádek a čekající zadání pro AI (`__pzAI.clearTasks`).
- ✔ „,“ do prázdné sekvence: klip od levého okraje osy (0 px), 422/452 px (dřív odscrollováno o 362 px).
- ✔ Auto Reframe na sekvenci, která už je 9:16: výřez podle obličeje přímo v ní + hláška („obličej v 4 z 4 záběrů“), jeden krok Zpět.
- ✔ Nová sekvence: Enter = OK, fokus v názvu. ✔ „Bez názvu.pzcut“ místo „Untitled.pzcut“ (cesta i návrh názvu při ukládání).
- ✔ Dialog ukládání projektu: vlastní typ souboru (Chrome už nepřidá *.exe/*.com/*.bin).
- ✔ Příklad v poli nadpisu obecný („Ministr: Daně zvyšovat nebudeme“), tlačítko Přepis na úvodní kartě otevře jediný klip.
- ✔ Testy nové logiky (developer-rules 5): `pauseNear` (20ms díra ve slově není pauza, souvislá řeč → ok:false) a `clipWords` (jen slova z klipu, čas sekvence).
- Desktop: bez změny chování (záložka Přepis tam není); nové funkce Auto Reframe v sekvenci / pauseNear jsou webové.

### Vývojář – zadání tasks-2 (nasazeno 2026-11-22, app.js?v=mwr1dqf9; `node test/run-tests.js` 23/23; commit žádný – čeká na Petra)

**Úkol 1 – Přesnější přepis, změřený na pevném vzorku**
| model | WER 18:00–20:00 | WER 25:51–26:10 | 28 min na tomto PC | stažení |
|---|---|---|---|---|
| Standardní (whisper-small q8, 2 vlákna) | **19,0 %** | **26,3 %** | ~8 min (kolo 1) | 238 MB |
| **Přesné (large-v3-turbo q8, procesor, 2 vlákna)** | **6,4 %** | **10,5 %** | **652 s = 10,9 min** (skutečný běh celého rozhovoru) | 1 037 MB |
| Přesné na grafice, q4 (zkouška) | 11,0 % | – | ~8 min (odhad z 2 min) | 727 MB |
| Přesné na grafice, fp32 kodér (zkouška) | – | – | nenačetlo se (2,4 GB kodér) | 2 752 MB |
- ✔ 1 tabulka výše (`node test/asr-wer.js`, reference `test/asr-ref/*.ref.txt` s `[?]` u nejistých míst).
- ✔ 2 výrok 18:16–18:32: Standardní **8/52** chybných slov, Přesné **3/52** (zvládá→navíc, jako→navíc, stráta).
- ✔ 3 rozhodnutí: **Přesné je výchozí** – chybovost o 66 % nižší (19,0 → 6,4 %) a 28 min za 10,9 min (≤ 12). Grafika zamítnuta
  (q4 = 11 %, fp32 se nenačetl). Slabý počítač (< 8 vláken nebo < 8 GB paměti) = Standardní. (Kdo má v prohlížeči uloženou
  dřívější volbu „Standardní“, zůstane mu – výchozí je jen pro nové.)
- ✔ 4 „Přepsat přesněji…“ (kontextové menu + menu ≡ Přepisu, dialog podle design-2 §3.3): během přepisu hledání ve starém (5 110 slov,
  standardní) funguje; po dokončení nový přesný přepis (4 984 slov); titulky beze změny (žádný nový krok v historii, texty shodné).
- ✔ 5 simulace slabého počítače (`window.__pzAsrWeak`): přepis běží Standardním a panel napíše „Na tomto počítači jde jen standardní
  přepis – přesný by trval příliš dlouho.“ (podmínka „bez WebGPU“ přestala dávat smysl – Přesné běží na procesoru).
- ✔ 6 síť: hlavní stránka nemá žádný nový požadavek ven (Performance: jen dosavadní CDN knihovny jsdelivr); model se stahuje ve vlákně z huggingface.co.
- ✔ 7 testy: WER (`test/asr-wer.js`), opravy přepisu, hák, karaoke, hledání úseku – 23/23.
- **Nalezená chyba navíc:** Cache API soubory velkého modelu (615 a 420 MB) neukládalo → model by se stahoval (1 GB) při každém otevření
  stránky a 2 vlákna ho stahovala souběžně. Oprava: vlastní mezipaměť v OPFS (`whisper-worker.js`), první vlákno stáhne, druhé
  načte z disku (~2 s). Stažení hlásí součet MB („Stahuji rozpoznávání řeči… 461 z 1037 MB · jen jednou“), z disku jen „Připravuji…“.
- **Pravděpodobnost slov** (zjištění, nestaveno): transformers.js 3.8.1 ji v pipeline nevrací (`output_scores` dává jen souhrn);
  šla by zaznamenat vlastním LogitsProcessorem ve vlákně (softmax vybraného tokenu, greedy) – odhad ~1 h práce.

**Úkol 2 – Seznam titulků, oprava na jednom místě** (nový `src/ui/caption-list.js`; záložka Projekt | Přepis | **Titulky**)
- ✔ 1 jen klávesnicí (1 klik do seznamu, pak Enter / Ctrl+A / psaní / Enter): **6 oprav za 18,5 s**, 6/6 uloženo (ve vzorku se standardním
  přepisem bylo chybných 6 titulků, redaktorovo „7“ byly dvě poloviny jednoho). S přesným přepisem má tentýž výrok chyby jen ve 2 titulcích.
- ✔ 2 po opravě „neříkat“→„neříkejte“ najde hledání v Přepisu nové slovo (1/1) a staré „neříkat tyhle“ ne (Nenalezeno).
- ✔ 3 „Nahradit titulky“: opravy zůstaly (varování v dialogu nově: „…tvoje opravy textu zůstanou, protože se ukládají i do přepisu“).
- ✔ 4 Ctrl+Z vrátí opravu v titulku i přepisu (oprava se ukládá do `project.asrFixes`, součást kroku Zpět); Ctrl+Y zpět.
- ✔ 5 dlouhá oprava se rozdělila na 2 titulky, seznam je hned ukázal a psaní pokračovalo až za oběma polovinami.
- ✔ 6 1366×768: patička Titulků dole 745 px (limit 746), Program 668–1330 × 32–403 nepřekrytý; 1040×1100: patička 1077 px (limit 1078).
  Snímky: panel prohlížeče je jen 434 px široký – místo snímků měření (výše).
- ✔ 7 česky; barvy a kontrasty z design-2 (≥ 4,5 : 1), cíle ≥ 24 px (řádek 26, ▶ 24, tlačítka 28).
- Navíc: F2 = oprava titulku pod hlavou; oprava v náhledu jde stejnou cestou (i do přepisu); po vytvoření titulků se záložka Titulky ukáže sama.
- Pozn.: opravy přepisu přežijí i „Přepsat přesněji“ (navazují na čas a text). AI nástroje (Claude/Codex) zatím čtou přepis bez oprav.

**Úkol 3 – Obrazovka bez AI**
- ✔ 1 1366×768 bez AI: časová osa **69 %** šířky okna, vložený 20s úsek **95 %** osy (pruh AI 36 px; ✦ AI + tečka stavu; » v panelu sbalí).
- ✔ 2 Text v obraze je záložka v rámu Zdroje (`Zdroj | Text v obraze ×`): Program nepřekrývá; dialog Exportu s otevřeným Textem v obraze –
  0 z 10 ovládacích prvků překrytých.
- ✔ 3 první import do čistého projektu sám otevře klip ve Zdroji a záložku Přepis; „Přepis“ na kartě vybere Zdroj → jediný → vybraný →
  poslední; klik na štítek „✓ Přepis / Přepis 45 %“ u klipu otevře Přepis toho klipu.
- ✔ 4 patička Přepisu: 1366×768 tlačítka dole 623 px, 1040×1100 dole 837 px (v úzkém rámu dva řádky: ▶ ikona, Vložit přes celou šířku).
- ✔ 5 s připojenou AI (desktop – Claude připojen): panel AI otevřený jako dřív, nic rozbité. Web: AI se připojí → panel se otevře (pokud ho uživatel sám nesbalil).
- ✔ 6 desktop uvidí: záložku Titulky (opravy jen v titulcích), Text v obraze v rámu Zdroje, pruh AI (zůstává otevřený, je připojený); Přepis a volbu přesnosti ne.
- Příklad v poli nadpisu „Ze Snídaně…“ v kódu nebyl (byl tam „Ministr: …“) – nejspíš našeptávač prohlížeče → pole má `autocomplete="off"`, příklad „Starostka: Most bude hotový v létě“.

**Úkol 4 – Hák bez ticha, karaoke na řeči** (cutBounds `tightenIn/tightenOut`, `speechAlign` pro titulky)
Měření 20 výběrů (1 nebo 2 věty; mezi nimi 18:16 a 25:51), RMS 30 ms, práh řeči −15 dB:
- ✘/✔ 1 ticho před prvním slovem 0,05–0,30 s: **14/20** (zbytek 0,00–0,04 s = předchozí řeč končí těsně před začátkem věty, dál nejde).
  Doznění 0,10–0,35 s: **8/20** – u ostatních přichází další slovo dřív než za 0,15 s (konec je pak 0,05 s před ním) nebo jde o souvislou řeč.
- ✔ 2 hrany nad úrovní řeči: **0/40**; méně než 10 dB pod řečí **4/40 = 10 %** (kolo 1: 9/60 = 15 %).
- ✘/✔ 3 karaoke – začátek prvního slova ±0,15 s od nástupu řeči: **14/20** (odchylky 0,18–0,25 s tam, kde výběr začíná slovem z konce předchozí věty).
- ✔ 4 výrok 18:16: první slovo titulku „Tady“ (slovo „to.“ v tichu vypadlo).
- ✔ 5 testy: `tightenIn/tightenOut` (nástup −0,15 s, doznění 0,2 s, ne do další řeči), `speechAlign` (slovo v tichu pryč, fráze od nástupu).
- 6 slova uvnitř souvislé řeči změřit nejdou – **předávám testerovi** (poslech/snímky po 0,1 s).

**Kontrola Auto Reframe u střihu kamery (kolo 1, 7,64 s):** sekvence z kola 1 už neexistuje; místo nalezeno podle titulku „Takže zlomilo?“
(zdroj 88–100 s). Současný kód: střihy kamery 5,64 / 7,08 / 8,2 s rozříznuté, obličej ve všech 4 záběrech ve středové třetině
(shots-dev-2/reframe-cut-new.png 7,5 / 7,7 / 8,0 s; srovnání se starým exportem kola 1: reframe-cut-old-kolo1.png; kontaktní arch reframe-88-100-contact.png).
Pozor na test: export hned po vzniku sekvence 9:16 zachytí stav před výřezem (převod běží ještě pár sekund) – tester ať čeká na hlášku.

### Ředitel
Hodnocení: tester 5, redaktor 4, vlastník 4, UX 4, vývojář 3 (poprvé 3 – další 3 = výměna) – bez výměn; developer-rules doplněna o body 7–10
(povinné snímky, regresní průchod 1366×768/1040×1100, stav modelu pro testery, automatika nesmí mazat slova). Nalezeno: seznam Přepisu má při 1366×768
jen 17 px (pod ním panel Titulků, CSS `.show-tr .tr-pane`); „Tak“ z #361 vypadne z titulků a po opravě je v přepisu „Tak Tak“; testovací prohlížeč
je na Standardním modelu bez přesného přepisu. Zaměření kola 3: opravit regrese, redaktor s přesným modelem (ANO bez „těsně“), změřit přesný přepis
na redakčním notebooku. Petrovi doporučen první commit. Viz team/reviews/review-2.md.

### Vývojář – opravy regresí z review-2 (nasazeno, app.js?v=mwr28dp2; testy 24/24; `node --check` sestaveného app.js)
Regresní průchod (developer-rules 8) v **čistém profilu Chrome** (`test/shot.js`, CDP, přesná velikost okna), snímky `shots-dev-2/r00–r07-*-<rozlišení>.png`:
| krok | 1366×768 | 1040×1100 |
|---|---|---|
| start čistý profil (r00) | panel AI sbalený, výchozí Přesné ✔ | – |
| import → Přepis sám (r01/r02) | stahování „63 z 1037 MB · jen jednou“; seznam vět **202 px ≈ 11 řádků** (dříve 17 px) | 361 px ≈ 20 řádků ✔ (i když byla předtím otevřená záložka Titulky) |
| hledání + klik/Shift+klik (r03) | „jiná možnost“ 1/1, „3 věty · 0:06“, patička dole 745 (limit 746) ✔ | 1077 (limit 1078) ✔ |
| Vložit do nové sekvence (r04) | 1080×1920, **obličej na středu sám** (posX 0,26), úsek 95 % osy, osa 69 % ✔ | 93 % / 60 % ✔ |
| Titulky (r05) | záložka Titulky sama, Přepis skrytý, patička 745 ✔ | 1077 ✔ |
| oprava v řádku (r06/r07) | „Nevejde se do 2 řádků – rozdělí se na 2 titulky“, po Enteru 2 titulky; přepis „Tak neříkejte…“ bez zdvojení ✔ | – |
| export s otevřeným Textem v obraze (r06-export) | 0/9 prvků překrytých ✔ | 0/9 ✔ |

Opravy:
- ✔ Záložka Přepis ukazovala i panel Titulků (CSS `.show-tr .tr-pane`) → `#trPane`.
- ✔ „Slovo v tichu“ už nemaže vyslovená slova: vypadne jen konec předchozí věty v úplném tichu / úlomek věty na kraji klipu,
  když hranice klipu leží v pauze. Ověřeno na 10 větách (2min vzorek): **chybí 0 slov** v 10/10; cizí slovo navíc
  ze sousední věty ve 3/10 (dříve 5/10; rychlá řeč, časy slov posunuté o slovo – ověří tester poslechem).
- ✔ Oprava titulku s dopsaným slovem na kraji („Tak neříkejte“) už slovo v přepisu nezdvojí (test).
- ✔ Volba přesnosti: nový klíč `pzAsrQuality2`; stará uložená hodnota z kola 1 se nečte → v testovacím prohlížeči je teď **Přesné**
  a rozhovor má **přesný přepis** (whisper-large-v3-turbo, 4 980 slov) – ověřeno importem po nasazení (developer-rules 9).
- ✔ Navíc z průchodu: záběr na šířku vložený do prázdné sekvence na výšku má hned výřez podle obličeje (dříve střed = obličej u kraje).
- ✔ Navíc: bez uložené volby jazyka se rozhraní řídí jazykem prohlížeče (cs/sk → česky).
- ✔ Navíc: „jednou za projekt“ (první import otevře Přepis) se po Novém projektu obnoví.
- Chyba, kterou jsem v průchodu sám udělal a chytil: `//` komentář uprostřed jednořádkového výrazu rozbil celou aplikaci v čistém profilu
  (jen lokálně, nenasazeno) → před každým nasazením `node --check web/dist/app.js`.
Stav pro testery kola 3: testovací prohlížeč (panel Claude) = Přesné, rozhovor přepsaný přesně, jazyk čeština.

## Kolo 3 (2026-11-22)
Reporty: report-3 (tester – přesný model pomáhá: výrok 18:16 1 viditelná chyba místo 6; WER s opravenou referencí Přesné 7,8 % / 7,1 %, v aplikaci 9,1 % / 10,7 %,
Standardní 20,2 % / 23,2 %; přesný jen na procesoru 10,8 min / 96 % CPU / 5 GB RAM; slova na krajích „Tak“, „to.“ vypadávala; přesný přepis vynechal úvod 25 s),
redaktor-3 (**ANO** – poprvé bez „těsně“; 4:37 import → uložení, výrok 38 s, 3/13 titulků špatně; nejde smazat titulek „stalo.“ z předchozí věty).

### Vývojář – opravy z report-3 před zadáním (nasazeno, app.js?v=mwr44gqo; testy 24/24, `node --check` app.js)
- ✔ Příčina „testovací prohlížeč neměl přesný přepis“: tester pracoval na `localhost:8791`, vývojář na `127.0.0.1:8791` – pro prohlížeč dvě různé adresy
  s odděleným úložištěm. Role testera/redaktora/ředitele/UX/vlastníka sjednoceny na `127.0.0.1:8791`. (Na localhost teď přesný přepis je – udělal ho tester.)
- ✔ Slova na krajích výroku: úlomek sousední věty vypadne jen když mezi hranicí klipu a hlavní větou NEZAZNÍ řeč (dlouhé slepené věty / ruční In: „Tak“
  zůstane; test). Začátek bez nádechu (méně než 0,08 s ticha) → cutBounds `inOk=false` → patička Přepisu „Začátek je v souvislé řeči…“ (V3).
- ✔ Česky: výchozí název sekvence „Sekvence“, typ souboru „Projekt PZ AI Cut“; hláška „zadání počká“ zmizí po smazání zadání;
  dialog „Přepsat přesněji“ píše „stáhne 1 GB“ jen když model v úložišti není.
- Neověřeno živě (čeká na regresní průchod kola 3): titulek „stalo.“ z redaktor-3 (výběr kliknutím na věty) – nová pravidla ho vyřadí, jen když In leží v pauze.

### Vývojář – zadání tasks-3 (průběžně; nasazení až po ověření)
**Úklid:** ✔ testerovy reference z report-3 v `test/asr-ref/` – WER: Přesné 7,8 % / 7,1 %, Standardní 20,2 % / 23,2 % (shodně s report-3);
✔ `__pzDevExport` vždy s příponou .mp4.

**Úkol 1 – Přesný přepis na notebooku** (`node test/notebook.js <cpu> <model>`: headless Chrome `start /affinity`, vlastní profil = první stažení,
`__pzAsrWorkers=1`, nový `__pzAsrThreads=N`; vzorek `O:\TN_strihatko\test\media\vyrez-5min.mp4` = Šimková 18:00–23:00; výsledky web/test-out/nb-*.json)
| profil | model | první stažení | příprava | přepis 5 min | odhad 28 min (×5,6) | **odhad notebook (×1,5 – ODHAD)** | CPU % povolených jader | RAM prohlížeče |
|---|---|---|---|---|---|---|---|---|
| 4 CPU | Standardní | 240 MB / 29 s | 13 s | 119 s | 11,1 min | 16,6 min | ~113 % (plně) | 1,9 GB |
| 4 CPU | Přesné | 1037 MB / 116 s | 27 s | 282 s | 26,3 min | 39,5 min | ~111 % | 3,3 GB |
| 8 CPU | Standardní | 240 MB / 32 s | 11 s | 96 s | 8,9 min | 13,4 min | ~114 % | 2,1 GB |
| 8 CPU | Přesné | 1037 MB / 113 s | 19 s | 180 s | 16,8 min | 25,3 min | ~115 % | 3,3 GB |
| 16 CPU | Přesné | (stažení) | 15 s | 133 s | **12,4 min** | 18,6 min | ~114 % | 3,2 GB |
| 32 (stanice) | Přesné | – | – | – | **10,8–10,9 min** (skutečný běh 28 min, kolo 2/3) | – | 96 % | 5 GB |
CPU nad 100 % = měřeno časem procesu na povolená jádra (plné vytížení + režie). Odhad aplikace v průběhu přepisu: odchylka **−18 až +7 %** u všech 5 běhů
(kromě posledních sekund) ✔ (±25 %).
- ✔ **Rozhodnutí** (pravidlo ≤ 14 min pro 28 min): **≥ 16 logických CPU → Přesné výchozí**; **4–15 CPU → Standardní hned + po dokončení nabídka**
  „Přesný přepis má asi o polovinu méně chyb. [Přepsat přesněji (asi X min, můžeš dál pracovat)]“; **< 4 CPU nebo < 4 GB paměti → jen Standardní** (věta proč).
  Přesné je 1,9–2,4× pomalejší než Standardní (odhad X = rychlost tohoto počítače, dokud není změřená tabulka podle jader). Automaticky na pozadí se nespouští.
  Výslovná volba v menu ≡ (Přesné/Standardní) má přednost. Simulace pro testery: `window.__pzAsrSlow = true` (pomalejší), `window.__pzAsrWeak = true` (slabý).
- ✔ Snímky: shots-dev-3/r1-nabidka-presneho-8cpu.png (nabídka po standardním přepisu), r1-dialog-prepsat-presneji-1366x768.png, r1-po-presnem-1366x768.png.
- ✔ **Druhé „Přepsat přesněji“ na 20s klipu s modelem v úložišti: příprava 8,3 s**, celkem 33 s; dialog: „Nic se nestahuje. Než přepis začne, chvíli se připravuje…“.
  Příčina 124 s v report-3: model v úložišti nebyl (stahoval se znovu – složka pz-models na 127.0.0.1 zmizela). Ochrana: `navigator.storage.persist()`
  – Chrome ji bez interakce uživatele zatím nepovolil (`persisted: false`); když prohlížeč úložiště vyprázdní, ukáže se poctivě „Stahuji… jen jednou“.
- ✔ Příprava v Přepisu: „Připravuji přesný přepis… 0:12 · minule asi minutu“ s běžícím časem a neurčitým pruhem; „příště to jde hned“ odstraněno.
- ✘/⚠ Odhad v nabídce u 20s klipu byl mimo (4 min, rychlost měřená na krátkém klipu) → rychlost se ukládá jen z klipů ≥ 60 s, jinak tabulka; dialog a nabídka
  teď počítají stejně. Pro 5min klip na 8 CPU vychází odhad nabídky 230 s vs. skutečnost 199 s (+16 %) ✔.
- ✔ Regrese stanice: 32 vláken → Přesné výchozí (ověřeno v čistém profilu: `q: accurate`).
- ✔ README: 5 řádků, jak změřit na skutečném notebooku.

**Úkol 3 – Seznam titulků** (regresní průchod v čistém Chrome, 1366×768 a 1040×1100, shots-dev-3/r3-*)
- ✔ 1 smazání klávesou Delete: **13 ms**, patička „Smazán titulek „…“ [Vrátit]“, Ctrl+Z vrátí, Ctrl+Y smaže; v náhledu na tom místě titulek není. Také prázdný
  text + Enter (pod polem „Prázdný titulek – Enter ho smaže, Esc vrátí text“), pravý klik v seznamu i na ose („Opravit / Smazat titulek“), prázdná oprava v náhledu.
- ✔ 2 5 oprav s psaním hned po Enteru: **5/5**; Esc: scrollTop 40 → 40; 5× ↓ v editaci: řádek 2 → 7.
- ✔ 3 „Opraveno“ podle historie: po 5 opravách 5, po Ctrl+Z 4.
- ✔ 4 české uvozovky (`czQuotes`, test); ve vzorku 25:51 přesný přepis uvozovky nemá → ověření na redaktorově výroku 23:20 v testovacím prohlížeči (viz níže).
- ✔ 5 tlačítko v dialogu Titulky z přepisu: posun 0 / 0 px mezi 0 ms a 1 s.
- ✔ 6 Přepis 1366×768: 202 px ≈ 11 řádků, 1040×1100: 361 px ≈ 20 řádků; patička Titulků 1077/1078.

**Úkol 2 – Kraje výroku** (výběr klikem na věty → cutBounds → slova titulků; porovnání prvního/posledního slova s větami; lokální model na exportu NEPOUŽIT – ověří tester)
| výrok | 1. slovo věty / titulku | poslední | cizí / chybějící | varování |
|---|---|---|---|---|
| V1 18:16 (celý rozhovor) | Tady / Tady | dál. / dál. | – / – | – ✔ |
| V2 25:51 | tak / **neříkat** | film.“ ✔ | – / **„tak“** | – ✘ |
| V3 20:58 | My / **vůbec.** | životě. ✔ | **„vůbec.“** / – | **ano** (souvislá řeč) ✔ podle zadání |
| V4 23:23 | Zrovna / Zrovna | furt. / furt. | – / – | – ✔ |
| V5 19:59 | My / My | to. / **zvládnout** | – / **„to.“** | – ✘ |
| redaktor 23:20 | Ale / **stalo.** | to. / **A** | **„stalo.“, „A“** / – | začátek ano; konec teď také (nové pravidlo) |
- Výsledek: **2/6 čisté, 2/6 cizí slovo s varováním (souvislá řeč), 2/6 chybí krátké krajní slovo (✘)**. Uvozovky „…“ v titulcích ✔.
- Zkoušeno a vráceno: zúžit okno pauzy u krátkého krajního slova / odmítat pauzu, za kterou zní řeč – časy slov z přepisu jsou nepřesné oběma směry
  (na 5min výřezu se V1 zhoršil o „A hlavně“). Ponecháno: varování, když hranice skončí za slovem sousední věty (`inOk/outOk = false`).
- ✔ 3 testy: „to.“ na konci zazní → zůstane, „stalo.“ z předchozí věty v pauze → vypadne (`dropEdgeFragments`).
- ✘ 2 (10 + 10 začátků/konců lokálním modelem) – neprovedeno, **předávám testerovi** (má faster-whisper large-v3 a Parakeet).
- ✘ 4 snímek varování u V3 – nepořízen (prohlížeč byl obsazený přepisem), předávám testerovi.
- „Přichytit na začátek věty“ u slepené věty: věty > 8 s se teď dělí (úkol 4), takže „začátek věty“ je blíž; samostatně neověřeno.

**Úkol 4 – Přesný přepis bez děr, kratší věty** (`test/holes.js <přepis.json> <video>`)
- Díry (řeč bez slov > 3 s): **před 1** (0:00–0:26, úvod), **po 1** (0:00–0:09,3) – úvod znovu přepsán v kouscích ≤ 12 s: 51 slov, **8 vět místo 3**
  („…Talk. Pozvání dnes totiž přijala má kolegyně… diváci televizenova… TN Live…“), ale prvních 9 s Whisper přepsal jako „www.hradeckralove.cz“ (halucinace
  nad hudbou/pozdravem) – ✘ částečně. Přesný přepis 28 min s kontrolou děr: 963 s (prohlížeč sdílel procesor s měřením).
- Věty > 8 s: **46 → 6** (dělení u čárek a pauz; přepočítává se i u uložených přepisů); zbylých 6 bez čárky i pauzy: 0:00, 3:07, 7:16, 9:06, 19:30, 21:59. ✔ (s výjimkou míst bez pauzy)
- ✔ 3 test: rozdělení věty + oprava titulku + věty po opravě; ✔ test na hledání děr.
- WER na nové referenci (vzorky): Přesné 7,8 % / 7,1 % (beze změny modelu) ✔; v aplikaci na celém souboru nepřepočítáno.

Nasazeno **app.js?v=mwr61fv9** (testy 28/28, `node --check`). Stav pro testery (developer-rules 9): testovací prohlížeč 127.0.0.1:8791 – výchozí Přesné (stanice 32 vláken),
rozhovor přepsaný přesně znovu (s opravenou dírou, 8 vět v úvodu); 5min výřez `O:\TN_strihatko\test\media\vyrez-5min.mp4` (v testovacím prohlížeči bez přepisu);
simulace: `window.__pzAsrSlow = true` (8 CPU – Standardní + nabídka), `window.__pzAsrWeak = true`; notebook: `node test/notebook.js <4|8|16> <accurate|standard>`.
Desktop: beze změny chování (úpravy jsou webové; seznam titulků – mazání a uvozovky – platí i tam).

### Ředitel
Hodnocení: tester 5, redaktor 4, vlastník 4, UX 5, vývojář 3 – **podruhé 3 → výměna způsobu práce**: developer-rules.md nahrazena celá (12 bodů:
zopakovat přesně případ uživatele, strojová ověření sám, titulky podle zvuku, regrese ve všech stavech, tabulka kritérií, kontrola halucinací).
Ověřeno: Delete/Zpět, uvozovky, dialog ✔; redaktorův výrok 23:20 dál začíná titulkem „stalo.“ (podle RMS nezazní), přepis začíná „www.hradeckralove.cz“
a končí „Titulky vytvořil JohnyX.“, Přepis s výběrem jen 4 řádky (1366×768). Zaměření kola 4: redaktor na notebooku pod 10 min; titulky přesně podle zvuku.
Petrovi potřetí doporučen první commit. Viz team/reviews/review-3.md.

## Kolo 4 – vývojář
Pravidla `team/developer-rules.md` (12 bodů, verze po review-3) přečtena 2026-11-22 před začátkem práce. Postupuji podle nich: PŘED/PO na případu uživatele,
strojová ověření sám (test/edges.js), tabulka kritérií u každého úkolu, regrese ve všech stavech (shots-dev-4/rr-*), výsledek v první větě.

**Petrovi: navrhuji první commit** (4 kola, 0 commitů – nasazení bez možnosti návratu). Commit udělám jen na jeho výslovné přání.
Nasazeno: **app.js?v=mwr84vf5** (pz-ai-cut.pages.dev, ověřeno curl). `node test/run-tests.js` **34/34**, `node --check web/dist/app.js` ✔.

### Úkol A – Titulky = to, co v klipu zazní (zaměření 2)
**Výsledek: částečně** – všech 6 pojmenovaných výroků čistých na obou krajích (23:20 bez „stalo.“, V2 s „tak“, V5 s „to.“); na náhodných výrocích
přesného přepisu 87 → 110 ze 144 krajů, standardního 57 → 60 ze 78. Zbývají kraje v souvislé řeči (s varováním) a krátké úlomky slov.
- Příčina (změřeno `test/edges.js`): časy slov z Whisperu v prohlížeči jsou proti zvuku posunuté o −0,2 až +0,6 s; pravidlo „slovo patří do klipu, když jeho střed
  leží v In–Out“ proto bralo slova sousedních vět. Navíc `speechAlign` hledal nástup řeči v dozvuku předchozího slova (fráze o 0,3 s dřív → „tak“, „Takže“ vypadly)
  a pravidlo „slovo v tichu vypadne“ vyhodilo „to.“, které přepis časoval o 0,6 s pozdě.
- Oprava (`web/ai/transcripts.js`): `clipCaptionWords` (sdílí aplikace i test) – hranice klipu v pauze (≥ 60 ms pod prahem nebo hluboký propad ≥ 30 dB pod řečí
  v okolí ±0,12 s) = hranice mezi slovy; kterou mezeru mezi slovy přepisu to je, určí vzdálenost od pauzy, konec věty/čárka má přednost (`edgeWord`). Začátek
  takto jen u přesného přepisu – u standardního vyšlo líp postaru (čas + úlomky v tichu). `speechAlign`: nástup až po ≥ 40 ms ticha. `cutBounds` rozdělen na
  `edgeIn`/`edgeOut`, varování jen podle zvuku (hluboký 60ms propad „stalo. | Ale“ už není „souvislá řeč“).
- Varování bez rady mimo výběr: „⚠ Začátek v souvislé řeči – poslechni, jestli není useknuté první slovo.“ (dřív „přidej předchozí větu“).
- Parametry vyladěny na 2 nezávislých sadách přesného přepisu (2 × 36 výroků) a 3 sadách standardního (5min výřez); mřížka `web/test-out/edges-grid.txt`.
- Rozhodčí v `test/edges.js` = faster-whisper large-v3 (lokálně, GPU) na vyříznutém zvuku [In, Out] + RMS; cache `web/test-out/edges-cache.json`; `--impl` měří
  starou verzi z nasazeného balíčku (PŘED). Rozhodčí sám chybuje („novu“ × „novou“, „k***a“, nejisté slovo na kraji) – ne každé ✘ je skutečná chyba.

PŘED (stará verze) / PO, standardní sada 6 + 10 (přesný přepis rozhovoru, `web/test-out/edges-pred.txt` / `edges-po.txt`):
| výrok | PŘED 1. / posl. titulek | PO 1. / posl. titulek | ve zvuku | PŘED | PO |
|---|---|---|---|---|---|
| V1 18:16 | Tady / dál. | Tady / dál. | Tady / dál. | ✔✔ | ✔✔ |
| V2 25:51 | **neříkat** / film.“ | **tak** / film.“ | tak / film. | ✘✔ | ✔✔ |
| V3 20:58 | vůbec. / životě. | vůbec. / životě. (varování) | (To) vůbec / životě. | ✔✔ | ✔✔ |
| V4 23:23 | Zrovna / furt. | Zrovna / furt. | Zrovna / furt. | ✔✔ | ✔✔ |
| V5 19:59 | My / **zvládnout** | My / **to.** | My / to. | ✔✘ | ✔✔ |
| R 23:20 (redaktor) | **stalo.** / Furt. | **Ale** / Furt. | ale / furt. | ✘✔ | ✔✔ |
| 10 náhodných | 3/10 začátků, 7/10 konců | 7/10, 8/10 | | | |
| **celkem** | **8/16, 11/16** | **13/16, 14/16** | | | |
Větší sady (začátky+konce): přesný seed 777: 41 → 52 ze 72, seed 20261122: 46 → 58 ze 72; standardní (výřez, 3 sady po 13): 57 → 60 ze 78 (začátky 31 → 30, konce 26 → 30).

Případ uživatele jeho cestou (testovací prohlížeč 127.0.0.1, přesný přepis, klik #363 + Shift+klik #369 → Vložit do nové sekvence „K4 R 23-20“ → Titulky z přepisu):
PŘED (review-3) první titulek „stalo.“ + varování „přidej předchozí větu“. **PO: 7 vět, In 1399,76 s, bez varování, 9 titulků, první „Ale jako to uvědomění nekončí,“,
poslední „A to se děje furt. Furt.“** Stejně V2 (#412–415, „K4 V2 25-51“): první „tak neříkat tyhle fádní věci,“; V5 (#317–320, „K4 V5 19-59“): poslední „…zvládnout to.“

| kritérium (zaměření 2 / review-3) | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| skript na 6 výrocích + 10 začátcích + 10 koncích | ✔ | `test/edges.js`, tabulka výše + `web/test-out/edges-po.txt` | vývojář (lokální model) |
| 23:20 bez „stalo.“ | ✔ | edges R ✔✔; v aplikaci klikem 1. titulek „Ale jako…“ | vývojář |
| V2 s „Tak“ | ✔ | edges V2 ✔; v aplikaci „tak neříkat…“ | vývojář |
| V5 s „to.“ | ✔ | edges V5 ✔; v aplikaci „…zvládnout to.“ | vývojář |
| titulky = přesně to, co zazní (všechny kraje) | ✘ částečně | 27/32 krajů standardní sady; zbývá N5 „z“ navíc, N6 „Dobře“ (ráz uvnitř slova), N9 úlomek „spustili“, N10 „ani doma“ | vývojář |
| standardní přepis (výchozí na notebooku) | ✘ částečně | výřez: začátky 30/39 (postaru 31), konce 30/39 (26); V1 na výřezu: In před úlomkem „to.“ (chyba umístění In, ne titulků) | vývojář |
| rada nevede mimo výběr | ✔ | nový text varování (rr-06-vyber-varovani-*) | vývojář |
| test, který by chybu chytil | ✔ | 4 nové testy (stalo. / to. / tak / varování podle zvuku) | vývojář |
| poslech | neověřeno | poslech krajů = lidský úsudek, pro testera | – |

### Úkol B – Halucinace na začátku a konci přepisu (zaměření 2)
**Výsledek: hotovo** – „www.hradeckralove.cz“ (0:00–0:08,6) a „Titulky vytvořil JohnyX.“ (28:01) z přepisu vypadnou, i z už uloženého (při načtení).
- `dropHallucinations`: titulkové podpisy (Titulky vytvořil/připravil/přeložil, Subtitles by, amara.org) vždy; adresa webu jen jako „slovo“ přes 2,5 s
  (Whisper tak přikrývá hudbu). Vyslovené „na web Nova.cz.“ (4:19, 0,5 s) zůstane – první verze ho chybně vyhodila, chyceno kontrolou celého přepisu.
- Automatika nemaže potichu: u počtu vět „· vynecháno 2“, v popisku co a kde (u nízkého okna v popisku pole hledání).
- PO první/poslední 3 věty (přesný): „Talk.“ / „Pozvání dnes totiž přijala…“ / „Je velmi šikovná…“ … „Děkuji moc za pozvání, Kristýnko.“ / „No a vám přeji…“.
  „Talk.“ zůstává (název pořadu TALK – nejspíš skutečně zazní; neověřeno poslechem). Standardní výřez: první/poslední 3 věty bez halucinace.
| kritérium | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| „www.…“ na začátku odstranit nebo označit | ✔ | removed v testovacím prohlížeči: www.hradeckralove.cz 0–8,56 s | vývojář |
| „Titulky vytvořil…“ na konci | ✔ | removed 1681,6–1686,8 s; 450 vět místo 451 | vývojář |
| skutečná řeč zůstane | ✔ | „web Nova.cz.“ zůstává; reference sample-1800/2551 bez nálezu | vývojář |
| test | ✔ | test „halucinace…“ | vývojář |

### Úkol C – Přepis ≥ 8 řádků ve stavu „nabídka + výběr + varování“ při 1366×768 (zaměření 1)
**Výsledek: nesplněno (zlepšeno)** – celé věty v seznamu 0 → 4 (1366×768) a 4 → 7 (1040×1100); seznam 59 → 211 px. Osmi celých vět to nedosáhne, protože
věty standardního přepisu mají v panelu 2–3 řádky textu (~45 px na větu); textových řádků je vidět ~11.
- PŘED (`shots-dev-4/pred/`, čistý profil, 8 CPU, `__pzAsrSlow`): nabídka 2 řádky (84 px), patička = varování na 2 řádky + zalomené tlačítko Vložit (~110 px),
  řádek s názvem klipu 26 px → seznam 59 px = **0 celých vět** (horší než 4 z review-3, ta byla na přesném přepisu s kratšími větami).
- PO: nabídka v jednom řádku („Přepsat přesněji · asi 5 min“ + „o polovinu méně chyb“ + ×, podrobnosti v popisku), patička v jednom řádku, kratší varování,
  při výšce okna ≤ 860 px bez řádku s názvem klipu (název je ve Zdroji, počet vět v poli hledání), monitory 46 % místo 52 %, panel Projekt/Přepis/Titulky
  410 px místo 330 px při šířce ≤ 1500 px, hustší řádky. Úvodní karta v Programu se v nižším monitoru neořízne.
- **Rozhodnutí pro UX/vlastníka:** 8 celých vět při 1366×768 jde jen se zkrácenými řádky (1 řádek + „…“, celé jen u vybraných) nebo s ještě menšími monitory.
  Obojí zhorší něco jiného (čtení textu / náhled videa) – nechávám na design-5.

Regresní průchod `node test/regress.js team/reports/shots-dev-4 --cpu 8 --slow` (čistý profil = první stažení, standardní přepis 5min výřezu 137 s):
| krok-stav | 1366×768 věty / px | 1040×1100 věty / px | PŘED 1366 / 1040 (věty) |
|---|---|---|---|
| 01 stahování (240 MB) | – / 234 | – / 321 | – |
| 02 připravuji | snímky jen v pred/ a iter1/ (podruhé trval pod 0,4 s) | | – |
| 03 přepis 23 % | – / 234 | – / 321 | – |
| 04 hotovo + nabídka | 5 / 242 | 7 / 332 | 3 / 6 |
| 05 hledání | 6 / 242 | 7 / 332 | 2 / 7 |
| **06 nabídka + výběr + varování** | **4 / 211 ✘** | **7 / 302 ✘** | **0 / 4** |
| 07 vloženo do nové sekvence | 4 / 211 | 7 / 302 | 0 / 4 |
| 09 titulky | 5 / 247 | 7 / 363 | 4 / 7 |
| 10 oprava | 5 / 247 | 7 / 363 | 4 / 7 |
| 11 smazání | 6 / 284 | 6 / 400 | 5 / 6 |
| 12 po exportu | 4 / 211 | 7 / 302 | export spadl |
| 13 slabý počítač | 4 / 219 | 7 / 309 | – |
Snímky `team/reports/shots-dev-4/rr-<krok>-<stav>-<rozlišení>.png`, data `regress.json`.

| kritérium | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| ≥ 8 řádků „nabídka + výběr + varování“ 1366×768 | ✘ | 4 celé věty / 211 px (rr-06-vyber-varovani-1366x768.png) | vývojář (DOM) |
| regrese ve všech stavech, obě rozlišení | ✔ (stav 02 jen v pred/, iter1/) | 12 stavů × 2 snímky | vývojář |

### Nalezeno regresí: pád exportu (mimo zadání)
**Výsledek: opraveno** – export sekvence vložené z Přepisu (délka 16,000 000 000 004 s) padal „AudioData: numberOfFrames must be greater than 0“: poslední sekundový
blok zvuku měl 0 vzorků. Bloky se počítají podle počtu vzorků (`audioBlocks` v src/core/util.js, test). PO: export 9,1 MB za 1,4 s (`web/test-out/regress-4-8cpu.mp4`).
Chyba byla v nasazené verzi i dřív – týkala se každé sekvence s délkou těsně nad celou sekundou.

### Stav pro testery (pravidlo 10) a desktop (pravidlo 11)
- Adresa vždy **http://127.0.0.1:8791/**. Výchozí kvalita: ≥ 16 vláken Přesné; 4–15 Standardní + nabídka; simulace notebooku `window.__pzAsrSlow = true`.
- Testovací prohlížeč: projekt „Bez názvu“ (obnovený), média rozhovor.mp4 (soubor chybí) + **rozhovor-k4.mp4** (přesný přepis v IndexedDB, 450 vět, vynecháno 2);
  nové sekvence K4 R 23-20, K4 V2 25-51, K4 V5 19-59 (cizí sekvence beze změny). OPFS: přesný i standardní model.
- Přepisy pro skripty: standardní výřezu `web/test-out/vyrez-5min-standard.json`, přesný rozhovoru `web/test-out/prepis-presny-po.json`.
- Desktop: titulky z přepisu jdou přes panel AI (faster-whisper s přesnými časy slov) – změny krajů, halucinací a exportu (WebCodecs) se ho netýkají;
  rozvržení (CSS) platí i v desktopu.


## Kolo 5 – vývojář (zadání tasks-4, návrh design-4)
**Petrovi: navrhuji první commit** (5 kol, 0 commitů; toto kolo mění vkládání do sekvence a cestu k titulkům). Commit jen na jeho výslovné přání.
Nasazeno: **app.js?v=mwrc8zdt** (pz-ai-cut.pages.dev, ověřeno curl). `node test/run-tests.js` **36/36**, `node --check web/dist/app.js` ✔.
Nové měřicí nástroje: `test/b1.js` (druhý výrok po titulcích), `test/notebook5.js` (notebook import → MP4), `test/edges-web.js` (titulky skutečnou cestou
v prohlížeči → `test/edges.js --rows`), `test/small5.js` (drobnosti úkolu 4); `web/serve.js` umí `PZ_DIST` (PŘED na staženém nasazeném balíčku, port 8792).

### Úkol 1 – Druhý výrok po titulcích nesmí rozbít sekvenci (B1)
**Výsledek: hotovo** – všech 9 kontrol `test/b1.js` ✔ ve 3 variantách (konec, hlava na hranici, tři výroky); PŘED na nasazené verzi kola 4 zopakováno.
- Příčina: „Vytvořit titulky“ přesunulo hlavu na první titulek (0,20 s, uvnitř klipu) a „Vložit do sekvence“ tam klip rozřízlo; titulky před bodem vložení
  se neposunuly. Oprava: z Přepisu se vkládá jen na hranici klipů (hlava ±0,5 s od hranice → tam, jinak na konec; `transcriptInsertPoint`), hlava po titulcích
  zůstane, po vložení do nové sekvence stojí za úsekem, titulek se nenatáhne do dalšího klipu, druhé „Titulky z přepisu“ jen **doplní** klipy bez titulků
  (`uncaptionedRanges`), rozdělené tlačítko „Přidat na konec sekvence / Vložit na hlavu · 0:19 / Vložit na začátek ▾“ (menu ▾ = i „Do nové sekvence…“),
  po vložení „✓ Na konci · 0:16–0:36“ a tlačítko „Doplnit titulky…“ (design-4 §1). Čárka (obecné vkládání) beze změny, z popisku zmizela.
- PŘED (`shots-dev-5/pred/b1-end-*`, nasazená verze kola 4): klipy 0,00 V5 **0,20 s útržek**, 0,20 V2 19,88 s, 20,08 zbytek V5; titulek „My jsme vůbec neměli“ 0,15–1,84 přes V2;
  druhé Titulky z přepisu **přepsaly všechny titulky** („My tak neříkat…“).
- PO (`shots-dev-5/b1-end-*`): klipy 0,00 V5 16,32 s celý, 16,32 V2 19,88 s; titulky V5 beze změny (0,15 „My jsme vůbec neměli“…), 0 přes V2; Doplnit titulky →
  V2 dostal titulky, V5 stejný počet a text; Ctrl+Z vrátí doplnění, druhé Ctrl+Z vložení (klipy i titulky), Ctrl+Y znovu.
| kritérium | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| PŘED: zopakovat t13, časy klipů a titulků | ✔ | výše, `shots-dev-5/pred/b1-end.json` | vývojář |
| žádný klip < 1 s | ✔ | b1 end/boundary/three: noShortClip | vývojář |
| V5 celý od 0,00 s, V2 za ním | ✔ | end: [0–16,32][16,32–36,2] | vývojář |
| titulky V5 stejné časy vůči klipu (±1 snímek) | ✔ | v5CapsSameRel (end i boundary: posun přesně o 19,88 s) | vývojář |
| 0 titulků přes V2 před doplněním | ✔ | noCapOverForeign (po opravě: konec titulku se nenatahuje do dalšího klipu) | vývojář |
| druhé Titulky z přepisu: V2 dostane, V5 stejný počet a opravy | ✔ | secondCaptionsAdded, v5CapsKept; dialog „Doplnit titulky“ | vývojář |
| varianta R + V2 + V5 a hlava na hranici | ✔ | b1-three, b1-boundary | vývojář |
| export dvou výroků, každý titulek na své řeči | ✔ částečně | regrese 12b/12c: 2 klipy bez útržku, titulky 6 → 11; kontrola titulku proti řeči podle času klipů (b1), rozhodčím ne | vývojář |
| Ctrl+Z / Ctrl+Y vložení | ✔ | undoInsert, redoInsert | vývojář |
| test, který by B1 chytil | ✔ | run-tests „B1: vložení z Přepisu po titulcích…“ | vývojář |

### Úkol 2 – Notebook: přesné titulky bez čekání na celý klip
**Výsledek: hotovo (kromě 1 drobnosti)** – import → MP4 cestou redaktora **8 CPU 2:57, 4 CPU 3:51** (kolo 4: 9:46), titulky z přesných úseků 16,7 s / 27,7 s,
odhad „asi 20 s“ / „asi 30 s“, redaktorův výrok začíná „A zjistilo se to…“ (kolo 4: „dále.“).
- Notebook (4–15 vláken, Standardní): po stažení standardního modelu se přesný (1 037 MB) stahuje na pozadí jen do úložiště (worker `prefetch`, nic v paměti);
  řádek „Připravuji přesné titulky: stahuji 420 / 1 037 MB“ stejně v Přepisu i v Projektu, při zastavení „· čekám na síť 0:12“, pak „✓ Staženo…“.
  „Titulky z přepisu“ přepíšou přesně jen zvuk klipů [In, Out] (`transcribeRange`; s okrajem 1,5 s Whisper rozpočítal první větu od začátku okna a „A zjistilo“
  vypadlo – změřeno, proto přesně In–Out). Dialog: „Titulky se přepíšou přesně – asi 20 s.“ + co se přepíše; průběh, „Skrýt – dokončí se samo“. Řádek nabídky
  „Přepsat přesněji“ zmizel; v menu ≡ „Přepsat přesněji celý klip…“ s „stažení ~2 min (jen poprvé) + přepis ~N min“. Opravy titulků z přesných úseků se
  ukládají podle času titulku → platí i při dalším vytvoření titulků (patička nelže). Stanice beze změny (přesný přepis celého klipu výchozí).
- Bod 6 (čeština): standardní přepis **už běží s pevnou češtinou** (`bridge.js` → `language: 'cs'` → worker `language: 'czech'`). Slovenská/ruská slova dělá
  sám malý model; řešení = titulky z přesných úseků.
| kritérium | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| import → standardní hotov (8 / 4 CPU) | ✔ změřeno | 149 s / 193 s (`shots-dev-5/nb/nb8.json`, `nb4.json`) | vývojář |
| stažení přesného (MB, s) | ✔ | 1 037 MB, hotovo v 144,7 s od importu (4 CPU), souběžně se standardním přepisem | vývojář |
| klik „Vytvořit titulky“ → hotové ≤ 45 s (8) / ≤ 60 s (4) | ✔ | 16,7 s / 27,7 s | vývojář |
| import → MP4 ≤ 6 min (8 CPU) | ✔ | 177 s (8 CPU), 231 s (4 CPU) | vývojář |
| odhad ±25 % | ✔ titulky / neověřeno celý klip | „asi 20 s“ vs 16,7 s (+20 %), „asi 30 s“ vs 27,7 s (+8 %); odhad „Přepsat přesněji celý klip“ neměřen | vývojář |
| 0 intervalů > 10 s bez změny čísla | ✘ částečně | 8 CPU 0, 4 CPU 2× (79 % a 86 % standardního přepisu, 10,3 a 12,4 s) → opraveno odpočtem „zbývá asi 40 s“ po 10 s, znovu neměřeno | vývojář |
| Projekt × Přepis stejný stav | ✔ | shoda řádku stahování 1 rozdíl z ~180 vzorků (8 CPU, okamžik změny) | vývojář |
| titulky: 0 slov s ť/ľ/ô/ä/cyrilicí | ✔ | PO 0 (PŘED standard: „zjistělo“, „príč“, „pravid“) | vývojář |
| WER titulků PŘED/PO (rozhodčí faster-whisper na [In, Out]) | ✔ | **15,7 % → 5,9 %** (zbývá „ji→jí“, „jako→jak“, 1 vypuštěné „vlastně“) | vývojář |
| WER proti přesnému přepisu celého klipu ≤ +2 p. b. | neověřeno | přesný přepis výřezu jen ze stanice (69 vět), WER na referenci neměřen | – |
| čeština ve standardním přepisu | ✔ | už nastavená – kód bridge.js:205 + worker | vývojář |
| stanice beze změny (±10 %) | ✔ | regrese stanice: přesný přepis výchozí, 5 min za 260 s vč. stažení 1 GB (čistý profil) | vývojář |
| Přepis 1366×768 „výběr + varování“ ≥ 5 vět, nikde méně než kolo 4 | ✔ | notebook 5 (kolo 4: 4), 1040×1100 7 (7); stav 07 4 = kolo 4 | vývojář |
| bez slov Whisper/model/vlákna v UI | ✔ | texty návrhu design-4 | vývojář |
| test | ✔ | run-tests „notebook: odhady… titulky z přesného úseku…“ | vývojář |
- Desktop: titulky z přepisu jdou dál přes panel AI (faster-whisper) – stahování na pozadí a přesné úseky jsou jen ve webu.

### Úkol 3 – Kraje titulků
**Výsledek: částečně** – redaktorův případ „dále.“ ✔ (notebook: přesný přepis úseku). Na stanici (přesný přepis celého klipu) beze změny:
začátky 18/28, konce 21/28 (cíl ≥ 24/28 ✘).
- Férový rozhodčí (`test/edges.js`): bez diakritiky, editační vzdálenost ≤ 2 nebo kmen 4 písmen; `--old-judge` = kolo 4. Na testerových sadách mění jen standardní konce.
- Notebook = skutečná cesta titulků (přesné úseky, `test/edges-web.js --cpu 8 --slow`), standardní výřez, náhodné výroky:
| sada | PŘED (kolo 4, standardní přepis) začátky / konce | PO (přesné úseky) |
|---|---|---|
| std 31337 | 12/14, 8/14 | 12/14, 12/14 |
| std 555 | 12/14, 13/14 | 11/14, 13/14 |
| **celkem** | **24/28, 21/28** | **23/28, 25/28** |
- Stanice: zkoušeno (1) přichycení k nejbližší pauze místo nejtišší (B3/B4) – přesný 4242+9090 začátky 31 → 31, konce 33 → 31, standardní horší → vypnuto (`EW.nearest`);
  (2) titulky z přesného úseku i na stanici – 4242: 8/14, 11/14 proti 10/14, 12/14 a ~17 s na výrok → vypnuto (`window.__pzCapExact`). Rozhodčí (jiný model) se
  s aplikací na krajích rozchází i tam, kde obě slyší stejný zvuk („No“ × „chvíli“, „Že“ × „Protože“) – strop metriky odhaduji ~80 %.
| kritérium | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| férový rozhodčí, PŘED na sadách testera | ✔ | přesný 18/28, 21/28; std 23/28, 24/28 (`--old-judge` std 31337 konce 10/15 → 12/15) | vývojář |
| přichytit In/Out do pauzy na hranici věty (B3/B4) | ✘ | zkoušeno, horší → vypnuto | vývojář |
| žádný útržek („dále.“, „-ším“), celé slovo ano | ✔ notebook redaktorův případ / ✘ stanice nezměněno | „A zjistilo se to…“; B4 na stanici neopraveno | vývojář |
| varování konce jako začátku (B5) | ✘ | neděláno | – |
| přesný 4242+9090 ≥ 24/28 a ≥ 24/28 | ✘ | 18/28, 21/28 | vývojář |
| pojmenované případy klik + Shift+klik | ✔ 23:20, V2, V5, redaktor-4 / ✘ B2–B5 neověřeny jednotlivě | b1/notebook5 | vývojář |
| nové sady 2×14 bez ladění | ✔ | std 31337/555 = sady testera, parametry neměněny | vývojář |
| testy „dále.“, „-ším“, „sedívává“, „práce,“ | ✘ | jen test přesného úseku (mock) | – |

### Úkol 4 – Drobnosti
**Výsledek: hotovo** (`test/small5.js`, `shots-dev-5/u4/`).
| kritérium | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| čistý profil → přepis se spustí sám do 2 s | ✔ | notebook5: auto true, stahování od 0:16 (pzAutoAsr2, stará hodnota pzAutoAsr se ignoruje) | vývojář |
| s vypnutou volbou žádný text netvrdí „přepíše se sama“ | ✔ | karta „Přepis spustíš: pravý klik…“, prázdný Přepis „přepis pak spustíš pravým klikem…“, nápověda; po zapnutí se karta překreslí | vývojář |
| Ctrl+A → Delete smaže titulek s Vrátit, Ctrl+Z vrátí | ✔ | 7 → 6, „Smazán titulek … Vrátit“, Ctrl+Z → 7 | vývojář |
| Text v obraze vidět jako záložka 1366×768 | ✔ | b1 snímky (záložka vedle „Zdroj:“, × jen když je otevřená) | vývojář |
| Esc v uložení nezavře Export | ✔ | dialog zůstal, „Ukládání zrušeno – klikni na Exportovat…“ (zrušení simulováno AbortError) | vývojář |
| řádek „nepřepsáno“ 0:00 i 28:01, klik přehraje | ✔ | „0:00–0:08 nepřepsáno (hudba / možná řeč) ▶“, „28:01–28:06 …“, klik → přehrává od 1681,6 s | vývojář |

### Regrese (`node test/regress.js … --cpu 8 --slow` a `--cpu 32`, čistý profil)
Celé věty / px seznamu, 1366×768 | 1040×1100 (kolo 4 v závorce):
| stav | notebook 8 CPU | stanice |
|---|---|---|
| 04 hotovo | 5 / 8 (5 / 7) | 5 / 9 |
| 05 hledání | 6 / 8 (6 / 7) | 7 / 9 |
| **06 výběr + varování** | **5 / 7 (4 / 7)** | 8 / 10 |
| 07 vloženo | 4 / 6 (4 / 7) | 7 / 9 |
| 09 titulky | 5 / 7 (5 / 7) | 3 / 3 (jen 3 titulky) |
| 12b druhý výrok | 5 / 8 | 6 / 8 |
| 12c dva výroky + titulky | 6 / 8 | 6 / 6 |
| 13 slabý počítač | 5 / 7 (4 / 7) | 6 / 8 |
- ✘ 07 při 1040×1100: 6 (kolo 4: 7) – po vložení je v patičce varování + „✓ V nové sekvenci“ (na 2 řádky). Ostatní stavy ≥ kolo 4.
- Nové stavy: 03b „stahuji přesné titulky“, 12b/12c dva výroky. Časy notebookové regrese neplatí (souběžně běželo měření krajů: standardní přepis 416 s místo 149 s).
- Snímky `shots-dev-5/rr-nb8/`, `rr-stanice/` (rr-<krok>-<stav>-<rozlišení>.png).

### Stav pro testery (pravidlo 10)
- Adresa vždy **http://127.0.0.1:8791/**. Notebook (`__pzAsrSlow` nebo 4–15 vláken): Standardní přepis + přesný model se stahuje sám na pozadí + titulky z přesných
  úseků. Stanice (≥ 16 vláken): přesný přepis celého klipu. Slabý počítač: jen standardní.
- OPFS testovacího (vestavěného) prohlížeče byl ve 4:30 **prázdný** (model se znovu ztratil, příčina neznámá; Chrome persist() neudělil) – první stažení tedy znovu.
- Přepisy pro skripty: `web/test-out/vyrez-5min-standard.json`, `vyrez-5min-accurate.json` (nový, ze stanice), `prepis-presny-po.json`.

### Ředitel (review-4)
Hodnocení: tester 5, redaktor 5, vlastník 4, UX 5, vývojář 4 (zlepšení po výměně způsobu práce, bez výměn). Ověřeno: testy 36/36, b1 konec 9/9 ✔ (klipy [0–16,32][16,32–36,2], titulky V5 beze změny, Zpět/Znovu), verze mwrc8zdt; notebook ~5,5–6 min pro člověka (skript 2:57), v titulcích zbývají 2 chyby slov. Do developer-rules doplněny body 13–15 (✔ doslova, přeměřit nasazenou opravu, PŘED/PO stejnou metrikou). Zaměření kola 6: kraje titulků na obou cestách s realistickým cílem + Přepis ≥ 8 vět (design-5 a). Petrovi popáté commit. Viz team/reviews/review-4.md.

### Kolo 5 – oprava po redaktorovi (redaktor-5)
**Výsledek: hotovo** – nasazeno **app.js?v=mwrctz0d**, testy 37/37.
- Chyba, kterou jsem v kole 5 zavedl: hlavní tlačítko po vložení („Titulky z přepisu…“ / „Doplnit titulky…“) mělo `id="trNext"` stejné jako šipka ▼ hledání → tlačítko
  nereagovalo a šipka hledání otevírala dialog titulků. Přejmenováno (`trCapNext`). PŘED (redaktor-5, snímek 15) / PO (`test/small5.js` capBtn): klik na tlačítko
  otevře dialog Titulky z přepisu ✔, šipka ▼ ne ✔. Nový test „žádné id dvakrát v jednom stavu panelu“ – s původním kódem selže (ověřeno vrácením).
- Doplňování titulků ukazovalo „1 %“ celou dobu (jeden kousek pro model) → běžící čas proti odhadu „Přepisuji úseky přesně… 8 s z asi 20 s“. Neměřeno znovu.
- Pozn. pro kolo 6 (redaktor-5): 2 chyby slov přesného přepisu („zvolával“, „narozenina“), ~1,2 s prázdného stolu v 9:16 na začátku druhé odpovědi, „(1)“ × „(2 úseky)“ v dialogu doplnění.

## Kolo 6 – vývojář (zadání tasks-5) – **bez commitu** (Petr zatím neodpověděl; navrženo pošesté)
Seedy pro úkol 1 zapsané PŘED měřením (pravidlo 13, nikým neměřené): **stanice 3141 a 5926**, **notebook 2236 a 6797**, každý 14 náhodných výroků
(`test/edges.js --random 14 --seed N`). Na nich se neladí; ladí se jen na pojmenovaných případech a starých sadách.

**Výsledek kola 6 (vývojář, ráno 2026-11-22): částečně – úkol 3 částečně, úkoly 1 a 2 nesplněny.** Nasazeno **app.js?v=mwrfdyty**, testy 37/37, `test/b1.js` 9/9.
Kolo bylo zkrácené (ráno – konec nočního běhu); zbytek patří do dalšího kola.

### Úkol 1 – Kraje titulků: nesplněno
- PŘED na pojmenovaných případech (`node test/edges.js … --cases`, mwrctz0d, stanice): začátky **1/10**, konce **6/10** (B2a, B3a, B4a–d, B5, 2718 N4/N10, 6174 N2).
- Rozbor: B4a i B4d nejsou chyba titulků, ale **umístění střihu** – In padne 0,7 s pozdě doprostřed vybrané věty („Já se taky moc těším.“ zní 49,41–50,33, In 50,10),
  Out přeteče do další věty („Jo, vím p-“); příčina = posun časů slov přepisu.
- Zkoušeno: In/Out do pauzy, kterou logika titulků přiřadí přesně k hranici vybrané věty (`EW.consistent`, `pausesIn`, `pauseBoundary`). Pojmenované: B3a ✔,
  B4b začátek posunut správně, ale B2a horší; **ladicí sady 4242+9090: začátky 30 → 27, konce 34 → 30 ze 40 → vypnuto** (zůstává jako přepínač).
- Nové seedy (stanice 3141/5926, notebook 2236/6797) zapsané předem **neměřeny** – nebylo co měřit (žádná změna nasazena).
- Pevná čeština v přesných úsecích (C7): kód už `language: 'czech'` předává (`transcribeRange` → worker); „do Posavať“ tedy dělá model i s pevnou češtinou – neopraveno.
| kritérium | ✔/✘ | důkaz | kdo |
|---|---|---|---|
| nové seedy zapsané předem | ✔ | log výše | vývojář |
| stanice ≥ 23/28 i ≥ 23/28, notebook ≥ 23/28 | ✘ neměřeno | – | – |
| pojmenované případy ✔ | ✘ | PŘED 1/10, 6/10; zkoušená varianta zahozena | vývojář |
| 0 titulků se slovem, které nezazní | ✘ | B4a, B4b, B4d, N4 trvají | – |
| varování ≥ 70 %, planých ≤ 4 | ✘ neděláno | – | – |
| 0 slov ť/ľ/ô/ä (C7) | ✘ | jazyk už pevný, model přesto | vývojář |
| testy „dále.“, „-ším“… | ✘ | – | – |

### Úkol 2 – 9:16 bez prázdného záběru: nesplněno (neděláno)

### Úkol 3 – Přepis a patičky: částečně
- ✔ C9: patička „Smazán titulek … Vrátit“ zmizí po Ctrl+Z i po jiné úpravě (regrese 12c: po doplnění titulků už „Klikni do titulku…“).
- ✔ C10: ▾ s hlavou na konci sekvence už nenabízí šedé „hlava je uvnitř klipu“ (jen Přidat na konec / na začátek / Do nové sekvence).
- ✔ C11: řádek stahování z Projektu se pod Přepisem a Titulky neukazuje (příčina dvojího „✓ Staženo“).
- ✔ Štítek klipu v Projektu: při stahování „Stahuji 74 / 240 MB“ (jako Přepis), bublina „klikni a uvidíš průběh v Přepisu“ místo „klikni pro přepis“, když běží. Snímky PŘED/PO neporovnány.
- ✔ Patička po vložení v jednom řádku: varování jako ⚠ s bublinou („⚠ ✓ V nové sekvenci · 0:00–0:15 ▶ Přehrát Titulky z přepisu… ▾“).
- ✘ design-5 (a) široký Přepis bez sekvence a ⤢ – neděláno.
Regrese `shots-dev-6/rr-nb8/` (notebook 8 CPU, celé věty 1366×768 / 1040×1100; kolo 5 v závorce):
| stav | PO | kolo 5 |
|---|---|---|
| 04 hotovo | 5/7 | 5/8 ✘ (1040: −1) |
| 05 hledání | 6/8 | 6/8 |
| 06 výběr + varování | **4/7** ✘ | 5/7 (stejná část UI neměněna – nejspíš poloha posuvníku; neověřeno) |
| **07 vloženo** | **5/7** ✔ | 4/6 |
| 08 dialog | 5/7 | 4/6 |
| 12 po exportu | 5/7 | 4/6 |
| 12b / 12c | 5/8 / 5/7 | 5/8 / 6/8 |
| 13 slabý PC | 5/7 | 5/7 |
| kritérium | ✔/✘ | důkaz |
|---|---|---|
| bez sekvence ≥ 8 (1366) / ≥ 10 (1040) | ✘ | (a) neděláno |
| se sekvencí žádný horší než kolo 5, 07 @1040 ≥ 7 | ✘ částečně | 07 7 ✔; 04 @1040 7 (8), 06 @1366 4 (5), 12c @1040 7 (8) |
| ⤢ ≥ 20 vět | ✘ | neděláno |
| C9, C10, C11, štítek Projektu | ✔ kód / ✘ snímky PŘED/PO | regrese 12c, kód |
| testy (bez sekvence, patička 1 řádek, ▾ na konci) | ✘ | – |

### Stav pro testery
Adresa 127.0.0.1:8791, verze mwrfdyty; notebook = standardní přepis + přesné titulky z úseků; stanice = přesný přepis. `EW.consistent` vypnuto.

## Oprava na podnět uživatele (2026-11-22): probliknutí na střihu (mwrk2al7)
- **Náhled:** klip začínající v úseku za ne-IDR I-snímkem (TN MP4) ukázal při přehrávání ~3 snímky zastaralý obraz `<video>` (detail z předchozího záběru), než doběhl dekodér pro plátno. Nově `player.prefetchStill` dekóduje první snímek dalšího klipu předem (`stillProvider(..., {keep:true})`, neruší běžné požadavky) a `updateStill` ho položí hned na střihu. Dorovnání skokem se nedělá v posledních 0,35 s klipu (zamrzlo ~4 snímky před střihem).
  Změřeno krokováním po 16 ms (Chrome za oknem škrtí rAF): PŘED (uživatelova karta, mwqudnjz) střih 1,72 s → plátno až po 0,13 s, do té doby jiný záběr; PO → správný snímek od prvního kroku za střihem (1,72 s i 4,72 s).
- **Výsledek (i export):** Reframe nechal na začátku klipu 4snímkový zbytek záběru (994,88–995,04 před střihem kamery) → blik ve videu. `reframe.js edgeFragments`: zbytek < 0,3 s na kraji klipu převezme sousední klip na stopě (obraz se prodlouží o pár snímků, zvuk beze změny; jen když v prodloužení není další střih kamery). Ověřeno na stejném zdroji: `merged: 1`, předchozí klip 922,6–932,28, další od 995,04, jediný střih.
- Testy 37/37, b1 9/9. Uživatelova existující sekvence „Codex – upoutávka Reels 20s (výřez opraven)“ zůstává beze změny (zbytek 16,60–16,76 s v ní dál je).

## Kolo 7 – tým v2 (2026-11-22, mws3s0a1, bez commitu)
Nový tým (team/v2/TEAM.md): Redaktorka, Kontrolor výstupu, Vzhled a jazyk, AI tok + vývojář. Reporty a tabulka oprav: `team/v2/r7/`.
Opraveno: klíčové snímky na střizích (rozpad obrazu), „Myslím“ v titulcích (mezera v pauze mimo okno), zbytky záběrů v 16:9 (`fixEdgeShots`),
řez 9:16 na snímek přesně, MIN_SHOT 0,5 s, Delete kousku obrazu nesmaže zvuk, přepnutí jazyka, Text v obraze bez posuvníku, méně chyb konzole.
Odloženo: kraje slov (cutBounds), rozsah jasu exportu, nadpis/titulky v 9:16 vs. obličej a zóny, Opus na Windows N.
Kolo 7b (mws42y85, konektor 1.4.0): relace AI přichycená ke kartě (dřív úkoly šly kartě s fokusem – i cizí), rozsah jasu exportu
(hardwarový kodér plný rozsah → zkouška + stlačení), set_captions hlásí neplatné indexy, 9:16 užší titulky a menší nadpis.

## Kolo 8 (2026-11-22, mws68wvn)
Kraje klipů: střih už nepřeskočí celé slovo sousední věty, když je na hranici ticho (`EW.noOverreach`); seed A konce 16→17/20, seed B beze změny.
Agenti kola 8: kontrolor výstupu (regrese a–d + nový výstup), redaktorka (4:5 Facebook, 9:16, přepnutí jazyka), pak AI tok (konektor jen pro 127.0.0.1:8791).

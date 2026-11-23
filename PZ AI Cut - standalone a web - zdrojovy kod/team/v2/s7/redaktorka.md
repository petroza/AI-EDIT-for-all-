# Redaktorka – kolo S7: první spuštění, tři denní úkoly za 20 minut (2026-11-23)

**Otázka:** Zvládne kolegyně z TV, která zná Premiere a PZ AI Cut vidí poprvé, bez návodu za 20 minut tyhle tři úkoly?
1. 20s upoutávku 9:16 s titulky z 28min rozhovoru podle přepisu.
2. 45s výpověď 16:9 s b-rollem na V2 a export do MXF.
3. Opravu chyby v titulku a druhou verzi s jiným nadpisem.

**Odpověď: Ano.** Všechny tři úkoly jsem měla hotové za 17 min (01:58:49 → 02:15:40). Do toho počítám asi 4 min vlastního měření a dvě vlastní chyby kliknutí, takže čisté klikání trvalo kolem 12 min. Nápovědu jsem nepotřebovala, otevřela jsem ji až na konci pro kontrolu (snímek 57).

Jediné skutečné zaseknutí byl formát 9:16. Nejpřirozenější cesta, tedy zvolit 9:16 rovnou v dialogu Nová sekvence, dá video, ve kterém v širokém záběru nikdo není (nález 1).

**Instance:** 9371, `--size 1366x768 --lang cs --ai`, čistý profil `%TEMP%\pz-s7-nova`, HEAD ae013cb. AI panel byl při prvním spuštění otevřený, hned jsem ho zavřela (✦ AI) a nepoužila.

**Ovládání:** vlastní `ui.js` ve scratchpadu přes CDP `Input.dispatchMouseEvent/KeyEvent/insertText`: klik, Shift+klik, dvojklik, pravý klik, kolečko, klávesy a psaní. Stav jsem jen četla přes `eval`.

**Pomůcky místo nativních prvků:**
- Import: `TN.app.importPaths` (2×). Nativní dialog Import jsem neotevřela, aby nezablokoval okno.
- Nabídky okna: `TN.app.cmd('reframe916')` (Sekvence → Auto Reframe), `cmd('newSequence')` (Ctrl+N je nativní akcelerátor a přes CDP nefunguje) a `cmd('socialGuide')` (Nápověda → Jak na video, jen kontrola na konci). Obsah nabídek jsem znala z `src/core/menu.js`.
- Export: vždy přes dialog ⇪ Export v aplikaci. Cestu jsem vepsala do pole Výstupní soubor, tlačítko „…“ jsem nepoužila.
- Nativní rozbalovací seznamy (Předvolba, Formát) na snímku DevTools nejsou vidět. Ovládala jsem je klávesami: šipky a Enter.

## 3 nejdůležitější nálezy

1. **⚠ Volba 9:16 v dialogu Nová sekvence dá středový výřez bez obličeje (záv. 3).**
   - **Postup:** Přepis → výběr vět → Vložit do nové sekvence ▾ → Do nové sekvence… → Předvolba 1080×1920 (9:16 – Reels, TikTok, Shorts). Pro Instagram je to přirozená volba.
   - **Výsledek:** Klip se roztáhne na celou plochu (`fit: cover`, `posX 0`) a vezme se jen střed obrazu.
   - **V exportu:** v 9 s a 15 s je v širokém záběru jen stůl, mluvčí není v obraze vůbec (snímek 22, monitor snímky 15 a 16). Žádné varování.
   - **Když pak hledám Auto Reframe** (Sekvence → Auto Reframe 9:16), přijde anglická hláška:
     > "Upoutavka IG Simkova" is 1080×1920 – reframe to 9:16 only from a wider sequence; open the original landscape (16:9) one

     (snímek 24). Původní 16:9 ale neexistuje, protože jsem stříhala rovnou na výšku.
   - **Jak jsem to obešla (3 min):** Ctrl+A a Ctrl+C na časové ose, nová sekvence 1280×720, Ctrl+V, Auto Reframe.
   - Výsledek pak sleduje obličej a sám rozdělí klipy na střizích záběru (922,57 a 1270,34 s). V obou verzích široký záběr ukáže ji, ne stůl (snímky 30 a 32).
   - Správné pořadí, tedy nejdřív 16:9 a pak Auto Reframe, je jen v nápovědě „Jak na video“ (bod 4).
   - **Premiere:** Auto Reframe jde přímo na klipy ve svislé sekvenci (efekt Auto Reframe). Podle mé znalosti, v Premiere jsem to v tomhle kole neověřovala.

2. **⚠ Náhledy klipů na časové ose ukazují úvodní znělku TALK, ne obsah klipu (záv. 2).**
   - Všech 5 výroků z 28min rozhovoru, ve všech sekvencích, má na V1 stejný fialový náhled „TALK“ (snímky 14, 26 a 42). Je to snímek 0 zdroje, ne snímek v In bodu klipu.
   - Na časové ose se proto neorientuju, kde je který výrok, a musím klikat do monitoru.
   - Ve sekvenci z Auto Reframe je to stejné, jen má víc dílů.

3. **⚠ Po vložení (Ctrl+V) do nové sekvence píše panel Titulky „Sekvence nemá klipy se zvukem“ (záv. 2).**
   - Na A1 přitom leží 3 zvukové klipy (snímek 26, po 2 s pořád stejný text).
   - Panel se obnoví až po přepnutí sekvence.
   - Nováček by odtud usoudil, že ze sekvence titulky udělat nejde.

## Časová osa (hodiny, kde jsem váhala a proč)

| Čas | Krok | Váhání / dojem |
|---|---|---|
| 01:58:49 | start, první obrazovka (01) | Karta „Začni tady“ je jasná. AI panel je otevřený napravo a bere místo, zavřela jsem ho |
| 01:59:33 | import 28min rozhovoru | 😊 Přepis byl hned (mezipaměť), záložka Přepis se sama otevřela, 409 vět s časy (02) |
| 01:59:59 | Ctrl+N | Nic se nestalo. Je to omezení testu, ne chyba aplikace (nativní akcelerátor) (03) |
| 02:00 | hledání „nikomu“, klik a Shift+klik na 3 věty | 😊 Hledání se zvýrazněním a „3 věty · 0:06“. Varování „Začátek v souvislé řeči – poslechni…“ jsem nechala (05) |
| 02:00:30 | ▾ → Do nové sekvence… | Dialog se nabízí podle klipu (1280×720). Zvolila jsem 9:16 (07, 09) |
| 02:01:05 | sekvence 9:16 vznikla | Rámeček Bezpečné zóny je zapnutý hned. 😊 |
| 02:01:55 | další 2 výroky přes „Přidat na konec sekvence“ | 😊 Tlačítko se samo přejmenuje, sekvence má 18,32 s (14) |
| 02:02–02:04 | **zaváhání**: v 9 s a 15 s je v monitoru jen stůl | Myslela jsem, že monitor ukazuje špatný snímek. Export ukázal totéž (nález 1). Asi 2 min jsem si to ověřovala ffmpegem |
| 02:04:17 | Titulky z přepisu… | 😊 Jasný dialog: „Titulky vzniknou jen ze slov, která v sekvenci zazní“. Vzniklo 9 titulků (17, 18) |
| 02:04:46 | ⇪ Export | 😊 H.264, −14 LUFS, vypálit + .srt předvyplněné. Cestu jde napsat. Hotovo za 4 s (19–21) |
| 02:07:02 | Auto Reframe na 9:16 | **Zaseknutí**: anglická hláška (24). Obcházela jsem to kopírováním do 16:9 (nález 1) |
| 02:07:20 | nová sekvence přes Ctrl+N | Dialog si pamatuje poslední 9:16. Přepnula jsem na 1280×720 |
| 02:07:39 | Ctrl+V, Auto Reframe | Panel Titulky je zastaralý (nález 3). Pak „Výřez podle obličeje: hledám obličeje (3/3)“ |
| 02:08:00 | titulky, export 1b | Moje chyba: klik vedle a zapnutý nástroj Slip (Y). Export za 4 s, −14,0 LUFS (30–32) |
| 02:10:13 | Úkol 2: hledání a výběr 19:08–19:53 | 😊 Shift+klik přes hledání funguje, „9 vět · 0:47“. Moje chyba: rozbalovací nabídka ▾ jednou vybrala větu místo položky |
| 02:11:39 | sekvence 1920×1080, import b-rollu | Dialog tentokrát nabídl 1280×720 (podle klipu), ne poslední 9:16. Ctrl+N a tlačítko Vložit… se tedy chovají jinak |
| 02:12:20 | b-roll: dvojklik, napsaný timecode 100 a 500, I/O, cíl zdroje V2, A1 vypnout, TC 2000, „.“ | 😊 **Přesně jako v Premiere**, bez váhání. B-roll leží 20,00–24,04 na V2 (40–43). Varování „Konec je uprostřed věty / Přichytit na konec věty“ u b-rollu je zbytečné a překrývá délku In–Out („00:00:04:0“) |
| 02:12:51 | Export → MXF | 😊 Hlasitost se sama přepne na −23 LUFS. Hotovo za 3 s (44, 45) |
| 02:13:47 | Úkol 3: Titulky → klik na titulek → oprava „spravodajství“ → „zpravodajství“ | 😊 Editace přímo v seznamu, Enter. „Opraveno: 1 titulek · opravy platí i v přepisu klipu“ (48–50) |
| 02:14:17 | Text v obraze → Nadpis nahoře | 😊 Pole hned v kartě vedle Zdroje, nadpis je hned v monitoru (51) |
| 02:14:50 | export A | Dialog si pamatuje formát podle sekvence (9:16 → H.264 −14) |
| 02:15:00 | pravý klik na sekvenci → Duplikovat | 😊 Kopie se hned otevře. Název ale „… **Copy**“ anglicky (54) |
| 02:15:40 | nadpis B, export B | Dialog nabídl složku posledního exportu + název sekvence. Hotovo |

## Ostatní nálezy

| # | Nález | Důkaz | Záv. |
|---|---|---|---|
| 4 | Začátek upoutávky: Whisper slyší „**A** já jsem to vlastně…“, „A“ v 0,00–0,10 s. Nejspíš konec předchozího slova; aplikace na to předem varovala. Sluchem neověřeno | export 1b, faster-whisper 0–2 s. Hranice 12,52 s je čistá („…šok. A já jsem…“) | 2 |
| 5 | Oprava titulku platí jen v aktuální sekvenci a jejích pozdějších kopiích. Starší verze „Upoutavka IG Simkova“ má dál „spravodajství“, i když hláška říká „opravy platí i v přepisu klipu“. Redaktorka s víc verzemi to musí opravit v každé | `captions` všech sekvencí, `redaktorka-s7-1b…srt` ř. 29 | 1 |
| 6 | Duplikát sekvence se jmenuje „… Copy“ (anglicky v českém rozhraní) | snímek 54 | 1 |
| 7 | Výchozí hlasitost v exportu H.264: sekvence 9:16 → −14 LUFS, sekvence 1920×1080 → „Vypnuto (ponechat úrovně)“. Nevím, podle čeho se to řídí | eval selectů v dialogu | 1 |
| 8 | Dialog Export u MXF: po skrytí řádku Kodér zůstane prázdná mezera | snímek 44 | 1 |
| 9 | Varování „Konec je uprostřed věty“ u b-rollu, ze kterého beru jen obraz, překrývá délku In–Out ve zdrojovém monitoru | snímek 40 | 1 |

## Exporty (`web/test-out/`)

| Soubor | Obsah | Ověřeno |
|---|---|---|
| `redaktorka-s7-1-upoutavka-ig-916.mp4` + .srt | 9:16 přímo z dialogu (středový výřez), 18,32 s | 1080×1920 25p, −14,0 LUFS. **V 9 a 15 s jen stůl** (snímek 22) |
| `redaktorka-s7-1b-upoutavka-ig-reframe.mp4` + .srt | 16:9 → Auto Reframe 9:16, titulky | 1080×1920, 18,32 s, −14,0 LUFS. Obličej ve všech 5 kontrolních snímcích (32) |
| `redaktorka-s7-2-vypoved-tv.mxf` | výpověď 19:08–19:53 (47 s, cíl 45 s), b-roll V2 20,00–24,04 | MXF, mpeg2video 1920×1080 25p progressive, 2× mono PCM 24bit 48 kHz, 47,16 s, −22,8 LUFS (obě stopy sloučené). Ve 22 s b-roll (snímek 46) |
| `redaktorka-s7-3a-nadpis-A.mp4` / `-3b-nadpis-B.mp4` + .srt | opravený titulek, dva nadpisy | „do zpravodajství,“ v obraze i v .srt. Nadpisy A/B nahoře (snímek 56) |

## Verdikt

**Ano, za 20 minut to zvládnu, i bez návodu.**
- **Stříhání podle přepisu je rychlejší než v Premiere:** hledat, kliknout, Shift+kliknout a Vložit / Přidat na konec.
- **B-roll přes cíl zdroje, I/O a „.“ je k nerozeznání od Premiere.**
- **Titulky, oprava, nadpis, duplikát a export (vč. MXF s −23 LUFS)** fungují na první pokus.

**Co bych opravila jako první:**
- Svislá sekvence vytvořená přímo z dialogu nemá dávat prázdný středový výřez. Buď výřez podle obličeje rovnou, nebo varování / nabídka Auto Reframe.
- Hláška Auto Reframe má být česky a nabídnout cestu dál.
- Náhledy klipů mají ukazovat obsah klipu, ne snímek 0 zdroje.

Ostatní jsou drobnosti.

# Kolo S12 – AI tok (standalone, MCP MY Premiere MCP + AI panel, Hermes) – regrese proti S11 (HEAD b93b6f1)

**Verdikt:** S12 **lze pustit** – obě hlavní chyby z S11 (vypadlá slova v titulcích po 9:16, cizí záběr na začátku) jsou
opravené a ověřené. Zbývá **obsah upoutávek** (vytržené věty → falešné souvislosti) a **fronta v panelu ukazuje 0**.
- Titulky po reframe (MCP `add_captions` i tlačítko Přidat titulky): **všechna slova na všech střizích kamery**, žádné velké písmeno uprostřed.
- Začátek klipu s cizím záběrem: `holdIn` (0,12 s zopakovaného detailu) – export začíná čistým detailem v 16:9 i 9:16.
- Upoutávky: moderátorka 0 / 0 / 26 % (S11: 23 / 48 / 35 %), **žádná odpověď bez otázky**, žádné poděkování, 20 s už nevychází 24 s.
- Hranice: check-cuts **32/32 skutečných hranic čistých**, Whisper bez úlomků slov na 9 exportech.
- AI panel pod CSP: **0× `securitypolicyviolation`**, 0 chyb/výjimek v konzoli (pozitivní kontrola vložený inline skript zachycena).

**Jak jsem testoval:** instance `standalone.js start 9374 %TEMP%\pz-s12-ai --size 1366x768 --lang cs --ai`; most 7880 = `electron.exe`
PID 75152, rodič 18208 = moje instance (`--remote-debugging-port=9374`), `premiere_status` → `app: TNSTRIH`. Worker codeStamp 13:43 (po
fa112a6). MCP přes `s3/ai/mcp.js` (PMCP_PORT=7880), hranice `scripts/check-cuts.mjs` + `s3/ai/hranice.py` (Whisper large-v3 + RMS 20 ms),
ffmpeg scene/ebur128. Panel ovládán přes CDP (klik `element.click()`, agent `#agent` = **Hermes**; Claude ani Codex nespuštěny).
Konzole okna i iframe AI panelu po celou dobu nahrávána přes CDP (`s12/ai/listen.js` → `console-panel.jsonl`), panel jsem na začátku
znovu načetl, aby se zachytilo i načtení. Exporty přes MCP `export_sequence` (dialog Export jsem neotevíral). Na konci `stop 9374`,
porty 7880 a 9374 volné. Nic neopraveno, necommitováno. Port 9376 (bezpečnost) nedotčen.

## 3 nejdůležitější nálezy

1. **(2) Upoutávky skládají vytržené věty, které spolu vytvoří falešnou souvislost** – kontrola kontextu je nekonzistentní.
   - **MCP 15 s** [41, 206, 207, 275]: končí „…neměli možnost se na to připravit.“ → „**To nepotřebujeme slyšet.**“ – „To“ ve zdroji
     znamená „Jí už je teď dobře“ (#274), tady zní jako reakce na nemožnost se připravit. Plány 20 s a 30 s tutéž větu samy vedou v `distorted`.
   - **Panel, rozhovor.mp4 20 s**: stejný úder „To nepotřebujeme slyšet. Já potřebuju slyšet…“ je ve výběru **a zároveň** ve výpisu
     „ℹ vyřazeno – vytržené by zkreslilo význam: …, „To nepotřebujeme slyšet.“, …“ (`p-out-fronta-rozhovor.txt`).
   - **MCP rozhovor.mp4 20 s** [23–24, 218, 267]: „…za tři týdny byla pryč.“ → „**To je jedna z nejlepších věcí, která mně se v životě
     po tom, co máma odešla, stala.**“ – „To“ ve zdroji = seznámení s Vanesou přes TN Live (#264–266), v upoutávce bez antecedentu hned po smrti mámy.
   - **MCP 30 s** [22, 65, 195–196, 189–190]: moderátorka „…si chtěla tvořit ty reportáže tak, jak ty chceš.“ → Bára „Prostě to období
     bylo… strašně jako nečekaný, protože… **ona** je nemocná.“ = falešná otázka → odpověď (téma kariéra → nemoc), „ona“ bez antecedentu.
   - **MCP 15 s hák** „Jsem na Novou, ale v tom životopise nic nebylo.“ začíná uprostřed souvětí („poslala jsem životopis, [jsem] na Novou…“,
     Whisper zdroje `w-b-zdroj.txt`) – střih v pauze je čistý, ale věta bez začátku.
   - **Důkaz:** `b15/b20/b30.log`, `b-ctx.log`, `r1.log`, `r-ctx.log`, `p-out-fronta-rozhovor.txt`.
2. **(2) Fronta v panelu je při 1366×768 prakticky neviditelná a počítadlo ukazuje 0.**
   - Dvě zadání do fronty (Upoutávka 20 s + Výrok 30 s, tlačítko „+“): `#qCount` = „1 čeká“, ale štítek vedle Zpět ukazuje **„Fronta 0“**
     (`.pz-qn` = 0) po celou dobu; seznam `#queue` je stlačený na **10 px** výšky pod výpisem (rect 301×10).
   - Samotná fronta funguje: obě úlohy doběhly postupně (✔ ✔), každá se zdrojem z aktivní sekvence v okamžiku zařazení.
   - **Důkaz:** `shots-ai/p07-fronta.png`, `p08-fronta-dole.png`, `p-out-fronta-rozhovor.txt`.
3. **(1) Zdůvodnění upoutávky opraveno jen napůl.**
   - Nově začíná „Údery po kontrole: …“ se skutečnými údery (✔), ale za ním v závorce zůstává „původní úvaha modelu“, která popisuje
     **jiné** údery: 15 s „U10 od moderátorky… otázka jako cliffhanger“ (ve výběru není), 20 s „U1 (9 s) paradox radost uprostřed těžké doby“,
     panel „U6 'A najednou byl pryč'“ (stejně jako S11). U debaty (`d1.log`) prefix „Údery po kontrole“ chybí úplně.
   - Výpis panelu dál píše „plán 9 s“ / „plán 11 s“ u výsledku 30,88 s / 17,28 s (S11 #8 beze změny).

## Tabulka nálezů (toky 1–3 + 4)
| # | tok | nález | důkaz | záv. |
|---|---|---|---|---|
| 1 | 1, 4 | Vytržené údery → falešné souvislosti; věta v `distorted`/„vyřazeno“ přesto použita (výše) | `b15/b30.log`, `r1.log`, `p-out-fronta-rozhovor.txt`, `b-ctx.log`, `r-ctx.log` | **2** |
| 2 | 3 | Fronta: štítek „Fronta 0“ při „1 čeká“, seznam 10 px vysoký | `p07`, `p08` | **2** |
| 3 | 1 | `reason`: skutečné údery + rozporná „původní úvaha modelu“; „plán 9 s“ u 30,88 s | `b*.log`, `p-out-*.txt` | 1 |
| 4 | 1 | **Délky:** MCP 15→14,56 (97 %), 20→21,00 (105 %), **30→24,60 (82 %)**; panel 20→17,28 (86 %); rozhovor MCP 20→18,04, panel 20→19,84; debata 20→19,44. Výrok 30 s: Bára 30,88; rozhovor MCP i panel **33,28 (111 %)** | `b*.log`, `r1.log`, `p-*-seq.txt` | 1 |
| 5 | 1 | `scripts/check-cuts.mjs` na 9:16 hlásí ✖ „protíná slovo / hlasitý zvuk“ na rozříznutí kamery (1195,60, 1200,28) – zvuk navazuje 1:1 ve zdroji, bez prolínání, Whisper slyší „přišlo úplně“, „vlastně vůbec“ celé → planý poplach nástroje | `cc-panel-upoutavka.log`, `w-p-upoutavka-split.txt` | 1 |
| 6 | 2 | MCP `add_captions {lines:1}` po reframe vrací `srt` s 15 titulky a řádky až 41 znaků, na ose je 27 jednořádkových (≤ 20 zn.) – S11 #6 beze změny | `b30-916.log`, `b30-916-server.srt`, `b30-916-captions-app.txt` | 1 |
| 7 | 3 | Hlavička panelu „Claude připojen“, i když je zvolený Hermes (S11 beze změny) | `p00`, `p11` | 1 |
| 8 | 3 | Stop během Hermes: výpis „■ zastaveno“, sekvence nevznikne (ověřeno 30 s), ale úloha `plan_edit` ve Workeru doběhne do „done“ (zbytečná práce GPU) | `p-stop.txt` | 1 |
| ok | 2 | **Titulky po 9:16 úplné:** panel výrok (4 střihy kamery) 16 titulků = celý text #203–207 („se to strašně,“ / „Takže to přišlo“ / „My jsme vlastně“); MCP 30 s 9:16 (6 střihů) 27 titulků, „se dostala na novu“, „říkala, že bylo“ celé; vypálené i na snímcích | `p-vyrok-captions.txt`, `b30-916-captions-app.txt`, `p05`, `b30-916-titulky-na-strizich.png` | – |
| ok | 2 | **Výrok panel → 9:16 → titulky → export:** −14,3 LUFS, TP −1,5, `captionsBurned:true` + .srt, 1080×1920; každý kus V1 má A1 se stejným `linkId`, klik na kus obrazu vybere i jeho zvuk | `p-vyrok-export.log`, `p-vyrok-seq.txt`, `p06` | – |
| ok | 1 | **holdIn:** S11 případ (start 18:08.92, cizí celek do 18:09.04) → klip má `holdIn {d:0.12}`, export 16:9 i 9:16 začíná detailem, 9:16 bez samostatného kusu (cameraSplits 0) | `h1.log`, `h1-*.png` | – |
| ok | 1 | **Pravidla upoutávky:** odpověď bez otázky 0×, moderátorka max 1 úder (30 s: #65, 6,32 s = 26 % < 30 %), poděkování/pozdravy 0× | `b*.log` | – |
| ok | 1, 4 | **Hranice:** check-cuts 32/32 skutečných hranic ✔ (Bára, rozhovor, debata), Whisper bez úlomků, řezy v tichu (−55 až −85 dB); nejkratší záběr 0,8 s; nic v `edges`/`retriedForEdges` | `cc-*.log`, `w-*.txt`, `scene-upoutavky.txt` | – |
| ok | 3 | **CSP:** 0 porušení v iframe i hlavním okně přes všechny akce (Upoutávka, Výrok, délky, formát, Spustit, fronta, Stop, Zpět, Otevřít, Převést formát, Titulky + Přidat, jazyk titulků, Média, Nastavení, Systém); kontrola inline skriptem zachycena (`script-src-elem`) | `csp-hook.txt`, `console-panel.jsonl` | – |
| ok | 3 | **Zpět** smaže sekvenci posledního zadání („dalším klikem i předchozí (3)“), **Otevřít** přepne sekvenci, karta Titulky 20 znaků u 9:16 / 40 u 16:9 (S11 #9 opraveno) | `p-zpet.txt`, `p03`, `p12` | – |
| ok | – | Hermes 11× `plan_edit`, worker.log 0× „CUDA error“; v `test-out` žádné dočasné zbytky exportu | `worker.log` | – |

**Neověřeno (vědomě neklikáno):** 👍/👎 (zapisují do skutečného `cache/feedback.jsonl`), „⬇ Export MP4“ ve výpisu (u neuloženého
projektu míří mimo `test-out`), mikrofon a „Importovat video“ (systémový dialog / oprávnění).

**Poznámka k toku 4:** `rozhovor.mp4` je **tentýž 28min rozhovor** (kopie, přepis bez mluvčích, 316 vět místo 295) – test ukázal hlavně
chování bez označení mluvčích. Navíc jsem proto zkusil jiný materiál `O:\MYpremiereMCP\_dev-data\test\kratke\debata_6min.mp4`
(3 mluvčí): upoutávka 20 s → 19,44 s, 1 mluvčí (Vašíř), hranice čisté, souvislý obsah; hák začíná spojkou „Čili…“.

## Srovnání s S11
| oblast | S11 | S12 |
|---|---|---|
| titulky po reframe 9:16 | **chybí slovo na každém střihu kamery** | **opraveno** (MCP i panel, export) |
| cizí záběr na začátku | 3 snímky v panelové upoutávce | **opraveno** (`holdIn`, ověřeno na stejném místě) |
| moderátorka v upoutávce | 23 / 48 / 35 % | 0 / 0 / 26 % (max 1 úder) |
| odpověď bez otázky | „Všechno, naprosto všechno“ bez #212 | žádná |
| délka MCP 15/20/30 | 16,28 / 19,12 / 26,28 | 14,56 / 21,00 / 24,60 (30 s jen 82 %) |
| délka panel 20 s | 24,36 (122 %) | 17,28 (86 %) |
| `reason` | jiné údery než picks | skutečné údery + rozporná „původní úvaha“ |
| falešné souvislosti | hák #188 nedokončený | „To nepotřebujeme slyšet.“, „To je jedna z nejlepších věcí…“, kariéra → nemoc |
| hranice / úlomky slov | čisté | čisté (32/32, 9 exportů) |
| karta Titulky po 9:16 | 40 znaků | 20 znaků (opraveno) |
| AI panel pod CSP | – | 0 porušení |
| fronta | netestováno | funguje, ale „Fronta 0“ a seznam 10 px |
| Hermes | 6 úloh, 0× CUDA | 11 úloh, 0× CUDA |

**Logy:** `team\v2\s12\ai\` (`a0`, `b15/20/30`, `b-*`, `b30-916*`, `h1`, `p-*`, `r*`, `d*`, `cc-*`, `w-*`, `csp-hook.txt`,
`console-panel.jsonl`, pomůcky `seq.sh`, `listen.js`). **Snímky:** `team\v2\s12\shots-ai\`.
**Exporty** `web\test-out\`: `ai-s12-upoutavka-15/20/30-169.mp4`, `ai-s12-upoutavka-30-916-tit.mp4` (+srt), `ai-s12-panel-upoutavka-916/-169.mp4`,
`ai-s12-panel-vyrok-916-tit.mp4` (+srt), `ai-s12-holdin-169/-916.mp4`, `ai-s12-rozhovor-upoutavka-20-169.mp4`, `ai-s12-rozhovor-vyrok-30-169.mp4`,
`ai-s12-panel-rozhovor-upoutavka-20-169.mp4`, `ai-s12-debata-upoutavka-20-169.mp4`.

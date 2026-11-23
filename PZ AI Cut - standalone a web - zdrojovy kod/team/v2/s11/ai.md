# Kolo S11 – AI tok (standalone, MCP MY Premiere MCP + AI panel, Hermes) – regrese proti S8 (HEAD 80b2f37)

**Verdikt:** S11 **nepouštět bez opravy titulků přes MCP/panel** (nález 1).
- **Délka upoutávek přes MCP je opravená:** 15 s → 16,28 s, 20 s → 19,12 s, 30 s → 26,28 s. V S8 to bylo 10,72 s z 20 s.
- **Hranice jsou čisté.** Nástroj nehlásí `edges` ani `retriedForEdges` a ověřil jsem to i nezávisle (check-cuts + Whisper/RMS).
- **Propojení obrazu se zvukem po výřezu funguje:** Shift+Delete kusu smaže obojí.
- **Chybové hlášky jsou česky.**
- **Nová chyba:** S11 rozřízne zvuk na střihu kamery, a MCP `add_captions` (i tlačítko Přidat titulky v panelu) proto **vynechá slovo na každém takovém řezu**.

**Jak jsem testoval:**
- **Instance:** `standalone.js start 9374 %TEMP%\pz-s11-ai --size 1366x768 --lang cs --ai`.
  - Most 7880 patřil `electron.exe` (PID 62288), jehož rodič je 70508, tedy moje instance s `--remote-debugging-port=9374`.
  - `premiere_status` vrátil `app: TNSTRIH`.
  - Worker má codeStamp 03:43:08, což je aktuální kód (8d60c9c).
- **MCP:** volal jsem přes `s3/ai/mcp.js` (PMCP_PORT=7880).
- **Měření hranic:** `scripts/check-cuts.mjs`, `s3/ai/hranice.py` (Whisper large-v3 + RMS 20 ms), ffmpeg scene/ebur128.
- **Panel:** klikal jsem přes CDP (`cdp.js drag` = klik). Agent jsem nastavil na Hermes v `#agent`. Claude ani Codex jsem nespouštěl.
- **Konec:** instanci jsem zastavil (`stop 9374`), porty 7880 i 9374 jsou volné. Nic jsem neopravoval ani necommitoval.

## 3 nejdůležitější nálezy

1. **(3) Titulky přes MCP `add_captions` i panel vynechají slovo na každém střihu kamery v 9:16 – NOVÁ regrese S11.**
   - **Kde to platí:** postup podle CLAUDE.md, tedy nejdřív `reframe_sequence`, potom `add_captions`.
   - **Proč:** Auto Reframe teď rozřízne i zvuk. `timelineCues` (`MY Premiere MCP…/server/index.js:858`) bere jen slova celá uvnitř jednoho zvukového klipu (`w.s >= inPoint && w.e <= outPoint`), takže slovo přes řez nepatří žádnému kusu.
   - **Projev:** další slovo navíc začíná velkým písmenem.
   - **Upoutávka 15 s 9x16** (3 střihy kamery):
     - „a proto jsem se ~~dostala~~ **Na** novu“,
     - „Když ~~přijde~~ **Rodina** o člověka jako je ~~máma?~~“.
   - **Kontrola na 16:9** (bez řezů): všechna slova jsou na místě.
   - **Výrok z panelu 9x16** (4 střihy, tlačítko Přidat titulky):
     - „A zjistilo se to ~~strašně,~~ **Strašně** pozdě.“,
     - „Takže to ~~přišlo~~ **Úplně**,“,
     - „My jsme ~~vlastně~~ **Vůbec** neměli“.
   - **Whisper:** v exportu ta slova slyší všechna.
   - **Navíc:** přeskládání na 9:16 spojí přes střih dvě repliky do jednoho titulku: „jako je Všechno,“ (moderátorka + Bára, 9,50–11,30).
   - **Důkaz:** `b15-916-server.srt` vs `b15-169-server.srt`, `b15-916-app.txt`, `p-vyrok-captions.txt`, `w-p-vyrok.txt`, snímky `shots-ai/b15-916-chybejici-slova.png`, `p05-panel-vyrok-chybejici-slova.png`.
2. **(3) Upoutávka z panelu (20 s, 9:16) začíná 3 snímky cizího záběru.**
   - **Co je vidět:** sn. 0–2 jsou profil Báry v celku, na 0,12 s (scene 0,67) střih na detail. V 9:16 je to navíc samostatný kus 0,00–0,12 s s jiným posX (0,734 vs 0,247). Totéž je v 16:9.
   - **Nástroj to sám hlásí:** „⚠ 00:18:08.93: střih obrazu 0.10 s po začátku klipu, uvnitř řeči – obraz jen bleskne“, ale úklid krajů na začátku sekvence nic neudělá (nemá souseda).
   - **Důkaz:** `p-upoutavka-seq.txt`, `shots-ai/p08-panel-upoutavka-916-zacatek-5snimku.png`.
3. **(2) Obsah upoutávek je slabý a `reason` nesedí s výběrem.**
   - **MCP 20 s** [179,180,189,190,213]:
     - **48 % moderátorka** (9,1 s z 19,1 s: „Barunko, s tebe čiší obrovská energie…“),
     - pak „Tady není jiná možnost…“ a „**Všechno, naprosto všechno**, protože moje máma byla tmel…“ **bez otázky**, na kterou to odpovídá (#212 chybí).
   - **MCP 30 s:** stejné jádro + #22 na začátku, moderátorka 35 %.
   - **MCP 15 s** [22,211,213]: otázka #211 „Když přijde rodina o člověka jako je máma?“ bez své druhé půlky #212 („Co všechno se… zbortí?“), odpověď „Všechno“ tak visí.
   - **Panel 20 s:** 24,36 s (122 % cíle). Hák #188 „…je strašně důležitý říct, když ty říkáš, ty si to zvládla…“ je nedokončená myšlenka (pointa #189 chybí). Konec #222 „…měnila tahleta pozice.“
   - **`reason` popisuje jiné údery než skutečné picks:** zmiňuje „A najednou byl pryč“ (#219), které v žádném výběru není. U 20 s píše o „otázkách moderátorky o úmrtí mámy“, které ve výběru nejsou.
   - **Poděkování ani pozdravy:** žádné, to je ok.
   - **Důkaz:** `b15/b20/b30.log`, `b-ctx.log`, `p-out-upoutavka.txt`.

## Tabulka nálezů (toky 1–3)
| # | tok | nález | důkaz | záv. |
|---|---|---|---|---|
| 1 | 2, 3 | Titulky MCP/panel po reframe: chybějící slova na střizích kamery + velké písmeno (výše) | `b15-916*.srt`, `p-vyrok-captions.txt`, snímky | **3** |
| 2 | 3 | Panel upoutávka: 3 snímky cizího záběru na začátku | `p08…png`, `p-upoutavka-seq.txt` | **3** |
| 3 | 1, 3 | Obsah: moderátorka 23 / 48 / 35 % (15/20/30 s), odpověď „Všechno“ bez otázky, nedokončený hák v panelu, `reason` ≠ picks | `b*.log`, `b-ctx.log`, `p-out-upoutavka.txt` | 2 |
| 4 | 1 | **Délka MCP upoutávek:** 15→16,28 / 20→19,12 / 30→26,28 s (88–108 %).<br>**Hranice:** `edges` žádné, `retriedForEdges` žádné, check-cuts 20/20 hranic ✔.<br>**Whisper na exportech:** bez úlomků, řezy v tichu −59 až −82 dB.<br>**Obraz:** žádný záběr kratší než 0,72 s na hranicích, bez černé. | `b*.log`, `cc-upoutavky.log`, `w-b15/20/30.txt` | ok |
| 5 | 2 | **Výrok MCP 30 s** (`plan_edit_local` passage) #214–217 = **30,64 s**, 1 úsek.<br>**Hranice:** check-cuts ✔, „neřekla.“ celé (p1,00), řez na 1261,84 v tichu (zdroj −56 dB).<br>**Obsah:** začíná „To byl někdo…“ (antecedent máma až v #215); `reason` tvrdí, že začíná „nejbližší člověk“. | `v1.log`, `cc-vyrok.log`, `w-v916.txt`, `w-v-zdroj.txt` | 1 |
| 6 | 2 | **Reframe 9:16 + `add_captions {lines:1}`:** 27 jednořádkových titulků (max 20 znaků), poslední do 30,64.<br>**Export:** −14,0 LUFS / TP −1,5, `captionsBurned:true`, `.srt`.<br>**Rozpor:** `add_captions` vrací `srt` s 14 titulky po 36 znacích (před přeskládáním), na ose je 27. | `v2–v4.log`, `v3-captions*.txt`, `v-meri.txt` | 1 |
| 7 | 2 | **Shift+Delete po výřezu:** žiletka (MCP `razor`) 10,6 / 17,8 → klik na prostřední kus V1 vybere obraz **i** zvuk.<br>**Shift+Delete:** smaže oba, mezera se zavře (30,64 → 23,44), titulky se posunou.<br>**Ctrl+Z:** vrátí vše.<br>**Upoutávka 15 9x16** (3 střihy kamery) a panelové sekvence: každý kus obrazu má zvuk se stejným `linkId`. | `s1-razor.log`, `s2-shift-delete.log`, `s2-po-shift-delete.png`, `b15-916-app.txt` | ok |
| 8 | 2 | **Výrok z panelu (Hermes, 30 s, 9:16):** #203–207 = **30,88 s**, 1 úsek, 4 střihy kamery.<br>**Hranice:** check-cuts ✔, Whisper bez úlomků, −14,3 LUFS.<br>**Obsah:** začíná „Odumírají červený krvinky…“ (bez „nemoc“ chybí kontext).<br>**Výpis:** „plán 18 s“ u výsledku 30,88 s mate (S8: „plán 6 s“). | `p-out-vyrok.txt`, `cc-panel-vyrok.log`, `w-p-vyrok.txt` | 1 |
| 9 | 3 | **Panel karta Titulky:** po 9:16 ukazuje dál „**40 znaků** · 2 řádky“, i když `#ccChars` = 25 (S8 #3, beze změny).<br>**Hlavička:** „Claude připojen“, i když běží Hermes.<br>**Zlepšení:** poslední řádek „✔ … 9x16“ je po doběhnutí vidět (v S8 byl pod patičkou). | `p02`, `p03`, `p07` | 1 |
| 10 | 4 | **Chyby česky (opraveno proti S8):**<br>• „Sekvence nenalezena: neni takova“ (get/open/razor/export),<br>• `import_media` neexistujícího souboru = **chyba** „Soubor neexistuje: …“ (při mixu s platným jen pole `error`),<br>• „Do složky C:/Program Files nejde zapisovat…“,<br>• reframe 9:16→9:16 česky.<br>**Drobnost:** u XDCAM ze 9:16 hláška radí „změň sekvenci na 1920×1080 25 fps“ a nezmíní `format:"dnxhr"` ani skutečnou velikost sekvence. | `e1.log` | 1 |
| ok | – | **Hermes:** 6× `plan_edit` 11:19–11:30, všechny hotové, `llama-server.log` i `worker.log` 0× „CUDA error“. | `cache/worker.log` | – |

## Srovnání s S8
| oblast | S8 | S11 |
|---|---|---|
| upoutávka MCP – délka | 10,72 s z 20 | **opraveno**: 16,28 / 19,12 / 26,28 s (15/20/30) |
| upoutávka MCP – `edges` / retry | ⚠ zvuk na hranici −7,3 dB, retry 6 kandidátů | **žádné**, nezávisle 20/20 hranic čistých |
| upoutávka MCP – obsah | moderátorka 39 %, otázka → odpověď z jiného tématu | moderátorka 23–48 %, odpověď „Všechno“ bez celé otázky (**beze zlepšení**) |
| `reason` | uříznutý, azbuka | celé věty, bez azbuky (**opraveno**), ale popisuje jiné údery než picks |
| výrok MCP 30 s | 28,60 s, `edges` žádné | 30,64 s, 1 úsek, hranice čisté |
| titulky po reframe 9:16 | 22 jednořádkových, ok | **REGRESE**: chybí slovo na každém střihu kamery (MCP i panel) |
| propojení A/V po výřezu | (zvuk se nedělil) | **ok**: kus = obraz + zvuk, Shift+Delete maže obojí |
| upoutávka panel | 15,44 s, souvislá, bez probliknutí | 24,36 s (122 %), **3 snímky cizího záběru na začátku**, slabší hák |
| úlomky slov (Whisper) | žádné | žádné (7 exportů) |
| chyby MCP | předpona česky, text anglicky; import ≠ chyba | **opraveno**: česky, import = chyba |
| panel 1366×768 | poslední řádek ✔ pod patičkou; karta Titulky 40 znaků | ✔ vidět; karta Titulky dál 40 znaků |
| Hermes | 12 úloh, 0× CUDA error | 6 úloh, 0× CUDA error |

**Logy:** `team\v2\s11\ai\`
- `a0`, `b15/20/30`, `b-ctx`, `b-export`, `b15-916*`, `b15-169-cap`, `cc-*`, `v1`–`v4`, `s1`/`s2`, `p-*`, `e1`
- `w-*.txt` (Whisper + RMS)

**Snímky:** `team\v2\s11\shots-ai\`

**Exporty** `web\test-out\`:
- `ai-s11-upoutavka-15/20/30-169.mp4`, `ai-s11-upoutavka-15-916-tit.mp4` (+srt)
- `ai-s11-vyrok-mcp-169.mp4`, `ai-s11-vyrok-mcp-916.mp4` (+srt)
- `ai-s11-panel-vyrok-916-tit.mp4` (+srt)
- `ai-s11-panel-upoutavka-916/-169.mp4`

Exporty jsem dělal přes MCP `export_sequence`, dialog Export jsem neotevíral.

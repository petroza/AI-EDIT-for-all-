# Kolo S8 – AI tok (standalone, MCP MY Premiere MCP + AI panel, Hermes) – závěrečná regrese

**Otázka:** Funguje AI ve standalone po všech opravách bez regrese?

**Odpověď: ano, regresi jsem nenašel.**
- Zaseknutí mostu z S4 je opravené.
- Jednořádkové titulky přežijí Auto Reframe.
- Spustit zůstává vidět i s otevřeným Nastavením AI.
- Hermes zvládl 12 úloh za sebou a v lozích není ani jedno „CUDA error“.
- **Neopravená zůstala upoutávka přes MCP:** výsledek je totožný s S4.

**Jak jsem testoval:**
- **Instance:** `standalone.js start 9374 %TEMP%\pz-s8-ai --size 1366x768 --lang cs --ai`.
  - Most 7880 patřil PID 12992, jehož rodič je 19808, tedy moje instance.
  - `premiere_status` vrátil `app: TNSTRIH`.
  - Worker běží od 02:21:28, má tedy nový kód.
- **MCP:** volal jsem přes `s3/ai/mcp.js` (PMCP_PORT=7880), logy jsou v `s8/ai/*.log`.
- **Měření hranic:**
  - `s3/ai/hranice.py` (Whisper large-v3 int8_float16 + RMS 20 ms), u podezřelých míst i na zdroji,
  - ffmpeg scene > 0,25, `signalstats` YDIF, `blackdetect`, ebur128.
- **Panel:** ovládal jsem ho přes `cdp.js eval` (`click()` / `change` v `#aiFrame`) a snímal přes `cdp.js shot`.
- **Pomocné úpravy:** kvůli kroku 3 jsem jeden klip na V2 položil přes `TN.app.editCore.placeClip`, protože MCP překryv položit neumí.
- Claude ani Codex jsem nespouštěl.
- **Konec:** instanci jsem zastavil (`stop 9374`), porty 7880 i 9374 jsou volné.
- **Moje chyba:** jednou jsem poslal `sentences` místo `picks`. Pomůcka pak pokračovala na aktivní sekvenci a export `ai-s8-vyrok-916.mp4` byl ve skutečnosti upoutávka. Přejmenoval jsem ho na `ai-s8-upoutavka-mcp-916-tit.mp4`, log je `v1-chyba-parametru.log`.

## 3 nejdůležitější nálezy

1. **Upoutávka přes MCP je beze změny proti S4 (3).**
   - **Výsledek:** 10,72 s místo „do 20 s“, z toho 39 % tvoří moderátorka, a otázka dostane odpověď z jiného tématu.
   - **Zadání:** doslova „Udělej z rozhovoru s Bárou Šimkovou upoutávku do 20 s na sítě“, `targetSec 20`, `build` + `sceneCuts`.
   - **Výběr:** picks `[12, 52]`. #12 je moderátorka: „Vůbec nevím, kde se vzala tato herecká tvoje dráha a kudy šla?“ Za ní následuje #52 ze 4:42, kde Bára mluví o tom, že poslala životopis.
   - **Proč oprava 9819f34 nezabrala (z kódu, neověřeno během běhu):**
     - Pravidlo „otázka jen se svou odpovědí“ v `_teaser_guard` platí jen při `len(order) > 2`. Tady zbyly 2 údery, takže otázka zůstala.
     - Doplnění délky nic nepřidalo. Hypotéza: náhradníci jsou buď moderátorka ([48,49]), nebo začínají spojkou „A“ ([96,97], [219]), a pravidla je vyřadí.
     - `retriedForEdges` vyřadilo 6 kandidátů.
   - `reason` je dál uříznutý a obsahuje azbuku: „otázka -> vysvětл“.
   - **Konec:** bez probliknutí a bez zopakovaných snímků. Scéna je jen na 4,20, YDIF posledních snímků 0,42–2,6 (16:9) a 1,2–7,2 (9:16).
   - **Úlomky slov:** Whisper žádné neslyší („…pošlu životopis.“). Řeč ale končí na posledním snímku (RMS −32 dB až do 10,66 s). Nástroj to sám hlásí v `edges`: „⚠ 00:04:49.34 konec: zvuk na hranici -7.3 dB“.
   - **Hlasitost:** 9:16 −14,0 LUFS.
   - **Důkaz:** `b1.log`, `b1-ctx.log`, `w-b.txt`, `shots-ai/b-916-konec-posl16.png`.

2. **Zaseknutí mostu na konci souboru je opravené (S4 nález 1, závažnost 3 → ok).**
   - **Na S4 souboru** `ai-s4-novy-70s.mp4`:
     - `build_sequence_from_transcript [13]` (klip až do 70,02 s) proběhl za **5,4 s**.
     - Přesně ten případ, který v S4 zasekl most, tedy `plan_edit_local {targetSec 15, build}` s výběrem #12–13 (In 60,56 / Out 70,00), proběhl za **22,8 s**.
     - `premiere_status` hned potom odpověděl za 0,0 s.
   - **Export** `ai-s8-konec-souboru-169.mp4` má 9,44 s, bez černé a bez zamrzlých snímků (YDIF 0,9–1,2).
   - **Důkaz:** `h1.log`, `h2.log`, `h4.log`.

3. **Výpis výsledku v panelu při 1366×768 je vidět jen zčásti a karta Titulky ukazuje špatné nastavení (2).**
   - **Co je vidět po doběhnutí** (pane posunutý na 275 z 374 px):
     - konec `reason`,
     - „Jak dopadl střih…“,
     - tlačítka 👍 👎 Otevřít / Export MP4.
   - **Co vidět není:** poslední řádek „✔ STRIH HERMES 20s … 9x16 (1080×1920…)“ leží na 650–684 px pod patičkou (610–649), hlášení „✔ hotovo“ je nad výřezem. To je lepší než S4, kdy nebyl vidět žádný výpis.
   - **Karta Titulky:** po přepnutí formátu na 9:16 ukazuje dál „**40 znaků** · 2 řádky“, i když `#ccChars` = 25.
     - Příčina: `main.js` mění hodnotu bez události `change` a `layout.js capInfo` se proto nepřepočítá.
     - Je to NOVÉ, dřív jsem to nehlásil.
   - Hlavička panelu dál ukazuje „Claude připojen“, i když běží Hermes.
   - **Důkaz:** `shots-ai/p02-panel-po-vysledku.png`, `p03-panel-nastaveni-ai.png`.

## Další nálezy
| # | kde | nález | důkaz | záv. |
|---|---|---|---|---|
| 4 | MCP chyby | **Beze změny proti S4:** předpona je česky („Střihový program (…)“), text zůstává anglicky. Příklady: „XDCAM HD422 needs 1920×1080 … (sequence is 1080×1920 25 fps) – use MXF DNxHR HQ or H.264 instead.“, „Sequence not found: neni takova“, „Cannot write to the folder C:/Program Files…“, **nově viděno** „“…9x16” is 1080×1920 – reframe to 9:16 only from a wider sequence…“, a poznámka `remove_clips` „Gap not closed: another clip…“. `import_media` neexistujícího souboru stále není chyba (`isError` ne, „Project item not found“). Česky a dobře hlásí `transcribe_media` „Soubor neexistuje: …“ a `build_sequence_from_transcript` „…ještě neexistuje přepis. Nejdřív zavolej transcribe_media.“ | `e1.log`, `v1-chyba-parametru.log` | 2 |
| 5 | MXF | `.mxf` bez `format` = XDCAM, a ten je pro tuto sekvenci (1280×720 25p, zdroj má 720p) **odmítnut** s radou „use MXF DNxHR“. S `format:"dnxhr"` vše sedí: DNxHR 1280×720, 2× mono PCM, **−23,0 LUFS** (obě stopy dohromady), TP −6,7. Titulky nejsou vypálené (snímek), `.srt` vedle má 12 jednořádkových. Velikost 285 MB / 28,6 s. Agent musí ze zprávy pochopit, že má přidat `format`. | `v2.log`, `v3.log`, `shots-ai/v-mxf-12s-bez-titulku.png` | 1 |
| 6 | konec výroku | Výrok končí na střihu kamery a YDIF skočí 3,19 → **7,72 na ~28,44 s**, stejně jako v S4 (drobné cuknutí). Na konci nejsou nulové YDIF (zopakované snímky nejsou vidět jako zamrznutí). Je to známé otevřené. | `v2.log` | 1 |
| 7 | panel Výrok (Hermes) | Souvislá pasáž #248–… (20,08 s, 1 úsek) začíná „Určitě jo, my jsme to vlastně založily…“, tedy odpovědí na nezobrazenou otázku („to“ bez kontextu). Konec „…po tom, co máma odešla, stala.“ je střižený v 60–80ms mezeře před „protože“. Souvětí tak pokračuje, úlomek ale v exportu neslyšet: zdroj −58 dB na 1467,38, Whisper „stala.“ p 1,00. | `p-out-vyrok.txt`, `w-p2.txt`, `w-p2-zdroj.txt` | 1 |
| 8 | panel | `srcName` se po přepnutí sekvence obnoví až za několik sekund (po 1,5 s ještě ukazoval starou „AI-S8 70s upoutavka“, po 6 s správně). Tooltip zní „aktivní ve **Střihátku**“ (starý název). `reason` je dál uříznutý („Žádný z dostupných úderů není j“), „plán 6 s“ u výsledku 15,44 s mate. | eval, `p-out.txt` | 1 |
| ok | výrok 30 s | Build [211–214, {215,toWord:2}, 219] = **28,60 s**, 2 úseky, `edges` žádné. `add_captions {lines:1}` → „cues 12“. **Reframe 9:16 → 22 titulků, všechny jednořádkové** (srt), nejkratší 0,70 s, vypálené jednořádkově. Export 9:16 −13,6 LUFS, TP −1,5, `captionsBurned:true`, `.srt` vedle. Whisper na střihu 27,16 a na konci čistý (RMS −69 dB na střihu). Scény jen střihy kamery ve zdroji (0,96 / 3,36 / 9,88). | `v1.log`, `v2.log`, `w-v.txt`, `shots-ai/v-916-tit-12s-26s.png` | – |
| ok | remove_clips | Klip V1+A1 (3,24–10,04) pod b-rollem na V2 (5–7 s), `ripple:true` vrátí `{"removed":2,"gapsLeftOpen":1,"note":…}`. Mezera zůstala, b-roll je netknutý. Volný klip (V1 10,04–15,24 + A1 9,76–15,24) vrátí `{"removed":2}` a mezera se zavře (následující klip 15,24 → 9,76, obraz i zvuk spolu). | `r1.log`, `r2.log`, `shots-ai/r-ripple-po.png` | – |
| ok | panel upoutávka (Hermes) | Upoutávka · 20 s · 9:16 → „STRIH HERMES 20s 02:28:03“. Je totožná s S4: #206–207 → #213, **15,44 s**, souvislá, bez moderátorky, Auto Reframe se 2 střihy kamery. Klik 02:28:01, hotovo včetně 9:16 ~02:29:10. Scény jen 1,84 / 6,52 (střihy kamery ve zdroji). Konec bez zopakovaných snímků (YDIF 0,9–1,6). Whisper bez úlomku, na střihu 9,96 RMS −62/−66 dB. Na konci je nádech (zdroj −35 dB, „rodiny.“ končí 1230,90). −14,0 LUFS. | `p-out.txt`, `p3.log`, `w-p.txt`, `w-p-zdroj.txt` | – |
| ok | Spustit 1366×768 | Před během, po výsledku i s **otevřeným Nastavením AI** je `#run` na 345–391 px (frame 649) a `elementFromPoint` = `#run`. V S4 bylo s Nastavením AI pod patičkou, teď je to opravené. | `p01`–`p03` | – |
| ok | Hermes | **12× `plan_edit`** 02:21:39–02:32:44: MCP upoutávka s opakováním, 70s upoutávka, review 45 s hned po Whisperu (přepis 12,5 s → plán 8,3 s), review 28 min 2 min (51,6 s), panel 2×. Všechny `done`, jediná `error` je očekávaná (neexistující přepis). `llama-server.log` 480 → 852 řádků, **0× „CUDA error“**, `worker.log` 0×, `llama-server.log.out` prázdný. | `cache/worker.log`, `cache/hermes/llama-server.log`, `h3.log` | – |

## PŘED (S4) / PO (S8)
| oblast | S4 | S8 |
|---|---|---|
| zaseknutí mostu (sestřih do konce souboru) | **most mrtvý do restartu** (622 s, pak timeout) | **opraveno**: 5,4 s / 22,8 s, most hned odpovídá |
| upoutávka MCP – délka | 10,72 s z 20 | **10,72 s z 20** (beze změny) |
| upoutávka MCP – souvislost | otázka o herectví → odpověď o životopisu, moderátorka 39 % | **beze změny** (pravidlo platí jen u > 2 úderů) |
| upoutávka panel | 15,44 s, souvislá, bez moderátorky | **15,44 s**, totožná |
| `lines:1` → reframe 9:16 | 2 řádky (12 dvouřádkových) | **opraveno**: 22 jednořádkových, vypálené jednořádkově |
| export sítě | −14,0 / −13,6 LUFS, titulky, srt | **beze změny ok** (−14,0 / −13,6 LUFS, TP −1,5) |
| export MXF | nezkoušeno | DNxHR: −23,0 LUFS, nevypálené, .srt; XDCAM 720p25 odmítnut s radou |
| `remove_clips ripple` | nezkoušeno | pod b-rollem `gapsLeftOpen:1`, volný klip zavřen |
| konec sekvence | bez probliknutí; výrok cuknutí 7,72 | **beze změny** (bez probliknutí, cuknutí 7,72 na 28,44 s) |
| úlomky slov | žádné (panel, výrok v2) | **žádné** (upoutávka, výrok, panel 2×) |
| chyby z aplikace | předpona česky, text anglicky | **beze změny** (+ reframe a `gapsLeftOpen` note anglicky) |
| panel Spustit 1366×768 | po výpisu vidět, s Nastavením AI pod patičkou | **vždy vidět** |
| panel výpis | není vidět bez posunutí | **zčásti vidět** (zpětná vazba + tlačítka), poslední řádek ✔ 9x16 pod patičkou |
| Hermes | 0 pádů / 13 úloh | **0 pádů / 12 úloh**, 0× CUDA error |

Snímky: `team\v2\s8\shots-ai\`
- `b-*`: MCP upoutávka
- `v-*`: výrok 9:16 a MXF
- `r-ripple-po`
- `p01`–`p03`: panel

Logy: `team\v2\s8\ai\`
- `a0`, `b1`, `b2`, `v0`–`v3`, `r0`–`r2`, `h1`–`h4`, `e1`, `p3`, `p4`
- `p-out*.txt`
- `w-*.txt` (Whisper + RMS)

Exporty `web\test-out\`:
- `ai-s8-upoutavka-mcp-169/-916.mp4`, `ai-s8-upoutavka-mcp-916-tit.mp4` (+srt)
- `ai-s8-vyrok-916.mp4` (+srt), `ai-s8-vyrok-169.mxf` (+srt)
- `ai-s8-panel-hermes-916.mp4`, `ai-s8-panel-vyrok-916.mp4`
- `ai-s8-konec-souboru-169.mp4`
- testovací vstup `ai-s8-novy-45s.mp4`

Instance 9374 je zastavená. Nic jsem neopravoval ani necommitoval.

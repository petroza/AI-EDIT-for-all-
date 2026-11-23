# Kolo S4 – AI tok (standalone, MCP MY Premiere MCP + AI panel, Hermes) – závěrečná regrese

**Otázka:** Funguje AI ve standalone po všech nočních opravách?

**Odpověď: většinou ano. Zůstává jedna nová blokující vada (zaseknutý most) a upoutávka přes MCP je dál slabá.**
- **Panel (Upoutávka · 20 s · 9:16 · Hermes):** souvislá upoutávka o smrti mámy, 15,44 s, bez moderátorky. Konec čistý. Spustit zůstává vidět i po výpisu.
- **MCP upoutávka** (zadání doslova): 10,72 s místo „do 20 s“. Otázka moderátorky dostane odpověď z jiného tématu (nález 2).
- **Výrok 30 s přes MCP:** funguje, titulky jsou vypálené a hlasitost je −13,6 LUFS. Jednořádkové titulky ale vzniknou jen v pořadí reframe → titulky (nález 3).
- **Hermes:** 13 úloh `plan_edit` za sebou, i hned po přepisu Whisperem. V obou lozích 0× „CUDA error“.

**Jak jsem testoval:**
- Instance `standalone.js start 9374 %TEMP%\pz-s4-ai --size 1366x768 --lang cs --ai`.
- Most 7880: PID 74344, rodič 64548 = moje electron instance. `premiere_status` vrátil `app: TNSTRIH`, Premiere neběžela.
- MCP jsem volal přes `s3/ai/mcp.js` (PMCP_PORT=7880), logy jsou v `s4/ai/*.log`.
- Hranice jsem měřil `s3/ai/hranice.py` (faster-whisper large-v3 int8_float16 + RMS 20 ms), dál ffmpeg scene > 0,25, `signalstats` YDIF (zopakované snímky) a ebur128.
- Panel jsem ovládal přes `cdp.js eval`: `element.click()` / `change` v `#aiFrame`, plus `cdp.js shot`.
- Claude ani Codex jsem nespouštěl; agenta v panelu jsem přepnul na Hermes.
- Kvůli diagnostice nálezu 1 jsem instanci jednou restartoval. Na konci jsem ji zastavil (`stop 9374`); porty 7880 i 9374 jsou volné.

## 3 nejdůležitější nálezy

1. **Když AI sestřih končí na konci média, most se zasekne a MCP přestane odpovídat (3). Je to NOVÉ.**
   - **Kroky:**
     1. Krátký soubor `web/test-out/ai-s4-novy-70s.mp4` (70,02 s, vyříznutý z rozhovoru).
     2. `transcribe_media` (Whisper 4,8 s).
     3. `plan_edit_local {targetSec 15, build}` vybral #12–13, klip In 60,56 / **Out 70,00** (konec souboru).
   - **Co se stane:**
     - Sekvence „AI-S4 novy 70s upoutavka“ v aplikaci vznikne, ale `buildSequence` neodpoví.
     - MCP po **622,3 s** vrátí chybu (nález 4).
     - Pak už most neodpoví vůbec: `premiere_status` 20 s, timeout (exit 124). Agent i panel jsou zaseklé až do restartu aplikace.
   - **Ověřeno po restartu:**
     - `build_sequence_from_transcript` věty [3,4] (uprostřed souboru): **2,9 s ok**.
     - Věta [13] (68,52–70,00, konec média): **> 100 s bez odpovědi** a `premiere_status` opět timeout.
     - V aplikaci `window.__pzEdgeShots(seq)` (volá ho `pmcp-api.js` → `edgeShots` po `buildSequence`) **nedoběhl ani za 20 s**.
   - **Příčina: neověřeno.** Hypotéza: `fixEdgeShots` / `cameraCuts` čte snímky až do `clip.out` = konec souboru a čeká na snímek, který nepřijde. Soubor má `moov` na konci; S3 75s klip ho měl také a tam build prošel, takže `moov` asi příčina není.
   - U 28min rozhovoru to nenastane, dokud výběr nesahá na konec souboru. U krátkých klipů (reportáž, výřez) je to ale běžné.
   - Důkaz: `s4/ai/h1.log`, `h2-stred.log`, `h2-konec.log` (prázdný = timeout), snímek `shots-ai/h1-visi-build.png`.

2. **Upoutávka přes MCP: 10,72 s místo „do 20 s“, z toho 39 % moderátorka, a otázka dostane cizí odpověď (3).**
   - **Zadání:** doslova „Udělej z rozhovoru s Bárou Šimkovou upoutávku do 20 s na sítě“, `targetSec 20`, `build` + `sceneCuts`.
   - **Výběr:** picks [12, 52], 2 úseky. Druhý běh dal totéž (`b3.log`).
   - **Text upoutávky:**
     - #12 moderátorka (4,20 s): „Vůbec nevím, kde se vzala tato herecká tvoje dráha a kudy šla?“
     - #52 Bára: „Jako já jsem si neuvědomila… jak je to vlastně možná drzí, že bez nějakých zkušeností jsem jako pošlu životopis.“
     - Odpověď je z 4:42 a mluví o životopisu na Novu v 19–20 letech. Divák pochopí, že poslala životopis kvůli herectví.
   - **Délka:** `reason` Hermese popisuje 4 údery / 14 s, postaví se ale 2. Text je zase useknutý a obsahuje azbuku: „otázka -> vysvětл“.
   - **Konec:** „životopis“ končí 20 ms před „ale“ z #53. Nástroj to sám hlásí: „⚠ 00:04:49.34 konec: zvuk na hranici -7.3 dB“.
     - Whisper v exportu úlomek neslyší („pošlu životopis.“).
     - Řeč ale končí bez nádechu přesně na posledním snímku.
   - **Opraveno proti S3:**
     - falešné „věci s ním │ A najednou byl pryč“ zmizelo,
     - moderátorka je jen 1 úder,
     - **konec bez probliknutí a bez zopakovaných snímků:** scéna jen na střihu 4,20; YDIF posledních snímků 0,37–2,6 (16:9), tedy žádný 0.
   - Důkaz: `b1.log`, `b1-ctx.log`, `w-b.txt`, `w-b-zdroj.txt`, `shots-ai/b-916-konec-10.08-10.72.png`, export `ai-s4-upoutavka-mcp-169/-916.mp4` (−14,0 LUFS, TP −1,5).

3. **`lines: 1` se ztratí, když agent dá titulky před `reframe_sequence` (2).**
   - **Pořadí ze zadání** (build → `add_captions {lines:1}` → reframe 9:16 → export):
     - 16:9 má 12 jednořádkových titulků („cues 12“ = 12 v sekvenci, opraveno proti S3).
     - Sekvence 9:16 po reframe má styl `lines 2, maxChars 20`, tedy **12 dvouřádkových**. Tak se i vypálí a uloží do `.srt` (`ai-s4-vyrok-916.mp4/.srt`).
   - **Pořadí podle CLAUDE.md** (reframe → `add_captions {lines:1}`):
     - „cues 22“ = 22 titulků v sekvenci, **všechny jednořádkové**, nejkratší 0,70 s,
     - vypálené jednořádkové (`ai-s4-vyrok-916-1radek.mp4`, `ai-s4-vyrok-v2-916.mp4`).
   - Agent, který titulky přidá dřív, dostane bez varování dva řádky. `reframe_sequence` neříká, že titulky přepočítal jinak.
   - Důkaz: `v1.log`, `v2-seq.json`, `v3-seq.json`, `shots-ai/v1-916-tit-srovnani-12s.png` (vlevo 2 řádky, vpravo 1).

## Další nálezy
| # | kde | nález | důkaz | záv. |
|---|---|---|---|---|
| 4 | MCP chyby | **Předpona je nově „Střihový program (…)“, text zůstává anglický:** „XDCAM HD422 needs 1920×1080…“, „Cannot write to the folder C:/Program Files…“, „Sequence not found: neni takova“. Timeout mostu píše **„Premiere nestihla odpovědět do 600 s… Pokud je v Premiere otevřený dialog, zavři ho.“** (ve standalone matoucí). `import_media` neexistujícího souboru není chyba (`isError` ne) a hlásí „Project item not found“. `plan_edit_local` vypíše „plan_edit selhal: RuntimeError: … nejdřív transcribe.“ Česky a dobře: `transcribe_media` „Soubor neexistuje: …“, `build_sequence_from_transcript` „…ještě neexistuje přepis. Nejdřív zavolej transcribe_media.“ | `e1.log`, `h1.log` | 2 |
| 5 | MCP výrok | První návrh výroku (#211–214 + #218–219) postavil hranici do souvislé řeči. Nástroj správně varoval (`edges`: −1,7 dB a „možná useknuté slovo „neřekla.““). V exportu Whisper slyší úlomek **„hla“ 25,72–25,88 s** (p 0,47). Po úpravě `{id:215,toWord:2}` místo #218 už varování nebylo a Whisper je čistý. Agent musí `edges` číst; nástroj vadnou verzi i tak postaví. | `v1.log`, `w-v.txt`, `v4.log`, `w-v2.txt` | 2 |
| 6 | konec výroku | Poslední klip končí 0,16 s před střihem kamery (1264,96). Řešení = **4 zopakované snímky** (1264,80–1264,96). V exportu je skok YDIF 3,19 → **7,72 na 28,44 s** (v2), tedy drobné cuknutí. Bez probliknutí. Je to známé otevřené (souhrn noci). | `shots-ai/v2-916-konec-28.04-28.6.png` | 1 |
| 7 | panel 1366×768 | **Spustit po výpisu vidět (opraveno):** 574–620 px při výšce 649, `elementFromPoint` = `#run`. **Výpis výsledku ale není vidět bez posunutí:** `#out` 746–926 px, pane `pz-pane-assistant` se musí posunout (847/519). Uživatel po kliku nevidí „✔ hotovo“, jen novou sekvenci. Při otevřeném Nastavení AI je **Spustit pod patičkou** (620–666 px, patička 611–649, na středu tlačítka je `pz-foot-head`). | `p01`, `p02`, `p03`, `p04` | 2 |
| 8 | panel Titulky | „Přidat titulky“ (výchozí 25 znaků, dvouřádkové pro 9:16): „9 titulků“ = 9 v sekvenci (opraveno S3 #9). Výsledek je pořád **jen ve výpisu Asistenta**, v záložce Titulky po kliku nic. | `p2-titulky.json`, `p06-titulky-po.png` | 1 |
| 9 | panel upoutávka | Jump cut na 10,24 s: stejný detail Báry, hlava poskočí (#207 → #213). Zvuk začíná 9,96 (J-cut), titulek „Všechno, naprosto všechno“ nastupuje 9,96. | `p07-panel-916-strih-10.24.png` | 1 |
| 10 | panel výpis | `reason` je dál uříznutý („Žádný z dostupných úderů není j“). Řádek „plán 9 s“ u výsledku 15,44 s mate (trvá S3 #8). Hlavička panelu ukazuje „Claude připojen“, i když běží Hermes. | `p-out.txt`, `p03` | 1 |
| ok | panel upoutávka | Picks: #206–207 → #213 (`STRIH HERMES 20s 00:37:36`). „Za tři týdny… byla pryč. My jsme vůbec neměli možnost se připravit. │ Všechno, naprosto všechno, protože moje máma byla tmel té naší rodiny.“ Souvislé, bez moderátorky, 15,44 s, 9:16 (střihy kamery 2). Scény jen 1,84 a 6,52 (střihy kamery ve zdroji, první záběr 1,84 s). Konec bez cizího záběru a bez zopakovaných snímků. Whisper: žádný úlomek; RMS na střihu −62/−66 dB. Export s titulky −14,0 LUFS. Od kliku po hotovo: Worker 00:37:35–00:38:32, pak reframe. | `p-out.txt`, `p3.log`, `w-p.txt`, `p08` | – |
| ok | výrok v2 | 28,60 s, 2 úseky, `edges` žádné, Whisper čistý. 16:9 i 9:16 −13,6 LUFS, TP −1,5 dBFS. Titulky vypálené (`captionsBurned: true`), `.srt` vedle. Scény jen střihy kamery ve zdroji (0,96 / 3,36 / 9,88). | `v5.log`, `w-v2.txt`, `v2-916-zacatek-0-1.9.png` | – |
| ok | Hermes | **13× `plan_edit`** 00:29–00:53 (2× MCP upoutávka po 3 bězích, panel 3, nový 70s klip 2, review 70s, review 28 min = 30 s), vše `done`. Jediná `error` je očekávaná (neexistující přepis). Whisper nového souboru 00:42:31 (4,8 s) → `plan_edit` 00:42:36 ok (9,3 s). `llama-server.log` 150 → 423 řádků, **0× „CUDA error“**; `worker.log` 0×; `llama-server.log.out` prázdný. | `cache/worker.log` 00:29–00:53, `hermes/llama-server.log` | – |
| ok | obnova | Po restartu instance (kvůli nálezu 1) se obnovily všechny sekvence včetně těch, které vznikly během zaseknutí. | eval po restartu | – |

## PŘED (S3) / PO (S4)
| oblast | S3 | S4 |
|---|---|---|
| upoutávka MCP – souvislost | „věci s ním │ A najednou byl pryč“ + ½ moderátorka | falešné „pryč“ **pryč**. **Nově:** otázka o herectví → odpověď o životopisu na Novu, moderátorka 39 % |
| upoutávka MCP – délka | 19,04 s | **10,72 s** (2 úseky z „do 20 s“) |
| upoutávka panel | 17,00 s, souvislá | **15,44 s, souvislá**, bez moderátorky |
| konec sekvence | 4 sn. celku pod „pryč.“ (MCP i panel) | **bez probliknutí** všude. Výrok končící na střihu kamery = 4 zopakované snímky (cuknutí) |
| úlomky slov | žádné | panel a upoutávka **žádné**. Výrok v1 „hla“ (nástroj varoval), v2 čistý |
| `add_captions lines/charsPerLine` | ignorováno, „cues 12“ × 10 dvouřádkových | **respektováno**, počet sedí. Po následném reframe ale zpět 2 řádky |
| `export_sequence` | titulky, −14 LUFS, srt | **beze změny ok** (−14,0 / −13,6 LUFS, TP −1,5) |
| chyby z aplikace | anglicky, „Premiere (exportSequence):“ | předpona **„Střihový program (…)“**, text dál anglicky. Timeout mostu „Premiere nestihla…“ |
| panel Spustit 1366×768 | po prvním výpisu pod okrajem | **po výpisu vidět**. Výpis sám pod okrajem; s Nastavením AI pod patičkou |
| panel Titulky | „9“ hlášeno × 10 v sekvenci | **9 = 9**, výsledek dál jen v Asistentovi |
| Hermes | 0 pádů / 5 úloh | **0 pádů / 13 úloh**, 0× CUDA error |
| zaseknutí mostu | – | **NOVÉ:** build s klipem do konce média = most mrtvý do restartu |

Snímky: `team\v2\s4\shots-ai\`.
- `00-stav`
- `p01`–`p08`: panel
- `b-*`: MCP upoutávka
- `v1-*`, `v2-*`: výrok
- `h1-visi-build`

Logy: `team\v2\s4\ai\`.
- `a0`, `b1`–`b3`, `v0`–`v5`, `e1`, `h1`, `h2-*`, `p1`, `p3`
- `p-out.txt`, `p2-titulky.json`, `v2/v3-seq.json`
- `w-*.txt` (Whisper + RMS)

Exporty `web\test-out\`:
- `ai-s4-upoutavka-mcp-169/-916.mp4`
- `ai-s4-vyrok-169/-916.mp4` (+srt; pořadí ze zadání, 2 řádky)
- `ai-s4-vyrok-916-1radek.mp4` (+srt)
- `ai-s4-vyrok-v2-169/-916.mp4` (+srt)
- `ai-s4-panel-hermes-916-tit.mp4` (+srt)
- testovací vstup `ai-s4-novy-70s.mp4`

Instance 9374 je zastavená. Nic jsem neopravoval ani necommitoval.

# Kolo S3 – AI tok (standalone, MCP MY Premiere MCP + AI panel, Hermes)

**Otázka:** Zvládne AI (Hermes přes panel i agent přes MCP) ve standalone udělat upoutávku a výrok bez vad?

**Odpověď: panel ano, MCP agent ne.**
- **Panel (Upoutávka · 20 s · 9:16 · Hermes):** dal souvislou upoutávku o smrti mámy, 17,00 s. Konec má ale 4 snímky celku.
- **MCP:** `plan_edit_local` se zadáním doslova dal 19,04 s. Opakovaně vychází stejně, a obsahuje novou falešnou souvislost (nález 1).
- **Úlomky slov:** na krajích nejsou ani v jedné verzi.
- **Hermes:** nepadá. Prošly 4 úlohy za sebou, i hned po přepisu Whisperem, v logu 0× „CUDA error“.
- **`export_sequence` přes MCP:** titulky, hlasitost, srt i DNxHR fungují. Chyby z aplikace jsou ale pořád anglicky s předponou „Premiere (…)“.

**Jak jsem testoval:**
- Instance `standalone.js start 9374 %TEMP%\pz-s3-ai --size 1366x768 --lang cs --ai`, na konci `stop 9374`.
- Most 7880 = PID 10396, rodič = moje electron instance. Před každou sérií `premiere_status` = `PZ AI Cut Standalone`.
- MCP přes `s3/ai/mcp.js` (kopie z S2), logy `s3/ai/*.log`.
- Hranice jsem měřil `s3/ai/hranice.py` (faster-whisper large-v3 int8_float16 + RMS 20 ms), výsledky jsou v `w-b.txt` a `w-p.txt`. Dál ffmpeg scene > 0,25, ebur128 a ffprobe.
- Panel jsem ovládal kliky přes `element.click()` v `#aiFrame`. Claude ani Codex jsem nespouštěl; v panelu jsem přepnul agenta z výchozího **Claude · Sonnet** na **Hermes**.

## 3 nejdůležitější nálezy

1. **Upoutávka přes MCP svádí k falešné souvislosti a z poloviny ji mluví moderátorka (3).**
   - **Zadání:** doslova „Udělej z rozhovoru s Bárou Šimkovou upoutávku do 20 s na sítě“, `targetSec` 20, `build` + `sceneCuts`.
   - **Výběr:** #12, #48–49 (moderátorka), #95–97, #219.
   - **Konec upoutávky:** „…Jak zjistíš **o něm** co nejvíc… Hrozně mě bavilo si zkoušet i věci **s ním**. │ **A najednou byl pryč.**“
     - #95–97 mluví o natáčení reportáže s kuchařem (8:40). #219 mluví o smrti mámy (21:03).
     - Divák pochopí, že „on“ (respondent) zemřel nebo zmizel.
     - Úvodní „o něm“ nemá předchozí větu, takže se neví, o kom je řeč.
   - **Moderátorka:** mluví 9,64 s z 19,04 s. Je to otázka „kudy šla herecká dráha?“, na kterou nepřijde odpověď.
   - **Kontrola `distorted` to nezachytila.** Označila jiné věty.
   - **Hermes sám píše v `reason`, že plán nevyšel:** „Celková délka 9s je příliš krátká, potřebujeme 20s. Zkusíme jinou kombinaci… To je jen 12s a“ (text je useknutý).
   - **Opakování dá totéž:** druhý běh (`h1.log`, 44 s) vrátil stejné picks i stejné hranice. Agent, který text nečte, dostane vadu pokaždé.
   - **Oprava S2 zabrala jen napůl:** pořadí je chronologické a „proto jsem se dostala na Novu“ po smrti mámy už nepadne.
   - **Panel je v pořádku:** zadání z karty obsahuje „bez moderátora“. Výsledek #206–207 → #213 → #219 (máma) je souvislý.
   - Důkaz: `s3/ai/b1.log`, `b1-ctx.log`, `w-b.txt` (CELY), export `web/test-out/ai-s3-upoutavka-mcp-169.mp4` / `-916.mp4` (17,0–19,0 s).
2. **Obě upoutávky končí 4 snímky celku pod posledním slovem „pryč.“ (3).**
   - **Kde:** MCP 18,88–19,04 s, panel 16,84–17,00 s. V 16:9 i 9:16, scéna detekovaná v obou.
   - **Proč:** ve zdroji je střih kamery na 1264,96, Out klipu #219 je 1265,12.
   - **Oprava S3 sem nedosáhne.** „Zbytek do 5 snímků převezme soused“ neplatí pro poslední klip.
   - **`sceneCuts` vadu jen hlásí, a to 2× za jeden střih:** „1.34 s po začátku klipu“ i „0.18 s před koncem klipu“. Panel ukáže tři řádky 🎞 ⚠, se kterými uživatel nic neudělá.
   - Je to pointa upoutávky, přesně na úderu. Stejný typ vady jako výstup S3 #3, tady ale v každé AI upoutávce z tohoto rozhovoru.
   - Důkaz: `shots-ai/b-916-konec-18.6-19.04.png`, `b-169-konec-18.6-19.04.png`, `p05-panel-916-konec-16.6-17.0.png` (poslední 4 dlaždice = celek).
   - Kroky: libovolná ze dvou cest výše → export → snímky od konce −0,2 s.
3. **`add_captions` přes MCP ve standalone ignoruje `lines` a `charsPerLine` a hlásí jiný počet titulků (2).**
   - **Panelová sekvence 9:16** (titulky z panelu: 25 znaků, 2 řádky): `add_captions {lines:1, charsPerLine:30}`
     - nástroj vrátí „cues 12“ a jednořádkové SRT v cache,
     - v sekvenci je ale 10 **dvouřádkových** titulků,
     - vypálené titulky a `.srt` vedle exportu jsou také dvouřádkové (`ai-s3-panel-hermes-916-tit.srt`).
   - **MCP sekvence 9:16:** „cues 15“ → v sekvenci 13 dvouřádkových (styl `lines 2, maxChars 20`).
   - **Příčina:** `src/core/pmcp-api.js:405`. Když sekvence už má `captionStyle`, styl z SRT se zahodí. `charsPerLine` se nepoužije nikdy.
   - Petr chce jednořádkové titulky, agent mu je přes MCP nedá a odpověď nástroje tvrdí opak.
   - **Opraveno z S2:** druhé `add_captions` titulky **nahradí** (10, ne 20).

## Další nálezy
| # | kde | nález | důkaz | záv. |
|---|---|---|---|---|
| 4 | AI panel 1366×768 | **Spustit je vidět jen před prvním během.** Na začátku 620/649 px (opraveno). Po prvním úkolu výpis (220 px) odsune Spustit na 804 px při výšce 649. Pane `pz-pane-assistant` se musí posunout (887/519). Při otevřeném Nastavení AI je Spustit také pod okrajem. | `p08-asistent-1366.png`, `p03-hermes-916.png` | 2 |
| 5 | MCP chyby | **Chyby z aplikace jsou dál anglicky s předponou „Premiere (exportSequence):“.** Příklady: „Cannot write to the folder C:/Program Files – choose another place to save.“, „XDCAM HD422 needs…“, „Sequence not found: neni takova“. Aplikace má český překlad (`lang.js:175`), ale do MCP jde anglický text. Předponu přidává `server/index.js:89`. | `e1.log` | 2 |
| 6 | panel „⬇ Export MP4“ | **Kód beze změny.** Exportuje sekvenci z řádku výsledku, tj. **16:9**, i když bylo zvoleno 9:16 (reframe proběhl až po vykreslení řádku). Neuložený projekt exportuje do `O:\AI STRIH ALL app\export\` (`src/ai/main.js:317`). Neklikal jsem, zapsal by mimo test-out. | kód | 2 |
| 7 | MCP upoutávka | Jump cut: na 17,48 s stejný polocelek Báry, hlava poskočí (#97 → #219). | `b-169-strih-17.48.png` | 1 |
| 8 | panel výpis | „ℹ … · plán 9 s“ u výsledku 17 s mate. `reason` je uříznutý („…z kariérní části (U5-U11), která v“). Štítky U2/U8 nejsou vysvětlené (trvá S2 #8). | `s3/ai/p-out.txt` | 1 |
| 9 | panel Titulky | „Přidat titulky“ je už česky (opraveno S2 #6). Výsledek se pořád hlásí jen v Asistentovi, ne v záložce. Hlášeno „9 titulků“, v sekvenci 10. | `p07-titulky-po.png`, `p-out.txt` | 1 |
| 10 | titulky panelu 9:16 | Nejkratší 0,84 s (≥ 0,7). „Všechno, naprosto všechno“ nastoupí 9,96 s, tedy 0,28 s před střihem 10,24 a 0,38 s před řečí. „Za tři týdny.“ končí 0,92 s, ale „týdny“ zní do 1,12. | `p-out.txt`, `w-p.txt` | 1 |
| ok | úlomky slov | **Čisté.** RMS na střizích: MCP −62/−65/−67 dB, panel −66 dB a −47…−51 dB. „Ab-“ z „Absolutně“ začíná ve zdroji 1203,94, Out je 1204,00, ale prolnutí zvuku ho utlumí na −47 dB a Whisper ho v exportu neslyší. `sceneCuts` správně přichytil začátek #213 na 1225,96 (ticho 1225,64–1226,06). „Tak“ z S2 zmizel jen proto, že #22 už nikdo nevybral; hranice #22 opravené nejsou (viz výstup S3 #2). | `w-b.txt`, `w-p.txt` | – |
| ok | délka | „Do 20 s“: MCP 19,04 s, panel 17,00 s (S2: 22,84 s). Nový 75s klip „do 15 s“: 14,44 s. | `b1.log`, `h1.log` | – |
| ok | Hermes opakovaně | **Nepadá.** Panel (23:26) → nový 75s klip přes Whisper float16 (11,9 s) → Hermes se spustí za 9 s → 3× `plan_edit_local` (28,8 / 15,2 / 44,0 s), vše `done`. Po 2 min nečinnosti ho Worker vypne a příště znovu spustí (9–12 s). `llama-server.log` 0× „CUDA error“. | `h1.log`, `cache/worker.log` 23:26–23:33 | – |
| ok | `export_sequence` | Titulky vypálené bez parametru (`captionsBurned: true`). 9:16 −13,9 / −14,1 LUFS, TP −1,5 dBFS. 16:9 s `loudness: social` −13,9. `srt: true` uloží `.srt`. `format: dnxhr` dá MXF DNxHD 1080×1920 425/425 snímků, 2× PCM 24 bit, −23,0 LUFS (sloučené kanály). Neexistující složku vytvoří. `.mp4` s `format: prores` uloží jako `.mov` a cestu vrátí. Zavřený most: „Střihový program neodpovídá. Otevři Premiere Pro… nebo aplikaci PZ AI Cut.“ (opraveno). | `b2.log`, `p2.log`, `e1.log`, `c1.log` | – |
| ok | panel 1366×768 | Před během je Spustit vidět. Patička „Systém připraven“ už celá. Karty Výrok, Upoutávka, Zkrácená verze a Bez pauz vyplní zadání, u Výroku a Upoutávky i 20 s. | `p01`, `p08`, eval | – |

## Tabulka zadání
| zadání | volání (počet) | čas | výsledek | vady |
|---|---|---|---|---|
| MCP: upoutávka do 20 s (doslova), `plan_edit_local` + `build` + `sceneCuts` | status, transcribe (cache 1,5 s), plan_edit_local (40,6 s), get_transcript ×4, get_sequence, export 16:9, reframe 9:16 `slower` (13,3 s), get_sequence, add_captions (1,5 s), export 9:16 (4,0 s) = **13** | nástroje ~65 s, se čtením ~3 min | 19,04 s, 4 úseky, 9:16 s titulky −14,1 LUFS | falešná souvislost + ½ moderátorka (1), 4 sn. celku na konci (2), jump cut (7) |
| panel: Upoutávka · 20 s · 9:16 · Hermes → Spustit | 4 kliky (karta, 9:16, Hermes, Spustit) | ~75 s (Hermes start 11 s; konec odhadnut z logu Workeru) | 17,00 s, 3 úseky, 9:16 bez titulků, obsah souvislý | 4 sn. celku na konci (2), Spustit pak pod okrajem (4) |
| panel: Titulky → Přidat titulky (9:16) | 1 klik | 4,1 s | 10 titulků, slova sedí | hlášeno 9 (9), nástup −0,38 s (10) |
| MCP: `add_captions` podruhé `{lines:1, charsPerLine:30}` + export srt / dnxhr / chyby | 9 | <20 s | nahradí titulky, export ok | parametry ignorovány, „cues 12“ × 10 (3), anglické chyby (5) |
| Hermes ×4 po Whisperu | transcribe nového 75 s + 3× plan_edit_local | 12 + 29 + 15 + 44 s | vše `done`, bez pádu | – |

## PŘED (S2) / PO (S3)
| oblast | S2 | S3 |
|---|---|---|
| Hermes | (S3 původně: CUDA error při prvním dotazu) | **0 pádů** v 5 úlohách, start 9–12 s |
| délka „do 20 s“ | MCP 22,84 s, panel 18,72 s | **MCP 19,04 s, panel 17,00 s** |
| kontext | obě verze: smrt mámy → „proto jsem se dostala na Novu“ | **panel souvislý**. **MCP nově:** „věci s ním. │ A najednou byl pryč.“ + ½ moderátorka |
| probliknutí | 4 sn. celku uvnitř (za #219, 5,20 s) | uvnitř **0**. **4 sn. celku na konci** (poslední klip #219) v obou verzích |
| úlomky slov | „tak“ na začátku #22 | **žádné** (#22 nevybrán; jeho hranice ale opravené nejsou) |
| `export_sequence` MCP | bez titulků, −30,1 LUFS, bez srt, DNxHR nejde | **titulky, −14 LUFS, srt, DNxHR −23 LUFS** |
| chyba zavřeného mostu | „Otevři Premiere Pro…“ | **„…nebo aplikaci PZ AI Cut“** |
| chyby z aplikace | anglicky, „Premiere (exportSequence):“ | **beze změny** |
| druhé `add_captions` | „Smaž v Premiere starou CC stopu“ | **nahradí** (10, ne 20). `lines`/`charsPerLine` se ale ignorují |
| panel Titulky | „Add captions“ anglicky | **„Přidat titulky“**. Výsledek dál jen v Asistentovi |
| panel Spustit 1366×768 | (vzhled S3: pod okrajem) | před během **vidět**, po prvním výpisu pod okrajem |

Snímky: `team\v2\s3\shots-ai\`.
- `00-start`
- `p01`–`p08`: panel
- `b-*`: MCP upoutávka
- `e-916-tit-2.0s`

Logy a skripty: `team\v2\s3\ai\`.
- `a0`, `b1`, `b1-ctx`, `b2`, `p1`, `p2`, `e1`, `e2`, `h1`, `c1`
- `p-out.txt`, `w-b.txt`, `w-p.txt`
- `mcp.js`, `hranice.py`

Exporty `web\test-out\`:
- `ai-s3-upoutavka-mcp-169.mp4`, `ai-s3-upoutavka-mcp-916.mp4` (+ `.srt`)
- `ai-s3-panel-hermes-169.mp4`, `ai-s3-panel-hermes-916.mp4`, `ai-s3-panel-hermes-916-tit.mp4` (+ `.srt`), `ai-s3-panel-hermes-916.mxf` (DNxHR)
- testovací vstup `ai-s3-novy-75s.mp4`

Instance 9374 je zastavená. Zavřený most jsem testoval až po zastavení.

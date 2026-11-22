# Kolo S2 – AI tok (standalone, MCP MY Premiere MCP + AI panel)

**Otázka:** Zvládne agent přes MCP ve standalone udělat typická zadání bez zbytečných kroků, se srozumitelnými odpověďmi a s dobrým výsledkem?

**Odpověď: střih 30s výroku ano, upoutávka ne.**
- **30s výrok:** čistý, nástroje odpovídají rychle a k věci.
- **Export přes MCP:** dá MP4 bez titulků a bez normalizace hlasitosti.
- **Upoutávka:** MCP i panel s Hermesem opakují stejné tři vady:
  - 4 snímky jiného záběru,
  - úlomek slova „tak“,
  - zkreslený kontext.

**Jak jsem testoval:**
- Instance `standalone.js start 9374 %TEMP%\pz-s2-ai --size 1600x900 --lang cs --ai`, most 127.0.0.1:7880. Před každou sérií `premiere_status` = `"build":"PZ AI Cut Standalone"`, nikdy Adobe Premiere.
- Volání přes `s2/ai/mcp.js` (kopie pomůcky z S1). Logy: `s2/ai/a*.log`, `b*.log`, `c*.log`.
- Kontrola: `s2/ai/hranice.py` = faster-whisper large-v3 int8_float16, okna ±1,2 s + RMS po 20 ms. Výsledky `w-a.txt`, `w-b.txt`, `w-p.txt`. Dál ffmpeg detekce scén a ebur128.
- Exporty `web/test-out/ai-s2-*`.
- Claude ani Codex jsem nespouštěl. V panelu jsem volbu přepnul z výchozího **Claude · Sonnet** na **Hermes**.

## 3 nejdůležitější nálezy

1. **Upoutávka má 4 snímky celku a úlomek slova. MCP i panel to dělají stejně (3).**
   - **Probliknutí:** věta #219 „A najednou byl pryč.“ končí 0,18 s za střihem kamery (zdroj 21:04,94). Ve výsledku jsou 4 snímky celku mezi dvěma detaily Báry.
     - MCP 16:9: 5,20–5,36 s.
     - Panel 9:16: snímky 284–287 = 11,36–11,52 s.
     - Nástroj to jen vypíše jako `⚠ … obraz jen bleskne` a nic nevymění. V panelu je to řádek 🎞 ⚠, který uživatel nemá jak opravit.
   - **Úlomek „tak“:** úsek #22 začíná ve zdroji na 121,32. Konec předchozího slova „a tak.“ přitom leží na 121,28–121,42.
     - Na začátku úseku je 0,1 s řeči (RMS −31/−28/−28 dB).
     - Whisper v exportu slyší „**Tak** vlastně jsem si pak uvědomila“ (p 0,89–0,94).
     - Kontrola hranic (`edges`, `retriedForEdges`) ho nenahlásila. Střih padl do uzávěru hlásky „k“ uvnitř slova.
   - Důkaz: `shots-ai/p10-hermes-916-snimky-280-291.png`, `shots-ai/b-upoutavka-probliknuti.png`, `s2/ai/w-b.txt`, `s2/ai/w-p.txt` (t = 11,52 a 15,64).
   - Kroky: `plan_edit_local` s `instruction` „Udělej z rozhovoru s Bárou Šimkovou upoutávku do 20 s na sítě…“, `targetSec` 20 a `build`. Nebo panel → Upoutávka → 20 s → 9:16 → Hermes → Spustit.
2. **Upoutávka zkresluje kontext (3).**
   - Obě verze končí smrtí mámy (#206/#207/#219, 19:53–21:05) a hned za ní „…a **proto** jsem se dostala na Novu jako reportérka“ (#22, 2:01). Tahle věta je z doby o roky dřív a mluví o odchodu od herectví.
   - Divák pochopí, že se reportérkou stala kvůli smrti matky. Hermes to tak i zdůvodňuje: „z osobní tragédie se stává profesní poslání ('proto jsem se dostala na Novu')“.
   - Hned po „A najednou byl pryč.“ se Bára v záběru směje (`b-upoutavka-probliknuti.png`, poslední 3 snímky; v 9:16 `p10`, vpravo).
   - Kontrola vytržení z kontextu (`distorted`) označila jiné věty a tuhle ne.
   - Totéž ve výstupu MCP (`b1.log`) i v panelu (`p09-upoutavka-hotovo.png`).
3. **`export_sequence` přes MCP dělá z výroku „na sítě“ tiché video bez titulků (3 pro agenta, 2 pro panel).**
   - Ve standalone nástroj přijímá jen `output`, `preset`, `range` a `useAME`. Bridge přitom umí `burnCaptions` (`src/core/pmcp-api.js:297`).
   - Agent poslal `burnCaptions: true`. Schéma ho zahodilo a nástroj vrátil `"result":"No Error"`.
   - Výsledek `ai-s2-vyrok-916.mp4`:
     - bez vypálených titulků (`a-916-5s.png`), i když sekvence měla 17 titulků,
     - bez `.srt` vedle,
     - **−30,1 LUFS** (sítě −14).
   - Popis nástroje mluví o Premiere, Media Encoderu a `.epr`.
   - Chyba XDCAM radí „use MXF DNxHR HQ“, ale přes MCP DNxHR zvolit nejde (`.mxf` = vždy XDCAM).
   - Tlačítko panelu „⬇ Export MP4“ volá stejný nástroj (`src/ai/main.js:314`). Neuložený projekt by podle kódu exportoval do `O:\AI STRIH ALL app\export\` (dirname ROOT). To jsem neklikal.

## Další nálezy
| # | kde | nález | důkaz | záv. |
|---|---|---|---|---|
| 4 | chyby nástrojů | **Odkazují na Premiere.** Zavřený most: „Panel MY Premiere MCP neodpovídá. Otevři Premiere Pro a panel Okno > Rozšíření…“. `add_captions` podruhé: „Smaž v Premiere starou CC stopu (Timeline… Delete Track)“. Ve standalone obojí neplatí, titulky se tu dají přepsat (u 9:16 se zkopírovanými titulky to `add_captions` bez námitek udělal). Chyby bridge jsou anglicky s předponou „Premiere (exportSequence): …“. Agent by uživatele poslal do Premiere. | `c1.log`, `c2.log` | 2 |
| 5 | ID vět | **MCP a panel Přepis číslují věty jinak.** MCP má 295 vět, aplikace 409 vět ze stejných slov. MCP #228 „Jako musím říct…“ je v aplikaci #320, aplikace #228 je MCP #164. Uživatel čísla nevidí, ale „Hledat v 409 větách“ × agent „295 vět“ a výběr z Přepisu do zadání se může minout. | `a2.log`, eval `__pzASR.load` | 2 |
| 6 | panel, záložka Titulky | Tlačítko **„Add captions“ anglicky** v české verzi. Po kliknutí žádné hlášení v záložce, výsledek je jen v Asistentovi. | `p03-titulky-tab.png` | 2 |
| 7 | `plan_edit_local` | „Do 20 s“ dalo **22,84 s** (odhad 21,4). Panel dal 18,72 s, ten je v pořádku. | `b1.log` | 2 |
| 8 | `plan_edit_local` | Odpověď je velký JSON s interními poli (`ranked`, `llmStats`, `passages`, 10 prázdných polí). `reason` je uříznutý uprostřed („…nejvýraznější: U5 (háček), U7 (šok), U2 (beznaděj/nutnost), U“), štítky U2/U5 bez vysvětlení. V panelu je důvod uříznutý „s možným náč“. Řádek „plán složen znovu bez vět…: #218, #220, #220“ má duplicitu. | `b1.log`, `p09` | 1 |
| 9 | ruční oprava upoutávky agentem | Výměna za náhradníky [196, 207, 220] znovu dala 2× ⚠ obraz a 2× ⚠ zvuk na hraně. V souvislé řeči agent bez dalšího nástroje (seznam vět s klidnou hranou a celým záběrem) iteruje naslepo. | `b4.log` | 2 |
| 10 | `add_captions` | Hlášený počet ≠ sekvence: MCP „cues 9“ → v 9:16 je 17 titulků. Panel „8 titulků“ → v sekvenci 7. Aplikace titulky přelomí nebo sloučí. | `a10.log`, `p09` | 1 |
| 11 | `sceneCuts` | „Obraz jen bleskne“ hlásí i u 1,26 s celku na začátku výroku. To je normální záběr a v 9:16 je celek správně přeostřený na Báru (`a-916-0.5s.png`). Varování plaší a u 0,18 s vypadá stejně jako u 1,26 s. | `a7.log` | 1 |
| 12 | `get_transcript` / `find_pauses` | `fromId` 400 (za koncem, max 295) vrátí prázdný text bez hlášky. `find_pauses` nemá `from`/`to` a neznámé parametry tiše zahodí (vrátí celý soubor). | `c1.log`, `a6.log` | 1 |
| 13 | CLAUDE.md | Není jasné, jestli `sceneCuts` patří na studiový TALK. Je to „rozhovor“, ale se zapečenými střihy kamer. Použil jsem ho a pomohl (viz nález 1). | – | 1 |
| ok | panel Titulky | **„Connection closed“ opraveno:** Přidat titulky → 7 titulků za ~2 s, text sedí s řečí. | `p04-titulky-po.png` | – |
| ok | výrok 30 s | Začátek i konec čisté. „Jako“ 0,08 s za střihem. Konec „potlačovala.“ p 1,00, další „že“ nezačalo (RMS −48/−56 dB na střihu). Varování `edges` vedlo ke správné změně (#232 končil v řeči −7 dB, tak jsem bral jen #228–231). Titulky = řeč (rozdíly jen chyby ASR: „mi mi“ × slyšeno „mi jako“). | `w-a.txt`, `a5.log`, `a7.log` | – |
| ok | 9:16 | Auto Reframe 11 s, rozřízl střih kamery a obličej je v obou záběrech. Titulky se přelomily pro 9:16 (17). | `a-916-*.png` | – |
| ok | okrajové případy | Neexistující ID („Segment #9999 v přepisu neexistuje“), špatný rozsah slov, prázdná sekvence (`add_captions`/`export`/`reframe`), XDCAM 9:16 a neexistující soubor: všechny chyby srozumitelné, žádný pád. | `c1.log` | – |

## Tabulka zadání
| zadání | volání nástrojů (počet) | čas | výsledek | chyby |
|---|---|---|---|---|
| a) 30s výrok na sítě, 9:16 | import, list, transcribe (cache 1 s), outline, get_transcript ×2, build ×2 (5,8 s + 5,7 s), find_pauses ×2, add_captions ×2 (1,9 s), reframe (11,1 s), get_sequence ×3, export ×2 (2,3 + 1,3 s) = **19** (+ status) | nástroje ~40 s, se čtením ~2:40 | 22,48 s #228–231, střih čistý | export bez titulků, −30 LUFS (nález 3) |
| b) upoutávka do 20 s (`plan_edit_local` + `build`) | plan_edit_local (93,5 s) + kontrola get_transcript ×4, get_sequence, export, oprava build = **8** | ~2:30 | 22,84 s, 5 úseků, 2 moderátorka | 4 sn. celku, „tak“, zkreslený kontext, nad limit (1, 2, 7) |
| c) okrajové případy | 14 + 4 se zavřeným mostem | <5 s | srozumitelné, bez pádu | odkazy na Premiere, anglicky (4) |
| panel: Titulky → Přidat titulky | 1 klik | ~2 s | 7 titulků, bez „Connection closed“ | „Add captions“ anglicky (6) |
| panel: Upoutávka 20 s, 9:16, Hermes | karta + Spustit | 67 s (LLM 9 s) + reframe | 18,72 s, 3 úseky, 9:16 | stejné vady jako b) (1, 2) |

Snímky: `team\v2\s2\shots-ai\` (`a-*` výrok, `b-*` upoutávka MCP, `p01–p11` panel). Logy a skripty: `team\v2\s2\ai\`.
Exporty: `web\test-out\ai-s2-vyrok-169.mp4`, `ai-s2-vyrok-916.mp4`, `ai-s2-upoutavka-169.mp4`, `ai-s2-panel-hermes-169.mp4`, `ai-s2-panel-hermes-916.mp4`.
Instance 9374 je zastavená. Test zavřeného mostu proběhl až po zastavení.

# Kolo 8 – AI tok (app.js?v=mws7717d, konektor 1.4.0, 2026-11-22)

Úkoly a)–d) proběhly celé v jedné MCP relaci (jako Claude Desktop). Konektor běžel s `PZ_CONNECTOR_ORIGINS=http://127.0.0.1:8791`
a před každou dávkou šel `editor_status` s kontrolou `ai-r8.mp4`: **17/17 dávek šlo do mé karty a žádná nedostala poznámku o změně
karty**, takže přichycení relace ke kartě funguje. Na konci jsem zavřel Chrome (profil pz-r7-ai) i konektor; porty 7895–7897 jsou volné.

**Odpověď na otázku:** ano. Zadání a) zvládne agent v 8 voláních (4 kroky, 7,9 s v nástrojích) a výsledek je dobrý: 9:16, výřez podle
obličeje 8/8 záběrů, 13 titulků a nadpis. Agent ale nedostane varování o střihu v souvislé řeči a u b) to stálo jednu přestavbu. Na krátkém
materiálu je aplikace v tokenech asi 3× dražší než vložený přepis (pevná režie popisů nástrojů). Na 28 min vychází zhruba stejně a
místo seznamu časů dostane redakce hotovou sekvenci.

## Tři nejdůležitější nálezy
1. **Stavba sekvence zatají varování „konec v souvislé řeči“ (záv. 2).** `T.cutBounds` vrací `inOk/outOk` a panel Přepis podle nich
   ukáže „⚠ Konec v souvislé řeči…“ (`src/ui/transcript-panel.js:520`). `build_sequence_from_transcript` (`web/ai/tools.js:204–206`) si
   z toho bere jen `approx`, takže každá stavba vrátí stejnou obecnou poznámku „±0,2 s, ať to uživatel poslechne“.
   Skutečný případ b): konec #39 (Out 170,72) leží 150 ms v „My“ z #40, které začíná po mezeře 30 ms. RMS na Outu je −30,8 dB, tedy
   hlasitěji než medián řeči (−36 dB). Nástroj nehlásil nic. Agent to zachytil jen díky `sequence_text` („…jako všechno. **My** To byl můj…“)
   a sekvenci postavil znovu s `{id:39,toWord:14}`. Druhá verze má na Outu −65,9 dB a je čistá. Stálo to +3 volání a ~1 600 znaků.
2. **Tokeny (odhad, viz tabulka):** úkol a) na 5min výřezu stojí ~6 k tokenů, z toho polovina je pevná režie (tools/list 9 866 znaků
   + instructions 2 298). Vložený přepis 5 min stojí ~1,9 k. Na 28 min vychází a) „nejsilnější výroky“ ~15 k přes aplikaci proti ~11 k
   za vložený přepis. Web nemá osnovu ani kompaktní přepis, takže agent musí přečíst všechno. Tematický úkol b) vychází přes
   `search_transcript` levněji (~6–8 k proti ~11 k). Hledá se ale jen doslovné slovo: na „máma“ přišlo 6 vět, a celý příběh nemoci
   (#16–#33, „ona“) hledání minul, takže agent musel číst okolí.
3. **Tiché pasti u titulků a Zpět (záv. 2):**
   - `add_captions` na sekvenci s ručně opravenými titulky je bez varování přepíše („Added 13 captions“) a oprava „dozvěděli“ zmizí.
   - `set_captions` s `index: "3"` (řetězec) vrátí „Updated 1 caption(s)“, ale nic nezmění (klíč Mapy `"3"` ≠ číselné `i`, `tools.js:284/293`).
   - `undo` po stavbě s `format`+`captions` potřebuje **4 kroky** (Captions → Reframe → Format → Build). Po 3 krocích zůstane polovičatá
     sekvence 1280×720 a výsledek neříká, že ke stavbě patří ještě další krok.

## Tabulka nálezů
| # | úkol | volání | problém | dopad | záv. | důkaz |
|---|---|---|---|---|---|---|
| 1 | b (a) | build_sequence_from_transcript | `inOk/outOk` z cutBounds se agentovi nepředají, jen obecná poznámka u každé stavby | useknutý útržek „My“ projde bez varování; agent ho najde jen při pečlivém čtení sequence_text | 2 | calls.jsonl (b), edges-ab.json `b5v1` rmsOut −30,8 dB |
| 2 | c | add_captions | přepíše existující (i opravené) titulky bez upozornění | ztracené opravy, agent o nich neví | 2 | calls.jsonl (d): „dozvěděli“ → „rozvěděli“, undo vrátil |
| 3 | c | set_captions | index jako řetězec: „Updated 1“, ale beze změny | agent si myslí, že opravil | 2 | calls.jsonl (d) index "3", po undo titulek 3 původní |
| 4 | d | undo | stavba s formátem a titulky = 4 kroky; výsledek jmenuje jen jeden | po „vrať to“ zůstane polotovar | 2 | calls.jsonl (d) d-undo test 1080×1920 → 1280×720 → smazáno |
| 5 | a | build (Out 191,20) | konec „životě.“ 20 ms před Outem, RMS −49,6 dB proti mediánu −34,7 dB (stejné místo jako v kole 7, beze změny) | těsně utnutý doznívající konec | 1 | edges-ab.json `a2` |
| 6 | a, c | get_captions | titulky vynechávají vycpávky, které ve zvuku zazní (4×: „prostě“, „jako“, „Prostě jakoby“ ≠ „Protože prostě“); agent je z textu nepozná | titulky ≠ řeč | 1 | edges-ab.json `a2`, `a3` vs. get_captions |
| 7 | a | get_captions | titulek 7 končí 13,71 s, střih je 13,56 s (přesah 0,15 s do dalšího klipu) | drobnost | 1 | calls.jsonl (a) |
| 8 | d | source „ai-r“ | podřetězec tiše vybere `ai-r7.mp4` (NOT ACCESSIBLE) a radí „call transcribe_media first“, což by stejně selhalo | zavádějící rada | 1 | calls.jsonl (d) |
| 9 | d | get_sequence | název s „-“ místo „–“ se nenajde (norm neřeší pomlčky); chyba vypíše seznam názvů | +1 volání | 1 | calls.jsonl (d) |
| 10 | d | reframe_sequence | 9:16 → 9:16 se už správně odmítne, ale jako jediná hláška je česky (ostatní anglicky) | nejednotnost | 1 | calls.jsonl (d) |
| 11 | a, b | transcribe_media | vrací 40/69 vět a končí na #40, které pokračuje v ↳#41, takže vždy +1 volání (kolo 7 #8, beze změny) | +1 volání, +2,6 k znaků | 1 | calls.jsonl (a) |
| 12 | d | panel AI | karta „VÝSLEDEK d-undo test“ zůstane i po undo, které sekvenci smazalo; „Přehrát“ nic neudělá ani nic nehlásí | mrtvé tlačítko | 1 | d-stale-result.png |

Ověřeno jako opravené z kola 7: přichycení ke kartě (17/17), `set_captions` se špatným indexem (99, −1) teď vrací chybu a nic
nezmění, `reframe_sequence` na 9:16 sekvenci vrací chybu. Chybná ID vět: s aspoň jedním platným ID se sekvence postaví a vrátí varování
(„#999/#abc does not exist“). Bez platného ID vrátí chybu „No valid picks.“ Obojí je v pořádku. Neexistující médium: chyba se seznamem médií.
Název s diakritikou funguje, i malými písmeny a bez háčků.

## Kvalita výsledku
- **a)** „IG upoutávka 20 s – máma“: 21,68 s (cíl 20 s ±15 %), věty #30 | #43–46 | #53–54. Hák v 0–4 s („…za tři týdny byla pryč“),
  dál chronologicky. Nadpis „Ztráta mámy: za tři týdny byla pryč“ se vešel na 2 řádky. Snímek `a-ig-9x16.png`: obličej ve výřezu,
  nadpis nahoře. Všechny 3 začátky klipů jsou čisté (−67 dB).
- **b)** „Máma – 45 s na šířku v2“ (finální): 43,12 s, otázka #34–35 zůstala s odpovědí #36. Všech 6 hranic ověřených zvukem je čistých.
- **c)** Opravena 1 chyba rozpoznávání („rozvěděli“ → „dozvěděli“). Oba přepisy (web i large-v3) slyší „rozvěděli“, takže jde
  o rozhodnutí redakce. Vynechané vycpávky (#6) agent nemá jak zjistit.
- **Stačí výsledky nástrojů k ověření?** Napůl. `sequence_text` (slova podle zvuku klipů) je pro agenta nejlepší kontrola a útržek
  odhalil. Chybí varování u konkrétní hranice (#1), míra jistoty slov v titulcích (#6) a stav titulků/nadpisu v `editor_status`.
  Že výřez trefil obličej, potvrdí jen číslo „faces 8 of 8“.
- Citlivé téma (smrt matky): nástroje nic nehlídají; podle SKILL.md to má agent říct uživateli a nabídnout lehčí variantu.

## Tokeny – aplikace vs. vložený přepis
Znaky jsou **změřené** (`calls.jsonl`, vstupy i výstupy všech volání). Tokeny jsou **odhad**: lokální tokenizér Claude ani Codexu
není k dispozici, proto počítám ~3 znaky/token pro český text a ~4 znaky/token pro anglické JSON schéma. Skutečnost může být ±20 %.

| úkol | aplikace: volání / kroků | aplikace: znaky I/O (měř.) | aplikace: tokeny vč. režie 3,0 k (odh.) | vložený přepis 5 min (odh.) | aplikace 28 min (odh.) | vložený přepis 28 min (odh.) |
|---|---|---|---|---|---|---|
| a) 20s IG upoutávka | 8 / 4 | 9 040 | **~6,0 k** | ~2,4 k (1,9 k přepis + odpověď) | ~15 k (celý přepis po stránkách) | ~11–12 k |
| b) 45 s o mámě | 10 / 5 (z toho 3 na opravu útržku) | 8 928 | **~6,0 k** (bez opravy ~5,2 k) | ~2,4 k | ~6–8 k (search + okolí) | ~11–12 k |
| c) oprava titulků | 4 / 2 | 2 135 | **~3,7 k** | – (titulky bez aplikace nejsou) | ~3,7 k | – |
| pevná režie relace | – | 12 164 (tools 9 866 + instructions 2 298) | ~3,0 k (+~0,6 k SKILL.md v pluginu, duplikát instructions) | 0 | 3,0 k | 0 |

- Přepis 5 min (`full-transcript-5min.txt`, změřeno): 5 744 znaků s ID a časy, 4 422 znaků čistého textu, 804 slov.
  Na 28 min (×5,6, extrapolace): 32,2 k / 24,8 k znaků, tedy ~10,7 k / ~8,3 k tokenů.
- Placený vstup včetně opakovaného posílání kontextu v každém kroku (bez cache): a) ~48 k, b) ~57 k, c) ~20 k. S prompt cache je
  většina z toho levné čtení z cache. U vloženého přepisu jde o 1 krok.
- **Co by bez aplikace zbylo na člověka:** dohledat 3–6 střihů v NLE podle časů přepisu (přesnost ±0,2–0,6 s) a poslechem hlídat
  useknutá slova; titulky (13 bloků) vyrobit a načasovat a opravy zadat ručně; 9:16 výřez pro 8 záběrů včetně 5 střihů kamery uvnitř
  klipů; nadpis. Odhad 20–40 min práce u a) a 10–15 min u b). Navíc samotný přepis 28 min musí nejdřív někde vzniknout.

## Návrhy
1. `build_sequence_from_transcript`: místo obecné poznámky vracet u každé hranice `⚠ #39 end: continuous speech (no pause) – a word
   may be clipped; try toWord or another sentence` z `inOk/outOk`. Obecnou poznámku vynechat, když jsou všechny hranice v pořádku.
2. `add_captions`: když sekvence titulky už má, vrátit „replaced N existing captions (M edited by set_captions)“, nebo vyžadovat `replace: true`.
3. `set_captions`: `Number(fix.index)` (a v chybě uvést typ).
4. `undo`: parametr `steps`, nebo „undo last AI action“ (všechny kroky jedné stavby najednou). Ve výsledku uvést, co zbývá
   („3 more steps of build 'd-undo test'“).
5. Úspora tokenů na dlouhém materiálu: `get_transcript` s `format:"compact"` (bez časů, ~23 % méně) a osnova kapitol
   (jako `analyze_transcript` v Premiere MCP). Zkrátit popisy v tools/list (9,9 k znaků, polovina režie).
   `search_transcript` by mohl vracet ±1 sousední větu, aby agent nemusel načítat celé okolí.
6. `get_captions`: označit slova s nízkou jistotou ASR (`?slovo`), ať agent ví, co dát uživateli poslechnout.
7. `mediaOf`: při shodě podřetězcem napsat „matched ai-r7.mp4 (NOT ACCESSIBLE)“. Pro nepřístupné médium vracet chybu přístupu, ne
   „transcribe first“. V `norm()` sjednotit pomlčky `-–—`.
8. Hlášky nástrojů v jednom jazyce (reframe česky, ostatní anglicky). Kartu VÝSLEDEK po smazání sekvence skrýt.

Důkazy (`team/v2/r8/ai/`): `calls.jsonl` (66 záznamů: každé volání se vstupem, výstupem, časem a znaky; `guard:true` = pojistka),
`init.json` (tools/list + instructions), `edges-ab.json` (faster-whisper large-v3 + RMS na 10 klipech a a b), `full-transcript-5min.txt`,
`a-ig-9x16.png`, `d-stale-result.png`, `00-start.png`, `01-import.png`. Skripty: `agent-srv.js` (trvalá relace s pojistkou), `ag.js`, `edgecheck.py`, `clips.json`.

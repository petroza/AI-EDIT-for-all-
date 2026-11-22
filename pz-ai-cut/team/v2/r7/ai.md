# Kolo 7 – AI tok (app.js?v=mws3s0a1, 2026-11-22)

**Stav: test ZASTAVEN po 2. dávce volání** – konektor poslal `editor_status` do cizí karty (uživatelův projekt).
Podle bezpečnostního pravidla jsem nic dalšího nevolal, zavřel vlastní Chrome (profil pz-r7-ai) a ověřil, že neběží žádný
proces konektoru ani port 7895–7897. Do cizí karty šlo jen čtecí `editor_status` (nic se nezměnilo); v jejím panelu AI
se ale nejspíš objevilo „claude-ai-r7-test connected“. Úkoly a)–d) proto **neproběhly**; níž je jen to, co jsem stihl
naměřit, a nálezy z popisů nástrojů (tools/list) a čtení kódu – ty jsou označené „kód“ a nejsou ověřené během.

## Tři nejdůležitější nálezy
1. **Úkoly AI jdou do karty s fokusem, ne do té, se kterou AI pracuje (záv. 3).** Dávka 1 (editor_status + transcribe_media)
   šla správně do mé karty s `ai-r7.mp4`; o ~1 min později dávka 2 šla do uživatelovy karty (28min TALK, 13 sekvencí, aktivní
   „Codex – upoutávka Reels 20s (výřez opraven)“), přestože jsem těsně předtím klikl (CDP `mousePressed/Released`) do své stránky.
   Příčina (kód `web/ai/bridge.js:127–130`): karta s fokusem si každé 2 s obnovuje `lastAct = now` (`touch()`), konektor
   (`connector/server/index.js bestTab`) bere max `act` → karta, na kterou se uživatel jen dívá, vždy přebije kartu, ve které
   AI začala. Pro skutečného uživatele: Claude stříhá v kartě A, uživatel přepne na kartu B s jiným projektem → další
   `build_sequence_from_transcript` / `set_captions` / `undo` přistane v B. Agent to nepozná: odpovědi nenesou ID karty/projektu
   a oba projekty se jmenují „Untitled“ (rozliší je jen seznam médií). Pro tým: AI tok nejde testovat, dokud má uživatel otevřenou
   pz-ai-cut.pages.dev (ORIGINS konektoru ji pouštějí a stránka hledá port 7895 sama).
2. **Agent nemá jak ověřit střih na hranici (záv. 2, kód).** `build_sequence_from_transcript` nevrací žádné varování „zvuk na
   hranici“ (Premiere verze má `edges`); v tomto profilu má přepis „word times approximate“, takže každá stavba skončí jen obecnou
   poznámkou „ask the user to listen to each cut“ – kontrolu useknutých slov přehodí na uživatele. Kontrolor výstupu přitom
   v kole 7 našel useknutá slova na krajích (odloženo na kolo 8).
3. **Pasti v nástrojích, které mlčí (záv. 2, kód):** `set_captions` neplatný `index` tiše zahodí a hlásí „Updated N“;
   `reframe_sequence` slibuje „must be 16:9“, ale nic nekontroluje (9:16 → 9:16 projde); `undo` vrátí jen poslední krok
   (po stavbě s `format`+`captions` jsou to 3 kroky: stavba, formát, titulky) a může vrátit i ruční úpravu uživatele;
   `source` se hledá i podřetězcem (`norm(name).includes`) → „vyrez“ potichu vybere první médium, které to obsahuje.

## Co se stihlo změřit
| volání | čas | výsledek |
|---|---|---|
| tools/list | – | 18 nástrojů, instructions 2 298 znaků (shodné se SKILL.md) |
| editor_status | 0,0 s | média s ID, délkou, stavem přepisu; staré médium „NOT ACCESSIBLE“ – srozumitelné |
| transcribe_media (cache) | 0,0 s | 69 vět, prvních 40; věta #40 končí čárkou, pokračování ↳#41 se agent dozví až dalším voláním |
| get_transcript fromId 41 | – | **neodesláno** – pojistka zachytila cizí projekt (`ai/a1-transcript.json`, pole `abort`) |

Důkazy: `team/v2/r7/ai/a0-status.json` (tools/list, instructions, obě odpovědi), `a1-transcript.json` (zachycený cizí
`editor_status`), `00-start.png` (moje karta po startu). Klient s pojistkou: scratchpad `agent.js` (CDP klik + editor_status
s `ai-r7.mp4` před každým voláním) – bez ní by `test/mcp-client.js` volání do cizí karty pustil.

## Tabulka nálezů
| # | úkol | volání | problém | dopad na agenta | záv. | důkaz |
|---|---|---|---|---|---|---|
| 1 | vše | každé | úkol jde do karty s fokusem (obnova `act` každé 2 s), ne do karty, kde AI pracuje; bez upozornění | stříhá v cizím projektu, nic nepozná | 3 | a1-transcript.json, bridge.js:127–130, index.js bestTab |
| 2 | vše | editor_status | odpověď nemá ID karty/projektu (oba „Untitled“) | nemůže si ověřit, že mluví se stejnou kartou | 2 | a0 vs a1 |
| 3 | a, b | build_sequence_from_transcript | žádné varování o zvuku na hranici, jen obecná poznámka „approx ±0,2 s“ | nemůže ověřit useknutá slova, přehodí na uživatele | 2 | tools.js:204–220 (kód) |
| 4 | c | set_captions | neplatný index tiše ignorován, „Updated N“ bez seznamu | myslí si, že opravil vše | 2 | tools.js:282 (kód) |
| 5 | d | reframe_sequence | „must be 16:9“ se nekontroluje | vznikne nesmyslná kopie 9:16 bez chyby | 2 | tools.js:296–308 (kód) |
| 6 | d | undo | vrací 1 krok z 2–3 kroků stavby; může vrátit uživatelovu úpravu | po „undo“ zůstane polovičatý stav | 2 | tools.js:84, 214, 328 (kód) |
| 7 | d | source (všechny) | shoda podřetězcem bez varování | tiše vezme jiné médium | 2 | tools.js:24 (kód) |
| 8 | a, b | transcribe_media | vrací 40 vět i u 69vět. přepisu, uťato uprostřed souvětí | vždy +1 volání get_transcript | 1 | a0-status.json |
| 9 | a, b | obsah | výřez je o smrti matky (rakovina) – SKILL.md velí upozornit a nabídnout lehčí variantu | správně – jen poznámka pro hodnocení kola 8 | 1 | a0-status.json #13–#39 |
| 10 | schémata | tools/list | chybí: pozice/styl nadpisu, styl titulků v `build_…(captions)`, přejmenování/smazání sekvence, výpis kroků undo | víc volání nebo hádání | 1 | a0-status.json `tools` |

## Návrhy (popisy a výsledky nástrojů)
1. **Přichytit konektor ke kartě:** první karta, která vyřídí úkol, dostává všechny další úkoly téže relace (dokud žije);
   jinak výsledek s varováním „editor tab changed since the last call (project X → Y)“. `editor_status` ať vrací ID karty
   a „tab focused: yes/no“. Pro testy: pustit AI tok jen se zavřenou pz-ai-cut.pages.dev u uživatele, nebo konektor
   s proměnnou prostředí, která povolí jen origin 127.0.0.1:8791.
2. `build_sequence_from_transcript` → pro každou hranici `edges` (RMS na kraji, „⚠ zvuk na hranici klipu 2 out“), jako v Premiere MCP.
3. `set_captions` → vrátit seznam ignorovaných indexů; `reframe_sequence` → chyba, není-li sekvence 16:9;
   `undo` → v popisu „one step; a build with format/captions is 2–3 steps“, ve výsledku název vráceného kroku + co zbývá.
4. `source` → při shodě podřetězcem napsat, které médium se vzalo („matched ai-r7.mp4“); při víc shodách chyba se seznamem.
5. `transcribe_media` → u přepisu do ~120 vět vrátit celý (5min výřez = 69 vět), jinak končit na hranici souvětí.

Úkoly a)–d) zopakovat v kole 8 až po opravě bodu 1 (nebo se zavřenou kartou pz-ai-cut.pages.dev u uživatele).

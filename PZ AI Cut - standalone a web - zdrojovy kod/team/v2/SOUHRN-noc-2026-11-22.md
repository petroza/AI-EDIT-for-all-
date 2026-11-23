# Noc 22.–23. 11. 2026 – ladění PZ AI Cut Standalone (kola S1–S4 + AI tok)

Tým v2 (Redaktorka, Kontrolor výstupu, Vzhled a jazyk, AI tok) v izolovaných instancích `test/standalone.js`, vývojář = hlavní relace.
Reporty: `team/v2/s1` … `team/v2/s4`. Commity f29957c … 0af7646 (plus ranní).

## Největší změny
- **Přepis řeči ve standalone** bez AI: záložka Přepis, Přepsat řeč, titulky z přepisu – motor = lokální Worker MY Premiere MCP
  (Whisper large-v3 na GPU, sdílená mezipaměť), `src/ai/asr-desktop.js`.
- **Export**: MXF s titulky na snímek přesně, hlasitost dvouprůchodově (TV −23, sítě −14 ±0,5), XDCAM jen ve standardních
  velikostech, dialog Export (pevná šířka, hlasitost podle formátu, chyby červeně, dotaz před přepsáním).
- **Žádné probliknutí záběrů**: zbytek cizího záběru na krajích převezme soused (i po AI sestřihu a Auto Reframe, i pod řečí
  do 5 snímků), konec sekvence se prodlouží do pauzy, jinak se zopakují poslední snímky záběru (stejný výřez).
- **Titulky**: bez kousků slov z vedlejšího úseku (přesné časy Workeru), nikdy přes střih klipu, krátké titulky si půjčí čas.
- **Jako Premiere**: přepis timecodu v monitorech i na časové ose, Zesílení (G) Nastavit na / Změnit o, Ctrl+R už nenačítá
  okno, Ctrl+Q, automatická záloha zvlášť (projekt přepíše až Ctrl+S, obnova po pádu), varování při řezu uprostřed slova.
- **Chybějící média**: viditelná všude („Médium offline“), export to ohlásí předem, import přesunutého souboru klipy znovu připojí.
- **AI (MCP + Hermes)**: Hermes padal na „CUDA error“ u prvního dotazu na čerstvém serveru → zahřívací dotaz + restart a
  opakování; upoutávka bez falešných souvislostí (čas úderů, úder se spojkou jen za svou větou, moderátor max 1 úder);
  `export_sequence` ve standalone vypálí titulky a srovná hlasitost; `add_captions` respektuje počet řádků;
  skripty MCP (`run-tool`, `local-edit`…) fungují v cestě s mezerami.
- **Testy**: izolované instance mají vlastní úložiště okna (`PZ_USERDATA`) – do 21:50 testy zapisovaly do skutečného
  `%APPDATA%\PZ AI Cut Standalone` (např. `pzSafeZones=0` = vypnuté Bezpečné zóny), nechal jsem beze změny.

- **Po půlnoci (S4 AI tok, S5, S6)**: most se nezasekne na sestřihu do konce souboru (limit dekodéru), vícestopé
  sekvence – Shift+Delete vyjme úsek ze všech stop (b-roll, hudba, titulky synchronní), Ctrl+D na V2 prolne do stopy
  pod ním, zbytek cizího záběru na kraji b-rollu se odstřihne, poslední titulek na střihu už není nulový, MXF s titulky
  jako .srt; varování při řezu uprostřed slova, dotaz před přepsáním exportu, znovupřipojení přesunutého média importem.
- **Nezávislá revize kódu (2:00)**: 21 nálezů, opraveno 20 (41e7a73) – mimo jiné smazání b-rollu/hudby mazalo titulky
  řeči, Zpět po znovupřipojení média rozbilo klipy, webový export neznal prolínačku do stopy pod klipem.
- **S6/S7**: Shift+Delete bezpečně (mezera se zavře jen když je prázdná na všech stopách, jinak hláška a rada Extract),
  b-roll na V2 se po vložení sám očistí od cizího záběru, výřez podle obličeje i ve standalone při vkládání do 9:16,
  náhledy klipů na časové ose ze začátku klipu, znovupřipojené médium se hned přehraje.
- **Po 3:00 (bez agentů, ověřeno na Bárou 28 min, rozhovoru a debatě přes MCP → standalone)**:
  - Upoutávka přes `plan_edit_local` + `build`: hranice kandidátů se ověří zvukem už při výběru (stejná poloha střihu
    jako server). Dřív výběr našel pauzu až za dalším slovem („životopis.|Ale …“), stavba ji nezasáhla a opakování
    plánu vyřadilo nejlepší údery – 20 s upoutávka měla 6,5 s s vadným koncem. Teď 4 zdroje/délky: 23 / 24 / 16 / 11 s,
    **všech 26 hranic čistých** (`check-cuts`). Navíc: úder „…a proto…“ ze 2. minuty už nestojí za krizí z 21. minuty,
    poděkování za pozvání není úder, délka se doplní i před první úder.
  - Úlomek „…k“ na začátku úseku (#22 po „a tak.“) opravený: začátek jde do pauzy před slovem, ne do uzávěru hlásky
    (121,32 → 121,525 s, −25,6 dB).
  - Jednořádkové titulky 9:16: rozdělení věty počítá skutečnou dobu zobrazení (nejkratší 0,12 → 0,22 s; v rychlé řeči
    zůstává ~9 % titulků pod 0,7 s – na řádek se vejdou 2–3 slova, u titulků na sítě běžný rychlý styl).
  - Široký záběr přetažený do sekvence na výšku dostane výřez podle obličeje; vložení i výřez vrátí jedno Ctrl+Z.
  - Nezávislá revize nočních změn (2 vážné nálezy: začátek úseku mohl uříznout „s“, sloučení kroků Zpět mohlo smazat
    kroky uživatele) – opraveno (8d60c9c).
- **Kolo S9 (Redaktorka + Kontrolor výstupu, ~4:00)**: 19 exportů bitově shodných s S8, hlasitost i synchronizace beze změny.
  Nálezy opravené (32dd765): regrese z 70047c0 (b-roll na V2 v 9:16 bez úklidu cizího záběru), **obraz a zvuk se po výřezu /
  úklidu krajů rozpojovaly** (žiletka, Shift+Delete i ořez působily jen na obraz – teď se zvuk rozřízne spolu s obrazem a
  zůstane propojený, export čte navazující kusy vcelku, ověřeno vzorek po vzorku), 4 snímky celku s výřezem na stůl na konci
  prvního vložení do 9:16, předvybrané MXF s −14 LUFS, text toastu u selhaného přepisu.

## Otevřené
- Upoutávka/úlomek „k“ – opraveno po 3:00 (výše); v Premiere znovu ověřit `scripts/test-highlight.mjs` (Premiere zavřené).
- Zopakované snímky na konci sekvence jsou vidět jako drobné cuknutí úst; zbytek 6–12 snímků pod řečí na konci zůstává.
- Upoutávka přes MCP: drobná nejednoznačnost zájmen mezi údery (pravidlo pokrývá jen spojky na začátku úderu).
- Export H.264 bez vypálených titulků: po jednosnímkovém úseku se zbytek posune o půl snímku (20 ms) – spojování
  segmentů TS bez překódování; neopraveno (riziko pro jádro exportu, vzácné).
- `buildSequence` (API mostu) neumí položit klip přes jiný (překryv na V2) – rozšíření, MCP to pro Premiere taky nemá.
- Q/W (ripple trim k hlavě) vyjme úsek ze všech stop – b-roll přes místo střihu se rozstřihne se skokem (chování z dřívějška).
- MXF pro Novu: 2 mono stopy, TC 00:00:00:00, bez 1080i25 – potřeba technická specifikace TV.

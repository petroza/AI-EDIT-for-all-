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

## Otevřené
- Úlomek slova na začátku úseku z MCP (`refine_edges`: ticho 15 ms bere i uzávěr „k“) – ladit s Premiere + test-highlight.
- Zopakované snímky na konci sekvence jsou vidět jako drobné cuknutí úst; zbytek 6–12 snímků pod řečí na konci zůstává.
- Jednořádkové titulky 9:16 v rychlé řeči: 7 ze 46 kratších než 0,7 s (nejkratší 0,46 s).
- Upoutávka přes MCP: drobná nejednoznačnost zájmen mezi údery (pravidlo pokrývá jen spojky na začátku úderu).
- Export H.264 bez vypálených titulků: po jednosnímkovém úseku se zbytek posune o půl snímku (20 ms) – spojování
  segmentů TS bez překódování; neopraveno (riziko pro jádro exportu, vzácné).
- `buildSequence` (API mostu) neumí položit klip přes jiný (překryv na V2) – rozšíření, MCP to pro Premiere taky nemá.
- MXF pro Novu: 2 mono stopy, TC 00:00:00:00, bez 1080i25 – potřeba technická specifikace TV.

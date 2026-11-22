# Kolo 7 – vývojář (nasazeno app.js?v=mws3s0a1, 2026-11-22, bez commitu)

Výsledek: 9 nálezů opraveno a ověřeno, 4 odloženy na kolo 8 (níž). Testy 37/37, B1 9/9.

| Nález (kdo) | Záv. | Oprava | PŘED → PO (stejná cesta) |
|---|---|---|---|
| Kostičky/fleky 0,4–0,5 s po střihu (výstup) | 3 | `web/export-web.js`: klíčový snímek na každém střihu (jiný klip) i při velké změně obrazu (střih kamery v klipu, zmenšenina 32×18); min. odstup 2 snímky | I-snímky jen každé 2 s → na 1,72 · 3,60 · 7,60 · 12,84 · 15,00 s; snímky 15,04–15,40 (b) čisté (`scratchpad r7/artefakty.png`) |
| Titulky vynechaly „Myslím“ (redaktorka) | 3 | `transcripts.js pauseBoundary`: mezera mezi slovy, která leží v pauze u střihu, se počítá i mimo okno −0,4 s (přepis 0,54 s dřív než zvuk); `tools.js seqWords` (AI add_captions) jde stejnou zvukovou cestou jako tlačítko | „si, že tohle…“ → „Myslím si, že tohle…“ (In 208,32, výřez) |
| 2 snímky moderátorky na začátku klipu v 16:9 (výstup) | 3 | `reframe.js fixEdgeShots`: zbytek jiného záběru < 0,5 s na kraji klipu převezme soused i bez převodu formátu (AI stavba sekvence + Nová sekvence z Přepisu na šířku) | klip 7,52 s / In 145,88 → 7,60 s / In 145,96, předchozí prodloužen |
| Řez výřezu 9:16 o snímek pozdě (výstup) | 3 | `cameraCuts`: půlení pod 1 snímek a řez na skutečný čas snímku z dekodéru | 106,00 → 105,96 (b 1,72 s) |
| Zbytky záběru 0,36–0,40 s (výstup) | 2 | MIN_SHOT 0,3 → 0,5 s | – (měří kontrolor v kole 8) |
| Delete kousku obrazu smaže zvuk celé sekvence (redaktorka) | 2 | kusy obrazu po rozříznutí bez vazby na zvuk (web i desktop) | kód; ověří redaktorka |
| Přepnutí jazyka nechá panely v původním jazyce (vzhled, redaktorka) | 3 | Text v obraze se postaví znovu, Přepis + Titulky překreslí, bublina AI lišty | po CZ→EN 0 českých řetězců (sken DOM) |
| Text v obraze: posuvník, uříznutý „Podklad“ (vzhled) | 2 | Podklad na vlastním řádku, `overflow-x: hidden` | scrollWidth 698 = clientWidth 698 |
| 3 chyby konzole / 15 s bez konektoru (vzhled) | 2 | hledá 1 port (ostatní každé 4. kolo), po 5 min / skrytá karta 60 s; otevření panelu AI a návrat do karty hledá hned | ~720/h → ~60/h po 5 min |
| „sekund (25 frames)“, chybějící „\“ ve zkratkách, nepřeložené klávesy (vzhled) | 1–2 | renderer | kód |

## Odloženo na kolo 8
1. **Useknutá slova / útržky cizích vět na krajích klipů** (výstup: c Out 85,88 v další větě, a/b „dále.“, konec „životě“ −20 ms) – logika krajů (`cutBounds`), potřebuje vlastní měření na seedech.
2. **Rozsah jasu exportu** (plný rozsah bez značky → vyšší kontrast) – zjistit za běhu, co kodér dělá (1 zkušební snímek), pak buď značka `colr`, nebo stlačit RGB.
3. **9:16 výchozí nadpis přes obličej a titulky v zóně tlačítek** (redaktorka, výstup).
4. **Opus místo AAC na Windows N** – jen hláška/návod (prostředí).

## Kolo 7b (nasazeno app.js?v=mws42y85, konektor/plugin 1.4.0)
| Nález (kdo) | Záv. | Oprava | Ověření |
|---|---|---|---|
| Konektor posílal úkol kartě s fokusem → AI mohla stříhat v cizí kartě (AI tok; zachyceno na Petrově kartě – jen čtecí editor_status, nic nezměněno) | 3 | `connector/server/index.js`: relace přichycená ke kartě; přepne jen při zavření karty nebo zadání z panelu v jiné kartě (`/claim`, stránka ho pošle hned), AI dostane upozornění; `__pzAI.claim()` pro testy | `test/connector-pin.js` 5/5 |
| Rozsah jasu exportu (výstup) | 2 | Hardwarový kodér (plná velikost) kóduje RGB do plného rozsahu bez značky, softwarový (malé snímky) správně → zkouška bílým snímkem ve skutečné velikosti exportu, při plném rozsahu stlačení `contrast(0.8588)` | export = 1,13×zdroj−16 → 0,99×zdroj+1,4; odchylka 9,1 → 1,9 |
| set_captions s neplatným indexem tiše zahodil (AI tok) | 2 | chyba se seznamem platných indexů, nic se neuloží | ověřeno („No caption with index 99 … valid 0–9“) |
| Titulky 9:16 do sloupce tlačítek, nadpis 4 řádky přes obličej (redaktorka, výstup) | 2 | 9:16: titulek max 68 % šířky, 20 znaků; nadpis menší (0,042) a zmenší se až na 62 %, než přejde na 3. řádek | nadpis „Barbora Šimková: Máma byla tmel celé naší rodiny“ = 2 řádky, 66 px |
Zbývá do kola 8: kraje slov (útržek „dále.“ na začátku a/b stále je), AI tok úkoly a)–d) znovu (s `__pzAI.claim()`).

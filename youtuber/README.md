# YouTuber verze dílu (9:16 + 16:9 v After Effects)

Z obsahového střihu v Premiere udělá svislou (1080×1920) a širokou (1920×1080) youtuberskou verzi:
střih každé 1,3–4,4 s jen v mezerách mezi slovy, záběr na toho, kdo mluví (podle hlasu), hlava na středu
(detekce obličejů YuNet), zoomy „settle“, záblesk + svist na skocích, animované titulky s opravami přepisu,
jmenovky-samolepky, kapitoly, CTA, fotky podle kontextu, vtipy (koruna), znělka, hudba pod řečí, vodoznak.
Vzniklo z ručně schváleného 1. dílu Detail (`O:\Detail TV\01\PRVNI DIL do ZDI\`, styl a historie v jeho
`JAK_JSME_TO_DELALI.md`).

**Výběr obsahu, fotek a oprav přepisu zůstává na Claudovi s kontrolou uživatele** – nástroje dělají jen
opakovatelnou mechaniku. Všechno, co se mění díl od dílu, je v jednom YAML configu.

## Postup na nový díl

1. **Obsahový střih v Premiere** (běžné nástroje `premiere`): přepis, výběr vět, `build_sequence_from_transcript`,
   ručně znělka po háku, předěly mezi kapitolami, copyright na konci, hudba na A2, lišty (MOGRT) na V2. Uložit.
2. **Config**: zkopíruj `detail-01.yaml` → `detail-NN.yaml` a uprav (viz tabulka níž). Nejdůležitější:
   `zdroj`, `premiere.sekvence`, `cil.slozka`, `osoby` (kotvy hlasu!), `studio.sestavy`, `kapitoly`, `fotky`.
3. `yt_export_structure` – struktura sekvence → `<cil.slozka>/data/struktura.json` (jen čte Premiere).
4. `yt_speakers` – mluvčí podle hlasu. Zkontroluj `secondsBySpeaker` a ukázku vět; při chybách přidej/oprav kotvy.
5. `yt_plan` – plán záběrů + plán pro AE. Projdi `warnings` (kapitola/foto mimo střih, krátká jmenovka),
   `faces` a `data/zabery.txt`; špatně rozpoznaný typ záběru oprav v `zabery.prepsat` (src čas) a pusť znovu
   (opakování je rychlé – analýza obrazu i obličeje jsou v cache).
6. `yt_build_ae` s `format: 9x16` (pak `16x9`) – AE se spustí samo, výsledek `<cil.slozka>/ae/<nazev>_<format>.aep`.
7. `yt_stills` – **vždy před renderem** prohlédni přehled (`sheets` → Read): hlavy na středu, jmenovka na správné
   osobě, nic nepřekrývá obličej, fotky dávají smysl.
8. `yt_render` (≈ délka videa) → `<cil.slozka>/<nazev>_<format>.mp4` + kontrola hlasitosti (~−14 LUFS, špička < −0,5 dBFS).
9. `yt_collect` – sbalení AE projektu se všemi zdroji do `<cil.slozka>/AE_projekt/`.
10. Archiv jako u 1. dílu: složka „… do ZDI“ – 2 videa, AE_projekt, projekt Premiere, config dílu.

Porovnání s jinou verzí (např. po úpravě configu): `yt_stills` s `video` (nový render) a `reference` (starý).

## Config – co kde je

| Sekce | Co | Poznámka |
|---|---|---|
| `zdroj`, `prepis` | zdrojové video natáčení, přepis | přepis jinak z cache `transcribe_media` |
| `premiere` | sekvence a čísla stop (V1 záběry, A2 hudba, V2 lišty) | |
| `opravy_struktury` | posun začátku klipu na začátek věty | lepší opravit rovnou v Premiere |
| `cil` | pracovní složka a název výstupů | data/, freeze/, ae/, stills/ |
| `vybava` | kořen výbavy pořadu, AE projekty s předěly, svist, vodoznak, mapa grafiky na výšku | relativní cesty = od `koren` |
| `znelka` | který klip ve V1 nahradit a čím (svislý render / široký ProRes) | |
| `hudba` | cílová hlasitost plata hudby (dB) podle jména, svist | |
| `osoby` | id, jméno na jmenovku, role, **kotvy hlasu**, výška hlavy, pásmo hlavy | kotvy = src úseky, kde mluví JEN ta osoba (aspoň 2–4 úseky po 10+ s) |
| `studio` | rozestavení osob v celku (x), úseky jiného rozestavení, kdo právě prezentuje | |
| `zabery` | délky úseků, barvy + pravidla typu záběru, zapečené logo, ruční typy, dráhy hlavy | pravidla viz níž |
| `rucni_zabery` | ručně složené úseky (nájezdy při představování hostů) | |
| `louceni` | od kterého slova je konec v celku | |
| `titulky`, `opravy_prepisu` | dělení titulků, ASR opravy (slova i fráze) | piš, co skutečně zaznělo (pozor na čísla) |
| `listy` | zkratky textů lišt, velké, vyřazené, pravidla CTA | |
| `kapitoly`, `fotky`, `vtipy` | src časy | licence fotek ověřit před vysíláním |
| `render` | šablony aerender, úprava hlasitosti, cíl LUFS | |
| `ae.exe`, `styl.pismo` | (volitelné) cesta k AfterFX.exe, písmo | výchozí nejnovější AE, OrganicaM-Bold |

**Typ záběru** (`zabery.pravidla`): pro každý záběr se spočítají podíly barev (`zabery.barvy`, HSV rozsahy OpenCV)
a hustota hran `edge`; pravidla se zkoušejí popořadě, alternativy v `kdyz` jsou NEBO, klíče uvnitř A, rozsah
`[min, max)`. Typy: `wide` (celek – střih na mluvčího), `close` (detail), `screen` (obrazovka – zoom na místo, kde se
něco děje), `broll`, `logo` (zapečené logo – vystřihne/zmrazí). Pro studio jiné barvy stačí přidat barvu a pravidlo,
např. modrá stěna: `blue: {h: [[95, 125]], s: [80, 255], v: [60, 255]}` a `{typ: wide, kdyz: [{blue: [0.35, 1]}]}`.

## Spolehlivost AE (řeší `worker/aerun.py`)

- skript do běžící AE přes `AfterFX.exe -s "$.evalFile(...)"`, soubor dostane UTF-8 BOM až při spuštění,
- skripty zavírají projekt bez uložení, výsledek se pozná podle „done“ souboru,
- hlídání dialogů (Crash Repair Options, Chybové hlášení, chybová okna AE → Continue/Neodesílat/OK),
  pádu a zamrznutí; po pádu restart AE a nový pokus (2×),
- zmrazené snímky přes ffmpeg PNG (časový remap na velkém zdroji AE shazoval).
- Písmo **Organica** musí být nainstalované (nástroj varuje).

## Soubory

`worker/youtuber.py` (config, mluvčí, plán), `worker/aerun.py` (AE, snímky, render, collect),
`worker/jsx/yt_*.jsx` (AE skripty), `server/yt_structure.jsx` (export z Premiere), MCP nástroje `yt_*` v `server/index.js`.

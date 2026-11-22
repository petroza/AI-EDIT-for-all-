# Redaktorka – kolo 7 (2026-11-22, app.js?v=mws2qvzb)

**Otázka:** Udělám v tom za 10 minut video na sítě, aniž bych se zasekla? **Odpověď: ano** – od spuštění Chrome po hotové MP4 **5:07** (17:54:01 → 17:59:08), bez jediného zaseknutí. Výsledek: `web/test-out/redaktorka-r7.mp4`, 1080×1920, 25 fps, 19,98 s, −14,0 LUFS.
Výrok: věty 3:27–3:44 („Myslím si, že tohle mě jako strašně sformovalo … tak už jako není.“), 4 věty, 0:20.
Export jsem spustila přes `__pzDevExport({ name: 'redaktorka-r7', burn: true, loudness: 'social' })` místo systémového dialogu (dialog Export jsem jen otevřela a zavřela, snímek 31).

## 3 nejdůležitější nálezy
1. **Automatické titulky vynechaly první slovo „Myslím“, i když ve videu zazní** (3). První titulek začínal „si, že tohle mě jako strašně sformovalo.“ (malé „s“, bez slovesa). Whisper na exportu: „Myslím“ zní 0,00–0,38 s; na zdroji 208,38 s, In klipu 208,32 s → slovo v klipu je, titulek ho zahodil. Uspěchaná kolegyně by to pustila ven. Ruční oprava pak byla rychlá a příjemná (klik, Ctrl+Home, psaní, Enter; „Opraveno: 1 titulek · opravy platí i v přepisu klipu“, v přepisu nevzniklo zdvojené slovo).
2. **Výchozí vzhled textů koliduje s 9:16** (2): nadpis při výchozích 100 % se zalomí do 4 řádků úzkým sloupcem a zakryje čelo a oči (snímek 28); při 85 % najednou 2 řádky přes celou šířku (snímek 30) – skok je nečekaný. Titulky ve výchozím rozložení přesahují do pravé červené bezpečné zóny Reels (tlačítka), kterou aplikace sama ukazuje: text sahá do ~92 % šířky, zóna začíná na ~83 % (snímky 21, 41-42).
3. **Smazání jednoho kousku obrazu smaže celý zvuk sekvence** (2). Po převodu na 9:16 je obraz rozdělen na 3 klipy (střihy kamery), zvuk je jeden klip přes celých 20 s. Klik na první obrazový kousek + Delete → zmizel obraz 0–13 s **i celý zvuk 0–20 s**, titulky zůstaly viset nad prázdnem (snímek 33-34 nahoře). Ctrl+Z vše vrátilo správně (dole).

## Tabulka
| # | Co jsem dělala | Čekala jsem | Stalo se | Záv. | Důkaz |
|---|---|---|---|---|---|
| 1 | Titulky z přepisu (17:56:53 → 17:57:10, 17 s) | titulky = co zazní | 1. titulek bez „Myslím“ (slovo slyšet od 0,00 s) | 3 | 21-titulky-10s.png, Whisper exportu `Myslím[0.00-0.38]` |
| 2 | Nadpis nahoře „Šimková o smrti mámy: Tohle mě sformovalo navždycky“ | 2 řádky nad hlavou | při 100 % 4 řádky přes obličej; 85 % = 2 řádky malé | 2 | 28-nadpis-enter.png, 29, 30 |
| 3 | Kontrola bezpečných zón (zapnuté samy – dobře) | titulky uvnitř zóny | dvouřádkový titulek sahá do pravé zóny tlačítek Reels | 2 | 21-titulky-10s.png, 41-42-export-detail.png |
| 4 | Zvědavost: klik na 1. obrazový klip, Delete, Ctrl+Z | smaže se ten kousek (+ jeho zvuk) | smazán i zvuk celé sekvence; Ctrl+Z vrátil vše | 2 | 33-34-delete-undo.png |
| 5 | Dialog Export | MP4 s AAC pro Instagram | „Opus 160 kb/s – počítač nemá kodér AAC (Windows N: nainstaluj Media Feature Pack)“; MP4 s Opusem nemusí Instagram přijmout (neověřeno) | 2 | 31-export-dialog.png, ffprobe `opus` |
| 6 | Zvědavost: přepnutí na EN a zpět | celé UI anglicky | panel „Text v obraze“ zůstal česky (NADPIS NAHOŘE, Velikost nadpisu, Řádky, Výchozí…), v Přepisu „69 vět · přesný přepis“ | 2 | 35-en.png |
| 7 | Panel Text v obraze při 1440×900 | vše čitelné | popisek checkboxu useknutý „Podkla…“, panel má vodorovný posuvník | 2 | 26-text-v-obraze.png |
| 8 | Záběr 13,2–18,9 s ve výsledku | obličej zblízka | široký záběr z profilu, tvář malá (zdroj jinou kameru nemá, obličej v záběru je) | 1 | 40-kontakt-0.5s.png |
| 9 | Začátek klipu | kousek nádechu před 1. slovem | „Myslím“ začíná 60 ms po In – neuseknuté, ale bez vzduchu | 1 | Whisper zdroje 208,38 s vs In 00:03:28:08 |
| 10 | ▾ u „Vložit do nové sekvence“ | další možnosti | jediná položka „Do nové sekvence…“ = totéž co tlačítko | 1 | 10-vlozit-menu.png |
| 11 | Po vytvoření titulků tlačítko v Přepisu | „Upravit titulky“ apod. | „Doplnit titulky…“ – nejasné, co doplní, když titulky už jsou | 1 | 26-text-v-obraze.png |
| 12 | F1 | seznam zkratek od začátku | otevře se odscrollovaný doprostřed (horní řádek useknutý), u „Zobrazit celou sekvenci“ prázdná klávesa | 1 | 36-f1.png |

**Co fungovalo výborně (bez zaseknutí):** import → přepis z mezipaměti hned (7 s); hledání Ctrl+F „sformovalo“ + klik + Shift+klik (4 věty · 0:20, 26 s); dialog Nová sekvence nabídl rovnou 1080×1920 Reels a sám udělal výřez podle obličeje (~10 s, 3 klipy podle střihů kamery); export 2,2 s.
**Výsledné MP4 (kontaktní arch po 0,5 s, `40-kontakt-0.5s.png`):** obličej v záběru ve všech 40 snímcích; střihy obrazu jen 2 (13,2 s a 18,92 s, ffmpeg scdet), žádné probliknutí ani zbytek záběru; titulky odpovídají řeči (po mé opravě), zvýraznění slova sedí (0,2 s „Myslím“); konec „…tak už jako není.“ doznívá do 19,72 s z 19,98 s – neuseknuté.
Pozn.: první pokus o vytvoření sekvence se zavřel bez výsledku – klik do rozbaleného `<select>` v headless Chrome padl mimo dialog (artefakt mé automatizace, ne chyba aplikace; nezapočítáno).

## Časy
Start + Nový projekt 0:50 · import 0:07 · výběr vět 0:26 · sekvence 9:16 + výřez 0:51 · titulky 0:17 · oprava titulku 0:08 (+ ověření Whisperem 0:40) · nadpis 0:26 · export 0:16 → **MP4 za 5:07**; zvědavost (Delete/Ctrl+Z, EN, F1) do 17:59:52. Člověk klikající bez skriptu odhadem 8–10 min.

**Použila bych to zítra? Ano.** Cesta přepis → věty → 9:16 → titulky → export je rychlá a srozumitelná, nikde jsem nemusela hledat. Ale každý výstup bych musela projít očima kvůli chybějícímu slovu v titulcích, nadpisu přes obličej a titulkům v zóně tlačítek – a ověřit, jestli Instagram vezme MP4 s Opusem.

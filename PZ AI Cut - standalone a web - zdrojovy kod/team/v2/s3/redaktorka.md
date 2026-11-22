# Redaktorka – kolo S3, standalone (2026-11-22)

**Otázka:** Zvládne zkušená střihačka Premiere v PZ AI Cut ruční střih rozhovoru pro TV (16:9, ~90 s) jen zkratkami a myší, jak je zvyklá?
**Odpověď: ano.** Žádné zaseknutí. Všechny zkratky ze zadání fungují jako v Premiere: I/O, čárka, C, Q/W, Shift+Delete, ↑/↓, J/K/L, Ctrl+D, G, [ ], M, Shift+M, Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y, Ctrl+Q. Fungují i L-cut (N + Alt), přepis timecodu, titulky z přepisu a exporty.
Rozdíly proti Premiere jsou tři a jsou zrádné spíš pro práci s projektem než pro střih (nálezy 1–3).

**Instance a čas:** instance 9371, `--size 1366x768 --lang cs --ai`, profil `%TEMP%\pz-s3-redaktor`, AI panel jsem skryla a nepoužila. V aplikaci 22:12:42 → 22:21:27 = **8:45** včetně mých kontrolních dotazů. Kódování trvalo: MP4 11 s, MXF 11 s, Auto Reframe ~9 s, 9:16 15 s, titulky 4 s.
**Pozor na čas:** kroky jsem posílala skriptem, takže čas není lidský. Hranice slov jsem místo poslechu brala z časů slov v přepisu (čtení dat, ne ovládání). Odhad pro člověka s posloucháním: **20–25 min**, tedy stejně jako v Premiere.

**Obsah (82,56 s):** Šimková o cestě od herectví k televizi.
- úvod „Je to Bára Šimková. Ahoj, Bára.“
- otázka „kudy šla herecká dráha“ + odpověď
- „kde se to zlomilo“ + odpověď (s jump cutem a prolínačkou)
- „No a pak mě napadlo… poslala jsem životopis.“
- „…drze poslala a oni se mi ozvali… psala sem články na web.“

**Výstupy** v `web/test-out/`:
- `redaktorka-s3-tv.mp4` (1920×1080 25p, −22,9 LUFS)
- `redaktorka-s3-tv.mxf` (XDCAM 4:2:2 50 Mb/s, 2× PCM 24 bit, −22,9 LUFS)
- `redaktorka-s3-social-916.mp4` (1080×1920, −14,0 LUFS)
- `.srt` k exportům
- projekt `redaktorka-s3-projekt.pzcut`

**Pomůcky (místo nativních věcí):**
- Import: `TN.app.importPaths`.
- **Uložit (Ctrl+S):** `TN.app.project.path = '…/redaktorka-s3-projekt.pzcut'; TN.app.cmd('save')`. Ctrl+S je jen nativní akcelerátor a přes CDP ho nejde stisknout; ověřeno, projekt zůstal neuložený. Nativní dialog Uložit jsem neotevírala, automat by ho nezavřel.
- Nativní menu: `TN.app.cmd('seqSettings' | 'reframe916' | 'newSequence' | 'help')`.
- Selecty (předvolba, hlasitost, formát): `value` + `change`.
- Ostatní ovládání: CDP `Input.*` (klávesy, kliky, tah, psaní).
- Zavření: **Ctrl+Q stisknutý přes CDP aplikaci zavřel** (v S2 neověřeno). Znovuotevření: nové spuštění se stejným profilem samo otevřelo poslední projekt.

## 3 nejdůležitější nálezy
1. **Automatické ukládání přepisuje přímo soubor projektu** (2). Jakmile má projekt cestu, autosave každou minutu zapíše rozdělanou práci do `.pzcut`, bez Ctrl+S. Pak zmizí `*` z titulku a při zavření se aplikace nezeptá „Uložit změny?“, takže pokus nejde zahodit zavřením bez uložení.
   - **Důkaz:** v 22:23:40 jsem přidala značku (M) a nic neukládala. V 22:24:23 se soubor sám změnil (mtime 22:21:47 → 22:24:23) a obsahuje 3 značky. Stav bez uložení: `dirty=false`, status „Automaticky uloženo“.
   - **Premiere dělá:** Auto-Save ukládá kopie do složky Auto-Save a uživatelův .prproj nikdy nepřepíše.
   - **Kroky:** ulož projekt → změň cokoli → počkej 60 s → zavři (Ctrl+Q) → změna je v souboru.
2. **Zesílení zvuku (G) má popisek „Změnit zesílení o (dB)“, ale hodnotu nastavuje absolutně** (2).
   - Klip na +3 dB: G ukáže „3“, ne 0 (13). U více vybraných klipů ukáže hodnotu prvního a po OK ji dostanou všechny.
   - Kód: `c.gainDb = v`. Kdo napíše „3“ v domnění, že přidává, nepřidá nic, nebo přepíše rozdílné úrovně klipů.
   - Věta „Applies to 1 selected audio clip(s). 0 = original level, −60 = silent.“ je anglicky (13).
   - **Premiere dělá:** „Adjust Gain by“ je relativní a otevírá se vždy s 0; „Set Gain to“ je samostatná volba.
3. **Po Auto Reframe 9:16 vznikne titulek 0,50 s** (2). V 16:9 byl jeden titulek „Je to Bára Šimková. / Ahoj, Bára.“ (0,12–1,46 s). Přelomení pro 9:16 z něj udělalo dva a „Ahoj, Bára.“ trvá 1,008–1,510 s (12 snímků), viz `redaktorka-s3-social-916.srt` č. 2.
   - Oprava S3 „titulek < 0,7 s se připojí k předchozímu“ platí jen pro Titulky z přepisu, ne pro přelomení titulků při Auto Reframe.
   - **Kroky:** titulky z přepisu v 16:9 → Sekvence → Auto Reframe 9:16 → v záložce Titulky zkontroluj krátké titulky.

## Tabulka
| # | Co jsem dělala | Čekala jsem | Stalo se | Premiere dělá | Záv. | Důkaz |
|---|---|---|---|---|---|---|
| 1 | Autosave | kopie stranou | přepíše `.pzcut`, zmizí `*`, zavření se nezeptá | kopie ve složce Auto-Save | 2 | mtime, nález 1 |
| 2 | G, +3 dB, znovu G | 0 (relativně) | ukáže 3, nastavuje absolutně, věta anglicky | Adjust by = relativně | 2 | 13 |
| 3 | 9:16 titulky | nic pod 0,7 s | „Ahoj, Bára.“ 0,50 s | – | 2 | srt 9:16 |
| 4 | Dvojklik na značku (M) | dialog Značka (název, komentář) | nic, značka nejde pojmenovat. Značka pod playheadem je zakrytá | dvojklik nebo M M otevře Marker dialog | 1 | 15 |
| 5 | Nová sekvence (menu) bez vybraného klipu | poslední/16:9 | předvolba 1080×1920 9:16, i když projekt má jen 16:9 záznam a FHD sekvenci. S vybraným klipem 1280×720 (oprava S3 platí) | poslední použitá předvolba | 1 | 29 |
| 6 | Čárka bez otevřené sekvence | nic / hláška | sama vytvoří sekvenci podle klipu (1280×720 25p) a vloží. Pro TV jsem musela Nastavení sekvence → Full HD | `,` bez sekvence nedělá nic | 1 | 05, 16, 17 |
| 7 | Změna sekvence 720p → 1080p | klipy 100 % (malé) | klipy se samy roztáhly na celý obraz (`fit: contain`) – lepší než Premiere | nutné „Set to Frame Size“ | – | 17 |
| 8 | Náhled klipů na timeline | záběr v bodě In | snímek 0 zdroje (logo TALK), z S2 beze změny | snímek v In | 1 | 06, 09 |
| 9 | Přepnutí formátu v exportu | prázdný progress bar | zůstane fialový zbytek (~7 %), z S2 | – | 1 | 25 |
| 10 | K po přehrávání | playhead na snímku | 3,761 s, 8,2456 s – mimo mřížku 25 fps (z S1) | vždy celý snímek | 1 | eval |
| ok | Timecode v monitoru (oprava S3) | psaní jako Premiere | klik vybere celý text. `2313` = 00:00:23:13, `+5` = +5 snímků, `-1:00` = −1 s, `-30` = −30 snímků. Stejně v Zdroji i Programu | stejné | – | 03, 04 |
| ok | I/O ve zdroji + `,` ×5 | vkládání za sebe | 5 úseků za sebou, zvuk a obraz spojené. Zdroj ukazuje délku In–Out (00:00:12:03), přepis zvýrazní věty v In–Out | stejné | – | 06 |
| ok | W, Q, C (2 řezy), V, klik, Shift+Delete | ripple | W zkrátí konec na playhead a posune zbytek. Q totéž na začátku a playhead skočí na střih. Žiletka se přichytí k playheadu a řeže V+A. Shift+Delete zavře mezeru | stejné | – | 07–10 |
| ok | ↑/↓ | skok na střihy | 1,6 → 24,32 (jen video po L-cutu) → 25,36 (audio) → 32,12 | stejné | – | eval |
| ok | J/K/L | 1×, 2×, zpět | L 2 s = +2,16 s, L L 2 s = +4,48 s, J 1 s = −1,11 s | stejné | – | eval |
| ok | **L-cut:** N (Rolling) + Alt tah střihu na V1 o 1 s doleva | posun jen obrazu | obraz 24,32, zvuk 25,36, obě strany zůstaly synchronní. Přežije Ctrl+Z/Y, uložení i Auto Reframe | stejné (Alt = jen jedna stopa) | – | 11 |
| ok | Ctrl+D na střihu | prolínačka | „Prolínačka použita v 00:00:32:03“, 1 s, vycentrovaná | stejné | – | 12, 41 |
| ok | `]` / `[` | ±1 dB | 3 → 4 → 3 | stejné | – | eval |
| ok | M, Shift+M | značky | 1,6 a 32,12 s, Shift+M skáče | stejné | – | 14 |
| ok | Ctrl+Z ×8, Ctrl+Shift+Z ×7 + Ctrl+Y | vrátit vše | stav sedí, popisky česky („Zpět: Posun střihu“, „Znovu: Prolínačka“…). Ctrl+Y na konci: „Není co zopakovat“ | stejné | – | eval |
| ok | Uložit → Ctrl+Q → znovu spustit | projekt zpět | otevřel se sám: sekvence FHD, 2 značky, +3 dB, L-cut, prolínačka, In/Out ve zdroji. Bez dotazu (projekt nebyl změněný) | stejné | – | 18, 19 |
| ok | Titulky → Vytvořit titulky z přepisu | jen použitá slova | 24 titulků za 4 s, konec bloku sedí na střih zvuku (25,36 po L-cutu). F2 na playheadu otevře titulek a Enter uloží „na Novu“ | Premiere: Transcript → Create captions | – | 21–23 |
| ok | Export MP4 TV −23, MXF | R128, MXF → TV | MP4 a MXF **−22,9 LUFS**. Social → MXF přepne na −23 a zpět na −14 (oprava S2 #7 platí). Exportovat se nehýbe ani při dlouhé cestě (S2 #2 opraveno). „42 MB“ bez tečky | – | – | 24, 25, 28 |
| ok | Auto Reframe 9:16 + export | rychle, sítě | ~9 s, 16 záběrů (nejkratší 0,64 s, žádný zbytek ≤ 5 snímků), export s −14,0 LUFS za 15 s | Premiere Auto Reframe minuty | – | 27, 41 |
| ok | Esc v poli cesty, F1 | zavře / nahoře | Esc zavře Export z textového pole. Nápověda se otevře nahoře (scrollTop 0) | – | – | 30 |
| pozn. | Moje chyba střihu | – | L-cut odhalil 0,72 s celkového záběru (24,32–25,04) a ve zdroji A je 0,68 s střih na moderátorku: 3 záběry za 1,4 s. Ruční Out 234,88 uřízl ~1 snímek sykavky „životopis“ (zdroj: −28 dB do 234,90 s). Klik na větu v Přepisu by hranici dal do pauzy | stejné riziko | – | 40, RMS |

## Verdikt
**Ruční střih rozhovoru jako v Premiere: ano.** Zkratky a mechanika střihu (insert, ripple, roll s Alt, žiletka, prolínačka, značky, Zpět/Znovu) se chovají stejně. Export TV i MXF projde hlasitostí a 9:16 je hotové za pár sekund.
Než bych v tom stříhala ostré věci, chci tři opravy:
1. aby autosave nepřepisoval můj projekt,
2. aby G opravdu „měnilo o“,
3. aby se titulky po Auto Reframe nerozpadly pod 0,7 s.

Ostatní (pojmenování značek, výchozí 9:16 v Nové sekvenci, náhledy klipů) jsou drobnosti.

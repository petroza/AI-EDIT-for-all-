# Redaktorka – kolo S2, standalone (2026-11-22)

**Otázka:** Udělám v tom jako redaktorka zvyklá na Premiere TV reportáž 16:9 i video na sítě 9:16 s titulky, aniž bych se zasekla, a to hlavně stříháním podle přepisu?
**Odpověď: ano.** Celý postup přepis → výběr vět → sekvence → titulky → oprava → nadpis → MP4 + MXF → 9:16 funguje jen klikáním. Zasekla jsem se jednou, asi na 2 min, v dialogu Export (nález 2).
Instance 9371, `--size 1366x768 --lang cs --ai`, profil `%TEMP%\pz-s2-redaktor`. V aplikaci 21:33:35 → 21:42:36 = **9:01**. Z toho 1,5 min jsem čekala zbytečně kvůli vlastnímu skriptu, který hlídal konec exportu (export trval 7 s). **Čistá práce ~7,5 min.**
Obsah: Šimková o tom, co říkat pozůstalým. Zdroj 25:44,4–26:14,2 („Bych jako doporučila všem… chytne vás za ruku, něco. prostě.“) a 26:36,0–26:52,1 („Ale my nepotřebujeme… kdyby cokoliv.“), dohromady **45,84 s**. Nadpis „Šimková: Pozůstalým nepomáhají fráze, ale přítomnost“.
Výstupy v `web/test-out/`: `redaktorka-s2-tv.mp4`, `redaktorka-s2-tv.mxf` (+ `.srt`), `redaktorka-s2-social-916.mp4` (+ `.srt`).
**Pomůcky:**
- Import: `TN.app.importPaths`.
- Nativní menu: `TN.app.cmd('headline' | 'reframe916' | 'newSequence' | 'help')`.
- Selecty (předvolba, formát, hlasitost): přes value + change.
- Kliky, Shift+klik, kolečko a psaní: CDP `Input.*` (vlastní `ui.js` v scratchpadu).

Titulky jsem dělala tlačítkem **„Titulky z přepisu…“** v záložce Přepis, ne přes menu Sekvence → Titulky. Je to stejný dialog. Exporty jsem dělala **v dialogu Export** a exporter jsem nepoužila.

## 3 nejdůležitější nálezy
1. **Jednoslovný titulek „prostě.“ bleskne na 8 snímků** (2). Titulky z přepisu dělí text podle vět Whisperu. Věta „prostě.“ (26:13) proto dostala vlastní titulek 29,416–29,76 s. Po něm je 5 snímků bez titulku a pak další titulek. Ve vypáleném MP4 i MXF je „prostě.“ vidět na snímcích 736–743 (měřeno podle bílých pixelů v pásu titulků), v 9:16 také (41, třetí snímek). Divák to vnímá jako probliknutí. Premiere by tak krátký titulek spojil s předchozím. Kroky: vyber v Přepisu věty 371–378 (poslední věta je jednoslovná) → Titulky z přepisu.
2. **Tlačítko „Exportovat“ se posouvá podle délky cesty, takže jsem trefila „Zavřít“** (2). V dialogu 16:9 bylo Exportovat na x = 840. U 9:16 byl výchozí název delší („… 9x16.mp4“), dialog se rozšířil a na stejném místě bylo **Zavřít**. Dialog se zavřel, nic se neexportovalo a cesta, kterou jsem napsala, se ztratila. Zaseklo mě to na ~2 min (dívala jsem se, proč se export neobjevil). Oprava z S1 (výška dialogu) platí, šířka ale pořád skáče (19/22 → 27, 28). Kroky: export 16:9 → Auto Reframe 9:16 → Export → přepsat cestu → klik na místo, kde bylo Exportovat.
3. **Nová sekvence pro 16:9 klip nabídne poprvé 1080×1920 (9:16)** (2). Po kliknutí na „Vložit do nové sekvence“ (zdroj 1280×720) byla předvybraná předvolba 9:16 (06). Kdybych si toho nevšimla, TV reportáž by byla na výšku. Napodruhé si aplikace pamatuje Full HD (31), takže oprava „pamatuje poslední velikost“ funguje. Výchozí volba podle klipu jako v Premiere ale chybí (S1 #5 je opravený jen napůl).

## Tabulka
| # | Co jsem dělala | Čekala jsem | Stalo se | Záv. | Důkaz |
|---|---|---|---|---|---|
| 1 | Import 28 min | přepis sám | **hotovo za ≤5 s** (409 vět, sdílená cache, takže čas GPU jsem neměřila). Seznam je ale odscrollovaný na **konec** (27:42) | 1 | 02 |
| 2 | Ctrl+F „nepomáhá“, Enter, klik na větu, Shift+klik | jako textový střih | funguje: 1/2 → 2/2, klik nastaví In/Out ve zdroji, Shift+klik rozšíří výběr („8 vět · 0:30“), „Vložit do nové sekvence“. Druhý úsek nabídne „**Přidat na konec sekvence**“. Celé za ~1:50 | – | 03–10 |
| 3 | Titulky z přepisu | titulky jen z použitých slov | 12 titulků za 11 s, 2 řádky. Text v dialogu „vzniknou jen ze slov, která v sekvenci zazní (2 úseky)“ | – | 12, 13 |
| 4 | Oprava „často zahojí“ → „čas to zahojí“ (chyba ASR) | klik, opravit, Enter | funguje: Enter uloží a skočí na další, oprava se po přepnutí záložky propíše do Přepisu i do 9:16 | – | 14, 15 |
| 5 | Výsledný výrok začíná „Bych jako…“ | – | Whisper rozdělil „Rozhodně bych… / Bych jako doporučila“, takže výrok začíná slovem „Bych“. V přepisu je i 6 řádků „...“ (25:18–25:24) | 1 | 04 |
| 6 | Nadpis v 16:9 | v title-safe | box y 49–136 px, x 289–1497. Nad TV title-safe (TN y ≥ 135) | 2 | 40 |
| 7 | Formát H.264 s „−14 LUFS“ → MXF XDCAM | přepne na −23 (oprava S1) | na −23 přepne jen z „Vypnuto“. Ze „sociálních sítí“ zůstane **−14** → MXF do vysílání by QC vrátila | 2 | eval selectů |
| 8 | Ctrl+Z v 16:9 | – | „Zpět: **AI: Reframe for 1080×1920**“ (anglicky a s „AI:“, i když agent nejel). Vrátí Auto Reframe a přepne do sekvence 9:16 (historie je společná, z S1) | 1 | 33 |
| 9 | Popisky v exportu | čárka | „21.852 MB“, „287.63 MB“ s tečkou (z S1). Po přepnutí formátu zůstane v progress baru malý fialový zbytek | 1 | 22, 23 |
| 10 | Klipy na timeline | náhled v bodě In | náhled je snímek 0 zdroje (úvodní grafika TALK), ne záběr Šimkové | 1 | 11 |
| ok | Auto Reframe 9:16 | rychle, bez cizích záběrů | ~9 s, nová sekvence. Titulky se samy přelomily na 20 znaků (25 titulků) a oprava i nadpis zůstaly. Střih kamery uvnitř klipu 2 rozdělil na 2 výřezy | – | 25, 26, 41 |
| ok | **S1: zbytky cizího záběru** | žádný krátký záběr na kraji | detekce scény v exportu 16:9 i 9:16: střihy jen na 29,76 a 33,48 s (skutečné střihy kamer) | – | 40, 41 |
| ok | **S1: hlasitost** | TV −23, sítě −14 | MP4 TV **−22,9 LUFS** (TP −7,4), MXF (obě mono stopy) **−22,9**, 9:16 **−13,9** (TP −1,5) | – | ebur128 |
| ok | **S1: MXF titulky na snímek** | MXF = MP4 | počet bílých pixelů v pásu titulků po snímcích 1–6, 730–752 a 860–870 se shoduje, začátek i konec titulků na stejném snímku | – | měření |
| ok | **S1: XDCAM** | jen standardní velikosti | MXF: mpeg2 4:2:2, 1920×1080 25p, 50 Mb/s, 2× PCM 24 bit. U 9:16 je XDCAM šedý s textem „ne pro tuhle velikost obrazu“. Dialog 9:16 sám nastaví H.264 + −14 (S1 #6 opraveno) | – | 27, 29 |
| ok | **S1: dialog Export** | nové hlášení po změně formátu | „Hotovo“ po přepnutí formátu zmizí, řádek Kodér drží místo a tlačítko se svisle neposune. Vodorovně ano, viz nález 2 | – | 23 |
| ok | **S1: nápověda, Ctrl+R/Q** | – | nápověda bez „na webu“ (stále se otevře odscrollovaná dolů). Ctrl+R přes CDP okno nenačetl, Ctrl+Q přes CDP nic neudělal. Obojí jsou nativní akcelerátory, které CDP nespustí. V `menu.js` je Reload = Ctrl+Shift+F5 a Exit = Ctrl+Q, **v UI neověřeno** | – | 32 |
| ok | Slova na střizích (Whisper exportu 16:9) | nic useknuté | „bych“ začíná 0,16 s po tichu. 29,76 s: „…něco prostě,“ / „ale my“ ve slabém místě (−45 dB). Konec „cokoliv.“ 45,68 s ze 45,84 s | – | RMS + Whisper |

## Časy kroků
Start + import + přepis (cache) 0:17 · hledání a 1. úsek 0:56 · nová sekvence (přepnutí předvolby, název) 0:23 · 2. úsek 0:28 · titulky 0:11 · oprava titulku 0:16 (+0:15 malé písmeno) · nadpis 0:19 · export MP4 0:21 (kódování 7 s) · MXF 0:15 (6 s) · Auto Reframe 0:09 · export 9:16 2:05 (z toho ~2 min zaseknutí, nález 2; kódování 10 s). Kontroly S1 a měření ffmpeg/Whisper jsem dělala potom.

## Verdikt
**Nahradí mi to Premiere na tenhle typ práce? Ano.** Výrok z 28min rozhovoru jsem měla podle přepisu hotový rychleji než v Premiere: najdu slovo, kliknu na větu, Shift+klik, vložím. Titulky z přepisu jsou jedním klikem, oprava slova se propíše všude a export TV i 9:16 trvá sekundy. Hlasitost a MXF teď projdou QC. Před ostrým nasazením bych chtěla jen tři drobnosti: spojit jednoslovné titulky, nehýbat tlačítkem Exportovat a u 16:9 klipu nabízet 16:9 sekvenci.

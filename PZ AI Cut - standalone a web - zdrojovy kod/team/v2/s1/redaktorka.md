# Redaktorka – kolo S1, standalone (2026-11-22)

**Otázka:** Udělám v tom jako uživatelka Premiere TV reportáž a video na sítě, aniž bych se zasekla?
**Odpověď: střih, export a 9:16 ano, rychle. Přepis a titulky ne, tam jsem se zasekla úplně.**
Instance 9371, `--size 1366x768 --lang cs` (bez `--ai`, přesně podle zadání), profil `%TEMP%\pz-s1-redaktor`.
Čas v aplikaci 21:06:22 → 21:17:11 = **10:49** (včetně ~4,5 min zaseknutí na přepisu a titulcích). Kontroly ffmpeg a report jsem dělala potom.
Výstupy v `web/test-out/`: `redaktorka-s1-tv.mp4` (16:9, 42,80 s), `redaktorka-s1-tv.mxf` (XDCAM), `redaktorka-s1-social-916.mp4` (9:16, 42,80 s).
Obsah: 3 výroky Šimkové o mámě (zdroj 1:47–2:03 „hospitalizovali… nemohli se připravit“, 2:25–2:43 „máma byla tmel rodiny“, 3:01–3:11 „nejbližší člověk… nejtěžší věc v životě“). Nadpis „Šimková: Máma byla tmel naší rodiny“.
Pomůcky: import `TN.app.importPaths`, z nativního menu `TN.app.cmd('newSequence' | 'captionsFromTranscript' | 'reframe916' | 'headline' | 'help')`. Exporty jsem udělala **přímo v dialogu Export** (je v aplikaci, cestu jde přepsat), exporter jsem nepotřebovala. Výběr v selectech (předvolba, formát, hlasitost) jsem nastavila přes `value` + `change` (nativní rozbalovací seznam přes CDP nejde). Jinak jen myš a klávesy přes CDP.

## 3 nejdůležitější nálezy
1. **Ve standalone chybí přepis, takže nejde stříhat podle textu** (3). Po importu se nic nepřepíše a záložka Přepis neexistuje (`#tabTr` skrytý, `window.__pzASR` je jen ve webové verzi). Pravý klik na klip nenabízí „Přepsat řeč“ (06). Aplikace přitom sama posílá do neexistující záložky: Titulky v Projektu píšou „kliknutím na větu v záložce Přepis“ (04) a F1 má „Hledat v přepisu Ctrl+F“ (38). Úkol „výběr v přepisu → nová sekvence“ tak bez agenta AI udělat nejde. Výroky jsem vybrala z vlastního přepisu (faster-whisper, 1:40–4:00) a stříhala ručně: I/O ve zdroji a čárka.
2. **Titulky nejdou vytvořit vůbec** (3). Sekvence → Titulky → „Vytvořit titulky z přepisu…“ jen ukáže toast „v této verzi přes panel AI (Titulky)“ (16). V panelu AI → Titulky jsem klikla na **„Add captions“** (anglicky v české aplikaci). V záložce Titulky se pak nestalo nic. Chyba se vypsala až v záložce Asistent: `✖ tion closed at McpError.fromError (file:///O:/AI%20STRIH…` (18). Je to useknutá hláška „Connection closed“ se surovým stackem a skutečná příčina se do výpisu nevešla. Při opakování stejná chyba. Pravděpodobně jde o izolovaný profil bez `--ai`: panel si do profilu vytvořil vlastní `token.txt`. **Neověřeno**, kopii tokenu do profilu mi zakázala oprávnění. Opravu chybného slova v titulku jsem proto nemohla vyzkoušet a kontrola „titulky = řeč“ odpadá.
3. **Export „−23 LUFS (TV, EBU R128)“ dá −21,7 LUFS** (3 pro odevzdání do vysílání). Platí pro MP4 i MXF (MXF jsem měřila obě mono stopy spojené). R128 povoluje ±0,5 LU, tohle je +1,3 LU, takže to QC vrátí. Sociální export „−14 LUFS“ dal −13,2 LUFS, true peak −1,5 dBFS (+0,8 LU, na sítě v toleranci). Přitom střih, Q/W, prolínačka, export i Auto Reframe 9:16 (3 s!) fungují jako v Premiere a rychle.

## Tabulka
| # | Co jsem dělala | Čekala jsem | Stalo se | Záv. | Důkaz |
|---|---|---|---|---|---|
| 1 | Import 5min výřezu, hledám přepis | přepis sám po importu nebo „Přepsat řeč“ na pravém kliku | nic. Záložka Přepis chybí, v menu klipu přepis není, text v aplikaci na ni přesto odkazuje. Zaseknutí ~3 min | 3 | 02, 04, 06, 38 |
| 2 | Titulky z přepisu (menu Sekvence i panel AI „Add captions“) | titulky na timeline | toast „přes panel AI“. Panel: useknutý stack `✖ tion closed…`, a to v jiné záložce (Asistent), než kde jsem klikla. 2× stejně, ~1:20 | 3 | 16, 17, 18 |
| 3 | Export H.264, „Normalizovat na −23 LUFS (TV)“ | I = −23,0 ±0,5 LUFS | −21,7 LUFS, TP −5,8 dBFS (MP4 i MXF) | 3 | ebur128 |
| 4 | Úsek 2 jsem začala 7 snímků před střihem kamery ve zdroji (In 2:25:17) | upozornění „krátký záběr na kraji“ | 16:9 export: 16,04–16,28 s **7 snímků moderátorky**, pak host (blik). V 9:16 to Auto Reframe sám spravil (prodloužil předchozí záběr), 16:9 neupozorní | 2 | 61 (16:9), 62 (9:16) |
| 5 | Nová sekvence (Ctrl+N) pro klip 1280×720 16:9 | předvolba podle klipu (16:9), jako Premiere | předvybráno 1080×1920 9:16, musela jsem přepnout na Full HD | 2 | 08, 09 |
| 6 | Export 9:16 po exportu XDCAM | H.264 pro sítě | dialog si pamatoval XDCAM a nabídl „XDCAM 1080×1920“ (pro XDCAM HD422 nesmysl). Hlasitost se přepnula na −14 správně | 2 | 30 |
| 7 | Přepnutí formátu H.264 → XDCAM | stav exportu se vynuluje | zůstalo staré „✔ Hotovo za 4 s · 12.731 MB“. Dialog se zmenšil (řádek Kodér zmizel), takže „Exportovat“ se posunul a první klik minul. Chvíli jsem si myslela, že MXF je hotové | 2 | 25 → 25b |
| 8 | Klik / dvojklik na časový kód monitoru | zadat čas (jako v Premiere) | `span`, nejde editovat. Na čas jsem se dostávala klikem do lišty a šipkami (Shift = 5 snímků) | 2 | 10 |
| 9 | XDCAM výstup | XDCAM HD422 pro vysílání | mpeg2video 4:2:2, 1920×1080, 25p progressive, 52,6 Mb/s, 2× mono PCM 24 bit. Zda Nova chce 1080i50 TFF a 4/8 kanálů, neověřeno | 1 | ffprobe |
| 10 | I/O ve zdroji podle lišty | body na celé snímky | srcIn 107,3124 s, mimo mřížku snímků (posun lišty se drží i při krokování šipkami). Po K hlava 4,7128 s | 1 | eval |
| 11 | Popisky v UI | česky | „Add captions“, v historii „Zpět: AI: Reframe for 1080×1920“ (anglicky a s „AI:“, i když jsem agenta nepoužila), „80 % mix“, „12.731 MB“ s tečkou | 1 | 07, 22 |
| 12 | Ctrl+Z ×5 v 16:9 | vrací kroky této sekvence | historie je společná: 4. krok vrátil Nadpis v 9:16 a přepnul na tu sekvenci, 5. vrátil celý Auto Reframe. Redo ×5 vše vrátil, nadpis zůstal (jako Historie v Premiere, jen přepnutí sekvence překvapí) | 1 | 35, 36 |
| 13 | Panel AI „Aktivní sekvence“ | aktuální sekvence | po přepnutí karet chvíli ukazuje předchozí (z r8 známé) | 1 | 36 |
| 14 | F1 / nabídka klávesových zkratek | seznam od začátku | otevře se odscrollovaný dolů (z r8 beze změny). F1 přes CDP nefunguje, je to nativní akcelerátor, takže jen přes `cmd('help')` | 1 | 38 |
| ok | I/O ve zdroji + čárka ×3, W na konci úseku, Ctrl+D na střihu, `\` celá sekvence, J/K/L (L L = 2×), M a Shift+M, I/O v sekvenci + `'` (Extract) | jako Premiere | vše sedí. Zvuk a obraz drží spojené, prolínačka vycentrovaná na střihu, Ctrl+D na konci sekvence = odtmívačka (jako Premiere) | – | 11–15, 33–34 |
| ok | Auto Reframe 9:16 + Nadpis nahoře | rychle a obličej v záběru | 3 s, nová sekvence, prolínačka zůstala. Kontakt po 0,5 s: obličej v záběru celou dobu, celkové záběry 8,3–13 s a 36,6–42 s jsou celá postava z boku (zdroj nic jiného nemá). Nadpis dvouřádkový nad očima. Bez bliků (scéna jen na skutečných střizích kamer) | – | 27, 29, 60, 62 |
| ok | Kontrola slov na střizích (Whisper exportu 16:9) | nic useknuté | všech 11 vět celých, první „A“ od 0,00 s, „organizovala.“ → „To byl“ bez mezery, ale čistě | – | Whisper |

**Zvědavost:** J/K/L, značky, Extract a řetěz Ctrl+Z / Ctrl+Shift+Z (viz #12 a řádky ok). Uložit a znovu otevřít .tnproj jsem nezkoušela: Ctrl+S otevírá nativní dialog, který automat neovládne (autosave v profilu se průběžně zapisuje).

## Časy kroků
Start + import 0:19 · hledání přepisu 3:10 (zaseknutí) · nová sekvence 0:35 · 3 výroky I/O/čárka 0:30 · W 0:10 · prolínačka 0:25 (první Ctrl+D na konci, Ctrl+Z) · titulky 1:20 (zaseknutí) · export TV 0:25 (kódování 4 s) · XDCAM 0:33 · Auto Reframe 9:16 0:03 · nadpis 0:10 · export sítě 0:28 · zvědavost 1:10. **Celkem 10:49.**

## Verdikt
**Místo Premiere pro tenhle typ práce: zatím ne.** Ruční střih jde rychle a zkratky sedí, export i reframe na sítě jsou dokonce rychlejší než v Premiere. Jenže to hlavní, proč bych přešla, tedy stříhání z přepisu a titulky jedním klikem, ve standalone bez agenta nefunguje. A TV export by mi kvůli hlasitosti (−21,7 místo −23) vrátila kontrola vysílání. Až půjde přepis po importu a „Titulky z přepisu“ a R128 bude sedět, pak ano.

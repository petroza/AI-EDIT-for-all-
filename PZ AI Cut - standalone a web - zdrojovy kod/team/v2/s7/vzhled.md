# Kolo S7 – Vzhled a jazyk (standalone, závěrečné)

Otázka: je všechno, co v noci přibylo, srozumitelné česky i anglicky a nic nepřetéká?
Postup: instance `test/standalone.js start 9373 %TEMP%\pz-s7-ui-<tag> --size … --lang … --ai`, každý jazyk a rozlišení má nový profil
(`cs1366`, `en1366`, `cs1920`, `en1920`). Na startu měl localStorage jen 2 položky aplikace (`pzTab`, `pzProjTab`).
Klávesy (Ctrl+K, Ctrl+D, Shift+Delete, G, Esc, Enter), kliky, pravý klik a psaní jsem posílal přes CDP `Input.dispatch*`.
Import šel přes `TN.app.importPaths` a sekvenci jsem skládal přes `app.dropMedia`. Byla to V1 0–10 / 10–20, b-roll na V2 ze zdroje 120,00 s na 8 s a 20s klip na konci.
Export jsem otevřel přes `TN.app.cmd('export')`.
Nativní dialog „soubor už existuje“ jsem přečetl přes Windows UI Automation (text a tlačítka), vyfotil výřezem obrazovky a zavřel tlačítkem Zrušit, takže se nic nepřepsalo.
Pád jsem simuloval přes `stop` po automatické záloze (64 s). Pak jsem soubor přejmenoval na `PRESUNUTO-…`, spustil stejný profil a ten soubor znovu importoval.
Agenta AI panelu jsem nespouštěl. Výpis pod Spustit jsem jen nasimuloval vložením textu do `.pz-out` a hned ho vrátil.

## Tři nejdůležitější nálezy
1. **Po „Médium znovu připojeno“ zůstane Program černý a Zdroj dál ukazuje „Médium offline“ (3).** Platí pro CZ 1366, EN 1366 a CZ 1920.
   - Toast i stav jsou správně: „Médium znovu připojeno: PRESUNUTO-offline-cs1366.mp4“ / „Media relinked: …“, „Importováno: 1“.
   - Klipy na ose už nejsou `.offline` (0) a v Projektu je médium v pořádku.
   - Program na připojeném klipu (21:00, 21:13, 22:00) zůstává **černý**. Viditelný `<video>` má dál starou cestu `…/offline-cs1366.mp4` s `readyState 0`.
     Konzole k tomu dál hlásí `ERR_FILE_NOT_FOUND` (`cz-1366-27`, `-29`, `-30`, `cz-1920-28`, `en-1366-30`).
   - Zdroj dál ukazuje červenou plochu „Médium offline: offline-cs1366.mp4“ a záložka Přepis „Soubor klipu chybí“.
   - Uživatel tedy dostane potvrzení, že je to opravené, ale obraz nevidí.
   - Zdroj v kódu:
     - `src/ui/player.js:93–94`: prvek přiřazený klipu se vrátí bez kontroly URL a relink mění jen `clip.mediaId`.
     - `src/renderer.js:134–147`: relink nevymění `app.source.media` ani nepřenačte přehrávač.
2. **Hláška o obnovených změnách se neukáže, když projekt má offline médium (2).** Platí pro CZ 1366, EN 1366 a CZ 1920.
   - Po pádu se změny obnoví: `dirty`, titulek „vzhled-s7-cs1366.pzcut *“, zesílení −3 dB zůstalo.
   - Toast „Obnoveny neuložené změny…“ ale po 400 ms přepíše chybový toast „Médium offline: … – klipy se samy připojí.“ (6 s).
   - Pak už je na stavovém řádku jen „Připraveno“ (`cz-1366-21`).
   - Bez offline média hláška funguje: je vidět ≥ 8 s, česky, 588 px (`cz-1920-21-obnova-bez-offline`, `-22`).
   - Zdroj: `src/renderer.js:1421` (`setTimeout … 400` po načtení) × `:1970`. Je jen jeden prvek `#toast` (`:51–57`).
3. **AI panel při 1366×768: výpis výsledku je pod okrajem (2).** Platí pro CZ i EN.
   - Spustit / Run task je vidět (dole 620 px < 649 px) ✓.
   - Výpis `.pz-out` ale začne až na **746 px** (výška panelu 649). Panel se posouvá (836/519 px CZ, 802/519 EN).
   - Kód posouvá jen obsah výpisu (`outEl.scrollTop`), ne panel, takže výsledek agenta při 1366 bez posunutí neuvidíš.
   - Při 1920 je výpis nad Spustit (258–376 px) a je vidět.
   - Ověřeno jen simulací textu (`cz-1366-11-ai-panel-vypis-simulace`, `en-1366-31-ai-panel-vypis-simulace`). Neověřeno s běžícím agentem.
   - Zdroj: `src/ai/layout.css:166` (`.pz-out { order: 50 }`), `MY Premiere MCP…/panel/main.js:325`.

## Nové věci – výsledek
| věc | CZ | EN | přetečení / vzhled |
|---|---|---|---|
| Shift+Delete – mezera zůstala | „Mezera zůstala: přes ni leží jiný klip (b-roll, hudba). Úsek ze všech stop vyjmeš přes Extract (I a O kolem něj, pak ').“ | „The gap stays open: …, then ').“ | červený toast 628 / 675 / 728 px, 1 řádek, nic neuřízne. Osamocený apostrof „pak ').“ je špatně čitelný (`cz-1366-06`) |
| řez uprostřed slova (Ctrl+K) | „Střih je uprostřed slova „myslím“ – posuň ho do pauzy (Q / W nebo tažením střihu).“ | „The cut is in the middle of the word “myslím” – …“ | 469 / 522 px, bez čárky za slovem ✓ (`cz-1366-04`) |
| Médium offline | dlaždice „Médium offline“, klip „Médium offline“ + bublina s cestou, Program i **Zdroj** červeně, seznam „· médium offline“, export červeně předem | „Media Offline“ všude | Zdroj už opravený (S4 #2 ✓). Název se zalamuje na pomlčce „offline-/cs1366.mp4“ (drobnost, trvá). EN text toastu a exportu je starý: „Find it again (File → Import) or remove the clip.“, ale panel Přepis EN říká „…the clips reconnect to it automatically“ |
| znovupřipojení importem | „Médium znovu připojeno: …“ | „Media relinked: …“ | 342 / 290 px ✓, ale obraz viz nález 1 |
| přepsat export (nativní) | „Soubor vzhled-s7-cs1366.mp4 už existuje.“ / „Chceš ho nahradit?“, odkazy „→ Nahradit“, „→ Zrušit“ | „The file … already exists.“ / „Do you want to replace it?“, odkaz „→ Replace“ + **systémové tlačítko „Zrušit“** | v EN je čeština od Windows a dialog má v každém jazyce jiné rozložení (`cz-1366-14`, `en-1366-14`). Po Zrušit se nic nepřepsalo (velikost souboru beze změny) |
| Zesílení (G) | „Zesílení zvuku“, „Nastavit zesílení na (dB)“, „Změnit zesílení o (dB)“, „Vybrané zvukové klipy: 1 · 0 dB = původní hlasitost, −60 dB = ticho.“ | „Audio Gain … Selected audio clips: 1 · 0 dB = original level…“ | 420×186 px, fokus v „Změnit o“, nic nepřetéká. „1 · 0 dB“ už je lepší než S4 „1. 0 dB“ (`cz-1366-07`) |
| obnova po startu | „Obnoveny neuložené změny z automatické zálohy. Uložíš je Ctrl+S, nebo je zahodíš zavřením bez uložení.“ 9 s | neověřeno (v EN přepsáno offline toastem) | nález 2 |
| prolínačka na V2 (Ctrl+D) | „Prolínačka použita v 00:00:08:07“ | „Cross Dissolve applied at 00:00:08:07“ | jen ve stavovém řádku a při běžícím přepisu ho do 300 ms přepíše „Přepis … – 4 %“ (cs1920, en1366, en1920) |
| MXF titulky jako .srt | MXF → „vypálit do obrazu“ ☐, „vytvořit samostatné .srt“ ☑, −23 LUFS; zpět na MP4 → vypálit ☑ | totéž | dialog 640×355, nic nepřetéká. Bez titulků jsou obě volby šedé (`cz-1366-b-13`) |
| b-roll na V2 – odstřiženo | „Na kraji b-rollu bylo odstřiženo pár snímků jiného záběru kamery (Ctrl+Z vrátí).“ | „A few frames of another camera shot at the B-roll edge were trimmed (Ctrl+Z undoes it).“ | za 0,5 s, 446 / 498 px. V2 120,00 → 120,28 (`cz-1366-03`) |
| timecode na ose | bublina „Klikni a napiš čas (Enter = skok, +15 = o 15 snímků dál)“, `1015` → 00:00:10:15 | „Click and type a time…“ | chybný vstup → červeně „Neplatný čas – napiš třeba …“. Zpráva zůstane i po správném zadání (trvá S4 #10, nezhoršeno) |
| AI panel 1366 | Spustit vidět ✓, výpis pod okrajem | Run task totéž | nález 3. „ŽÁDNÁ AKTIVNÍ S…“ uříznuté (trvá S4 #11) |

## Regrese
- **První spuštění** (CZ/EN 1366 i 1920) je v pořádku. Karta Začni tady je bez posuvníku (216/216 px při 1920) a tlačítka jsou vidět (`cz-1366-01`, `cz-1920-01`, `en-1366-01`, `en-1920-01`).
- **F1** se otevře nahoře (scrollTop 0, 605 px při 1366 / 873 px při 1920) a zavře se přes Esc.
- **Export dialog** má 640 px a CZ popisky „Výstupní soubor, Formát, Kodér, Hlasitost, Rozsah, Titulky, Zavřít, Exportovat“. Nic nepřetéká.
- **Kontextová menu** (klip 26 položek, médium, sekvence) jsou přeložená a celá v okně. Menu klipu při 1366 končí 4 px nad spodkem (699/703).
- **Žádná nová angličtina v CZ.** Sken DOM (text, title, placeholder, aria-label) aplikace i `#aiFrame` po sestavení sekvence, s titulky i s dialogy našel jen „⇪ Export“ a „Program:“, které jsou v češtině stejné. Nativní dialog je v CZ česky.
- **Konzole:** kromě vývojových varování Electronu (webSecurity, CSP, v balíčku se neukáží) jen `ERR_FILE_NOT_FOUND` a `waveform ffmpeg exited … No such file` u offline klipu. To jsou S4 #15. Po relinku se ale opakují dál kvůli staré cestě v přehrávači (nález 1).

## Tabulka
| # | jazyk | rozlišení | kde | co je špatně | přesný text / číslo | záv. | snímek | zdroj |
|---|---|---|---|---|---|---|---|---|
| 1 | obě | 1366, 1920 | Program + Zdroj po znovupřipojení | Program černý (video se starou cestou), Zdroj a Přepis dál offline | `readyState 0`, „Médium offline: offline-cs1366.mp4“, „Soubor klipu chybí“ | 3 | cz-1366-27, -29, -30, cz-1920-28, en-1366-30 | src/ui/player.js:93–94; src/renderer.js:134–147 |
| 2 | obě | 1366, 1920 | start po pádu s offline médiem | hlášku o obnově přepíše po 400 ms toast offline | „Obnoveny neuložené změny…“ se neukáže, stav „Připraveno“ | 2 | cz-1366-21 (× cz-1920-21 bez offline) | src/renderer.js:1421 × :1970, :51–57 |
| 3 | obě | 1366 | AI panel – výpis výsledku | výpis pod okrajem, panel se neposune | výpis od 746 px, výška 649; pane 836/519 | 2 | cz-1366-11, en-1366-31 (simulace) | src/ai/layout.css:166; panel/main.js:325 |
| 4 | EN (i CZ) | vše | nativní dialog „už existuje“ | v EN systémové „Zrušit“ česky, jinak „→ Replace“ jako odkaz; v CZ obě tlačítka jako odkazy | „→ Replace“ + [Zrušit] | 2 | en-1366-14, cz-1366-14 | src/renderer.js:1311 (`buttons:['Replace','Cancel']` bez `noLink`); stejný vzor :1189 (neověřeno) |
| 5 | EN | vše | toast + export – offline médium | starý návod, nezmiňuje samo-připojení (CZ a panel Přepis EN ano) | „Find it again (File → Import) or remove the clip.“ | 1 | en-1366-25 | src/renderer.js:1284, :1421 × lang.js:173 |
| 6 | obě | vše | Shift+Delete – hláška | osamocený apostrof jako zkratka | „…(I a O kolem něj, pak ').“ | 1 | cz-1366-06 | src/renderer.js:477, lang.js:178 |
| 7 | obě | vše | Ctrl+D na V2 | potvrzení jen ve stavovém řádku, při přepisu ho hned přepíše průběh | „Přepis offline-cs1920.mp4 – 4 %“ místo „Prolínačka použita v …“ | 1 | cz-1920-05 | src/renderer.js:639 |
| 8 | obě | vše | Zesílení (G) | dvě čísla vedle sebe | „klipy: 1 · 0 dB = …“ | 1 | cz-1366-07 | src/renderer.js:1013 |
| 9 | EN | 1366 | Titulky z přepisu | klik na „Create captions“ během „Finding the words heard in the sequence…“ = 0 titulků (hláška neověřena) | `captions.length 0`, po čekání 7 | 1 | en-1366-11 | src/renderer.js (dialog titulků z přepisu) |
| 10 | obě | vše | offline název v monitoru | zalomení na pomlčce (trvá S4) | „offline-/cs1366.mp4“ | 1 | cz-1366-23 | src/ui/monitors.js:103, :206 |

Snímky jsou v `team\v2\s7\shots-vzhled\`:
- `cz|en-<rozlišení>-NN-*`, druhý průchod s titulky `-b-*`,
- nativní dialog `*-14-nativni-dialog-prepsat`,
- konzole `con-*.log`.

Testovací média jsou v `%TEMP%\pz-s7-ui-media`, soubory pro dotaz na přepsání v `web\test-out\vzhled-s7-*.mp4` (kopie 20s klipu).
Instance 9373 je zastavená.
Při běhu jsem viděl i jiné okno PZ AI Cut („Bez názvu *“, jiný proces). Nesahal jsem na něj.

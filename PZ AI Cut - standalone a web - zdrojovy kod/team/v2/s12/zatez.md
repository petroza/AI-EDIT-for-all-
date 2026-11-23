# S12 – Zátěž a okrajové případy (PZ AI Cut Standalone, Windows)

Instance `9377`, profil `%TEMP%\pz-s12-zatez` (`--size 1366x768 --lang cs --ai`), restartovaná 6× (zamrzlé exporty) se
stejným projektem (záloha `toJSON` → `project.load`). Média z ffmpeg v `%TEMP%\pz-s12-media\`: `sync60.mp4` (1080p25,
smptehdbars + `drawtext` čas a číslo snímku, **bílý záblesk + pípnutí 1 kHz na začátku každé sekundy**), `hodina.mp4`
(1 h, 640×360), `tone30.wav`, `bezzvuku20.mp4`, `jedensnimek.mp4` (0,04 s), kopie s divnými názvy a cestou 262 znaků.
Ovládání: `test/cdp.js` + vlastní skripty (`s12/zatez/skripty/`); úpravy přes `TN.app.cmd(...)` (= nabídka/klávesy),
Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z skutečnými klávesami přes CDP. **Nativní nabídku během exportu automat neumí** – klik v ní
jsem nahradil `ipcRenderer.emit('cmd', …)`, což je přesně to, co posílá `main.js` (`send(cmd)`) po kliku/akcelerátoru.
Export přes dialog Export (pole Výstup + tlačítko) nebo `exporter.exportSequence`. Sync měří `skripty/sync.py`
(jas snímků → záblesky, pásmo 1 kHz → pípnutí; rozestupy záblesků = chybějící/zdvojené snímky, záblesk vs pípnutí = A/V).

**Verdikt:** samotnou zátěž aplikace zvládá dobře – 722 klipů ve 20 stopách, hodinová sekvence s 360 klipy, 500 titulků
i 200× Zpět/Znovu dopadly přesně (snímek na snímek, sync 0 ms, stav sekvence bajt na bajt). Slabina je **souběh s exportem**:
dialog Export blokuje jen klávesy okna, **nativní nabídka (Úpravy, Okno → Jazyk, Soubor → Exportovat, Ctrl+M) funguje dál**
a tři cesty z ní vedou k zamrznutí nebo k chybnému souboru, který se hlásí „✔ Hotovo“.

## Tři nejdůležitější nálezy
1. **Přepnutí jazyka během exportu = export natrvalo zamrzne (3).** Okno → Jazyk → English při exportu Z300: průběh
   stojí na „7 % video“, Zrušit nic neudělá, dialog nejde zavřít (Esc/klik mimo blokuje `busy`), jediná cesta je zabít
   aplikaci. **4/4** (cs→en, čerstvá instance; en→cs 0/1). Procesy ffmpeg už v systému nejsou, ale v rendereru jejich
   `ChildProcess` dál `exitCode: null` (událost `close` nepřišla) – `pool` čeká navždy. Samotné `i18n.setLang` (vč.
   přestavby nabídky v main), překreslení panelů ani reload AI panelu export nezastavily – viní to až celé `setLanguage`.
   Důkaz `shots-zatez/06-…png`, `07-…png`; ověření `process._getActiveHandles()` (3× ffmpeg pid, exit null, pid neexistuje).
2. **Úprava z nabídky během exportu = soubor ze dvou různých stavů (3).** Z1H (1 h), export běží, Úpravy → Odstranit
   s posunutím klipu na 1:40: výsledek **video 3 590 s (89 750 snímků), zvuk 3 600 s, kontejner 3 600 s** – posledních 10 s
   bez obrazu, dialog „✔ Hotovo za 62 s“ (`zatez/k2.out`, `k2-sync.json`). Na Z300 (mezera zůstala kvůli A2–A10): obraz
   smazaného klipu je ve videu, pod ním ticho (270 záblesků, 268 pípnutí, `k1.out`). Příčina: `exportSequence` čte živé
   klipy sekvence; úseky obrazu spočítá na začátku, zvuk až po obrazu. Ctrl+Z z nabídky během exportu je naopak v pořádku
   (`restore` vytvoří nové objekty, exportuje se starý stav – `k3.out`, 269/268 konzistentně s mezerou).
3. **Druhý export během exportu (Soubor → Exportovat / Ctrl+M) do stejného souboru = poškozené MP4, oba „✔“ (3).**
   Druhý dialog nabídne výchozí cestu `…\test-out\Z300.mp4` (podle názvu sekvence = stejná jako první), soubor ještě
   neexistuje → bez dotazu na přepsání. Dva souběžné exporty do jednoho souboru: oba vrátí úspěch (158 MB), `ffmpeg -i …
   -f null` = 2,4 MB chyb „Invalid NAL unit size“, „Reserved bit set“ (`zatez-s12-k14-stejny-soubor.mp4`). Do různých
   souborů oba výstupy správné (6 750 snímků, bajtově shodné), ale **jeden ukazatel průběhu skáče mezi oběma** (8 → 4 → 18 →
   23 → 19 %), „Hotovo“ prvního se ukáže, zatímco druhý ještě běží, a dialog přestane být `busy` (lze zavřít uprostřed).

## Všechny nálezy
| # | Záv. | Nález | Kroky | Důkaz |
|---|---|---|---|---|
| 1 | 3 | Jazyk během exportu → export zamrzne, Zrušit nefunguje, okno zablokované | Export Z300 → za 4 s Okno → Jazyk → English | 4/4; `06`, `07`; 3× ChildProcess exit null bez procesu |
| 2 | 3 | Úprava (Odstranit s posunutím) z nabídky během exportu → video/zvuk z různých stavů, „✔ Hotovo“ | Vyber klip, Export, během obrazu Úpravy → Odstranit s posunutím | Z1H: v 3590 s / a 3600 s; Z300: 270 záblesků / 268 pípnutí |
| 3 | 3 | Druhý export (Ctrl+M) do výchozí = stejné cesty → poškozené MP4, oba „✔“; do jiné cesty míchaný průběh | Export → Soubor → Exportovat → Exportovat | `k14-stejny-soubor.mp4` chyby dekodéru; průběh 8→4→18→23→19 % |
| 4 | 2 | „In/Out sekvence“ s jen In (nebo jen Out) – dialog ji předvybere, exportuje se celá sekvence | Sekvence 10 s, In na 5 s, Export | `e-jen-in.mp4` 10,0 s místo 5,0 s (Premiere: In → konec) |
| 5 | 2 | Soubor smazaný/přejmenovaný za běhu: aplikace ho neoznačí offline; export radí „naimportuj z nového místa – klipy se samy připojí“, ale import přejmenovaného souboru je nepřipojí | Sekvence ze `prejmenovat.mp4`, přejmenuj v Průzkumníku, Export, Importovat nový název | `12-…png`; `missing=false`, 0 offline klipů, klip dál na `prejmenovat.mp4` (chybí) |
| 6 | 2 | Cesta k souboru > 260 znaků: import, náhledy, vlna i export OK, Zdroj i Program **černé bez hlášky** | Import souboru s cestou 262 znaků, otevřít / dát na časovou osu | `10-…png`; `<video>` error 4 „Format error“ |
| 7 | 2 | Soubor zamčený jiným procesem: monitor černý bez hlášky, export „✖ ffmpeg exited with code 4294967283: [in#0 @ …] Error opening input: Permission denied…“ (anglicky, technicky) | `File.Open(…, FileShare.None)`, Export | `11-…png` |
| 8 | 2 | Médium bez řeči (tón/pípání) → „Přepis selhal“, Worker `IndexError: boolean index did not match…`; Zkusit znovu = totéž; po importu se automaticky řadí každý soubor | Import `sync60.mp4` (auto přepis zapnutý) | 5/5 souborů; `02`, `02b` |
| 9 | 1–2 | Sekvence bez zvuku → XDCAM MXF bez jediné zvukové stopy (TV ingest čeká kanály; Premiere dá ticho), MP4 také bez zvuku | Sekvence z `bezzvuku20.mp4`, Export XDCAM | `ffprobe`: jen `mpeg2video` (formáty S12 to u MP4 vedou jako OK) |
| 10 | 1 | Zvuk o 10–21 ms napřed podle In bodu klipu (`-ss` před `-i` u kusů zvuku bez přesného ořezu) | `hodina.mp4` In 0 / 5 / 12 / 1000 s | −21 / 0 / −10 / −21 ms; stejný ffmpeg mimo aplikaci totéž, bez `-ss` 0 ms; `sync60.mp4` 0 ms. Souvisí s formáty #10/#11 |
| 11 | 1 | „Sekvence je prázdná – není co exportovat“ i když není: In/Out 20–30 s za koncem 10s sekvence; sekvence jen s titulkem (3 s); 1 snímek z konce média (59,96–60 s, float 0,03999 < 1/25). In 5/Out 30 → jen 5 s (Premiere: celý rozsah s černou) | Export s In/Out mimo obsah | `08-…png`, `tC.out` |
| 12 | 1 | Titulky: náhled ukazuje `{\b1}…{\b0} <i>…</i> \N` doslova, export je provede (tučně, kurzíva, zalomení) → náhled ≠ export; titulek 1 480 znaků bez omezení přes ~17 řádků obrazu; prázdný titulek = prázdný záznam v .srt | 500 titulků, zvláštní na 12–17 s, Export s vypálením + .srt | `13-…jpg` (export), `14-…png` (náhled) |
| 13 | 1 | Hláška importu česky s anglickým jádrem: „Nejde importovat: video.mp4 (File not found: //…)“ | Import neexistující síťové cesty | `01-…png` (síťová cesta nezdržela: 15 souborů 3,2 s) |
| 14 | 1 | Výkon úprav roste s projektem: každá úprava 2× serializuje celý projekt, historie = 200 celých kopií | 300× Ctrl+K na Z300 | průměr 116 ms/řez, max 5,3 s; RSS rendereru špička 1,9 GB (heap 50 MB), pak 416 MB; 150× Ctrl+K na Z1H: medián 26 ms, historie 153 × 575 KB = 83 MB |

## Co prošlo (bez nálezu)
- **Z300** (5 min z `hodina.mp4`, 300× Ctrl+K, 30× Odstranit s posunutím, 10 V + 10 A, 722 klipů): časová osa 150–165 ms
  na překreslení, zoom 106–970 ms, Přizpůsobit 337 ms (`03-…png`). Export 54 s: **6 750/6 750 snímků, 270,000 s, záblesky
  přesně po 25 snímcích, A/V 0 ms** (8× −21 ms = nález 10).
- **Z1H** (1 h, 360 klipů): řez 359 míst 41 ms, překreslení 51–61 ms, zoom 26–257 ms, posun 33 ms, skok hlavy 111 ms;
  export 72 s: **90 000/90 000 snímků, 3 600 záblesků po 25 snímcích**, RSS při exportu ≤ 392 MB.
- **200× Zpět/Znovu** (200 úprav: 65 vložení, 65 značek, 20 hlasitost, 20 Odstranit s posunutím, 15 řezů, 15 přesunů):
  200× Ctrl+Z (6,4 s) → sekvence shodná s výchozí až na pozici hlavy (uložená v kroku, neškodné); 200× Ctrl+Y (8,7 s)
  i 100× Ctrl+Z + 100× Ctrl+Shift+Z → **bajtově shodné** s koncovým stavem; Ctrl+Z navíc nic nerozbije. Limit historie 200.
- Okraje: klip od 0 i od 5 s 0 ms; 1snímkové médium → export 1 snímek; ořez za konec média se zastaví na 60,00 s, před
  začátek na In 0; úsek 0,02 s se zaokrouhlí na 1 snímek; jen zvuk → černý obraz 750 snímků + zvuk; mezera 0–10 s → černá +
  ticho, 12,0 s; prázdná sekvence → česká hláška.
- Divné názvy (diakritika, mezery, emoji, `#`, `%20`, `&`, `'`, `[](){};,=+!`): import, náhled, vlna, export OK;
  výstup `zatez-s12-výstup #1 %20 & 'x' 🎬 [a].mp4` i výstupní cesta 312 znaků OK. Neexistující síťová cesta nezamrzne.
- 500 titulků: časová osa 7–8 ms, panel Titulky 71 ms, export s vypálením 57 s, .srt 500/500 záznamů (ffmpeg je načte),
  `-->` v textu .srt nerozbije, víceřádkový titulek správně.
- Ctrl+Z z nabídky během exportu: export je konzistentní (starý stav). Dva exporty do různých souborů: oba správné.

Data `s12/zatez/` (výstupy skriptů `*.out`, `*-sync.json`, snímky titulků, skripty), snímky `s12/shots-zatez/`, exporty
`web/test-out/zatez-s12-*`. Instance 9377 zastavená; ostatní instance ani uživatelovy aplikace jsem nepoužil.
Pozn.: sdílený scratchpad – jiný agent mi přepsal `exp.js`; dál jsem jel jen se soubory `zatez-*`.

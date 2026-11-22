# Redaktor – kolo 2 (Reels 15–20 s, silný výrok, titulky, nadpis, bez AI)
(Uloženo vývojářem z textu agenta.)

## Shrnutí
- **Zvládl bych to sám? ANO, ale těsně.** (kolo 1: NE)
- Celkový čas import → okno uložení: 4 min 21 s (47 kroků); člověk odhadem 9–12 min. Nejvíc času: oprava titulků (7 chybných, ~30–40 s každý).
- Hledání výroku: přepis vidět 17 s po importu; výběr automatem 11 s – nerealistické. Redaktor bez cíle prolistuje 401 vět ~3–5 min;
  Ctrl+F pomůže až když ví, co hledat.
- Výrok 25:51–26:10 (6 vět, 19,7 s): „Tak neříkejte tyhle fádní věci… Potřebujeme jenom toho člověka, aby s námi byl…“
- Nadpis: „Šimková o ztrátě mámy: Tohle nepomáhá“.
- Nejvíc by pomohlo: **opravovat titulky jako text v seznamu se zvýrazněnými nejistými slovy**, místo hledání chyb posouváním náhledu.
- Poslal bych bez úprav? **NE**; po ručních opravách skoro ano (zvuk a hrany neověřeny poslechem).

## Postup
1. Nový projekt → Neukládat → čisté, karta „Začni tady“ česky, stará hláška pryč.
2. Import (konzole). Karta „Otevři klip, nebo nech stříhat AI“ s tlačítkem Přepis.
3. Tlačítko Přepis otevřelo **prázdný panel**; zpět do Projekt, dvojklik → přepis (401 vět) hned.
4. Hledání „nepomáhá“ + Enter → věta; klik + Shift+klik → „6 vět · 0:20“.
5. „Vložit do nové sekvence“ → dialog 1080×1920 + zaškrtnuté „Vložit do ní vybraný klip (úsek In–Out, 0:20)“ → 9:16, obličej uprostřed.
6. Sekvence → Titulky → Vytvořit titulky z přepisu → dvouřádkové, karaoke.
7. Nadpis nahoře… → Enter → hned v obraze.
8. Oprava 7 titulků (Upravit titulek pod přehrávací hlavou, pak dvojklik v náhledu).
9. Export → systémové okno uložení → Esc.

## Kde jsem se zasekl (od nejhoršího)
1. **Titulky plné chyb přepisu, oprava pracná** – ze ~13 titulků 7 špatně: „neříká se“ → neříkejte; „jako věci často zahojí“ → věci jako
   „časem se to zahojí“; „Je tak tě lýb“ → „Je jí teď líp“ (odhad); „slišet“; „neozíváme“; „aby zavola, ale řekl, Jadu za“ → aby zavolal a řekl:
   „Jedu za…“; „já ti vezují dlo“ → vezu ti jídlo. Chyby hledal posouváním náhledu po 1 s; **chybí seznam titulků a skok na další titulek**
   (šipka dolů skočila na konec sekvence). Úprava dvojklikem v náhledu – nikde nenapsáno. Delší text se sám rozdělil na dva titulky (správně, ale překvapí).
2. **Panel „Text v obraze“ zůstává otevřený a plave** přes zdrojový monitor; při exportu zakryl název souboru (snímek 17).
3. **AI panel „Připoj svou AI“ zabírá ~třetinu šířky** i bez AI; časová osa úzká (20s klip ~30 px). Po schování panelu klip ~pětina osy, „\“ nic neudělalo.
4. **Tlačítko „Přepis“ na úvodní kartě vede do prázdného panelu** – po jediném importu by se měl otevřít ten klip.
5. **Příklad v poli nadpisu „Ze Snídaně do zpráv – s pláčem“** je obsah tohoto rozhovoru – plete, navádí k jinému výroku.
6. Hledání skočí až po Enteru; „Vložit do nové sekvence“ v okně 1040×1100 napůl schované na spodním okraji.
7. „Snímková frekvence (fps)“ v dialogu Nová sekvence (předvyplněné, nevadí).
8. Technické/anglické pojmy v exportu: „H.264 (MP4)“, „Opus 160 kb/s – počítač nemá kodér AAC (Windows N…)“, „LUFS“, „.srt“.
   Lepší: Esc v okně uložení zavře export potichu.
9. Přepis jako text slabý („[Mužická muzika]“, „děváci“, „TN Life“) – na nalezení výroku stačí, do titulků ne.

## Poslal bych to na sítě TN?
Bez úprav NE (chyba skoro v každém druhém titulku). Po opravách nejspíš ANO: obličej uprostřed ve všech kontrolovaných místech i přes střih kamery;
titulky čitelné, karaoke, v bezpečné zóně; nadpis čitelný; hranice na koncích vět (poslechem neověřeno); citlivé téma (smrt matky) – výrok vhodný.

## Co bylo skvělé
Přepis hned po importu, klik/Shift+klik „6 vět · 0:20“; „Vložit do nové sekvence“ s 9:16 a obličejem bez dalšího kroku; titulky z přepisu jedním klikem;
úprava titulku dvojklikem v náhledu; export předvyplněný (9:16, hlasitost pro sítě, vypálení, .srt).

## Poznámky pro vývojáře
- `__pzDevExport` **dvakrát zablokoval ochranný systém Claude Code** (i diagnostický dotaz přes konzoli) – redaktor to neobcházel, **video nevzniklo**;
  hodnoceno podle náhledu.
- Panel prohlížeče 434 px, práce v emulaci 1040×1100, na konci preset desktop.

## Snímky
team/reports/shots-redaktor-2/: 00–03 nový projekt, karta, prázdný Přepis, přepis; 04–05 hledání, výběr; 06–07 Nová sekvence, 9:16;
08–11 titulky, nadpis; 12–16 chybné titulky a oprava; 17–18 export překrytý panelem Text v obraze.

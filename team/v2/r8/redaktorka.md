# Redaktorka – kolo 8 (2026-11-22, app.js?v=mws68wvn)

**Otázka:** Udělám v tom za 10 minut video na sítě, aniž bych se zasekla? **Odpověď: ano, ale s jednou zacházkou.** Od spuštění Chrome po hotové MP4 **6:44** (19:30:43 → 19:37:27). Výsledek `web/test-out/redaktorka-r8.mp4`: 1080×1350 (4:5), 25 fps, 26,46 s, −14,0 LUFS, zvuk Opus.
Obsah: dvě nesousední pasáže o mámě – věty 2:25–2:43 („Všechno, naprosto všechno, protože moje máma byla tmel naší rodiny … ona všechno organizovala.“) + 3:02–3:11 („To byl můj nejbližší člověk. A najednou byl pryč. A já jsem se s tím musela poprat. A byla to ta nejtěžší věc v mém životě.“). Nadpis „Šimková o mámě: Byla tmelem naší rodiny“.
Pomocníci: import `__pzDevImport`, export `__pzDevExport({ name: 'redaktorka-r8', burn: true, loudness: 'social' })` (dialog Export jsem jen otevřela a zavřela, snímek 31). Jinak jen myš/klávesy přes CDP.

## 3 nejdůležitější nálezy
1. **Hotové video začíná 2 snímky moderátorky** (3). Snímky 0,00 a 0,04 s ukazují moderátorku s logem TALK, od 0,08 s je teprve host (snímek 61, horní řádek; ffmpeg scene 0,36 na 0,04 s). Začátek pasáže (zdroj 2:25,9) padne 2 snímky před střih kamery a výřez podle obličeje ho na začátku sekvence nesloučí (není soused). V náhledu programu si toho nevšimneš, ve feedu to bleskne hned na začátku.
2. **„Přidat na konec sekvence“ nepřidá výřez podle obličeje** (3, pokud si toho nevšimneš). První pasáž vložená přes „Vložit do nové sekvence“ výřez měla, druhá přidaná na konec byla jen výřez ze středu: ve 23. s je v 4:5 široký záběr se stolem, host jen na kraji, ve 26. s obličej na okraji (snímek 18, spodní řádek). Opravila jsem to přes Sekvence → Auto Reframe sekvence → 4:5 (udělá to přímo v sekvenci, ~12 s, snímky 22–23). Zacházka asi 1 min. Nová volba v menu je dobrá, ale tohle by měla udělat sama.
3. **Stejný střih z 4:5 do 9:16 přes menu nejde** (2). Sekvence → Auto Reframe → 9:16 na 4:5 sekvenci hlásí **anglicky** v české aplikaci: „"FB 4:5 – máma tmel rodiny" is 1080×1350 – reframe only from a wider (16:9) sequence“ (snímek 33). Soubor → „Exportovat verze pro sítě…“ v headless Chromu nic viditelného neudělal (snímky 35–36, nejspíš systémový dialog – neověřeno). Postavila jsem to znovu: věty → nová sekvence 9:16 → přidat na konec → Auto Reframe 9:16 → titulky (19:38:30 → 19:40:06, 1:36). Opravy titulků se přenesly samy (opravy platí i v přepisu).

## Tabulka
| # | Co jsem dělala | Čekala jsem | Stalo se | Záv. | Důkaz |
|---|---|---|---|---|---|
| 1 | Export 4:5, kontrola po snímcích | celou dobu host | 0,00–0,04 s moderátorka (2 snímky), pak host | 3 | 61-strihy-po-snimcich.png, 60-kontakt-0.5s.png |
| 2 | Druhá pasáž přes „Přidat na konec sekvence“ | výřez podle obličeje jako u první | středový výřez, ve 23 s široký záběr bez tváře; nápravu udělá Auto Reframe 4:5 v menu | 3 | 18-program-kontakt.png → 23-program-kontakt-po-reframe.png |
| 3 | Auto Reframe 9:16 na 4:5 sekvenci | nová 9:16 verze | odmítnuto, hláška anglicky | 2 | 33-916-2s.png |
| 4 | Panel Text v obraze po přepnutí sekvence | hodnoty aktivní sekvence | nahoře „FB 4:5…“, ukazuje nadpis a hodnoty 4:5 (28 zn., 10 %), i když je aktivní 9:16 (20 zn., 30 %). Přepne se až po psaní do nadpisu, pak zase opačně. Zápis jde ale do správné sekvence | 2 | 40-916-A.png, 45, 46, 47-zpet-na-45.png |
| 5 | Titulky: ASR „narození“ | „narozeniny“ | Whisper exportu slyší „narozeniny[15,38–15,90]“. V titulku jsem to přehlédla, šlo ven | 2 | 60-kontakt (14,5–16,5 s), Whisper |
| 6 | Oprava titulků (zvolával → svolával, čárka) | rychle | klik, Ctrl+A, psaní, Enter → „Opraveno: 2 titulky“, přenese se do přepisu i do 9:16 | ok | 26–28, 43 |
| 7 | Q uvnitř 1. titulku (9:16) | titulek se zkrátí podle zbylé řeči | text 1. titulku zůstal celý („Všechno, naprosto všechno, protože“), jen se zkrátil na 1 s – po Q ukazuje slova, která už nezazní | 1 | 54-krok2-Q.png, 56-po-Q-zacatek.png |
| 8 | Snímek 25,64 s (před střihem na detail) | čistý střih | 1 snímek širokého záběru s jiným výřezem (posun), pak detail | 1 | 61 (spodní řádek) |
| 9 | Široký záběr 20,3–25,6 s | tvář čitelná | celá postava z boku, tvář malá (zdroj jiný záběr nemá) | 1 | 60-kontakt-0.5s.png |
| 10 | Konec videa | doznění | „životě“ končí 26,40 s z 26,46 s; ve zdroji hned navazuje „a přišlo“ bez pauzy, takže čisté, ale bez vzduchu | 1 | RMS −25 → −47 → −99 dB |
| 11 | Výběr nesousedních vět Ctrl+klikem | přidat do výběru | Ctrl+klik výběr nahradí. Dvě pasáže jdou jen přes „Přidat na konec“ | 1 | 09-ctrl-klik.png |
| 12 | Druhá nová sekvence | předvolba podle posledního výběru (4:5) | nabídla 9:16 | 1 | 39-dialog-916.png |
| 13 | Náhled 4:5 | bezpečné zóny FB/IG | tlačítko Bezpečné zóny u 4:5 chybí (jen u 9:16) | 1 | 25-titulky-hotovo.png |

**Zvědavost – Zpět/Znovu a Q/W (9:16):** značka M → Q → W → 3× Ctrl+Z → 3× Ctrl+Shift+Z. Vše sedí, stavový řádek srozumitelně píše „Zpět: Zkrácení začátku (Q)“, „Zpět: Přidat značku“, „Znovu: …“ (57-58). W na konci sekvence nic neudělal a do historie se nezapsal, takže třetí Ctrl+Z vrátil můj nadpis. Logické, ale chvíli jsem nevěděla proč. Q zkrátil a posunul i titulky a značku (53-55). F1 se pořád otevírá odscrollovaný dolů (59).

## Kolo 7 → kolo 8
- ✔ **Chybějící první slovo titulku:** opraveno. První titulek „Všechno, naprosto všechno,“, Whisper „Všechno[0,00–0,54]“, před slovem 150 ms ticha.
- ✔ **Nadpis přes obličej:** v 4:5 i 9:16 dva řádky nad očima (60, 46).
- ✘ **Titulky v zóně tlačítek 9:16:** neopraveno (v logu odloženo). „naprosto“/„všechny,“ sahají do pravé červené zóny (44-916-zony-detail.png).
- ✔ **Delete na kousku obrazu po reframe:** opraveno. Smaže jen ten kousek, zvuk zůstane, Ctrl+Z vrátí (48-50).
- ✔ **EN↔CZ:** opraveno. V EN zůstaly česky jen moje texty (názvy, titulky, nadpis), zpět v CZ nic anglicky (51, 52). Nově ale anglická chybová hláška u Auto Reframe (nález 3).
- ✔ **„Podklad“ useknutý:** opraveno, „Podklad pod titulky“ celé, bez vodorovného posuvníku (29).
- ✘ **Opus místo AAC:** beze změny (v logu odloženo).
- ✔ **▾ u Vložit:** když sekvence existuje, nabízí „Přidat na konec / Vložit na hlavu / Vložit na začátek / Do nové sekvence…“ (38).
- ✘ **F1 odscrollovaný:** beze změny. ✔ „Zobrazit celou sekvenci“ už má klávesu „\\“.
- ~ **„Doplnit titulky…“** se po vytvoření titulků v Přepisu pořád zobrazuje (37).

## Časy
Nový projekt 0:50 · import 0:05 (přepis z mezipaměti hned) · výběr A + sekvence 4:5 1:40 · přidání B 0:25 · zacházka Auto Reframe 0:30 · titulky 0:13 · 2 opravy 0:17 · nadpis 0:11 · export 0:22 → **MP4 za 6:44**. Pokus o 9:16 přes menu + nová stavba 9:16 s titulky a nadpisem 19:37:33 → 19:40:50 (3:17). Zvědavost do 19:42:30, kontrola MP4 (kontaktní arch, snímky, Whisper, RMS) do 19:45. Chrome zavřen.

**Použila bych to zítra? Ano, pro jednu verzi.** Dvě pasáže, titulky, opravy, nadpis a export jdou rychle a bez hledání. Po „Přidat na konec“ ale musím vědět, že mám spustit Auto Reframe. Začátek musím projít po snímcích kvůli záblesku moderátorky. Druhý formát ze stejného střihu znamená stavět znovu.

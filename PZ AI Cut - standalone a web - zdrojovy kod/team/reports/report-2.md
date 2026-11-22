# Report – kolo 2: Reels 9:16 se silným výrokem, bez AI (tester)
(Uloženo vývojářem z textu agenta.)

Tester z redakce, 2026-11-21. Zdroj: rozhovor Talk s Barborou Šimkovou (28 min), import přes `__pzDevImport` jako `rozhovor.mp4`,
čistý projekt (Soubor → Nový projekt → Neukládat; starý projekt ze zálohy se sekvencemi „Reels vyrok“ tím zmizel).
Výsledek: sekvence „Tester2 16x9 9x16“ (16,1 s, 1080×1920, Auto Reframe), 10 titulků s karaoke, nadpis „Šimková: Jiná možnost není“,
výrok 18:16–18:32 („Tady není jiná možnost … ty musíš pokračovat dál.“). Export `web/test-out/tester2-reels-final.mp4`.
Vývojové nástroje: jen import/export; kontrola stavu `__pzDev.tools.get_sequence/get_captions` (čtení). Jinak myš, menu, klávesy.

## Časy
- Import 28min souboru 1,2 s; přepis hned („✓ Přepis“ z úložiště).
- Přepis krátkých klipů asr-wait/asr-wait2 (20 s): ~9 s, celou dobu „0 %“.
- Zastavit/Pokračovat na čerstvém 90s klipu: po Pokračovat doběhl za 31 s, průběh 0 → 25 → 50 → 75 %.
- Nalezení výroku: Ctrl+F „jiná možnost“ → 1/1 → klik + Shift+klik ~1 min (věděl jsem, co hledám; jinak číst 401 vět, ~30 tis. znaků).
- Titulky z přepisu < 2 s, Auto Reframe 9:16 ~2 s, export 16 s za 1,7 s.

## Co se mi líbilo
- Průběh přepisu vidět: štítek u klipu „Přepis 0 %“ / „Přepis zastaven“ / „✓ Přepis“, záložka „Přepis 0 %“ / „‖“; kontextové menu
  Zastavit / Pokračovat / Přepsat znovu… s jasným dialogem; v panelu „Přepis zastaven (0 %) · hotovou část můžeš používat“ + Pokračovat.
- Ctrl+F v Přepisu skočí na větu; klik / Shift+klik „6 vět · 0:16“, In/Out ve zdroji, hned „Vložit do nové sekvence“.
- Out uprostřed věty (O) → „⚠ Uprostřed věty“ + „Přichytit“ – posunulo Out na konec věty. Výborné.
- Dialog Nová sekvence česky, výchozí 1080×1920, „Vložit do ní vybraný klip (úsek In–Out, 0:16)“; přes Ctrl+N nezaškrtnuté → prázdná 9:16.
- Titulky bez AI ze tří míst (Sekvence → Titulky, Text v obraze, AI panel „Titulky (bez AI)“), stejný srozumitelný dialog, varování při nahrazení.
- Auto Reframe po titulcích: titulky přeskládané, obličej na středu, bezpečné zóny samy, štítek „Rozhraní Reels / TikTok / Shorts“.
- Rychlé opravy titulků 3 kola × 5 = **15/15 uloženo**, zalomení se přepočítá; Ctrl+Z „Zpět: Úprava titulku“, Ctrl+Y zpět; „Nahradit titulky“ = jedno Ctrl+Z.
- Export −14,0 LUFS, **true peak −1,7 dBTP**, H.264 + Opus 1080×1920, titulky i nadpis vypálené, karaoke čitelné.
- Nápověda nad lištou „Nenalezená média“, „Jak na video pro sítě“ odpovídá aplikaci, zkratky uvádějí „,“ a „.“.
- Poslat AI bez AI → hláška „AI zatím není připojená – zadání počká…“.
- Nový projekt + F5 = čistý stav; export nové sekvence bez textu (shots-2\novy_projekt_export_contact.jpg).

## Co se mi nelíbilo / zdrželo (váha 1–3)
1. **[2] Hledání závisí na pravopisu rozpoznávání** – všude „děváci“ místo „diváci“, „Šimkova“, „Krysta“, „hredství“, „psa la“… Správně napsané slovo nic nenajde.
2. **[2] Karaoke a titulky na začátku předbíhají řeč** – řeč od 0,9 s, karaoke „Tady“ už 0,5 s, „není“ 0,8 s (direct916_start_contact.jpg); po smazání „to.“ ještě víc. První titulek končí 2,23 s, věta zní do 2,42 s.
3. **[2] Auto Reframe 9:16 na sekvenci, která už je 9:16, neudělá nic a nic neřekne** – neví se, jestli se výřez podle obličeje použil.
4. **[2] Po „,“ do prázdné sekvence je klip skoro celý mimo obraz** – přiblížení správné, ale osa odscrollovaná o 362 px (ui_comma_insert_scrolled.png). Přes „Vložit do nové sekvence“ OK.
5. **[1] První věta začíná 0,9 s ticha** (In na začátku věty podle přepisu, řeč o 0,9 s později) – ztracená vteřina háku. Konec těsný (~70 ms po slově), nic useknuté.
6. **[1] Průběh přepisu hrubý** – po 25 %, „odhaduji čas…“ se nezmění, u 20s klipů 9 s „0 %“; po Pokračovat znovu „Připravuji rozpoznávání řeči… jen poprvé“.
7. **[1] Panel Přepis nepřepne na nově importovaný klip, který se přepisuje**; klik na štítek „Přepis 0 %“ Přepis neotevře.
8. **[1] Dialog Nová sekvence nepotvrdí Enter**; název pokaždé „rozhovor“ → víc sekvencí stejného jména.
9. **[1] Zadání pro AI bez AI nejde zrušit** – v Průběhu přečkalo i Nový projekt (zmizelo po F5); připojená AI by se pustila do starého.
10. **[1] Uložit v „Uložit změny v projektu?“ → systémové Uložit jako „Untitled.pzcut“**, typ „PZ AI Cut project (*.pzcut;*.com;*.exe;*.bin)“ vypadá podezřele.
11. **[1] `__pzDevExport` uloží soubor bez přípony** a 11 Mb/s (21 MB na 16 s) – možná jen vývojový nástroj.

## Chyby
1. **[2] Po Novém projektu zůstane otevřené okno „Text v obraze“ se starými daty** – hlavička „asr-wait“, pole „STARY NADPIS“; připsat „ X“ → nová sekvence dostala nadpis „STARY NADPIS X“ (ui_novy_projekt_stale_textwindow.png). Hrozí cizí nadpis v exportu.
2. **[1] Po Novém projektu (bez F5) zbytky** – stavový řádek „Zpět: Titulky z přepisu“, v monitoru skryté prvky se starým textem titulku i nadpisu (export čistý). Po F5 pryč.
3. **[1] Anglicky v CZ:** „Untitled.pzcut“ v panelu Projekt i v Uložit jako.
4. **[1] Po F5 média z `__pzDevImport` chybí** (lišta „Nenalezená média: 1“, štítek ✓ zmizí) – asi jen vývojový import; ověřit běžný import přes dialog.
5. **[info] „,“ funguje** (automat posílá jen e.key=„,“); skutečná česká klávesnice neověřena.

## Hranice střihu (zvuk, ffmpeg – RMS po 100 ms, silencedetect)
- Začátek: In 1096,00 s uprostřed pauzy (ticho 1095,97–1096,98 s, −57…−69 dB). Nic useknuté. Slovo „to.“ v prvním titulku nezazní – chyba časování slov v přepisu.
- Konec: Out 1112,12 s v krátké mezeře (−45…−50 dB); poslední slovo „dál“ dozní 16,05 s. Neuseknuté, těsné.
- Ruční Out doprostřed věty (18:20:00): upozornění ano, Přichytit → 18:22,36.

## Chybná slova v titulcích
Výrok: **6 chybných z 48 (12,5 %)**: „to.“ (navíc z předchozí věty), „ne máš“→„nemáš“, „tuh“→„tu“, „výle“→„chvíli“ (rekonstrukce), „taková hle“→„takováhle“, „stráta“→„ztráta“.
**Patří mezi překážky: ANO** – „Ty ne máš v tuh výle jinou“ a „stráta“ pod logem TN nepustím. Oprava ~1 min (5 rychlých oprav). Zbytek přepisu je horší („Přijvám“, „děváci“, „Krysta“, „hredství“).

## Nápady
1. Zvýraznit slova s nízkou jistotou rozpoznávání (podtržení) v Přepisu i titulcích.
2. Hledání tolerantní k podobným tvarům („divaci“ najde „děváci“).
3. In posunout na skutečný začátek řeči podle zvuku, na konci +0,2 s doznění; totéž pro karaoke první věty.
4. Auto Reframe na 9:16 sekvenci: provést, nebo jasně říct, že je hotový.
5. Nový projekt: zavřít plovoucí okna (Text v obraze), vyčistit stavový řádek a čekající zadání AI; v Průběhu tlačítko „Zrušit zadání“.
6. Nová sekvence: Enter = OK, název „Reels 1, 2…“ nebo „<klip> 9x16“.
7. Po „,“ do prázdné sekvence scrollovat na začátek.

## Soubory
web/test-out: tester2-reels-final.mp4 (finál), tester2-reels-direct916.mp4 (přímo 9:16, neopravené), tester2-novy-projekt-check.mp4.
team/reports/shots-2: final_contact.jpg, final_t0.5.jpg … final_t15.6.jpg, final_start_contact.jpg, direct916_start_contact.jpg,
novy_projekt_export_contact.jpg, ui_final_sequence.png, ui_comma_insert_scrolled.png, ui_novy_projekt_stale_textwindow.png.
Dočasný 90s klip smazán. V aplikaci zůstal projekt s asr-wait2.

## Shrnutí
Cesta bez AI je poprvé celá průchozí a rychlá; zvuk v normě (−14 LUFS, −1,7 dBTP); Out uprostřed věty a dávky oprav fungují; nic useknuté.
Hlavní překážka k odeslání: kvalita rozpoznávání (6/48 slov, oprava ~1 min). Dál: karaoke předbíhá o 0,2–0,5 s; okno Text v obraze
po Novém projektu se starým nadpisem; „,“ do prázdné sekvence odscrollované; Auto Reframe na 9:16 tiše nic.

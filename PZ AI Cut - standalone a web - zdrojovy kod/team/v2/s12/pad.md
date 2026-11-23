# S12 – Pád a obnova (PZ AI Cut Standalone, Windows)

Instance `9378`, profil `%TEMP%\pz-s12-pad` (`--size 1366x768 --lang cs --ai`), pád = `taskkill /F` hlavního procesu své
instance (u testu okna i jen jejího rendereru). Druhé okno: `9388` (vlastní profil) a `9398` (stejný profil). Ovládání
`test/cdp.js` + vlastní CDP skripty; nativní dialogy (Otevřít, Uložit, „Uložit změny?“) jsem nahradil podvržením
`ipcRenderer.invoke('dialog', …)` – kód aplikace za dialogem běží beze změny. Export přes skutečný dialog Export (pole
Výstupní soubor + tlačítko). Kód: `e2eb1ed` + rozdělané změny, od 12:10 commit `838cf43` (Bezpečnost S12) – nálezy 1–9
jsem na `838cf43` ověřil znovu nebo se jich změna netýká (renderer.js mění jen escapování). Data: `s12/pad/`.

**Verdikt:** běžný pád je pokrytý dobře – po zabití se obnoví všechno (sekvence, titulky, nadpis, opravy přepisu, značky,
smazání klipu), projekt je označený `*`, česká hláška, ztráta max. 60 s práce. Slabá místa jsou kolem: **uložení, které
selže, nic neřekne**; **záloha se tiše zahodí**, když projekt není na původním místě nebo běží dvě okna; přerušený
export nechá rozbité MP4 pod cílovým jménem a stovky MB v cache.

## Tři nejdůležitější nálezy
1. **Neúspěšné uložení je úplně tiché (3).** Ctrl+S do souboru jen pro čtení i do složky bez práva zápisu (`C:\`):
   žádná hláška, stavový řádek dál „Připraveno“, jen `*` zůstane; v konzoli nezachycená výjimka `EPERM … rename
   proj4.pzcut.tmp -> proj4.pzcut`. Ctrl+Q → „Uložit změny?“ → Uložit: okno se nezavře a zase nic neřekne – jediná
   cesta ven je Neukládat (= ztráta práce) nebo uhodnout Uložit jako. Zůstane `proj4.pzcut.tmp`. Originál nepoškozen.
   Příčina: `commands.save` vrací promise, `runCmd` chytá jen synchronní chyby (`renderer.js:681`, `saveProject` 1484).
   Důkaz `t9a-ulozeni-readonly.png`, výpis výjimek v textu níže. Kroky: `attrib +R projekt.pzcut`, úprava, Ctrl+S.
2. **Obnova po pádu se ztratí, když projekt není na původním místě (3).** Uložený projekt, neuložená značka, záloha
   zapsaná, pád; projekt mezitím přesunut/přejmenován (stejné nastane s nepřipojeným síťovým/USB diskem). Po startu
   prázdná aplikace „Bez názvu“, **žádná hláška** (`t3-projekt-presunuty-po-padu.png`), přitom `autosave.tnproj` práci
   obsahuje. Po první další úpravě ji automatické uložení do minuty přepíše (`t3-autosave-pred.tnproj` obsahuje
   „Neulozena prace v proj2“, `t3-autosave-po-importu.tnproj` už ne). Podmínka v `start()` (`renderer.js:2105`)
   vyžaduje existující `autosaveOf` = `lastProject`.
3. **Dvě okna = jedna záloha (2).** Aplikace nemá zámek jedné instance; druhé spuštění téhož uživatele otevře druhé
   okno se stejným `autosave.tnproj` a `settings.json`. Okno A (proj1, neuložená značka „A3“) a okno C (nový projekt)
   si zálohu střídavě přepisují každou minutu (12:05:42 A, 12:06:29 C, 12:06:42 A …). Po pádu obou se obnovilo jen
   okno C; značka A3 není nikde (grep 0 v projektu i záloze). Navíc stejný projekt ve dvou oknech (9378 + 9388):
   A uloží A1, B uloží B1, A uloží A2 → v souboru A1+A2, **B1 tiše ztracena**, žádné varování „soubor se změnil“.

## Další nálezy
| # | Oblast | Kroky | Očekávání | Výsledek | Záv. | Důkaz |
|---|---|---|---|---|---|---|
| 4 | Přerušený export | Export 5 min H.264; a) zabití při „60 % mix“, b) tlačítko Zrušit ve stejné fázi | žádný „hotový“ soubor, úklid dočasných, „Export zrušen“ | a) `pad-s12-zabito-pri-exportu.mp4` 27 MB, b) `pad-s12-zruseno.mp4` 6,8 MB – oba „moov atom not found“ pod cílovým jménem; v `cache\export\x…` zůstane 210 MB na pokus (wav 2× 86 MB + ts 47 MB), po restartu neuklizeno (420 MB); Zrušit hlásí „✖ ffmpeg exited with code null:“. ffmpeg po pádu nezůstal viset ✔ | 2 | `t8-export-zrusen.png`, `web/test-out/pad-s12-*.mp4` |
| 5 | Pád jen okna (rendereru) | zabití procesu `--type=renderer` | hláška / znovunačtení | tmavé prázdné okno s nabídkami, žádná zpráva; křížek (WM_CLOSE) ani nabídky nic neudělají (`close` čeká na mrtvé okno, `main.js` bez `render-process-gone`) – jen Správce úloh. Data OK: záloha se po startu obnovila | 2 | `t7-renderer-spadl.png` |
| 6 | Médium přesunuté za běhu, znovupřipojení | otevřený projekt, `media-a.mp4` → `presunuto\` | aplikace to pozná; „Naimportuj z nového místa – klipy se samy připojí“ funguje | dokud se projekt znovu neotevře, klip vypadá normálně (`missing=false`); export ohlásí offline ✔, ale import z nového místa jen přidá **duplikát**, export dál offline (`t11-…png`). Po znovuotevření připojení funguje („Médium znovu připojeno“, duplikát zmizí), **ale projekt se neoznačí `*`**: Ctrl+Q zavře bez dotazu, po startu zase offline | 2 | `t11-po-importu-z-noveho-mista.png` |
| 7 | Poškozená záloha | záloha useknutá v půlce (zabitím procesu se to nepodařilo – zápis 48 MB vždy doběhl; nastane při výpadku proudu / plném disku, autosave píše přímo, ne přes .tmp jako Ctrl+S) | „Záloha je poškozená…“, start s posledním projektem | neuložený projekt: „Poslední projekt nejde otevřít: Unterminated string in JSON at position 975…“ (žádný poslední projekt nebyl, o záloze ani slovo); uložený projekt: záloha tiše ignorována, otevře se poslední uložený stav | 2 | `t4b-po-startu.png`, `t4a-…`, `t4b-autosave-useknuty.tnproj` |
| 8 | Poškozený .pzcut | Otevřít: useknutý JSON, prázdný soubor, binární smetí | srozumitelná hláška, bez pádu, soubor i otevřený projekt beze změny | bez pádu ✔, otevřený projekt zůstane ✔, soubory beze změny (md5) ✔; hláška je ale surová chyba JSON: „Projekt nejde otevřít: Unexpected token '�', "�V���…" is not valid JSON“, „…Expected double-quoted property name in JSON at position 2395“ | 2 | `poskozene/c1–c3` |
| 9 | Export na neexistující disk | dialog Export, `Q:/Videa/pad-s12.mp4` | „Disk Q: neexistuje / vyber jiné místo“ | „✖ ENOENT: no such file or directory, mkdir 'Q:\Videa'“ (vlastní kontrola zápisu přijde až po `mkdir`, `exporter.js:197`); pruh zůstal na 60 % z minulého zrušeného exportu | 2 | `t10-export-neexistujici-disk.png` |
| 10 | Chybějící pole / cizí JSON / jiná verze | otevřít `{"app":…,"version":1}`, cizí JSON s příponou .pzcut, `version: 99` | varování | vše se otevře bez hlášky: první dva jako prázdný „Bez názvu“ s cestou k souboru – Ctrl+S cizí soubor bez dotazu přepíše (`c7-cizi-json-PO-ctrl-s.pzcut`); verze 99 bez varování. **Sekvence `null`**: na `e2eb1ed` aplikace zamrzla v rozbitém stavu (žádný projekt už nešel otevřít ani Nový projekt, titulek dál „proj1.pzcut“, `t5-c7-po-c5.png`) – **na `838cf43` opraveno** (sanitize), otevře se bez sekvencí, ale bez hlášky | 1 | `poskozene/c4–c7` |
| 11 | Pád při Ctrl+S | projekt 59 MB (300 000 titulků), zabití hned při vzniku `.tmp` | originál nedotčený | originál md5 beze změny ✔, po startu poslední uložený stav ✔; zůstal `proj3-big.pzcut.tmp` 59 MB, nikdo ho neuklidí ani nenabídne | 1 | `t4-velky-projekt.txt` |
| 12 | Klip s neexistujícím médiem | `mediaId` na neexistující položku | offline / varování | klip vypadá normálně, bez náhledu, žádná hláška | 1 | `t5-c9-klip-bez-media.png` |

## Co funguje (ověřeno)
- **Pád po úpravách** (uložený projekt): obnoveno vše z poslední zálohy – titulek změněný, nadpis „NEULOZENY“, 2. oprava
  přepisu, značka C, smazaný klip; projekt `*`, hláška „Obnoveny neuložené změny z automatické zálohy…“ (`t1-po-restartu.png`).
  Historie Zpět se neobnoví (stav „Není co vrátit“, jako Premiere po zavření).
- **Ztráta max. 60 s:** záloha každou minutu od startu okna; úprava v 11:54:10 (6 s po záloze 11:54:04), pád 11:55:03 →
  ztraceno 53 s práce (značka E). Úprava 0,4 s před pádem ztracena (D). Nastavení (`settings.json`) se ukládá hned.
- **Neuložený projekt** (Bez názvu) se po pádu obnoví („Obnoven neuložený projekt z automatické zálohy.“).
- **Pád při zápisu zálohy 48 MB:** zápis v systému doběhl, JSON platný, obnova OK. Ctrl+S přes `.tmp` + přejmenování chrání originál.
- Pád při exportu: ffmpeg skončí s aplikací (žádný sirotek). Export s chybějícím médiem: hláška předem ✔.
- Zpět/Znovu přežije Ctrl+S; po znovuotevření / restartu / obnově je historie prázdná.
- **Paměť:** 3000× úprava+Zpět (střih, značka, titulek, nadpis) na sekvenci s ~350 klipy: heap po GC 88 → 80 MB, RSS
  409–449 MB, DOM 3796 → 3714 – bez úniku (`t13-uprava-zpet-3000x-gc.log`). Historie max. 200 kroků (39 MB při 227 KB
  projektu). Záloha 1–2 ms u malého projektu; u 48 MB projektu Ctrl+S 171 ms (stringify 81 ms) – okno na tu chvíli stojí.
- **30 min v reálném čase** (`t13-30min-realny-cas.log`, 12:18–12:48, úprava každé 2 s: střih, značka, titulek, Zpět,
  Znovu, nadpis, zesílení, oprava přepisu, zoom): 888 úprav, 0 chyb; záloha zapsaná přesně každých 60 s (29×, časy v logu
  jsou UTC), zápis zálohy 0,4–0,8 ms po celou dobu – **nezpomaluje**. Halda po GC 8,6 → 28,3 MB a RSS 168 → 255 MB
  rostou úměrně projektu (3 → 61 KB, 2 → 76 klipů) a historii Zpět (strop 200 kopií projektu); únik ne (viz test
  úprava+Zpět). Medián doby úpravy 6 → 35 ms (max 124 ms) roste s počtem klipů – zatím bez znatelného zpoždění.

## Nezkoušeno
Plný disk (bez malého svazku to nejde nasimulovat bez admin práv). Média na síti.

## Poznámky k testu
- Během testu se měnil kód (vývojář commitoval `838cf43` v 12:10; v 12:04 mělo `tools/sync-ai-panel.js` chvíli
  syntaktickou chybu → mé druhé okno 9398 skončilo dialogem „A JavaScript error occurred in the main process“, po opravě OK).
- Všechny moje procesy (9378, 9388, 9398) ukončeny. Profily `%TEMP%\pz-s12-pad` (28 MB) a `pz-s12-pad2` zůstávají;
  velké zbytky po testu (420 MB `cache\export`, 59 MB projekt + `.tmp`) jsem po zapsání smazal.

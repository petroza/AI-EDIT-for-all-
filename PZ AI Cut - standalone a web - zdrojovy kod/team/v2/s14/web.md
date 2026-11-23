# S14 – Web (PZ AI Cut Web, Chrome bez instalace)

Server `node web/serve.js 8796` (build `node web/build.js`, stránka `app.js?v=mwt8t503`), headless Chrome s profilem
`%TEMP%\pz-s14-web-chrome`, CDP 9386, okno 1366×768. Řízení přes vlastní démon `shots-web/drv.js` + `c.js` (CDP na úrovni
prohlížeče s automatickým připojením ke všem kartám a workerům): **konektory 7895–7897 a huggingface.co / hf.co
blokované v síti** (144 pokusů stránky o `/hello` → všechny `blocked: inspector`, ke konektoru se karta nepřipojila,
model řeči se nestahoval), sběr konzole, výjimek, `Log` „security“ a `securitypolicyviolation`. Klávesy a kliky
skutečnými událostmi CDP (`Input.dispatchKeyEvent/MouseEvent`); import přes `__pzDevImport` (/devfile), přepis vložený
do IndexedDB jako v `test/b1.js`; systémové dialogy Uložit/Otevřít nahrazeny `showSaveFilePicker/showOpenFilePicker`,
které vrací soubor v OPFS (kód aplikace jinak beze změny). Sync exportu: `xc.js` (korelace zvuku proti zdroji po 4 s),
`vsync.js` (řada pohybu obrazu proti zdroji). Pozn.: během testu někdo přestavěl `web/dist` (13:44, `v=mwt9cf4r`) –
nálezy jsem ověřil proti aktuálnímu zdroji (`git status`: změněné jen renderer/project-panel/lang/index.html, dotčené
řádky beze změny).

**Verdikt:** základní cesta funguje a je rychlá – import 28min (449 MB) 1,7 s, přehrávání, Ctrl+K / žiletka /
Shift+Delete / Ctrl+Z / Ctrl+Y přesně, výřez 9:16 přes MediaPipe pod novou CSP bez jediné violation (5 min / 20 záběrů
za 19 s, obličej ve 20/20), titulky z přepisu, export 21 s 9:16 za 5,3 s a 3:41 16:9 za 35 s se **sync 0 ms / 0 snímků**.
XSS přes název souboru i text titulku/nadpisu nic nespustí (escapování drží, CSP ani nemusela zasáhnout).
**Ale tři věci uživatele zaseknou nebo připraví o práci:** nová CSP zablokovala přepis řeči v prohlížeči, delší
export (> ~20 min) spadne až na úplném konci, a web nikdy neobnoví automatickou zálohu (ani při „Pracovat tady“).

## Tři nejdůležitější nálezy
1. **Přepis řeči v prohlížeči nefunguje – blokuje ho nová CSP (3).** Po importu (auto přepis zapnutý) se worker
   `whisper-worker.js` nespustí: `Creating a worker from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'
   violates the following Content Security Policy directive: "worker-src 'self' blob:"` (Log source `security`,
   `Network.loadingFailed blocked: csp`). Statický `import` z jsdelivr v modulovém workeru Chrome kontroluje proti
   `worker-src` a ta jsdelivr nepouští (`web/build.js:136-137`, WEB_CSP). Uživatel vidí jen **„Přepis se nepodařil. Při
   rozpoznávání řeči se něco pokazilo.“** + „Zkusit znovu“ (stejný výsledek) → bez přepisu nejde Přepis, Titulky
   z přepisu ani AI střih. Stalo se ještě **před** stahováním modelu (HF požadavek žádný). `shots-web/02-import.png`.
   Kroky: čistý profil → Importovat video → panel Přepis.
2. **Export delší sekvence (28 min) spadne po 4,5 min na „✖ Maximum call stack size exceeded“ (3).** Celé video se
   zakóduje a pak `Mp4Writer.finish → trak → full(...)` přetečou: `web/engine/mp4-writer.js:112-117` předává každý
   vzorek jako argument (`full('stsz', …, ...t.sizes.map(u32))`, stejně `stts`, `co64`, `stss`). Změřeno v téže
   stránce: limit ≈ **61 800 argumentů** = Opus (50 rámců/s) ~**20,6 min** zvuku, AAC (~47/s) ~22 min, obraz 25 fps ~41 min.
   Hláška anglicky a nesrozumitelná, na disku zůstane **prázdný 0B .mp4** (OPFS `s14-ui-rozhovor-28min 2.mp4` = 0 B).
   Přes dialog Export: 278 s → `✖ Maximum call stack size exceeded` (`shots-web/22-export-28min-stack.png`); totéž
   `__pzDevExport` (stack `full@mp4-writer → trak → finish → exportSequence`). 3:41 prošel (11 063 rámců).
3. **Web nikdy neobnoví automatickou zálohu – zavření/obnovení karty = ztracená neuložená práce (3).** `src/renderer.js`
   `start()` má od S12 (b93b6f1) `if (!media.WEB && fs.existsSync(AUTOSAVE))` → na webu se záloha z localStorage
   nečte, přestože ji `web-glue.js` při `pagehide` i průběžně zapisuje. Před S12 se „Recovered an unsaved project“
   na webu obnovovalo. Živě: import + sekvence (neuloženo, záloha v localStorage má 1 sekvenci) → reload → potvrzení
   „Opustit“ → prázdný projekt „Bez názvu“, bez hlášky (`13-reload-neulozeny-projekt.png`). **Stejně „Pracovat tady“
   ve druhé kartě** (README: „převzetím si načte poslední stav“): nová karta po převzetí prázdná (0 sekvencí), původní
   karta (1 sekvence) mezitím přestala ukládat a ukazuje lištu „Úpravy tady se neukládají“ (`14-druha-karta.png`,
   `15-pracovat-tady.png`) – práce zůstane jen v kartě, která o ní tvrdí, že se neukládá.

## Všechny nálezy
| # | Záv. | Nález | Důkaz / kroky |
|---|---|---|---|
| 1 | 3 | CSP `worker-src 'self' blob:` blokuje import transformers.js ve whisper workeru → přepis nikdy nezačne, hláška obecná „něco se pokazilo“ | log `security`, `blocked: csp`; `02-import.png` |
| 2 | 3 | Export > ~20 min (Opus) spadne na konci: spread argumentů v `mp4-writer.js:110-117`, anglická hláška, 0B soubor | `22-export-28min-stack.png`, měření limitu 61 784 arg. |
| 3 | 3 | Autosave se na webu neobnoví (`!media.WEB` v `start()`), ani po „Pracovat tady“ | `13-…`, `14-…`, `15-…png` |
| 4 | 2 | AI panel `ai-web.html` (stejný origin, iframe) **nemá žádnou CSP** (meta ani `_headers`): vložené `<img onerror>` v něm proběhne (`probeRan: 1`) a má `parent.TN`; v hlavním okně totéž zablokováno (`0`). Dnes bez známého sinku (jen statické `html:`), ale obrana do hloubky z S13 N1 tu chybí | probe přes CDP, `21-ai-panel.png` |
| 5 | 1 | Po znovupřipojení média (import stejného souboru) zůstane lišta „Nenalezená média: 1 – naimportuj je znovu“, i když `missing:false` a video hraje | `17-znovu-pripojeno.png` |
| 6 | 1 | Název souboru s textem `&lt;b&gt;` se v klipu na časové ose a v hlavičce Exportu ukáže jako `<b>` (escapuje se jen `<`, ne `&`) – kosmetické, nic se nespustí | `18-xss-nazev.png`, `20-export-dialog.png` |

## Ověřeno bez nálezu
- Úvodní obrazovka „Začni tady“, čeština, žádná chyba v konzoli při startu (`01-uvod.png`).
- Přehrávání: Mezerník v aktivním monitoru, 4 s → playhead +4,1 s, video `in + playhead` ±0,02 s, 0 ztracených snímků.
- Střih klávesami: Ctrl+K na 5 s, žiletka (C + klik) na 11,96 s, výběr + Shift+Delete (ripple), 3× Ctrl+Z zpět
  na 1 klip 21,40 s, Ctrl+Y znovu (`06-…`, `07-…png`).
- Výřez 9:16 (MediaPipe z jsdelivr + model ze storage.googleapis.com) bez CSP violation; 21 s: 3 s, 5 min: 19 s, 20/20
  záběrů s obličejem (`08-reframe-916.png`, export `11-export-916-snimky.png` – obličej v záběru ve všech 6 vzorcích).
- Titulky z přepisu (12 ks, karaoke), vypálené do exportu.
- Export 9:16 21,4 s: 1080×1920, 25 fps, 535 snímků, zvuk 21,42 s, **A/V 0 ms, obraz 0 snímků**; 3:41 16:9:
  5531 snímků, zvuk 0 ms ve všech 10 úsecích, obraz 0 snímků (r = 1,000). `web/test-out/web-s14-*.mp4`.
- Uložit (Ctrl+S → dialog) a Otevřít projekt: sekvence, titulky, posun výřezu `posX` zachované; média bez handle
  hlášena jako nenalezená, opětovný import je připojí (žádný duplikát).
- XSS: název `x"'><img onerror…><svg onload…>.mp4` v panelu Projekt, monitorech, záložce, časové ose, Přepisu,
  Exportu – `__xss: 0`, žádný `<img src=x>` v DOM, **0 CSP violation** (escapování, ne CSP). Text titulku a nadpisu
  s `<img onerror>`/`<script>` se v panelu Titulky, na časové ose i v monitoru vykreslí jako text.
- Dvě karty: druhá karta okamžitě ukáže lištu „PZ AI Cut je otevřený v jiné kartě…“ (BroadcastChannel funguje).
- Výkon: import 28 min 1,7 s; skok playheadu ~17 ms; překreslení časové osy 2 ms; přepis 450 vět se načte hned.
  Paměť Chrome celkem: klid ~0,9 GB, export 3:41 špička 1,4 GB, export 28 min roste lineárně 1,3 → 2,0 GB (renderer
  0,54 → 1,03 GB za 4,5 min) – na 8GB notebooku na hraně, ale nespadl na paměť.

## Rozdíly proti desktopu, které překvapí
- Bez automatické zálohy a bez otevření posledního projektu po startu (viz #3) – desktop obojí umí.
- Zvuk exportu Opus na Windows N (známé, odložené v `team/log.md:598`; okno Exportu to říká).
- Po znovuotevření projektu je třeba média znovu povolit / naimportovat (očekávané pro web, hláška srozumitelná).

Pomůcky: `shots-web/drv.js`, `c.js`, `xc.js`, `vsync.js`. Instance zastavena (Chrome 9386, server 8796 PID 18636,
profil smazán).

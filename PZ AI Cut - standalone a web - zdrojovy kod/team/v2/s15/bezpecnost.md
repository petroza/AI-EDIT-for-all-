# S15 – Bezpečnost (ověření oprav S14: c5d8fb1, 08dee72, 1a02a25 + hledání obejití)

Instance 9376 (`--size 1366x768 --lang cs`, **bez --ai**, profil `%TEMP%\pz-s15-bezpecnost`, auto přepis vypnut `__pzASR.setAuto(false)`,
testovací média bez řeči → Worker ani GPU nedotčeny). Web: `node web/build.js` (`app.js?v=mwtajdx6`) + `node web/serve.js 8798`,
headless Chrome CDP 9396, profil `%TEMP%\pz-s15-bez-web`, konektory 7895–7897 a huggingface/hf.co zablokované v síti (20 pokusů `/hello`
zablokováno, model se nestahoval). Síť sledována jen proti **127.0.0.1**: `smbmon.js` (netstat, nová spojení na :445 s časem) a
`httpmon.js` (HTTP posluchač 127.0.0.1:8899). Volání `fs.*`/`spawn` v rendereru zachytával `fstrace.js` (čas + zásobník).
Pomůcky místo systémových dialogů: Soubor → Otevřít projekt přes skutečný `openProjectDialog` s náhradou `ipcRenderer.invoke('dialog','open')`;
dotaz „Připojit / Nepřipojovat“ automaticky zodpovězen **Nepřipojovat** (čas zapsán). Export: dialog Export (pole `#exOut` + Exportovat)
a MCP `exportSequence` přes `TN.evalScript('PMCP.call(…)')` (stejná cesta jako most). Vše ukončeno, dočasné složky smazány.
PoC: `s15/shots-bezpecnost/` (`*.js`, `*.pzcut*` – gitignore): `export-bypass.js`, `mkunc.js`, `netrun.js`, `netcase.js`, `fstrace.js`,
`smbmon.js`, `httpmon.js`, `webcsp.js`; důkazy `net-results.pzcut.jsonl`, `smb.pzcut.log`, `http.pzcut.log`, `webcsp-result.pzcut.json`.

## Verdikt
**Nevyhovuje.** Ochrana proti připojení k síťovému serveru z cizího projektu (S13 → S14 „označí offline PŘED načtením“) **nefunguje
vůbec**: oprava c5d8fb1 přidala do `sanitize.js` mazání `uncBlocked`, a protože `project.load` sanituje až po označení, značka se smaže
dřív, než ji `relink` přečte. Výsledek: **každý** zápis síťové cesty (i obyčejné `\\server\share`) se připojí ~0,1 s po otevření,
**dřív než se objeví dotaz**, a znovu při každém překreslení panelu Přepis **i po „Nepřipojovat“** a při každém startu (obnova zálohy).
Zápisy, které `netHost` nepozná (řídicí znak na začátku, `file:`, protokoly ffmpeg, `\\.\C:\..\UNC\`, `http://`), se připojí úplně bez
dotazu včetně náhledu, průběhu zvuku a `<video>`. Export: všechna zadaná obejití (bez přípony, ProRes do .mp4, 8.3, pevný odkaz, junction,
`\\?\`, `\\.\`, velikost písmen, `::$DATA`, koncová mezera) jsou **zavřená**, ale nová kolize přes dočasný soubor `.pzpart` zdroj zničí.
Web je v pořádku: jedna CSP, inline handler a `javascript:` zablokované v hlavním okně i v AI panelu, whisper worker se načte, běžná práce bez violation.

## Tři nejdůležitější nálezy
1. **(3) Otevření cizího `.pzcut` s `\\server\…` pošle přihlašovací hash i přes opravu – před dotazem i po „Nepřipojovat“.**
   `renderer.js:1652` nastaví `m.uncBlocked = true`, pak `project.load` → `model.js:238` `sanitizeProject` → `sanitize.js:73`
   `delete m.uncBlocked` → `importer.js:49` značku nevidí → `importer.js:50` `fs.existsSync('\\127.0.0.1\pzs15\a.mp4')`.
   Navíc `asr-desktop.js:16/66` (`fileOf` → `fs.statSync(m.path)`) z `transcript-panel.js:128 paintTab` nehlídá `missing` – volá se při
   každém překreslení. Živě (`netcase.js A_unc`): t0 13:12:57.896 → `existsSync` .899 (relink) a `statSync` .910 (asr) → **SMB spojení
   127.0.0.1:445 v 13:12:57.995** → dotaz až 13:12:58.201. Po „Nepřipojovat“ a zániku spojení stačí překreslit panely: 13:15:56.941 `statSync`
   (asr) → **nové SMB 13:15:56.977**. Totéž `//`, `/\`, `\\?\UNC\`, `\\?\GLOBALROOT\Device\Mup\` (vše SMB před dotazem; `\??\UNC\` Node neotevře).
   Obnova zálohy: `autosave.tnproj` s médiem `\\127.0.0.1\…` → start aplikace → **SMB 13:16:51.435** (start 13:16:50.9), dotaz až potom.
2. **(3) Zápisy, které `netHost` nepozná, se připojí bez jakéhokoli dotazu – náhled, průběh zvuku i `<video>` hned při otevření.**
   `netHost` běží na **syrových** datech (`renderer.js:1650`), ale aplikace pak používá **sanitizovanou** cestu: `sanitize.js` maže řídicí znaky
   (`CTRL`), takže `"\u0001\\127.0.0.1\pzs15\a.mp4"` projde jako místní a po sanitizaci je z ní UNC. `missing:false, playable:true` ze souboru
   zůstávají → handler `media`/`active` uvnitř `project.load` spustí `media.thumbnail` (`hashOf` → `fs.statSync`) + ffmpeg, `loadWave` + ffmpeg,
   `reframe.js:426` `statSync` a `<video src="file://127.0.0.1/pzs15/a.mp4">` – vše před `relink`. Živě bez dotazu se SMB: `J_ctrlchar`,
   `O_ctrl_fwd` (`\u0002//…`), `I_fileproto` (`file:\\127.0.0.1\…` – ffmpeg protokol file:), `H_fileurl` (`file://127.0.0.1/…`), `M_concat`
   (`concat:\\…`), `N_subfile` (`subfile,,…,:\\…`), `L_devtraverse` (`\\.\C:\..\UNC\127.0.0.1\…` – `netHost` ho bere jako místní `\\.\C:\`).
   `K_http` (`http://127.0.0.1:8899/k.mp4`): **2× `GET /k.mp4 UA=Lavf/63.1.102`** (náhled + průběh) – cizí server se dozví IP a čas otevření
   a podstrčí ffmpegu libovolný formát. Časy v `net-results.pzcut.jsonl` / `smb.pzcut.log` / `http.pzcut.log`.
3. **(2) Export zničí zdrojové médium, když se jmenuje jako dočasný soubor exportu (`<cíl>.pzpart.mp4`).**
   `exporter.js:225` skládá `part = final − přípona + '.pzpart' + přípona` a kontroluje jen `final`. Zdroj `out.pzpart.mp4` (10 s) v projektu,
   export do `out.mp4` → ffmpeg `-y` zapíše do zdroje, `renameSync(part, final)` ho přesune → **zdroj zmizel**, `out.mp4` = 2s export.
   Ověřeno přes MCP (`export-bypass.js`, poslední případ) i **přes dialog Export** (`out2.pzpart.mp4` → `out2.mp4`, „✔ Hotovo“,
   `01-dialog-pzpart.png`); projekt dál hlásí médium `missing:false`. Při chybě/zrušení exportu `catch` zdroj rovnou smaže (`exporter.js:245` `rmSync(part)`, kódem).

## Stav oprav S14
| Oprava S14 | Stav | Důkaz |
|---|---|---|
| Export bez přípony / ProRes do `.mp4` | **opraveno** | „Výstup by přepsal zdrojové médium rozhovor.mp4 / b.mov“ (MCP i `outputPathFor`) |
| 8.3 `ROZHOV~1.MP4` i `ROZHOV~1`, pevný odkaz `mklink /H`, junction `jn2\rozhovor.mp4`, `\\?\C:\…`, `\\.\C:\…`, `ROZHOVOR.MP4`, `rozhovor.mp4 ` (mezera), `rozhovor.mp4::$DATA` | **opraveno** | vše odmítnuto `sameFile` (dev+ino), md5 zdrojů beze změny |
| `rozhovor.mp4.` / `rozhovor.mp4. ` | bez přepisu | vznikne `rozhovor.mp4..mp4` / `rozhovor.mp4.mp4`, zdroj netknutý |
| Symbolický odkaz | neověřeno | `New-Item SymbolicLink` vyžaduje admina; `statSync` odkaz následuje (kódem by se odmítl), `rename` nahradí odkaz, ne cíl |
| Síťová média offline PŘED načtením, `netHost` všechny zápisy UNC | **neopraveno** | nálezy 1 a 2 – SMB před dotazem i po „Nepřipojovat“ |
| `playPath` nic neotevře u offline | jen pro `missing` z `netHost` | u nepoznaných zápisů `<video src=file://127.0.0.1/…>` vznikl (nález 2) |
| `uncBlocked` se neukládá | opraveno příliš | maže se i uprostřed otevírání (nález 1) |
| Web: CSP i při CRLF, právě jedna | **opraveno** | dist 1 CSP; simulace CRLF → 0 desktopových CSP po odstranění, pojistka `!== 1` hodí chybu |
| Web: worker-src jsdelivr – přepis | **opraveno** | `new Worker('whisper-worker.js',{type:'module'})` načte `@huggingface/transformers@3.8.1`, `onerror` null, 0 violation |
| AI panel webu vlastní CSP | **opraveno** | `ai-web.html` 1 meta CSP; vložený `<img onerror>` → `iframe:0, parent:0`, `javascript:` → 0; violation zapsána |
| Worker: token porovnán jako bajty | **opraveno** | `worker/server.py:184` `compare_digest(…encode('utf-8','surrogateescape'))` |
| `PZ_WORKER_APPDATA` | bez nálezu | jen čtení tokenu ze skutečného profilu; pozn.: test. instance teď dosáhne na Worker i bez `--ai` (popis v STANDALONE.md už neplatí); kopie tokenu v TEMP: 9 starých (S12: 115) |
| `installFfmpeg` (winget) | bez nálezu | pevný příkaz bez vstupu, `shell:false`, nedostupné z mostu/MCP; libuv nehledá `.exe` v pracovní složce (ověřeno podvrženým `ffprobe.exe` v cwd – spustil se ten z PATH) |
| `ai-missing.html` | bez nálezu | CSP `default-src 'none'; script-src 'self'`, statický obsah, jediný odkaz https na GitHub |

## Nálezy
| # | Záv. | Co | Reprodukce | Návrh |
|---|---|---|---|---|
| 1 | 3 | Síťová cesta z `.pzcut` / zálohy: SMB (hash NTLM) před dotazem, po „Nepřipojovat“ při každém překreslení a při každém startu | `node mkunc.js <složka>` → `net-A_unc.pzcut` (`\\127.0.0.1\pzs15\a.mp4`, `missing:false`); v instanci `await require('<…>/netcase.js')(TN,'A_unc')`, souběžně `node smbmon.js log`. Viz nález 1 výše (časy). | Smazat `sanitize.js:73` (čerstvý výpočet už dělá `renderer.js:1648`), nebo blokované id držet mimo objekt média (Set předaný `relink`). `asr-desktop.js fileOf`/`status` a `transcripts.forMedia` nevolat pro `m.missing \|\| m.uncBlocked`. Test do sady: po `loadProjectFile` s UNC nesmí proběhnout žádné `fs.*` na tu cestu. |
| 2 | 3 | Nepoznané zápisy síťové cesty → bez dotazu, náhled/průběh/`<video>` | `net-J_ctrlchar`, `O_ctrl_fwd`, `I_fileproto`, `H_fileurl`, `M_concat`, `N_subfile`, `L_devtraverse` → SMB 127.0.0.1:445 do 0,2 s, žádný dotaz (`net-results.pzcut.jsonl`, `fstrace`: `media.js:177/187` spawn ffmpeg, `player` `<video>`). | `netHost` volat až na **sanitizovaných** datech (nejdřív `sanitizeProject`, pak značení, pak `load`). Povolit jen místní: `path.toNamespacedPath(path.resolve(p))` musí odpovídat `^\\\\\?\\[A-Za-z]:\\` a vstup nesmí začínat `\\.\`/`\\?\` ani obsahovat `:` mimo písmeno disku (protokoly, ADS); vše ostatní = síť/neznámé → offline + dotaz. `missing`/`playable` ze souboru nepřebírat (přepočítat v `relink`), náhledy až po `relink`. |
| 3 | 2 | `http://…` (a další protokoly ffmpeg) jako cesta média → ffmpeg stahuje z cizího serveru | `net-K_http.pzcut` (`http://127.0.0.1:8899/k.mp4`) → `http.pzcut.log`: 2× GET `/k.mp4` `Lavf/63.1.102`, bez dotazu. | Všem vstupům z projektu dávat ffmpeg/ffprobe `-protocol_whitelist file,pipe` a cestu předávat jako `file:` + ověřená absolutní místní cesta (ffmpeg pak nikdy nevyloží `concat:`, `subfile:`, `http:`). |
| 4 | 2 | Kolize s dočasným souborem `.pzpart` zničí zdroj (export i zrušení) | Zdroj `out.pzpart.mp4` v projektu, export do `out.mp4` (dialog Export i MCP) → zdroj pryč (`01-dialog-pzpart.png`). | `sameFile` kontrolovat i proti `part` (a `.srt`), nebo `part` s náhodnou příponou (`.pzpart-<8 hex>.mp4`) a `wx` (nevytvořit, když existuje); v `catch` mazat jen soubor, který export sám vytvořil. |
| 5 | 2 | Dialog Export: jméno bez přípony přepíše existující soubor bez dotazu „Nahradit?“ | Existující `stary-export.mp4` (mimo projekt), do pole napsat `…\stary-export` → Exportovat → „✔ Hotovo“, md5 376c22… → b039da… bez dotazu. `renderer.js:1514` `fs.existsSync(out)` kontroluje nenormalizované jméno. | Před dotazem cestu normalizovat stejně jako exportér (exportovat `outputPathFor`), opravenou cestu vrátit do pole. |
| 6 | 2 | MCP `export_sequence` přepíše libovolné existující video bez varování (zbytek S12 #4) | `PMCP.call("exportSequence",{output:"…\\jine-video-uzivatele.mp4"})` → `ok`, md5 376c22… → bb9536…; agent ovlivnitelný textem přepisu tak smaže cizí video. | Existující cíl odmítnout bez `overwrite:true` (nebo číslovat `(1)`), případně povolit jen složku projektu / Videa / exportDir. |
| 7 | 1 | Výstup do alternativního datového proudu / s `file:` → surová anglická chyba, ffmpeg zapisuje do proudu zdroje | `output: …\rozhovor.mp4:x.mp4` → „EINVAL: invalid argument, rename …“ (zdroj: hlavní data beze změny, změnilo se mtime – zapsán proud `:x.pzpart.mp4`, pak smazán); `file:C:/…/rozhovor.mp4` → „ENOENT … mkdir 'O:\…\file:C:\…'“. | Odmítnout výstup s `:` mimo písmeno disku srozumitelnou českou hláškou dřív, než ffmpeg začne. |
| 8 | 1 | Web jde zarámovat cizí stránkou (clickjacking) | Karta `data:text/html,<iframe src="http://127.0.0.1:8798/">` → aplikace se v rámu načetla (`iframe http://127.0.0.1:8798/`, bez hlášky frame-ancestors). `web/static/_headers` nemá CSP ani `X-Frame-Options`; meta CSP `frame-ancestors` neumí. | Do `_headers`: `Content-Security-Policy: frame-ancestors 'none'` (ideálně celá webová CSP hlavičkou) + `X-Frame-Options: DENY`. |

## Ověřeno bez nálezu
- Web 8798: po načtení **0 violation**, `index.html` i `ai-web.html` právě 1 CSP; import 5min videa, sekvence přes most, přehrávání → 0 violation,
  0 výjimek; jediné vnější požadavky: `cdn.jsdelivr.net/…/transformers@3.8.1` (worker) a zablokované `127.0.0.1:7895–7897/hello`.
- Export: obejití ze zadání (viz tabulka) zavřená; `\\.\pipe\…` jako médium = offline bez dotazu a bez spojení; `\??\UNC\…` Node ani ffmpeg neotevřou.
- `installFfmpeg`, `ai-missing.html`, `PZ_WORKER_APPDATA` – bez zneužitelného vstupu.

## Doporučené pořadí oprav
1. #1 + #2 společně (jedna funkce „je místní?“ až po sanitizaci, `missing/playable` přepočítat, asr `fileOf` hlídat `missing`) – test do sady s `fstrace`-podobným hlídáním `fs.*`.
2. #3 `-protocol_whitelist` pro všechna ffmpeg/ffprobe volání nad cestami z projektu.
3. #4 jedinečný `.pzpart`, #5 normalizace v dialogu, #6 `overwrite` v MCP.
4. #7, #8 drobnosti.

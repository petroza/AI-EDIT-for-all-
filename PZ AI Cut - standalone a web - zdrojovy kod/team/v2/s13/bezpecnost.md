# S13 – Bezpečnost (ověření oprav po S12 + hledání obejití)

Instance 9376 (`--size 1366x768 --lang cs --ai`, profil `%TEMP%\pz-s13-bezpecnost`), ovládání přes `test/cdp.js eval`
(payloady jen neškodné – nastaví proměnnou, nesahají na fs/require/síť). Konektor testován na vlastní kopii na portu 7899
(nikdy proti 7895 uživatele). Pomůcky: `shots-bezpecnost/conn-residual-s13.js`, `csp-probe-s13.js` (gitignore). Instance zastavena.

## Verdikt
**Hlavní díra ze S12 (podvržený `.pzcut` → RCE) je zavřená.** Obrana je dvouvrstvá a obě vrstvy jsem ověřil živě:
(1) `sanitize.js` při `load()` normalizuje čísla/id/výčty/barvy, zahodí `thumbUrl` a klíče pro prototype pollution;
(2) **CSP `script-src 'self'` prokazatelně zastaví spuštění** i tam, kde se escapovat zapomnělo – v hlavním okně
i v AI panelu (iframe s Node) se vložený `onerror` ani `javascript:` nespustí (`probeRan:0`, vyletí securitypolicyviolation).
Navigace okna i `window.open` na cizí stránku jsou zablokované. Běžný provoz (import, sekvence, výřez podle obličeje přes
MediaPipe) **neudělal jedinou CSP violation** – nic se nerozbilo.

**Ale tři nálezy ze S12 jsou opravené jen částečně** a zůstávají reálné: konektor webu pořád nemá token (lokální proces
převezme úkol Clauda), média z `.pzcut` se při otevření sondují `fs.existsSync` i na UNC cestu (únik NTLM), a webová verze
jde do distribuce úplně bez CSP (jediná obrana je escapování).

## Tabulka stavu nálezů S12

| # | Záv. | Nález S12 | Stav | Důkaz |
|---|---|---|---|---|
| 1 | 3 | XSS→RCE z `.pzcut` (atributy, čísla, thumbUrl) | **opraveno** | `sanitize.js` (test prošel: čísla→Number, id `SAFE_ID`, přechod z výčtu, `thumbUrl`/`constructor` pryč). Sinky buď `esc()` (project-panel, transcript, caption-list), jen-`<`-escape v textovém uzlu (timeline `clipHtml` ř. 219, caption ř. 248), nebo omezený typ. **CSP backstop živě**: hlavní okno `probeRan:0 / 2 violations`, AI panel `probeRan:0 / 1 violation` (`csp-probe-s13.js`). Overlay titulku/nadpisu v monitoru přes `textContent` (`player.js:311,330-347`). |
| 2 | 3 | Electron bez izolace, bez hlídání navigace | **opraveno** (útočné cesty) | `main.js:80-98`: `will-navigate`/`will-frame-navigate`/`will-redirect`/`setWindowOpenHandler`/`will-attach-webview`. Živě: `window.open('https://…')→null`, `location.href='https://…'` **nenavigovalo** (zůstalo `file:`). ⚠ `contextIsolation:false`/`nodeIntegration:true` **trvá** – obrana je jen blokace navigace + CSP, ne skutečná izolace (viz nový nález N4). |
| 3 | 2 | Konektor webu věří jen Origin | **⚠ částečně** | `connector/server/index.js:103-106` přidán jen Host (DNS rebinding z prohlížeče zavřen), **token nepřibyl**. Živě (port 7899): forged `Origin: https://pz-ai-cut.pages.dev` + `Host: localhost` → **HTTP 200**; `evil.test` Origin → 403; nelokální Host → 403. Lokální proces pořád převezme `/next` a podvrhne `/result`. (`conn-residual-s13.js`) |
| 4 | 2 | MCP export přepíše zdrojové video | **opraveno** | `exporter.js:216-219`. Živě: export na cestu zdroje → `The output would overwrite the source media vyrez-5min.mp4 – choose another file name.` (platí pro menu i MCP most). |
| 5 | 2 | `export_analysis` libovolná přípona | **opraveno** (zbytek lokace) | `server/index.js:2193-2195`: `.cmd`→`.cmd.md` (jen `.md`/`.txt`). ⚠ cílová **složka pořád neomezená** (`path.resolve(output)` – zapíše `.md` kamkoli, i do složky po spuštění). Minor. |
| 6 | 2 | Prompt injection z přepisu → nástroje/`run_extendscript` | **neřešeno** | Beze změny v kódu (`server/index.js` `run_extendscript` bez potvrzení). Týká se AI agenta v Premiere, mimo jádro standalonu; standalone `/eval` zůstává omezené na `PMCP.call` (ověřeno S12). |
| 7 | 2 | Cesty médií z `.pzcut` (UNC → NTLM, dim→ffmpeg filtr) | **⚠ částečně** | **Dim injekce opravena** (`width/height` v `NUM` → vždy číslo). **UNC cesta ne**: `sanitize.js` klíč `path` nehlídá – živě `\\HOST\share\x.mp4` přežil `load()` doslova; `loadProjectFile`→`importer.relink` (`renderer.js:1532`→`importer.js:48`) volá `fs.existsSync(m.path)` na všechna média hned při otevření = SMB/NTLM (živě neprobíháno – cizí host). |
| 8 | 2 | Web: název souboru s `"` → XSS | **opraveno** (escapováním) | `renderer.js:402` záložka `escH()`, project-panel `esc(name)`. ⚠ web nemá CSP backstop (nový nález N1) – obrana stojí jen na escapování; v prohlížeči bez Node max. krádež IndexedDB/konektor. |
| 9 | 1 | `web/serve.js` bez Host/Origin (dev) | **opraveno** (zbytek prefix) | `serve.js:14-20` Host + Origin. ⚠ `/devfile` pořád `startsWith` (ř. 35) → sourozenec `Downloads*` projde; dev-only. |
| 10 | 1 | Token: porovnání ne v konst. čase | **⚠ částečně** | Worker `worker/server.py:183` `hmac.compare_digest` ✔. **Most AI panelu `src/ai/main.js:394` pořád `!==`** (časový side-channel; útočník je ale už lokální proces, který token stejně přečte). |
| 11 | 1 | Titulky ASS/SRT injekce | **opraveno** | ASS `exporter.js:417,446` odstraní `{…}`/`{}`; SRT `:176` sloučí prázdné řádky. |
| 12 | 1 | Most: `fn` z prototypu | **opraveno** | `renderer.js:1623` `Object.prototype.hasOwnProperty.call(api,name) && typeof==='function'`. |
| 13 | 1 | Web model z CDN bez SRI | **neřešeno** | `web/static/whisper-worker.js:4` jsdelivr bez integrity (verze připnutá). |

## Nové nálezy (hledání obejití)

| # | Záv. | Nález | Důkaz (kód + reprodukce) | Návrh opravy |
|---|---|---|---|---|
| N1 | 2 | **Webová distribuce jde ven úplně bez CSP** – desktopová obrana (CSP jako záchrana při zapomenutém escapování) na webu chybí. `web/build.js:133` CSP meta vystřihne a žádnou webovou nevloží; `web/serve.js` CSP hlavičku neposílá. V prohlížeči není Node, takže ne RCE, ale jakýkoli přehlédnutý sink = XSS → IndexedDB `pz-ai-cut-transcripts`, projekt v localStorage, a převzetí konektoru jménem stránky (viz #3). | `build.js:133` smaže `<meta CSP>`; dist index.html pak bez CSP. | Vložit do webového buildu vlastní CSP (bez `file:`/Node): `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`, nebo ji poslat hlavičkou v produkci (Pages `_headers`). |
| N2 | 1 | **`script-src` pouští celý `cdn.jsdelivr.net` + `'wasm-unsafe-eval'`** – široká výjimka. Sama o sobě bez skriptového footholdu nejde zneužít (vložený `<script src=jsdelivr>` se přes innerHTML nespustí), ale při jakékoli budoucí XSS by útočník načetl libovolný npm balík. | `src/index.html:6`, `tools/sync-ai-panel.js` (CSP), `web/ai/reframe.js` MediaPipe. | Připnout jen konkrétní cesty MediaPipe (`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/`) nebo MediaPipe přibalit lokálně a jsdelivr ze `script-src` vyhodit. |
| N3 | 1 | **AI panel (iframe) po zablokované cizí navigaci spadne do `chrome-error://`** místo aby zůstal na své stránce (hlavní okno zůstává správně). Cizí stránka se **nenačetla** (žádný Node útočníkovi), ale panel je pak rozbitý a chce reload. | Živě: `aiFrame.contentWindow.location.href='https://example.com/'` → `will-frame-navigate` preventiva, ale frame skončil na `chrome-error://chromewebdata/` (hlavní okno naproti tomu `location` nezměnil). | Po `will-frame-navigate` preventDefault panel obnovit (reload na `ai/index.html`), nebo nechat `sandbox`/preload bez Node a tím i error stav zneškodnit. Robustnost, ne RCE. |

## Co je ověřeno jako v pořádku
- CSP živě zastaví inline handler i `javascript:` v hlavním okně i v AI panelu (`probeRan:0`), běžný provoz bez violation.
- Navigace okna i `window.open` na cizí stránku blokované; zůstává `file:` v adresáři aplikace; `shell.openExternal` jen `https://`.
- Export na cestu zdroje odmítnut; `export_analysis` vynutí `.md`/`.txt`; ASS/SRT bez značek; most `hasOwnProperty`.
- Sanitize test v sadě prošel (38/0); prototype pollution `__proto__`/`constructor` neznečistí `Object.prototype`.
- Žádný href/src/action sink s hodnotou z projektu (jediný `player.js:120 el.src` = blob/file médium pro přehrávání).
- MediaPipe (jsdelivr + storage.googleapis.com model) se pod CSP načte bez violation – výřez podle obličeje funguje.

## Doporučené pořadí oprav
1. #3 konektor – párovací token `X-PZ-Token` (jediná reálná sev2, lokální proces převezme Clauda).
2. #7 UNC – v `sanitize`/`relink` odmítnout/zeptat se na UNC (`\\`) a zařízení (`\\.\`), nebo `existsSync` nevolat na síťové cesty při otevření.
3. N1 – webová CSP.
4. Drobnosti: #5 lokace, #9 `path.relative`, #10 most `timingSafeEqual`, #13 SRI, N2, N3.

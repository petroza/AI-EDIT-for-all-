# Kolo S11 – Kontrolor výstupu: regrese proti S10 a ověření oprav (HEAD 72430ec)

**Verdikt: NEPOUŠTĚT bez opravy titulků (nález 1).**

Opravy z 1ff0463 / 7e28b46 / dbdac66 z velké části fungují:
- propojení obrazu se zvukem i po `api.reframeSequence` je opravené (0 osiřelých kusů),
- zdvojené slovo „rádiu.“ zmizelo,
- 16:9 po úklidu krajů má titulek „Všechno“ od 7,36 s,
- nadpis vypnutý přepínačem se nevypálí,
- zvuk všech 41 opakovaných exportů je bitově shodný se S10.

Titulky z dialogu **po výřezu** se ale dál ořezávají na neviditelných řezech zvuku. Protože se teď zvuk rozřízne i v cestě `api.reframeSequence`, chyba se rozšířila na sekvence, které byly v S10 v pořádku.

## Nálezy

| # | záv. | nález | důkaz | S10 → S11 |
|---|---|---|---|---|
| 1 | **3** | **Titulky z dialogu Titulky z přepisu po výřezu končí na řezu zvuku, ne na konci věty.**<br>Slova už přicházejí po celých úsecích (`seqWords` = `audioRuns`). Konec titulku ale dál ořezává `makeCaptions` (`src/renderer.js:1878`) na konec **kusu** zvuku (`atr.clips`), ne úseku. Platí pro obě cesty výřezu (API i menu `__pzReframe`).<br>**Nově rozbité** (v S10 OK – tam `api.reframeSequence` zvuk nedělil):<br>• `a11`: „Takže to přišlo úplně, / jak my jsme se rozvěděli,“ **3,13–3,48 (0,35 s)**, řeč do 5,15 → 1,54 s bez titulku; „…strašně, / strašně pozdě.“ končí 1,36, řeč do 2,65,<br>• `a916`/`a916m`: „věc v mým / životě.“ **14,82–15,12 (0,30 s)**, řeč do 16,00,<br>• `sim916`/`sim916m`/`sim11`/`razor916`: „takový ty / chlácholivý věci.“ 32,71–**33,56**, řeč do 34,35 (S10 do 34,50),<br>• `k219916`/`k21911`: „A najednou byl pryč.“ končí 1,36 místo 1,52.<br>**Dál rozbité z S10:**<br>• `multi916-cc`: „A pak jsem / začala dělat“ 45,92–46,48, **46,26–48,20 bez titulku**; „chlácholivý věci.“ jako výše,<br>• `v916`: „Takže to přišlo / úplně,“ **46,25–46,60 (0,35 s)**, 46,73–47,49 bez titulku. | `titulky-kryti.txt` (všechny sekvence S10 vs S11)<br>`titulky-po-reframu.txt`, `caps-rf2.txt`, `words2.txt`<br>Snímek `shots-vystup/05` (sim916 34,0 s a a11 4,4 s: S10 titulek, S11 nic) | **regrese rozšířena** (S10: 2 sekvence, S11: 9) |
| 2 | **3** | **Auto Reframe přes API (MCP `reframe_sequence`) rozřízne klip se zopakovaným koncem (`hold`) a výřez poskočí.**<br>`k219` (16:9, hold 0,16 s) → `k219916`/`k21911`: V1 se rozdělí na 1,36. Kus 1,36–1,52 si nechá `hold` (ukazuje zopakované snímky), ale dostane posX cizího celku (0,719 / 1,0 místo 0,309 / 0,483).<br>Poslední **4 snímky**: obličej uskočí k okraji a titulek zmizí (#1).<br>Menu Auto Reframe (`k219916m`) klip nedělí a je v pořádku (1 kus, posX 0,378, titulek do 1,52). | `hold.log`, `sekvence.json`<br>`rozdil-vs-s10.txt` (sn. 34–37 celý obraz, chyba až 79)<br>`zabery.txt` (k21911: záběr 4 sn. na 1,36)<br>Snímky `shots-vystup/01` (9:16), `04` (1:1), S10 nahoře / S11 dole | **nové** (S10: `rep` klip měl výřez sjednocený přes `syncRepeats`) |
| 3 | 2 | **Ctrl+K nebo W uvnitř zopakovaného konce ukáže 2 snímky cizího záběru.** Hold se správně zruší (konec klipu se změnil), tím se ale odkryjí zdrojové snímky cizího celku.<br>Sekvence `s11-h` (1544,40–1549,00 + 1263,60–1265,12, hold 0,16 s), kopie:<br>• `h-k-hold`: Ctrl+K na 6,04 → 5,96–6,04 **celek studia**, pak 2 sn. detailu (zopakované),<br>• `h-w`: W na 6,04 → poslední 2 sn. 5,96–6,04 **celek**.<br>Ctrl+K před hold (5,40), Delete, Shift+Delete i Zpět po W jsou čisté. | `hold2.txt`, `zabery-hold.txt`<br>`sync.txt` (kus 4,60–6,04 = zdroj posun 0)<br>Snímek `shots-vystup/02` (řádky h / h-k-hold / h-w, posledních 10 sn.) | nové (S10 `rep` klip: řez i W by ukázaly jen zopakovaný detail) |

## Ověřeno OK (oprava S10)

**(1) Titulky – část opravy funguje.**
- Zdvojené „rádiu.“ v `multi916-cc` zmizelo: 48,20–49,48, 28 → 27 titulků.
- Duplikát „strašně“ v reflow `a916` také.
- 16:9 `a`/`a1080`: „Všechno, naprosto všechno,“ 7,36–8,84 a „protože…“ 8,84–12,53 (6 titulků jako S9). `.srt` MXF stejně.
- Kde se titulky jen přeskládají z 16:9 (Auto Reframe z menu, `multi916`), je vše v pořádku.

**(2) Propojení** (`linkcheck.txt`, 35 sekvencí): **0 osiřelých kusů, 0 obrazů bez propojení.**
- `sim916`, `sim11`, `a916`, `a11`, `razor916` (API) i `*m` (menu) mají každý kus obrazu propojený se svým zvukem.
- `a`/`a916`: L-střih 7,24/7,52 (±7 sn.) zůstává propojený, osiřelý kousek A1 7,24–7,52 z S10 zmizel.
- Shift+Delete kusu 33,56–45,92 v `sim916` smaže obraz **i zvuk**. S10: zvuk zůstal (`ripple916.log`).

**(3) Hold** (`hold2.txt`):
- `h`/`k219` (16:9) ukazují zopakovaný detail. Export `k219` je **bitově shodný s S10** (tam samostatný `rep` klip).
- Delete i Shift+Delete posledního klipu: na ose nezůstane nic, délka 4,60 s.
- Ctrl+K před hold: pravý kus hold drží.
- Zpět po W hold vrátí.

**(4) Nadpis nahoře** (`title.log`, okno Text v obraze → text → přepínač Zobrazit):
- Vypnutý nadpis má `title.off = true` a pole je zašedlé.
- **H.264 `t-off` = `sim-bez` bitově**, MXF `t1080-off` obraz i zvuk (md5 proudů) = `sim1080-xdcam`.
- Zapnutý se vypálí v obou formátech (rozdíl jen v horních 20 % obrazu, 1148/1148 sn., snímek `shots-vystup/03`).
- Zpět i Znovu přepínač správně vrátí.

**Dialog Export** (jen otevřen, `shots-vystup/06`): pro XDCAM přepne hlasitost na −23 LUFS (neověřeno v S10).

## Srovnání exportů s S10 (`md5-vs-s10.txt`, `framemd5-vs-s10.txt`, `rozdil-vs-s10.txt`)
- **Bitově shodné (24):**
  - `sim`, `sim-bez`, `sim-inout`, `sim-proreshq`, `sim916-bez`, `k219`,
  - `multi`, `multi-bez`, `multi11`, `multi916`,
  - `pcm` ×4, `razor`, `razor-g`, `razormulti` + PCM ×3, `sim-pcm`, `sim916-pcm`, `razor916-pcm`,
  - `v916-bez`, `.srt` sim1080/multi1080.
- **MXF** (`a1080`, `sim1080`, `multi1080`, `sim-dnxhr`): všechny proudy framemd5 = S10, liší se jen kontejner (jako v S9/S10).
- **Liší se jen titulky** (spodní pás nebo pás 60 % u 9:16, zvuk 0 odlišných paketů):
  - `a`, `a11`, `a916`,
  - `sim916`, `sim11`, `razor916` (sn. 839–862 = 33,56–34,52, #1),
  - `multi916-cc` (sn. 1230–1237, „rádiu.“ opraveno),
  - `v916` (45,96–48,28, #1),
  - `a1080-xdcam.srt`.
- **Liší se celý obraz:** jen `k219916` a `k21911`, sn. 34–37 (#2).
- **Délky a fps** (`delky.txt`): všechny exporty jako S10 (25 fps, 16,00 / 45,92 / 50,08 / 50,36 / 1,52 s).
- **Hlasitost** (`hlasitost.txt`):
  - sítě −13,9 až −14,2 LUFS, true peak −1,5 dBFS,
  - MXF (A1+A2) −22,9 / −23,4 LUFS.
- **Cvaknutí** (`cvak.txt`): všechny řezy 0,00–1,15 (limit 1,5), včetně nových řezů zvuku 1,36 / 3,48 / 15,12 / 33,56.
- **Sync** (`sync.txt`): obraz +0 sn., zvuk 0,0 ms na všech klipech.
- **Probliknutí** (`zabery.txt`): 0 krátkých záběrů kromě `k21911` (#2) a `h-k-hold`/`h-w` (#3).

## Jak jsem testoval
- **Instance:** `node test/standalone.js start 9372 %TEMP%\pz-s11-vystup --size 1366x768 --lang cs --ai`, na konci `stop 9372`.
  - Port je volný, zbylo jen TIME_WAIT.
  - První start omylem do `%LOCALAPPDATA%\Temppz-s11-vystup`, hned jsem ho zastavil a smazal.
- **AI panel:** Claude, Codex ani Hermes jsem nespustil. Instance 9371/9373/9375 jsem nepoužil.
- **Postavení sekvencí:** skripty z S10 (`s10-`→`s11-`), přepisy z cache Workeru.
- **Nové skripty:** `hold2.js`, `title.js`, `rf2.js` (menu Auto Reframe pro `a`/`k219`/`sim`), `seqwords.js` + `titulky_kryti.py`, `fmd5.py`, `rozdil.py`, `dlg.js`.
- **Exporty:** pomůckou `exporter.exportSequence` **místo dialogu**, 54 souborů `web/test-out/vystup-s11-*`. Dialog jsem jen otevřel a prohlédl.

## Neověřeno
- MCP `add_captions` po `reframe_sequence`. Bere SRT z Premiere strany, `makeCaptions` nepoužívá.
- Whisper na střizích – zvuk všech opakovaných exportů je bitově shodný s S10.

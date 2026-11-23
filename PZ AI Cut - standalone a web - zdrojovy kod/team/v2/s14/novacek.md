# S14 – Nováček: PZ AI Cut z veřejného GitHubu (release v2026.11.23.2)

Prostředí: zip z `gh release download` → `%TEMP%\pz-s14-novacek\app`, čistý profil (APPDATA / LOCALAPPDATA / PZ_USERDATA
v `%TEMP%\pz-s14-novacek`), CDP port 9384. Běh A: PATH **bez ffmpeg** (jako čerstvé PC). Běh B: PATH jen Windows + ffmpeg
(bez node, claude, codex, python). MY Premiere MCP nenalezen (aplikace mimo repozitář, žádný root.txt). Claude/Codex/Hermes
nespuštěny – tlačítko Spustit v AI panelu nestisknuto (klasifikátor ho zablokoval, viz konec). Snímky `shots-novacek\`.

**Verdikt:** Samotná střižna je pro nováčka v pořádku – import → sekvence → 9:16 → MP4 za ~3 min bez jediné chyby.
Na čerstvém PC ale **neprojde ani import**: zip neobsahuje ffmpeg a release i rychlý start tvrdí „nic se neinstaluje“.
A aplikace bez MY Premiere MCP dává protichůdné signály: zelené „Systém připraven“, „Začni tady → Panel AI“
a nápověda se záložkou Přepis, kterou nemá.

## Tři nejdůležitější nálezy
1. **(3) Bez ffmpeg nejde importovat a hláška nováčkovi neřekne, co dělat.** Zip (136 MB, 345 MB rozbalený) má jen
   Chromium `ffmpeg.dll`, žádný `ffmpeg.exe`/`ffprobe.exe`. Import `vyrez-5min.mp4` → „Importováno: 0“ a toast
   *„Nejde importovat: vyrez-5min.mp4 (ffprobe: spawn ffprobe ENOENT – is ffmpeg installed? (config.json → ffmpeg))“*
   (napůl anglicky, technicky). Stavový řádek přitom od startu tvrdí *„Připraveno · ffmpeg: z PATH“*, i když tam není.
   Release notes: *„rozbal … a spusť … (nic se neinstaluje)“*; README zmiňuje ffmpeg jen v odstavci o sestavení ze zdrojů.
   Důkaz `02-import-bez-ffmpeg.png`, `02b-import-bez-ffmpeg-detail.png`, `01b-stav-ffmpeg-a-ai.png`.
2. **(3) Bez MY Premiere MCP aplikace slibuje AI, která nefunguje.** Toast dole *„Složka AI nenalezena (config.json → aiRoot)
   – střih funguje, AI panel ne.“* – ale AI panel současně svítí zeleně **„Systém připraven“** (patička nemá stav „AI chybí“;
   `layout.js:238` ukáže „System ready“, kdykoli text Workeru neobsahuje „neběží“), nabízí Výrok/Upoutávka/Spustit
   a karta „Začni tady“ v kroku 2 posílá na tlačítko **Panel AI**. Sekvence → Titulky → *Vytvořit titulky z přepisu* odpoví
   *„Titulky z přepisu: v této verzi přes panel AI (Titulky).“* – tedy do panelu, který nejde. Nápověda › *Jak na video pro sítě*
   radí *„V záložce Přepis hledej slovo…“* – záložka bez MY Premiere MCP neexistuje (Projekt má jen Projekt/Titulky)
   a pravý klik na klip nemá „Přepsat řeč“. Důkaz `01-prvni-spusteni.png`, `01c-ai-panel-system-pripraven.png`,
   `04-navod-socky.png`, `07-pravy-klik.png`, `10-titulky-bez-ai.png`, `16-ai-media.png`.
3. **(2) Cesta k přenosné aplikaci je v README a release notes popsaná třikrát jinak.** README: *„rozbalit vedle START.bat
   a složku přejmenovat na `PZ AI Cut - hotova aplikace pro Windows`“* – zip ale už tuto složku obsahuje (přejmenování je zbytečné
   a mate). Release notes: *„spusť PZ AI Cut\PZ AI Cut.exe“* – taková cesta v zipu není. „Rychle (Windows)“ začíná `git clone`
   (nováček nemusí mít git) a slovo **Releases** není odkaz. Aplikace přitom běží odkudkoli, START.bat nepotřebuje.
   Důkaz: výpis `Expand-Archive` (jediná složka `PZ AI Cut - hotova aplikace pro Windows`), `gh release view`.

## Cesta nováčka (měřeno 2026-11-23)
| Čas | Krok | Výsledek |
|---|---|---|
| 13:28:43 | Stáhnout `PZ-AI-Cut-portable.zip` z Releases | 136 MB za 16 s |
| 13:29:00 | Rozbalit | 4 s, 345 MB, složka `PZ AI Cut - hotova aplikace pro Windows` |
| 13:29:34 | Spustit `PZ AI Cut.exe` (běh A, bez ffmpeg) | okno česky, karta „Začni tady“, toast „Složka AI nenalezena…“, AI panel „Systém připraven“ (`01`) |
| 13:30:21 | Importovat video | **zaseknutí** – ffprobe ENOENT (`02`) |
| – | (nováček musí sám najít `winget install Gyan.FFmpeg` v odstavci o sestavení a aplikaci restartovat) | neměřeno, odhad 5–15 min |
| 13:32:04 | Běh B s ffmpeg, import | OK za 70 ms + náhled (`06`) |
| 13:32:45 | Pravý klik → Nová sekvence z klipu | sekvence 1280×720 (`08`) |
| 13:33:13 | Sekvence → Auto Reframe → 9:16 | ~25 s, „záběrů: 20, obličej nalezen v 20“ (`11`) – funguje i bez AI |
| 13:33:59 | Export (tlačítko vpravo nahoře) | dialog česky, −14 LUFS předvoleno (`12`) |
| 13:34:50 | Exportovat | **„✔ Hotovo za 36 s · 153 MB“**, ffprobe 1080×1920 H.264+AAC, 300,0 s, obličej v záběru (`14`, `15`) |
| – | Zavřít křížkem | prázdný projekt: zavře se hned; neuložený: nativní dialog „Uložit změny v projektu? Uložit / Neukládat / Zrušit“ (UIA), česky ✔ |

Kroky do prvního MP4 (bez AI): stáhnout, rozbalit, spustit, Importovat, pravý klik → Nová sekvence, Sekvence → Auto Reframe 9:16,
Export, Exportovat = **8 kroků, ~3 min** s ffmpeg; na čerstvém PC + hledání ffmpeg odhadem **10–20 min**.
AI cesta (upoutávka) pro nováčka s portable zipem není: potřebuje bod 1 (~15 GB, Node, Python, GPU), o tom ho aplikace neinformuje.

## Všechny nálezy
| # | Záv. | Kde | Co (důkaz) | Návrh lepšího textu / řešení |
|---|---|---|---|---|
| 1 | 3 | Import, stav. řádek, release, README | viz nález 1 (`02b`, `01b`) | Přibalit ffmpeg do zipu (`tools\ffmpeg\` aplikace ho už hledá – `media.js:18`). Jinak hláška: *„Chybí program ffmpeg, bez něj nejde načíst video. Nainstaluj ho příkazem `winget install Gyan.FFmpeg` a aplikaci spusť znovu.“* Stav. řádek: *„ffmpeg nenalezen“* místo „z PATH“. Release: *„Potřebuješ ffmpeg (winget install Gyan.FFmpeg).“* |
| 2 | 3 | AI panel, Začni tady, Titulky, Nápověda | viz nález 2 (`01c`, `04`, `07`, `10`) | Patička: *„AI není nainstalovaná“* (šedá tečka). Místo karet v panelu: *„AI potřebuje MY Premiere MCP (přepis, Hermes, Claude). Bez něj funguje střih, 9:16 a export. Jak nainstalovat →“*. V „Začni tady“ krok 2 skrýt. Titulky: *„Titulky z přepisu potřebují přepis řeči – nainstaluj MY Premiere MCP (README, bod 1).“* Návod: u Přepisu a Střihu s AI poznámka „(jen s MY Premiere MCP)“. |
| 3 | 2 | README „Rychle“, release notes | viz nález 3 | *„Jen aplikace: v Releases stáhni `PZ-AI-Cut-portable.zip`, rozbal kamkoli a spusť `PZ AI Cut - hotova aplikace pro Windows\PZ AI Cut.exe`. Git ani START.bat nepotřebuješ.“* + `[Releases](https://github.com/petroza/AI-EDIT-for-all-/releases/latest)` jako odkaz. |
| 4 | 2 | README / release | `PZ AI Cut.exe` není podepsaný (`Get-AuthenticodeSignature` → NotSigned); README ani release nezmiňují SmartScreen. Z prohlížeče staženého exe Windows typicky zastaví „Systém Windows ochránil počítač“ – nováček skončí. (Samotné okno SmartScreen jsem neviděl – gh nestahuje s Mark‑of‑the‑Web.) | *„Windows může napsat ‚Systém Windows ochránil počítač‘ – klikni Další informace → Přesto spustit (aplikace není podepsaná).“* |
| 5 | 2 | README Srovnání | Sloupec Standalone: „Potřebuješ: Windows“; že přepis/titulky/AI potřebují bod 1 (~15 GB, NVIDIA GPU doporučená, Hermes 12 GB VRAM) a ffmpeg, je až v textu níže. Placené/zdarma: jen řádek „Bez kreditů ✅ Hermes“ a „0,41 $“ v ukázce – nikde, že Claude Code potřebuje předplatné Claude (Pro/Max) nebo API a Codex účet ChatGPT. | Řádek „Potřebuješ“: *„Windows + ffmpeg; pro AI a přepis navíc bod 1 (~15 GB, NVIDIA GPU)“*. Nový řádek *„Cena“*: *„střih zdarma · Hermes zdarma (lokálně) · Claude = předplatné Claude/API · Codex = účet ChatGPT“*. |
| 6 | 2 | Toast „Složka AI nenalezena (config.json → aiRoot)…“ | `config.json` leží v `resources\app` uvnitř aplikace – nováček neví, kde ho hledat ani co do `aiRoot` napsat; v menu není Nastavení aplikace. Nastavení AI panelu ukazuje vývojářské „Most (port 7890) · požadavků: 0 · znovu načíst host.jsx“ (`05-nastaveni-ai.png`). | *„AI není nainstalovaná – střih funguje. Pro AI nainstaluj MY Premiere MCP (README bod 1); aplikace ho pak najde sama.“* Most/host.jsx schovat pod „Pro pokročilé“. |
| 7 | 1 | README tabulka Struktura (cs i en) | Řádek *„Plugin pro Claude k Premiere je…“* je vložený doprostřed tabulky → řádek `Obrazky a schemata pro navod\` se vykreslí jako text s `|` mimo tabulku (README.md ř. 141–144, README.en.md ř. 149–152). | Větu přesunout pod tabulku. |
| 8 | 1 | F1 | F1 = jen seznam zkratek („Klávesové zkratky (výchozí v Premiere Pro)“, `03-f1.png`); začátečnický návod je jen v Nápověda › Jak na video pro sítě. | V hlavičce zkratek odkaz *„Nový? Jak na video pro sítě →“*. |

**Ověřeno OK:** obrázky a soubory, na které README odkazuje, v gitu existují (23 obrázků, START.bat, 3× .bat, plugin zip,
Instalace.cmd, install-online.ps1, make_diagrams.py…); `screen-standalone-cs.png` odpovídá současnému vzhledu (rozložení,
AI panel, patička); lokální README = origin/main. UI v češtině od prvního spuštění, Auto Reframe a export bez AI fungují,
dialog zavření česky. Uložení nastavení do `%APPDATA%\TN_strihatoko` odpovídá README.

**Neověřeno (pravidla):** co přesně udělá Spustit v AI panelu bez Claude CLI – kód (`src/ai/main.js` `runAgent`) hlásí
*„✖ Claude Code CLI nenalezen v PATH.“* bez rady, kde ho vzít, a s Claude CLI by spustil agenta s neexistujícím `mcp.json`
(chybí kontrola složky AI před spuštěním); klik byl zablokován, aby se nespustil Claude. Výchozí cesta exportu míří do
skutečného `%USERPROFILE%\Videos\PZ AI Cut` (USERPROFILE se nepřesměruje) – v testu přepsána do `%TEMP%`.
Pozn. prostředí: „port 7890 je obsazený“ v Nastavení AI způsobila jiná testovací instance Electronu (PID 55868), ne nováček.

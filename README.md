# AI STRIH – všechny programy na jednom místě

Hotové verze programů pro AI střih. Dvojklik na **`START.bat`** otevře rozcestník.
Zdrojové projekty a vývoj zůstávají jinde (`O:\TN_strihatko`, `O:\ADOBEPREMIERESTRIH`), tahle složka je jen ke spuštění a předání dál.

| Složka | Co to je | Jak spustit |
|---|---|---|
| `PZ AI Cut\` | **PZ AI Cut** – samostatný střih (ovládání jako Premiere) s AI panelem, bez Adobe | `PZ AI Cut\PZ AI Cut.exe` (nic se neinstaluje) |
| – | **PZ AI Cut web** – stejný střih v Chrome, média zůstávají v počítači | https://pz-ai-cut.pages.dev |
| `Plugin pz-ai-cut\` | plugin pro aplikaci Claude: Claude stříhá ve webovém PZ AI Cut | Claude Desktop › Customize › Plugins › Add › Upload plugin › `pz-ai-cut-plugin.zip` (funguje v Cowork a v záložce Code) |
| `MY Premiere MCP\Instalace online\` | **MY Premiere MCP** – panel a AI nástroje přímo v Adobe Premiere Pro (přepis, střih podle obsahu, multicam, titulky, 9:16) | `Instalace.cmd` – kód a modely se stáhnou z internetu (~15 GB, s Hermesem +23 GB) |
| `MY Premiere MCP\Plugin pro Claude\` | plugin pro aplikaci Claude ke střihu v Premiere | `my-premiere-mcp.zip` – nahrát stejně jako výš |

## PZ AI Cut (aplikace)
- Přenosná – celou složku `PZ AI Cut` jde zkopírovat kamkoli, spouští se `PZ AI Cut.exe`.
- Potřebuje **ffmpeg**: najde ho v `MY Premiere MCP` (viz `aiRoot`), v PATH, nebo v `PZ AI Cut\resources\app\tools\ffmpeg\`.
- **AI panel** používá instalaci MY Premiere MCP (přepis, Hermes, modely). Cesta je v
  `PZ AI Cut\resources\app\config.json` → `aiRoot` (tady `O:\ADOBEPREMIERESTRIH`). Na jiném PC ji přepiš na složku,
  kam se MY Premiere MCP nainstaloval (např. `C:\Users\<jméno>\MYpremiereMCP`). Bez ní funguje střih, AI panel ne.
- Nastavení a projekty se ukládají mimo složku aplikace (`%APPDATA%\TN_strihatoko`, soubory `.tnproj`).

## MY Premiere MCP
- `Instalace online\Instalace.cmd` – zeptá se na cílovou složku (Enter = `%USERPROFILE%\MYpremiereMCP`) a na Hermes.
  Potom restartovat Premiere › **Okno › Rozšíření › MY Premiere MCP**. Podrobnosti `Instalace online\README.md`.
- Bez internetu: velká offline instalace je v `O:\ADOBEPREMIERESTRIH\INSTALL` (~38 GB, sem se nekopíruje),
  postup v `INSTALACE_NA_NOVEM_PC.md`.
- Firemní PC, kde se nepodepsaný panel neukáže: viz „Firemní PC: podepsaný panel (.zxp)“ v `INSTALACE_NA_NOVEM_PC.md`.

## Repozitář (GitHub)
| Složka | Obsah |
|---|---|
| `pz-ai-cut\` | zdrojový kód PZ AI Cut (aplikace, web, plugin) – spuštění ze zdrojů: `npm install`, `START.bat` |
| `my-premiere-mcp\` | zdrojový kód MY Premiere MCP (panel, MCP server, Worker) – i samostatně na github.com/petroza/MY-Premiere-MCP |
| kořen | tenhle rozcestník, online instalátor a pluginy |

Hotová přenosná aplikace **PZ AI Cut** (složka `PZ AI Cut\`, ~345 MB) není v gitu – stáhni ji z **Releases**
(`PZ-AI-Cut-portable.zip`), rozbal vedle `START.bat` a spusť.

## Aktualizace
- `Aktualizovat PZ AI Cut.bat` – znovu sestaví přenosnou aplikaci z `O:\TN_strihatko`.
- `Aktualizovat GitHub.bat` – převezme poslední commity z `O:\TN_strihatko` a `O:\ADOBEPREMIERESTRIH` a nahraje je sem
  (necommitnuté rozdělané změny se nenahrají).
- Web https://pz-ai-cut.pages.dev a online instalace MY Premiere MCP jsou vždy aktuální samy.

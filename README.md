# AI EDIT for all – AI střih videa třemi způsoby

Jeden repozitář, tři programy. Každý si z něj může postavit, co potřebuje:

| | Co to je | Pro koho |
|---|---|---|
| **1 · Premiere plugin** (MY Premiere MCP) | panel a AI nástroje přímo v **Adobe Premiere Pro**: přepis, střih podle obsahu, upoutávky, multicam, titulky a překlad, převod na 9:16; Claude / lokální model Hermes stříhá v Premiere | kdo má Premiere |
| **2 · Standalone** (PZ AI Cut) | samostatná střižna pro Windows, ovládání jako Premiere (stejné zkratky), s AI panelem – **bez Adobe** | kdo nemá Premiere |
| **3 · Web** (PZ AI Cut Web) | stejná střižna v prohlížeči Chrome/Edge, nic se neinstaluje, videa neopouštějí počítač; AI přes Claude Desktop nebo Codex | kdokoli, hned |

## Rychle (Windows)

```powershell
git clone https://github.com/petroza/AI-EDIT-for-all-.git
```

Pak ve složce dvojklik na **`START.bat`** (rozcestník), nebo přímo:

| Soubor | Co udělá | Potřeba |
|---|---|---|
| `1 Premiere plugin - instalace.bat` | nainstaluje MY Premiere MCP **přímo do naklonované složky** `my-premiere-mcp\`: Node/Python (winget, když chybí), balíčky, modely Whisper + diarizace + lokální LLM, panel do Premiere, registrace MCP serveru do Claude Code / Claude Desktop / Codexu. Ptá se na Hermes (+23 GB, GPU 12 GB+). Pak restartuj Premiere → **Okno › Rozšíření › MY Premiere MCP** | Windows 10/11, Adobe Premiere Pro, ~15 GB místa, internet; NVIDIA GPU výrazně zrychlí přepis |
| `2 Standalone - postavit.bat` | `npm install` (Electron) a sestaví přenosnou aplikaci do složky **`PZ AI Cut\`** → `PZ AI Cut.exe` | Node.js 18+, ffmpeg (přibalený v MY Premiere MCP, jinak `winget install Gyan.FFmpeg`) |
| `3 Web - postavit a spustit.bat` | sestaví web (`pz-ai-cut\web\dist`) a spustí ho na **http://127.0.0.1:8791/** | Node.js 18+, Chrome nebo Edge |

Hotová webová verze běží i online: **https://pz-ai-cut.pages.dev**. Hotová přenosná aplikace je v **Releases**
(`PZ-AI-Cut-portable.zip` – rozbalit vedle `START.bat`).

### AI ve standalone verzi
AI panel standalone verze je panel MY Premiere MCP (přepis, Hermes, Claude). Složku najde sám: `my-premiere-mcp\`
vedle v tomhle repozitáři, `%APPDATA%\MYpremiereMCP\root.txt` (zapíše instalátor z bodu 1), proměnná
`MYPREMIEREMCP_ROOT`, nebo ručně `pz-ai-cut\config.json` → `aiRoot`. Pro AI tedy nejdřív spusť bod 1
(Premiere k tomu mít nemusíš). Bez toho střih funguje, AI panel ne.

### AI ve webové verzi
Přes Claude Desktop: plugin `Plugin pz-ai-cut\pz-ai-cut-plugin.zip` (Customize › Plugins › Add › Upload plugin,
funguje v Cowork a záložce Code) nebo rozšíření `.mcpb` z AI panelu stránky; Codex jedním příkazem z AI panelu.
Řeč se přepisuje přímo v prohlížeči, Claude dostane jen text.

## Struktura

| Složka | Obsah |
|---|---|
| `my-premiere-mcp\` | MY Premiere MCP: `panel\` (CEP panel Premiere), `server\` (MCP server, Node), `worker\` (Python: Whisper, diarizace, analýzy), `INSTALL_SMALL\` (online instalace), `INSTALL\` (hlavní instalátor), `PLUGIN CLAUDE\` (plugin pro Claude), `youtuber\` (verze dílu pro AE). Návod `my-premiere-mcp\README.md`, pokyny pro AI `CLAUDE.md`, jiný PC `INSTALACE_NA_NOVEM_PC.md` |
| `pz-ai-cut\` | PZ AI Cut: `src\` (střižna – jádro, UI), `web\` (webová verze, build bez bundleru), `connector\` (MCP konektor pro web), `tools\` (`pack-portable.js`, obličeje, synchronizace AI panelu), `test\`, `team\` (zápisy z vývoje). Návod `pz-ai-cut\README.md`, web `pz-ai-cut\web\README.md` |
| `Plugin pz-ai-cut\` | hotový plugin pro Claude k webové verzi |

Ručně (bez .bat): `cd pz-ai-cut` → `npm install` → `npm start` (spustit ze zdrojů) / `npm run pack` (přenosná) /
`npm run web:serve` (web) / `npm test` (testy).
MY Premiere MCP ručně: `powershell -ExecutionPolicy Bypass -File my-premiere-mcp\INSTALL_SMALL\install-online.ps1`
(přepínače `-Hermes`, `-NoLocalLLM`, `-SkipModels`, `-Target <složka>`).

## Pro správce repozitáře
`Aktualizovat GitHub.bat` převezme poslední commity z vývojových složek (`O:\TN_strihatko`, `O:\ADOBEPREMIERESTRIH`)
do `pz-ai-cut\` a `my-premiere-mcp\` a nahraje je sem. Necommitnuté změny se nenahrají.

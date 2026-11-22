# MY Premiere MCP – zprovoznění na novém počítači (pokyny pro Claude)

> **Claude:** uživatel (Petr) ti dal tuhle složku a chce, aby MY Premiere MCP na tomhle PC fungovalo stejně jako doma –
> panel v Premiere, MCP server `premiere` se všemi nástroji (přepis, mluvčí, střih podle obsahu, multicam, titulky,
> lokální modely). Projdi kroky níž sám, odpovídej česky a stručně. Na uživatele se obracej jen tam, kde je to výslovně
> napsané (restart Premiere, nová relace, věci, které musí povolit IT).

Složka je **kompletní přenosná instalace – nic se nemusí instalovat ani stahovat, nepotřebuje práva správce**:

| Ve složce | Co to je |
|---|---|
| `tools\node\node.exe` | přenosný Node.js (MCP server, panel) – použije se, když na PC Node není |
| `tools\python311\` | přenosný Python 3.11 **už s balíčky** (faster-whisper, CUDA knihovny, sherpa-onnx, opencv…) |
| `tools\ffmpeg\bin\` | ffmpeg/ffprobe (Worker si je najde sám) |
| `tools\llama.cpp`, `tools\llama.cpp-hermes` | lokální LLM servery |
| `models\` (~40 GB) | Whisper (+ česká varianta), diarizace, gemma3 12B, Qwen3-VL, Hermes (Qwen3.6-35B) |
| `node_modules\`, `INSTALL\offline\wheels` | Node závislosti, Python balíčky offline (pro variantu s vlastním `.venv`) |

Chybí jen věci vázané na původní PC: `.venv` (není potřeba – server použije `tools\python311`), `cache\` (přepisy) a `test\`.
„Instalace“ tedy jen propojí složku s Premiere a s Claude – vše na úrovni uživatele (`%APPDATA%`, `HKCU`, `~\.claude.json`).

## 0. Kde má složka ležet
- Má běžet z **pevného disku**, ne z flash disku (pomalé, po vytažení by panel i Worker přestaly fungovat).
  Doporučené umístění `C:\MYpremiereMCP` (cesta bez mezer a diakritiky).
- Když je složka zatím jen na flash disku, zkopíruj ji (potřeba ~50 GB volných):
  ```powershell
  robocopy "<flash>\MCPPremiere" "C:\MYpremiereMCP" /E /MT:8 /R:2 /W:2 /NFL /NDL
  ```
  (robocopy vrací 0–7 = OK, 8+ = chyba). Dál pracuj jen s kopií na C:.
- Složka nesmí ležet v `%TEMP%` (instalátor ji pak bere jako zkušební a nic nezaregistruje).

## 1. Instalace (varianta A – PowerShell)
1. Kontrola, nic nemění:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\MYpremiereMCP\INSTALL\install.ps1" -CheckOnly
   ```
   Má vypsat „Node.js … / pribaleny“, „Python 3.11 pribaleny … nic se neinstaluje“, „ffmpeg pribaleny“ a skončit
   „Kontroly prosly“. U chyb je návod (`->`). Varování (obsazený port, bez GPU) neblokují.
2. Ostrý běh (stejný příkaz bez `-CheckOnly`, trvá desítky sekund). Udělá: propojení panelu
   (`%APPDATA%\Adobe\CEP\extensions\com.pz.premieremcp` → `panel`), `PlayerDebugMode=1` v `HKCU\Software\Adobe\CSXS.11–15`,
   `mcp.json` na skutečnou cestu, `%APPDATA%\MYpremiereMCP\root.txt`, přibalený Node do uživatelské PATH (když Node chybí)
   a registraci MCP serveru `premiere` do Claude Code (CLI, jinak rovnou `~\.claude.json`), Claude Desktop a Codexu.
3. Výsledek v části **„4/4 Vysledek“** – má být „HOTOVO - vse overeno“. Shrň ho uživateli.

## 1b. Když IT blokuje PowerShell skripty (varianta B)
Poznáš podle chyby typu „running scripts is disabled“ / „execution of scripts is disabled by Group Policy“ i s `-ExecutionPolicy Bypass`.
Spusť nouzovou instalaci v **cmd** (dělá totéž podstatné, bez PowerShellu):
```bat
C:\MYpremiereMCP\INSTALL\instalace-bez-powershellu.cmd
```
Když neprojde ani ta, udělej kroky ručně (vše bez práv správce):
```bat
mklink /J "%APPDATA%\Adobe\CEP\extensions\com.pz.premieremcp" "C:\MYpremiereMCP\panel"
for %v in (11 12 13 14 15) do reg add "HKCU\Software\Adobe\CSXS.%v" /v PlayerDebugMode /t REG_SZ /d 1 /f
C:\MYpremiereMCP\tools\node\node.exe C:\MYpremiereMCP\scripts\register.mjs
```
a zapiš `mcp.json` (`{"mcpServers":{"premiere":{"command":"node","args":["C:/MYpremiereMCP/server/index.js"]}}}`, UTF-8 bez BOM)
a cestu ke složce do `%APPDATA%\MYpremiereMCP\root.txt`.

### Co IT zablokovat může a co s tím
| Blokace | Projev | Řešení |
|---|---|---|
| PowerShell skripty | `install.ps1` nejde spustit | varianta B (cmd). Hermes se pak sám nespustí (startuje přes `scripts\hermes.ps1`) → v `config.json` dej `llmBackends.hermes.autoStart: false`, plánuje gemma3. |
| Spouštění .exe z uživatelských složek (AppLocker/WDAC) | `node.exe`, `python.exe` nebo `llama-server.exe` z `C:\MYpremiereMCP\tools` „blokováno správcem“ | zkusit složku jinde (např. `C:\Program Files` vyžaduje IT); jinak IT musí povolit složku `C:\MYpremiereMCP` – bez toho to nepůjde. Řekni to uživateli přesně (název blokovaného souboru). |
| Nepodepsaná rozšíření Adobe (CEP) | panel v menu Rozšíření chybí, i když junction i `PlayerDebugMode` sedí | firemní politika nepustí nepodepsané rozšíření (Nova 2026-11) → **podepsaný panel `.zxp`**, viz níže. Nejdřív ověř, že je Premiere po instalaci restartované a sedí verze `CSXS`. |
| Zápis do `HKCU` nebo `mklink` | chyba v krocích 1/2 | výjimečné; bez toho panel nepojede → IT. |
| MCP servery v Claude (spravovaná organizace) | nástroje `premiere` se v nové relaci neobjeví, `claude mcp list` ho nevidí nebo hlásí zákaz | musí povolit správce organizace Claude (allowlist MCP serverů). Zkus i zadání přímo z panelu (agent Claude – spouští CLI s vlastním `mcp.json`) a plugin (krok 3.4). |
| Firewall / antivir na `127.0.0.1` | `premiere_status` nevidí panel, Worker nenaběhne | výjimka pro localhost porty 7880–7883 a 8000, případně jiný `port` v `config.json`. |

### Firemní PC: podepsaný panel (.zxp)
Kde IT nepovolí `PlayerDebugMode`, se nepodepsaný panel v Premiere neukáže. Řešení je podepsaný balíček:
1. `ZXPSignCmd.exe` (Adobe, github.com/Adobe-CEP/CEP-Resources → ZXPSignCMD, win64) do `tools\`.
2. Certifikát: firemní code-signing `.p12` od IT, nebo vlastní: `powershell -ExecutionPolicy Bypass -File scripts\build-zxp.ps1 -NewCert`.
3. Podpis: `powershell -ExecutionPolicy Bypass -File scripts\build-zxp.ps1` → `INSTALL\MYPremiereMCP.zxp` (s časovým razítkem).
4. Instalace na PC: `… scripts\build-zxp.ps1 -Install` (Adobe UPIA z Creative Cloud; odstraní vývojářský odkaz na `panel`).
5. Instalátor `INSTALL\install.ps1` spusť i tak – zapíše `%APPDATA%\MYpremiereMCP\root.txt`, podle kterého panel z `.zxp`
   najde server a Worker ve složce aplikace.

Po každé změně v `panel\` je potřeba nový `.zxp` (podpis kontroluje každý soubor). Certifikát ani heslo nepatří do gitu.

## 2. Doladění podle tohoto PC (`config.json`)
- **`defaultExportPreset`** ukazuje na `C:/Program Files/Adobe/Adobe Premiere Pro 2026/...`. Jiná verze Premiere nevadí –
  když soubor neexistuje, panel stejný preset najde ve složce právě běžící Premiere (`app.path`). Ruční oprava je potřeba
  jen pro úplně jiný preset.
- **Hermes** (`llmBackends.hermes`, Qwen3.6-35B) se spouští automaticky (`autoStart: true`) pro `plan_edit_local`, osnovy,
  překlad titulků. Potřebuje NVIDIA s ~12 GB VRAM a ~32 GB RAM. Na slabším stroji nastav `"autoStart": false` – plánuje
  pak gemma3 12B (`models\llm`), případně rovnou Claude.
- Bez NVIDIA GPU: instalátor sám přepne Whisper na `cpu`/`int8`; při ruční instalaci to udělej v `config.json`
  (`whisper.device` = `cpu`, `whisper.compute` = `int8`). Ověř `nvidia-smi`.
- `youtuber\detail-*.yaml` mají cesty z domácího PC (`F:\GDRIVE\Detail...`) – řeší se až při práci na YouTuber verzi dílu.

## 3. Ověření, že to opravdu komunikuje s Premiere
1. Řekni uživateli: **zavřít a znovu spustit Premiere Pro**, otevřít projekt a panel **Okno › Rozšíření › MY Premiere MCP**.
2. Uživatel musí **spustit novou relaci Claude** (registrace MCP platí až od další relace).
3. V nové relaci: `premiere_status` (vidí Premiere a projekt) → `worker_status` (Worker se spustí sám, s přenosným
   Pythonem) → krátký test `transcribe_media` na klipu z projektu. Když vše vrátí výsledek, je hotovo.
4. Volitelně plugin do aplikace Claude: `PLUGIN CLAUDE\my-premiere-mcp.zip` → Settings › Plugins › Upload local plugin
   (skill na střih + `/my-premiere-mcp:panel`). Plugin si složku najde přes `root.txt` – je to i náhradní cesta, když
   registrace MCP do `~\.claude.json` nezabere. Podrobnosti v `PLUGIN CLAUDE\README.md`.

## 4. Když něco nejde
| Příznak | Příčina / řešení |
|---|---|
| Panel v menu Rozšíření chybí | Premiere nerestartováno; junction `%APPDATA%\Adobe\CEP\extensions\com.pz.premieremcp\index.html` musí existovat; `PlayerDebugMode` = `1`; jinak firemní politika (viz tabulka výš). |
| `premiere_status`: Premiere nedostupné | Panel musí být otevřený (HTTP most na `127.0.0.1:7880`). Port obsazený → `port` v `config.json`. |
| Nástroje `premiere` v Claude nejsou | Nová relace? `claude mcp get premiere` (nebo `mcpServers.premiere` v `~\.claude.json`) musí ukazovat na `<složka>/server/index.js` a `command` na existující Node. Znovu: `tools\node\node.exe scripts\register.mjs`. |
| Worker nenaběhne / přepis selže | `cache\worker.log`. Test Pythonu: `tools\python311\python.exe -c "import faster_whisper, ctranslate2; print(ctranslate2.get_cuda_device_count())"` (0 = bez CUDA → přepni Whisper na CPU). |
| llama-server spadne | `cache\llama-server.log`; antivir blokuje `tools\llama.cpp*\*.exe`, nebo málo VRAM → menší `gpuLayers`. |
| `APPDATA je na sitovem disku` | přesměrovaný profil – panel nejde propojit, nutná pomoc IT. |

Log PowerShell instalace: `INSTALL\install-log.txt`. Ruční pokyny pro člověka: `INSTALL\README.md`.

## 5. Potom
Instalace hotová → běžná práce podle `CLAUDE.md` (postup střihu, pravidla). `README.md` popisuje všechny nástroje.

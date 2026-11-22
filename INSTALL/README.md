# MY Premiere MCP – instalace

Jedna instalace pro všechny případy: **poklepej na `Instalace.cmd`**. Po dokončení restartuj Premiere Pro
→ **Okno › Rozšíření › MY Premiere MCP**. Nic nepotřebuje práva správce, všechno se instaluje do složky aplikace
(`.venv`, `models`, `tools`).

| Soubor | K čemu |
|---|---|
| **`Instalace.cmd`** | instalace i aktualizace (spouští `install-online.ps1`) |
| `install-online.ps1` | najde kód (tahle složka aplikace, jinak GitHub), doinstaluje Node.js / Python přes winget, spustí `install.ps1` |
| `install.ps1` | hlavní instalátor: kontroly, balíčky, modely, panel do Premiere, registrace MCP, ověření |
| `instalace-bez-powershellu.cmd` | nouzová cesta, když IT blokuje PowerShell skripty (viz `INSTALACE_NA_NOVEM_PC.md`) |
| `offline\` | volitelný offline balík (~38 GB, není v gitu) – když tu je, nic se nestahuje |
| `install-log.txt` | záznam poslední instalace (stačí poslat k diagnostice) |

## Odkud se co vezme

- **Ve složce aplikace** (git clone, zkopírovaná složka): instaluje se přímo do ní.
- **Na jiném PC jen se dvěma soubory** (`Instalace.cmd` + `install-online.ps1`): zeptá se kam (Enter = `%USERPROFILE%\MYpremiereMCP`)
  a kód stáhne z github.com/petroza/MY-Premiere-MCP.
- **Se složkou `offline`** vedle instalátoru: modely, `llama.cpp`, Python balíčky (wheels) i `node_modules` se vezmou z ní,
  internet není potřeba (Node.js 18+ a Python 3.11 ale musí být na počítači).

| Co | Odkud (bez `offline`) | Velikost |
|---|---|---|
| Node.js LTS, Python 3.11 (jen když chybí) | winget | ~100 MB |
| npm a pip balíčky (faster-whisper, CUDA knihovny…) | npmjs.org, pypi.org | ~1,5 GB |
| Whisper large-v3 (přepis) | huggingface.co | 3 GB |
| Diarizace (kdo kdy mluví) | github.com (sherpa-onnx) | 40 MB |
| Lokální LLM gemma3 12B + vision model + llama.cpp | huggingface.co, github.com | ~10 GB |
| Hermes – volitelně (`-Hermes`, jinak se zeptá) | huggingface.co, github.com | ~23 GB |

Potřeba je Windows 10/11, ~15 GB volného místa (+23 GB s Hermesem). NVIDIA GPU výrazně zrychlí přepis, Hermes chce ~12 GB VRAM.
Bez NVIDIA GPU instalátor sám přepne Whisper na CPU (`device=cpu`, `compute=int8`).

## Přepínače

```
Instalace.cmd -CheckOnly                jen kontrola prostředí, nic nemění
Instalace.cmd -Target D:\MYpremiereMCP  jiná složka
Instalace.cmd -Hermes                   i Hermes bez ptaní
Instalace.cmd -NoLocalLLM               bez lokálního LLM (ušetří ~10 GB; nepoběží analyze_transcript, plan_edit_local, describe_frame)
Instalace.cmd -SkipModels               jen panel a MCP, bez modelů (přepis pak nefunguje)
```

**Aktualizace:** spusť `Instalace.cmd` znovu – kód se obnoví, modely, cache a `config.json` zůstanou.

## Co instalátor kontroluje předem
Nic se nezačne instalovat, dokud neprojdou kontroly: soubory projektu, volné místo, Node.js 18+, Python 3.11, `curl` a `tar`,
offline balík nebo dostupnost sítě, lokální `%APPDATA%` (CEP panel), Premiere Pro, NVIDIA GPU, volné porty 7880 a 7881.
Po instalaci ověří importy Python balíčků, velikost modelů, propojení panelu, klíč v registru a `mcp.json`.

## Když to selže
Každá chyba vypíše i návod. Kompletní záznam je v `install-log.txt`.

| Hláška | Řešení |
|---|---|
| `Node.js neni nainstalovany` | Nainstaluj Node.js LTS (nodejs.org), otevři **nové** okno a spusť znovu. |
| `Python 3.11 nenalezen` | Nainstaluj Python 3.11 (64-bit) a zaškrtni „Add python.exe to PATH“. |
| `Sit: ... je nedostupny` | Použij složku `offline`, nebo nastav proxy: `setx HTTPS_PROXY http://proxy:port`, nové okno, znovu. |
| `APPDATA je na sitovem disku` | Přesměrovaný profil – bez IT to nepůjde (CEP panel potřebuje lokální `%APPDATA%`). |
| `... existuje a neni to propojeni (junction)` | Smaž `%APPDATA%\Adobe\CEP\extensions\com.pz.premieremcp` a spusť znovu. |
| Stahování spadne v půlce | Spusť znovu – hotové soubory přeskočí. |

### Hermes po instalaci
Worker ho spouští sám pro `plan_edit_local` a po nečinnosti vypíná. Ručně: `powershell -ExecutionPolicy Bypass -File scripts\hermes.ps1 start`.

Firemní PC, kde se nepodepsaný panel neukáže (podepsaný `.zxp`), a blokace IT: `INSTALACE_NA_NOVEM_PC.md` v kořeni aplikace.

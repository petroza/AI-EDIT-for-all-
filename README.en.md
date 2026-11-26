<p align="right">
  <a href="README.md"><img src="Obrazky%20a%20schemata%20pro%20navod/img/flag-cz.svg" width="30" height="20" alt="Čeština"> Čeština</a>
  &nbsp;·&nbsp;
  <a href="README.en.md"><img src="Obrazky%20a%20schemata%20pro%20navod/img/flag-gb.svg" width="30" height="20" alt="English"> <b>English</b></a>
</p>

# AI EDIT for all – AI video editing three ways

One repository, three apps. Claude, Codex or the local Hermes model edit video **by what is being said**:
they pick the best soundbites, assemble a teaser or a short version, add captions and reframe to 9:16 for social media.
The result is always a **new sequence** – the original stays untouched. Videos never leave your computer; the AI only
receives the transcript text.

| | What it is | For whom |
|---|---|---|
| **1 · Premiere plugin** (MY Premiere MCP) | a panel and AI tools inside **Adobe Premiere Pro**: transcription, content-based editing, teasers, speaker-based multicam, captions and translation, Auto Reframe 9:16 | Premiere users |
| **2 · Standalone** (PZ AI Cut) | a standalone Windows editor that works like Premiere (same shortcuts and layout) with an AI panel – **no Adobe needed** | anyone without Premiere |
| **3 · Web** (PZ AI Cut Web) | the same editor in Chrome/Edge, nothing to install, transcription runs in the browser; AI via Claude Desktop or Codex | anyone, right now |

## Demo

<img src="Obrazky%20a%20schemata%20pro%20navod/img/demo-ai-en.webp" alt="Task in the panel → Claude edits → finished teaser and 9:16 version" width="100%">

A real run in the standalone app (Czech UI): the task *"Make a 20 s Instagram teaser from the strongest soundbites of the
active sequence. Start with a hook."* → Claude (Sonnet) read the transcript of a 28-minute interview, picked the
soundbites, checked that no cut clips a word and built a new sequence (2 min 22 s, $0.41). The panel then made a
face-tracked 9:16 version on its own.

<img src="Obrazky%20a%20schemata%20pro%20navod/img/before-after-en.png" alt="Before: 28-min interview 16:9 → after: 20 s 9:16 teaser with captions" width="100%">

Captions come from automatic speech recognition – the demo even shows a typical recognition slip, which a human or
the AI fixes before publishing (`get_captions` / `set_captions`).

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-overview-en.svg" alt="Three apps, one AI core" width="100%">

## Comparison

| | 1 · Premiere plugin | 2 · Standalone | 3 · Web |
|---|---|---|---|
| **You need** | Adobe Premiere Pro, Windows | Windows + ffmpeg; for transcription and AI also step 1 (~15 GB, NVIDIA GPU) | Chrome or Edge |
| **Install size** | ~15 GB (+23 GB with Hermes) | app ~350 MB + the AI core from step 1 | nothing (the ~1 GB speech model downloads into the browser) |
| **Speech recognition** | Whisper large-v3 on GPU | Whisper large-v3 on GPU | Whisper in the browser |
| **Who speaks when, multicam** | ✅ diarization, camera switching by speaker | ✅ same tools | – |
| **AI agent** | Claude Code, Claude Desktop, Codex, **local Hermes** | Claude Code, Claude Desktop, Codex, **local Hermes** | Claude Desktop, Codex |
| **No credits (fully local)** | ✅ Hermes | ✅ Hermes | – (transcription yes, editing needs Claude/Codex) |
| **Cost** | the software is free · Hermes free (local) · Claude = Claude subscription (Pro/Max) or API · Codex = ChatGPT account | same | same (no Hermes) |
| **9:16 · 4:5 · 1:1** | Premiere Auto Reframe | face-based crop (OpenCV) | face and speaker-based crop (MediaPipe) |
| **Captions** | ✅ incl. translation to Czech | ✅ | ✅ + headline on top |
| **Export** | anything Premiere can do | MP4, MOV (ProRes), MXF (XDCAM HD422), −14 / −23 LUFS | MP4 (H.264) |
| **Where your videos are** | only on your PC | only on your PC | only on your PC (read from disk, nothing is uploaded) |

## Quick start (Windows)

**Just the editor (no AI):** download `PZ-AI-Cut-portable.zip` from
[Releases](https://github.com/petroza/AI-EDIT-for-all-/releases/latest), unzip it anywhere and run
`PZ AI Cut - hotova aplikace pro Windows\PZ AI Cut.exe` (no git, no `START.bat`, nothing gets installed). It needs
**ffmpeg** – if it is missing, the app offers to install it (`winget install Gyan.FFmpeg`). The app is not signed: if
Windows says “Windows protected your PC”, click **More info → Run anyway**. Without AI you get editing, Auto Reframe
9:16 and export.

**Everything including AI (transcription, Hermes, Claude):**

```powershell
git clone https://github.com/petroza/AI-EDIT-for-all-.git
```

Then double-click **`START.bat`** in the folder (launcher menu), or one of the three files below directly. You can
unzip the portable app from Releases into this folder – it finds the AI itself.
The finished web version also runs online at **https://pz-ai-cut.pages.dev**.

> The app UI and AI panel are available in Czech and English (flag switch in the top right corner).
> The installer scripts and file names are in Czech: *instalace* = install, *postavit* = build, *spustit* = run.

---

## 1 · Premiere plugin – `1 Premiere plugin - instalace.bat`

<img src="Obrazky%20a%20schemata%20pro%20navod/img/screen-premiere.png" alt="Adobe Premiere Pro with the MY Premiere MCP panel" width="100%">

The **MY Premiere MCP** panel in Premiere (Window › Extensions): local AI status (GPU, VRAM), length and format of the
result, quick actions (Soundbite, Teaser, Short version, Remove pauses), a free-text task, agent choice (Claude Code,
Codex, Hermes), captions and 9:16 reframing. The agent carries out the task directly in the open project.

**What gets installed** (all into the cloned `MY Premiere MCP - plugin do Premiere - zdrojovy kod\` folder, no admin rights):

| What | Where / from | Size |
|---|---|---|
| Node.js LTS, Python 3.11 – only if missing | winget | ~100 MB |
| npm and pip packages (faster-whisper, CUDA libraries, sherpa-onnx, OpenCV…) | `node_modules\`, `.venv\` | ~1.5 GB |
| Whisper large-v3 – transcription with word timing | `models\` (Hugging Face) | 3 GB |
| diarization – who speaks when | `models\diarization` | 40 MB |
| TransNetV2 – shot cuts in the source (edge check, 9:16 reframe), MIT | `models\transnetv2` | 31 MB |
| gemma3 12B + vision model + llama.cpp – outline, weak spots | `models\llm`, `tools\llama.cpp` | ~10 GB |
| **Hermes** (Qwen3.6-35B) – free edit planning, optional (asked) | `models\hermes` | ~23 GB |
| Premiere panel | link `%APPDATA%\Adobe\CEP\extensions\com.pz.premieremcp`, `PlayerDebugMode` in `HKCU\Software\Adobe\CSXS.*` | – |
| `premiere` MCP server | registered in Claude Code, Claude Desktop and Codex | – |

Requirements: Windows 10/11, Adobe Premiere Pro, ~15 GB of disk space (+23 GB with Hermes), internet. An NVIDIA GPU
makes transcription much faster; Hermes needs ~12 GB VRAM. After installing, restart Premiere →
**Window › Extensions › MY Premiere MCP** and start a new Claude session.

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-premiere-en.svg" alt="How the Premiere plugin is wired" width="100%">

---

## 2 · Standalone – `2 Standalone - postavit.bat`

<img src="Obrazky%20a%20schemata%20pro%20navod/img/screen-standalone-en.png" alt="PZ AI Cut Standalone" width="100%">

**PZ AI Cut** – a Windows editor without Adobe: Source / Program / Project / Timeline like Premiere, the same shortcuts
(J/K/L, I/O, C, Q/W…), transitions, captions, export to MP4 · MOV (ProRes) · MXF (XDCAM for broadcast), face-following
9:16 reframing. The AI panel on the right is the same as in Premiere.

**What gets installed:** `npm install` downloads Electron (~100 MB) into `PZ AI Cut - standalone a web - zdrojovy kod\node_modules`, the script builds a
portable app into the `PZ AI Cut - hotova aplikace pro Windows\` folder (`PZ AI Cut.exe`, nothing is written to the system). Settings and auto-saves
live in `%APPDATA%\TN_strihatoko`. Requires Node.js 18+ and ffmpeg (bundled with MY Premiere MCP, otherwise
`winget install Gyan.FFmpeg`).

**AI in the standalone app:** the AI panel uses MY Premiere MCP (transcription, Hermes, Claude) – run step 1 first
(you don't need Premiere for that). The app finds it automatically: `MY Premiere MCP - plugin do Premiere - zdrojovy kod\` next to it in this repository,
`%APPDATA%\MYpremiereMCP\root.txt`, the `MYPREMIEREMCP_ROOT` variable, or `PZ AI Cut - standalone a web - zdrojovy kod\config.json` → `aiRoot`.
Without it, editing works but the AI panel does not.
With it you also get **transcription without AI**: the Transcript tab next to Project (search, click a sentence = a part,
insert it into a sequence), right-click a clip → Transcribe Speech, Sequence → Captions → Create Captions from Transcript.
The local Worker transcribes (Whisper large-v3 on the GPU).

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-standalone-en.svg" alt="How the standalone app is wired" width="100%">

---

## 3 · Web – `3 Web - postavit a spustit.bat`

<img src="Obrazky%20a%20schemata%20pro%20navod/img/screen-web-en.png" alt="PZ AI Cut Web in the browser" width="100%">

The same editor in the browser (pictured: a sequence reframed to 9:16 and the AI connection guide). Videos are read
straight from disk, nothing is uploaded; speech is transcribed in the browser (Whisper, the ~1 GB model downloads once).
Formats: MP4 / MOV with H.264 directly; **broadcast MXF** (XDCAM HD422, DNxHD/DNxHR, IMX…) is converted once on import
in the browser to H.264 (ffmpeg.wasm, the ~32 MB converter downloads once; 1080i at roughly real time) and kept in
the browser – no conversion next time.

**What gets installed:** nothing – the script only builds `PZ AI Cut - standalone a web - zdrojovy kod\web\dist` and serves it at
**http://127.0.0.1:8791/** (requires Node.js 18+, Chrome or Edge). For AI, download the connector from the page's
AI panel:

- **Claude Desktop** – the `pz-ai-cut.mcpb` extension (double-click → Install), or the plugin
  `PZ AI Cut web - plugin pro Claude\PZ AI Cut web - plugin pro Claude.zip` (Customize › Plugins › Add › Upload plugin; works in Cowork and the Code tab),
- **Codex (ChatGPT)** – one command from the AI panel.

Chrome asks once about access to devices on your local network – click **Allow** (the page talks to the connector
on 127.0.0.1). To host it yourself, upload `web\dist` as static files (e.g. Cloudflare Pages).

<img src="Obrazky%20a%20schemata%20pro%20navod/img/schema-web-en.svg" alt="How the web version is wired" width="100%">

---

## Repository layout

| Folder | Contents |
|---|---|
| `MY Premiere MCP - plugin do Premiere - zdrojovy kod\` | MY Premiere MCP: `panel\` (Premiere CEP panel), `server\` (MCP server, Node), `worker\` (Python: Whisper, diarization, analysis), `INSTALL\` (install: `Instalace.cmd`), `PLUGIN CLAUDE\` (Claude plugin), `youtuber\` (After Effects episode versions). Docs (Czech): `MY Premiere MCP - plugin do Premiere - zdrojovy kod\README.md`, AI instructions `CLAUDE.md` |
| `PZ AI Cut - standalone a web - zdrojovy kod\` | PZ AI Cut: `src\` (editor core and UI), `web\` (web version, bundler-free build), `connector\` (MCP connector for the web), `tools\` (`pack-portable.js`, faces, AI panel sync), `test\`, `team\` (development notes) |
| `PZ AI Cut web - plugin pro Claude\` | ready-made Claude plugin for the web version |
| `PZ AI Cut - hotova aplikace pro Windows\` | the finished portable app (`PZ AI Cut.exe`) – built by `2 Standalone - postavit.bat`, not in git (see Releases) |
| `Obrazky a schemata pro navod\` | images and diagrams (`python "Obrazky a schemata pro navod\make_diagrams.py"` regenerates them) |

The Claude plugin for Premiere is in the MY Premiere MCP folder: `PLUGIN CLAUDE\my-premiere-mcp.zip`.

Manually (without .bat): `cd "PZ AI Cut - standalone a web - zdrojovy kod"` → `npm install` → `npm start` (from source) / `npm run pack` (portable) /
`npm run web:serve` (web) / `npm test` (tests).
MY Premiere MCP manually: `powershell -ExecutionPolicy Bypass -File "MY Premiere MCP - plugin do Premiere - zdrojovy kod\INSTALL\install-online.ps1"`
(options `-Hermes`, `-NoLocalLLM`, `-SkipModels`, `-Target <folder>`).

## For the maintainer
Development happens directly in these folders. `Aktualizovat GitHub.bat` commits changes, pushes them here and also copies the
MY Premiere MCP folder into the standalone repository [petroza/MY-Premiere-MCP](https://github.com/petroza/MY-Premiere-MCP), which the
online installer downloads from (`MY Premiere MCP - plugin do Premiere - zdrojovy kod\scripts\sync-standalone-repo.mjs`).

@echo off
rem PZ AI Cut - connector launcher for Codex (Windows). Finds Node.js: system one, or the one bundled with the Codex app.
setlocal
set "S=%~dp0server\index.js"
where node >nul 2>nul && (node "%S%" & exit /b)
if defined CODEX_MCP_NODE_PATH if exist "%CODEX_MCP_NODE_PATH%" ("%CODEX_MCP_NODE_PATH%" "%S%" & exit /b)
set "CX="
for /f "usebackq delims=" %%p in (`powershell -NoProfile -NonInteractive -Command "(Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation"`) do set "CX=%%p"
if defined CX if exist "%CX%\app\resources\cua_node\bin\node.exe" ("%CX%\app\resources\cua_node\bin\node.exe" "%S%" & exit /b)
for /d %%d in ("%LOCALAPPDATA%\AnthropicClaude\app-*") do if exist "%%d\resources\node.exe" set "CN=%%d\resources\node.exe"
if defined CN ("%CN%" "%S%" & exit /b)
echo PZ AI Cut: Node.js was not found. Install it from https://nodejs.org and restart Codex. 1>&2
exit /b 1

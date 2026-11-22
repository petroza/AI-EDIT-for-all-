@echo off
rem Nahraje tenhle repozitar na GitHub (petroza/AI-EDIT-for-all-) a slozku MY Premiere MCP i do samostatneho
rem repozitare petroza/MY-Premiere-MCP (z nej stahuje kod online instalator). Vyvoj probiha primo v teto slozce.
cd /d "%~dp0"
copy /Y "PZ AI Cut - standalone a web - zdrojovy kod\web\dist\pz-ai-cut-plugin.zip" "PZ AI Cut web - plugin pro Claude\PZ AI Cut web - plugin pro Claude.zip" >nul 2>nul
git add -A
git diff --cached --quiet || git commit -q -m "Aktualizace"
git push origin main
if errorlevel 1 goto chyba
node "MY Premiere MCP - plugin do Premiere - zdrojovy kod\scripts\sync-standalone-repo.mjs"
if errorlevel 1 goto chyba
echo [OK] GitHub aktualizovan.
pause
exit /b 0
:chyba
echo [CHYBA] Aktualizace se nepovedla - viz vypis vyse.
pause
exit /b 1

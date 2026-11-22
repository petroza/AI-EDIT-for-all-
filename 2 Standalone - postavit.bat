@echo off
rem PZ AI Cut - samostatna strizna (Electron) ze zdrojoveho kodu v tomto repozitari
rem -> slozka "PZ AI Cut - hotova aplikace pro Windows" vedle tohoto souboru.
rem Potreba Node.js 18+ (https://nodejs.org). AI panel pouzije MY Premiere MCP (bod 1), strih funguje i bez nej.
set "OUT=%~dp0PZ AI Cut - hotova aplikace pro Windows"
cd /d "%~dp0PZ AI Cut - standalone a web - zdrojovy kod"
where node >nul 2>nul
if errorlevel 1 goto nonode
if exist "node_modules\electron\dist\electron.exe" goto pack
echo Instaluji Electron, jednou, asi 100 MB...
call npm install --no-audit --no-fund
if errorlevel 1 goto npmfail
:pack
node tools\pack-portable.js "%OUT%" %*
if errorlevel 1 goto fail
echo.
echo [OK] Spust: "%OUT%\PZ AI Cut.exe"   nebo START.bat - volba 1
echo      Potreba je i ffmpeg: s MY Premiere MCP je pribaleny, jinak  winget install Gyan.FFmpeg
pause
exit /b 0
:nonode
echo [CHYBA] Chybi Node.js. Nainstaluj ho:  winget install OpenJS.NodeJS.LTS   nebo  https://nodejs.org
pause
exit /b 1
:npmfail
echo [CHYBA] npm install selhal.
:fail
pause
exit /b 1

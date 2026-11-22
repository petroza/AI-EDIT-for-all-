@echo off
rem PZ AI Cut - samostatna strizna (Electron) z tohoto repozitare -> slozka "PZ AI Cut" vedle tohoto souboru.
rem Potreba Node.js 18+ (https://nodejs.org). AI panel pouzije MY Premiere MCP (bod 1), strih funguje i bez nej.
cd /d "%~dp0pz-ai-cut"
where node >nul 2>nul || (
  echo [CHYBA] Chybi Node.js. Nainstaluj ho:  winget install OpenJS.NodeJS.LTS   nebo  https://nodejs.org
  pause & exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Instaluji Electron ^(jednou, ~100 MB^)...
  call npm install --no-audit --no-fund || ( echo [CHYBA] npm install selhal. & pause & exit /b 1 )
)
node tools\pack-portable.js "%~dp0PZ AI Cut" %* || ( pause & exit /b 1 )
echo.
echo [OK] Spust: "%~dp0PZ AI Cut\PZ AI Cut.exe"   (nebo START.bat - volba 1)
echo      Potreba je i ffmpeg: s MY Premiere MCP je pribaleny, jinak  winget install Gyan.FFmpeg
pause

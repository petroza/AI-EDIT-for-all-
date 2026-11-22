@echo off
rem PZ AI Cut Web - sestavi webovou verzi (web\dist ve zdrojovem kodu) a spusti ji na http://127.0.0.1:8791/
rem Potreba Node.js 18+. Bez dalsich balicku. Otevri v Google Chrome nebo Edge (pocitac).
set "PLUG=%~dp0PZ AI Cut web - plugin pro Claude"
cd /d "%~dp0PZ AI Cut - standalone a web - zdrojovy kod"
where node >nul 2>nul
if errorlevel 1 goto nonode
node web\build.js
if errorlevel 1 goto fail
if not exist "%PLUG%" mkdir "%PLUG%"
copy /Y "web\dist\pz-ai-cut-plugin.zip" "%PLUG%\PZ AI Cut web - plugin pro Claude.zip" >nul
echo.
echo Web bezi na http://127.0.0.1:8791/  - zavrenim tohoto okna se zastavi
echo Na vlastni Cloudflare Pages: web\dist nahraj jako staticky web, viz web\README.md ve zdrojovem kodu.
start "" "http://127.0.0.1:8791/"
node web\serve.js 8791
exit /b 0
:nonode
echo [CHYBA] Chybi Node.js. Nainstaluj ho:  winget install OpenJS.NodeJS.LTS   nebo  https://nodejs.org
:fail
pause
exit /b 1

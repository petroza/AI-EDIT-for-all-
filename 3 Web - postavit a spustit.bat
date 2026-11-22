@echo off
rem PZ AI Cut Web - sestavi webovou verzi (pz-ai-cut\web\dist) a spusti ji na http://127.0.0.1:8791/
rem Potreba Node.js 18+. Bez dalsich balicku. Otevri v Google Chrome nebo Edge (pocitac).
cd /d "%~dp0pz-ai-cut"
where node >nul 2>nul || (
  echo [CHYBA] Chybi Node.js. Nainstaluj ho:  winget install OpenJS.NodeJS.LTS   nebo  https://nodejs.org
  pause & exit /b 1
)
node web\build.js || ( pause & exit /b 1 )
if not exist "%~dp0Plugin pz-ai-cut" mkdir "%~dp0Plugin pz-ai-cut"
copy /Y "web\dist\pz-ai-cut-plugin.zip" "%~dp0Plugin pz-ai-cut\" >nul
echo.
echo Web bezi na http://127.0.0.1:8791/  (zavrenim tohoto okna se zastavi)
echo Na vlastni Cloudflare Pages: web\dist nahraj jako staticky web (viz pz-ai-cut\web\README.md).
start "" "http://127.0.0.1:8791/"
node web\serve.js 8791

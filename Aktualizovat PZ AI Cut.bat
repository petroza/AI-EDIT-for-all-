@echo off
rem Znovu sestavi PZ AI Cut\ z vyvojove slozky O:\TN_strihatko (config.json aplikace zustane).
set "SRC=O:\TN_strihatko"
set "DST=%~dp0PZ AI Cut"
if not exist "%SRC%\node_modules\electron\dist\electron.exe" (
  echo [CHYBA] Nenalezeno %SRC%\node_modules\electron - nejdriv npm install v %SRC%.
  pause & exit /b 1
)
tasklist /FI "IMAGENAME eq PZ AI Cut.exe" | find /I "PZ AI Cut.exe" >nul && (
  echo [CHYBA] PZ AI Cut bezi - zavri ho a spust znovu.
  pause & exit /b 1
)
robocopy "%SRC%\node_modules\electron\dist" "%DST%" /E /MT:8 /NFL /NDL /NJH /NJS /NP /XF electron.exe default_app.asar >nul
copy /Y "%SRC%\node_modules\electron\dist\electron.exe" "%DST%\PZ AI Cut.exe" >nul
robocopy "%SRC%" "%DST%\resources\app" /MIR /MT:8 /NFL /NDL /NJH /NJS /NP /XD node_modules .git .wrangler test team "%SRC%\web\dist" "%SRC%\web\test-out" "%SRC%\web\codex" /XF .env *.tnproj.tmp START.bat package-lock.json deploy.js wrangler.jsonc config.json >nul
if %errorlevel% GEQ 8 ( echo [CHYBA] Kopirovani selhalo. & pause & exit /b 1 )
if not exist "%DST%\resources\app\config.json" copy /Y "%SRC%\config.json" "%DST%\resources\app\config.json" >nul
copy /Y "%SRC%\web\dist\pz-ai-cut-plugin.zip" "%~dp0Plugin pz-ai-cut\" >nul 2>nul
echo [OK] PZ AI Cut aktualizovan.
pause

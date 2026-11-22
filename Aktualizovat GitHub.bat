@echo off
rem Prevezme posledni commity z vyvojovych slozek a nahraje je na GitHub (AI-EDIT-for-all-).
rem Necommitnute zmeny ve vyvojovych slozkach se nenahraji.
cd /d "%~dp0"
git subtree pull -q --prefix="PZ AI Cut - standalone a web - zdrojovy kod" O:/TN_strihatko master -m "PZ AI Cut: aktualizace z O:\TN_strihatko"
if errorlevel 1 goto chyba
git subtree pull -q --prefix="MY Premiere MCP - plugin do Premiere - zdrojovy kod" O:/ADOBEPREMIERESTRIH main -m "MY Premiere MCP: aktualizace z O:\ADOBEPREMIERESTRIH"
if errorlevel 1 goto chyba
copy /Y "O:\TN_strihatko\web\dist\pz-ai-cut-plugin.zip" "PZ AI Cut web - plugin pro Claude\PZ AI Cut web - plugin pro Claude.zip" >nul 2>nul
git add -A
git diff --cached --quiet || git commit -q -m "Rozcestnik: aktualizace"
git push origin main
if errorlevel 1 goto chyba
echo [OK] GitHub aktualizovan.
pause
exit /b 0
:chyba
echo [CHYBA] Aktualizace se nepovedla - viz vypis vyse.
pause
exit /b 1

@echo off
rem Prevezme posledni commity z vyvojovych slozek a nahraje je na GitHub (AI-EDIT-for-all-).
rem Necommitnute zmeny ve vyvojovych slozkach se nenahraji.
cd /d "%~dp0"
git subtree pull -q --prefix=pz-ai-cut O:/TN_strihatko master -m "pz-ai-cut: aktualizace z O:\TN_strihatko" || goto chyba
git subtree pull -q --prefix=my-premiere-mcp O:/ADOBEPREMIERESTRIH main -m "my-premiere-mcp: aktualizace z O:\ADOBEPREMIERESTRIH" || goto chyba
git add -A && git diff --cached --quiet || git commit -q -m "Rozcestnik: aktualizace"
git push origin main || goto chyba
echo [OK] GitHub aktualizovan.
pause
exit /b 0
:chyba
echo [CHYBA] Aktualizace se nepovedla - viz vypis vyse.
pause
exit /b 1

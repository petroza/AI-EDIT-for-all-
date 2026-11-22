@echo off
rem AI STRIH ALL app - rozcestnik programu pro AI strih
cd /d "%~dp0"
title AI STRIH - rozcestnik
:menu
cls
echo.
echo   AI STRIH - programy
echo   ===================
echo.
echo   1  PZ AI Cut (aplikace v PC)         - strih jako v Premiere + AI panel, bez Adobe
echo   2  PZ AI Cut (web v Chrome)          - https://pz-ai-cut.pages.dev, nic se neinstaluje
echo   3  MY Premiere MCP - instalace       - panel a AI nastroje do Adobe Premiere (stahne se z internetu)
echo   4  Pluginy pro aplikaci Claude       - otevre slozky s pluginy (nahrat v Claude: Plugins - Upload)
echo   5  Navod (README.md)
echo.
echo   0  Konec
echo.
set "volba="
set /p volba="  Volba: "
if "%volba%"=="1" start "" "%~dp0PZ AI Cut\PZ AI Cut.exe" & goto :eof
if "%volba%"=="2" start "" "https://pz-ai-cut.pages.dev" & goto :eof
if "%volba%"=="3" call "%~dp0MY Premiere MCP\Instalace online\Instalace.cmd" & goto menu
if "%volba%"=="4" start "" explorer "%~dp0Plugin pz-ai-cut" & start "" explorer "%~dp0MY Premiere MCP\Plugin pro Claude" & goto menu
if "%volba%"=="5" start "" notepad "%~dp0README.md" & goto menu
if "%volba%"=="0" goto :eof
goto menu

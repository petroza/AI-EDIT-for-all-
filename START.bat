@echo off
rem AI STRIH - rozcestnik: Premiere plugin, samostatna strizna, webova verze
cd /d "%~dp0"
title AI STRIH - rozcestnik
:menu
cls
echo.
echo   AI STRIH - programy
echo   ===================
echo.
echo   1  PZ AI Cut (aplikace v PC)      - spustit samostatnou striznu (kdyz chybi, nejdriv ji postavi)
echo   2  PZ AI Cut (web)                - online https://pz-ai-cut.pages.dev
echo   3  PZ AI Cut (web z tohoto PC)    - postavit a spustit na http://127.0.0.1:8791/
echo   4  MY Premiere MCP                - instalace panelu a AI nastroju do Adobe Premiere
echo   5  Pluginy pro aplikaci Claude    - otevre oba pluginy (Claude: Plugins - Upload)
echo   6  Navod (README.md)
echo.
echo   0  Konec
echo.
set "volba="
set /p volba="  Volba: "
if "%volba%"=="1" goto app
if "%volba%"=="2" start "" "https://pz-ai-cut.pages.dev" & goto :eof
if "%volba%"=="3" call "%~dp03 Web - postavit a spustit.bat" & goto :eof
if "%volba%"=="4" call "%~dp01 Premiere plugin - instalace.bat" & goto menu
if "%volba%"=="5" start "" explorer "%~dp0PZ AI Cut web - plugin pro Claude" & start "" explorer "%~dp0MY Premiere MCP - plugin do Premiere - zdrojovy kod\PLUGIN CLAUDE" & goto menu
if "%volba%"=="6" start "" notepad "%~dp0README.md" & goto menu
if "%volba%"=="0" goto :eof
goto menu

:app
set "APPEXE=%~dp0PZ AI Cut - hotova aplikace pro Windows\PZ AI Cut.exe"
if not exist "%APPEXE%" call "%~dp02 Standalone - postavit.bat"
if exist "%APPEXE%" start "" "%APPEXE%"
goto :eof

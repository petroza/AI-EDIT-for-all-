@echo off
rem ============================================================
rem  MY Premiere MCP - instalace (staci poklepat)
rem
rem  Ve slozce aplikace instaluje primo do ni. Na jinem PC staci
rem  tyhle 2 soubory (Instalace.cmd + install-online.ps1) - kod
rem  se pak stahne z GitHubu. Je-li vedle slozka "offline",
rem  modely a balicky se berou z ni (bez internetu).
rem
rem  Volitelne prepinace (z prikazove radky):
rem     Instalace.cmd -CheckOnly                jen kontrola, nic nemeni
rem     Instalace.cmd -Target D:\MYpremiereMCP  jina slozka
rem     Instalace.cmd -Hermes                   i Hermes (~23 GB)
rem     Instalace.cmd -NoLocalLLM               bez lokalniho LLM
rem     Instalace.cmd -SkipModels               jen panel a MCP
rem
rem  Kdyz IT blokuje PowerShell: instalace-bez-powershellu.cmd
rem ============================================================
title MY Premiere MCP - instalace
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-online.ps1" %*
set RC=%errorlevel%
echo.
if %RC% NEQ 0 (
    echo [CHYBA] Instalace neprobehla uplne - viz vypis vyse
    echo         a INSTALL\install-log.txt ve slozce aplikace.
) else (
    echo [OK] Hotovo. Restartuj Premiere Pro a otevri
    echo      Okno - Rozsireni - MY Premiere MCP.
)
echo.
pause
exit /b %RC%

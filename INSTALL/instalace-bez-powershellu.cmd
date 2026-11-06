@echo off
rem ============================================================
rem  MY Premiere MCP - nouzova instalace BEZ PowerShellu a bez prav spravce
rem  Pro PC, kde IT blokuje PowerShell skripty / instalace programu.
rem  Potreba: slozka s pribalenym tools\node a tools\python311 (prenosna kopie).
rem  Dela jen uzivatelske veci: propojeni panelu, HKCU registr, mcp.json, registrace MCP.
rem ============================================================
setlocal
cd /d "%~dp0.."
set "ROOT=%CD%"
set "NODE=%ROOT%\tools\node\node.exe"
where node >nul 2>nul && set "NODE=node"
if not exist "%ROOT%\server\index.js" ( echo [CHYBA] Spust z podslozky INSTALL kompletni slozky aplikace. & goto :end )
if "%NODE%"=="%ROOT%\tools\node\node.exe" if not exist "%NODE%" ( echo [CHYBA] Chybi Node.js i pribaleny tools\node\node.exe. & goto :end )

echo [1] Panel do Premiere (propojeni do %%APPDATA%%\Adobe\CEP\extensions)
set "EXT=%APPDATA%\Adobe\CEP\extensions\com.pz.premieremcp"
if not exist "%APPDATA%\Adobe\CEP\extensions" mkdir "%APPDATA%\Adobe\CEP\extensions"
if exist "%EXT%" rmdir "%EXT%"
mklink /J "%EXT%" "%ROOT%\panel"
if not exist "%EXT%\index.html" ( echo [CHYBA] Propojeni panelu se nepovedlo - existuje %EXT% jako bezna slozka? Smaz ji a spust znovu. & goto :end )

echo [2] Povoleni nepodepsanych rozsireni CEP (HKCU, bez prav spravce)
for %%v in (11 12 13 14 15) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

echo [3] mcp.json a umisteni aplikace
"%NODE%" -e "const fs=require('fs'),p=require('path'),r=process.argv[1];const s=p.join(r,'server','index.js').replace(/\\/g,'/');fs.writeFileSync(p.join(r,'mcp.json'),JSON.stringify({mcpServers:{premiere:{command:'node',args:[s]}}},null,2)+'\n');const d=p.join(process.env.APPDATA,'MYpremiereMCP');fs.mkdirSync(d,{recursive:true});fs.writeFileSync(p.join(d,'root.txt'),r);console.log('   mcp.json ->',s)" "%ROOT%"
echo [4] Registrace MCP serveru premiere (Claude Code / Claude Desktop / Codex)
"%NODE%" "%ROOT%\scripts\register.mjs"

echo.
echo [OK] Hotovo. Restartuj Premiere Pro (Okno - Rozsireni - MY Premiere MCP) a zacni novou relaci Claude.
:end
echo.
pause

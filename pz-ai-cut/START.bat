@echo off
rem TN Střihátko – spuštění (první spuštění doinstaluje Electron do složky aplikace)
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Instaluji Electron...
  call npm install --no-audit --no-fund
)
start "" "node_modules\electron\dist\electron.exe" .

# PZ AI Cut – připojení Codexu (Windows). Spuštění v PowerShellu:
#   irm https://pz-ai-cut.pages.dev/codex/install.ps1 | iex
# Stáhne konektor do %USERPROFILE%\.pz-ai-cut a zapíše ho do nastavení Codexu (~/.codex/config.toml, se zálohou).
$ErrorActionPreference = 'Stop'
$base = 'https://pz-ai-cut.pages.dev/codex'
$dir = Join-Path $env:USERPROFILE '.pz-ai-cut'
New-Item -ItemType Directory -Force -Path (Join-Path $dir 'server') | Out-Null
foreach ($f in 'server/index.js', 'server/tools.js', 'start.cmd') {
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$f" -OutFile (Join-Path $dir ($f -replace '/', '\'))
}
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
New-Item -ItemType Directory -Force -Path $codexHome | Out-Null
$cfg = Join-Path $codexHome 'config.toml'
$text = ''
if (Test-Path $cfg) {
  Copy-Item $cfg "$cfg.bak-pz-ai-cut" -Force
  $text = [IO.File]::ReadAllText($cfg)
  # starý záznam PZ AI Cut pryč (tabulka [mcp_servers.pz-ai-cut] i její podtabulky)
  $out = New-Object System.Collections.Generic.List[string]; $skip = $false
  foreach ($line in ($text -split "`r?`n")) {
    if ($line -match '^\s*\[') { $skip = $line -match '^\s*\[\s*mcp_servers\.("?)pz-ai-cut\1\s*[\].]' }
    if (-not $skip) { $out.Add($line) }
  }
  $text = (($out -join "`n").TrimEnd()) + "`n"
}
$start = Join-Path $dir 'start.cmd'
$block = @"

# PZ AI Cut (https://pz-ai-cut.pages.dev) - connector to the editor in Chrome
[mcp_servers.pz-ai-cut]
command = 'cmd.exe'
args = ['/d', '/s', '/c', 'call', '$start']
startup_timeout_sec = 30
tool_timeout_sec = 300
default_tools_approval_mode = 'approve'
"@
[IO.File]::WriteAllText($cfg, $text + $block, (New-Object System.Text.UTF8Encoding $false))
Write-Host ''
Write-Host 'PZ AI Cut je pripojeny ke Codexu. / PZ AI Cut is connected to Codex.' -ForegroundColor Green
Write-Host 'Ukonci Codex uplne a spust ho znovu. / Quit Codex completely and start it again.'

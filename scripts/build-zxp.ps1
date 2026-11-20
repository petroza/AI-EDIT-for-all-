# Podepsany panel MY Premiere MCP (.zxp) pro firemni PC, kde IT nepovoli PlayerDebugMode (nepodepsane CEP
# rozsireni se v Premiere vubec neukaze - Nova 2026-11).
#
#   1) ZXPSignCmd.exe (Adobe, https://github.com/Adobe-CEP/CEP-Resources -> ZXPSignCMD\4.x\win64) dej do tools\
#   2) Certifikat: firemni code-signing .p12 od IT, nebo self-signed (CEP ho prijme, kdyz ma casove razitko):
#        powershell -ExecutionPolicy Bypass -File scripts\build-zxp.ps1 -NewCert
#   3) Podpis + balicek:
#        powershell -ExecutionPolicy Bypass -File scripts\build-zxp.ps1
#      -> INSTALL\MYPremiereMCP.zxp
#   4) Instalace na PC (Adobe UPIA, je soucasti Creative Cloud):
#        powershell -ExecutionPolicy Bypass -File scripts\build-zxp.ps1 -Install
#
# Heslo k certifikatu se zadava interaktivne (neuklada se). Panel z .zxp lezi ve slozce Adobe, ne ve slozce
# aplikace - server a Worker najde pres %APPDATA%\MYpremiereMCP\root.txt (zapisuje instalator INSTALL\install.ps1).
# Bez diakritiky zamerne: PowerShell 5.1 cte .ps1 bez BOM jako ANSI.
param(
    [switch]$NewCert,
    [switch]$Install,
    [string]$Cert = '',
    [string]$Out = '',
    [string]$Tsa = 'http://timestamp.digicert.com'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sign = Join-Path $root 'tools\ZXPSignCmd.exe'
if (-not $Cert) { $Cert = Join-Path $root 'INSTALL\cert\MYPremiereMCP.p12' }
if (-not $Out) { $Out = Join-Path $root 'INSTALL\MYPremiereMCP.zxp' }

function Get-Plain([string]$prompt) {
    $sec = Read-Host -AsSecureString $prompt
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

if ($Install) {
    if (-not (Test-Path $Out)) { throw "Chybi $Out - nejdriv ho vytvor (bez -Install)." }
    $upia = 'C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe'
    if (-not (Test-Path $upia)) { throw "Adobe UPIA nenalezen ($upia) - nainstaluj Creative Cloud, nebo .zxp nainstaluj nastrojem IT." }
    # stary vyvojarsky odkaz (junction na slozku panel) by se s podepsanou instalaci pral o stejne ID rozsireni
    $dev = Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.pz.premieremcp'
    if (Test-Path $dev) {
        $it = Get-Item -LiteralPath $dev -Force
        if ($it.LinkType) { cmd /c rmdir "$dev" | Out-Null; Write-Host "Odstranen vyvojarsky odkaz $dev" }
    }
    & $upia /install $Out
    Write-Host 'Hotovo - restartuj Premiere a otevri Okno > Rozsireni > MY Premiere MCP.'
    exit $LASTEXITCODE
}

if (-not (Test-Path $sign)) {
    throw "Chybi $sign. Stahni ZXPSignCmd.exe (Adobe-CEP/CEP-Resources, ZXPSignCMD, win64) a dej ho do tools\."
}

if ($NewCert) {
    New-Item -ItemType Directory -Force (Split-Path $Cert) | Out-Null
    $pw = Get-Plain 'Heslo pro novy certifikat'
    & $sign -selfSignedCert CZ Praha 'TV Nova' 'MY Premiere MCP' $pw $Cert -validityDays 3650
    if ($LASTEXITCODE) { throw 'Vytvoreni certifikatu selhalo.' }
    Write-Host "Certifikat: $Cert (uschovej heslo; .p12 nepatri do gitu)"
    exit 0
}

if (-not (Test-Path $Cert)) { throw "Chybi certifikat $Cert - spust s -NewCert, nebo zadej -Cert cesta.p12 od IT." }

# Do balicku jen panel (bez ladicich souboru) - podpis kontroluje kazdy soubor, pozdejsi zmena panelu = novy .zxp
$stage = Join-Path $env:TEMP ('pmcp-zxp-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
Copy-Item -Recurse (Join-Path $root 'panel') $stage
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $stage '.debug')
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
if (Test-Path $Out) { Remove-Item -Force $Out }
$pw = Get-Plain 'Heslo k certifikatu'
& $sign -sign $stage $Out $Cert $pw -tsa $Tsa
$code = $LASTEXITCODE
Remove-Item -Recurse -Force $stage
if ($code) { throw "Podpis selhal (kod $code). Bez internetu zkus -Tsa '' (bez casoveho razitka plati jen do expirace certifikatu)." }
& $sign -verify $Out
Write-Host "Podepsany balicek: $Out"
Write-Host 'Instalace: powershell -ExecutionPolicy Bypass -File scripts\build-zxp.ps1 -Install'

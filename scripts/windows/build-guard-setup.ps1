<#
Builds the only public Windows artifact: ChaqimchiAI Guard Setup.exe.

Prerequisites on a Windows release machine:
  - Go
  - Inno Setup 6 (iscc.exe on PATH)
  - goversioninfo.exe (Windows version metadata and icon resource)

The output is intentionally not packed with UPX. It remains unsigned during
MVP/Beta unless a certificate is available; run the VirusTotal gate before
publishing it.
#>
[CmdletBinding()]
param(
  [string]$Version = "0.1.0",
  [string]$ServerUrl = "https://api.guard.chaqimchi-ai.uz",
  [string]$ISCC = "iscc.exe",
  [string]$GoVersionInfo = "goversioninfo.exe"
)

$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
$agentRoot = Join-Path $repoRoot "agent"
$buildDir = Join-Path $agentRoot "build"
$payloadDir = Join-Path $agentRoot "cmd\installer\payload"
$installerSource = Join-Path $scriptRoot "chaqimchi-guard.iss"
$iconPath = Join-Path $repoRoot "parent-web\src\app\favicon.ico"

# Windows VersionInfo fields (and Inno Setup's VersionInfoVersion) require a
# purely numeric a.b.c.d string, so an RC/pre-release tag like
# "0.4.0-rc.1" can't be used verbatim. Keep the full string as the
# user-visible AppVersion and derive a 4-part numeric build number from the
# leading release part (CT-04: "0.4.0" -> "0.4.0.0").
$numericVersion = ($Version -split '[-+]', 2)[0]
$versionParts = @($numericVersion -split '\.') + @('0', '0', '0', '0')
$numericVersion = ($versionParts[0..3] -join '.')

$uri = [Uri]$ServerUrl
if ($uri.Scheme -ne "https") {
  throw "Public build uchun ServerUrl HTTPS bo‘lishi shart. Local development uchun agentni --allow-insecure-http bilan alohida ishga tushiring."
}
if (-not (Get-Command $ISCC -ErrorAction SilentlyContinue)) {
  throw "iscc.exe topilmadi. Inno Setup 6 o‘rnating yoki -ISCC orqali aniq yo‘lni bering."
}
if (-not (Get-Command $GoVersionInfo -ErrorAction SilentlyContinue)) {
  throw "goversioninfo.exe topilmadi. Uni bir marta 'go install github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest' orqali o‘rnating yoki -GoVersionInfo bilan yo‘lini bering."
}
if (-not (Test-Path $iconPath -PathType Leaf)) {
  throw "Brend icon topilmadi: $iconPath"
}

New-Item -ItemType Directory -Force -Path $buildDir, $payloadDir | Out-Null
$agentExe = Join-Path $buildDir "ChaqimchiAI Guard.exe"
$bootstrapExe = Join-Path $buildDir "ChaqimchiAI Guard Installer.exe"
$desktopExe = Join-Path $buildDir "ChaqimchiAI Guard Desktop.exe"

# Agent/installer windows render through WebView2 (docs/webview-ui-plan.md).
# Fetch Microsoft's Evergreen Bootstrapper fresh on every build rather than
# committing a third-party binary to the repo; the .iss only runs it when
# the runtime isn't already on the machine, and a failure there is
# non-fatal (every WebView2 window falls back to a native dialog) — but a
# failure *here* should stop the build, since a release built without it
# would silently ship without the runtime installer at all.
$webview2BootstrapExe = Join-Path $buildDir "MicrosoftEdgeWebview2Setup.exe"
Write-Host "WebView2 Evergreen Bootstrapper yuklanmoqda..."
Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $webview2BootstrapExe -UseBasicParsing
if (-not (Test-Path $webview2BootstrapExe -PathType Leaf) -or (Get-Item $webview2BootstrapExe).Length -lt 500KB) {
  throw "WebView2 Bootstrapper yuklab olinmadi yoki kutilganidan kichik: $webview2BootstrapExe"
}

function New-VersionResource {
  param(
    [string]$OutputPath,
    [string]$ManifestPath,
    [string]$InternalName,
    [string]$OriginalName,
    [string]$Description
  )

  # goversioninfo (>= v1.4) still requires a base versioninfo.json positional
  # argument even when every field is supplied via flags; without one it
  # aborts with "cannot open versioninfo.json". Hand it a throwaway empty
  # object so the flags below fully define the resource.
  $baseJson = Join-Path ([System.IO.Path]::GetTempPath()) ("goversioninfo-" + [System.Guid]::NewGuid().ToString("N") + ".json")
  Set-Content -Path $baseJson -Value "{}" -Encoding ascii

  $resourceArgs = @(
    "-64",
    "-o=$OutputPath",
    "-manifest=$ManifestPath",
    "-icon=$iconPath",
    "-application-icon=$iconPath",
    "-company=ChaqimchiAI",
    "-description=$Description",
    "-file-version=$Version",
    "-internal-name=$InternalName",
    "-original-name=$OriginalName",
    "-product-name=ChaqimchiAI Guard",
    "-product-version=$Version",
    "-copyright=Copyright (c) ChaqimchiAI",
    $baseJson
  )
  try {
    & $GoVersionInfo @resourceArgs
    if ($LASTEXITCODE -ne 0) { throw "Windows metadata resursi yaratilmadi: $OriginalName" }
  }
  finally {
    Remove-Item -Path $baseJson -ErrorAction SilentlyContinue
  }
}

function Assert-GuiExecutable {
  param([string]$Path)

  # A Go binary built without -H=windowsgui is a console subsystem PE and
  # causes the installer to open as a console app. Keep this gate close to
  # the build so an old/manual console artifact cannot be published again.
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 0x40) { throw "PE fayl juda kichik: $Path" }
  $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
  if ($peOffset -lt 0 -or $peOffset + 0x18 -ge $bytes.Length) { throw "PE header topilmadi: $Path" }
  if ([BitConverter]::ToUInt32($bytes, $peOffset) -ne 0x00004550) { throw "PE signature yaroqsiz: $Path" }
  $subsystemOffset = $peOffset + 0x5c
  if ($subsystemOffset + 2 -gt $bytes.Length) { throw "PE subsystem topilmadi: $Path" }
  $subsystem = [BitConverter]::ToUInt16($bytes, $subsystemOffset)
  if ($subsystem -ne 2) { throw "GUI subsystem kutilgan, lekin console subsystem topildi: $Path" }
}

Push-Location $agentRoot
try {
  $env:GOOS = "windows"
  $env:GOARCH = "amd64"
  New-VersionResource (Join-Path $agentRoot "cmd\agent\resource.syso") (Join-Path $agentRoot "cmd\agent\guard.manifest") "ChaqimchiAIGuard" "ChaqimchiAI Guard.exe" "Parental Control Client"
  go build -trimpath -ldflags "-H=windowsgui -X main.version=$Version" -o $agentExe ./cmd/agent
  if ($LASTEXITCODE -ne 0) { throw "Guard agent build muvaffaqiyatsiz." }

  Copy-Item -Force $agentExe (Join-Path $payloadDir "agent.exe")
  New-VersionResource (Join-Path $agentRoot "cmd\installer\resource.syso") (Join-Path $agentRoot "cmd\installer\installer.manifest") "ChaqimchiAIGuardInstaller" "ChaqimchiAI Guard Installer.exe" "Parental Control Client"
  go build -trimpath -ldflags "-H=windowsgui -X main.defaultServerURL=$ServerUrl" -o $bootstrapExe ./cmd/installer
  if ($LASTEXITCODE -ne 0) { throw "Guard bootstrap build muvaffaqiyatsiz." }
  Assert-GuiExecutable $bootstrapExe

  New-VersionResource (Join-Path $agentRoot "cmd\desktop\resource.syso") (Join-Path $agentRoot "cmd\desktop\desktop.manifest") "ChaqimchiAIGuardDesktop" "ChaqimchiAI Guard Desktop.exe" "Parental Control Status"
  go build -trimpath -ldflags "-H=windowsgui" -o $desktopExe ./cmd/desktop
  if ($LASTEXITCODE -ne 0) { throw "Guard Desktop build muvaffaqiyatsiz." }
  Assert-GuiExecutable $desktopExe
}
finally {
  Pop-Location
}

& $ISCC "/DMyAppVersion=$Version" "/DNumericVersion=$numericVersion" "/DBootstrapPath=$bootstrapExe" "/DDesktopPath=$desktopExe" "/DWebView2BootstrapPath=$webview2BootstrapExe" $installerSource
if ($LASTEXITCODE -ne 0) { throw "Inno Setup build muvaffaqiyatsiz." }

$finalInstaller = Join-Path $repoRoot "releases\windows\ChaqimchiAI Guard Setup.exe"
if (-not (Test-Path $finalInstaller -PathType Leaf)) {
  throw "Final installer topilmadi: $finalInstaller"
}
Assert-GuiExecutable $finalInstaller

# Publish the exact artifact the /download page serves, plus the metadata that
# page renders. Both are generated here so the version, size and hash on the
# site can never drift from the file a parent actually downloads — they used
# to be typed by hand and the size had already gone stale.
$publicName = "ChaqimchiAI-Guard-Setup.exe"
$downloadsDir = Join-Path $repoRoot "parent-web\public\downloads"
New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
Copy-Item -Force $finalInstaller (Join-Path $downloadsDir $publicName)

$hash = (Get-FileHash -Algorithm SHA256 $finalInstaller).Hash.ToUpperInvariant()
$bytes = (Get-Item $finalInstaller).Length
$release = [ordered]@{
  version   = $Version
  file      = $publicName
  bytes     = $bytes
  sha256    = $hash
  date      = (Get-Date -Format "yyyy-MM-dd")
  publisher = "ChaqimchiAI (imzolanmagan — MVP/Beta)"
}
$releaseJson = Join-Path $repoRoot "parent-web\src\app\download\release.json"
# Write UTF-8 without a BOM: Windows PowerShell 5.1's `Set-Content -Encoding UTF8`
# prepends a BOM, which the Next.js `import release.json` then has to tolerate and
# which shows up as spurious diff churn. .NET's UTF8Encoding($false) is BOM-free on
# both PowerShell 5.1 and 7.
$releaseText = (($release | ConvertTo-Json) -replace "`r`n", "`n") + "`n"
[System.IO.File]::WriteAllText($releaseJson, $releaseText, (New-Object System.Text.UTF8Encoding($false)))

# Sidecar next to the artifact, in the format sign-release.ps1 expects.
"$hash  $publicName" | Set-Content -Encoding ASCII "$finalInstaller.sha256"

Write-Host "Tayyor: $finalInstaller"
Write-Host "  SHA-256: $hash"
Write-Host "  Hajmi:   $([math]::Round($bytes / 1MB, 1)) MB"
Write-Host "  Nashr metadatasi yozildi: $releaseJson"
Write-Host "Publish qilishdan oldin: VirusTotal, clean Windows 10/11 install va uninstall testlarini bajaring."

<#
Signs every ChaqimchiAI Windows executable in a release directory with an
organization-validated Authenticode certificate, timestamps it, and verifies
the resulting signature. Never put a PFX or its password in this repository.

Usage (PowerShell on Windows):
  .\scripts\windows\sign-release.ps1 -CertificatePath C:\secure\chaqimchi.pfx -ReleaseDir .\releases\windows
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path $_ -PathType Leaf })]
  [string]$CertificatePath,

  [Parameter(Mandatory = $true)]
  [securestring]$CertificatePassword,

  [string]$ReleaseDir = (Join-Path $PSScriptRoot "..\..\releases\windows"),
  [string]$TimestampUrl = "https://timestamp.digicert.com"
)

$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) {
  throw "signtool.exe topilmadi. Windows SDK o‘rnating va uning Bin katalogini PATH’ga qo‘shing."
}

$files = @(Get-ChildItem -Path $ReleaseDir -File | Where-Object {
  $_.Name -match '^(chaqimchi-.*-v\d+|ChaqimchiAI Guard Setup)\.exe$'
})
if ($files.Count -eq 0) {
  throw "Imzolanadigan release .exe fayllari topilmadi: $ReleaseDir"
}

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($CertificatePassword)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  foreach ($file in $files) {
    & $signtool.Source sign /f $CertificatePath /p $plainPassword /fd SHA256 /tr $TimestampUrl /td SHA256 /v $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Imzolash muvaffaqiyatsiz: $($file.Name)" }

    & $signtool.Source verify /pa /v $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Imzo tekshiruvi muvaffaqiyatsiz: $($file.Name)" }

    $hash = (Get-FileHash -Algorithm SHA256 $file.FullName).Hash.ToLowerInvariant()
    Set-Content -NoNewline -Path "$($file.FullName).sha256" -Value "$hash  $($file.Name)"
    Write-Host "Imzolandi va tekshirildi: $($file.Name)"
  }
}
finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

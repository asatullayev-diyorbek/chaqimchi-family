<# Verifies the signature and SHA-256 sidecar for a downloaded release. #>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path $_ -PathType Leaf })]
  [string]$Path
)

$signature = Get-AuthenticodeSignature -FilePath $Path
if ($signature.Status -ne "Valid") {
  throw "Imzo yaroqsiz: $($signature.Status)"
}

$sidecar = "$Path.sha256"
if (Test-Path $sidecar) {
  $expected = (Get-Content $sidecar -Raw).Split()[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 $Path).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "SHA-256 mos kelmadi" }
}

Write-Host "Tekshiruv muvaffaqiyatli: $($signature.SignerCertificate.Subject)"

param(
  [Parameter(Mandatory = $true)]
  [string]$Server,

  [int]$Port = 22,

  [string]$RemoteRoot = "/usr/local/nginx/html",

  [string]$IdentityFile = "",

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Quote-BashSingle {
  param([Parameter(Mandatory = $true)][string]$Text)
  # Wrap in single-quotes, escaping any embedded single-quote for bash.
  return "'" + ($Text -replace "'", "'\\''") + "'"
}

function Require-LocalFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Local file not found: $Path"
  }
}

function Invoke-ExternalOrThrow {
  param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [Parameter(Mandatory = $true)][string[]]$Args,
    [Parameter(Mandatory = $true)][string]$What
  )

  & $Exe @Args
  if ($LASTEXITCODE -ne 0) {
    throw "$What failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = $PSScriptRoot

function Decode-StaticRelativePath {
  param([Parameter(Mandatory = $true)][string]$EncodedPath)
  $decoded = [System.Uri]::UnescapeDataString($EncodedPath)
  return $decoded.Trim().TrimStart('/')
}

# Percent-encoded (ASCII-only) relative paths used by the 8 showcase cards.
# This avoids Windows PowerShell 5.1 script encoding issues with non-ASCII literals.
$relativeFilesEncoded = @(
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%EF%BC%88%E6%B2%B9%E9%BA%BB%E5%9C%B0%EF%BC%89/%E6%B2%B9%E9%BA%BB%E5%9C%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/2%E5%8F%B7%E6%88%BF/2%E5%8F%B7%E6%88%BF_%E7%BB%93%E6%9E%9C.webp",
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%EF%BC%88%E9%95%BF%E6%B2%99%E6%B9%BE%EF%BC%89/%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87%E2%80%94%E2%80%94%E4%B9%9D%E6%B1%9F%E8%A1%97/%E5%85%AC%E5%85%B1%E5%8C%BA%E5%9F%9F/%E5%89%8D%E5%8F%B0/W%E4%B8%80%E6%A5%BC%E5%89%8D%E5%8F%B0%E5%8C%BA%E5%9F%9F02.webp",
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%EF%BC%88%E5%B0%96%E6%B2%99%E5%92%80%EF%BC%89/%E5%B0%96%E6%B2%99%E5%92%80%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E5%B0%96%E6%B2%99%E5%92%80%20%E5%A4%96%E5%9B%B4%E9%97%A8%E7%89%8C%E5%9B%BE%E7%89%87_%E7%BB%93%E6%9E%9C.webp",
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%E9%9D%92%E5%B9%B4%E5%85%AC%E5%AF%93%EF%BC%88%E5%9F%8E%E6%B1%87%E5%A5%A5%E8%BF%90%EF%BC%89/%E5%85%AC%E5%85%B1%E5%8C%BA%E5%9F%9F/%E5%A4%A7%E5%A0%82_%E7%BB%93%E6%9E%9C.webp",
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%EF%BC%88%E8%A5%BF%E8%90%A5%E7%9B%98%E4%B8%80%E6%9C%9F%EF%BC%89%E5%85%86%E5%AE%89%E5%A4%A7%E5%8E%A6/RoomD/RoomD_%E7%BB%93%E6%9E%9C.webp",
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%EF%BC%88%E8%A5%BF%E8%90%A5%E7%9B%98%E4%BA%8C%E6%9C%9F%EF%BC%89%E9%AB%98%E5%8D%87%E5%A4%A7%E5%8E%A6/%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/dinning%20room%204_%E7%BB%93%E6%9E%9C.webp",
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%EF%BC%88%E8%A5%BF%E8%90%A5%E7%9B%98%E4%B8%89%E6%9C%9F%EF%BC%89%E6%96%B0%E8%A1%97/%E6%96%B0%E8%A1%97%20%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/3%E5%8F%B7%E6%88%BF/3%E5%8F%B7%E6%88%BF%2002_%E7%BB%93%E6%9E%9C.webp",
  "/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/Image%206.2%20%E5%AD%A6%E7%94%9F%E5%B1%85%E7%A4%BE/2026%20%E6%9C%80%E6%96%B0%E5%85%AC%E5%AF%93%E7%85%A7%E7%89%87/%E6%B1%87%E7%94%9F%E4%BC%9A%E7%A4%BE%EF%BC%88%E8%96%84%E6%89%B6%E6%9E%97%EF%BC%89%E7%BD%AE%E5%AF%8C%E8%8A%B1%E5%9B%AD/%E5%85%AC%E5%85%B1%E5%8C%BA%E5%9F%9F/%E5%8D%95%E5%85%83%E6%A5%BC%E5%85%A8%E6%99%AF_%E7%BB%93%E6%9E%9C.webp"
)

$sshArgs = @()
$scpArgs = @()

if ($Port -ne 22) {
  $sshArgs += @('-p', "$Port")
  $scpArgs += @('-P', "$Port")
}

if ($IdentityFile -ne "") {
  if (-not (Test-Path -LiteralPath $IdentityFile)) {
    throw "IdentityFile not found: $IdentityFile"
  }
  $sshArgs += @('-i', $IdentityFile)
  $scpArgs += @('-i', $IdentityFile)
}

foreach ($relEncoded in $relativeFilesEncoded) {
  $rel = Decode-StaticRelativePath -EncodedPath $relEncoded
  $rel = ($rel -replace "[\r\n]", "").Trim()
  $localRelForWindows = ($rel -replace '/', '\\')
  $localPath = Join-Path $repoRoot $localRelForWindows
  Require-LocalFile -Path $localPath

  $remoteFile = ($RemoteRoot.TrimEnd('/') + '/' + ($rel -replace '\\', '/')).Trim()
  $remoteFile = ($remoteFile -replace "[\r\n]", "").Trim()
  $remoteDir = $remoteFile.Substring(0, $remoteFile.LastIndexOf('/')).Trim()
  $remoteDir = ($remoteDir -replace "[\r\n]", "").Trim()

  $mkdirCmd = "mkdir -p " + (Quote-BashSingle -Text $remoteDir)
  $sshFull = @('ssh') + $sshArgs + @($Server, $mkdirCmd)

  # Pass the remote path as-is (single argument). OpenSSH scp handles necessary quoting.
  $remoteSpec = "${Server}:$remoteFile"
  $scpFull = @('scp') + $scpArgs + @($localPath, $remoteSpec)

  if ($DryRun) {
    Write-Host ("[DRYRUN] " + ($sshFull -join ' '))
    Write-Host ("[DRYRUN] " + ($scpFull -join ' '))
    continue
  }

  Write-Host "==> Ensuring remote dir: $remoteDir"
  Invoke-ExternalOrThrow -Exe $sshFull[0] -Args $sshFull[1..($sshFull.Length-1)] -What "ssh mkdir"

  Write-Host "==> Uploading: $rel"
  Invoke-ExternalOrThrow -Exe $scpFull[0] -Args $scpFull[1..($scpFull.Length-1)] -What "scp upload"
}

Write-Host "OK: static assets uploaded to $RemoteRoot"

param(
  [Parameter(Mandatory = $true)]
  [string]$Server,

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

$repoRoot = $PSScriptRoot

# Files used by the 8 showcase cards in sites/sdlvhk.com/index.html
$relativeFiles = @(
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社（油麻地）/油麻地公寓照片/1号房/1号房_结果.webp",
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社（长沙湾）/公寓照片——九江街/公共区域/前台/W一楼前台区域02.webp",
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社（尖沙咀）/尖沙咀公寓照片/尖沙咀 外围门牌图片_结果.webp",
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社青年公寓（城汇奥运）/公共区域/大堂_结果.webp",
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社（西营盘一期）兆安大厦/RoomA-RoomC/RoomA-RoomC_结果_结果.webp",
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社（西营盘二期）高升大厦/公寓照片/高升大厦阳台_结果.webp",
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社（西营盘三期）新街/新街 公寓照片/公共区域/走廊_结果.webp",
  "图片素材/other/Image 6.2 学生居社/2026 最新公寓照片/汇生会社（薄扶林）置富花园/公共区域/客厅_结果.webp"
)

$sshArgs = @()
$scpArgs = @()
if ($IdentityFile -ne "") {
  if (-not (Test-Path -LiteralPath $IdentityFile)) {
    throw "IdentityFile not found: $IdentityFile"
  }
  $sshArgs += @('-i', $IdentityFile)
  $scpArgs += @('-i', $IdentityFile)
}

foreach ($rel in $relativeFiles) {
  $localPath = Join-Path $repoRoot $rel
  Require-LocalFile -Path $localPath

  $remoteFile = ($RemoteRoot.TrimEnd('/') + '/' + ($rel -replace '\\', '/'))
  $remoteDir = $remoteFile.Substring(0, $remoteFile.LastIndexOf('/'))

  $mkdirCmd = "mkdir -p " + (Quote-BashSingle -Text $remoteDir)
  $sshFull = @('ssh') + $sshArgs + @($Server, $mkdirCmd)

  # Important: wrap remote path in single-quotes (inside the scp argument) to survive spaces.
  $remoteSpec = "$Server:'$remoteFile'"
  $scpFull = @('scp') + $scpArgs + @($localPath, $remoteSpec)

  if ($DryRun) {
    Write-Host ("[DRYRUN] " + ($sshFull -join ' '))
    Write-Host ("[DRYRUN] " + ($scpFull -join ' '))
    continue
  }

  Write-Host "==> Ensuring remote dir: $remoteDir"
  & $sshFull[0] $sshFull[1..($sshFull.Length-1)]

  Write-Host "==> Uploading: $rel"
  & $scpFull[0] $scpFull[1..($scpFull.Length-1)]
}

Write-Host "OK: static assets uploaded to $RemoteRoot"

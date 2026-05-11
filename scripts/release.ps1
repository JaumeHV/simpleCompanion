param(
  [Parameter(Mandatory = $false)]
  [string]$Message,

  [Parameter(Mandatory = $false)]
  [string]$BaseBranch = "main",

  [Parameter(Mandatory = $false)]
  [switch]$SkipPush,

  [Parameter(Mandatory = $false)]
  [switch]$SkipRelease
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & git @Args
  if (-not $?) {
    throw "git command failed: git $($Args -join ' ')"
  }
}

function Get-LatestSemverTag {
  $tags = @(& git tag --list "v*" --sort=-v:refname)
  if (-not $tags -or $tags.Count -eq 0) {
    return "v0.0.0"
  }

  foreach ($tag in $tags) {
    if ($tag -match "^v(\d+)\.(\d+)\.(\d+)$") {
      return $tag
    }
  }

  throw "No semantic tags found in format vMAJOR.MINOR.PATCH."
}

function Get-NextPatchTag {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Tag
  )

  if ($Tag -notmatch "^v(\d+)\.(\d+)\.(\d+)$") {
    throw "Invalid semantic tag: $Tag"
  }

  $major = [int]$Matches[1]
  $minor = [int]$Matches[2]
  $patch = [int]$Matches[3] + 1
  return "v$major.$minor.$patch"
}

function Update-ModuleJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ModulePath,

    [Parameter(Mandatory = $true)]
    [string]$NextTag
  )

  if (-not (Test-Path -LiteralPath $ModulePath)) {
    throw "module.json not found at $ModulePath"
  }

  $content = Get-Content -LiteralPath $ModulePath -Raw
  $nextVersion = $NextTag.TrimStart("v")
  $downloadUrl = "https://github.com/JaumeHV/simpleCompanion/archive/$NextTag.zip"

  $updated = $content -replace '"version"\s*:\s*"[^"]+"', ('"version": "{0}"' -f $nextVersion)
  $updated = $updated -replace '"download"\s*:\s*"[^"]+"', ('"download": "{0}"' -f $downloadUrl)

  if ($updated -eq $content) {
    throw "module.json was not updated. Ensure it has version and download fields."
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($ModulePath, $updated, $encoding)
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

Invoke-Git -Args @("rev-parse", "--is-inside-work-tree") | Out-Null

$statusShort = @(& git status --porcelain)
if ($statusShort.Count -gt 0) {
  throw "Working tree is not clean. Commit/stash changes before running release.ps1."
}

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne $BaseBranch) {
  throw "Current branch is '$branch'. Switch to '$BaseBranch' before releasing."
}

Invoke-Git -Args @("fetch", "origin", $BaseBranch)
$localHead = (& git rev-parse HEAD).Trim()
$remoteHead = (& git rev-parse "origin/$BaseBranch").Trim()
if ($localHead -ne $remoteHead) {
  throw "Local $BaseBranch is not in sync with origin/$BaseBranch. Pull/rebase first."
}

$latestTag = Get-LatestSemverTag
$nextTag = Get-NextPatchTag -Tag $latestTag
$modulePath = Join-Path $repoRoot "module.json"

Update-ModuleJson -ModulePath $modulePath -NextTag $nextTag

Invoke-Git -Args @("add", "module.json")
Invoke-Git -Args @("add", "-A")

$finalMessage = $Message
if ([string]::IsNullOrWhiteSpace($finalMessage)) {
  $finalMessage = "release: $nextTag"
}

Invoke-Git -Args @("commit", "-m", $finalMessage)

if (-not $SkipPush) {
  Invoke-Git -Args @("push", "origin", $BaseBranch)
}

Invoke-Git -Args @("tag", $nextTag)
Invoke-Git -Args @("push", "origin", $nextTag)

if (-not $SkipRelease) {
  $ghCommand = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $ghCommand) {
    throw "GitHub CLI 'gh' is required to create a release. Install gh or run with -SkipRelease."
  }

  $title = $nextTag
  $notes = "Automated release for $nextTag"
  & gh release create $nextTag --title $title --notes $notes --target $BaseBranch
  if (-not $?) {
    throw "gh release create failed for $nextTag"
  }
}

"Release complete: $nextTag"

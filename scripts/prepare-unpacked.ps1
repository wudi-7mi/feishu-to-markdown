param(
  [ValidateSet("chrome", "edge", "firefox")]
  [string]$Browser = "edge"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$archivePath = Join-Path $projectRoot "dist\feishu-to-markdown-$Browser-$($manifest.version).zip"
if (!(Test-Path -LiteralPath $archivePath)) { throw "Build the package first: .\scripts\package-browser.ps1 -Browser $Browser" }

$runtimeRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "FeishuToMarkdown"))
$runtimeDirectory = [System.IO.Path]::GetFullPath((Join-Path $runtimeRoot $Browser))
$runtimePrefix = $runtimeDirectory.TrimEnd('\') + '\'
if ([System.IO.Path]::GetDirectoryName($runtimeDirectory) -ne $runtimeRoot) { throw "Invalid runtime directory" }
foreach ($directory in @($runtimeRoot, $runtimeDirectory)) {
  if ((Test-Path -LiteralPath $directory) -and ((Get-Item -LiteralPath $directory -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    throw "Runtime directory must not be a junction or symbolic link: $directory"
  }
}
$markerPath = Join-Path $runtimeDirectory ".feishu-runtime.json"
$previousFiles = @()
if (Test-Path -LiteralPath $markerPath) {
  $marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($marker.owner -ne "feishu-to-markdown" -or $marker.browser -ne $Browser) { throw "Unrecognized runtime directory" }
  $previousFiles = @($marker.files)
} elseif ((Test-Path -LiteralPath $runtimeDirectory) -and @(Get-ChildItem -LiteralPath $runtimeDirectory -Force).Count) {
  throw "The runtime directory contains files not created by this script: $runtimeDirectory"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $reader = [System.IO.StreamReader]::new($archive.GetEntry("manifest.json").Open())
  try { $packedManifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
  if ($packedManifest.version -ne $manifest.version) { throw "Package version does not match source" }
  $files = @($archive.Entries | Where-Object { $_.Name } | ForEach-Object { $_.FullName.Replace('/', '\') })
  # Validate every destination, including stale generated files, before writing.
  foreach ($relative in @($files) + @($previousFiles)) {
    $destination = [System.IO.Path]::GetFullPath((Join-Path $runtimeDirectory $relative))
    if (!$destination.StartsWith($runtimePrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Invalid package entry: $relative" }
  }
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  foreach ($entry in $archive.Entries) {
    if (!$entry.Name) { continue }
    $destination = Join-Path $runtimeDirectory $entry.FullName.Replace('/', '\')
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
  }
  foreach ($relative in $previousFiles) {
    if ($files -notcontains $relative) {
      $obsolete = Join-Path $runtimeDirectory $relative
      if (Test-Path -LiteralPath $obsolete -PathType Leaf) { Remove-Item -LiteralPath $obsolete -Force }
    }
  }
  $metadata = @{ owner = "feishu-to-markdown"; browser = $Browser; version = $manifest.version; files = $files } | ConvertTo-Json -Depth 4
  [System.IO.File]::WriteAllText($markerPath, $metadata, [System.Text.UTF8Encoding]::new($false))
} finally { $archive.Dispose() }

Write-Output $runtimeDirectory

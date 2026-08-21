param(
  [ValidateSet("chrome", "edge", "firefox")]
  [string]$Browser = "chrome"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$baseManifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -Raw -Encoding UTF8 $baseManifestPath | ConvertFrom-Json

if ($Browser -eq "firefox") {
  $manifestPath = Join-Path $projectRoot "manifests\manifest.firefox.json"
  $manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
}

$distDirectory = Join-Path $projectRoot "dist"
$packageName = "feishu-to-markdown-$Browser-$($manifest.version).zip"
$packagePath = Join-Path $distDirectory $packageName
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("feishu-to-markdown-" + [guid]::NewGuid().ToString("N"))

try {
  New-Item -ItemType Directory -Force -Path $distDirectory, $stagingDirectory | Out-Null
  $runtimeFiles = @("background.js", "content.js", "converter.js", "options.html", "options.css", "options.js", "icon.svg", "icon16.png", "icon32.png", "icon48.png", "icon128.png")
  foreach ($file in $runtimeFiles) { Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $stagingDirectory }
  Copy-Item -LiteralPath (Join-Path $projectRoot "_locales") -Destination $stagingDirectory -Recurse
  $manifestJson = $manifest | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText((Join-Path $stagingDirectory "manifest.json"), $manifestJson, [System.Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath $packagePath) { Remove-Item -LiteralPath $packagePath }
  Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $packagePath -CompressionLevel Optimal
  Write-Output $packagePath
} finally {
  if (Test-Path -LiteralPath $stagingDirectory) { Remove-Item -LiteralPath $stagingDirectory -Recurse -Force }
}

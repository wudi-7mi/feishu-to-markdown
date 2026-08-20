$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "manifest.json") | ConvertFrom-Json
$distDirectory = Join-Path $projectRoot "dist"
$packageName = "feishu-to-markdown-$($manifest.version).zip"
$packagePath = Join-Path $distDirectory $packageName
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("feishu-to-markdown-" + [guid]::NewGuid().ToString("N"))

if (!$stagingDirectory.StartsWith([System.IO.Path]::GetTempPath()) -or !(Split-Path -Leaf $stagingDirectory).StartsWith("feishu-to-markdown-")) {
  throw "Unsafe staging directory: $stagingDirectory"
}

$runtimeFiles = @(
  "manifest.json",
  "background.js",
  "content.js",
  "converter.js",
  "options.html",
  "options.css",
  "options.js",
  "icon.svg",
  "icon16.png",
  "icon32.png",
  "icon48.png",
  "icon128.png"
)

try {
  New-Item -ItemType Directory -Force -Path $distDirectory | Out-Null
  New-Item -ItemType Directory -Force -Path $stagingDirectory | Out-Null

  foreach ($file in $runtimeFiles) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $stagingDirectory
  }
  Copy-Item -LiteralPath (Join-Path $projectRoot "_locales") -Destination $stagingDirectory -Recurse

  if (Test-Path -LiteralPath $packagePath) {
    Remove-Item -LiteralPath $packagePath
  }
  Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $packagePath -CompressionLevel Optimal
  Write-Output $packagePath
} finally {
  if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
  }
}

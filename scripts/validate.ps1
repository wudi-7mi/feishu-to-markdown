$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json

$firefoxManifestPath = Join-Path $root "manifests\manifest.firefox.json"
if (Test-Path -LiteralPath $firefoxManifestPath) {
  $firefoxManifest = Get-Content -Raw -Encoding UTF8 $firefoxManifestPath | ConvertFrom-Json
  if ($firefoxManifest.version -ne $manifest.version) { throw "Firefox manifest version does not match root manifest" }
  if (!$firefoxManifest.browser_specific_settings.gecko.id) { throw "Firefox Gecko extension id is required" }
  $dataCollectionPermissions = @($firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required)
  if ($dataCollectionPermissions.Count -ne 1 -or $dataCollectionPermissions[0] -ne "none") {
    throw 'Firefox data_collection_permissions.required must be ["none"]'
  }
}

if ($manifest.manifest_version -ne 3) { throw "Manifest V3 is required" }
if (!$manifest.name -or !$manifest.description) { throw "Manifest name and description are required" }

foreach ($file in @("background.js", "content.js", "converter.js", "options.js")) {
  $path = Join-Path $root $file
  if (!(Test-Path -LiteralPath $path)) { throw "Missing runtime file: $file" }
  node --check $path
  if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $file" }
}

foreach ($file in @("options.html", "options.css", "icon.svg", "icon16.png", "icon32.png", "icon48.png", "icon128.png", "_locales\zh_CN\messages.json")) {
  if (!(Test-Path -LiteralPath (Join-Path $root $file))) { throw "Missing referenced asset: $file" }
}

Add-Type -AssemblyName System.Drawing
$expectedSizes = @{ "icon16.png" = 16; "icon32.png" = 32; "icon48.png" = 48; "icon128.png" = 128 }
foreach ($item in $expectedSizes.GetEnumerator()) {
  $image = [System.Drawing.Image]::FromFile((Join-Path $root $item.Key))
  try {
    if ($image.Width -ne $item.Value -or $image.Height -ne $item.Value) { throw "Invalid icon dimensions: $($item.Key)" }
  } finally { $image.Dispose() }
}

Write-Output "Extension validation passed: v$($manifest.version)"

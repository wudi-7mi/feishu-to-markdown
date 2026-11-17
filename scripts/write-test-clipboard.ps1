$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
# Accept a synthetic test payload from stdin, never from shell interpolation.
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$encoding = [System.Text.UTF8Encoding]::new($false)
$prefix = '<html><body><!--StartFragment-->'
$suffix = '<!--EndFragment--></body></html>'
$template = "Version:0.9`r`nStartHTML:{0:D10}`r`nEndHTML:{1:D10}`r`nStartFragment:{2:D10}`r`nEndFragment:{3:D10}`r`n"
$headerSize = $encoding.GetByteCount(($template -f 0,0,0,0))
$startFragment = $headerSize + $encoding.GetByteCount($prefix)
$endFragment = $startFragment + $encoding.GetByteCount([string]$payload.html)
$endHtml = $endFragment + $encoding.GetByteCount($suffix)
$html = ($template -f $headerSize,$endHtml,$startFragment,$endFragment) + $prefix + $payload.html + $suffix
$stream = [System.IO.MemoryStream]::new($encoding.GetBytes($html))
$data = [Windows.Forms.DataObject]::new()
$data.SetData([Windows.Forms.DataFormats]::Html, $false, $stream)
$data.SetData([Windows.Forms.DataFormats]::UnicodeText, [string]$payload.text)
[Windows.Forms.Clipboard]::SetDataObject($data, $true)
Write-Output 'Synthetic rich clipboard prepared'

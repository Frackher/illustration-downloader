# Build ZIP for Chrome Web Store - manifest at root, no .git / .gitignore / dev files
# Run from PowerShell outside Cursor (e.g. right-click -> Run with PowerShell) to avoid overloading the IDE.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$outZip = Join-Path $root "illustration-downloader-1.0.0.zip"
$buildDir = Join-Path $root "extension-build"

if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory -Path $buildDir | Out-Null

$toCopy = @(
    'manifest.json',
    'offscreen.html',
    'options',
    'js',
    'css',
    '_locales',
    'icons'
)
foreach ($item in $toCopy) {
    $src = Join-Path $root $item
    $dst = Join-Path $buildDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Recurse -Force
    }
}

if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $buildDir '*') -DestinationPath $outZip
Remove-Item $buildDir -Recurse -Force
Write-Host "Created: $outZip"

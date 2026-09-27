# Regenerate WiX MSI UI bitmaps (493x58 banner, 493x312 welcome/finish dialog).
# WiX draws black title/body text on top of these images — keep text regions light.
param(
    [string]$IconPath = (Join-Path $PSScriptRoot "..\src-tauri\icons\128x128.png"),
    [string]$OutDir = (Join-Path $PSScriptRoot "..\src-tauri\windows")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Save-Bmp24([System.Drawing.Bitmap]$bmp, [string]$path) {
    $dir = Split-Path $path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
}

function Draw-Logo([System.Drawing.Graphics]$g, [string]$iconPath, [int]$x, [int]$y, [int]$size) {
    $icon = [System.Drawing.Image]::FromFile((Resolve-Path $iconPath))
    try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.DrawImage($icon, $x, $y, $size, $size)
    } finally {
        $icon.Dispose()
    }
}

# Brand panel (left strip on welcome/finish)
$brand = [System.Drawing.Color]::FromArgb(36, 24, 16)
$panelLight = [System.Drawing.Color]::FromArgb(245, 245, 245)
$white = [System.Drawing.Color]::White

$dialogTextLeft = 135

# --- dialog.bmp (493 x 312): logo strip + white text area ---
$dialogW = 493
$dialogH = 312
$dialog = New-Object System.Drawing.Bitmap $dialogW, $dialogH
$dg = [System.Drawing.Graphics]::FromImage($dialog)
try {
    $dg.Clear($white)
    $brandBrush = New-Object System.Drawing.SolidBrush $brand
    $dg.FillRectangle($brandBrush, 0, 0, $dialogTextLeft, $dialogH)
    $brandBrush.Dispose()

    $logoSize = 88
    $logoX = [int](($dialogTextLeft - $logoSize) / 2)
    $logoY = [int](($dialogH - $logoSize) / 2)
    Draw-Logo $dg $IconPath $logoX $logoY $logoSize

    Save-Bmp24 $dialog (Join-Path $OutDir "dialog.bmp")
} finally {
    $dg.Dispose()
    $dialog.Dispose()
}

# --- banner.bmp (493 x 58): light title area + small logo on the right ---
$bannerW = 493
$bannerH = 58
$banner = New-Object System.Drawing.Bitmap $bannerW, $bannerH
$bg = [System.Drawing.Graphics]::FromImage($banner)
try {
    $bg.Clear($panelLight)
    $accentBrush = New-Object System.Drawing.SolidBrush $brand
    $bg.FillRectangle($accentBrush, $bannerW - $bannerH, 0, $bannerH, $bannerH)
    $accentBrush.Dispose()

    $bannerLogo = 44
    $bx = $bannerW - $bannerH + [int](($bannerH - $bannerLogo) / 2)
    $by = [int](($bannerH - $bannerLogo) / 2)
    Draw-Logo $bg $IconPath $bx $by $bannerLogo

    Save-Bmp24 $banner (Join-Path $OutDir "banner.bmp")
} finally {
    $bg.Dispose()
    $banner.Dispose()
}

Write-Host "Wrote banner.bmp and dialog.bmp to $OutDir"

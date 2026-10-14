param([string]$Source, [string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($Source)
$bmp = New-Object System.Drawing.Bitmap 256, 240
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Black)
# Crop only the white sides of the official 554x442 portrait.
$crop = New-Object System.Drawing.Rectangle 41, 0, 472, 442
$target = New-Object System.Drawing.Rectangle 0, 0, 256, 240
$g.DrawImage($src, $target, $crop, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$writer = [System.IO.StreamWriter]::new($Output, $false, [System.Text.Encoding]::ASCII)
for ($y = 0; $y -lt 240; $y++) {
    for ($x = 0; $x -lt 256; $x++) {
        $p = $bmp.GetPixel($x, $y)
        $r = [int]$p.R
        $g = [int]$p.G
        $b = [int]$p.B
        $rgb565 = ((($r -shr 3) -shl 11) -bor (($g -shr 2) -shl 5) -bor ($b -shr 3))
        $writer.WriteLine($rgb565.ToString('X4'))
    }
}
$writer.Close()
$bmp.Dispose()
$src.Dispose()

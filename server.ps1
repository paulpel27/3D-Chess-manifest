# Zero-Dependency Local HTTP Server for Grandmaster 3D Chess PWA (Port 8080)
# Automatically generates icons/icon-192.png (192x192) and icons/icon-512.png (512x512) on startup
# Supports HTTP GET, HEAD, and OPTIONS (CORS) for full PWABuilder compatibility
param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'SilentlyContinue'
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconsDir = Join-Path $RootDir 'icons'
if (!(Test-Path $IconsDir)) { New-Item -ItemType Directory -Path $IconsDir | Out-Null }

# Ensure physical 192x192 and 512x512 PNG files exist on disk
try {
  Add-Type -AssemblyName System.Drawing
  foreach ($size in @(192, 512)) {
    $pngPath = Join-Path $IconsDir "icon-$size.png"
    if (!(Test-Path $pngPath)) {
      $bmp = New-Object System.Drawing.Bitmap($size, $size)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.SmoothingMode = 'AntiAlias'
      $g.Clear([System.Drawing.Color]::FromArgb(255, 14, 18, 28))

      $penWidth = [Math]::Max(4, [int]($size * 0.035))
      $goldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 212, 175, 55), $penWidth)
      $pad = [int]($size * 0.08)
      $g.DrawRectangle($goldPen, $pad, $pad, $size - 2 * $pad, $size - 2 * $pad)

      $font = New-Object System.Drawing.Font('Segoe UI Symbol', [int]($size * 0.48), [System.Drawing.FontStyle]::Bold)
      $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 215, 110))
      $sf = New-Object System.Drawing.StringFormat
      $sf.Alignment = 'Center'
      $sf.LineAlignment = 'Center'
      $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
      $g.DrawString([char]0x265E, $font, $goldBrush, $rect, $sf)
      $g.Dispose()
      $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
    }
  }
} catch {}

$MimeTypes = @{
  '.html'        = 'text/html; charset=utf-8'
  '.htm'         = 'text/html; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.js'          = 'application/javascript; charset=utf-8'
  '.json'        = 'application/manifest+json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'         = 'image/svg+xml'
  '.png'         = 'image/png'
  '.ico'         = 'image/x-icon'
  '.bat'         = 'application/octet-stream'
}

$Endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Loopback, $Port)
$Listener = New-Object System.Net.Sockets.TcpListener($Endpoint)

try {
  $Listener.Start()
} catch {
  exit 0
}

while ($true) {
  try {
    $Client = $Listener.AcceptTcpClient()
    $Stream = $Client.GetStream()
    $Reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)

    $RequestLine = $Reader.ReadLine()
    if ([string]::IsNullOrEmpty($RequestLine)) {
      $Client.Close()
      continue
    }

    while ($true) {
      $HeaderLine = $Reader.ReadLine()
      if ([string]::IsNullOrEmpty($HeaderLine)) { break }
    }

    $Parts = $RequestLine.Split(' ')
    $Method = if ($Parts.Length -ge 1) { $Parts[0].ToUpper() } else { 'GET' }
    $RawPath = if ($Parts.Length -ge 2) { $Parts[1] } else { '/' }

    if ($Method -eq 'OPTIONS') {
      $CorsHeader = "HTTP/1.1 204 No Content`r`n" +
                    "Access-Control-Allow-Origin: *`r`n" +
                    "Access-Control-Allow-Methods: GET, HEAD, OPTIONS`r`n" +
                    "Access-Control-Allow-Headers: *`r`n" +
                    "Connection: close`r`n`r`n"
      $CorsBytes = [System.Text.Encoding]::ASCII.GetBytes($CorsHeader)
      $Stream.Write($CorsBytes, 0, $CorsBytes.Length)
      $Stream.Flush()
      $Client.Close()
      continue
    }

    $CleanPath = ($RawPath.Split('?')[0]).TrimStart('/')
    if ([string]::IsNullOrEmpty($CleanPath)) {
      $CleanPath = 'index.html'
    }
    $CleanPath = [System.Uri]::UnescapeDataString($CleanPath)
    $FilePath = Join-Path $RootDir ($CleanPath -replace '/', '\')

    if ((Test-Path $FilePath -PathType Leaf)) {
      $Ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
      $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { 'application/octet-stream' }
      $BodyBytes = [System.IO.File]::ReadAllBytes($FilePath)

      $HeaderText = "HTTP/1.1 200 OK`r`n" +
                    "Content-Type: $ContentType`r`n" +
                    "Content-Length: $($BodyBytes.Length)`r`n" +
                    "Cache-Control: no-cache`r`n" +
                    "Service-Worker-Allowed: /`r`n" +
                    "Access-Control-Allow-Origin: *`r`n" +
                    "Access-Control-Allow-Methods: GET, HEAD, OPTIONS`r`n" +
                    "Connection: close`r`n`r`n"
      $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($HeaderText)
      $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
      if ($Method -ne 'HEAD') {
        $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
      }
    } else {
      $NotFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $HeaderText = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($NotFound.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
      $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($HeaderText)
      $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
      if ($Method -ne 'HEAD') {
        $Stream.Write($NotFound, 0, $NotFound.Length)
      }
    }

    $Stream.Flush()
    $Client.Close()
  } catch {
    if ($Client) { $Client.Close() }
  }
}

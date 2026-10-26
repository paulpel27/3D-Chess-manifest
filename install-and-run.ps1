# Generates PNG/ICO icons, starts the local PWA server on port 8080, creates Desktop & Start Menu shortcuts, and opens Grandmaster 3D Chess
param(
  [switch]$ServerOnly,
  [switch]$AppWindow
)

$ErrorActionPreference = 'SilentlyContinue'
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconsDir = Join-Path $AppDir 'icons'
if (!(Test-Path $IconsDir)) { New-Item -ItemType Directory -Path $IconsDir | Out-Null }

# 1. Generate real 192x192 PNG, 512x512 PNG, and Windows .ICO icon using .NET System.Drawing
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

      if ($size -eq 192) {
        $icoPath = Join-Path $IconsDir 'chess.ico'
        $iconHandle = $bmp.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
        $fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
        $icon.Save($fs)
        $fs.Close()
      }
      $bmp.Dispose()
    }
  }
} catch {}

# 2. Check if port 8080 is already listening; if not, start server.ps1 in the background
$PortOpen = $false
try {
  $TestClient = New-Object System.Net.Sockets.TcpClient
  $Connect = $TestClient.BeginConnect('127.0.0.1', 8080, $null, $null)
  $Wait = $Connect.AsyncWaitHandle.WaitOne(200, $false)
  if ($Wait -and $TestClient.Connected) {
    $PortOpen = $true
  }
  $TestClient.Close()
} catch {}

if (-not $PortOpen) {
  $ServerScript = Join-Path $AppDir 'server.ps1'
  Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ServerScript`"" -WindowStyle Hidden
  Start-Sleep -Milliseconds 450
}

# 3. Create Desktop & Start Menu Shortcuts
$VbsLauncher = Join-Path $AppDir 'Launch-Silent.vbs'
$IcoFile = Join-Path $IconsDir 'chess.ico'
try {
  $WshShell = New-Object -ComObject WScript.Shell
  $Desktop = [Environment]::GetFolderPath('Desktop')
  $Programs = [Environment]::GetFolderPath('Programs')
  foreach ($Dir in @($Desktop, $Programs)) {
    $ShortcutPath = Join-Path $Dir 'Grandmaster 3D Chess.lnk'
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = 'wscript.exe'
    $Shortcut.Arguments = "`"$VbsLauncher`""
    $Shortcut.WorkingDirectory = $AppDir
    $Shortcut.Description = 'Play Grandmaster 3D Chess (5-Level AI)'
    if (Test-Path $IcoFile) {
      $Shortcut.IconLocation = "$IcoFile,0"
    }
    $Shortcut.Save()
  }
} catch {}

# 4. Launch the App Window (Edge or Chrome in Standalone App Mode or Browser Tab)
$EdgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (!(Test-Path $EdgePath)) { $EdgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$ChromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (!(Test-Path $ChromePath)) { $ChromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }

$Url = 'http://localhost:8080'

if ($ServerOnly) {
  Start-Process $Url
} else {
  if (Test-Path $EdgePath) {
    Start-Process $EdgePath -ArgumentList "--app=$Url --window-size=1280,820"
  } elseif (Test-Path $ChromePath) {
    Start-Process $ChromePath -ArgumentList "--app=$Url --window-size=1280,820"
  } else {
    Start-Process $Url
  }
}

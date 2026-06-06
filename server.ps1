# ==========================================================
# Local HTTP server — bypasses CORS for OSRS Hiscores API
# Runs on http://localhost:8765
# ==========================================================

$ErrorActionPreference = 'Stop'
$dir  = $PSScriptRoot
$port = 8765
$url  = "http://localhost:$port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
} catch {
    Write-Host "❌ Could not start server on port $port." -ForegroundColor Red
    Write-Host "   (Another app may be using it, or run as Administrator the first time.)"
    Write-Host "   Falling back to opening the file directly..." -ForegroundColor Yellow
    Start-Process (Join-Path $dir 'index.html')
    Start-Sleep -Seconds 3
    exit 1
}

Write-Host "✨ bvels10's Adventure Guide is live at $url" -ForegroundColor Magenta
Write-Host "   (Close this window to stop the server.)"
Write-Host ""

# Open the browser
Start-Process $url

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch { break }

    $req = $ctx.Request
    $res = $ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin', '*')

    try {
        $path = $req.Url.AbsolutePath

        # --- Hiscores proxy: /api/hiscores?player=NAME ---
        if ($path -eq '/api/hiscores') {
            $player = $req.QueryString['player']
            if (-not $player) {
                $res.StatusCode = 400
                $res.Close()
                continue
            }
            $proxyUrl = "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=" + [uri]::EscapeDataString($player)
            try {
                $data = Invoke-WebRequest -Uri $proxyUrl -UseBasicParsing -TimeoutSec 10
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($data.Content)
                $res.ContentType = 'application/json; charset=utf-8'
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "  ✓ hiscores: $player" -ForegroundColor Green
            } catch {
                $res.StatusCode = 502
                $msg = '{"error":"upstream failed"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "  ✗ hiscores failed: $player" -ForegroundColor Red
            }
            $res.Close()
            continue
        }

        # --- Static files ---
        if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

        $relPath = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $dir $relPath

        # Block path traversal
        $resolved = [IO.Path]::GetFullPath($filePath)
        if (-not $resolved.StartsWith([IO.Path]::GetFullPath($dir))) {
            $res.StatusCode = 403
            $res.Close()
            continue
        }

        if (Test-Path -LiteralPath $filePath -PathType Leaf) {
            $ext = [IO.Path]::GetExtension($filePath).ToLower()
            $ctype = $mimeTypes[$ext]
            if (-not $ctype) { $ctype = 'application/octet-stream' }
            $bytes = [IO.File]::ReadAllBytes($filePath)
            $res.ContentType = $ctype
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $msg = "Not found: $path"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch {
        try { $res.StatusCode = 500 } catch {}
    } finally {
        try { $res.Close() } catch {}
    }
}

$listener.Stop()

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'frontend'
$pythonExe = Join-Path $backendDir '.venv\Scripts\python.exe'
$viteEntry = Join-Path $frontendDir 'node_modules\vite\bin\vite.js'
$logDir = Join-Path $projectRoot 'logs'

function Test-LocalPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        return $task.Wait(250) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "缺少后端虚拟环境：$pythonExe。请先在 backend 目录创建 .venv 并安装 requirements.txt。"
}
if (-not (Test-Path -LiteralPath $viteEntry)) {
    throw "缺少前端依赖：$viteEntry。请先在 frontend 目录运行 pnpm install。"
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

if (-not (Test-LocalPort 8765)) {
    Start-Process -FilePath $pythonExe `
        -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8765') `
        -WorkingDirectory $backendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') `
        -RedirectStandardError (Join-Path $logDir 'backend.err.log')
}

if (-not (Test-LocalPort 5173)) {
    Start-Process -FilePath 'node.exe' `
        -ArgumentList @($viteEntry, '--host', '127.0.0.1', '--port', '5173') `
        -WorkingDirectory $frontendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDir 'frontend.out.log') `
        -RedirectStandardError (Join-Path $logDir 'frontend.err.log')
}

$deadline = [DateTime]::UtcNow.AddSeconds(15)
while ([DateTime]::UtcNow -lt $deadline -and (-not (Test-LocalPort 8765) -or -not (Test-LocalPort 5173))) {
    Start-Sleep -Milliseconds 250
}

if (-not (Test-LocalPort 8765) -or -not (Test-LocalPort 5173)) {
    throw "服务未能在 15 秒内启动，请检查 $logDir 下的日志。"
}

Write-Host '关键词库管理工具已启动：' -ForegroundColor Green
Write-Host '  页面：http://127.0.0.1:5173'
Write-Host '  接口：http://127.0.0.1:8765/docs'
Write-Host "  日志：$logDir"

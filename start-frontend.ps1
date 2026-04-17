$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $root "frontend"

Set-Location $frontendPath

if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
  Write-Host "Dependencias do frontend nao encontradas. Instalando..." -ForegroundColor Yellow
  npm install
}

Write-Host "Subindo frontend em http://localhost:3000" -ForegroundColor Green
npm start

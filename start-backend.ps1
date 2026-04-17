$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root "backend"
$venvPath = Join-Path $root ".venv"
$venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"

Set-Location $backendPath

if (-not (Test-Path $venvActivate)) {
  Write-Host "Ambiente virtual nao encontrado. Criando .venv..." -ForegroundColor Yellow
  Set-Location $root
  python -m venv .venv
  Set-Location $backendPath
}

. $venvActivate

if (-not (Test-Path (Join-Path $venvPath "Scripts\uvicorn.exe"))) {
  Write-Host "Dependencias nao encontradas. Instalando requirements..." -ForegroundColor Yellow
  pip install -r requirements.txt
}

Write-Host "Subindo backend em http://localhost:8001" -ForegroundColor Green
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Quick start script for Windows PowerShell
# Creates venv (if missing), installs deps, runs stable server.

param(
  [switch]$Dev
)

Write-Host "[+] Ensuring virtual environment (.venv)" -ForegroundColor Cyan
if (!(Test-Path .venv)) {
  python -m venv .venv
  if ($LASTEXITCODE -ne 0) { Write-Error 'Failed to create virtual environment.'; exit 1 }
}

Write-Host "[+] Activating venv" -ForegroundColor Cyan
. .\.venv\Scripts\Activate.ps1

Write-Host "[+] Installing dependencies" -ForegroundColor Cyan
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Error 'Dependency installation failed.'; exit 1 }

if ($Dev) {
  Write-Host "[+] Starting development server (auto-reload)" -ForegroundColor Green
  python app.py
} else {
  Write-Host "[+] Starting stable server (no reloader)" -ForegroundColor Green
  python run_server.py
}

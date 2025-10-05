Write-Host "Building Galaxy React assets..." -ForegroundColor Cyan
Push-Location "$PSScriptRoot\frontend"
if (-Not (Test-Path node_modules)) { Write-Host "Installing dependencies..." -ForegroundColor Yellow; npm install }
npm run build
Pop-Location
Write-Host "Build complete. Files emitted to static/galaxy-build" -ForegroundColor Green
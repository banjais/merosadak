
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n=== MEROSADAK GITHUB SYNC ===" -ForegroundColor Cyan

# Confirm repository and branch
if (-not (Test-Path ".git")) {
    throw "Not a Git repository."
}

if ((git branch --show-current) -ne "main") {
    throw "Please switch to main branch first."
}

# Get latest GitHub version
Write-Host "`nFetching GitHub main..." -ForegroundColor Yellow
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Git fetch failed." }

# Replace tracked local files with GitHub versions
Write-Host "`nUpdating local project..." -ForegroundColor Yellow
git reset --hard origin/main
if ($LASTEXITCODE -ne 0) { throw "Git reset failed." }

# Remove untracked files, preserving this script
git clean -fd -e sync.ps1
if ($LASTEXITCODE -ne 0) { throw "Git clean failed." }

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

# Build (prebuild regenerates road-graph.json)
Write-Host "`nBuilding project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

# Final status
Write-Host "`n=== FINAL GIT STATUS ===" -ForegroundColor Cyan
git status --short

Write-Host "`nSYNC AND BUILD COMPLETED." -ForegroundColor Green
Write-Host "Note: road-graph.json may show as modified because prebuild regenerates it." -ForegroundColor Yellow

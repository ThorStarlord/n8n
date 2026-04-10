#!/usr/bin/env pwsh
<#
Update-n8n.ps1 - PowerShell cross-platform helper to update n8n, rebuild Docker stack and perform housekeeping.
Run: pwsh ./Update-n8n.ps1
#>
param(
  [string]$N8N_DIR = "$HOME/n8n",
  [string]$ComposeFile = "docker-compose.custom.yml"
)

function Abort($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

Write-Host "Starting Full System & n8n Update..." -ForegroundColor Yellow

if (-not (Test-Path $N8N_DIR -PathType Container)) {
  Abort "Error: Could not find directory $N8N_DIR"
}
Set-Location $N8N_DIR

Write-Host "Step 1: Updating n8n source code..." -ForegroundColor Green
git pull
if ($LASTEXITCODE -ne 0) { Abort "Error: git pull failed. Check for merge conflicts." }

Write-Host "Rebuilding container..." -ForegroundColor Green
docker compose -f $ComposeFile up -d --build
if ($LASTEXITCODE -ne 0) { Abort "Error: Docker build failed." }
Write-Host "n8n rebuilt and started successfully." -ForegroundColor Green

Write-Host "Step 2: Updating OS packages (if supported)..." -ForegroundColor Green
if (Get-Command apt -ErrorAction SilentlyContinue) {
  sudo apt update
  sudo apt upgrade -y
} elseif (Get-Command dnf -ErrorAction SilentlyContinue) {
  sudo dnf upgrade --refresh -y
} elseif (Get-Command yum -ErrorAction SilentlyContinue) {
  sudo yum update -y
} else {
  Write-Host "No supported package manager found (apt/dnf/yum). Skipping OS update." -ForegroundColor Yellow
}

Write-Host "Step 3: Cleaning up Docker images and build cache..." -ForegroundColor Green
docker image prune -a -f
docker builder prune -f
Write-Host "Cleanup complete." -ForegroundColor Green

Write-Host "Step 4: Checking if reboot is required..." -ForegroundColor Green
if (Test-Path "/var/run/reboot-required") {
  Write-Host "A reboot is required. Rebooting in 10 seconds..." -ForegroundColor Yellow
  Start-Sleep -Seconds 10
  sudo reboot
} else {
  Write-Host "No reboot required. System up to date." -ForegroundColor Green
}

exit 0

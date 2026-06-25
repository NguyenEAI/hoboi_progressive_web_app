# Khoi chay Next.js dev server cho du an Ho Boi
# Su dung: .\dev.ps1   (hoac double-click tu Explorer neu da bat .ps1)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# Nap lai PATH (Node moi cai chua co trong session)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Co tiet kiem RAM cho may dev
$env:DISABLE_PWA   = "1"
$env:LOW_MEM       = "1"
$env:NODE_OPTIONS  = "--max-old-space-size=2048"

Write-Host ""
Write-Host "=== Ho Boi Prosper Plaza - Dev Server ===" -ForegroundColor Cyan
Write-Host "Node    : $(node -v)" -ForegroundColor DarkGray
Write-Host "Folder  : $PSScriptRoot" -ForegroundColor DarkGray
Write-Host "URL     : http://localhost:3000" -ForegroundColor Green
Write-Host "Ctrl+C de dung server" -ForegroundColor DarkGray
Write-Host ""

npm run dev

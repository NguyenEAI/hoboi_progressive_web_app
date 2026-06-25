@echo off
REM Double-click de chay dev server (goi qua PowerShell)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1"
pause

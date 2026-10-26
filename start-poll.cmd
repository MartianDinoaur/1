@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1 || (
  echo Node.js is required. Install LTS from https://nodejs.org/ and rerun setup-windows.cmd.
  exit /b 1
)
node server.js

@echo off
setlocal

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is required.
  echo Install Node.js LTS from https://nodejs.org/ and reopen this window.
  pause
  exit /b 1
)

cd /d "%~dp0"
call npm install
if errorlevel 1 (
  echo Failed to install the project dependencies.
  pause
  exit /b 1
)

schtasks /Create /TN "FavoriteThingsPoll" /TR "\"%~dp0start-poll.cmd\"" /SC ONLOGON /F /IT /RL LIMITED
if errorlevel 1 (
  echo Failed to create the Windows startup task.
  pause
  exit /b 1
)

schtasks /Run /TN "FavoriteThingsPoll"
if errorlevel 1 (
  echo The startup task was created but could not be started now.
  pause
  exit /b 1
)

echo.
echo Favorite Things Poll is running and set to start after sign-in.
echo Open http://localhost:4173
pause

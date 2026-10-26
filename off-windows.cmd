@echo off
setlocal
schtasks /End /TN "FavoriteThingsPoll" >nul 2>&1
schtasks /Delete /TN "FavoriteThingsPoll" /F >nul 2>&1
if errorlevel 1 (
  echo The autostart task could not be removed.
  exit /b 1
)
echo Favorite Things Poll is stopped and will not start automatically.

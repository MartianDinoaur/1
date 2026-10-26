@echo off
setlocal
schtasks /Query /TN "FavoriteThingsPoll"
exit /b %errorlevel%

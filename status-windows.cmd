@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-poll-control.ps1" -Action status
exit /b %errorlevel%

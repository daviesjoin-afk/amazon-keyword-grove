@echo off
setlocal
title Keyword Grove - Starting

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. See the logs folder in this project.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:5173"
exit /b 0

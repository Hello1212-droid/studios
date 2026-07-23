@echo off
TITLE StudyOS - Bulletproof Launcher
:: Ensure we are in the correct directory
cd /d "%~dp0"

echo ========================================================
echo       STUDYOS MISSION-CRITICAL INITIALIZATION
echo ========================================================
echo.

:: 1. Check for stale StudyOS processes only (specific port), avoid killing all node.exe
echo [1/3] Clearing environment...
taskkill /f /im electron.exe >nul 2>&1
:: Only kill node processes that are holding port 5173 (our Vite dev server)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
  if not "%%a"=="" taskkill /f /pid %%a >nul 2>&1
)
echo Environment Cleared.

:: 2. Check for Administrator (Required for Explorer Kill)
echo [2/3] Checking Permissions...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Permissions: ADMINISTRATOR (Lockdown Active)
) else (
    echo.
    echo WARNING: NOT RUNNING AS ADMINISTRATOR.
    echo Kiosk Mode (Explorer Kill) will fail.
    echo Please right-click this file and "Run as Administrator".
    echo.
    pause
)

:: 3. Launch the Integrated OS
echo [3/3] Booting StudyOS Ecosystem...
echo.
npm run start-os
pause

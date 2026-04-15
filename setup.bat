@echo off
setlocal
echo ===================================================
echo   SVEC - Auto Setup Tool
echo ===================================================
echo.

:: 1. Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not found.
    echo [*] Installing Node.js via winget...
    winget install -e --id OpenJS.NodeJS.LTS
    if %errorlevel% neq 0 (
        echo [X] Failed to install Node.js automatically. 
        echo     Please install it manually from https://nodejs.org/
        pause
        exit /b
    )
    echo [!] Node.js installed. Please RESTART this script to continue.
    pause
    exit /b
)

echo [OK] Node.js is already installed.

:: 2. Install SVEC
echo [*] Installing SVEC globally from GitHub...
call npm.cmd install -g Betadeimos/svec

echo.
echo ===================================================
echo   DONE! SVEC is ready.
echo   Open a new terminal and type: svec
echo ===================================================
pause

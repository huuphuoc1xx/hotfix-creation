@echo off
REM Installation script for cggit (Windows)
REM Run this on any new laptop

echo Installing cggit...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Install dependencies
echo Installing dependencies...
call npm install

REM Link globally
echo Linking cggit globally...
call npm link

REM Verify installation
where cggit >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [92m✓ cggit installed successfully![0m
    echo.
    echo Usage:
    echo   cggit setup      # Setup GitHub token
    echo   cggit hotfix     # Create hotfix branches
    echo   cggit pr         # Create pull requests
    echo.
    cggit --version
) else (
    echo [91m✗ Installation failed[0m
    exit /b 1
)


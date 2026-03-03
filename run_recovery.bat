@echo off
REM Live Gaze Image Recovery - Complete Process
REM This script runs the full recovery workflow

echo ================================
echo LIVE GAZE IMAGE RECOVERY
echo ================================
echo.

REM Check if MongoDB is running
echo [1/5] Checking MongoDB status...
netstat -an | findstr "27017" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] MongoDB is running on port 27017
) else (
    echo [WARNING] MongoDB not detected on port 27017
    echo.
    echo Please start MongoDB first:
    echo   Option 1: net start MongoDB  (as Administrator^)
    echo   Option 2: Start MongoDB service from Services app
    echo   Option 3: Run mongod.exe manually
    echo.
    pause
    exit /b 1
)

echo.
echo [2/5] Analyzing filesystem images...
call npm run analyze-images
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Filesystem analysis failed
    pause
    exit /b 1
)

echo.
echo [3/5] Running image recovery...
echo This will scan database and re-link orphaned images...
call npm run recover-images
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Recovery failed - check output above
    pause
    exit /b 1
)

echo.
echo [4/5] Verifying recovery...
call npm run verify-recovery
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Verification failed - manual check needed
)

echo.
echo [5/5] Recovery Complete!
echo ================================
echo.
echo Next steps:
echo   1. Start backend:  cd backend  then  npm start
echo   2. Start frontend: cd frontend then  npm start  
echo   3. Login as therapist and check Live Gaze Review tab
echo.
pause

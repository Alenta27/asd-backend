@echo off
REM Full Index Rebuild for Live Gaze Review System
REM This script performs a complete database rebuild

echo ================================
echo LIVE GAZE REVIEW INDEX REBUILD
echo ================================
echo.

REM Skip local MongoDB check since we are using MongoDB Atlas
echo [1/3] Skipping local MongoDB check (using Atlas)...
echo [OK] Continuing to rebuild...

echo.
echo [2/3] Rebuilding database index...
echo This will:
echo   - Query raw database (no filters)
echo   - Reset NULL/archived/live/active/completed status to pending_review
echo   - Fix missing module and sessionType fields
echo   - Verify image attachments
echo   - Test rebuilt query
echo.
call npm run rebuild-index
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Index rebuild failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Recovery complete!
echo.
echo ================================
echo ALL SESSIONS SHOULD NOW BE VISIBLE
echo ================================
echo.
echo Next steps:
echo   1. Restart backend:  npm start
echo   2. Restart frontend: cd ..\frontend then npm start
echo   3. Login as therapist
echo   4. Check Live Gaze Analysis -^> Review tab
echo.
pause

@echo off
chcp 65001 >nul 2>&1
setlocal

if "%LOGGING_ACTIVE%"=="1" goto :skip_logging
set LOGGING_ACTIVE=1
if not exist "%~dp0logs" mkdir "%~dp0logs"
for /f "tokens=1-3 delims=/. " %%a in ('echo %date%') do set D=%%c-%%b-%%a
for /f "tokens=1-2 delims=:." %%a in ('echo %time: =0%') do set T=%%a%%b
set LOGFILE=%~dp0logs\UPDATE_EVENTS_QUICK_%D%_%T%.log
cmd /c "%~f0" 2>&1 | powershell -c "$input | Tee-Object -FilePath '%LOGFILE%'"
exit /b %ERRORLEVEL%
:skip_logging

echo ============================================
echo  STNH Wiki - Events Update (no images)
echo ============================================
echo.

cd /d "%~dp0"

echo [0/3] Git sync ...
echo.

git add -A
git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No local changes to commit.
    goto :sync_pull
)
git commit -m "Pre-update commit - %date% %time:~0,8%"
if %ERRORLEVEL% neq 0 goto :commit_failed
echo Pre-update changes committed.

:sync_pull
git fetch origin
git rev-list HEAD..origin/master --count > "%TEMP%\stnh_ahead.tmp"
set /p AHEAD=<"%TEMP%\stnh_ahead.tmp"
del "%TEMP%\stnh_ahead.tmp"
if "%AHEAD%" equ "0" (
    echo Remote is up to date.
    goto :sync_done
)
echo Remote is %AHEAD% commits ahead, pulling...
git pull --rebase origin master
if %ERRORLEVEL% neq 0 goto :pull_failed
echo Pull successful.

:sync_done
echo.

echo [1/3] Running UPDATE_EVENTS.py --skip-images ...
echo.
cd /d "%~dp0update"

python UPDATE_EVENTS.py --skip-images
if %ERRORLEVEL% neq 0 goto :pipeline_failed

echo.
echo [2/3] Git commit ...
echo.
cd /d "%~dp0"

git add assets/ models/
git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No changes to commit.
    goto :done
)

git commit -m "Update events (quick) - %date% %time:~0,8%"
if %ERRORLEVEL% neq 0 goto :commit_failed

echo.
echo [3/3] Git push ...
echo.

git push
if %ERRORLEVEL% neq 0 goto :push_failed

echo.
echo Push successful - GitHub Pages deployment triggered.
goto :done

:pipeline_failed
echo.
echo ============================================
echo  ERROR: Pipeline failed! Aborting.
echo ============================================
pause
exit /b 1

:commit_failed
echo.
echo ERROR: git commit failed!
pause
exit /b 1

:pull_failed
echo.
echo ERROR: git pull failed! Resolve conflicts manually.
pause
exit /b 1

:push_failed
echo.
echo ERROR: git push failed!
pause
exit /b 1

:done
echo.
echo ============================================
echo  Done!
echo ============================================
pause

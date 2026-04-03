@echo off
chcp 65001 >nul 2>&1
setlocal

if "%LOGGING_ACTIVE%"=="1" goto :skip_logging
set LOGGING_ACTIVE=1
if not exist "%~dp0logs" mkdir "%~dp0logs"
for /f "tokens=1-3 delims=/.  " %%a in ('echo %date%') do set D=%%c-%%b-%%a
for /f "tokens=1-2 delims=:." %%a in ('echo %time: =0%') do set T=%%a%%b
set LOGFILE=%~dp0logs\UPDATE_%D%_%T%.log
cmd /c "%~f0" 2>&1 | powershell -c "$input | Tee-Object -FilePath '%LOGFILE%'"
exit /b %ERRORLEVEL%
:skip_logging

echo ============================================
echo  STNH Wiki - Full Update
echo ============================================
echo.

cd /d "%~dp0update"

echo [1/2] Running UPDATE_WIKI.py ...
echo.
python UPDATE_WIKI.py
if %ERRORLEVEL% neq 0 goto :pipeline_failed

echo.
echo [2/2] Git commit + push ...
echo.
cd /d "%~dp0"

git add assets/ pictures/ icons/ fonts/
git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No changes to commit.
    goto :done
)

git commit -m "Update STNH Wiki - %date% %time:~0,8%"
if %ERRORLEVEL% neq 0 goto :commit_failed

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

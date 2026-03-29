@echo off
chcp 65001 >nul 2>&1
setlocal

echo ============================================
echo  STNH Wiki - Events Update
echo ============================================
echo.

cd /d "%~dp0update"

echo [1/2] Running UPDATE_EVENTS.py ...
echo.
python UPDATE_EVENTS.py
if %ERRORLEVEL% neq 0 goto :pipeline_failed

echo.
echo [2/2] Git commit + push ...
echo.
cd /d "%~dp0"

git add assets/ pictures/
git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No changes to commit.
    goto :done
)

git commit -m "Update events - %date% %time:~0,8%"
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

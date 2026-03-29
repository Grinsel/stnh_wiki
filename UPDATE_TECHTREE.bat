@echo off
echo ============================================
echo  STNH Wiki - Techtree Update
echo ============================================
echo.
cd /d "%~dp0update\techtree"
python UPDATE_TECHTREE_FULL.py
cd /d "%~dp0"
echo.
echo Done.
pause

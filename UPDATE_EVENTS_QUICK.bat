@echo off
cd /d "%~dp0update"
python UPDATE_EVENTS.py --skip-images
cd ..

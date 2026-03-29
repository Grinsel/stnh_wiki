@echo off
cd /d "%~dp0update"
python UPDATE_WIKI.py
cd ..
git add assets/ pictures/ icons/ fonts/
git commit -m "Update STNH Wiki - %date% %time%"
git push

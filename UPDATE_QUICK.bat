@echo off
cd /d "%~dp0update"
python UPDATE_WIKI.py --skip-images
cd ..
git add assets/
git commit -m "Update STNH Wiki (quick) - %date% %time%"
git push

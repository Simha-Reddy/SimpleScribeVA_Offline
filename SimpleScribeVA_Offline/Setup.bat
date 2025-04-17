@echo off
REM === SETUP.BAT ===
echo Creating virtual environment...
python -m venv venv
echo Activating environment and installing requirements...
call venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
echo Setup complete! To run the app, just double-click StartSimpleScribeVA.bat. Hope you enjoy!
pause

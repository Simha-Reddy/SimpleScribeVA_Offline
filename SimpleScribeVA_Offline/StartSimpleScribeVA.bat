REM === SimpleScribeVAStart.BAT ===
@echo off
echo Clearing old session data...

REM Delete old chunks
if exist chunks (
    del /q chunks\*.wav >nul 2>&1
    del /q chunks\*.txt >nul 2>&1
)

REM Clear the live transcript file
if exist live_transcript.txt (
    echo. > live_transcript.txt
)

echo Activating virtual environment...
call venv\Scripts\activate
start cmd /k python run_local_server.py
start cmd /k python monitor_transcription.py
timeout /t 4 > nul
start http://127.0.0.1:5000
echo SimpleScribeVA is now running.
pause

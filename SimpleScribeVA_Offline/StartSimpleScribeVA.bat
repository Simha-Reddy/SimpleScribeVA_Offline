REM === SimpleScribeVAStart.BAT ===
@echo off

REM === Clear old session data ===
echo Clearing old session data...
if exist chunks (
    del /q chunks\*.wav >nul 2>&1
    del /q chunks\*.txt >nul 2>&1
    del /q chunks\*.json >nul 2>&1
)

REM === Clear the live transcript file ===
if exist live_transcript.txt (
    echo. > live_transcript.txt
)

REM === Set path to embeddable Python ===
call venv\Scripts\activate

REM === Start the transcribing program in a minimized window ===
start /min "" cmd /k python monitor_transcription.py

REM === Start Flask server in a minimized window ===
start /min "" cmd /c python run_local_server.py

REM === Give it a moment to start up ===
timeout /t 10 > nul

REM === Open up in default browser ===
start "" http://127.0.0.1:5000
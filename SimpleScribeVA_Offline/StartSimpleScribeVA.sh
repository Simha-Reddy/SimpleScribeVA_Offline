#!/bin/bash

echo "=== STARTING SIMPLESCRIBEVA ==="

echo "Clearing old session data..."

# Delete old chunks
if [ -d "chunks" ]; then
    rm -f chunks/*.wav chunks/*.txt 2>/dev/null
fi

# Clear the live transcript file
if [ -f "live_transcript.txt" ]; then
    > live_transcript.txt
fi

echo "Activating virtual environment..."
source venv/bin/activate

# Run Python processes in background
echo "Starting transcription and server..."
python run_local_server.py & 
python monitor_transcription.py &

# Allow Flask to initialize
sleep 4

# Open browser
open http://127.0.0.1:5000

echo "SimpleScribeVA is now running!"

#!/bin/bash

echo "=== SETUP.SH ==="
echo "Creating virtual environment..."
python3 -m venv venv

echo "Activating environment and installing requirements..."
source venv/bin/activate

echo "Upgrading pip and installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Setup complete! To run the app, use: ./start_simplescribeva.sh"

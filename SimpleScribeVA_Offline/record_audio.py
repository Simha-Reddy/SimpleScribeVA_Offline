import os
import sounddevice as sd
import numpy as np
import wave
import queue
import threading
import time
import json
from datetime import datetime
 
CHUNKS_DIR = "chunks"
os.makedirs(CHUNKS_DIR, exist_ok=True)
 
recording = False
recording_thread = None
q = queue.Queue()
 
def get_device_id():
    try:
        with open("config.json", "r") as f:
            config = json.load(f)
            return config.get("device_id", None)
    except:
        return None
 
def audio_callback(indata, frames, time_info, status):
    if status:
        print(status)
    q.put(indata.copy())
 
def save_wav(frames, filename, samplerate):
    with wave.open(filename, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(b''.join(frames))
 
def start_recording():
    global recording
    recording = True
    device_id = get_device_id()
    samplerate = 16000
    block_duration = 30 # seconds
    overlap_seconds = 2 # overlap window to reduce error

    print(f"[STARTING RECORDING] Using device: {device_id}")

    with sd.InputStream(samplerate=samplerate, channels=1, dtype='int16',
                        callback=audio_callback, device=device_id):
        buffer = []
        start_time = time.time()

        try:
            while recording:
                try:
                    data = q.get(timeout=1)
                    buffer.append(data)

                    if time.time() - start_time >= block_duration:
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = os.path.join(CHUNKS_DIR, f"chunk_{timestamp}.wav")
                        save_wav([d.tobytes() for d in buffer], filename, samplerate)
                        print(f"[SAVED] {filename}")

                        # Keep last N seconds of audio for overlap
                        seconds_per_block = len(buffer[0]) / samplerate
                        blocks_to_keep = int(overlap_seconds / seconds_per_block)
                        buffer = buffer[-blocks_to_keep:]
                        start_time = time.time()
                except queue.Empty:
                    continue
        finally:
            while not q.empty():
                try:
                    buffer.append(q.get_nowait())
                except queue.Empty:
                    break

            if buffer:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = os.path.join(CHUNKS_DIR, f"chunk_{timestamp}_final.wav")
                save_wav([d.tobytes() for d in buffer], filename, samplerate)
                print(f"[SAVED FINAL] {filename}")
            else:
                print("[INFO] No leftover audio to save.")

def start_recording_thread():
    global recording_thread
    if recording_thread is None or not recording_thread.is_alive():
        recording_thread = threading.Thread(target=start_recording, daemon=True)
        recording_thread.start()


def stop_recording():
    global recording
    recording = False
    print("[STOPPED RECORDING]")

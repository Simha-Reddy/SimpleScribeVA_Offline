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
 
def load_config():
    try:
        with open("config.json", "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Failed to load config.json: {e}")
        return {}

# Load config once
config = load_config()
NORMALIZE_GAIN = config.get("normalize_gain", True)
TARGET_dBFS = config.get("target_dBFS", -20)

# Right now, config has device_id set to null or default, but down the road consider letting user choose mic.
def get_device_id():
    return config.get("device_id", None)

def normalize_to_dBFS(audio_array, target_dBFS=-20):
    """
    Normalize audio to a specific dBFS target.

    Args:
        audio_array (np.ndarray): Audio samples as int16
        target_dBFS (float): Desired decibels relative to full scale (e.g., -20)

    Returns:
        np.ndarray: Gain-normalized int16 audio array
    """
    if np.max(np.abs(audio_array)) == 0:
        return audio_array

    float_audio = audio_array.astype(np.float32)
    rms = np.sqrt(np.mean(float_audio**2))
    current_dBFS = 20 * np.log10(rms / 32767)
    required_gain_dB = target_dBFS - current_dBFS
    gain = 10 ** (required_gain_dB / 20)
    normalized_float = float_audio * gain
    normalized_clipped = np.clip(normalized_float, -32768, 32767)
    return normalized_clipped.astype(np.int16)

def audio_callback(indata, frames, time_info, status):
    if status:
        print(status)
    q.put(indata.copy())
 
def save_wav(frames, filename, samplerate):
    """
    Save recorded frames to a WAV file, applying gain normalization if enabled.

    Args:
        frames (List[bytes]): List of byte frames (from sounddevice)
        filename (str): Output .wav file path
        samplerate (int): Sample rate in Hz
    """
    audio_bytes = b''.join(frames)
    audio_array = np.frombuffer(audio_bytes, dtype=np.int16)

    if NORMALIZE_GAIN:
        print(f"[NORMALIZING] Target dBFS: {TARGET_dBFS}")
        audio_array = normalize_to_dBFS(audio_array, TARGET_dBFS)

    with wave.open(filename, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(audio_array.tobytes())
 
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

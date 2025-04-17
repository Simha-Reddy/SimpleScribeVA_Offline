import os
import subprocess
import time
import json
from datetime import datetime
 
WHISPER_CPP_PATH = "whispercpp/whisper.exe"
MODEL_DIR = "whispercpp"
CHUNK_DIR = "chunks"
TRANSCRIPT_DIR = "transcripts"
MODEL_DEFAULT = "ggml-small.en.bin"
CONFIG_FILE = "config.json"
LIVE_TRANSCRIPT = "live_transcript.txt"
 
def get_model_name():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
            return config.get("model", MODEL_DEFAULT)
    return MODEL_DEFAULT
 
def get_patient_name():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
            return config.get("patient_name", "session")
    return "session"
 
def find_output_path(wav_path):
    path1 = wav_path.replace(".wav", ".txt")
    path2 = wav_path + ".txt"
    if os.path.exists(path1):
        return path1
    elif os.path.exists(path2):
        return path2
    return None
 
def transcribe_chunk(wav_path, model):
    cmd = [
        WHISPER_CPP_PATH,
        "-m", os.path.join(MODEL_DIR, model),
        "-f", wav_path,
        "-otxt"
    ]
    print(f"[INFO] Running: {' '.join(cmd)}")
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return find_output_path(wav_path)
 
def append_to_transcripts(text, patient_name):
    with open(LIVE_TRANSCRIPT, "a", encoding="utf-8") as f:
        f.write(text + "\n")
 
def monitor_chunks():
    os.makedirs(TRANSCRIPT_DIR, exist_ok=True)
    os.makedirs(CHUNK_DIR, exist_ok=True)
    with open(LIVE_TRANSCRIPT, "w", encoding="utf-8") as f:
        f.write("")
    processed = set()
    model = get_model_name()
    patient = get_patient_name().strip().replace(" ", "_") or "session"
    print("[INFO] Live transcription monitor started...")
    while True:
        for fname in sorted(os.listdir(CHUNK_DIR)):
            if fname.endswith(".wav") and fname not in processed:
                wav_path = os.path.join(CHUNK_DIR, fname)
                print(f"[NEW] Found chunk: {fname}")
                txt_path = transcribe_chunk(wav_path, model)
                if txt_path:
                    try:
                        with open(txt_path, "r", encoding="utf-8") as f:
                            result = f.read().strip()
                        print(f"[TEXT] Transcribed text from {fname}: '{result}'")
                        if result:
                            append_to_transcripts(result, patient)
                            print(f"[✓] Transcribed and appended: {fname}")
                            try:
                                os.remove(wav_path)
                                os.remove(txt_path)
                                print(f"[CLEAN] Removed: {fname} and associated text.")
                            except Exception as e:
                                print(f"[WARN] Could not delete files for {fname}: {e}")
                        else:
                            print(f"[SKIP] Empty result for {fname}")
                    except Exception as e:
                        print(f"[ERROR] Failed to read or append {txt_path}: {e}")
                else:
                    print(f"[FAIL] No transcript output for {fname}")
                processed.add(fname)
        time.sleep(2)
 
if __name__ == "__main__":
    monitor_chunks()

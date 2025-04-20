import os
import subprocess
import time
import json
import re
from datetime import datetime

WHISPER_CPP_PATH = "whispercpp/whisper.exe"
MODEL_DIR = "whispercpp"
CHUNK_DIR = "chunks"
TRANSCRIPT_DIR = "transcripts"
MODEL_DEFAULT = "ggml-small.en.bin"
CONFIG_FILE = "config.json"
LIVE_TRANSCRIPT = "live_transcript.txt"

DISFLUENCIES = {'uh', 'um', 'you know', 'like'}

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

def clean_text(text):
    pattern = r'\b(' + '|'.join(re.escape(word) for word in DISFLUENCIES) + r')\b'
    cleaned = re.sub(pattern, '', text, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', cleaned).strip()

def format_segments(json_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        segments = data.get("segments", [])
    except Exception as e:
        print(f"[ERROR] Could not read or parse JSON: {json_path}: {e}")
        return ""

    formatted_lines = []
    for seg in segments:
        cleaned = clean_text(seg.get("text", ""))
        if cleaned:
            formatted_lines.append(cleaned)
    return "\n\n".join(formatted_lines)

def transcribe_chunk(wav_path, model):
    cmd = [
        WHISPER_CPP_PATH,
        "-m", os.path.join(MODEL_DIR, model),
        "-f", wav_path,
        "-otxt",
        "-oj"  # Enable JSON output too
    ]
    print(f"[INFO] Running: {' '.join(cmd)}")
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Output file is always <file>.txt; JSON will be <file>.json
    return wav_path.replace(".wav", ".txt")

def append_to_transcripts(text):
    with open(LIVE_TRANSCRIPT, "a", encoding="utf-8") as f:
        f.write(text.strip() + "\n\n")

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
                base_path = wav_path[:-4]  # remove .wav
                txt_path = base_path + ".txt"
                json_path = base_path + ".json"

                print(f"[NEW] Found chunk: {fname}")
                transcribe_chunk(wav_path, model)

                if os.path.exists(json_path):
                    result = format_segments(json_path)
                elif os.path.exists(txt_path):
                    with open(txt_path, "r", encoding="utf-8") as f:
                        result = clean_text(f.read())
                else:
                    print(f"[FAIL] No output found for {fname}")
                    result = ""

                if result:
                    append_to_transcripts(result)
                    print(f"[✓] Appended cleaned transcript for {fname}")
                    try:
                        os.remove(wav_path)
                        os.remove(txt_path)
                        if os.path.exists(json_path):
                            os.remove(json_path)
                        print(f"[CLEAN] Removed: {fname}, .txt, .json")
                    except Exception as e:
                        print(f"[WARN] Cleanup failed for {fname}: {e}")
                else:
                    print(f"[SKIP] Empty result for {fname}")

                processed.add(fname)

        time.sleep(2)

if __name__ == "__main__":
    monitor_chunks()

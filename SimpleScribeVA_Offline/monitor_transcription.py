import os
import subprocess
import time
import json
from datetime import datetime
from vosk import Model, KaldiRecognizer
import wave

# Load Vosk model once (you can cache this globally if needed)
VOSK_MODEL_PATH = "vosk-model-en-us-0.22"
vosk_model = Model(VOSK_MODEL_PATH)
CHUNK_DIR = "chunks"
TRANSCRIPT_DIR = "transcripts"
LIVE_TRANSCRIPT = "live_transcript.txt"
  
def find_output_path(wav_path):
    path1 = wav_path.replace(".wav", ".txt")
    path2 = wav_path + ".txt"
    if os.path.exists(path1):
        return path1
    elif os.path.exists(path2):
        return path2
    return None

def transcribe_chunk(wav_path, model=None):  # 'model' arg kept for compatibility
    try:
        wf = wave.open(wav_path, "rb")
    except Exception as e:
        print(f"[ERROR] Cannot open WAV file {wav_path}: {e}")
        return None

    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
        print(f"[ERROR] WAV file {wav_path} must be 16-bit mono PCM at 16kHz")
        return None

    rec = KaldiRecognizer(vosk_model, wf.getframerate())
    text = ""

    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            res = json.loads(rec.Result())
            text += res.get("text", "") + " "

    final_res = json.loads(rec.FinalResult())
    text += final_res.get("text", "")

    # Simulate Whisper-style .txt output
    output_path = wav_path + ".txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text.strip())

    return output_path
 
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

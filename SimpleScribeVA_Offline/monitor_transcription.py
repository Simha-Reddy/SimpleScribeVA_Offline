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

DISFLUENCIES = {'uh', 'um', 'you know'}
CONFIDENCE_THRESHOLD = 0.7  # Per-token confidence threshold

def get_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}

def get_model_name():
    config = get_config()
    return config.get("model", MODEL_DEFAULT)

def get_patient_name():
    config = get_config()
    return config.get("patient_name", "session")

def should_delete_chunks():
    config = get_config()
    return config.get("delete_chunks", True)

def clean_text(text):
    text = re.sub(r'\[_BEG_\]', '', text)
    text = text.replace('<|endoftext|>', '')

    # Remove common noise patterns
    text = re.sub(r'\[\s*(BLANK_AUDIO|NOISE|INAUDIBLE|.*s\s*igh\s*s.*?)\s*\]', '', text, flags=re.IGNORECASE)

    # Fix spacing around apostrophes and hyphens (e.g. "Let 's" → "Let's", "year - old" → "year-old")
    text = re.sub(r"\b(\w+)\s*'\s*(\w+)\b", r"\1'\2", text)
    text = re.sub(r"\b(\d+)\s*-\s*(year|month|week|day)\s*-\s*old\b", r"\1-\2-old", text)
    text = re.sub(r"\b(\w+)\s*-\s*(\w+)\b", r"\1-\2", text)  # generic hyphenation cleanup
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)  # remove spaces before punctuation

    # Remove disfluencies
    pattern = r'\b(' + '|'.join(re.escape(word) for word in DISFLUENCIES) + r')\b'
    cleaned = re.sub(pattern, '', text, flags=re.IGNORECASE)

    # Final cleanup
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def remove_timestamps(text):
    return re.sub(r'\[\s*[_A-Z]{2,10}[^\]]*\]', '', text).strip()

def extract_colored_text(segments):
    if not segments:
        return "", []

    lines = []
    for seg in segments:
        raw_text = seg.get("text", "").strip()
        if not raw_text or "tokens" not in seg:
            continue

        token_strs = []
        for token in seg["tokens"]:
            word = token.get("text", "").strip()
            p = token.get("p", 1.0)
            if not word:
                continue
            if p < CONFIDENCE_THRESHOLD:
                token_strs.append(f"<span style='color:#cc3300'>{word}</span>")
            else:
                token_strs.append(word)

        line = clean_text(" ".join(token_strs))
        if line:
            lines.append(line)

    return "\n".join(lines), segments

def transcribe_chunk(wav_path, model):
    cmd = [
        WHISPER_CPP_PATH,
        "-m", os.path.join(MODEL_DIR, model),
        "-f", wav_path,
        "-ojf",
        "-otxt",
        "-t", "10"
    ]
    print(f"[INFO] Running: {' '.join(cmd)}")
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return wav_path + ".json"

def append_to_transcripts(text):
    text_minus_timestamps = remove_timestamps(text)
    with open(LIVE_TRANSCRIPT, "a", encoding="utf-8") as f:
        f.write(text_minus_timestamps + "\n")

def monitor_chunks():
    os.makedirs(TRANSCRIPT_DIR, exist_ok=True)
    os.makedirs(CHUNK_DIR, exist_ok=True)
    with open(LIVE_TRANSCRIPT, "w", encoding="utf-8") as f:
        f.write("")
    processed = set()
    model = get_model_name()
    delete_chunks = should_delete_chunks()
    print("[INFO] Live transcription monitor started...")

    while True:
        for fname in sorted(os.listdir(CHUNK_DIR)):
            if fname.endswith(".wav") and fname not in processed:
                wav_path = os.path.join(CHUNK_DIR, fname)
                print(f"[NEW] Found chunk: {fname}")
                json_path = transcribe_chunk(wav_path, model)

                if os.path.exists(json_path):
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        segments = data.get("transcription", [])
                        result, _ = extract_colored_text(segments)
                    except Exception as e:
                        print(f"[ERROR] Failed parsing {json_path}: {e}")
                        result = ""
                else:
                    print(f"[FAIL] No JSON output for {fname}")
                    result = ""

                if result:
                    append_to_transcripts(result)
                    print(f"[✓] Appended colored transcript for {fname}")

                    if delete_chunks:
                        try:
                            os.remove(wav_path)
                            os.remove(json_path.replace(".json", ".txt"))
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

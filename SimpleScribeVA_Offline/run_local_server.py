from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory
from dotenv import load_dotenv
load_dotenv()
import os
import json
import threading
from record_audio import start_recording_thread, stop_recording

# Ensure required folders exist
REQUIRED_DIRS = [
    "chunks",  # chunks of audio, length in record_audio
    "transcripts",
    os.path.join("templates", "default"),
    os.path.join("templates", "custom"),
    "whispercpp"
]

for folder in REQUIRED_DIRS:
    os.makedirs(folder, exist_ok=True)
    
app = Flask(__name__)
openai_api_key = os.getenv("OPENAI_API_KEY")

@app.route('/start_recording', methods=['POST'])
def start_recording_route():
    start_recording_thread()
    return "Recording started", 200

@app.route('/stop_recording', methods=['POST'])
def stop_recording_route():
    stop_recording()
    return "Recording stopped", 200

@app.route("/live_transcript")
def live_transcript():
    try:
        with open("live_transcript.txt", "r", encoding="utf-8") as f:
            return f.read(), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    except FileNotFoundError:
        return "", 200

@app.route("/")
def index():
    return render_template("landing.html")

@app.route("/scribe")
def scribe():
    default_dir = os.path.join("templates", "default")
    custom_dir = os.path.join("templates", "custom")

    default_templates = []
    custom_templates = []

    if os.path.exists(default_dir):
        default_templates = [f[:-4] for f in os.listdir(default_dir) if f.endswith(".txt")]
    if os.path.exists(custom_dir):
        custom_templates = [f[:-4] for f in os.listdir(custom_dir) if f.endswith(".txt")]

    return render_template("scribe.html", default_templates=default_templates, custom_templates=custom_templates)

@app.route("/scribe_status")
def scribe_status():
    import os

    chunk_dir = "chunks"
    wavs = [f for f in os.listdir(chunk_dir) if f.endswith(".wav")]
    txts = [f for f in os.listdir(chunk_dir) if f.endswith(".txt")]

    txt_basenames = {os.path.splitext(f)[0] for f in txts}
    pending = [f for f in wavs if os.path.splitext(f)[0] not in txt_basenames]

    # Read live transcript
    transcript_path = "live_transcript.txt"
    try:
        with open(transcript_path, "r") as f:
            transcript = f.read()
    except FileNotFoundError:
        transcript = ""

    return jsonify({
        "pending_chunks": len(pending),
        "transcript": transcript
    })

@app.route("/settings")
def settings():
    prompt_files = os.listdir("templates/custom")
    return render_template("settings.html", prompt_templates=prompt_files)

@app.route("/archive")
def archive():
    transcripts = []
    if os.path.exists("transcripts"):
        for f in sorted(os.listdir("transcripts")):
            path = os.path.join("transcripts", f)
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            transcripts.append((f, content))
    return render_template("archive.html", transcripts=transcripts)

@app.route("/delete_transcripts", methods=["POST"])
def delete_transcripts():
    filenames = request.form.getlist("delete")
    for fname in filenames:
        path = os.path.join("transcripts", fname)
        if os.path.exists(path):
            os.remove(path)
    return redirect("/archive")

@app.route("/save_config", methods=["POST"])
def save_config():
    data = request.get_json()
    with open("config.json", "w") as f:
        json.dump(data, f)

    # Automatically restart transcribe_chunks.py
    import psutil
    import subprocess

    # Kill any existing transcribe_chunks.py processes
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['cmdline'] and "transcribe_chunks.py" in proc.info['cmdline'][-1]:
                proc.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # Start a new one
    subprocess.Popen(["python", "transcribe_chunks.py"])

    return "", 204


@app.route("/save_template", methods=["POST"])
def save_template():
    data = request.get_json()
    name = data.get("name")
    text = data.get("text")
    if name and text:
        os.makedirs("templates/custom", exist_ok=True)
        with open(os.path.join("templates/custom", f"{name}.txt"), "w", encoding="utf-8") as f:
            f.write(text)
        return redirect(url_for("scribe"))
    return "Invalid data", 400

@app.route("/load_template/<name>")
def load_template(name):
    path = os.path.join("templates", "custom", f"{name}.txt")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return "", 404

@app.route("/list_custom_templates")
def list_custom_templates():
    folder = os.path.join("templates", "custom")
    if not os.path.exists(folder):
        return jsonify([])
    files = [
        f.replace(".txt", "")
        for f in os.listdir(folder)
        if f.endswith(".txt")
    ]
    return jsonify(files)

@app.route('/templates/custom/<filename>')
def serve_custom_template(filename):
    return send_from_directory('templates/custom',filename)

@app.route("/delete_template/<name>", methods=["DELETE"])
def delete_template(name):
    path = os.path.join("templates", "custom", f"{name}.txt")
    if os.path.exists(path):
        os.remove(path)
        return "Deleted", 200
    return "Not found", 404


    path = os.path.join("templates", "custom", f"{name}.txt")
    if os.path.exists(path):
        os.remove(path)
        return "Deleted", 200
    return "File not found", 404

@app.route("/get_prompts")
def get_prompts():
    prompts = {}
    default_path = "templates/default"
    custom_path = "templates/custom"
    for folder in [default_path, custom_path]:
        if os.path.exists(folder):
            for file in os.listdir(folder):
                if file.endswith(".txt"):
                    with open(os.path.join(folder, file), "r", encoding="utf-8") as f:
                        prompts[file.replace(".txt", "")] = f.read()
    return jsonify(prompts)

@app.route("/create_note", methods=["POST"])
def create_note():
    import openai
    data = request.get_json()
    transcript = data.get("transcript", "")
    chart_data = data.get("chart_data", "")
    prompt_type = data.get("prompt_type", "")

    openai.api_key = openai_api_key
    prompt_text = ""
    prompt_clean = prompt_type.replace("(Custom) ", "").strip()
    default_path = os.path.join("templates", "default", f"{prompt_clean}.txt")
    custom_path = os.path.join("templates", "custom", f"{prompt_clean}.txt")

    if os.path.exists(default_path):
        with open(default_path, "r", encoding="utf-8") as f:
            prompt_text = f.read()
    elif os.path.exists(custom_path):
        with open(custom_path, "r", encoding="utf-8") as f:
            prompt_text = f.read()
    else:
        return jsonify({"note": f"Prompt template for '{prompt_type}' not found."})

    full_prompt = (
        prompt_text.strip() +
        "\n\nCHART DATA:\n" + chart_data.strip() +
        "\n\nTRANSCRIPT:\n" + transcript.strip()
    )

    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful clinical documentation assistant."},
                {"role": "user", "content": full_prompt}
            ],
            temperature=0.5
        )
        note = response.choices[0].message.content.strip()
        return jsonify({"note": note})
    except Exception as e:
        return jsonify({"note": f"Error generating note: {str(e)}"})

@app.route("/end_session", methods=["POST"])
def end_session():
    from datetime import datetime
    patient_name = "session"
    if os.path.exists("config.json"):
        with open("config.json", "r") as f:
            config = json.load(f)
            patient_name = config.get("patient_name", "session").strip().replace(" ", "_") or "session"
    if os.path.exists("live_transcript.txt"):
        with open("live_transcript.txt", "r", encoding="utf-8") as f:
            content = f.read().strip()
        if content:
            os.makedirs("transcripts", exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M")
            filename = f"{patient_name}_{timestamp}.txt"
            with open(os.path.join("transcripts", filename), "w", encoding="utf-8") as f:
                f.write(content)
    with open("live_transcript.txt", "w", encoding="utf-8") as f:
        f.write("")
    if os.path.exists("chunks"):
        for f in os.listdir("chunks"):
            if f.endswith(".wav") or f.endswith(".txt"):
                os.remove(os.path.join("chunks", f))
    return "", 204

@app.route("/shutdown", methods=["POST"])
def shutdown():
    shutdown_func = request.environ.get("werkzeug.server.shutdown")
    if shutdown_func:
        shutdown_func()
    return "Server shutting down..."

if __name__ == '__main__':
    app.run(debug=True)



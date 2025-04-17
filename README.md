# SimpleScribeVA (Offline Version)

**SimpleScribeVA** is a privacy-respecting, offline-first virtual medical scribe tool. This version is intended for use with the secure LLM of your choosing, such as VA GPT beta.

It allows clinicians to record patient encounters, transcribe audio locally using Whisper.cpp, and structure notes using prompt templates like SOAP or H&P.

**This offline version does not require an OpenAI API key** — instead of generating notes automatically, users can copy a prompt of your choosing + transcript content (either a dictation or a patient visit) to paste into the **VA GPT Beta** interface.

> ⚠️ This repository **does not include the Whisper model" you will need to actually transcribe, due to the large file size of the model. You will need to download that model (ggml-small.en.bin) directly from https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-small.en.bin or https://huggingface.co/ggerganov/whisper.cpp/tree/main, and save it in the whispercpp folder of this program.

> ⚠️ *AS OF THIS WRITING ON 4/16/25, THIS SOFTWARE IS NOT OFFICIALLY ENDORSED BY THE VA. IN ADDITION, PLEASE REVIEW THE INCLUDED LICENSE. IN PARTICULAR, THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.*

---

## ✨ What This Version Does

- Requires that you obtain verbal consent from anyone being recorded  
- Records audio from your default microphone in 30-second overlapping chunks  
- Transcribes audio using Whisper.cpp (entirely offline)  
- Audio is immediately deleted after transcription  
- Lets you paste in optional chart data  
- Lets you select and preview a documentation prompt and save your own custom prompts  
- Allows you to copy a prompt + transcript + chart data for pasting into the VA GPT Beta  
- Saves transcripts and templates in a folder that can sync with OneDrive across secure devices  
- Prior transcripts can be reviewed and deleted from within the program  
- Future: Potentially connect directly to VA GPT beta and/or clinical data

---

## ♻ Installation & Setup (Windows)

### Step 1: Install Python 3.13 (if not already on your computer)
- Go to: [https://www.python.org/downloads/](https://www.python.org/downloads/)
- Download **Python 3.13 (64-bit)**
- During installation, **check the box** that says:  
  ✅ *"Add Python to PATH"* (very important)

### Step 2: Prepare Folder in OneDrive
- Copy the entire **SimpleScribeVA** folder to your **VA OneDrive > Desktop** folder  
  - This ensures your transcripts and custom templates sync across devices

### Step 3: Download the transcription model
- Download the preferred model (ggml-small.en.bin) directly from https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-small.en.bin or https://huggingface.co/ggerganov/whisper.cpp/tree/main, and save it in the whispercpp folder in the SimpleScribeVA folder. If you decide to use a different Whisper model, save it in the same folder, and open config.json in Notepad and change the model name there to match your model.

### Step 4: First-Time Setup
- Double-click `Setup.bat` in the folder  
  - This creates a virtual environment and installs required packages  
  - May take a few minutes

### Step 5: Daily Use
- After setup, launch the app anytime by double-clicking:  
  `StartSimpleScribeVA.bat`  
  (Consider making a shortcut to this on your desktop)
- A browser window will open to:  
  `http://127.0.0.1:5000`
- Click **"Verify and Continue"** on the landing page
- Close the terminal/command prompt windows (black, text-filled boxes) to close the program fully

> 💡 You can bookmark that local address (http://127.0.0.1:5000) for easy access, as long as the app is running.

---

## 🔄 Workflow

1. Click **Start Recording** to begin recording audio (button glows subtly with your voice)  
2. Speak normally — every ~30 seconds, the app saves and transcribes a chunk  
3. Click **Stop Recording**. Once you stop recording, the final audio will finish transcribing
4. You can start and stop recording multiple times during a session  
5. Select a prompt template from the dropdown  
6. Preview the prompt in the box below  
7. Click **"Copy Prompt / Transcript / Chart Data"**  
8. Paste into the **VA GPT Beta** (https://vagptbeta.va.gov) interface to generate a note  
9. Save your transcript by clicking **End Session**

---

## 🌐 Folder Structure

```
SimpleScribeVA/
├── run_local_server.py         # Flask app (backend)
├── monitor_transcription.py    # Whisper audio chunk processor
├── record_audio.py             # Mic recording logic
├── chunks/                     # Audio files are saved here until transcribed, then deleted. The folder will be created the first time you run SimpleScribeVA
├── static/                     # app.js which contains the various frontend javascript functions
├── templates/                  # html files for pages
│   ├── default/                # Built-in prompt templates
│   └── custom/                 # User-created templates
├── transcripts/                # Saved transcripts by date. The folder will be created the first time you run SimpleScribeVA 
├── whispercpp/                 # Local Whisper binary + model
├── .env                        # Where API keys may eventually go
├── live_transcript.txt         # Where the live transcript is kept during a session
├── config.json                 # Tracks model name (in this case Whisper's ggml-small.en.bin)
├── Setup.bat                   # One-time environment setup
└── StartSimpleScribeVA.bat     # Launcher
```

---

## 🤝 How It Works (Under the Hood)

- The Flask app (`run_local_server.py`) runs your local web interface  
- Audio is recorded live via `sounddevice` and saved to `chunks/`  
- `monitor_transcription.py` watches `chunks/`, runs Whisper.cpp on new audio, and appends results to `live_transcript.txt`  
- You can copy the transcript + chart data + prompt directly to your clipboard  
- Eventually, a future version may support **direct GPT-4/VA API integration**

---

## 📚 Requirements.txt Review
The current version requires:
flask
python-dotenv
sounddevice
scipy
openai>=1.0.0
psutil
Note:
	•	openai is retained for compatibility but is unused in fallback mode
	•	scipy is only needed by some sounddevice builds

---

## ⚠️ Notes

- Transcripts are not encrypted, so they should be stored in your secure **VA OneDrive** account  
  (This will occur automatically if the folder lives on your OneDrive desktop)
- Transcripts can be reviewed and deleted from the **archive page** (click the folder icon in the top-right corner of the app)

---

## 🏠 Designed For

- Clinicians who want to draft notes efficiently using GPT-based tools  
- Settings where network connectivity or privacy are concerns  
- VA providers testing GPT Beta workflows

---

**Simha.Reddy@va.gov**  
April 2025

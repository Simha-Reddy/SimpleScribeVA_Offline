function isRecording() {
	const btn = document.getElementById("recordBtn");
	return btn && btn.textContent.includes("Stop");
}

let isRecordingActive = false;

window.toggleRecording = function () {
    const btn = document.getElementById("recordBtn");
    const isRecording = btn.textContent.includes("Start");

    const statusEl = document.getElementById("statusIndicator");

    if (isRecording) {
        btn.textContent = "Stop Recording";
        btn.classList.remove("start-button");
        btn.classList.add("stop-button");
        fetch("/start_recording", { method: "POST" });
        startMicFeedback();
        statusEl.textContent = "Recording...";
        isRecordingActive = true;
    } else {
        btn.textContent = "Start Recording";
        btn.classList.remove("stop-button");
        btn.classList.add("start-button");
        fetch("/stop_recording", { method: "POST" });
        stopMicFeedback();
        statusEl.textContent = "Transcribing...";
        isRecordingActive = false;
    }
};

// ⚠️ Warn user if they try to leave the page while recording
window.addEventListener("beforeunload", (e) => {
    if (isRecordingActive) {
        e.preventDefault();
        e.returnValue = "You have an active recording. Leaving the page will stop it.";
        return e.returnValue;
    }
});

// 🛑 Send a stop request on unload (e.g. closing the tab)
window.addEventListener("unload", () => {
    if (isRecordingActive) {
        navigator.sendBeacon("/stop_recording");
    }
});

let audioContext, analyser, microphone, animationId;

function startMicFeedback() {
    const recordBtn = document.getElementById("recordBtn");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            function animate() {
                analyser.getByteTimeDomainData(dataArray);
                const volume = Math.max(...dataArray) - 128;
                const intensity = Math.min(Math.abs(volume) / 128, 1);
                const glow = Math.floor(intensity * 50);  // max glow
                recordBtn.style.boxShadow = `0 0 ${glow}px red`;
                animationId = requestAnimationFrame(animate);
            }

            animate();
        })
        .catch(err => {
            console.error("Mic access error:", err);
        });
}

function stopMicFeedback() {
    if (animationId) cancelAnimationFrame(animationId);
    if (audioContext) audioContext.close();
    const recordBtn = document.getElementById("recordBtn");
    if (recordBtn) recordBtn.style.boxShadow = "none";
}

function copyNote() {
    const text = document.getElementById("noteOutput").value;
    navigator.clipboard.writeText(text).then(() => {
        alert("Note copied to clipboard.");
    });
}

function createNote() {
    const transcript = document.getElementById("rawTranscript").value;
    const chartData = document.getElementById("chartData").value;
    const prompt = document.getElementById("promptSelector").value;

    const noteBox = document.getElementById("noteOutput");
    noteBox.value = "Loading...";

    fetch("/create_note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, chart_data: chartData, prompt_type: prompt })
    })
    .then(response => response.json())
    .then(data => {
        noteBox.value = data.note;
    });
}

function loadPrompts() {
    fetch("/get_prompts")
        .then(response => response.json())
        .then(data => {
            const selector = document.getElementById("promptSelector");
            selector.innerHTML = "";

            const lastSelected = localStorage.getItem("lastPrompt");

            for (let name in data) {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                selector.appendChild(opt);
            }

            // If a previous selection exists and is still available
            if (lastSelected && data[lastSelected]) {
                selector.value = lastSelected;
                document.getElementById("promptPreview").value = data[lastSelected];
            } else if (selector.value) {
                document.getElementById("promptPreview").value = data[selector.value] || "";
            }

            selector.addEventListener("change", () => {
                const selected = selector.value;
                document.getElementById("promptPreview").value = data[selected] || "";
                localStorage.setItem("lastPrompt", selected);  // ✅ Save user's last choice
            });
        });
}


function copyFullContent() {
    const prompt = document.getElementById("promptPreview").value || "";
    const chartData = document.getElementById("chartData").value || "";

    const rawDiv = document.getElementById("rawTranscript");
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(rawDiv);
    selection.removeAllRanges();
    selection.addRange(range);

    // Create a temporary element for clean text extraction
    const temp = document.createElement("div");
    temp.innerHTML = rawDiv.innerHTML;
    const textOnlyTranscript = temp.textContent || temp.innerText || "";

    const fullContent = `${prompt}

	---
	
	## 📋 CHART DATA
	${chartData}
	
	---
	
	## 🎙️ TRANSCRIPT
	${textOnlyTranscript}
	`;
	
    navigator.clipboard.writeText(fullContent).then(() => {
        alert("Prompt, transcript, and chart data copied with Markdown formatting.");
    });
}

function copyTranscriptOnly() {
    const rawDiv = document.getElementById("rawTranscript");
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(rawDiv);
    selection.removeAllRanges();
    selection.addRange(range);

    // Create a temporary element for clean text extraction
    const temp = document.createElement("div");
    temp.innerHTML = rawDiv.innerHTML;
    const textOnlyTranscript = temp.textContent || temp.innerText || "";

    navigator.clipboard.writeText(textOnlyTranscript)
        .then(() => alert("Transcript copied to clipboard."))
        .catch(err => console.error("Clipboard error:", err));
}

function saveModelConfig() {
    const displayToFilename = {
        "tiny": "ggml-tiny.en.bin",
        "small": "ggml-small.en.bin"
    };
    const selected = document.getElementById("modelSelector").value;
    const model = displayToFilename[selected];

    fetch("/save_config", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
    })
    .then(response => {
        if (response.ok) {
            alert("Settings saved and transcription restarted with the new model.");
        } else {
            alert("Failed to save settings.");
        }
    })
    .catch(err => {
        console.error("Error saving settings:", err);
        alert("Error occurred saving settings.");
    });
}

function pollScribeStatus() {
    fetch('/scribe_status')
        .then(response => response.json())
        .then(data => {
            const statusEl = document.getElementById('statusIndicator');

            if (transcriptBox && !userIsEditing) {
                transcriptBox.innerHTML = data.transcript;

                if (autoScrollEnabled) {
                    transcriptBox.scrollTop = transcriptBox.scrollHeight;
                }
            }

            if (statusEl) {
                if (isRecording()) {
                    statusEl.textContent = "Recording...";
                } else if (data.pending_chunks > 0) {
                    statusEl.textContent = "Transcribing...";
                } else {
                    statusEl.textContent = "";
                }
            }
        })
        .catch(err => console.error("Error polling scribe status:", err));
}

setInterval(pollScribeStatus, 3000);

let userIsEditing = false;
let autoScrollEnabled = true;
let editTimer = null;

const transcriptBox = document.getElementById("rawTranscript");

if (transcriptBox) {
    // Track when user types
    transcriptBox.addEventListener("input", () => {
        userIsEditing = true;
        clearTimeout(editTimer);
        editTimer = setTimeout(() => {
            userIsEditing = false;
        }, 3000); // resume after 3 seconds of no typing
    });

    // Track manual scroll to disable autoscroll
    transcriptBox.addEventListener("scroll", () => {
        const nearBottom = transcriptBox.scrollHeight - transcriptBox.scrollTop - transcriptBox.clientHeight < 10;
        autoScrollEnabled = nearBottom;
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const endSessionBtn = document.getElementById("endSessionBtn");
    if (endSessionBtn) {
        endSessionBtn.addEventListener("click", async () => {
            if (confirm("Are you sure you want to end the session? This will archive the transcript and clear the current state.")) {
                await fetch("/end_session", { method: "POST" });
                document.getElementById("rawTranscript").value = "";
                document.getElementById("chartData").value = "";
                document.getElementById("noteOutput").value = "";
                window.location.href = "/";
            }
        });
    }
});

window.toggleAll = function(source) {
	const checkboxes = document.querySelectorAll('input[name="delete"]');
	checkboxes.forEach(checkbox => {
		checkbox.checked = source.checked;
	});
};

function saveCustomTemplate() {
    const name = document.getElementById("customTemplateName").value;
    const text = document.getElementById("customTemplateText").value;
    fetch("/save_template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text })
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            alert("Saved.");
        }
    });
}

function deleteTemplate(name) {
    if (confirm(`Delete custom template "${name}"?`)) {
        fetch("/delete_template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        }).then(() => {
            location.reload();
        });
    }
}

function loadCustomTemplateList() {
    fetch("/list_custom_templates")
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById("customTemplateList");
            list.innerHTML = "";
            data.forEach(name => {
                const li = document.createElement("li");

                const showBtn = document.createElement("button");
				showBtn.style.marginRight = "10px";
                showBtn.textContent = "Show";
                showBtn.addEventListener("click", () => {
                    editor.style.display = editor.style.display === "none" ? "block" : "none";
					// Load template content
					fetch(`/load_template/${encodeURIComponent(name)}`)
                    .then(res => res.text())
                    .then(text => {
                        textarea.value = text;
                    });
                });

                const nameSpan = document.createElement("span");
                nameSpan.textContent = name;

                const editor = document.createElement("div");
                editor.className = "template-editor";
                editor.style.display = "none";

                const textarea = document.createElement("textarea");
				textarea.rows = 10;
                const saveBtn = document.createElement("button");
                saveBtn.textContent = "Save";
				saveBtn.style.marginRight = "12px";
                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "Delete";

                saveBtn.addEventListener("click", () => {
                    fetch("/save_template", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, text: textarea.value })
                    }).then(() => alert("Template saved."));
                });

                deleteBtn.addEventListener("click", () => {
                    if (confirm(`Delete template "${name}"?`)) {
                        fetch(`/delete_template/${encodeURIComponent(name)}`, { method: "DELETE" })
                            .then(() => loadCustomTemplateList());
                    }
                });

                editor.appendChild(textarea);
                editor.appendChild(saveBtn);
                editor.appendChild(deleteBtn);

                // Swap order here
                li.appendChild(showBtn);
                li.appendChild(nameSpan);
                li.appendChild(editor);
                list.appendChild(li);

            });
        });
}

document.addEventListener('DOMContentLoaded', () => {
    loadPrompts();
    loadCustomTemplateList();
//    loadModelConfig();
});

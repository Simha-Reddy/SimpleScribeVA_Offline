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

            for (let name in data) {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                selector.appendChild(opt);
            }

            // When a user changes selection, update preview
            selector.addEventListener("change", () => {
                const selected = selector.value;
                document.getElementById("promptPreview").value = data[selected] || "";
            });

            // Automatically load preview of the first option
            if (selector.value) {
                document.getElementById("promptPreview").value = data[selector.value] || "";
            }
        });
}

function copyFullContent() {
    const prompt = document.getElementById("promptPreview").value || "";
    const transcript = document.getElementById("rawTranscript").value || "";
    const chartData = document.getElementById("chartData").value || "";

    const full = `PROMPT:\n${prompt}\n\nTRANSCRIPT:\n${transcript}\n\nCHART DATA:\n${chartData}`;
    navigator.clipboard.writeText(full).then(() => {
        alert("Prompt, transcript, and chart data copied.");
    });
}

function copyTranscriptOnly() {
    const transcript = document.getElementById("rawTranscript").value || "";
    navigator.clipboard.writeText(transcript).then(() => {
        alert("Transcript copied.");
    });
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
            const transcriptBox = document.getElementById('rawTranscript');
            if (transcriptBox) {
                transcriptBox.value = data.transcript;
                transcriptBox.scrollTop = transcriptBox.scrollHeight;  // ✅ auto-scroll
            }

            const statusEl = document.getElementById('statusIndicator');
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
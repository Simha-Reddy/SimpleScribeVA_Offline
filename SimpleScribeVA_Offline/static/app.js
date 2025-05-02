// --- State & globals ---
let chatHistory = [];
let isRecordingActive = false;
let lastServerTranscript = "";
let audioContext, analyser, microphone, animationId;

// --- Recording controls ---
function isRecording() {
  const btn = document.getElementById("recordBtn");
  return btn && btn.textContent.includes("Stop");
}

window.toggleRecording = function () {
  const btn     = document.getElementById("recordBtn");
  const status  = document.getElementById("statusIndicator");

  if (!isRecordingActive) {
    btn.textContent = "Stop Recording";
    btn.classList.replace("start-button", "stop-button");
    fetch("/start_recording", { method: "POST" });
    startMicFeedback();
    status.textContent = "Recording...";
    isRecordingActive = true;
  } else {
    btn.textContent = "Start Recording";
    btn.classList.replace("stop-button", "start-button");
    fetch("/stop_recording", { method: "POST" });
    stopMicFeedback();
    status.textContent = "";
    isRecordingActive = false;
  }
};

window.addEventListener("beforeunload", e => {
  if (isRecordingActive) {
    e.preventDefault();
    e.returnValue = "You have an active recording. Leaving will stop it.";
  }
});
window.addEventListener("unload", () => {
  if (isRecordingActive) navigator.sendBeacon("/stop_recording");
});

// --- Mic visualization ---
function startMicFeedback() {
  const btn = document.getElementById("recordBtn");
  if (!navigator.mediaDevices?.getUserMedia) return;

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser     = audioContext.createAnalyser();
      microphone   = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      function animate() {
        analyser.getByteTimeDomainData(dataArray);
        const volume    = Math.max(...dataArray) - 128;
        const intensity = Math.min(Math.abs(volume) / 128, 1);
        const glow      = Math.floor(intensity * 50);
        btn.style.boxShadow = `0 0 ${glow}px red`;
        animationId = requestAnimationFrame(animate);
      }
      animate();
    })
    .catch(err => console.error("Mic access error:", err));
}

function stopMicFeedback() {
  if (animationId) cancelAnimationFrame(animationId);
  if (audioContext) audioContext.close();
  document.getElementById("recordBtn").style.boxShadow = "none";
}

/* --- Live transcript polling & append-only update ---
function pollScribeStatus() {
  fetch('/live_transcript')
    .then(r => r.text())
    .then(raw => {
      // strip HTML tags
      const plain = raw.replace(/<[^>]*>/g, '');

      const ta = document.getElementById('rawTranscript');
      if (!ta) return;

      if (lastServerTranscript === "") {
        // initial fill
        ta.value = plain;
      } else {
        // append only new text
        const newChunk = plain.slice(lastServerTranscript.length);
        ta.value += newChunk;
      }

      lastServerTranscript = plain;
      ta.scrollTop = ta.scrollHeight;
    })
    .catch(err => console.error("Error polling transcript:", err));
}*/

// --- Live transcript polling & status indicator ---
function pollScribeStatus() {
  fetch('/scribe_status')
    .then(r => r.json())
    .then(data => {
      // 1) update transcript textarea (append-only)
      const ta = document.getElementById('rawTranscript');
	  // 2) strip any HTML tags
      const plain = data.transcript.replace(/<[^>]*>/g, '');
      if (lastServerTranscript === "") {
	  // 3) when first starting polling, fill with whatever is in live_transcript
        ta.value = plain;
      } else {
	  // 4) on future polls, append to whatever's in the box
        const newChunk = plain.slice(lastServerTranscript.length);
        ta.value += newChunk;
      }
	  // 5) remember what's actually in the box, including user edits
      lastServerTranscript = plain;
      // 6) autoscroll
	  ta.scrollTop = ta.scrollHeight;

      // 7) update status indicator based on recording/transcription state
      const statusEl = document.getElementById('statusIndicator');
      if (isRecordingActive) {
        statusEl.textContent = 'Recording...';
      } else if (data.pending_chunks > 0) {
        statusEl.textContent = 'Transcribing...';
      } else {
        statusEl.textContent = '';
      }
    })
    .catch(err => console.error('Error polling status:', err));
}

// update transcript box every 3 seconds
setInterval(pollScribeStatus, 3000);


// --- Create Note & chat feedback ---
async function createNote() {
    console.log("createNote fired");

    const transcript = document.getElementById("rawTranscript").value;
    const chartData  = document.getElementById("chartData").value;
    const promptText = document.getElementById("promptPreview").value;    // <-- full prompt
    const noteBox    = document.getElementById("feedbackReply");

    noteBox.innerText = "Loading…";

    const res = await fetch('/create_note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transcript:   transcript,
            chart_data:   chartData,
            prompt_text:  promptText
        })
    });

    const data = await res.json();
    noteBox.innerText  = data.note;
    chatHistory        = data.messages || [
        { role: "system",    content: "Note‐edit session" },
        { role: "assistant", content: data.note }
    ];
}


async function submitFeedback() {
  const input    = document.getElementById("feedbackInput");
  const replyDiv = document.getElementById("feedbackReply");
  const userMsg  = input.value.trim();
  if (!userMsg) return;

  // 1) Disable the input and show loading text
  input.disabled     = true;
  const oldPlaceholder = input.placeholder;
  input.placeholder  = "Loading AI response…";
  replyDiv.innerText = "Loading…";

  // 2) Send the request
  chatHistory.push({ role: 'user', content: userMsg });
  let data;
  try {
    const res = await fetch('/chat_feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory })
    });
    data = await res.json();
  } catch (err) {
    replyDiv.innerText = "Error: " + err.message;
    data = { reply: "" };
  }

  // 3) Display the reply
  if (data.reply) {
    chatHistory.push({ role: 'assistant', content: data.reply });
    replyDiv.innerText = data.reply;
  }

  // 4) Re-enable the input and restore placeholder
  input.disabled    = false;
  input.placeholder = oldPlaceholder;
  input.value       = "";
  input.focus();
}


// --- Copy final note ---
function copyFinalNote() {
  const txt = document.getElementById("feedbackReply").innerText;
  navigator.clipboard.writeText(txt)
    .then(() => alert("Final note copied!"))
    .catch(() => alert("Copy failed"));
}

// --- Prompt & custom template loaders ---
let promptData = {};  // <-- store all name→text mappings

function loadPrompts() {
  fetch("/get_prompts")
    .then(r => r.json())
    .then(data => {
      promptData = data;                              // save it
      const sel     = document.getElementById("promptSelector");
      const preview = document.getElementById("promptPreview");
      if (!sel || !preview) {
	console.error("promptSelector or promptPreview not found!");
	return;
      }
      // clear out any old options
      sel.innerHTML = "";

      // repopulate options
      for (let name in data) {
        const opt = document.createElement("option");
        opt.value    = name;
        opt.text     = name;
        sel.appendChild(opt);
      }

      // restore last choice (or default to first)
      const last = localStorage.getItem("lastPrompt");
      if (last && data[last]) {
        sel.value = last;
      }
      // set initial preview
      preview.value = data[sel.value] || "";

      // wire up future changes
      sel.addEventListener("change", () => {
        const v = sel.value;
        preview.value = promptData[v] || "";
        localStorage.setItem("lastPrompt", v);
      });
    })
    .catch(err => console.error("Error loading prompts:", err));
}

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

let customTemplates = {};  // name → text

function loadCustomTemplateList() {
  const ul = document.getElementById("customTemplateList");
  ul.innerHTML = "";

  fetch("/list_custom_templates")
    .then(r => r.json())
    .then(names => {
      names.forEach(name => {
        // list item
        const li = document.createElement("li");
        li.style.marginBottom = "8px";

        // show button
        const showBtn = document.createElement("button");
        showBtn.textContent = "Show";
        showBtn.style.marginRight = "8px";

        // when clicked, fetch & display the template
        showBtn.addEventListener("click", () => {
          // if we already loaded it, just toggle visibility
          if (customTemplates[name]) {
            editor.style.display = editor.style.display === "none" ? "block" : "none";
            textarea.value   = customTemplates[name];
            return;
          }

          // else fetch it
          fetch(`/load_template/${encodeURIComponent(name)}`)
            .then(res => res.text())
            .then(text => {
              customTemplates[name] = text;
              textarea.value       = text;
              editor.style.display = "block";
            })
            .catch(err => console.error("Error loading template:", err));
        });

        // name label
        const nameSpan = document.createElement("span");
        nameSpan.textContent = name;
        nameSpan.style.marginRight = "12px";

        // hidden editor div
        const editor = document.createElement("div");
        editor.style.display = "none";
        editor.style.marginTop = "6px";

        // textarea for preview/edit
        const textarea = document.createElement("textarea");
        textarea.rows = 6;
        textarea.style.width = "100%";
        textarea.value = "";  // filled in on demand

        // save + delete buttons
        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save";
        saveBtn.style.marginRight = "6px";
        saveBtn.addEventListener("click", () => {
          fetch("/save_template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, text: textarea.value })
          }).then(() => {
            customTemplates[name] = textarea.value;
            alert("Saved.");
          });
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => {
          if (!confirm(`Delete "${name}"?`)) return;
          fetch(`/delete_template/${encodeURIComponent(name)}`, { method: "DELETE" })
            .then(() => loadCustomTemplateList());
        });

        editor.append(textarea, saveBtn, deleteBtn);
        li.append(showBtn, nameSpan, editor);
        ul.appendChild(li);
      });
    })
    .catch(err => console.error("Error loading custom templates:", err));
}

// --- End Session Button ---
const endBtn = document.getElementById("endSessionBtn");
if (!endBtn) {
  console.error("⚠️ endSessionBtn not found in DOM!");
} else {
  endBtn.addEventListener("click", async () => {
    console.log("End-Session button clicked");
    if (!confirm("End session and archive transcript?")) return;
    await fetch('/end_session', { method: 'POST' });
    document.getElementById('rawTranscript').value    = "";
    document.getElementById('chartData').value        = "";
    document.getElementById('feedbackReply').innerText = "";
    lastServerTranscript = "";
    window.location.reload();
  });
}

function uploadPDF() {
  const uploadBtn = document.getElementById("uploadPDFBtn");
  if (!uploadBtn) {
    console.error("⚠️ uploadPDFBtn not found in DOM!");
    return;
  }
  
  // Create a file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  
  // Set up the click handler for the upload button
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Handle file selection
  fileInput.addEventListener('change', async (event) => {
    if (!fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file.');
      return;
    }
    
    // Show upload in progress
    uploadBtn.disabled = true;
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = 'Uploading...';
    
    // Create FormData and send to server
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
      const response = await fetch('/upload_pdf', {
        method: 'POST',
        body: formData
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${responseText}`);
      }
      
      let result;
      try {
        result = JSON.parse(responseText);
        alert(`PDF uploaded successfully: ${file.name}`);
        
        // If there's a chartData field, append the PDF content to it
        if (result.text && document.getElementById('chartData')) {
          document.getElementById('chartData').value += '\n\n' + result.text;
        }
      } catch (jsonError) {
        alert(`Error processing server response`);
      }
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = originalText;
      // Keep fileInput in DOM in case we need to reuse it
    }
  });
}

// Call during initialization
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById("promptSelector")) loadPrompts();
  if (document.getElementById("customTemplateList")) loadCustomTemplateList();
  uploadPDF(); // Initialize PDF upload functionality
});
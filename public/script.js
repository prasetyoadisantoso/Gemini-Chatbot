const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const fileInput = document.getElementById("fileInput"); // zip
const uploadButton = document.getElementById("uploadButton"); // zip
const folderInput = document.getElementById("folderInput"); // folder
const analyzeFolderButton = document.getElementById("analyzeFolderButton"); // folder
const chatbox = document.getElementById("chatbox");
const loadingIndicator = document.getElementById("loadingIndicator");

// Initialize Marked.js with Highlight.js
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        try {
            return hljs.highlight(code, { language, ignoreIllegals: true }).value;
        } catch (e) {
            return hljs.highlight(code, { language: 'plaintext', ignoreIllegals: true }).value;
        }
    },
    langPrefix: 'hljs language-',
    breaks: true, // Convert single newlines in md to <br>
    gfm: true // Enable GitHub Flavored Markdown
});

// ---- Core Functions ----

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || sendButton.disabled) return;

    appendMessage("Anda", message, "user");
    userInput.value = "";
    userInput.style.height = 'auto';

    // Tambahkan pesan "Loading..." ke chatbox
    appendMessage("Bot", "Memproses...", "bot", true); // isLoading = true

    setLoading(true); // Disable input fields

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });
        if (!response.ok) throw await createErrorFromResponse(response, "Gagal mengirim pesan");

        const data = await response.json();
        removeLoadingMessage(); // Hapus pesan "Loading..."
        appendMessage("Bot", data.reply, "bot");
    } catch (error) {
        removeLoadingMessage(); // Hapus pesan "Loading..." jika terjadi error
        console.error("Send message error:", error);
        appendMessage("Bot", `Terjadi kesalahan: ${error.message}`, "bot");
    } finally {
        setLoading(false); // Enable input fields
    }
}

async function uploadZip() {
    if (!fileInput.files.length || uploadButton.disabled) {
        if (!uploadButton.disabled) appendMessage("Bot", "Pilih file ZIP dahulu.", "bot");
        return;
    }
    const file = fileInput.files[0];
    appendMessage("Anda", `Mengunggah file: ${file.name}`, "user");

    // Tambahkan pesan "Loading..." ke chatbox
    appendMessage("Bot", "Mengunggah & menganalisis ZIP...", "bot", true); // isLoading = true
    setLoading(true);

    try {
        const formData = new FormData();
        formData.append("file", file); // Nama field 'file' harus cocok dg server

        const response = await fetch("/upload", { method: "POST", body: formData });
        removeLoadingMessage();
        if (!response.ok) throw await createErrorFromResponse(response, "Gagal unggah ZIP");

        const data = await response.json();
        appendMessage("Bot", `${data.message || 'Hasil analisis ZIP'}:\n${data.analysis}`, "bot");
    } catch (error) {
        removeLoadingMessage(); // Hapus pesan "Loading..." jika terjadi error
        console.error("Upload ZIP error:", error);
        appendMessage("Bot", `Kesalahan analisis ZIP: ${error.message}`, "bot");
    } finally {
        fileInput.value = "";
        setLoading(false);
    }
}

async function analyzeFolder() {
    const files = folderInput.files;
    if (!files || files.length === 0 || analyzeFolderButton.disabled) {
        if (!analyzeFolderButton.disabled) appendMessage("Bot", "Pilih folder proyek dahulu.", "bot");
        return;
    }
    let folderName = files[0].webkitRelativePath.split('/')[0] || "folder";
    appendMessage("Anda", `Menganalisis folder: ${folderName} (${files.length} item)`, "user");

    // Tambahkan pesan "Loading..." ke chatbox
    appendMessage("Bot", "Menganalisis folder...", "bot", true); // isLoading = true
    setLoading(true);

    try {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            // Nama field 'folderFiles' harus cocok dg server
            formData.append('folderFiles', files[i], files[i].webkitRelativePath || files[i].name);
        }

        const response = await fetch("/analyze-folder", { method: "POST", body: formData });
        removeLoadingMessage();
        if (!response.ok) throw await createErrorFromResponse(response, "Gagal analisis folder");

        const data = await response.json();
        appendMessage("Bot", `${data.message || 'Hasil analisis folder'}:\n${data.analysis}`, "bot");
    } catch (error) {
        removeLoadingMessage(); // Hapus pesan "Loading..." jika terjadi error
        console.error("Analyze folder error:", error);
        appendMessage("Bot", `Kesalahan analisis folder: ${error.message}`, "bot");
    } finally {
        folderInput.value = "";
        setLoading(false);
    }
}

// ---- UI Helper Functions ----

function appendMessage(sender, text, className, isLoading = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", className);
    if (isLoading) messageDiv.classList.add("loading-message");

    const senderStrong = document.createElement('strong');
    senderStrong.textContent = `${sender}:`;
    messageDiv.appendChild(senderStrong);

    const contentWrapper = document.createElement('div');

    if (className === 'bot') {
        // Render Markdown untuk bot
        const sanitizedHtml = marked.parse(text || "..."); // Handle null/undefined text
        contentWrapper.innerHTML = sanitizedHtml;
        // Terapkan highlighting setelah ditambahkan
        contentWrapper.querySelectorAll('pre code').forEach((block) => {
            try {
                hljs.highlightElement(block);
            } catch (e) { /* ignore */
            }
        });

        // Add copy button for code blocks
        contentWrapper.querySelectorAll('pre').forEach(preElement => {
            const copyButton = document.createElement('button');
            copyButton.classList.add('copy-button');
            copyButton.textContent = 'Copy';
            copyButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent triggering parent hover
                // Dapatkan kode dari elemen <code> di dalam <pre>
                copyToClipboard(preElement.querySelector('code').textContent);
            });
            preElement.appendChild(copyButton);
        });

    } else {
        // Tampilkan teks user dengan menjaga format spasi/baris baru
        contentWrapper.style.whiteSpace = 'pre-wrap';
        contentWrapper.textContent = text; // Aman dari HTML injection
    }
    messageDiv.appendChild(contentWrapper);
    chatbox.appendChild(messageDiv);
    scrollToBottom();
}

function removeLoadingMessage() {
    const loadingMsg = chatbox.querySelector(".loading-message");
    if (loadingMsg) loadingMsg.remove();
}

function setLoading(isLoading) {
    userInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    fileInput.disabled = isLoading;
    uploadButton.disabled = isLoading;
    folderInput.disabled = isLoading;
    analyzeFolderButton.disabled = isLoading;

    const placeholder = isLoading
        ? "Menunggu balasan..."
        : "Ketik pesan atau tempel kode... (Shift+Enter untuk mengirim)";
    userInput.placeholder = placeholder;

    if (!isLoading) {
        // Fokus hanya jika input text tidak sedang disable
        setTimeout(() => { // Delay sedikit agar fokus bekerja setelah state update
            if (!userInput.disabled) userInput.focus();
        }, 0);
    }
}

function scrollToBottom() {
    // Memberi sedikit waktu agar rendering selesai
    setTimeout(() => {
        chatbox.scrollTop = chatbox.scrollHeight;
    }, 50);
}

// Helper untuk membuat Error dari response fetch
async function createErrorFromResponse(response, defaultMessage) {
    let errorDetail = `${response.status} ${response.statusText || defaultMessage}`;
    try {
        const errorJson = await response.json();
        errorDetail = errorJson.error || errorDetail; // Ambil pesan error dari JSON jika ada
    } catch (e) { /* Abaikan jika body bukan JSON */
    }
    return new Error(errorDetail);
}

// Function to copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard');
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
        });
}

// ---- Event Listeners ----

// Kirim dengan Shift+Enter atau Ctrl+Enter
userInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && (event.shiftKey || event.ctrlKey)) {
        event.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto'; // Reset agar bisa menyusut
    userInput.style.height = (userInput.scrollHeight + 2) + 'px'; // Sesuaikan dengan konten
});

// Auto-scroll saat window resize (jika chatbox di bawah)
window.addEventListener('resize', scrollToBottom);
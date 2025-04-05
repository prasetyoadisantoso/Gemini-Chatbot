const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const fileInput = document.getElementById("fileInput"); // zip
const uploadButton = document.getElementById("uploadButton"); // zip
const folderInput = document.getElementById("folderInput"); // folder
const analyzeFolderButton = document.getElementById("analyzeFolderButton"); // folder
const chatbox = document.getElementById("chatbox");
const loadingIndicator = document.getElementById("loadingIndicator");
const multiFileInput = document.getElementById("multiFileInput");
const analyzeMultiFileButton = document.getElementById("analyzeMultiFileButton");
const selectedFilesList = document.getElementById("selectedFilesList"); // ** BARU **
const clearMultiFileButton = document.getElementById("clearMultiFileButton"); // ** BARU **
const selectedFilesDisplay = document.getElementById("selectedFilesDisplay"); // ** BARU (opsional, untuk show/hide) **

let accumulatedFiles = []; // ** BARU **

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
        const response = await fetch("/api/chat", {
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

        const response = await fetch("/api/upload", { method: "POST", body: formData });
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

        const response = await fetch("/api/analyze-folder", { method: "POST", body: formData });
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

// --- Fungsi Baru atau Modifikasi untuk Multi-File ---

// ** BARU: Fungsi untuk menangani pemilihan file baru **
function handleFileSelection(event) {
    const newFiles = event.target.files; // FileList baru dari input
    if (!newFiles || newFiles.length === 0) {
        return; // Tidak ada file dipilih
    }

    let filesAddedCount = 0;
    for (let i = 0; i < newFiles.length; i++) {
        const newFile = newFiles[i];

        // Cek duplikat sederhana (berdasarkan nama dan ukuran)
        const isDuplicate = accumulatedFiles.some(existingFile =>
            existingFile.name === newFile.name && existingFile.size === newFile.size
            // Anda bisa menambahkan cek lastModified jika perlu: && existingFile.lastModified === newFile.lastModified
        );

        if (!isDuplicate) {
            accumulatedFiles.push(newFile);
            filesAddedCount++;
        } else {
            console.log(`File duplikat dilewati: ${newFile.name}`);
            // Beri tahu pengguna jika perlu
            // appendMessage("Info", `File "${newFile.name}" sudah ada dalam daftar dan dilewati.`, "bot");
        }
    }

    if (filesAddedCount > 0) {
        console.log(`${filesAddedCount} file baru ditambahkan ke antrian.`);
    }

    // Perbarui tampilan daftar file
    updateSelectedFilesDisplay();

    // ** Penting: Kosongkan value input agar event 'change' bisa trigger lagi **
    // bahkan jika pengguna memilih file yang sama persis
    event.target.value = "";
}

// ** BARU: Fungsi untuk memperbarui tampilan daftar file **
function updateSelectedFilesDisplay() {
    selectedFilesList.innerHTML = ''; // Kosongkan daftar sebelumnya

    if (accumulatedFiles.length === 0) {
        selectedFilesList.innerHTML = '<li>Belum ada file dipilih.</li>';
        clearMultiFileButton.style.display = 'none'; // Sembunyikan tombol clear
    } else {
        accumulatedFiles.forEach((file, index) => {
            const listItem = document.createElement('li');
            listItem.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
             // Opsional: Tambahkan tombol hapus per file
             const removeBtn = document.createElement('button');
             removeBtn.textContent = 'x';
             removeBtn.classList.add('remove-file-btn');
             removeBtn.title = `Hapus ${file.name}`;
             removeBtn.onclick = () => removeSelectedFile(index); // Panggil fungsi hapus dgn index
             listItem.appendChild(removeBtn);

            selectedFilesList.appendChild(listItem);
        });
        clearMultiFileButton.style.display = 'inline-block'; // Tampilkan tombol clear
    }
     // Juga pastikan tombol analisis diaktifkan/dinonaktifkan
     analyzeMultiFileButton.disabled = accumulatedFiles.length === 0;
}


// ** BARU: Fungsi untuk menghapus satu file dari daftar **
function removeSelectedFile(indexToRemove) {
    if (indexToRemove >= 0 && indexToRemove < accumulatedFiles.length) {
        const removedFile = accumulatedFiles.splice(indexToRemove, 1); // Hapus dari array
        console.log(`File dihapus dari antrian: ${removedFile[0]?.name}`);
        updateSelectedFilesDisplay(); // Perbarui tampilan
    }
}


// ** BARU: Fungsi untuk menghapus semua file terpilih **
function clearSelectedFiles() {
    accumulatedFiles = []; // Kosongkan array
    multiFileInput.value = ""; // Kosongkan input file juga
    updateSelectedFilesDisplay(); // Perbarui tampilan
    console.log("Semua pilihan file dibersihkan.");
}

async function analyzeMultipleFiles() {
    // Gunakan accumulatedFiles, bukan multiFileInput.files
    const filesToAnalyze = accumulatedFiles;

    if (!filesToAnalyze || filesToAnalyze.length === 0 || analyzeMultiFileButton.disabled) {
        if (!analyzeMultiFileButton.disabled) appendMessage("Bot", "Tidak ada file dalam daftar untuk dianalisis.", "bot error");
        return;
    }

    appendMessage("Anda", `Menganalisis ${filesToAnalyze.length} file dari daftar...`, "user");
    appendMessage("Bot", "Mengunggah & menganalisis file...", "bot", true);
    setLoading(true); // Ini akan menonaktifkan tombol dan input

    try {
        const formData = new FormData();
        // Ambil file dari array penyimpanan kita
        for (let i = 0; i < filesToAnalyze.length; i++) {
            formData.append('multiFiles', filesToAnalyze[i], filesToAnalyze[i].name);
        }

        const response = await fetch("/api/analyze/multifile", { method: "POST", body: formData });
        removeLoadingMessage();
        if (!response.ok) throw await createErrorFromResponse(response, "Gagal analisis file");

        const data = await response.json();
        appendMessage("Bot", `${data.message || `Hasil analisis ${filesToAnalyze.length} file`}:\n${data.analysis}`, "bot");

        // ** Penting: Kosongkan daftar setelah berhasil **
        clearSelectedFiles(); // Reset setelah sukses

    } catch (error) {
        removeLoadingMessage();
        console.error("Analyze multiple files error:", error);
        appendMessage("Bot", `Kesalahan analisis file: ${error.message || 'Gagal menghubungi server'}`, "bot error");
        // Pertimbangkan apakah akan mengosongkan daftar jika gagal? Tergantung UX yang diinginkan.
        // Mungkin biarkan saja agar pengguna bisa mencoba lagi tanpa memilih ulang.
        // Jika ingin dikosongkan juga saat gagal: clearSelectedFiles();
    } finally {
        // Hanya perlu re-enable tombol/input, tidak perlu reset input value di sini
        // karena sudah di-handle oleh handleFileSelection dan clearSelectedFiles
        setLoading(false);
         // Pastikan state tombol analisis sesuai setelah proses selesai
         analyzeMultiFileButton.disabled = accumulatedFiles.length === 0;
    }
}


// *** AKHIR FUNGSI BARU ***


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
    multiFileInput.disabled = isLoading;
    analyzeMultiFileButton.disabled = isLoading || accumulatedFiles.length === 0; // Disable jika loading atau tidak ada file
    clearMultiFileButton.disabled = isLoading; // Disable tombol clear saat loading

    const placeholder = isLoading
        ? "Waiting for response..."
        : "Type a message or paste the code... (Shift+Enter for sending message)";
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

// ** BARU: Tambahkan event listener untuk input multi-file **
multiFileInput.addEventListener('change', handleFileSelection);

// Panggil update display saat halaman pertama kali dimuat (untuk set state awal)
document.addEventListener('DOMContentLoaded', () => {
    updateSelectedFilesDisplay();
});

// Auto-resize textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto'; // Reset agar bisa menyusut
    userInput.style.height = (userInput.scrollHeight + 2) + 'px'; // Sesuaikan dengan konten
});


// Auto-scroll saat window resize (jika chatbox di bawah)
window.addEventListener('resize', scrollToBottom);
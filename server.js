const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { rm } = require("fs/promises");
const extract = require("extract-zip"); // Diperlukan jika fitur ZIP dipertahankan
require("dotenv").config();
const session = require('express-session');

// Dynamic import node-fetch
let fetch;
import('node-fetch').then(module => {
    fetch = module.default;
    startServer();
}).catch(err => {
    console.error("FATAL: Gagal mengimpor node-fetch:", err);
    process.exit(1);
});

const app = express();

// --- Konfigurasi Session ---
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32 || SESSION_SECRET === 'GANTI_DENGAN_KUNCI_RAHASIA_SESI_YANG_AMAN_DAN_PANJANG') {
    console.error('KESALAHAN FATAL: SESSION_SECRET tidak diatur, terlalu pendek, atau masih default di file .env. Server tidak dapat dimulai.');
    process.exit(1);
}

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 2, // 2 jam
        sameSite: 'lax'
    }
    // Pertimbangkan store persisten untuk produksi
}));

// --- Middleware Lain ---
// Pastikan origin sesuai dengan frontend Anda (terutama jika port berbeda)
app.use(cors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001', `http://localhost:${process.env.PORT || 3001}`, `http://127.0.0.1:${process.env.PORT || 3001}`], // Izinkan variasi localhost
    credentials: true
}));
app.use(bodyParser.json());

// *** PENAMBAHAN PENTING: Serve file statis ***
const publicDirectoryPath = path.join(__dirname, 'public');
app.use(express.static(publicDirectoryPath));

// --- Konfigurasi Lainnya ---
const GEMINI_API_URL = process.env.GOOGLE_API_URL; // Model yang valid
const API_KEY = process.env.GOOGLE_API_KEY;
const UPLOAD_DIR = "uploads/";
const EXTRACTION_TIMEOUT = 30000;
const API_TIMEOUT = 600000; // 3 menit timeout API
const PORT = process.env.PORT || 3001;
const MAX_HISTORY_LENGTH = 100;
const MAX_FILES_IN_FOLDER = 1000;
const MAX_FILE_SIZE_MB = 100; // Batas ukuran per file dalam folder
const ZIP_MAX_SIZE_MB = 20;

// Ekstensi file yang diizinkan
const allowedExtensions = [".js", ".jsx", ".ts", ".tsx", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".php", ".py", ".java", ".cs", ".go", ".rb", ".swift", ".kt", ".kts", ".c", ".cpp", ".h", ".hpp", ".md", ".txt", ".json", ".xml", ".yaml", ".yml", ".sql", ".env", ".config", ".ini", ".sh", ".bat"];

// Pastikan direktori upload ada
try {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR);
        console.log(`Direktori ${UPLOAD_DIR} dibuat.`);
    }
} catch (error) {
    console.error(`FATAL: Gagal membuat direktori ${UPLOAD_DIR}:`, error);
    process.exit(1);
}

// --- Konfigurasi Multer ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, UPLOAD_DIR); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname || '.tmp'));
    }
});

// Multer untuk ZIP
const uploadZip = multer({
    storage: storage,
    limits: { fileSize: ZIP_MAX_SIZE_MB * 1024 * 1024 }
}).single('file'); // Nama field: 'file'

// Multer untuk Folder
const uploadFolder = multer({
    storage: storage,
    limits: {
        files: MAX_FILES_IN_FOLDER,
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
    }
}).array('folderFiles', MAX_FILES_IN_FOLDER); // Nama field: 'folderFiles'


// --- Fungsi Helper ---

const fetchWithTimeout = (url, options, timeout = API_TIMEOUT) => {
    return new Promise(async (resolve, reject) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            resolve(response);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
               reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
            } else { reject(error); }
        }
    });
};

const readFilesFromDirectory = (dir) => { // Hanya dipakai untuk ZIP sekarang
    let filesContent = "";
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.name.startsWith('.') || ['node_modules', 'vendor', 'build', 'dist', '.git', '.svn'].includes(item.name)) continue;
            if (item.isDirectory()) {
                filesContent += readFilesFromDirectory(fullPath);
            } else if (item.isFile() && allowedExtensions.includes(path.extname(item.name).toLowerCase())) {
                try {
                    const fileData = fs.readFileSync(fullPath, "utf-8");
                    filesContent += `\n\n--- File: ${item.name} ---\n\n${fileData}`;
                } catch (readError) {
                    console.warn(`Gagal membaca file (ZIP): ${fullPath}`, readError);
                    filesContent += `\n\n--- File: ${item.name} (Gagal Dibaca) ---\n\n`;
                }
            }
        }
    } catch (readDirError) {
        console.error(`Gagal membaca direktori (ZIP): ${dir}`, readDirError);
        throw new Error(`Gagal memproses direktori ${dir}: ${readDirError.message}`);
    }
    return filesContent;
};

async function callGeminiAPI(newMessage, history = []) {
    if (!API_KEY) throw new Error("API Key Gemini (GOOGLE_API_KEY) belum diatur.");
    if (!fetch) throw new Error("Modul Fetch belum siap.");

    const contents = history.map(turn => ({
        role: turn.role, parts: [{ text: turn.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: newMessage }] });

    const requestBody = { contents: contents };
    console.log(`[API Call] Mengirim request ke Gemini (${contents.length} turns)...`);
    let response;
    try {
        response = await fetchWithTimeout(`${GEMINI_API_URL}?key=${API_KEY}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        }, API_TIMEOUT);
    } catch (fetchError) { /* ... handle fetch error ... */ throw fetchError; }

    if (!response.ok) { /* ... handle API error response ... */
        let errorBodyText = await response.text(); let errorDetail = errorBodyText;
        try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error?.message || JSON.stringify(errorJson); } catch (e) { /*ignore*/ }
        console.error(`[API Call] Error: Status ${response.status}, Detail: ${errorDetail}`);
        throw new Error(`Gemini API Error ${response.status}: ${errorDetail}`);
    }

    const data = await response.json();
    console.log("[API Call] Respon diterima.");
    const geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (geminiText === undefined || geminiText === null) { /* ... handle no text response ... */
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
            console.warn(`[API Call] Finish reason: ${finishReason}`);
            let reasonMsg = `Maaf, proses AI dihentikan: ${finishReason}.`;
            if (finishReason === 'MAX_TOKENS') reasonMsg += ` Batas token terlampaui.`;
            else if (finishReason === 'SAFETY') reasonMsg += ` Konten diblokir karena kebijakan keamanan.`;
            return reasonMsg;
        } else {
            console.warn("[API Call] Respons tidak valid:", JSON.stringify(data));
            return "Maaf, format balasan AI tidak dikenali.";
        }
    }
    return geminiText;
}

function manageHistory(session, userContent, modelContent) {
    if (!session.history) { session.history = []; }
    if (userContent) { session.history.push({ role: 'user', content: userContent }); }
    if (modelContent) { session.history.push({ role: 'model', content: modelContent }); }
    if (session.history.length > MAX_HISTORY_LENGTH) {
        const itemsToRemove = session.history.length - MAX_HISTORY_LENGTH;
        session.history = session.history.slice(itemsToRemove);
        console.log(`[Session ${session.id}] History dipotong (${itemsToRemove} item). Panjang: ${session.history.length}`);
    }
}

async function cleanupFiles(filePaths, sessionId) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return;
    console.log(`[Session ${sessionId}] Memulai cleanup untuk ${filePaths.length} file...`);
    let successCount = 0;
    let failCount = 0;
    for (const filePath of filePaths) {
        if (filePath && fs.existsSync(filePath)) {
            try {
                await fs.promises.unlink(filePath);
                successCount++;
            } catch (unlinkErr) {
                failCount++;
                console.error(`[Session ${sessionId}] Gagal menghapus file ${filePath}:`, unlinkErr);
            }
        }
    }
    console.log(`[Session ${sessionId}] Cleanup selesai. Dihapus: ${successCount}, Gagal: ${failCount}.`);
}

async function cleanupFolder(folderPath, sessionId) {
     if (!folderPath) return;
     console.log(`[Session ${sessionId}] Memulai cleanup untuk folder ${folderPath}...`);
     if (fs.existsSync(folderPath)) {
        try {
            await rm(folderPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
            console.log(`[Session ${sessionId}] Folder ${folderPath} berhasil dihapus.`);
        } catch (rmError) {
             console.error(`[Session ${sessionId}] Gagal menghapus folder ${folderPath}:`, rmError);
        }
     } else {
         console.log(`[Session ${sessionId}] Folder ${folderPath} tidak ditemukan untuk dihapus.`);
     }
}

// --- Endpoints ---

app.get("/", (req, res) => {
    console.log(`[Session ${req.session.id}] Mengakses halaman utama.`);
    res.sendFile(path.join(__dirname, 'public', "index.html"), (err) => { // Pastikan path ke index.html benar
        if (err) { console.error("Error kirim index.html:", err); if (!res.headersSent) res.status(500).send("Error.");}
    });
});

app.post("/chat", async (req, res) => {
    const userMessage = req.body.message; const sessionId = req.session.id;
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === "") {
        return res.status(400).json({ error: "Pesan kosong." });
    }
    console.log(`[Session ${sessionId}] Chat: "${userMessage.substring(0, 50)}..."`);
    const currentHistory = req.session.history || [];
    try {
        const botReply = await callGeminiAPI(userMessage, currentHistory);
        manageHistory(req.session, userMessage, botReply);
        res.json({ reply: botReply });
    } catch (error) {
        console.error(`[Session ${sessionId}] Error /chat:`, error);
        res.status(500).json({ error: error.message || "Gagal proses chat." });
    }
});

// Endpoint upload ZIP (jika masih diperlukan)
app.post("/upload", (req, res, next) => {
    uploadZip(req, res, function (err) { // Handle multer errors for ZIP
        if (err instanceof multer.MulterError) {
            console.error(`[Session ${req.session.id}] Multer error ZIP:`, err);
            return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `File ZIP terlalu besar (maks: ${ZIP_MAX_SIZE_MB}MB)` : "Error unggah ZIP." });
        } else if (err) {
            console.error(`[Session ${req.session.id}] Error unggah ZIP:`, err);
            return res.status(500).json({ error: "Error unggah ZIP." });
        }
        next();
    });
}, async (req, res) => {
    const sessionId = req.session.id;
    if (!req.file) { return res.status(400).json({ error: "Tidak ada file ZIP." }); }
    if (path.extname(req.file.originalname).toLowerCase() !== '.zip') {
        await cleanupFiles([req.file.path], sessionId); // Hapus file salah tipe
        return res.status(400).json({ error: "Hanya file .zip." });
    }

    console.log(`[Session ${sessionId}] ZIP diterima:`, req.file.originalname);
    const zipPath = req.file.path;
    const extractDirName = `extracted-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const extractPath = path.join(__dirname, UPLOAD_DIR, extractDirName); // Path absolut
    let codeContent = "";

    try {
        await fs.promises.mkdir(extractPath, { recursive: true });
        console.log(`[Session ${sessionId}] Mengekstrak ${zipPath} ke ${extractPath}`);
        await new Promise((resolve, reject) => {
           const timer = setTimeout(() => reject(new Error(`Ekstraksi ZIP timeout`)), EXTRACTION_TIMEOUT);
           extract(zipPath, { dir: extractPath })
             .then(() => { clearTimeout(timer); resolve(); console.log(`[Session ${sessionId}] Ekstraksi ZIP selesai.`); })
             .catch(err => { clearTimeout(timer); reject(new Error(`Gagal ekstrak ZIP: ${err.message}`)); });
        });

        console.log(`[Session ${sessionId}] Membaca kode dari ZIP...`);
        codeContent = readFilesFromDirectory(extractPath); // Pakai helper ZIP

        if (!codeContent || codeContent.trim() === "") {
            return res.json({ message: "Analisis Selesai", analysis: "Tidak ada file kode relevan di ZIP." });
        }
        console.log(`[Session ${sessionId}] Kode ZIP dibaca (${codeContent.length} char).`);

        const prompt = `Analisis kode sumber dari file ZIP (${req.file.originalname}):\n${codeContent}`;
        console.log(`[Session ${sessionId}] Meminta analisis ZIP ke Gemini...`);
        const analysisResult = await callGeminiAPI(prompt);

        manageHistory(req.session, `(User unggah ZIP ${req.file.originalname})`, analysisResult);
        res.json({ message: `Analisis ZIP ${req.file.originalname} berhasil`, analysis: analysisResult });

    } catch (error) {
        console.error(`[Session ${sessionId}] Error proses ZIP:`, error);
        let statusCode = 500; let errorMessage = "Gagal analisis ZIP.";
        if (error.message.toLowerCase().includes('timeout')) { statusCode = 504; errorMessage = error.message; }
        else if (error.message.includes('Gagal ekstrak ZIP')) { statusCode = 400; errorMessage = error.message; }
        else if (error.message.includes('Gagal memproses direktori')) { statusCode = 500; errorMessage = error.message; }
        else if (error.message.includes('Gemini API Error')) { /* ... set status/message ... */ }
        else { errorMessage = `Kesalahan internal: ${error.message}`; }
        res.status(statusCode).json({ error: errorMessage });
    } finally {
        await cleanupFiles([zipPath], sessionId); // Hapus ZIP
        await cleanupFolder(extractPath, sessionId); // Hapus folder ekstraksi
    }
});

// Endpoint Analisis Folder
app.post("/analyze-folder", (req, res, next) => {
    uploadFolder(req, res, function (err) { // Handle multer errors for Folder
        if (err instanceof multer.MulterError) {
            console.error(`[Session ${req.session.id}] Multer error folder:`, err);
            let message = "Gagal unggah folder.";
            if (err.code === 'LIMIT_FILE_COUNT') message = `Terlalu banyak file (maks: ${MAX_FILES_IN_FOLDER}).`;
            else if (err.code === 'LIMIT_FILE_SIZE') message = `File terlalu besar (maks per file: ${MAX_FILE_SIZE_MB}MB).`;
            return res.status(400).json({ error: message });
        } else if (err) {
            console.error(`[Session ${req.session.id}] Error unggah folder:`, err);
            return res.status(500).json({ error: "Error unggah folder." });
        }
        next();
    });
}, async (req, res) => {
    const sessionId = req.session.id;
    const files = req.files;
    const uploadedFilePaths = files ? files.map(f => f.path) : []; // Kumpulkan path untuk cleanup

    if (!files || files.length === 0) {
        return res.status(400).json({ error: "Tidak ada file dari folder." });
    }

    let representativeFolderName = "folder";
    if (files[0].originalname) {
        const pathParts = files[0].originalname.split(/[\\/]/);
        if (pathParts.length > 1) representativeFolderName = pathParts[0];
    }
    console.log(`[Session ${sessionId}] Menganalisis ${files.length} file dari '${representativeFolderName}'...`);

    let allCodeContent = ""; let relevantFileCount = 0;

    try {
        for (const file of files) {
            const fileExt = path.extname(file.originalname || '').toLowerCase();
            if (allowedExtensions.includes(fileExt)) {
                try {
                    const fileData = await fs.promises.readFile(file.path, "utf-8");
                    // Gunakan originalname untuk path relatif dalam prompt
                    allCodeContent += `\n\n--- File: ${file.originalname} ---\n\n${fileData}`;
                    relevantFileCount++;
                } catch (readError) {
                    console.warn(`[Session ${sessionId}] Gagal baca file folder: ${file.originalname}`, readError);
                    allCodeContent += `\n\n--- File: ${file.originalname} (Gagal Dibaca) ---\n\n`;
                }
            }
        }

        if (relevantFileCount === 0) {
             return res.json({ message: "Analisis Selesai", analysis: "Tidak ada file kode relevan di folder." });
        }
        console.log(`[Session ${sessionId}] Kode folder dibaca (${relevantFileCount} file, ${allCodeContent.length} char).`);

        const prompt = `Analisis kode sumber dari folder '${representativeFolderName}':\n${allCodeContent}`;
        console.log(`[Session ${sessionId}] Meminta analisis folder ke Gemini...`);
        const analysisResult = await callGeminiAPI(prompt);

        manageHistory(req.session, `(User pilih folder '${representativeFolderName}' untuk dianalisis)`, analysisResult);
        res.json({ message: `Analisis folder '${representativeFolderName}' berhasil`, analysis: analysisResult });

    } catch (error) {
        console.error(`[Session ${sessionId}] Error proses folder:`, error);
        let statusCode = 500; let errorMessage = "Gagal analisis folder.";
         if (error.message.toLowerCase().includes('timeout')) { statusCode = 504; errorMessage = error.message; }
         else if (error.message.includes('Gemini API Error')) { /* ... set status/message ... */ }
         else { errorMessage = `Kesalahan internal: ${error.message}`; }
        res.status(statusCode).json({ error: errorMessage });
    } finally {
        await cleanupFiles(uploadedFilePaths, sessionId); // Hapus semua file yang diupload untuk request ini
    }
});

// --- Jalankan Server ---
function startServer() {
    if (!fetch) { console.error("FATAL: node-fetch gagal load."); process.exit(1); }
    if (!API_KEY) { console.warn("PERINGATAN: GOOGLE_API_KEY tidak ada."); }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) { console.error("FATAL: SESSION_SECRET tidak aman."); process.exit(1); }

    // **PENAMBAHAN: Pastikan rute catch-all setelah express.static**
    app.get('*', (req, res) => {
        res.sendFile(path.join(publicDirectoryPath, 'index.html'));
    });

    app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}
process.on('unhandledRejection', (reason) => { console.error('!!! Unhandled Rejection:', reason); });
process.on('uncaughtException', (error) => { console.error('!!! Uncaught Exception:', error); process.exit(1); });

// routes/analysis.js
const express = require('express');
const path = require('path');
const extract = require('extract-zip');
const { uploadZip, uploadFolder, uploadMultiFile } = require('../config/multer');
const { callGeminiAPI } = require('../services/gemini');
const { manageHistory } = require('../utils/helpers');
const { readFilesFromDirectory, cleanupFiles, cleanupFolder } = require('../utils/fileHandler');
const { UPLOAD_DIR, EXTRACTION_TIMEOUT, ALLOWED_EXTENSIONS, ZIP_MAX_SIZE_MB, MAX_FILES_IN_FOLDER, MAX_FILE_SIZE_MB, MAX_FILE_CONTENT_LENGTH, MAX_HISTORY_ENTRY_LENGTH } = require('../config/constants');
const fs = require('fs');

const router = express.Router();

// Gunakan database dari app scope (sudah diinisialisasi di server.js)
let db;
router.use((req, res, next) => {
    db = req.app.get('db');
    if (!db) {
        console.error("Database tidak tersedia di rute /analysis.");
        return res.status(500).json({ error: "Database tidak terkonfigurasi." });
    }
    next();
});

// --- Helper Middleware untuk Error Multer ---
function handleMulterError(err, req, res, next, uploadType) {
    const sessionId = req.session?.id || 'unknown';
    if (err) {
        console.error(`[Session ${sessionId}] Error Multer (${uploadType}):`, err.message || err.code);
        if (err instanceof require('multer').MulterError) {
            let message = `Gagal mengunggah file (${uploadType}).`;
            const limits = {
                'ZIP': `(maks: ${ZIP_MAX_SIZE_MB}MB)`,
                'Folder': `(maks file: ${MAX_FILES_IN_FOLDER}, maks per file: ${MAX_FILE_SIZE_MB}MB)`,
                'Multi-File': `(maks file: ${MAX_FILES_IN_FOLDER}, maks per file: ${MAX_FILE_SIZE_MB}MB)`
            };
            const limitMsg = limits[uploadType] || '';

            if (err.code === 'LIMIT_FILE_SIZE') message = `File terlalu besar ${limitMsg}.`;
            else if (err.code === 'LIMIT_FILE_COUNT') message = `Terlalu banyak file ${limitMsg}.`;
            else if (err.code === 'LIMIT_UNEXPECTED_FILE' && uploadType === 'ZIP') message = 'Hanya satu file ZIP yang diizinkan.';
            // Tambahkan kode error multer lain jika perlu
            return res.status(400).json({ error: message });
        } else if (err.message === 'Hanya file .zip yang diizinkan!') {
            // Error custom dari fileFilter ZIP
            return res.status(400).json({ error: err.message });
        } else {
            // Error lain saat upload
            return res.status(500).json({ error: `Terjadi kesalahan saat mengunggah (${uploadType}).` });
        }
    }
    // Jika tidak ada error, lanjut
    next();
}

// --- Helper Function untuk Membuat Prompt dengan Konten File ---
function createPromptWithFileContent(fileDescription, codeContent) {
    const truncatedCode = codeContent.length > MAX_FILE_CONTENT_LENGTH
        ? codeContent.substring(0, MAX_FILE_CONTENT_LENGTH) + "\n\n... (konten terpotong karena terlalu panjang) ..."
        : codeContent;
    return `Sebagai AI Assistant, Anda memiliki akses ke konten kode berikut dari: ${fileDescription}.\n\n${truncatedCode}\n\nMohon berikan jawaban berdasarkan konteks kode ini. Jika pertanyaan di luar konteks kode, mohon beritahu pengguna.\n\nApa yang bisa Anda bantu terkait kode ini?`;
}

// Fungsi untuk menyimpan file ke database
async function saveFileToDatabase(db, sessionId, fileName, fileContent) {
    console.log(`Menyimpan file ke database: sessionId=${sessionId}, fileName=${fileName.substring(0, 50)}, contentLength=${fileContent.length}`);
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO files (session_id, file_name, file_content) VALUES (?, ?, ?)`, [sessionId, fileName, fileContent], (err) => {
            if (err) {
                console.error("Gagal menyimpan file:", err);
                reject(err);
                return;
            }
            resolve();
        });
    });
}

// --- Endpoint ZIP ---
// POST /analyze/zip
router.post('/zip', (req, res, next) => {
    uploadZip(req, res, (err) => handleMulterError(err, req, res, next, 'ZIP'));
}, async (req, res) => {
    const sessionId = req.session.id;
    if (!req.file) {
        return res.status(400).json({ error: "Tidak ada file ZIP yang diunggah." });
    }
    const zipFile = req.file;
    console.log(`[Session ${sessionId}] Route /analyze/zip: ${zipFile.originalname}`);
    const zipPath = zipFile.path;
    const extractDirName = `extracted-${sessionId}-${Date.now()}`;
    const extractPath = path.join(UPLOAD_DIR, extractDirName);
    let codeContent = "";

    try {
        await fs.promises.mkdir(extractPath, { recursive: true });
        console.log(`[Session ${sessionId}] Mengekstrak ${path.basename(zipPath)}...`);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Ekstraksi ZIP timeout (${EXTRACTION_TIMEOUT / 1000}s)`)), EXTRACTION_TIMEOUT);
            extract(zipPath, { dir: extractPath })
                .then(() => { clearTimeout(timer); resolve(); })
                .catch(err => { clearTimeout(timer); reject(new Error(`Gagal ekstrak ZIP: ${err.message}`)); });
        });

        console.log(`[Session ${sessionId}] Membaca kode dari ZIP...`);
        codeContent = await readFilesFromDirectory(extractPath);

        if (!codeContent || codeContent.trim() === "") {
            return res.json({ message: `Analisis Selesai`, analysis: "Tidak ada file kode relevan di ZIP." });
        }

        // Simpan konten file ke database
        await saveFileToDatabase(db, req.session.id, zipFile.originalname, codeContent);

        const prompt = createPromptWithFileContent(`file ZIP "${zipFile.originalname}"`, codeContent);
        console.log(`[Session ${sessionId}] Meminta analisis ZIP ke Gemini...`);
        const analysisResult = await callGeminiAPI(prompt, req.session.history || []);

        // Simpan deskripsi file dan indikasi bahwa kode disertakan ke history
        const historyEntry = `(User unggah ZIP: ${zipFile.originalname}, Konteks: Kode)`;
        const truncatedHistoryEntry = historyEntry.length > MAX_HISTORY_ENTRY_LENGTH
            ? historyEntry.substring(0, MAX_HISTORY_ENTRY_LENGTH) + '...(history entry terpotong)'
            : historyEntry;
            await manageHistory(req.session, truncatedHistoryEntry, analysisResult, db);
        res.json({ message: `Analisis ZIP "${zipFile.originalname}" berhasil`, analysis: analysisResult });

    } catch (error) {
        console.error(`[Session ${sessionId}] Error proses ZIP ${zipFile.originalname}:`, error);
        let statusCode = 500;
        let errorMessage = "Gagal analisis ZIP.";
        // ... (logika penentuan status code dan message) ...
        if (error.message.toLowerCase().includes('timeout')) { statusCode = 504; }
        else if (error.message.includes('Gagal ekstrak') || error.message.includes('Gagal memproses direktori')) { statusCode = 400; }
        else if (error.message.includes('Gemini API Error')) { statusCode = 502; } // Atau ambil dari error message
        errorMessage = error.message; // Kirim pesan error asli (bisa disesuaikan untuk prod)

        res.status(statusCode).json({ error: errorMessage });
    } finally {
        await cleanupFiles([zipPath], sessionId);
        await cleanupFolder(extractPath, sessionId);
    }
});

// --- Endpoint Folder ---
// POST /analyze/folder
router.post('/folder', (req, res, next) => {
    uploadFolder(req, res, (err) => handleMulterError(err, req, res, next, 'Folder'));
}, async (req, res) => {
    const sessionId = req.session.id;
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "Tidak ada file folder yang diunggah." });
    }
    const files = req.files;
    const uploadedFilePaths = files.map(f => f.path);
    let representativeFolderName = "folder";
    if (files[0]?.originalname) {
        const pathParts = files[0].originalname.split(/[\\/]/);
        if (pathParts.length > 1) representativeFolderName = pathParts[0];
    }
    console.log(`[Session ${sessionId}] Route /analyze/folder: ${files.length} file dari '${representativeFolderName}'`);

    let allCodeContent = "";
    let relevantFileCount = 0;
    const analyzedFileNames = [];

    try {
        for (const file of files) {
            const fileExt = path.extname(file.originalname || '').toLowerCase();
            if (['node_modules', 'vendor', 'build', 'dist', '.git', '.svn'].some(skipDir => (file.originalname || '').toLowerCase().startsWith(skipDir + path.sep)) || !fileExt) {
                continue; // Skip folder/file tidak relevan
            }

            if (ALLOWED_EXTENSIONS.includes(fileExt)) {
                try {
                    const fileData = await fs.promises.readFile(file.path, "utf-8");
                    const relativePath = file.originalname.replace(/\\/g, '/');
                    allCodeContent += `\n\n--- File: ${relativePath} ---\n\n${fileData}`;
                    analyzedFileNames.push(relativePath);
                    relevantFileCount++;

                    // Simpan konten file ke database
                    await saveFileToDatabase(db, req.session.id, file.originalname, fileData);

                } catch (readError) {
                    console.warn(`[Session ${sessionId}] Gagal baca file folder: ${file.originalname}`, readError.code);
                    allCodeContent += `\n\n--- File: ${file.originalname.replace(/\\/g, '/')} (Gagal Dibaca) ---\n\n`;
                }
            }
        }

        if (relevantFileCount === 0) {
            return res.json({ message: "Analisis Selesai", analysis: "Tidak ada file kode relevan di folder." });
        }

        const prompt = createPromptWithFileContent(`folder '${representativeFolderName}' (${relevantFileCount} file)`, allCodeContent);
        console.log(`[Session ${sessionId}] Meminta analisis folder ke Gemini...`);
        const analysisResult = await callGeminiAPI(prompt, req.session.history || []);

        // Simpan deskripsi file dan indikasi bahwa kode disertakan ke history
        const historyEntry = `(User pilih folder '${representativeFolderName}' (${relevantFileCount} file), Konteks: Kode)`;
        const truncatedHistoryEntry = historyEntry.length > MAX_HISTORY_ENTRY_LENGTH
            ? historyEntry.substring(0, MAX_HISTORY_ENTRY_LENGTH) + '...(history entry terpotong)'
            : historyEntry;
            await manageHistory(req.session, truncatedHistoryEntry, analysisResult, db);
        res.json({ message: `Analisis folder "${representativeFolderName}" berhasil`, analysis: analysisResult });

    } catch (error) {
        console.error(`[Session ${sessionId}] Error proses folder '${representativeFolderName}':`, error);
        let statusCode = 500;
        let errorMessage = "Gagal analisis folder.";
        // ... (logika penentuan status code dan message) ...
        if (error.message.toLowerCase().includes('timeout')) { statusCode = 504; }
        else if (error.message.includes('Gemini API Error')) { statusCode = 502; }
        errorMessage = error.message;

        res.status(statusCode).json({ error: errorMessage });
    } finally {
        await cleanupFiles(uploadedFilePaths, sessionId);
    }
});

// --- Endpoint Multi-File ---
// POST /analyze/multifile
router.post('/multifile', (req, res, next) => {
    uploadMultiFile(req, res, (err) => handleMulterError(err, req, res, next, 'Multi-File'));
}, async (req, res) => {
    const sessionId = req.session.id;
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "Tidak ada file yang diunggah." });
    }
    const files = req.files;
    const uploadedFilePaths = files.map(f => f.path);
    console.log(`[Session ${sessionId}] Route /analyze/multifile: ${files.length} file`);

    let allCodeContent = "";
    let relevantFileCount = 0;
    const analyzedFileNames = [];

    try {
        for (const file of files) {
            const fileExt = path.extname(file.originalname || '').toLowerCase();
            const fileName = file.originalname || 'unknown_file';
            if (ALLOWED_EXTENSIONS.includes(fileExt)) {
                try {
                    const fileData = await fs.promises.readFile(file.path, "utf-8");
                    const relativePath = file.originalname.replace(/\\/g, '/');
                    allCodeContent += `\n\n--- File: ${relativePath} ---\n\n${fileData}`;
                    analyzedFileNames.push(relativePath);
                    relevantFileCount++;

                    // Simpan konten file ke database
                    await saveFileToDatabase(db, req.session.id, file.originalname, fileData);

                } catch (readError) {
                    console.warn(`[Session ${sessionId}] Gagal baca file: ${file.originalname}`, readError.code);
                    allCodeContent += `\n\n--- File: ${file.originalname.replace(/\\/g, '/')} (Gagal Dibaca) ---\n\n`;
                }
            }
        }

        if (relevantFileCount === 0) {
            return res.json({ message: "Analisis Selesai", analysis: "Tidak ada file kode relevan yang dipilih." });
        }

        const prompt = createPromptWithFileContent(`${relevantFileCount} file: ${analyzedFileNames.join(', ')}`, allCodeContent);
        console.log(`[Session ${sessionId}] Meminta analisis ${relevantFileCount} file ke Gemini...`);
        const analysisResult = await callGeminiAPI(prompt, req.session.history || []);

        const fileListSummary = analyzedFileNames.length > 3 ? `${analyzedFileNames.slice(0, 3).join(', ')}, ...` : analyzedFileNames.join(', ');
        // Simpan deskripsi file dan indikasi bahwa kode disertakan ke history
        const historyEntry = `(User unggah ${relevantFileCount} file: ${fileListSummary}, Konteks: Kode)`;
        const truncatedHistoryEntry = historyEntry.length > MAX_HISTORY_ENTRY_LENGTH
            ? historyEntry.substring(0, MAX_HISTORY_ENTRY_LENGTH) + '...(history entry terpotong)'
            : historyEntry;
            await manageHistory(req.session, truncatedHistoryEntry, analysisResult, db);
        res.json({ message: `Analisis ${relevantFileCount} file berhasil`, analysis: analysisResult });

    } catch (error) {
        console.error(`[Session ${sessionId}] Error proses multi-file:`, error);
        let statusCode = 500;
        let errorMessage = "Gagal analisis file.";
        // ... (logika penentuan status code dan message) ...
        if (error.message.toLowerCase().includes('timeout')) { statusCode = 504; }
        else if (error.message.includes('Gemini API Error')) { statusCode = 502; }
        errorMessage = error.message;

        res.status(statusCode).json({ error: errorMessage });
    } finally {
        await cleanupFiles(uploadedFilePaths, sessionId);
    }
});

module.exports = router;
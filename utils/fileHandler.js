// utils/fileHandler.js
const fs = require('fs');
const { rm } = require('fs/promises'); // fs.promises.rm untuk penghapusan rekursif
const path = require('path');
const { ALLOWED_EXTENSIONS } = require('../config/constants');

// Membaca file dari direktori secara rekursif (untuk ZIP)
function readFilesFromDirectory(dir, basePath = dir) {
    let filesContent = "";
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            const relativePath = path.relative(basePath, fullPath);

            if (item.name.startsWith('.') || ['node_modules', 'vendor', 'build', 'dist', '.git', '.svn', 'target', 'out', '__pycache__'].includes(item.name.toLowerCase())) {
                // console.log(`[readFiles] Skipping: ${relativePath}`);
                continue;
            }

            if (item.isDirectory()) {
                filesContent += readFilesFromDirectory(fullPath, basePath);
            } else if (item.isFile()) {
                const fileExt = path.extname(item.name).toLowerCase();
                if (ALLOWED_EXTENSIONS.includes(fileExt)) {
                    try {
                        const fileData = fs.readFileSync(fullPath, "utf-8");
                        filesContent += `\n\n--- File: ${relativePath.replace(/\\/g, '/')} ---\n\n${fileData}`;
                    } catch (readError) {
                        console.warn(`[readFiles] Gagal membaca file: ${fullPath}`, readError.code || readError.message);
                        filesContent += `\n\n--- File: ${relativePath.replace(/\\/g, '/')} (Gagal Dibaca: ${readError.code || readError.message}) ---\n\n`;
                    }
                } else {
                    // console.log(`[readFiles] Skipping (ekstensi): ${relativePath}`);
                }
            }
        }
    } catch (readDirError) {
        console.error(`[readFiles] Gagal membaca direktori: ${dir}`, readDirError);
        throw new Error(`Gagal memproses direktori ${path.relative(basePath, dir) || '.'}: ${readDirError.message}`);
    }
    return filesContent;
}

// Menghapus file-file temporer
async function cleanupFiles(filePaths, sessionId = 'unknown') {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return;
    console.log(`[Session ${sessionId}] Memulai cleanup untuk ${filePaths.length} file...`);
    let successCount = 0;
    let failCount = 0;
    for (const filePath of filePaths) {
        if (filePath && typeof filePath === 'string') {
            try {
                if (fs.existsSync(filePath)) { // Cek dulu sebelum hapus
                    await fs.promises.unlink(filePath);
                    successCount++;
                }
            } catch (unlinkErr) {
                failCount++;
                console.error(`[Session ${sessionId}] Gagal menghapus file ${path.basename(filePath)}:`, unlinkErr.code || unlinkErr.message);
            }
        }
    }
    console.log(`[Session ${sessionId}] Cleanup file selesai. Berhasil: ${successCount}, Gagal: ${failCount}.`);
}

// Menghapus folder temporer
async function cleanupFolder(folderPath, sessionId = 'unknown') {
     if (!folderPath || typeof folderPath !== 'string') return;
     const folderName = path.basename(folderPath);
     console.log(`[Session ${sessionId}] Memulai cleanup untuk folder ${folderName}...`);
     try {
         if (fs.existsSync(folderPath)) { // Cek dulu
            await rm(folderPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
            console.log(`[Session ${sessionId}] Folder ${folderName} berhasil dihapus.`);
         } else {
             console.log(`[Session ${sessionId}] Folder ${folderName} tidak ditemukan untuk dihapus.`);
         }
     } catch (rmError) {
         console.error(`[Session ${sessionId}] Gagal menghapus folder ${folderName}:`, rmError.code || rmError.message);
     }
}

module.exports = {
    readFilesFromDirectory,
    cleanupFiles,
    cleanupFolder
};
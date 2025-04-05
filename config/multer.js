// config/multer.js
const multer = require('multer');
const path = require('path');
const { UPLOAD_DIR, MAX_FILES_IN_FOLDER, MAX_FILE_SIZE_MB, ZIP_MAX_SIZE_MB } = require('./constants');

// Konfigurasi storage engine untuk Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR); // Direktori upload dari constants
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname || '').toLowerCase() || '.tmp';
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// Middleware Multer untuk unggah file ZIP tunggal
const uploadZip = multer({
    storage: storage,
    limits: { fileSize: ZIP_MAX_SIZE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.zip') {
            // Tolak file jika bukan .zip
            return cb(new Error('Hanya file .zip yang diizinkan!'), false);
        }
        cb(null, true); // Terima file
    }
}).single('file'); // Nama field form-data: 'file'

// Middleware Multer untuk unggah banyak file dari folder (webkitdirectory)
const uploadFolder = multer({
    storage: storage,
    limits: {
        files: MAX_FILES_IN_FOLDER,
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
    }
}).array('folderFiles', MAX_FILES_IN_FOLDER); // Nama field form-data: 'folderFiles'

// Middleware Multer untuk unggah banyak file individual
const uploadMultiFile = multer({
    storage: storage,
    limits: {
        files: MAX_FILES_IN_FOLDER,
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
    }
}).array('multiFiles', MAX_FILES_IN_FOLDER); // Nama field form-data: 'multiFiles'

module.exports = {
    uploadZip,
    uploadFolder,
    uploadMultiFile
};
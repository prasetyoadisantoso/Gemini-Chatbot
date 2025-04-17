// config/constants.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Pastikan .env dibaca dari root

const constants = {
    PORT: process.env.PORT || 3001,
    SESSION_SECRET: process.env.SESSION_SECRET,
    GEMINI_API_URL: process.env.GOOGLE_API_URL || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
    API_KEY: process.env.GOOGLE_API_KEY,
    UPLOAD_DIR: path.join(__dirname, '../uploads'), // Path absolut dari root proyek
    PUBLIC_DIR: path.join(__dirname, '../public'),   // Path absolut ke folder public
    EXTRACTION_TIMEOUT: 100000, // ms
    API_TIMEOUT: 180000,      // ms
    MAX_HISTORY_LENGTH: 10000000000,
    MAX_FILES_IN_FOLDER: 10000,
    MAX_FILE_SIZE_MB: 500,
    ZIP_MAX_SIZE_MB: 500,
    ALLOWED_EXTENSIONS: [
        ".js", ".jsx", ".ts", ".tsx", ".html", ".htm", ".css", ".scss",
        ".sass", ".less", ".php", ".py", ".java", ".cs", ".go", ".rb",
        ".swift", ".kt", ".kts", ".c", ".cpp", ".h", ".hpp", ".md",
        ".txt", ".json", ".xml", ".yaml", ".yml", ".sql", ".env",
        ".config", ".ini", ".sh", ".bat", ".dockerfile", ".gitignore",
        ".mod", ".sum", ".gradle", ".properties", ".lock", ".toml", ".tf",
        ".tfvars", ".vue", ".svelte", ".pl", ".pm", ".lua", ".rs", ".dart"
    ],
    ALLOWED_ORIGINS: [
        'http://localhost:3001', // Default dev port
        'http://127.0.0.1:3001',
        // Tambahkan origin production di sini
        // 'https://your-frontend-domain.com'
    ]
};

// Tambahkan origin server itu sendiri ke daftar yang diizinkan
constants.ALLOWED_ORIGINS.push(`http://localhost:${constants.PORT}`);
constants.ALLOWED_ORIGINS.push(`http://127.0.0.1:${constants.PORT}`);


module.exports = constants;
// server.js (Main Application File)
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const constants = require('./config/constants'); // Import constants
const setupSession = require('./config/session'); // Import session setup
const mainRouter = require('./routes'); // Import main router (jika pakai routes/index.js)
// Atau import router individual:
// const chatRouter = require('./routes/chat');
// const analysisRouter = require('./routes/analysis');
const { initializeGeminiService } = require('./services/gemini');

// Dinamis import node-fetch (harus di top-level scope atau async function)
let fetch;
let serverReady = false;

import('node-fetch').then(module => {
    fetch = module.default;
    // Inisialisasi service yang butuh fetch setelah fetch siap
    initializeGeminiService(fetch);
    serverReady = true;
    startServer(); // Coba start server jika belum
}).catch(err => {
    console.error("KESALAHAN FATAL: Gagal mengimpor node-fetch:", err);
    process.exit(1);
});

const app = express();

// --- Middleware Global ---
console.log("Mengkonfigurasi middleware global...");

// 1. CORS
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || constants.ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`Origin ditolak oleh CORS: ${origin}`);
            callback(new Error('Origin tidak diizinkan oleh CORS'));
        }
    },
    credentials: true
};
app.use(cors(corsOptions));
console.log("Middleware CORS dikonfigurasi.");

// 2. Body Parser untuk JSON
app.use(bodyParser.json());
console.log("Middleware BodyParser (JSON) dikonfigurasi.");

// 3. Session Middleware (setelah CORS dan bodyParser)
setupSession(app); // Panggil fungsi setup dari config/session.js

// 4. Static Files (dari folder 'public')
// Harus sebelum router API jika ada kemungkinan konflik path
app.use(express.static(constants.PUBLIC_DIR));
console.log(`Middleware Static Files melayani dari: ${constants.PUBLIC_DIR}`);

// --- Pastikan Direktori Upload Ada ---
try {
    if (!fs.existsSync(constants.UPLOAD_DIR)) {
        fs.mkdirSync(constants.UPLOAD_DIR, { recursive: true });
        console.log(`Direktori upload dibuat: ${constants.UPLOAD_DIR}`);
    } else {
         console.log(`Direktori upload sudah ada: ${constants.UPLOAD_DIR}`);
    }
} catch (error) {
    console.error(`KESALAHAN FATAL: Gagal membuat/mengakses direktori ${constants.UPLOAD_DIR}:`, error);
    process.exit(1);
}

// --- Mounting Routers ---
console.log("Memasang router API...");
app.use('/api', mainRouter); // Gunakan base path /api untuk semua rute (jika pakai routes/index.js)
// Atau pasang router individual:
// app.use('/api/chat', chatRouter);
// app.use('/api/analyze', analysisRouter);
console.log("Router API dipasang di /api.");


// --- Server Start Function ---
function startServer() {
    // Hanya jalankan jika fetch sudah siap dan server belum jalan
    if (!serverReady || app.settings.isListening) {
        if (!serverReady) console.log("Menunggu node-fetch siap...");
        return;
    }

    // Validasi penting lainnya
    if (!constants.API_KEY) {
        console.warn("PERINGATAN: GOOGLE_API_KEY tidak ditemukan. Panggilan API akan gagal.");
    }

    // *** Rute Catch-All untuk SPA (Single Page Application) ***
    // Harus setelah API routes dan static files
    app.get('*', (req, res) => {
        // Kirim index.html untuk semua GET request yang tidak cocok API atau file statis
        res.sendFile(path.join(constants.PUBLIC_DIR, 'index.html'), (err) => {
            if (err) {
                console.error("Error mengirim fallback index.html:", err);
                if (!res.headersSent) {
                    res.status(500).send("Terjadi kesalahan server.");
                }
            }
        });
    });
    console.log("Rute Catch-All (*) dikonfigurasi.");


    // --- Jalankan Server ---
    app.listen(constants.PORT, () => {
        app.settings.isListening = true; // Tandai bahwa server sudah berjalan
        console.log(`\n===============================================`);
        console.log(`  Server Chatbot Gemini Siap!`);
        console.log(`  URL: http://localhost:${constants.PORT}`);
        console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
        console.log(`===============================================\n`);
    }).on('error', (err) => {
         // Tangani error jika port sudah digunakan, dll.
         console.error(`KESALAHAN FATAL saat memulai server di port ${constants.PORT}:`, err.message);
         process.exit(1);
    });
}

// --- Penanganan Error Global ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('!!! UNHANDLED REJECTION !!!');
    console.error('Alasan:', reason);
    // Pertimbangkan logging detail promise jika perlu
});

process.on('uncaughtException', (error) => {
    console.error('!!! UNCAUGHT EXCEPTION !!!');
    console.error('Error:', error);
    console.error("Server akan dimatikan karena uncaught exception.");
    // Coba tutup server dengan baik jika memungkinkan, lalu exit
    // server.close(() => process.exit(1)); // Perlu variabel server global
    process.exit(1); // Paksa keluar jika tidak
});

// Coba start server setelah modul utama dievaluasi
// Jika fetch belum siap, startServer() akan return tanpa melakukan apa-apa
// Callback dari import() akan memanggil startServer() lagi saat fetch siap.
startServer();
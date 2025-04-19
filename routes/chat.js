// routes/chat.js
const express = require('express');
const { callGeminiAPI } = require('../services/gemini');
const { manageHistory } = require('../utils/helpers');
const router = express.Router();

// Gunakan database dari app scope (sudah diinisialisasi di server.js)
let db;
router.use((req, res, next) => {
    db = req.app.get('db');
    if (!db) {
        console.error("Database tidak tersedia di rute /chat.");
        return res.status(500).json({ error: "Database tidak terkonfigurasi." });
    }
    console.log("Database berhasil diakses di rute /chat."); // Tambahkan baris ini untuk debugging
    next();
});

// Fungsi untuk mencari file yang relevan di database (perlu diimplementasikan)
async function searchFiles(db, sessionId, userMessage) {
    return new Promise((resolve, reject) => {
        // Contoh sederhana: cari file yang mengandung kata kunci dari pesan user
        const keywords = userMessage.split(" "); // Tokenisasi sederhana

		console.log(`Pencarian file: SessionId=${sessionId}, keywords=${keywords.join(', ')}`)

        // Gunakan LIKE untuk setiap keyword
        const query = `SELECT file_name, file_content FROM files WHERE session_id = ? AND (`;

        // Buat klausa LIKE untuk setiap keyword
        const likeClauses = keywords.map((keyword, index) => `file_content LIKE ?`);
        const whereClause = likeClauses.join(' OR ');

        // Gabungkan klausa LIKE ke dalam query utama
        const fullQuery = query + whereClause + `)`;

        // Buat array parameter untuk query
        const params = [sessionId, ...keywords.map(keyword => `%${keyword}%`)];

        db.all(fullQuery, params, (err, rows) => {
            if (err) {
                console.error("Gagal mencari file:", err);
                reject(err);
                return;
            }
			console.log(`File ditemukan: ${rows.length}`);
            resolve(rows);
        });
    });
}

// POST /chat/
router.post('/', async (req, res) => {
    const userMessage = req.body.message;
    const sessionId = req.session.id;

    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === "") {
        return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }
    console.log(`[Session ${sessionId}] Route /chat: "${userMessage.substring(0, 80)}..."`);

    const currentHistory = req.session.history || [];

    try {
        // 1. Cari file yang relevan di database
        const relevantFiles = await searchFiles(db, sessionId, userMessage); // Fungsi ini perlu diimplementasikan

        // 2. Buat prompt dengan konten file yang relevan
        let prompt = userMessage;
        if (relevantFiles && relevantFiles.length > 0) {
            const fileContext = relevantFiles.map(file => `File: ${file.file_name}\n${file.file_content}`).join('\n\n');
            prompt = `Berikut adalah kode yang relevan dari file yang telah diunggah:\n\n${fileContext}\n\n${userMessage}`;
        }

        // 3. Panggil Gemini API
        const botReply = await callGeminiAPI(prompt, currentHistory);

        // 4. Update history
        await manageHistory(req.session, userMessage, botReply, db);
        res.json({ reply: botReply });

    } catch (error) {
        console.error(`[Session ${sessionId}] Error di route /chat:`, error);
        res.status(500).json({ error: error.message || "Gagal memproses permintaan chat." });
    }
});

module.exports = router;
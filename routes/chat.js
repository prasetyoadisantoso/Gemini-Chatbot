// routes/chat.js
const express = require('express');
const { callGeminiAPI, initializeGeminiService } = require('../services/gemini');
const { manageHistory } = require('../utils/helpers');
const router = express.Router();

// Middleware khusus untuk rute chat (jika diperlukan di masa depan)
// router.use((req, res, next) => { ... next(); });

// POST /chat/
router.post('/', async (req, res) => {
    const userMessage = req.body.message;
    const sessionId = req.session.id; // Ambil dari session

    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === "") {
        return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }
    console.log(`[Session ${sessionId}] Route /chat: "${userMessage.substring(0, 80)}..."`);

    const currentHistory = req.session.history || [];

    try {
        // Panggil service Gemini
        const botReply = await callGeminiAPI(userMessage, currentHistory);
        // Update history
        manageHistory(req.session, userMessage, botReply);
        // Kirim balasan
        res.json({ reply: botReply });
    } catch (error) {
        console.error(`[Session ${sessionId}] Error di route /chat:`, error);
        // Status 500 atau sesuaikan berdasarkan jenis error dari callGeminiAPI
        const statusCode = error.message?.includes("API Error 4") ? 400 : 500;
        res.status(statusCode).json({ error: error.message || "Gagal memproses permintaan chat." });
    }
});

module.exports = router; // Ekspor router
// services/gemini.js
const { fetchWithTimeout } = require('../utils/helpers');
const { API_KEY, GEMINI_API_URL, API_TIMEOUT, MAX_HISTORY_LENGTH } = require('../config/constants');

// Membutuhkan fungsi fetch yang sudah di-load
let _fetch;
function initializeGeminiService(fetchFunction) {
    if (!fetchFunction) {
        throw new Error("Fetch function must be provided to initialize Gemini Service.");
    }
    _fetch = fetchFunction;
    console.log("Layanan Gemini diinisialisasi dengan fungsi fetch.");
}

// Memanggil Gemini API
async function callGeminiAPI(newMessage, history = []) {
    if (!API_KEY) throw new Error("API Key Gemini (GOOGLE_API_KEY) belum diatur.");
    if (!_fetch) throw new Error("Layanan Gemini belum diinisialisasi dengan fungsi fetch.");

    // Pastikan histori tidak melebihi batas
    const truncatedHistory = history.length > MAX_HISTORY_LENGTH
        ? history.slice(history.length - MAX_HISTORY_LENGTH)
        : history;

    const contents = truncatedHistory.map(turn => ({
        role: turn.role, parts: [{ text: turn.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: newMessage }] });

    const requestBody = { contents: contents };
    console.log(`[API Call] Mengirim request ke Gemini (${contents.length} turns)...`);

    let response;
    try {
        response = await fetchWithTimeout( // Gunakan helper fetchWithTimeout
            _fetch, // Berikan fungsi fetch yang sudah di-load
            `${GEMINI_API_URL}?key=${API_KEY}`,
            {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            },
            API_TIMEOUT
        );
    } catch (fetchError) {
        console.error("[API Call] Error saat fetch:", fetchError);
        throw new Error(`Gagal menghubungi Gemini API: ${fetchError.message}`);
    }

    if (!response.ok) {
        let errorBodyText = await response.text();
        let errorDetail = errorBodyText;
        try {
            const errorJson = JSON.parse(errorBodyText);
            errorDetail = errorJson.error?.message || JSON.stringify(errorJson.error || errorJson);
        } catch (e) { /* ignore */ }
        console.error(`[API Call] Error: Status ${response.status}, Detail: ${errorDetail}`);
        let userMessage = `Gemini API Error ${response.status}.`;
        // ... (pesan error berdasarkan status code)
         if (response.status === 400) userMessage += " Format request mungkin salah atau konten tidak valid.";
         else if (response.status === 429) userMessage += " Batas kuota API terlampaui.";
         else if (response.status === 500) userMessage += " Terjadi error internal di server Gemini.";
         else userMessage += ` Detail: ${errorDetail}`;
        throw new Error(userMessage);
    }

    const data = await response.json();
    console.log("[API Call] Respon diterima.");
    const geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (geminiText === undefined || geminiText === null) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
            console.warn(`[API Call] Proses AI dihentikan. Alasan: ${finishReason}`);
            let reasonMsg = `Maaf, proses AI dihentikan karena: ${finishReason}.`;
            if (finishReason === 'MAX_TOKENS') reasonMsg += ` Respon terlalu panjang dan terpotong.`;
            else if (finishReason === 'SAFETY') reasonMsg += ` Konten diblokir karena kebijakan keamanan.`;
            else if (finishReason === 'RECITATION') reasonMsg += ` Konten diblokir karena sitasi berlebih.`;
            return reasonMsg; // Kembalikan pesan peringatan
        } else {
            console.warn("[API Call] Respons valid tapi tidak mengandung teks:", JSON.stringify(data));
            return "Maaf, terjadi masalah saat memproses balasan AI (respon kosong).";
        }
    }
    return geminiText;
}

module.exports = {
    initializeGeminiService,
    callGeminiAPI
};
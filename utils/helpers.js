// utils/helpers.js
const { MAX_HISTORY_LENGTH } = require('../config/constants');

// Fetch dengan timeout
async function fetchWithTimeout(fetchFn, url, options, timeout) {
    // fetchFn diharapkan adalah fungsi fetch yang sudah diimpor
    if (!fetchFn) {
        return Promise.reject(new Error("Fetch function is not provided."));
    }
    return new Promise(async (resolve, reject) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.warn(`[API Call] Request ke ${url} timeout setelah ${timeout / 1000} detik.`);
        }, timeout);

        try {
            const response = await fetchFn(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            resolve(response);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
            } else {
                reject(error);
            }
        }
    });
}

// Fungsi untuk menyimpan pesan ke database
async function saveChatMessage(db, sessionId, role, content) {
    console.log(`Menyimpan pesan ke chat_history: sessionId=${sessionId}, role=${role}, content=${content.substring(0,50)}...`);
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)`, [sessionId, role, content], (err) => {
            if (err) {
                console.error("Gagal menyimpan pesan:", err);
                reject(err);
                return;
            }
            resolve();
        });
    });
}


// Mengelola histori chat dalam session
async function manageHistory(session, userContent, modelContent, db) {
    if (!session) {
        console.error("Error: Session object is undefined in manageHistory.");
        return; // Hindari error jika session tidak ada
    }
    if (!session.history) {
        session.history = [];
    }

    // Tambahkan giliran user jika ada
    if (userContent) {
        session.history.push({ role: 'user', content: userContent });
    }
    // Tambahkan giliran model (AI) jika ada
    if (modelContent) {
        session.history.push({ role: 'model', content: modelContent });
    }

    // Simpan ke database
    const sessionId = session.id;
    if (userContent) {
        await saveChatMessage(db, sessionId, 'user', userContent);
    }
    if (modelContent) {
        await saveChatMessage(db, sessionId, 'model', modelContent);
    }


    // Potong histori jika terlalu panjang (FIFO)
    // Lakukan pemotongan *sebelum* menambahkan elemen baru jika sudah mencapai batas
    while (session.history.length > MAX_HISTORY_LENGTH) {
        session.history.shift(); // Hapus elemen pertama (paling lama)
    }

     if (session.history.length > MAX_HISTORY_LENGTH) {
       const itemsToRemove = session.history.length - MAX_HISTORY_LENGTH;
       session.history = session.history.slice(itemsToRemove);
       console.log(`[Session ${session.id}] History dipotong (${itemsToRemove} item dihapus). Panjang baru: ${session.history.length}`);
     }

    // Simpan perubahan sesi (mungkin tidak perlu jika saveUninitialized: true, tapi aman untuk dilakukan)
    if (session.save) {
        session.save(err => {
            if (err) {
                console.error(`[Session ${session.id}] Gagal menyimpan sesi:`, err);
            }
        });
    }
}

module.exports = {
    fetchWithTimeout,
    manageHistory
};
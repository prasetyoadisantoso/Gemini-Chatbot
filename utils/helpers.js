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


// Mengelola histori chat dalam session
function manageHistory(session, userContent, modelContent) {
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
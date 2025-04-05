// config/session.js
const session = require('express-session');
const { SESSION_SECRET } = require('./constants');

function setupSession(app) {
    if (!SESSION_SECRET || SESSION_SECRET.length < 32 || SESSION_SECRET === 'GANTI_DENGAN_KUNCI_RAHASIA_SESI_YANG_AMAN_DAN_PANJANG') {
        console.error('KESALAHAN FATAL: SESSION_SECRET tidak diatur, terlalu pendek, atau masih default. Server tidak dapat dimulai.');
        process.exit(1);
    }

    app.use(session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: true, // Penting agar session ID dibuat segera
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 2, // 2 jam
            sameSite: 'lax'
        }
        // Pertimbangkan store persisten (e.g., connect-redis) untuk production
    }));

    console.log("Middleware Session dikonfigurasi.");
}

module.exports = setupSession;
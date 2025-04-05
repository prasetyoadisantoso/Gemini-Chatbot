// routes/index.js
const express = require('express');
const chatRoutes = require('./chat');
const analysisRoutes = require('./analysis');
const router = express.Router();

// Gunakan router yang berbeda untuk path yang berbeda
router.use('/chat', chatRoutes);
router.use('/analyze', analysisRoutes); // Base path untuk semua analisis

module.exports = router;
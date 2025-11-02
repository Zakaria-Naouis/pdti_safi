// routes/export.js
const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/canvas-global', exportController.exportCanvasGlobal);

router.get('/canvas-2026', exportController.exportCanvas2026);

module.exports = router;
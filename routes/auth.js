// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Page de connexion
router.get('/login', authController.getLogin);

// Traitement de la connexion
router.post('/login', authController.postLogin);

// Déconnexion
router.get('/logout', authController.logout);

module.exports = router;
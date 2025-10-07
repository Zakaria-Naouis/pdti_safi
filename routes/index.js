// routes/index.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

// Route d'accueil

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Accueil - PDTI Safi',
    pageTitle: 'Programme de Développement Territorial Intégré',
    app_name: 'PDTI Safi',
    company_name: 'Province de Safi',
    layout: false  // Cette ligne désactive le layout pour cette page uniquement
  });
});

// Route pour le profil utilisateur
router.get('/profile', isAuthenticated, (req, res) => {
  res.render('profile', {
    title: 'Mon Profil - PDTI Safi',
    pageTitle: 'Mon Profil'
  });
});

module.exports = router;
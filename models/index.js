// routes/index.js
const express = require('express');
const router = express.Router();

// Page d'accueil
router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Accueil - PDTI Safi',
    pageTitle: 'Programme de Développement Territorial Intégré',
    app_name: 'PDTI Safi',
    company_name: 'Province de Safi'
  });
});

module.exports = router;
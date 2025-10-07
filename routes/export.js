// routes/export.js
const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const auth = require('../middleware/auth');

// Route pour exporter les projets par axe avec filtre
router.get('/axes/:filter', 
  auth.isAuthenticated,
  auth.setUserInLocals,
  exportController.exportProjectsByAxes
);

// Autres routes d'exportation existantes
router.get('/secteurs', 
  auth.isAuthenticated,
  auth.setUserInLocals,
  exportController.exportProjectsBySectors
);

router.get('/communes', 
  auth.isAuthenticated,
  auth.setUserInLocals,
  exportController.exportProjectsByCommunes
);

module.exports = router;
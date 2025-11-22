// routes/dashboard.js

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticated } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(isAuthenticated);

// IMPORTANT: Placer les routes API AVANT les routes avec paramètres dynamiques
// Route API pour récupérer les projets par axe
router.get('/api/projets-by-axe/:axeId', dashboardController.getProjectsByAxe);

// Routes des tableaux de bord
router.get('/admin', dashboardController.getAdminDashboard);
router.get('/gouverneur', dashboardController.getGouverneurDashboard);
router.get('/coordinateur', dashboardController.getCoordinateurDashboard);
router.get('/chefPole', dashboardController.getChefPoleDashboard);
router.get('/pacha', dashboardController.getPachaDashboard);  // Route Pacha

// Route par défaut qui redirige selon le profil
router.get('/', (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }

  switch (req.user.profile_id) {
    case 1: // Administrateur
      res.redirect('/dashboard/admin');
      break;
    case 2: // Gouverneur
    case 3: // Secrétaire Général
      res.redirect('/dashboard/gouverneur');
      break;
    case 4: // Coordinateur
      res.redirect('/dashboard/coordinateur');
      break;
    case 5: // Chef de pôle
      res.redirect('/dashboard/chefPole');
      break;
    case 7: // Pacha (CORRIGÉ: profile_id 7)
    case 8: // chef Cercle (CORRIGÉ: profile_id 8)   
      res.redirect('/dashboard/pacha');
      break;
    default:
      res.redirect('/dashboard/coordinateur');
  }
});

module.exports = router;
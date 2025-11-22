// routes/export.js
/**
 * Routes d'export Canevas et PDF
 * 
 * Fonctionnalités:
 * - Export Canevas Global (tous les projets)
 * - Export Canvas 2026 (projets avec écheancier 2026)
 * - Export Fiches Projets par Axe en PDF
 * 
 * Contrôle d'accès:
 * - Coordinateur (profile_id = 4): Accès à ses données seulement
 * - Administrateur (profile_id = 1): Accès à toutes les données
 * - Pacha (profile_id = 7): Accès aux projets de son cercle seulement
 */

const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { isAuthenticated } = require('../middleware/auth');

// Middleware d'authentification obligatoire pour tous les exports
router.use(isAuthenticated);

// ============================================================
// ROUTES D'EXPORT EXCEL
// ============================================================

/**
 * GET /export/canvas-global
 * 
 * Export Canevas Global
 * - Coordinateur: Projets de son Axe seulement, triés par Num Projet
 * - Administrateur: Tous les projets, triés par Axe puis Num Projet
 * - Pacha: Projets de son cercle seulement, triés par Axe puis Num Projet
 * 
 * Response: Application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)
 * Filename: Canevas_Global_Axe_X_YYYY-MM-DD.xlsx (Coordinateur)
 *           Canevas_Global_PDTI_Safi_YYYY-MM-DD.xlsx (Administrateur)
 *           Canevas_Global_Pachalik_X_YYYY-MM-DD.xlsx (Pacha)
 */
router.get('/canvas-global', async (req, res, next) => {
  try {
    // Rediriger vers la fonction appropriée selon le profil
    if (req.user.profile_id === 7 || req.user.profile_id === 8) {
      // Pacha
      return await exportController.exportCanvasGlobalPacha(req, res, next);
    } else {
      // Coordinateur ou Administrateur
      return await exportController.exportCanvasGlobal(req, res, next);
    }
  } catch (error) {
    console.error('Erreur route canvas-global:', error);
    next(error);
  }
});

/**
 * GET /export/canvas-2026
 * 
 * Export Canvas 2026
 * - Coordinateur: Projets 2026 de son Axe seulement, triés par Num Projet
 * - Administrateur: Tous les projets 2026, triés par Axe puis Num Projet
 * - Pacha: Projets 2026 de son cercle seulement, triés par Axe puis Num Projet
 * 
 * Response: Application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)
 * Filename: Canvas_2026_Axe_X_YYYY-MM-DD.xlsx (Coordinateur)
 *           Canvas_2026_PDTI_Safi_YYYY-MM-DD.xlsx (Administrateur)
 *           Canvas_2026_Pachalik_X_YYYY-MM-DD.xlsx (Pacha)
 */
router.get('/canvas-2026', async (req, res, next) => {
  try {
    // Rediriger vers la fonction appropriée selon le profil
    if (req.user.profile_id === 7 || req.user.profile_id === 8) {
      // Pacha
      return await exportController.exportCanvas2026Pacha(req, res, next);
    } else {
      // Coordinateur ou Administrateur
      return await exportController.exportCanvas2026(req, res, next);
    }
  } catch (error) {
    console.error('Erreur route canvas-2026:', error);
    next(error);
  }
});

// ============================================================
// ROUTES D'EXPORT PDF
// ============================================================

/**
 * GET /export/fiches-projets/:axeId
 * 
 * Export Fiches Projets par Axe en PDF
 * - Génère un document PDF avec les fiches complètes des projets
 * - Les coordinateurs ne peuvent accéder qu'à leur Axe
 * - Les administrateurs peuvent accéder à tous les Axes
 * - Les pachas peuvent accéder à tous les axes de leur cercle
 * 
 * @param {number} axeId - ID de l'Axe (1-5)
 * 
 * Response: Application/pdf
 * Filename: Fiches_Projets_Axe[ID]_[NomAxe]_YYYY-MM-DD.pdf
 * 
 * Codes d'erreur:
 * - 401: Non authentifié
 * - 403: Coordinateur tentant d'accéder à un autre Axe
 * - 404: Aucun projet trouvé pour cet Axe
 * - 500: Erreur de génération PDF
 */
router.get('/fiches-projets/:axeId', exportController.exportFichesParAxe);

/**
 * GET /export/fiches-projets-2026/:axeId
 * 
 * Export Fiches Projets 2026 par Axe en PDF
 * - Filtre les projets avec date_debut = 2026
 * - Triés par Num Projet
 * - Même fonctionnement que fiches-projets mais avec filtre 2026
 * 
 * @param {number} axeId - ID de l'Axe (1-5)
 * 
 * Response: Application/pdf
 * Filename: Fiches_Projets_2026_Axe[ID]_[NomAxe]_YYYY-MM-DD.pdf
 */
router.get('/fiches-projets-2026/:axeId', exportController.exportFichesParAxe2026);

module.exports = router;
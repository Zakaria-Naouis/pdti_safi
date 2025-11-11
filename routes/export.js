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
 * 
 * Response: Application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)
 * Filename: Canevas_Global_Axe_X_YYYY-MM-DD.xlsx (Coordinateur)
 *           Canevas_Global_PDTI_Safi_YYYY-MM-DD.xlsx (Administrateur)
 */
router.get('/canvas-global', exportController.exportCanvasGlobal);

/**
 * GET /export/canvas-2026
 * 
 * Export Canvas 2026
 * - Coordinateur: Projets 2026 de son Axe seulement, triés par Num Projet
 * - Administrateur: Tous les projets 2026, triés par Axe puis Num Projet
 * 
 * Response: Application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)
 * Filename: Canvas_2026_Axe_X_YYYY-MM-DD.xlsx (Coordinateur)
 *           Canvas_2026_PDTI_Safi_YYYY-MM-DD.xlsx (Administrateur)
 */
router.get('/canvas-2026', exportController.exportCanvas2026);

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

module.exports = router;

// ============================================================
// EXEMPLES D'UTILISATION
// ============================================================

/*

// Dans app.js, ajouter:
const exportRoutes = require('./routes/export');
app.use('/export', exportRoutes);

// Ou si les routes sont déjà enregistrées, remplacer le contenu du fichier export.js

// ============================================================
// URLS POUR LES UTILISATEURS
// ============================================================

// Coordinateur d'Axe 3:
// - GET http://localhost:3000/export/canvas-global
//   → Exporte les projets de l'Axe 3 uniquement
// - GET http://localhost:3000/export/canvas-2026
//   → Exporte les projets 2026 de l'Axe 3 uniquement
// - GET http://localhost:3000/export/fiches-projets/3
//   → PDF avec les fiches des projets de l'Axe 3

// Administrateur:
// - GET http://localhost:3000/export/canvas-global
//   → Exporte TOUS les projets de TOUS les Axes
// - GET http://localhost:3000/export/canvas-2026
//   → Exporte TOUS les projets 2026
// - GET http://localhost:3000/export/fiches-projets/1
//   → PDF avec les fiches des projets de l'Axe 1
// - GET http://localhost:3000/export/fiches-projets/2
//   → PDF avec les fiches des projets de l'Axe 2
// - GET http://localhost:3000/export/fiches-projets/3
//   → PDF avec les fiches des projets de l'Axe 3
// - GET http://localhost:3000/export/fiches-projets/4
//   → PDF avec les fiches des projets de l'Axe 4
// - GET http://localhost:3000/export/fiches-projets/5
//   → PDF avec les fiches des projets de l'Axe 5

// ============================================================
// CONFIGURATION REQUISE
// ============================================================

// 1. Table utilisateurs - Ajouter axe_id:
// ALTER TABLE utilisateurs ADD COLUMN axe_id INTEGER;
// ALTER TABLE utilisateurs ADD FOREIGN KEY (axe_id) REFERENCES axes(id);

// 2. Vérifier les profils:
// - profile_id = 1: Administrateur (accès complet)
// - profile_id = 4: Coordinateur (accès restreint à son axe)

// 3. Vérifier les axes dans la base:
// SELECT id, lib_axe FROM axes ORDER BY id;
// Résultat attendu:
// 1 | Investissements et emplois
// 2 | Renforcement et amélioration des services sociaux de base : Education
// 3 | Renforcement des services sociaux de base : Santé
// 4 | Gestion Proactive et durable des ressources en eau
// 5 | Infrastructures de base et mise à niveau

// ============================================================
// VARIABLES D'ENVIRONNEMENT
// ============================================================

// Dans .env:
// EXPORT_MAX_PROJECTS=1000  # Limite de projets à exporter (optionnel)
// PDF_TIMEOUT=60000         # Timeout PDF en ms (optionnel)

*/
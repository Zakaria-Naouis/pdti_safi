// routes/projects.js - Version avec validation et support objectifs

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const ProjectViewController = require('../controllers/projectViewController');
const { body, param } = require('express-validator');

// Middleware d'authentification
const { isAuthenticated } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Validation middleware pour les paramètres de route
const validateProjectId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID de projet invalide')
    .toInt()
];

// Validation complète pour les projets avec champs optionnels
const projectValidation = [
  // Numéro de projet (obligatoire)
  body('num_projet')
    .notEmpty()
    .withMessage('Le numéro de projet est obligatoire')
    .isInt({ min: 1, max: 99999 })
    .withMessage('Le numéro de projet doit être un entier entre 1 et 99999')
    .toInt(),

  // Intitulé (obligatoire)
  body('intitule')
    .notEmpty()
    .withMessage('L\'intitulé du projet est obligatoire')
    .isLength({ min: 10, max: 500 })
    .withMessage('L\'intitulé doit contenir entre 10 et 500 caractères')
    .trim()
    .escape(),

  // Champs de texte optionnels avec limites
  body('objectifs')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 10000 })
    .withMessage('Les objectifs ne peuvent pas dépasser 1000 caractères')
    .trim()
    .escape(),

  body('composantes')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 10000 })
    .withMessage('Les composantes ne peuvent pas dépasser 1000 caractères')
    .trim()
    .escape(),

  body('detail_cout')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 1000 })
    .withMessage('Le détail du coût ne peut pas dépasser 1000 caractères')
    .trim()
    .escape(),

  body('detail_nbr_emploi')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Le détail des emplois ne peut pas dépasser 500 caractères')
    .trim()
    .escape(),

  body('detail_nbr_beneficiaires')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Le détail des bénéficiaires ne peut pas dépasser 500 caractères')
    .trim()
    .escape(),

  // Champs numériques optionnels avec validation de plage
  body('cout_total_mdh')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Le coût total doit être un nombre positif inférieur à 1 000 000 MDH')
    .toFloat(),

  body('nbr_emplois_directs')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0, max: 999999 })
    .withMessage('Le nombre d\'emplois directs doit être un entier positif')
    .toInt(),

  body('nbr_beneficiaires')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0, max: 9999999 })
    .withMessage('Le nombre de bénéficiaires doit être un entier positif')
    .toInt(),

  body('duree_mois')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 1200 })
    .withMessage('La durée doit être comprise entre 1 et 1200 mois')
    .toInt(),

  // Validation des années
  body('annee_debut')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 2020, max: 2050 })
    .withMessage('L\'année de début doit être comprise entre 2020 et 2050')
    .toInt(),

  body('annee_fin')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 2020, max: 2050 })
    .withMessage('L\'année de fin doit être comprise entre 2020 et 2050')
    .toInt()
    .custom((value, { req }) => {
      if (value && req.body.annee_debut && value < req.body.annee_debut) {
        throw new Error('L\'année de fin doit être supérieure ou égale à l\'année de début');
      }
      return true;
    }),

  // Champs de texte courts
  body('superficie_lineaire')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 100 })
    .withMessage('La superficie/linéaire ne peut pas dépasser 100 caractères')
    .trim(),

  body('echeancier')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 100 })
    .withMessage('L\'échéancier ne peut pas dépasser 100 caractères')
    .trim(),

  // Validation des champs obligatoires de localisation
  body('axe_id')
    .notEmpty()
    .withMessage('L\'axe est obligatoire')
    .isInt({ min: 1 })
    .withMessage('Veuillez sélectionner un axe valide')
    .toInt(),

  body('secteur_id')
    .notEmpty()
    .withMessage('Le secteur est obligatoire')
    .isInt({ min: 1 })
    .withMessage('Veuillez sélectionner un secteur valide')
    .toInt(),

  // NOUVEAU: Validation de l'objectif (optionnel)
  body('objectif_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Permettre les valeurs vides
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        throw new Error('Veuillez sélectionner un objectif valide');
      }
      return true;
    })
    .toInt(),

  // IDs optionnels
  body('statut_juridique_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        throw new Error('Veuillez sélectionner un statut juridique valide');
      }
      return true;
    })
    .toInt(),

  body('moa_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        throw new Error('Veuillez sélectionner un MOA valide');
      }
      return true;
    })
    .toInt(),

  body('moe_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        throw new Error('Veuillez sélectionner un MOE valide');
      }
      return true;
    })
    .toInt(),

  body('gestionnaire_projet_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        throw new Error('Veuillez sélectionner un gestionnaire valide');
      }
      return true;
    })
    .toInt(),

  // Validation conditionnelle de l'état d'étude
  body('etude_etat')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['APS', 'APD', 'DE'])
    .withMessage('L\'état d\'étude doit être APS, APD ou DE')
    .custom((value, { req }) => {
      if (value && req.body.etude !== 'on') {
        throw new Error('L\'état d\'étude ne peut être défini que si l\'étude est marquée comme réalisée');
      }
      return true;
    }),

  // Validation des cases à cocher (booléens)
  body('fc_disponibilite')
    .optional()
    .isIn(['on', undefined])
    .withMessage('Valeur invalide pour la disponibilité foncière'),

  body('fc_visibilite')
    .optional()
    .isIn(['on', undefined])
    .withMessage('Valeur invalide pour la visibilité foncière'),

  body('fc_assiette_assine')
    .optional()
    .isIn(['on', undefined])
    .withMessage('Valeur invalide pour l\'assiette assinée'),

  body('etude')
    .optional()
    .isIn(['on', undefined])
    .withMessage('Valeur invalide pour l\'étude'),

  // Validation des communes (optionnel)
  body('communes')
    .optional({ nullable: true })
    .custom((value) => {
      if (!value) return true;
     
      const communes = Array.isArray(value) ? value : [value];
     
      for (const communeId of communes) {
        if (!communeId || isNaN(parseInt(communeId)) || parseInt(communeId) < 1) {
          throw new Error('IDs de communes invalides');
        }
      }
      return true;
    })
];

// Middleware pour journaliser les actions sur les projets
const logProjectAction = (action) => {
  return (req, res, next) => {
    console.log(`[${new Date().toISOString()}] Action: ${action} - Utilisateur: ${req.user?.email || 'Anonyme'} - Projet: ${req.params.id || 'Nouveau'}`);
    next();
  };
};

// Middleware de sécurité pour vérifier la cohérence des données
const securityCheck = async (req, res, next) => {
  try {
    const db = require('../config/database');
   
    // Vérifier que l'axe appartient au bon pôle pour les utilisateurs restreints
    if (req.body.axe_id && (req.user.profile_id === 4 || req.user.profile_id === 5)) {
      const axeResult = await db.query('SELECT pole_id FROM axes WHERE id = $1', [req.body.axe_id]);
     
      if (axeResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Axe sélectionné invalide'
        });
      }
     
      if (axeResult.rows[0].pole_id !== req.user.pole_id) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez pas sélectionner un axe en dehors de votre pôle'
        });
      }
    }
   
    // Vérifier que le secteur appartient à l'axe sélectionné
    if (req.body.secteur_id && req.body.axe_id) {
      const secteurResult = await db.query('SELECT axe_id FROM secteurs WHERE id = $1', [req.body.secteur_id]);
     
      if (secteurResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Secteur sélectionné invalide'
        });
      }
     
      if (secteurResult.rows[0].axe_id !== parseInt(req.body.axe_id)) {
        return res.status(400).json({
          success: false,
          message: 'Le secteur sélectionné ne correspond pas à l\'axe choisi'
        });
      }
    }

    // NOUVEAU: Vérifier que l'objectif appartient à l'axe sélectionné
    if (req.body.objectif_id && req.body.axe_id) {
      const objectifResult = await db.query('SELECT axe_id FROM objectifs WHERE id = $1', [req.body.objectif_id]);
     
      if (objectifResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Objectif sélectionné invalide'
        });
      }
     
      if (objectifResult.rows[0].axe_id !== parseInt(req.body.axe_id)) {
        return res.status(400).json({
          success: false,
          message: 'L\'objectif sélectionné ne correspond pas à l\'axe choisi'
        });
      }
    }
   
    next();
  } catch (error) {
    console.error('Erreur lors de la vérification de sécurité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des données'
    });
  }
};

// Routes pour les projets - toutes nécessitent une authentification
router.use(isAuthenticated);

// Route: Liste des projets
router.get('/',
  checkPermission('Consulter projets'),
  logProjectAction('CONSULTER_LISTE'),
  projectController.getProjects
);

// Route: Formulaire d'ajout de projet
router.get('/add',
  checkPermission('Ajouter projet dans son pôle'),
  logProjectAction('AFFICHER_FORMULAIRE_AJOUT'),
  projectController.getAddProject
);

// Route pour voir les détails d'un projet (consultation)
router.get('/view/:id',
  validateProjectId,
  checkPermission('Consulter projets'),
  ProjectViewController.getProjectDetails
);

// Route API pour récupérer les détails d'un projet
router.get('/api/details/:id',
  validateProjectId,
  ProjectViewController.getProjectDetailsAPI
);

// Route: Ajouter un projet
router.post('/add',
  checkPermission('Ajouter projet dans son pôle'),
  logProjectAction('AJOUTER_PROJET'),
  projectValidation,
  securityCheck,
  projectController.postAddProject
);

// Route: Formulaire de modification de projet
router.get('/edit/:id',
  validateProjectId,
  checkPermission('Modifier projet dans son pôle'),
  logProjectAction('AFFICHER_FORMULAIRE_MODIFICATION'),
  projectController.getEditProject
);

// Route: Modifier un projet
router.post('/edit/:id',
  validateProjectId,
  checkPermission('Modifier projet dans son pôle'),
  logProjectAction('MODIFIER_PROJET'),
  projectValidation,
  securityCheck,
  projectController.postEditProject
);

// Route: Supprimer un projet
router.delete('/delete/:id',
  validateProjectId,
  checkPermission('Modifier projet dans son pôle'),
  logProjectAction('SUPPRIMER_PROJET'),
  projectController.deleteProject
);

// Route: Vérification d'unicité du numéro de projet
router.get('/api/check-project-number/:numero',
  param('numero')
    .isInt({ min: 1, max: 99999 })
    .withMessage('Numéro de projet invalide')
    .toInt(),
  async (req, res) => {
    try {
      const { numero } = req.params;
      const projectId = req.query.projectId || null;
     
      const db = require('../config/database');
      let query = 'SELECT id FROM projets WHERE num_projet = $1';
      let params = [numero];
      
      if (projectId) {
        query += ' AND id != $2';
        params.push(projectId);
      }
      
      const result = await db.query(query, params);
     
      res.json({
        success: true,
        exists: result.rows.length > 0,
        message: result.rows.length > 0 ? 'Ce numéro de projet existe déjà' : 'Numéro de projet disponible'
      });
    } catch (error) {
      console.error('Erreur lors de la vérification du numéro de projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la vérification'
      });
    }
  }
);

// Route: Récupération des secteurs par axe
router.get('/api/secteurs-by-axe/:axeId',
  param('axeId')
    .isInt({ min: 1 })
    .withMessage('ID d\'axe invalide')
    .toInt(),
  async (req, res) => {
    try {
      const { axeId } = req.params;
     
      const db = require('../config/database');
      const result = await db.query(
        'SELECT * FROM secteurs WHERE axe_id = $1 ORDER BY lib_secteur ASC',
        [axeId]
      );
     
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des secteurs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des secteurs'
      });
    }
  }
);

// NOUVELLE ROUTE: Récupération des objectifs par axe
router.get('/api/objectifs-by-axe/:axeId',
  param('axeId')
    .isInt({ min: 1 })
    .withMessage('ID d\'axe invalide')
    .toInt(),
  async (req, res) => {
    try {
      const { axeId } = req.params;
     
      const db = require('../config/database');
      const result = await db.query(
        'SELECT id, nom_objectif, axe_id FROM objectifs WHERE axe_id = $1 ORDER BY nom_objectif ASC',
        [axeId]
      );
     
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des objectifs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des objectifs'
      });
    }
  }
);

// Middleware de gestion d'erreurs pour les routes de projets
router.use((error, req, res, next) => {
  console.error('Erreur dans les routes de projets:', error);
 
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Données JSON invalides'
    });
  }
 
  if (error.code && error.code.startsWith('23')) {
    return res.status(409).json({
      success: false,
      message: 'Conflit de données (contrainte de base de données)'
    });
  }
 
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur'
  });
});

module.exports = router;
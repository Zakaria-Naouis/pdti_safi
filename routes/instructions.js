// routes/instructions.js - Version complète et corrigée

const express = require('express');
const router = express.Router();
const instructionController = require('../controllers/instructionController');
const rbac = require('../middleware/rbac');
const { isAuthenticated } = require('../middleware/auth');
const { body, param } = require('express-validator');

// Middleware d'authentification pour toutes les routes
router.use(isAuthenticated);

// Règles de validation pour les instructions
const instructionValidationRules = () => {
  return [
    body('num_instruction')
      .optional()
      .isLength({ min: 3, max: 50 })
      .withMessage('Le numéro d\'instruction doit contenir entre 3 et 50 caractères')
      .trim()
      .escape(),

    body('sujet')
      .notEmpty()
      .withMessage('Le sujet est requis')
      .isLength({ min: 10, max: 500 })
      .withMessage('Le sujet doit contenir entre 10 et 500 caractères')
      .trim()
      .escape(),

    body('date_instruction')
      .notEmpty()
      .withMessage('La date d\'instruction est requise')
      .isDate()
      .withMessage('Date d\'instruction invalide'),

    body('date_limite')
      .notEmpty()
      .withMessage('La date limite est requise')
      .isDate()
      .withMessage('Date limite invalide')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.date_instruction)) {
          throw new Error('La date limite doit être postérieure à la date d\'instruction');
        }
        return true;
      }),

    body('destinataire_id')
      .notEmpty()
      .withMessage('Le destinataire est requis')
      .isInt({ min: 1 })
      .withMessage('Destinataire invalide')
      .toInt(),

    body('statut_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Statut invalide')
      .toInt(),

    body('observations')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Les observations ne peuvent pas dépasser 1000 caractères')
      .trim()
      .escape()
  ];
};

// Validation des paramètres d'ID
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID invalide')
    .toInt()
];

// ===============================================
// ROUTES PRINCIPALES
// ===============================================

// Liste des instructions
router.get('/', instructionController.getInstructions);

// Voir les détails d'une instruction
router.get('/view/:id', 
  validateId,
  instructionController.getInstructionDetails
);

// Formulaire d'ajout d'instruction
router.get('/add',
  rbac.checkPermission('Ajouter instruction'),
  instructionController.getAddInstruction
);

// Formulaire d'édition d'instruction
router.get('/edit/:id',
  validateId,
  rbac.checkPermission('Ajouter instruction'),
  instructionController.getEditInstruction
);

// Ajouter une instruction
router.post('/add',
  rbac.checkPermission('Ajouter instruction'),
  instructionValidationRules(),
  instructionController.postAddInstruction
);

// Modifier une instruction
router.post('/edit/:id',
  validateId,
  rbac.checkPermission('Ajouter instruction'),
  instructionValidationRules(),
  instructionController.postEditInstruction
);

// Supprimer une instruction
router.delete('/delete/:id',
  validateId,
  rbac.checkPermission('Ajouter instruction'),
  instructionController.deleteInstruction
);

// Marquer une instruction comme exécutée
router.post('/execute/:id',
  validateId,
  rbac.checkPermission('Marquer instruction exécutée'),
  instructionController.markAsExecuted
);

// ===============================================
// ROUTES API POUR AJAX
// ===============================================

// API : Vérification d'unicité du numéro d'instruction
router.get('/api/check-instruction-number/:numero',
  param('numero')
    .notEmpty()
    .withMessage('Numéro requis')
    .isLength({ min: 3, max: 50 })
    .withMessage('Numéro invalide')
    .trim()
    .escape(),
  async (req, res) => {
    try {
      const { numero } = req.params;
      const instructionId = req.query.instructionId || 0;

      const db = require('../config/database');
      const result = await db.query(
        'SELECT id FROM instructions WHERE num_instruction = $1 AND id != $2',
        [numero, instructionId]
      );

      res.json({
        success: true,
        exists: result.rows.length > 0,
        message: result.rows.length > 0 ? 'Ce numéro d\'instruction existe déjà' : 'Numéro d\'instruction disponible'
      });
    } catch (error) {
      console.error('Erreur lors de la vérification du numéro d\'instruction:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la vérification'
      });
    }
  }
);

// API : Récupérer les coordinateurs par pôle
router.get('/api/coordinateurs-by-pole/:poleId',
  param('poleId')
    .isInt({ min: 1 })
    .withMessage('ID de pôle invalide')
    .toInt(),
  async (req, res) => {
    try {
      const { poleId } = req.params;

      const db = require('../config/database');
      const result = await db.query(
        `SELECT u.id, u.nom, u.prenom, p.lib_pole
         FROM utilisateurs u
         JOIN profiles pr ON u.profile_id = pr.id
         JOIN poles p ON u.pole_id = p.id
         WHERE pr.lib_profile = 'Coordonnateur' AND u.pole_id = $1
         ORDER BY u.nom, u.prenom`,
        [poleId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des coordinateurs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des coordinateurs'
      });
    }
  }
);

// API : Statistiques des instructions pour un utilisateur
router.get('/api/my-instructions-stats', 
  instructionController.getInstructionStats
);

// API : Filtrer les instructions
router.get('/api/filter', async (req, res) => {
  try {
    const { statut_id, search, date_debut, date_fin } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT 
        i.id,
        i.num_instruction,
        i.date_instruction,
        i.sujet,
        i.date_limite,
        i.observations,
        i.date_execution,
        e.nom as emetteur_nom, 
        e.prenom as emetteur_prenom,
        d.nom as destinataire_nom, 
        d.prenom as destinataire_prenom,
        s.lib_statut,
        s.id as statut_id,
        CASE 
          WHEN s.lib_statut = 'Exécuté' THEN 'success'
          WHEN s.lib_statut = 'En Cours' AND i.date_limite >= CURRENT_DATE THEN 'warning'
          WHEN s.lib_statut = 'En Retard' OR (s.lib_statut = 'En Cours' AND i.date_limite < CURRENT_DATE) THEN 'danger'
          ELSE 'secondary'
        END as status_color
      FROM instructions i
      JOIN utilisateurs e ON i.emetteur_id = e.id
      JOIN utilisateurs d ON i.destinataire_id = d.id
      JOIN statuts_instructions s ON i.statut_id = s.id
    `;

    const conditions = [];
    const params = [];

    // Filtrer selon le rôle
    if (req.user.profile_id === 4) {
      conditions.push(`i.destinataire_id = $${params.length + 1}`);
      params.push(userId);
    } else if (req.user.profile_id === 2 || req.user.profile_id === 3) {
      conditions.push(`i.emetteur_id = $${params.length + 1}`);
      params.push(userId);
    }

    // Filtres additionnels
    if (statut_id && !isNaN(statut_id)) {
      conditions.push(`i.statut_id = $${params.length + 1}`);
      params.push(parseInt(statut_id));
    }

    if (search && search.trim()) {
      conditions.push(`(i.sujet ILIKE $${params.length + 1} OR i.num_instruction ILIKE $${params.length + 1})`);
      params.push(`%${search.trim()}%`);
    }

    if (date_debut) {
      conditions.push(`i.date_instruction >= $${params.length + 1}`);
      params.push(date_debut);
    }

    if (date_fin) {
      conditions.push(`i.date_instruction <= $${params.length + 1}`);
      params.push(date_fin);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY i.date_instruction DESC';

    const db = require('../config/database');
    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Erreur lors du filtrage des instructions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du filtrage'
    });
  }
});

// API : Génerer un numéro d'instruction automatique
router.get('/api/generate-instruction-number', async (req, res) => {
  try {
    const db = require('../config/database');
    const year = new Date().getFullYear();
    
    // Chercher le dernier numéro pour l'année courante
    const result = await db.query(
      'SELECT num_instruction FROM instructions WHERE num_instruction LIKE $1 ORDER BY id DESC LIMIT 1',
      [`INST-${year}-%`]
    );
    
    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].num_instruction;
      const match = lastNumber.match(/INST-\d{4}-(\d{3})/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    const generatedNumber = `INST-${year}-${nextNumber.toString().padStart(3, '0')}`;
    
    res.json({
      success: true,
      number: generatedNumber
    });
  } catch (error) {
    console.error('Erreur lors de la génération du numéro:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du numéro'
    });
  }
});

// ===============================================
// MIDDLEWARE DE GESTION D'ERREURS
// ===============================================

// Middleware de gestion d'erreurs pour les routes d'instructions
router.use((error, req, res, next) => {
  console.error('Erreur dans les routes d\'instructions:', error);

  // Erreurs de validation
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Données JSON invalides'
    });
  }

  // Erreurs de contraintes de base de données
  if (error.code && error.code.startsWith('23')) {
    return res.status(409).json({
      success: false,
      message: 'Conflit de données (contrainte de base de données)'
    });
  }

  // Autres erreurs
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    // Requête AJAX - retourner JSON
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  } else {
    // Requête normale - afficher page d'erreur
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue dans la gestion des instructions.',
      error: error,
      layout: 'layout'
    });
  }
});

// À ajouter dans routes/instructions.js ou créer un nouveau fichier routes/notifications.js

// API : Récupérer le nombre de notifications d'instructions
router.get('/api/notifications-count', async (req, res) => {
  try {
    let instructionCount = 0;
    
    if (req.user.profile_id === 2 || req.user.profile_id === 3) {
      // Gouverneur/SG - instructions émises en cours ou en retard
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM instructions i
        JOIN statuts_instructions s ON i.statut_id = s.id
        WHERE i.emetteur_id = $1 AND s.lib_statut IN ('En Cours', 'En Retard')
      `, [req.user.id]);
      instructionCount = parseInt(result.rows[0].count) || 0;
    } else if (req.user.profile_id === 4) {
      // Coordinateur - instructions reçues non exécutées
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM instructions i
        JOIN statuts_instructions s ON i.statut_id = s.id
        WHERE i.destinataire_id = $1 AND s.lib_statut != 'Exécuté'
      `, [req.user.id]);
      instructionCount = parseInt(result.rows[0].count) || 0;
    } else if (req.user.profile_id === 5) {
      // Chef de pôle - instructions concernant son pôle
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM instructions i
        JOIN utilisateurs u ON i.destinataire_id = u.id
        JOIN statuts_instructions s ON i.statut_id = s.id
        WHERE u.pole_id = $1 AND s.lib_statut != 'Exécuté'
      `, [req.user.pole_id]);
      instructionCount = parseInt(result.rows[0].count) || 0;
    } else if (req.user.profile_id === 1) {
      // Admin - toutes les instructions non exécutées
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM instructions i
        JOIN statuts_instructions s ON i.statut_id = s.id
        WHERE s.lib_statut != 'Exécuté'
      `);
      instructionCount = parseInt(result.rows[0].count) || 0;
    }

    res.json({
      success: true,
      count: instructionCount,
      hasNotifications: instructionCount > 0
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;
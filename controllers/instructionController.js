// controllers/instructionController.js - Version corrigée et complète

const Instruction = require('../models/Instruction');
const { validationResult } = require('express-validator');
const db = require('../config/database');

// Liste des instructions avec filtres
exports.getInstructions = async (req, res) => {
  try {
    const filters = {};
    
    // Si l'utilisateur est coordinateur, filtrer par destinataire
    if (req.user.profile_id === 4) {
      filters.destinataire_id = req.user.id;
    }
    // Si l'utilisateur est gouverneur ou SG, filtrer par émetteur
    else if (req.user.profile_id === 2 || req.user.profile_id === 3) {
      filters.emetteur_id = req.user.id;
    }

    const instructions = await Instruction.findAll(filters);
    
    // Récupérer les statistiques pour l'utilisateur actuel
    let instructionStats = null;
    try {
      const statsResult = await getInstructionStatsForUser(req.user);
      instructionStats = statsResult;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
    }
    
    res.render('instructions/list', {
      title: 'Instructions - PDTI Safi',
      pageTitle: 'Liste des instructions',
      instructions: instructions || [],
      instructionStats: instructionStats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des instructions:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de la récupération des instructions.',
      error: error
    });
  }
};

// Fonction helper pour récupérer les statistiques
async function getInstructionStatsForUser(user) {
  let query;
  let params;

  if (user.profile_id === 2 || user.profile_id === 3) {
    // Gouverneur ou SG - instructions émises
    query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN si.lib_statut = 'Exécuté' THEN 1 END) as executed,
        COUNT(CASE WHEN si.lib_statut = 'En Cours' THEN 1 END) as in_progress,
        COUNT(CASE WHEN si.lib_statut = 'En Retard' THEN 1 END) as overdue
      FROM instructions i
      JOIN statuts_instructions si ON i.statut_id = si.id
      WHERE i.emetteur_id = $1
    `;
    params = [user.id];
  } else if (user.profile_id === 4) {
    // Coordinateur - instructions reçues
    query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN si.lib_statut = 'Exécuté' THEN 1 END) as executed,
        COUNT(CASE WHEN si.lib_statut = 'En Cours' THEN 1 END) as in_progress,
        COUNT(CASE WHEN si.lib_statut = 'En Retard' THEN 1 END) as overdue
      FROM instructions i
      JOIN statuts_instructions si ON i.statut_id = si.id
      WHERE i.destinataire_id = $1
    `;
    params = [user.id];
  } else {
    // Administrateur - toutes les instructions
    query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN si.lib_statut = 'Exécuté' THEN 1 END) as executed,
        COUNT(CASE WHEN si.lib_statut = 'En Cours' THEN 1 END) as in_progress,
        COUNT(CASE WHEN si.lib_statut = 'En Retard' THEN 1 END) as overdue
      FROM instructions i
      JOIN statuts_instructions si ON i.statut_id = si.id
    `;
    params = [];
  }

  const result = await db.query(query, params);
  const stats = result.rows[0] || {};

  return {
    total: parseInt(stats.total) || 0,
    executed: parseInt(stats.executed) || 0,
    in_progress: parseInt(stats.in_progress) || 0,
    overdue: parseInt(stats.overdue) || 0
  };
}

// Voir les détails d'une instruction
exports.getInstructionDetails = async (req, res) => {
  try {
    const instructionId = req.params.id;
    
    if (!instructionId || isNaN(instructionId)) {
      return res.status(400).render('error', {
        title: 'Requête invalide',
        pageTitle: 'Erreur 400',
        message: 'ID d\'instruction invalide.',
        error: { status: 400, stack: '' }
      });
    }

    // Récupérer l'instruction avec toutes les informations
    const result = await db.query(`
      SELECT
        i.*,
        e.nom as emetteur_nom,
        e.prenom as emetteur_prenom,
        e.email as emetteur_email,
        d.nom as destinataire_nom,
        d.prenom as destinataire_prenom,
        d.email as destinataire_email,
        s.lib_statut,
        p_e.lib_pole as emetteur_pole,
        p_d.lib_pole as destinataire_pole
      FROM instructions i
      JOIN utilisateurs e ON i.emetteur_id = e.id
      JOIN utilisateurs d ON i.destinataire_id = d.id
      JOIN statuts_instructions s ON i.statut_id = s.id
      LEFT JOIN poles p_e ON e.pole_id = p_e.id
      LEFT JOIN poles p_d ON d.pole_id = p_d.id
      WHERE i.id = $1
    `, [instructionId]);

    if (result.rows.length === 0) {
      return res.status(404).render('error', {
        title: 'Instruction non trouvée',
        pageTitle: 'Erreur 404',
        message: 'L\'instruction demandée n\'existe pas.',
        error: { status: 404, stack: '' }
      });
    }

    const instruction = result.rows[0];

    // Vérifier les permissions d'accès
    const canView = req.user.profile_id === 1 || // Administrateur
                   instruction.emetteur_id === req.user.id || // Émetteur
                   instruction.destinataire_id === req.user.id; // Destinataire

    if (!canView) {
      return res.status(403).render('error', {
        title: 'Accès refusé',
        pageTitle: 'Erreur 403',
        message: 'Vous n\'avez pas l\'autorisation de consulter cette instruction.',
        error: { status: 403, stack: '' }
      });
    }

    res.render('instructions/view', {
      title: `Instruction ${instruction.num_instruction} - PDTI Safi`,
      pageTitle: `Détails de l'instruction ${instruction.num_instruction}`,
      instruction: instruction
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails de l\'instruction:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de la récupération des détails de l\'instruction.',
      error: error
    });
  }
};

// Formulaire d'ajout d'instruction - CORRIGÉ
exports.getAddInstruction = async (req, res) => {
  try {
    // Récupérer les destinataires possibles (coordinateurs et secrétaire général)
    const destinataires = await db.query(
      `SELECT u.id, u.nom, u.prenom, p.lib_pole, pr.lib_profile
       FROM utilisateurs u
       JOIN profiles pr ON u.profile_id = pr.id
       LEFT JOIN poles p ON u.pole_id = p.id
       WHERE pr.lib_profile IN ('Coordonnateur', 'Secrétaire Général')
       ORDER BY pr.lib_profile DESC, u.nom, u.prenom`
    );

    // Récupérer les statuts d'instruction
    const statuts = await db.query('SELECT * FROM statuts_instructions ORDER BY id');

    // Générer automatiquement un numéro d'instruction
    const year = new Date().getFullYear();
    const lastInstructionResult = await db.query(
      'SELECT num_instruction FROM instructions WHERE num_instruction LIKE $1 ORDER BY id DESC LIMIT 1',
      [`INST-${year}-%`]
    );
    
    let nextNumber = 1;
    if (lastInstructionResult.rows.length > 0) {
      const lastNumber = lastInstructionResult.rows[0].num_instruction;
      const match = lastNumber.match(/INST-\d{4}-(\d{3})/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    const autoGeneratedNumber = `INST-${year}-${nextNumber.toString().padStart(3, '0')}`;

    // Créer un objet instruction avec numéro auto-généré
    const instruction = {
      num_instruction: autoGeneratedNumber,
      date_instruction: new Date().toISOString().split('T')[0],
      sujet: '',
      date_limite: '',
      destinataire_id: '',
      observations: '',
      statut_id: null
    };

    res.render('instructions/add', {
      title: 'Ajouter une instruction - PDTI Safi',
      pageTitle: 'Ajouter une nouvelle instruction',
      destinataires: destinataires.rows || [],
      statuts: statuts.rows || [],
      instruction: instruction, // CORRECTION: Passer un objet instruction valide
      errors: []
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire d\'ajout:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du formulaire.',
      error: error
    });
  }
};

// Formulaire d'édition d'instruction
exports.getEditInstruction = async (req, res) => {
  try {
    const instructionId = req.params.id;
    
    if (!instructionId || isNaN(instructionId)) {
      return res.status(400).render('error', {
        title: 'Requête invalide',
        pageTitle: 'Erreur 400',
        message: 'ID d\'instruction invalide.',
        error: { status: 400, stack: '' }
      });
    }

    // Récupérer l'instruction
    const instruction = await Instruction.findById(instructionId);
    
    if (!instruction) {
      return res.status(404).render('error', {
        title: 'Instruction non trouvée',
        pageTitle: 'Erreur 404',
        message: 'L\'instruction à modifier n\'existe pas.',
        error: { status: 404, stack: '' }
      });
    }

    // Vérifier les permissions (seul l'émetteur peut modifier si pas encore exécutée)
    if (instruction.emetteur_id !== req.user.id && req.user.profile_id !== 1) {
      return res.status(403).render('error', {
        title: 'Accès refusé',
        pageTitle: 'Erreur 403',
        message: 'Vous ne pouvez pas modifier cette instruction.',
        error: { status: 403, stack: '' }
      });
    }

    // Vérifier si l'instruction peut être modifiée (pas encore exécutée)
    const statutResult = await db.query('SELECT lib_statut FROM statuts_instructions WHERE id = $1', [instruction.statut_id]);
    if (statutResult.rows[0]?.lib_statut === 'Exécuté') {
      return res.status(403).render('error', {
        title: 'Modification impossible',
        pageTitle: 'Erreur 403',
        message: 'Cette instruction a déjà été exécutée et ne peut plus être modifiée.',
        error: { status: 403, stack: '' }
      });
    }

    // Récupérer les destinataires possibles (coordinateurs et secrétaire général)
    const destinataires = await db.query(
      `SELECT u.id, u.nom, u.prenom, p.lib_pole, pr.lib_profile
       FROM utilisateurs u
       JOIN profiles pr ON u.profile_id = pr.id
       LEFT JOIN poles p ON u.pole_id = p.id
       WHERE pr.lib_profile IN ('Coordonnateur', 'Secrétaire Général')
       ORDER BY pr.lib_profile DESC, u.nom, u.prenom`
    );

    // Récupérer les statuts d'instruction
    const statuts = await db.query('SELECT * FROM statuts_instructions ORDER BY id');

    res.render('instructions/edit', {
      title: `Modifier instruction ${instruction.num_instruction} - PDTI Safi`,
      pageTitle: `Modifier l'instruction ${instruction.num_instruction}`,
      instruction: instruction,
      destinataires: destinataires.rows || [],
      statuts: statuts.rows || [],
      errors: []
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire de modification:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du formulaire.',
      error: error
    });
  }
};

// Ajouter une instruction - CORRIGÉ
exports.postAddInstruction = async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    try {
      // Récupérer à nouveau les données de référence pour réafficher le formulaire
      const destinataires = await db.query(
        `SELECT u.id, u.nom, u.prenom, p.lib_pole, pr.lib_profile
         FROM utilisateurs u
         JOIN profiles pr ON u.profile_id = pr.id
         LEFT JOIN poles p ON u.pole_id = p.id
         WHERE pr.lib_profile IN ('Coordonnateur', 'Secrétaire Général')
         ORDER BY pr.lib_profile DESC, u.nom, u.prenom`
      );

      const statuts = await db.query('SELECT * FROM statuts_instructions ORDER BY id');

      // Préparer l'objet instruction avec les données soumises
      const instruction = {
        num_instruction: req.body.num_instruction || '',
        date_instruction: req.body.date_instruction || new Date().toISOString().split('T')[0],
        sujet: req.body.sujet || '',
        date_limite: req.body.date_limite || '',
        destinataire_id: req.body.destinataire_id || '',
        observations: req.body.observations || '',
        statut_id: req.body.statut_id || null
      };

      return res.render('instructions/add', {
        title: 'Ajouter une instruction - PDTI Safi',
        pageTitle: 'Ajouter une nouvelle instruction',
        errors: errors.array(),
        instruction: instruction, // CORRECTION: Passer un objet instruction complet
        destinataires: destinataires.rows || [],
        statuts: statuts.rows || []
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des données de référence:', error);
      return res.status(500).render('error', {
        title: 'Erreur',
        pageTitle: 'Erreur 500',
        message: 'Une erreur est survenue lors du traitement du formulaire.',
        error: error
      });
    }
  }

  try {
    // Ajouter l'émetteur (l'utilisateur connecté)
    req.body.emetteur_id = req.user.id;
    
    // Si pas de statut spécifié, définir par défaut "En Cours"
    if (!req.body.statut_id) {
      const defaultStatus = await db.query('SELECT id FROM statuts_instructions WHERE lib_statut = $1', ['En Cours']);
      req.body.statut_id = defaultStatus.rows[0]?.id || 2; // 2 comme fallback si pas trouvé
    }

    // Générer un numéro d'instruction automatique si vide
    if (!req.body.num_instruction || req.body.num_instruction.trim() === '') {
      const year = new Date().getFullYear();
      const lastInstructionResult = await db.query(
        'SELECT num_instruction FROM instructions WHERE num_instruction LIKE $1 ORDER BY id DESC LIMIT 1',
        [`INST-${year}-%`]
      );
      
      let nextNumber = 1;
      if (lastInstructionResult.rows.length > 0) {
        const lastNumber = lastInstructionResult.rows[0].num_instruction;
        const match = lastNumber.match(/INST-\d{4}-(\d{3})/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      req.body.num_instruction = `INST-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    await Instruction.create(req.body);
    
    // Redirection avec message de succès
    req.session.successMessage = 'Instruction créée avec succès';
    res.redirect('/dashboard/gouverneur?success=Instruction modifiée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'instruction:', error);
    
    try {
      // Récupérer les données pour réafficher le formulaire
      const destinataires = await db.query(
        `SELECT u.id, u.nom, u.prenom, p.lib_pole
         FROM utilisateurs u
         JOIN profiles pr ON u.profile_id = pr.id
         JOIN poles p ON u.pole_id = p.id
         WHERE pr.lib_profile = 'Coordonnateur'
         ORDER BY u.nom, u.prenom`
      );

      const statuts = await db.query('SELECT * FROM statuts_instructions ORDER BY id');

      const instruction = {
        num_instruction: req.body.num_instruction || '',
        date_instruction: req.body.date_instruction || new Date().toISOString().split('T')[0],
        sujet: req.body.sujet || '',
        date_limite: req.body.date_limite || '',
        destinataire_id: req.body.destinataire_id || '',
        observations: req.body.observations || '',
        statut_id: req.body.statut_id || null
      };

      return res.render('instructions/add', {
        title: 'Ajouter une instruction - PDTI Safi',
        pageTitle: 'Ajouter une nouvelle instruction',
        errors: [{ msg: 'Une erreur est survenue lors de l\'ajout de l\'instruction.' }],
        instruction: instruction,
        destinataires: destinataires.rows || [],
        statuts: statuts.rows || []
      });
    } catch (innerError) {
      console.error('Erreur lors de la récupération des données après erreur:', innerError);
      res.status(500).render('error', {
        title: 'Erreur',
        pageTitle: 'Erreur 500',
        message: 'Une erreur est survenue lors de l\'ajout de l\'instruction.',
        error: error
      });
    }
  }
};

// Modifier une instruction
exports.postEditInstruction = async (req, res) => {
  const errors = validationResult(req);
  const instructionId = req.params.id;

  if (!errors.isEmpty()) {
    try {
      // Récupérer à nouveau les données pour réafficher le formulaire
      const instruction = await Instruction.findById(instructionId);
      const destinataires = await db.query(
        `SELECT u.id, u.nom, u.prenom, p.lib_pole
         FROM utilisateurs u
         JOIN profiles pr ON u.profile_id = pr.id
         JOIN poles p ON u.pole_id = p.id
         WHERE pr.lib_profile = 'Coordonnateur'
         ORDER BY u.nom, u.prenom`
      );

      const statuts = await db.query('SELECT * FROM statuts_instructions ORDER BY id');

      return res.render('instructions/edit', {
        title: `Modifier instruction ${instruction.num_instruction} - PDTI Safi`,
        pageTitle: `Modifier l'instruction ${instruction.num_instruction}`,
        errors: errors.array(),
        instruction: { ...instruction, ...req.body },
        destinataires: destinataires.rows || [],
        statuts: statuts.rows || []
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
      return res.status(500).render('error', {
        title: 'Erreur',
        pageTitle: 'Erreur 500',
        message: 'Une erreur est survenue lors du traitement du formulaire.',
        error: error
      });
    }
  }

  try {
    // Vérifier que l'instruction existe et peut être modifiée
    const instruction = await Instruction.findById(instructionId);
    
    if (!instruction) {
      return res.status(404).render('error', {
        title: 'Instruction non trouvée',
        pageTitle: 'Erreur 404',
        message: 'L\'instruction à modifier n\'existe pas.',
        error: { status: 404, stack: '' }
      });
    }

    // Vérifier les permissions
    if (instruction.emetteur_id !== req.user.id && req.user.profile_id !== 1) {
      return res.status(403).render('error', {
        title: 'Accès refusé',
        pageTitle: 'Erreur 403',
        message: 'Vous ne pouvez pas modifier cette instruction.',
        error: { status: 403, stack: '' }
      });
    }

    // Vérifier si l'instruction peut être modifiée
    const statutResult = await db.query('SELECT lib_statut FROM statuts_instructions WHERE id = $1', [instruction.statut_id]);
    if (statutResult.rows[0]?.lib_statut === 'Exécuté') {
      return res.status(403).render('error', {
        title: 'Modification impossible',
        pageTitle: 'Erreur 403',
        message: 'Cette instruction a déjà été exécutée et ne peut plus être modifiée.',
        error: { status: 403, stack: '' }
      });
    }

    // Conserver l'émetteur original et s'assurer que le statut est défini
    req.body.emetteur_id = instruction.emetteur_id;
    
    // Si pas de statut spécifié, conserver le statut actuel
    if (!req.body.statut_id) {
      req.body.statut_id = instruction.statut_id;
    }
    
    await Instruction.update(instructionId, req.body);
    
    // Redirection avec message de succès
    req.session.successMessage = 'Instruction modifiée avec succès';
    res.redirect('/dashboard/gouverneur?success=Instruction modifiée avec succès');
  } catch (error) {
    console.error('Erreur lors de la modification de l\'instruction:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de la modification de l\'instruction.',
      error: error
    });
  }
};

// Supprimer une instruction
exports.deleteInstruction = async (req, res) => {
  try {
    const instructionId = req.params.id;
    
    if (!instructionId || isNaN(instructionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID d\'instruction invalide'
      });
    }

    const instruction = await Instruction.findById(instructionId);
    
    if (!instruction) {
      return res.status(404).json({
        success: false,
        message: 'Instruction non trouvée'
      });
    }

    // Vérifier les permissions (seul l'émetteur ou admin peut supprimer)
    if (instruction.emetteur_id !== req.user.id && req.user.profile_id !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas l\'autorisation de supprimer cette instruction'
      });
    }

    // Vérifier si l'instruction peut être supprimée (pas encore exécutée)
    const statutResult = await db.query('SELECT lib_statut FROM statuts_instructions WHERE id = $1', [instruction.statut_id]);
    if (statutResult.rows[0]?.lib_statut === 'Exécuté') {
      return res.status(403).json({
        success: false,
        message: 'Cette instruction a déjà été exécutée et ne peut plus être supprimée'
      });
    }

    // Supprimer l'instruction
    await db.query('DELETE FROM instructions WHERE id = $1', [instructionId]);
    
    res.json({
      success: true,
      message: 'Instruction supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'instruction:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la suppression de l\'instruction.'
    });
  }
};

// Marquer une instruction comme exécutée
exports.markAsExecuted = async (req, res) => {
  try {
    const instructionId = req.params.id;
    const instruction = await Instruction.findById(instructionId);
    
    if (!instruction) {
      return res.status(404).json({ 
        success: false,
        message: 'Instruction non trouvée' 
      });
    }

    // Vérifier que l'utilisateur est le destinataire de l'instruction
    if (instruction.destinataire_id !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette instruction' 
      });
    }

    await Instruction.markAsExecuted(instructionId, new Date());
    
    res.json({ 
      success: true, 
      message: 'Instruction marquée comme exécutée' 
    });
  } catch (error) {
    console.error('Erreur lors du marquage de l\'instruction:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Une erreur est survenue lors du marquage de l\'instruction.' 
    });
  }
};

// API pour les statistiques des instructions
exports.getInstructionStats = async (req, res) => {
  try {
    const statsResult = await getInstructionStatsForUser(req.user);
    
    res.json({
      success: true,
      data: statsResult
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};
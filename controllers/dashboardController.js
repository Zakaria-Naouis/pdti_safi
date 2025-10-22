// controllers/dashboardController.js - CORRECTION COMPLÈTE

const Project = require('../models/Project');
const Instruction = require('../models/Instruction');
const db = require('../config/database');

// Méthode pour récupérer les statistiques globales
exports.getStats = async () => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_projets,
        COALESCE(SUM(cout_total_mdh), 0) as cout_total,
        COALESCE(SUM(nbr_emplois_directs), 0) as total_emplois,
        COALESCE(SUM(nbr_beneficiaires), 0) as total_beneficiaires
      FROM projets
    `);
   
    const stats = result.rows[0] || {};
   
    return {
      total_projets: parseInt(stats.total_projets) || 0,
      cout_total: parseFloat(stats.cout_total) || 0,
      total_emplois: parseInt(stats.total_emplois) || 0,
      total_beneficiaires: parseInt(stats.total_beneficiaires) || 0
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    return {
      total_projets: 0,
      cout_total: 0,
      total_emplois: 0,
      total_beneficiaires: 0
    };
  }
};

// Récupérer les axes avec leurs statistiques
// Récupérer les axes avec leurs statistiques
exports.getAxesWithStats = async () => {
  try {
    const result = await db.query(`
      SELECT 
        a.id,
        a.lib_axe,
        a.pole_id,
        po.lib_pole,
        COUNT(p.id) as nb_projets,
        COALESCE(SUM(p.cout_total_mdh), 0) as cout_total,
        COALESCE(SUM(p.nbr_emplois_directs), 0) as total_emplois,
        COALESCE(SUM(p.nbr_beneficiaires), 0) as total_beneficiaires
      FROM axes a
      LEFT JOIN projets p ON a.id = p.axe_id
      JOIN poles po ON a.pole_id = po.id
      GROUP BY a.id, a.lib_axe, a.pole_id, po.lib_pole
      ORDER BY a.id ASC
    `);

    // ========== NOUVEAU CODE : Calcul des pourcentages ==========
    const axes = result.rows.map(row => ({
      id: row.id,
      lib_axe: row.lib_axe,
      pole_id: row.pole_id,
      lib_pole: row.lib_pole,
      nb_projets: parseInt(row.nb_projets) || 0,
      cout_total: parseFloat(row.cout_total) || 0,
      total_emplois: parseInt(row.total_emplois) || 0,
      total_beneficiaires: parseInt(row.total_beneficiaires) || 0
    }));

    // Calculer le montant total global de tous les axes
    const montantTotalGlobal = axes.reduce((sum, axe) => sum + axe.cout_total, 0);

    // Ajouter le pourcentage à chaque axe
    return axes.map(axe => ({
      ...axe,
      pourcentage: montantTotalGlobal > 0 
        ? ((axe.cout_total / montantTotalGlobal) * 100).toFixed(2)
        : '0.00',
      montant_total_global: montantTotalGlobal
    }));
    // ========== FIN DU NOUVEAU CODE ==========

  } catch (error) {
    console.error('Erreur lors de la récupération des axes avec statistiques:', error);
    return [];
  }
};


// Récupérer les statistiques des instructions
exports.getInstructionStats = async (userId, profileId) => {
  try {
    let query;
    let params;

    if (profileId === 2 || profileId === 3) {
      query = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN si.lib_statut = 'Exécuté' THEN 1 END) as executed,
          COUNT(CASE WHEN si.lib_statut = 'En Cours' THEN 1 END) as in_progress,
          COUNT(CASE WHEN si.lib_statut = 'En Retard' THEN 1 END) as overdue,
          COUNT(CASE WHEN i.date_limite < CURRENT_DATE AND si.lib_statut != 'Exécuté' THEN 1 END) as urgent
        FROM instructions i
        JOIN statuts_instructions si ON i.statut_id = si.id
        WHERE i.emetteur_id = $1
      `;
      params = [userId];
    } else {
      query = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN si.lib_statut = 'Exécuté' THEN 1 END) as executed,
          COUNT(CASE WHEN si.lib_statut = 'En Cours' THEN 1 END) as in_progress,
          COUNT(CASE WHEN si.lib_statut = 'En Retard' THEN 1 END) as overdue,
          COUNT(CASE WHEN i.date_limite < CURRENT_DATE AND si.lib_statut != 'Exécuté' THEN 1 END) as urgent
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
      overdue: parseInt(stats.overdue) || 0,
      urgent: parseInt(stats.urgent) || 0
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques d\'instructions:', error);
    return {
      total: 0,
      executed: 0,
      in_progress: 0,
      overdue: 0,
      urgent: 0
    };
  }
};

// Méthode pour récupérer les projets paginés par pôle
exports.getPaginatedProjectsByPole = async (poleId, page = 1, limit = 5) => {
  try {
    const offset = (page - 1) * limit;
   
    const projectsQuery = `
      SELECT p.*, a.lib_axe, s.lib_secteur, po.lib_pole
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN secteurs s ON p.secteur_id = s.id
      JOIN poles po ON a.pole_id = po.id
      WHERE po.id = $1
      ORDER BY p.num_projet
      LIMIT $2 OFFSET $3
    `;
   
    const projectsResult = await db.query(projectsQuery, [poleId, limit, offset]);
   
    const countQuery = `
      SELECT COUNT(*) as total
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN poles po ON a.pole_id = po.id
      WHERE po.id = $1
    `;
   
    const countResult = await db.query(countQuery, [poleId]);
    const totalProjects = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalProjects / limit);
   
    return {
      projects: projectsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalItems: totalProjects,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: limit
      }
    };
  } catch (error) {
    console.error('Erreur lors de la pagination des projets:', error);
    return {
      projects: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        hasNext: false,
        hasPrev: false,
        limit: 5
      }
    };
  }
};

// Tableau de bord administrateur
exports.getAdminDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    
    const stats = await this.getStats();
    const poles = await db.query('SELECT * FROM poles ORDER BY id ASC');
    const polesStats = [];
   
    for (const pole of poles.rows) {
      const poleStats = await Project.getStatsByPole(pole.id);
      polesStats.push({
        ...pole,
        total_projets: parseInt(poleStats.total_projets) || 0,
        cout_total: parseFloat(poleStats.cout_total) || 0,
        total_emplois: parseInt(poleStats.total_emplois) || 0,
        total_beneficiaires: parseInt(poleStats.total_beneficiaires) || 0
      });
    }

    const axesResult = await db.query(`
      SELECT 
        a.id, 
        a.lib_axe, 
        a.pole_id, 
        po.lib_pole,
        COUNT(DISTINCT o.id) as nb_objectifs
      FROM axes a
      JOIN poles po ON a.pole_id = po.id
      LEFT JOIN objectifs o ON a.id = o.axe_id
      GROUP BY a.id, a.lib_axe, a.pole_id, po.lib_pole
      ORDER BY a.id ASC
    `);

    const offset = (page - 1) * limit;
    
    const projectsQuery = `
      SELECT 
        p.id,
        p.num_projet,
        p.intitule,
        p.cout_total_mdh,
        p.nbr_emplois_directs,
        p.nbr_beneficiaires,
        p.axe_id,
        a.lib_axe,
        s.id as secteur_id,
        s.lib_secteur,
        po.id as pole_id,
        po.lib_pole
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN secteurs s ON p.secteur_id = s.id
      JOIN poles po ON a.pole_id = po.id
      ORDER BY p.num_projet DESC
      LIMIT $1 OFFSET $2
    `;
    
    const projectsResult = await db.query(projectsQuery, [limit, offset]);
    
    const countQuery = 'SELECT COUNT(*) as total FROM projets';
    const countResult = await db.query(countQuery);
    const totalProjects = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalProjects / limit);

    res.render('dashboard/admin', {
      title: 'Tableau de bord administrateur - PDTI Safi',
      pageTitle: 'Tableau de bord administrateur',
      stats: stats,
      polesStats: polesStats,
      axes: axesResult.rows,
      projects: projectsResult.rows,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalProjects,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: limit
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du tableau de bord administrateur:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.'
    });
  }
};

// Tableau de bord gouverneur / SG
exports.getGouverneurDashboard = async (req, res) => {
  try {
    const stats = await this.getStats();
    const poles = await db.query('SELECT * FROM poles');
    const polesStats = [];
   
    for (const pole of poles.rows) {
      const poleStats = await Project.getStatsByPole(pole.id);
      polesStats.push({
        ...pole,
        total_projets: parseInt(poleStats.total_projets) || 0,
        cout_total: parseFloat(poleStats.cout_total) || 0,
        total_emplois: parseInt(poleStats.total_emplois) || 0,
        total_beneficiaires: parseInt(poleStats.total_beneficiaires) || 0
      });
    }

    const axesWithStats = await this.getAxesWithStats();
    const instructionStats = await this.getInstructionStats(req.user.id, req.user.profile_id);
    const recentProjects = await Project.findAll({ limit: 10 });
    const recentInstructions = await Instruction.findAll({
      emetteur_id: req.user.id,
      limit: 5
    });

    res.render('dashboard/gouverneur', {
      title: 'Tableau de bord - PDTI Safi',
      pageTitle: 'Tableau de bord',
      stats: stats,
      polesStats: polesStats,
      axesWithStats: axesWithStats,
      instructionStats: instructionStats,
      recentProjects: recentProjects || [],
      recentInstructions: recentInstructions || []
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du tableau de bord:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.'
    });
  }
};

// Route API : Récupérer les projets par axe - CORRECTION IMPORTANTE
exports.getProjectsByAxe = async (req, res) => {
  try {
    const axeId = parseInt(req.params.axeId);

    console.log('=== DEBUG getProjectsByAxe ===');
    console.log('1. Paramètre reçu:', req.params.axeId);
    console.log('2. axeId parsé:', axeId);
    console.log('3. Type de axeId:', typeof axeId);
    console.log('4. isNaN(axeId):', isNaN(axeId));

    if (!axeId || isNaN(axeId) || axeId < 1) {
      console.error('ID d\'axe invalide:', req.params.axeId);
      return res.status(400).json({
        success: false,
        message: 'ID d\'axe invalide',
        data: []
      });
    }

    console.log('5. Requête SQL pour l\'axe:', axeId);

    const projects = await db.query(`
      SELECT 
        p.id,
        p.num_projet,
        p.intitule,
        p.cout_total_mdh,
        p.nbr_emplois_directs,
        p.nbr_beneficiaires,
        p.annee_debut,
        p.annee_fin,
        p.axe_id,
        a.lib_axe,
        s.id as secteur_id,
        s.lib_secteur,
        po.id as pole_id,
        po.lib_pole
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN secteurs s ON p.secteur_id = s.id
      JOIN poles po ON a.pole_id = po.id
      WHERE p.axe_id = $1
      ORDER BY p.num_projet ASC
    `, [axeId]);

    console.log('6. Nombre de projets trouvés:', projects.rows.length);
    console.log('7. Projets:', projects.rows);

    res.json({
      success: true,
      data: projects.rows,
      count: projects.rows.length
    });

  } catch (error) {
    console.error('=== ERREUR getProjectsByAxe ===');
    console.error('Erreur complète:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des projets',
      error: error.message,
      data: []
    });
  }
};

// Récupérer les objectifs par axe
exports.getObjectifsByAxe = async (axeId) => {
  try {
    const result = await db.query(`
      SELECT id, nom_objectif, axe_id
      FROM objectifs
      WHERE axe_id = $1
      ORDER BY nom_objectif ASC
    `, [axeId]);
    
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des objectifs:', error);
    return [];
  }
};

// Tableau de bord coordinateur
exports.getCoordinateurDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const stats = await Project.getStatsByPole(req.user.pole_id);
    const projectsData = await this.getPaginatedProjectsByPole(req.user.pole_id, page);
    const pendingInstructions = await Instruction.findAll({
      destinataire_id: req.user.id,
      statut_id: 2
    });
    const pendingCount = await Instruction.getPendingCount(req.user.id);

    res.render('dashboard/coordinateur', {
      title: 'Tableau de bord coordinateur - PDTI Safi',
      pageTitle: 'Tableau de bord coordinateur',
      stats: {
        total_projets: parseInt(stats.total_projets) || 0,
        cout_total: parseFloat(stats.cout_total) || 0,
        total_emplois: parseInt(stats.total_emplois) || 0,
        total_beneficiaires: parseInt(stats.total_beneficiaires) || 0
      },
      projects: projectsData.projects,
      pagination: projectsData.pagination,
      pendingInstructions: pendingInstructions || [],
      pendingCount: pendingCount || 0
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du tableau de bord coordinateur:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.'
    });
  }
};

// Tableau de bord chef de pôle
exports.getChefPoleDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const stats = await Project.getStatsByPole(req.user.pole_id);
    const projectsData = await this.getPaginatedProjectsByPole(req.user.pole_id, page);

    res.render('dashboard/chefPole', {
      title: 'Tableau de bord chef de pôle - PDTI Safi',
      pageTitle: 'Tableau de bord chef de pôle',
      stats: {
        total_projets: parseInt(stats.total_projets) || 0,
        cout_total: parseFloat(stats.cout_total) || 0,
        total_emplois: parseInt(stats.total_emplois) || 0,
        total_beneficiaires: parseInt(stats.total_beneficiaires) || 0
      },
      projects: projectsData.projects,
      pagination: projectsData.pagination
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du tableau de bord chef de pôle:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.'
    });
  }
};
// controllers/dashboardController.js - COMPLET AVEC STATISTIQUES HIÉRARCHIQUES

const Project = require('../models/Project');
const Instruction = require('../models/Instruction');
const db = require('../config/database');

// ================================================================
// STATISTIQUES SIMPLES (existantes)
// ================================================================

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

    const montantTotalGlobal = axes.reduce((sum, axe) => sum + axe.cout_total, 0);

    return axes.map(axe => ({
      ...axe,
      pourcentage: montantTotalGlobal > 0 
        ? ((axe.cout_total / montantTotalGlobal) * 100).toFixed(2)
        : '0.00',
      montant_total_global: montantTotalGlobal
    }));

  } catch (error) {
    console.error('Erreur lors de la récupération des axes avec statistiques:', error);
    return [];
  }
};

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

// ================================================================
// NOUVELLES FONCTIONS POUR STATISTIQUES HIÉRARCHIQUES
// ================================================================
// ================================================================
// À REMPLACER DANS: controllers/dashboardController.js
// MÉTHODES ADAPTÉES POUR LA NOUVELLE FONCTION SQL
// ================================================================

/**
 * Récupère les statistiques hiérarchiques par Axe, Secteur et Objectif
 * Nouvelles colonnes retournées par get_stats_hierarchy_by_pole:
 * - level_type (TEXT)
 * - axe_id (INTEGER)
 * - axe_libelle (TEXT)
 * - secteur_id (INTEGER)
 * - secteur_libelle (TEXT)
 * - objectif_id (INTEGER)
 * - objectif_libelle (TEXT)
 * - nombre_projets (INTEGER)
 * - cout_total_mdh (NUMERIC)
 * - total_emplois_directs (BIGINT)
 * - total_beneficiaires (BIGINT)
 * - tri_order (INTEGER)
 */
exports.getHierarchicalStats = async (poleId) => {
  try {
    console.log(`[getHierarchicalStats] Récupération des stats pour pole_id=${poleId}`);
    
    const polesResult = await db.query(`SELECT lib_pole FROM poles WHERE id = $1`, [poleId]);
    const poleLibelle = polesResult.rows[0]?.lib_pole || '';
    
    const result = await db.query(`
      SELECT 
        level_type,
        axe_id,
        axe_libelle,
        secteur_id,
        secteur_libelle,
        objectif_id,
        objectif_libelle,
        nombre_projets,
        cout_total_mdh,
        total_emplois_directs,
        total_beneficiaires,
        tri_order
      FROM public.get_stats_hierarchy_by_pole($1)
      ORDER BY tri_order, axe_id, secteur_id
    `, [poleId]);
    
    // Ajouter le libellé du pôle à chaque ligne pour l'utiliser dans buildHierarchicalStructure
    result.rows = result.rows.map(row => ({...row, lib_pole: poleLibelle}));
    
    console.log(`[getHierarchicalStats] ${result.rows.length} lignes retournées`);
    return result.rows;
  } catch (error) {
    console.error('[getHierarchicalStats] Erreur:', error.message);
    return [];
  }
};

/**
 * Transforme les données brutes en structure hiérarchique arborescente
 * Adaptée aux nouvelles colonnes SQL
 */
function buildHierarchicalStructure(data) {
  try {
    const hierarchy = [];
    let currentAxe = null;
    let currentSecteur = null;
    
    // Filtrer uniquement les lignes de type OBJECTIF pour construire la hiérarchie
    const objectifRows = data.filter(row => row.level_type === 'OBJECTIF');
    
    console.log(`[buildHierarchicalStructure] Traitement de ${objectifRows.length} objectifs`);
    
    objectifRows.forEach(row => {
      // Créer un nouvel axe si différent du précédent
      if (!currentAxe || row.axe_id !== currentAxe.axe_id) {
        currentAxe = {
          axe_id: row.axe_id,
          axe_libelle: row.axe_libelle,
          pole_libelle: row.lib_pole,
          secteurs: [],
          stats: {
            nombre_projets: 0,
            cout_total_mdh: 0,
            total_emplois_directs: 0,
            total_beneficiaires: 0
          }
        };
        hierarchy.push(currentAxe);
        currentSecteur = null;
      }
      
      // Créer un nouveau secteur si différent du précédent
      if (row.secteur_id && (!currentSecteur || row.secteur_id !== currentSecteur.secteur_id)) {
        currentSecteur = {
          secteur_id: row.secteur_id,
          secteur_libelle: row.secteur_libelle,
          objectifs: [],
          stats: {
            nombre_projets: 0,
            cout_total_mdh: 0,
            total_emplois_directs: 0,
            total_beneficiaires: 0
          }
        };
        if (currentAxe) {
          currentAxe.secteurs.push(currentSecteur);
        }
      }
      
      // Ajouter l'objectif au secteur actuel
      if (currentSecteur) {
        currentSecteur.objectifs.push({
          objectif_id: row.objectif_id,
          objectif_libelle: row.objectif_libelle,
          nombre_projets: parseInt(row.nombre_projets || 0),
          cout_total_mdh: parseFloat(row.cout_total_mdh || 0),
          total_emplois_directs: parseInt(row.total_emplois_directs || 0),
          total_beneficiaires: parseInt(row.total_beneficiaires || 0)
        });
        
        // Mise à jour des stats du secteur
        currentSecteur.stats.nombre_projets += parseInt(row.nombre_projets || 0);
        currentSecteur.stats.cout_total_mdh += parseFloat(row.cout_total_mdh || 0);
        currentSecteur.stats.total_emplois_directs += parseInt(row.total_emplois_directs || 0);
        currentSecteur.stats.total_beneficiaires += parseInt(row.total_beneficiaires || 0);
      }
    });
    
    // Finaliser les stats des axes
    hierarchy.forEach(axe => {
      axe.secteurs.forEach(secteur => {
        axe.stats.nombre_projets += secteur.stats.nombre_projets;
        axe.stats.cout_total_mdh += secteur.stats.cout_total_mdh;
        axe.stats.total_emplois_directs += secteur.stats.total_emplois_directs;
        axe.stats.total_beneficiaires += secteur.stats.total_beneficiaires;
      });
    });
    
    console.log(`[buildHierarchicalStructure] Structure construite avec ${hierarchy.length} axes`);
    return hierarchy;
  } catch (error) {
    console.error('[buildHierarchicalStructure] Erreur:', error.message);
    return [];
  }
}

exports.buildHierarchicalStructure = buildHierarchicalStructure;

// ================================================================
// À AJOUTER/REMPLACER DANS: controllers/dashboardController.js
// MÉTHODES POUR LE PROFIL GOUVERNEUR
// Affiche ALL Axes avec statistiques globales
// ================================================================

/**
 * Récupère les statistiques hiérarchiques pour TOUS les pôles (Gouverneur)
 * @returns {Array} Données brutes de tous les axes
 */
exports.getHierarchicalStatsGlobal = async () => {
  try {
    console.log('[getHierarchicalStatsGlobal] Récupération des stats GLOBALES (tous les pôles)');
    
    const result = await db.query(`
      WITH stats_by_objectif AS (
        SELECT 
          a.id as axe_id,
          a.lib_axe as axe_libelle,
          a.pole_id,
          po.lib_pole as pole_libelle,
          s.id as secteur_id,
          s.lib_secteur as secteur_libelle,
          o.id as objectif_id,
          o.nom_objectif as objectif_libelle,
          COUNT(p.id) as nombre_projets,
          COALESCE(SUM(p.cout_total_mdh), 0)::NUMERIC as cout_total_mdh,
          COALESCE(SUM(p.nbr_emplois_directs), 0)::BIGINT as total_emplois_directs,
          COALESCE(SUM(p.nbr_beneficiaires), 0)::BIGINT as total_beneficiaires
        FROM axes a
        LEFT JOIN projets p ON p.axe_id = a.id
        LEFT JOIN secteurs s ON p.secteur_id = s.id
        LEFT JOIN objectifs o ON p.objectif_id = o.id
        LEFT JOIN poles po ON a.pole_id = po.id
        GROUP BY a.id, a.lib_axe, a.pole_id, po.lib_pole, s.id, s.lib_secteur, o.id, o.nom_objectif
      )
      SELECT 
        'OBJECTIF'::TEXT as level_type,
        axe_id,
        axe_libelle,
        pole_id,
        pole_libelle,
        secteur_id,
        secteur_libelle,
        objectif_id,
        objectif_libelle,
        nombre_projets,
        cout_total_mdh,
        total_emplois_directs,
        total_beneficiaires,
        ROW_NUMBER() OVER (ORDER BY axe_id, secteur_id, objectif_id)::INTEGER as tri_order
      FROM stats_by_objectif
      WHERE objectif_id IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'SOUS-TOTAL SECTEUR'::TEXT,
        a.id, a.lib_axe, a.pole_id, po.lib_pole,
        s.id, s.lib_secteur,
        NULL::INTEGER, 'SOUS-TOTAL SECTEUR'::TEXT,
        SUM(sbo.nombre_projets)::INTEGER,
        SUM(sbo.cout_total_mdh)::NUMERIC,
        SUM(sbo.total_emplois_directs)::BIGINT,
        SUM(sbo.total_beneficiaires)::BIGINT,
        (ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY s.id) * 1000 + 1)::INTEGER
      FROM stats_by_objectif sbo
      JOIN axes a ON sbo.axe_id = a.id
      JOIN poles po ON a.pole_id = po.id
      JOIN secteurs s ON sbo.secteur_id = s.id
      GROUP BY a.id, a.lib_axe, a.pole_id, po.lib_pole, s.id, s.lib_secteur
      
      UNION ALL
      
      SELECT 
        'SOUS-TOTAL AXE'::TEXT,
        a.id, a.lib_axe, a.pole_id, po.lib_pole,
        NULL::INTEGER, 'SOUS-TOTAL AXE'::TEXT,
        NULL::INTEGER, NULL::TEXT,
        SUM(sbo.nombre_projets)::INTEGER,
        SUM(sbo.cout_total_mdh)::NUMERIC,
        SUM(sbo.total_emplois_directs)::BIGINT,
        SUM(sbo.total_beneficiaires)::BIGINT,
        (ROW_NUMBER() OVER (ORDER BY a.id) * 10000 + 1)::INTEGER
      FROM stats_by_objectif sbo
      JOIN axes a ON sbo.axe_id = a.id
      JOIN poles po ON a.pole_id = po.id
      GROUP BY a.id, a.lib_axe, a.pole_id, po.lib_pole
      
      UNION ALL
      
      SELECT 
        'TOTAL GENERAL'::TEXT,
        NULL::INTEGER, 'TOTAL GÉNÉRAL'::TEXT, NULL::INTEGER, NULL::TEXT,
        NULL::INTEGER, NULL::TEXT,
        NULL::INTEGER, NULL::TEXT,
        SUM(sbo.nombre_projets)::INTEGER,
        SUM(sbo.cout_total_mdh)::NUMERIC,
        SUM(sbo.total_emplois_directs)::BIGINT,
        SUM(sbo.total_beneficiaires)::BIGINT,
        999999::INTEGER
      FROM stats_by_objectif sbo
      
      ORDER BY tri_order, axe_id, secteur_id
    `);
    
    console.log(`[getHierarchicalStatsGlobal] ${result.rows.length} lignes retournées`);
    return result.rows;
  } catch (error) {
    console.error('[getHierarchicalStatsGlobal] Erreur:', error.message);
    return [];
  }
};

/**
 * Transforme les données brutes en structure hiérarchique pour Gouverneur
 * Inclut les informations du pôle
 */
function buildGlobalHierarchicalStructure(data) {
  try {
    const hierarchy = [];
    const totalStats = {
      nombre_projets: 0,
      cout_total_mdh: 0,
      total_emplois_directs: 0,
      total_beneficiaires: 0
    };
    
    let currentAxe = null;
    let currentSecteur = null;
    
    // Filtrer uniquement les lignes de type OBJECTIF
    const objectifRows = data.filter(row => row.level_type === 'OBJECTIF');
    
    console.log(`[buildGlobalHierarchicalStructure] Traitement de ${objectifRows.length} objectifs`);
    
    objectifRows.forEach(row => {
      // Créer un nouvel axe si différent
      if (!currentAxe || row.axe_id !== currentAxe.axe_id) {
        currentAxe = {
          axe_id: row.axe_id,
          axe_libelle: row.axe_libelle,
          pole_id: row.pole_id,
          pole_libelle: row.pole_libelle,
          secteurs: [],
          stats: {
            nombre_projets: 0,
            cout_total_mdh: 0,
            total_emplois_directs: 0,
            total_beneficiaires: 0
          }
        };
        hierarchy.push(currentAxe);
        currentSecteur = null;
      }
      
      // Créer un nouveau secteur si différent
      if (row.secteur_id && (!currentSecteur || row.secteur_id !== currentSecteur.secteur_id)) {
        currentSecteur = {
          secteur_id: row.secteur_id,
          secteur_libelle: row.secteur_libelle,
          objectifs: [],
          stats: {
            nombre_projets: 0,
            cout_total_mdh: 0,
            total_emplois_directs: 0,
            total_beneficiaires: 0
          }
        };
        if (currentAxe) {
          currentAxe.secteurs.push(currentSecteur);
        }
      }
      
      // Ajouter l'objectif
      if (currentSecteur) {
        currentSecteur.objectifs.push({
          objectif_id: row.objectif_id,
          objectif_libelle: row.objectif_libelle,
          nombre_projets: parseInt(row.nombre_projets || 0),
          cout_total_mdh: parseFloat(row.cout_total_mdh || 0),
          total_emplois_directs: parseInt(row.total_emplois_directs || 0),
          total_beneficiaires: parseInt(row.total_beneficiaires || 0)
        });
        
        // Mettre à jour les stats du secteur
        currentSecteur.stats.nombre_projets += parseInt(row.nombre_projets || 0);
        currentSecteur.stats.cout_total_mdh += parseFloat(row.cout_total_mdh || 0);
        currentSecteur.stats.total_emplois_directs += parseInt(row.total_emplois_directs || 0);
        currentSecteur.stats.total_beneficiaires += parseInt(row.total_beneficiaires || 0);
      }
    });
    
    // Finaliser les stats des axes et globales
    hierarchy.forEach(axe => {
      axe.secteurs.forEach(secteur => {
        axe.stats.nombre_projets += secteur.stats.nombre_projets;
        axe.stats.cout_total_mdh += secteur.stats.cout_total_mdh;
        axe.stats.total_emplois_directs += secteur.stats.total_emplois_directs;
        axe.stats.total_beneficiaires += secteur.stats.total_beneficiaires;
      });
      
      // Ajouter aux totaux généraux
      totalStats.nombre_projets += axe.stats.nombre_projets;
      totalStats.cout_total_mdh += axe.stats.cout_total_mdh;
      totalStats.total_emplois_directs += axe.stats.total_emplois_directs;
      totalStats.total_beneficiaires += axe.stats.total_beneficiaires;
    });
    
    const result = {
      axes: hierarchy,
      totalStats: totalStats
    };
    
    console.log(`[buildGlobalHierarchicalStructure] ${hierarchy.length} axes construits`);
    return result;
  } catch (error) {
    console.error('[buildGlobalHierarchicalStructure] Erreur:', error.message);
    return { axes: [], totalStats: {} };
  }
}

exports.buildGlobalHierarchicalStructure = buildGlobalHierarchicalStructure;


// ================================================================
// TABLEAU DE BORD ADMINISTRATEUR
// ================================================================

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

// ================================================================
// TABLEAU DE BORD GOUVERNEUR - MODIFIÉ
// ================================================================

exports.getGouverneurDashboard = async (req, res) => {
  try {
    console.log('[getGouverneurDashboard] Accès par utilisateur:', req.user.email);
    
    const stats = await this.getStats();
    const poles = await db.query('SELECT * FROM poles ORDER BY id ASC');
    const polesStats = [];
   
    // Récupérer les stats par pôle
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
    
    // NOUVEAU: Récupérer les statistiques hiérarchiques GLOBALES (tous les axes)
    const hierarchicalStatsDataGlobal = await this.getHierarchicalStatsGlobal();
    const globalHierarchy = this.buildGlobalHierarchicalStructure(hierarchicalStatsDataGlobal);

    res.render('dashboard/gouverneur', {
      title: 'Tableau de bord - PDTI Safi',
      pageTitle: 'Tableau de bord Gouverneur',
      stats: stats,
      polesStats: polesStats,
      axesWithStats: axesWithStats,
      instructionStats: instructionStats,
      recentProjects: recentProjects || [],
      recentInstructions: recentInstructions || [],
      // NOUVEAU: Passer les données hiérarchiques globales
      globalHierarchy: globalHierarchy.axes,
      globalTotalStats: globalHierarchy.totalStats,
      globalHierarchyJSON: JSON.stringify(globalHierarchy.axes),
      globalTotalStatsJSON: JSON.stringify(globalHierarchy.totalStats)
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du tableau de bord gouverneur:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.'
    });
  }
};

// ================================================================
// TABLEAU DE BORD COORDINATEUR - MODIFIÉ
// ================================================================

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
    
    // Récupérer les statistiques hiérarchiques
    const hierarchicalStatsData = await this.getHierarchicalStats(req.user.pole_id);
    const hierarchicalStats = buildHierarchicalStructure(hierarchicalStatsData);

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
      pendingCount: pendingCount || 0,
      hierarchicalStats: hierarchicalStats,
      hierarchicalStatsJSON: JSON.stringify(hierarchicalStats)
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

// ================================================================
// TABLEAU DE BORD CHEF DE PÔLE - MODIFIÉ
// ================================================================

exports.getChefPoleDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const stats = await Project.getStatsByPole(req.user.pole_id);
    const projectsData = await this.getPaginatedProjectsByPole(req.user.pole_id, page);
    
    // Récupérer les statistiques hiérarchiques
    const hierarchicalStatsData = await this.getHierarchicalStats(req.user.pole_id);
    const hierarchicalStats = buildHierarchicalStructure(hierarchicalStatsData);

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
      pagination: projectsData.pagination,
      hierarchicalStats: hierarchicalStats,
      hierarchicalStatsJSON: JSON.stringify(hierarchicalStats)
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

// ================================================================
// ROUTE API : RÉCUPÉRER LES PROJETS PAR AXE
// ================================================================

exports.getProjectsByAxe = async (req, res) => {
  try {
    const axeId = parseInt(req.params.axeId);

    if (!axeId || isNaN(axeId) || axeId < 1) {
      return res.status(400).json({
        success: false,
        message: 'ID d\'axe invalide',
        data: []
      });
    }

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

    res.json({
      success: true,
      data: projects.rows,
      count: projects.rows.length
    });

  } catch (error) {
    console.error('ERREUR getProjectsByAxe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
      data: []
    });
  }
};

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
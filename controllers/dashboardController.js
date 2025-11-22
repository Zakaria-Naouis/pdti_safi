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
      ORDER BY p.num_projet, p.id
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
// PAGINATION POUR ADMIN AVEC FILTRAGE PAR AXE
// ================================================================

/**
 * Récupère les projets paginés pour l'administrateur avec filtre optionnel par axe
 * @param {number} page - Numéro de la page
 * @param {number} limit - Nombre d'éléments par page
 * @param {number|null} axeId - ID de l'axe pour filtrer (optionnel)
 */
exports.getPaginatedProjectsAdmin = async (page = 1, limit = 10, axeId = null) => {
  try {
    const offset = (page - 1) * limit;
    
    // Construction de la requête avec filtre optionnel
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;
    
    if (axeId && !isNaN(parseInt(axeId))) {
      whereClause = `WHERE p.axe_id = $${paramIndex}`;
      queryParams.push(parseInt(axeId));
      paramIndex++;
    }
    
    // Requête pour récupérer les projets
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
      ${whereClause}
      ORDER BY p.num_projet, p.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const projectsResult = await db.query(projectsQuery, queryParams);
    
    // Requête pour compter le total (avec le même filtre)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM projets p
      ${whereClause}
    `;
    
    const countParams = axeId && !isNaN(parseInt(axeId)) ? [parseInt(axeId)] : [];
    const countResult = await db.query(countQuery, countParams);
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
    console.error('Erreur lors de la pagination des projets admin:', error);
    return {
      projects: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        hasNext: false,
        hasPrev: false,
        limit: 10
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

// ================================================================
// TABLEAU DE BORD ADMINISTRATEUR - MODIFIÉ POUR FILTRAGE PAR AXE
// ================================================================

exports.getAdminDashboard = async (req, res) => {
  try {
    // ✅ AJOUT : Récupérer le paramètre axe de l'URL
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const axeId = req.query.axe ? parseInt(req.query.axe) : null;
    
    console.log('[getAdminDashboard] Page:', page, 'Axe:', axeId);
    
    // Récupérer les statistiques globales
    const stats = await this.getStats();
    
    // Récupérer les statistiques par pôle
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
    
    // Récupérer la liste des axes pour le filtre
    const axesResult = await db.query(`
      SELECT 
        a.id,
        a.lib_axe,
        a.pole_id,
        po.lib_pole,
        COUNT(p.id) as nb_projets
      FROM axes a
      JOIN poles po ON a.pole_id = po.id
      LEFT JOIN projets p ON a.id = p.axe_id
      LEFT JOIN objectifs o ON a.id = o.axe_id
      GROUP BY a.id, a.lib_axe, a.pole_id, po.lib_pole
      ORDER BY a.id ASC
    `);

    // ✅ MODIFICATION : Utiliser la nouvelle fonction de pagination avec filtrage
    const projectsData = await this.getPaginatedProjectsAdmin(page, limit, axeId);

    // ✅ NOUVEAU : Récupérer les statistiques hiérarchiques via la vue
    const hierarchicalStatsData = await this.getHierarchicalStatsFromView();
    const hierarchicalStats = buildHierarchicalStructureFromView(hierarchicalStatsData);
    
    // Enrichir hierarchicalStats avec les noms de pôles
    if (hierarchicalStats.axes && hierarchicalStats.axes.length > 0) {
      const axesWithPoles = await db.query(`
        SELECT a.id, a.lib_axe, a.pole_id, p.lib_pole 
        FROM axes a 
        JOIN poles p ON a.pole_id = p.id
      `);
      
      const axePoleMap = {};
      axesWithPoles.rows.forEach(a => {
        axePoleMap[a.id] = a.lib_pole;
      });
      
      hierarchicalStats.axes.forEach(axe => {
        axe.pole_libelle = axePoleMap[axe.axe_id] || 'Pôle inconnu';
      });
    }
    
    // S'assurer que les valeurs sont bien des nombres
    const globalTotalStats = {
      nombre_projets: parseInt(hierarchicalStats.totalStats.nombre_projets) || 0,
      cout_total_mdh: parseFloat(hierarchicalStats.totalStats.cout_total_mdh) || 0,
      total_emplois_directs: parseInt(hierarchicalStats.totalStats.total_emplois_directs) || 0,
      total_beneficiaires: parseInt(hierarchicalStats.totalStats.total_beneficiaires) || 0
    };

    res.render('dashboard/admin', {
      title: 'Tableau de bord administrateur - PDTI Safi',
      pageTitle: 'Tableau de bord administrateur',
      stats: stats,
      polesStats: polesStats,
      axes: axesResult.rows,
      projects: projectsData.projects,
      pagination: projectsData.pagination,
      currentAxeFilter: axeId,  // ✅ AJOUT : Passer le filtre actuel à la vue
      globalHierarchy: hierarchicalStats.axes,
      globalTotalStats: globalTotalStats,
      successMessage: req.query.success || null
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du tableau de bord administrateur:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.',
      error: error
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
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.',
      error: error
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
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.',
      error: error
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
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord.',
      error: error
    });
  }
};

// ================================================================
// ROUTE API : RÉCUPÉRER LES PROJETS PAR AXE
// ================================================================

exports.getProjectsByAxe = async (req, res) => {
  try {
    const axeId = req.params.axeId;
    const user = req.user;
    
    console.log(`[getProjectsByAxe] Axe ID: ${axeId}, User: ${user.email}, Profile: ${user.profile_id}, Code Cercle: ${user.code_cercle}`);
    
    let query;
    let params;
    
    // CORRECTION: Pour les profils Pacha (7) et Chef Cercle (8), filtrer par cercle
    if (user.profile_id === 7 || user.profile_id === 8) {
      if (!user.code_cercle) {
        return res.status(403).json({
          success: false,
          message: 'Votre compte n\'est pas associé à un cercle.'
        });
      }
      
      // Requête filtrée par axe ET cercle
      query = `
        SELECT DISTINCT
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
        AND p.id IN (
          SELECT DISTINCT pc.projet_id
          FROM projets_communes pc
          JOIN communes c ON pc.commune_id = c.id
          WHERE c.code_cercle = $2
        )
        ORDER BY p.num_projet ASC
      `;
      params = [axeId, user.code_cercle];
      
    } else {
      // Pour les autres profils, pas de filtre par cercle
      query = `
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
      `;
      params = [axeId];
    }
    
    const result = await db.query(query, params);
    
    console.log(`[getProjectsByAxe] ${result.rows.length} projets trouvés pour l'axe ${axeId}`);
    
    res.json({
      success: true,
      projects: result.rows
    });
    
  } catch (error) {
    console.error('[getProjectsByAxe] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des projets'
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


/**
 * Récupère les statistiques hiérarchiques via la vue v_statistiques_axes_secteurs_objectifs_totaux
 * @returns {Object} Données hiérarchiques structurées avec totaux
 */
exports.getHierarchicalStatsFromView = async () => {
  try {
    console.log('[getHierarchicalStatsFromView] Récupération des stats via la vue v_statistiques_axes_secteurs_objectifs_totaux');
    
    const result = await db.query(`
      SELECT * FROM public.v_statistiques_axes_secteurs_objectifs_totaux
      ORDER BY axe_id, secteur_id, objectif_id
    `);
    
    console.log(`[getHierarchicalStatsFromView] ${result.rows.length} lignes retournées`);
    return result.rows;
  } catch (error) {
    console.error('[getHierarchicalStatsFromView] Erreur:', error.message);
    return [];
  }
};

/**
 * Transforme les données de la vue en structure hiérarchique
 * @param {Array} data - Données brutes de la vue
 * @returns {Object} Structure hiérarchique avec totaux
 */
function buildHierarchicalStructureFromView(data) {
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
    
    // Filtrer uniquement les lignes avec objectif_id non null pour construire la hiérarchie
    const objectifRows = data.filter(row => row.objectif_id !== null);
    
    console.log(`[buildHierarchicalStructureFromView] Traitement de ${objectifRows.length} objectifs`);
    
    objectifRows.forEach(row => {
      // Créer un nouvel axe si différent
      if (!currentAxe || row.axe_id !== currentAxe.axe_id) {
        currentAxe = {
          axe_id: row.axe_id,
          axe_libelle: row.libelle_axe,
          pole_libelle: row.lib_pole || 'Pôle non spécifié',
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
          secteur_libelle: row.libelle_secteur,
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
          objectif_libelle: row.libelle_objectif,
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
    
    console.log(`[buildHierarchicalStructureFromView] ${hierarchy.length} axes construits`);
    return result;
  } catch (error) {
    console.error('[buildHierarchicalStructureFromView] Erreur:', error.message);
    return { axes: [], totalStats: {} };
  }
}

exports.buildHierarchicalStructureFromView = buildHierarchicalStructureFromView;

// *************================================================================
// ***********************************STATISTIQUES HIÉRARCHIQUES PAR PACHALIK (PACHA)
// *******************================================================================

/**
 * Récupère les statistiques hiérarchiques filtrées par pachalik (code_cercle)
 * CORRECTION: Utilise COUNT(DISTINCT p.id) pour éviter les doublons
 * @param {number} codeCercle - Code du cercle (entier) pour filtrer les données
 * @returns {Array} Données hiérarchiques structurées filtrées par pachalik
/**
 * Récupère les statistiques hiérarchiques filtrées par pachalik (code_cercle)
 * CORRECTION : Gère les projets sans secteur/objectif et corrige les agrégats
 * @param {number} codeCercle - Code du cercle (entier) pour filtrer les données
 * @returns {Array} Données hiérarchiques structurées filtrées par pachalik
 */
exports.getHierarchicalStatsByPachalik = async (codeCercle) => {
  try {
    console.log(`[getHierarchicalStatsByPachalik] Récupération des stats pour le cercle: ${codeCercle}`);
    
    const result = await db.query(`
      -- Sélectionner TOUS les projets du cercle
      WITH projets_du_cercle AS (
        SELECT DISTINCT 
          p.id,
          p.axe_id,
          p.secteur_id,
          p.objectif_id,
          p.cout_total_mdh,
          p.nbr_emplois_directs,
          p.nbr_beneficiaires
        FROM projets p
        JOIN projets_communes pc ON p.id = pc.projet_id
        JOIN communes c ON pc.commune_id = c.id
        WHERE c.code_cercle = $1
      )
      -- Agréger les données par niveau hiérarchique
      SELECT 
        a.id as axe_id,
        a.lib_axe as libelle_axe,
        po.lib_pole,
        s.id as secteur_id,
        s.lib_secteur as libelle_secteur,
        o.id as objectif_id,
        o.nom_objectif as libelle_objectif,
        COUNT(p.id) as nombre_projets,
        COALESCE(SUM(p.cout_total_mdh), 0) as cout_total_mdh,
        COALESCE(SUM(p.nbr_emplois_directs), 0) as total_emplois_directs,
        COALESCE(SUM(p.nbr_beneficiaires), 0) as total_beneficiaires
      FROM axes a
      LEFT JOIN projets_du_cercle p ON a.id = p.axe_id
      LEFT JOIN poles po ON a.pole_id = po.id
      LEFT JOIN secteurs s ON p.secteur_id = s.id
      LEFT JOIN objectifs o ON p.objectif_id = o.id
      GROUP BY a.id, a.lib_axe, po.lib_pole, s.id, s.lib_secteur, o.id, o.nom_objectif
      HAVING COUNT(p.id) > 0
      ORDER BY a.id, s.id NULLS FIRST, o.id NULLS FIRST
    `, [codeCercle]);
    
    console.log(`[getHierarchicalStatsByPachalik] ${result.rows.length} lignes retournées pour le cercle ${codeCercle}`);
    
    // Debug: Vérifier le comptage par axe
    const projetsByAxe = {};
    result.rows.forEach(row => {
      if (!projetsByAxe[row.axe_id]) {
        projetsByAxe[row.axe_id] = 0;
      }
      projetsByAxe[row.axe_id] += parseInt(row.nombre_projets);
    });
    
    console.log('[getHierarchicalStatsByPachalik] Projets par axe:', 
      Object.entries(projetsByAxe).map(([axe, count]) => `Axe ${axe}: ${count} projets`).join(', ')
    );
    
    return result.rows;
  } catch (error) {
    console.error('[getHierarchicalStatsByPachalik] Erreur:', error.message);
    console.error('[getHierarchicalStatsByPachalik] Stack:', error.stack);
    return [];
  }
};

/**
 * Récupère les informations du pachalik à partir du code_cercle
 * @param {number} codeCercle - Code du cercle (entier)
 * @returns {Object} Informations du pachalik
 */
exports.getPachalikInfo = async (codeCercle) => {
  try {
    console.log(`[getPachalikInfo] Recherche des infos pour code_cercle: ${codeCercle}`);
    
    // CORRECTION: Utiliser directement la table cercles
    const result = await db.query(`
      SELECT 
        code_cercle,
        nom_cercle_fr as nom_pachalik
      FROM cercles
      WHERE code_cercle = $1
      LIMIT 1
    `, [codeCercle]);
    
    if (result.rows.length > 0) {
      console.log(`[getPachalikInfo] Cercle trouvé:`, result.rows[0]);
      return result.rows[0];
    }
    
    console.log(`[getPachalikInfo] Aucun cercle trouvé avec code_cercle ${codeCercle}`);
    
    // Fallback si le cercle n'existe pas
    return {
      code_cercle: codeCercle,
      nom_pachalik: 'Cercle ' + codeCercle
    };
  } catch (error) {
    console.error('[getPachalikInfo] Erreur:', error.message);
    return {
      code_cercle: codeCercle,
      nom_pachalik: 'Cercle ' + codeCercle
    };
  }
};

/**
 * Récupère tous les projets d'un pachalik
 * @param {number} codeCercle - Code du cercle (entier)
 * @returns {Array} Liste des projets
 */
// ================================================================
// CORRECTION DE LA FONCTION getProjectsByPachalik
// À remplacer dans dashboardController.js (ligne ~1208)
// ================================================================

/**
 * Récupère tous les projets d'un pachalik - VERSION CORRIGÉE DÉFINITIVE
 * @param {number} codeCercle - Code du cercle (entier)
 * @returns {Array} Liste des projets (sans doublons)
 */
exports.getProjectsByPachalik = async (codeCercle) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.num_projet,
        p.intitule,
        p.cout_total_mdh,
        p.nbr_emplois_directs,
        p.nbr_beneficiaires,
        p.annee_debut,
        p.annee_fin,
        a.id as axe_id,
        a.lib_axe,
        s.id as secteur_id,
        s.lib_secteur,
        po.id as pole_id,
        po.lib_pole
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      -- CORRECTION : Utiliser LEFT JOIN pour inclure les projets sans secteur
      LEFT JOIN secteurs s ON p.secteur_id = s.id
      JOIN poles po ON a.pole_id = po.id
      WHERE p.id IN (
        SELECT DISTINCT pc.projet_id
        FROM projets_communes pc
        JOIN communes c ON pc.commune_id = c.id
        WHERE c.code_cercle = $1
      )
      ORDER BY a.id, p.num_projet
    `, [codeCercle]);
    
    console.log(`[getProjectsByPachalik] ${result.rows.length} projets trouvés pour le cercle ${codeCercle}`);
    
    // Debug par axe
    const projectsByAxe = {};
    result.rows.forEach(p => {
      if (!projectsByAxe[p.axe_id]) {
        projectsByAxe[p.axe_id] = [];
      }
      projectsByAxe[p.axe_id].push(p.num_projet);
    });
    console.log('[getProjectsByPachalik] Répartition par axe:', 
      Object.entries(projectsByAxe).map(([axeId, projets]) => 
        `Axe ${axeId}: ${projets.length} projets (${projets.join(', ')})`
      ).join(', ')
    );
    
    return result.rows;
  } catch (error) {
    console.error('[getProjectsByPachalik] Erreur:', error.message);
    return [];
  }
};

/**
 * Fonction de construction de la structure hiérarchique pour les stats par pachalik
 * VERSION CORRIGÉE : Gère les NULLs pour secteur et objectif
 */
function buildHierarchicalStructureByPachalik(data) {
  try {
    const hierarchy = [];
    const totalStats = {
      nombre_projets: 0,
      cout_total_mdh: 0,
      total_emplois_directs: 0,
      total_beneficiaires: 0
    };
    
    console.log(`[buildHierarchicalStructureByPachalik] Traitement de ${data.length} lignes de données brutes`);
    
    // Grouper les données par axe, secteur et objectif (gère les NULLs)
    const groupedData = {};
    
    data.forEach(row => {
      const axeKey = row.axe_id;
      // CORRECTION : Utiliser des clés uniques même pour les NULLs
      const secteurKey = row.secteur_id !== null ? `s_${row.secteur_id}` : 's_null';
      const objectifKey = row.objectif_id !== null ? `o_${row.objectif_id}` : 'o_null';
      
      if (!groupedData[axeKey]) {
        groupedData[axeKey] = {
          axe_id: row.axe_id,
          axe_libelle: row.libelle_axe,
          pole_libelle: row.lib_pole || 'Pôle non spécifié',
          secteurs: {}
        };
      }
      
      // CORRECTION : TOUJOURS créer le secteur (même si NULL)
      if (!groupedData[axeKey].secteurs[secteurKey]) {
        groupedData[axeKey].secteurs[secteurKey] = {
          secteur_id: row.secteur_id,
          // Nom par défaut si secteur NULL
          secteur_libelle: row.libelle_secteur || 'Secteur non défini',
          objectifs: {}
        };
      }
      
      // CORRECTION : TOUJOURS créer l'objectif (même si NULL)
      if (!groupedData[axeKey].secteurs[secteurKey].objectifs[objectifKey]) {
        groupedData[axeKey].secteurs[secteurKey].objectifs[objectifKey] = {
          objectif_id: row.objectif_id,
          // Nom par défaut si objectif NULL
          objectif_libelle: row.libelle_objectif || 'Objectif non défini',
          nombre_projets: 0,
          cout_total_mdh: 0,
          total_emplois_directs: 0,
          total_beneficiaires: 0
        };
      }
      
      // Accumuler les valeurs
      const target = groupedData[axeKey].secteurs[secteurKey].objectifs[objectifKey];
      target.nombre_projets += parseInt(row.nombre_projets || 0);
      target.cout_total_mdh += parseFloat(row.cout_total_mdh || 0);
      target.total_emplois_directs += parseInt(row.total_emplois_directs || 0);
      target.total_beneficiaires += parseInt(row.total_beneficiaires || 0);
    });
    
    // Construire la hiérarchie finale
    Object.values(groupedData).forEach(axeData => {
      const axe = {
        axe_id: axeData.axe_id,
        axe_libelle: axeData.axe_libelle,
        pole_libelle: axeData.pole_libelle,
        secteurs: [],
        stats: {
          nombre_projets: 0,
          cout_total_mdh: 0,
          total_emplois_directs: 0,
          total_beneficiaires: 0
        }
      };
      
      Object.values(axeData.secteurs).forEach(secteurData => {
        const secteur = {
          secteur_id: secteurData.secteur_id,
          secteur_libelle: secteurData.secteur_libelle,
          objectifs: Object.values(secteurData.objectifs), // Convertir en array
          stats: {
            nombre_projets: 0,
            cout_total_mdh: 0,
            total_emplois_directs: 0,
            total_beneficiaires: 0
          }
        };
        
        // Calculer les stats du secteur
        secteur.objectifs.forEach(obj => {
          secteur.stats.nombre_projets += obj.nombre_projets;
          secteur.stats.cout_total_mdh += obj.cout_total_mdh;
          secteur.stats.total_emplois_directs += obj.total_emplois_directs;
          secteur.stats.total_beneficiaires += obj.total_beneficiaires;
        });
        
        axe.secteurs.push(secteur);
        
        // Mettre à jour les stats de l'axe
        axe.stats.nombre_projets += secteur.stats.nombre_projets;
        axe.stats.cout_total_mdh += secteur.stats.cout_total_mdh;
        axe.stats.total_emplois_directs += secteur.stats.total_emplois_directs;
        axe.stats.total_beneficiaires += secteur.stats.total_beneficiaires;
      });
      
      hierarchy.push(axe);
      
      // Mettre à jour les totaux généraux
      totalStats.nombre_projets += axe.stats.nombre_projets;
      totalStats.cout_total_mdh += axe.stats.cout_total_mdh;
      totalStats.total_emplois_directs += axe.stats.total_emplois_directs;
      totalStats.total_beneficiaires += axe.stats.total_beneficiaires;
    });
    
    const result = {
      axes: hierarchy,
      totalStats: totalStats
    };
    
    console.log(`[buildHierarchicalStructureByPachalik] ${hierarchy.length} axes construits`);
    console.log(`[buildHierarchicalStructureByPachalik] Totaux: ${totalStats.nombre_projets} projets, ${totalStats.cout_total_mdh} MDH`);
    
    return result;
  } catch (error) {
    console.error('[buildHierarchicalStructureByPachalik] Erreur:', error.message);
    console.error('[buildHierarchicalStructureByPachalik] Stack:', error.stack);
    return { axes: [], totalStats: {} };
  }
}

// ================================================================
// TABLEAU DE BORD PACHA - VERSION FINALE
// ================================================================

exports.getPachaDashboard = async (req, res) => {
  try {
    console.log('[getPachaDashboard] ===== DÉBUT DU CHARGEMENT =====');
    console.log('[getPachaDashboard] Utilisateur:', {
      id: req.user.id,
      email: req.user.email,
      profile_id: req.user.profile_id,
      code_cercle: req.user.code_cercle
    });
    
    // Vérifier que l'utilisateur a un code_cercle
    if (!req.user.code_cercle) {
      console.error('[getPachaDashboard] ❌ Code cercle manquant pour l\'utilisateur:', req.user.email);
      return res.status(403).render('error', {
        title: 'Accès non autorisé',
        pageTitle: 'Erreur 403',
        message: 'Votre compte n\'est pas associé à un pachalik. Veuillez contacter l\'administrateur pour qu\'il vous attribue un code_cercle.',
        error: { status: 403 }
      });
    }
    
    const codeCercle = req.user.code_cercle;
    console.log(`[getPachaDashboard] ✓ Code cercle: ${codeCercle} (type: ${typeof codeCercle})`);
    
    // Récupérer les informations du pachalik
    console.log('[getPachaDashboard] Récupération des informations du pachalik...');
    const pachalikInfo = await this.getPachalikInfo(codeCercle);
    console.log('[getPachaDashboard] ✓ Informations du pachalik:', pachalikInfo);
    
    // Récupérer les statistiques hiérarchiques par pachalik
    console.log('[getPachaDashboard] Récupération des statistiques hiérarchiques...');
    const hierarchicalStatsData = await this.getHierarchicalStatsByPachalik(codeCercle);
    console.log(`[getPachaDashboard] ✓ Stats hiérarchiques: ${hierarchicalStatsData.length} lignes`);
    
    const hierarchicalStats = buildHierarchicalStructureByPachalik(hierarchicalStatsData);
    console.log(`[getPachaDashboard] ✓ Hiérarchie construite: ${hierarchicalStats.axes.length} axes`);
    
    // Récupérer tous les projets du pachalik
    console.log('[getPachaDashboard] Récupération des projets...');
    const axeProjects = await this.getProjectsByPachalik(codeCercle);
    console.log(`[getPachaDashboard] ✓ Projets récupérés: ${axeProjects.length} projets`);
    
    // Préparer les statistiques globales
    const stats = hierarchicalStats.totalStats || {
      total_projets: 0,
      cout_total: 0,
      total_emplois: 0,
      total_beneficiaires: 0
    };
    
    console.log('[getPachaDashboard] ✓ Statistiques globales:', stats);
    console.log('[getPachaDashboard] ===== RENDU DE LA VUE =====');
    
    res.render('dashboard/pacha', {
      title: `Tableau de bord Pacha - ${pachalikInfo.nom_pachalik} - PDTI Safi`,
      pageTitle: `Tableau de bord - ${pachalikInfo.nom_pachalik}`,
      pachalikInfo: pachalikInfo,
      stats: {
        total_projets: stats.nombre_projets || 0,
        cout_total: stats.cout_total_mdh || 0,
        total_emplois: stats.total_emplois_directs || 0,
        total_beneficiaires: stats.total_beneficiaires || 0
      },
      hierarchicalStats: hierarchicalStats,
      hierarchicalStatsJSON: JSON.stringify(hierarchicalStats),
      axeProjects: axeProjects
    });
    
    console.log('[getPachaDashboard] ===== TERMINÉ AVEC SUCCÈS =====');
  } catch (error) {
    console.error('[getPachaDashboard] ❌ ERREUR:', error);
    console.error('[getPachaDashboard] Stack:', error.stack);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du tableau de bord: ' + error.message,
      error: error
    });
  }
};
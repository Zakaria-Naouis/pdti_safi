// models/Project.js - Version modifiée avec support objectifs

const db = require('../config/database');

class Project {
  // Récupérer tous les projets avec filtres optionnels
  static async findAll(filters = {}) {
    let query = `
      SELECT p.*, a.lib_axe, s.lib_secteur, po.lib_pole, o.nom_objectif
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN secteurs s ON p.secteur_id = s.id
      JOIN poles po ON a.pole_id = po.id
      LEFT JOIN objectifs o ON p.objectif_id = o.id
    `;

    const params = [];
    const conditions = [];

    // Filtrer par pôle si spécifié
    if (filters.pole_id) {
      conditions.push(`po.id = $${params.length + 1}`);
      params.push(filters.pole_id);
    }

    // Filtrer par axe si spécifié
    if (filters.axe_id) {
      conditions.push(`p.axe_id = $${params.length + 1}`);
      params.push(filters.axe_id);
    }

    // Filtrer par secteur si spécifié
    if (filters.secteur_id) {
      conditions.push(`p.secteur_id = $${params.length + 1}`);
      params.push(filters.secteur_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.num_projet';

    const result = await db.query(query, params);
    return result.rows;
  }

  // Récupérer un projet avec tous les détails pour consultation
  static async findByIdWithDetails(id) {
    try {
      const result = await db.query(`
        SELECT 
          p.*,
          a.lib_axe,
          s.lib_secteur,
          po.lib_pole,
          sj.lib_statut as statut_juridique,
          moa.nom_moa,
          moe.nom_moe,
          gp.nom_gestionnaire,
          o.nom_objectif,
          o.id as objectif_id
        FROM projets p
        JOIN axes a ON p.axe_id = a.id
        JOIN secteurs s ON p.secteur_id = s.id
        JOIN poles po ON a.pole_id = po.id
        LEFT JOIN statuts_juridiques sj ON p.statut_juridique_id = sj.id
        LEFT JOIN moa ON p.moa_id = moa.id
        LEFT JOIN moe ON p.moe_id = moe.id
        LEFT JOIN gestionnaires_projets gp ON p.gestionnaire_projet_id = gp.id
        LEFT JOIN objectifs o ON p.objectif_id = o.id
        WHERE p.id = $1
      `, [id]);

      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la récupération des détails du projet:', error);
      throw error;
    }
  }

  // Récupérer les communes d'un projet avec leurs informations complètes
  static async getProjectCommunesWithDetails(projectId) {
    try {
      const result = await db.query(`
        SELECT 
          c.id,
          c.nom_fr,
          c.nom_ar,
          c.nbr_habitants,
          c.nbr_menage,
          cr.nom_cercle_fr,
          cd.libcaidat_fr
        FROM communes c
        JOIN projets_communes pc ON c.id = pc.commune_id
        LEFT JOIN cercles cr ON c.code_cercle = cr.code_cercle
        LEFT JOIN caidats cd ON c.code_caidat = cd.code_caidat
        WHERE pc.projet_id = $1
        ORDER BY c.nom_fr
      `, [projectId]);

      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des communes du projet:', error);
      throw error;
    }
  }

  // Récupérer les financements d'un projet
  static async getProjectFinancements(projectId) {
    try {
      const result = await db.query(`
        SELECT 
          fp.montant,
          p.nom_partenaire
        FROM financements_projets fp
        JOIN partenaires p ON fp.partenaire_id = p.id
        WHERE fp.projet_id = $1
        ORDER BY fp.montant DESC
      `, [projectId]);

      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des financements du projet:', error);
      throw error;
    }
  }

  // Calculer les indicateurs de performance d'un projet
  static async getProjectIndicators(projectId) {
    try {
      const project = await this.findByIdWithDetails(projectId);
      const communes = await this.getProjectCommunesWithDetails(projectId);
      
      if (!project) return null;

      const totalPopulation = communes.reduce((sum, commune) => sum + (commune.nbr_habitants || 0), 0);
      const totalMenages = communes.reduce((sum, commune) => sum + (commune.nbr_menage || 0), 0);
      
      const coutParBeneficiaire = project.nbr_beneficiaires > 0 ? 
        (project.cout_total_mdh / project.nbr_beneficiaires * 1000000) : 0;
      
      const coutParEmploi = project.nbr_emplois_directs > 0 ? 
        (project.cout_total_mdh / project.nbr_emplois_directs * 1000000) : 0;
      
      const today = new Date();
      const dateDebut = project.annee_debut ? new Date(project.annee_debut, 0, 1) : null;
      const dateFin = project.annee_fin ? new Date(project.annee_fin, 11, 31) : null;
      
      let statutTemporel = 'Non défini';
      let progressionTemporelle = 0;
      
      if (dateDebut && dateFin) {
        if (today < dateDebut) {
          statutTemporel = 'Pas encore commencé';
        } else if (today > dateFin) {
          statutTemporel = 'Terminé';
          progressionTemporelle = 100;
        } else {
          statutTemporel = 'En cours';
          const totalDuration = dateFin - dateDebut;
          const elapsedDuration = today - dateDebut;
          progressionTemporelle = Math.round((elapsedDuration / totalDuration) * 100);
        }
      }

      return {
        totalCommunes: communes.length,
        totalPopulation,
        totalMenages,
        coutParBeneficiaire: Math.round(coutParBeneficiaire),
        coutParEmploi: Math.round(coutParEmploi),
        statutTemporel,
        progressionTemporelle,
        densiteBeneficiaires: totalPopulation > 0 ? 
          Math.round((project.nbr_beneficiaires / totalPopulation) * 100) : 0
      };
    } catch (error) {
      console.error('Erreur lors du calcul des indicateurs du projet:', error);
      throw error;
    }
  }

  // Rechercher des projets similaires
  static async findSimilarProjects(projectId, limit = 5) {
    try {
      const project = await this.findById(projectId);
      if (!project) return [];

      const result = await db.query(`
        SELECT 
          p.*,
          a.lib_axe,
          s.lib_secteur,
          po.lib_pole,
          o.nom_objectif,
          CASE 
            WHEN p.objectif_id = $2 THEN 4
            WHEN p.axe_id = $3 THEN 3
            WHEN p.secteur_id = $4 THEN 2
            WHEN a.pole_id = (SELECT pole_id FROM axes WHERE id = $3) THEN 1
            ELSE 0
          END as similarity_score
        FROM projets p
        JOIN axes a ON p.axe_id = a.id
        JOIN secteurs s ON p.secteur_id = s.id
        JOIN poles po ON a.pole_id = po.id
        LEFT JOIN objectifs o ON p.objectif_id = o.id
        WHERE p.id != $1
        ORDER BY similarity_score DESC, ABS(p.cout_total_mdh - $5) ASC
        LIMIT $6
      `, [projectId, project.objectif_id, project.axe_id, project.secteur_id, project.cout_total_mdh || 0, limit]);

      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la recherche de projets similaires:', error);
      throw error;
    }
  }

  // Récupérer un projet par son ID
  static async findById(id) {
    const result = await db.query('SELECT * FROM projets WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Créer un nouveau projet
  static async create(projectData) {
    const {
      num_projet, intitule, objectifs, composantes, superficie_lineaire,
      cout_total_mdh, detail_cout, nbr_emplois_directs, detail_nbr_emploi,
      nbr_beneficiaires, detail_nbr_beneficiaires, duree_mois, echeancier,
      annee_debut, annee_fin, fc_disponibilite, fc_visibilite,
      statut_juridique_id, fc_assiette_assine, etude, etude_etat,
      axe_id, secteur_id, moa_id, moe_id, gestionnaire_projet_id, objectif_id
    } = projectData;

    const result = await db.query(
      `INSERT INTO projets (
        num_projet, intitule, objectifs, composantes, superficie_lineaire,
        cout_total_mdh, detail_cout, nbr_emplois_directs, detail_nbr_emploi,
        nbr_beneficiaires, detail_nbr_beneficiaires, duree_mois, echeancier,
        annee_debut, annee_fin, fc_disponibilite, fc_visibilite,
        statut_juridique_id, fc_assiette_assine, etude, etude_etat,
        axe_id, secteur_id, moa_id, moe_id, gestionnaire_projet_id, objectif_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) RETURNING *`,
      [
        num_projet, intitule, objectifs, composantes, superficie_lineaire,
        cout_total_mdh, detail_cout, nbr_emplois_directs, detail_nbr_emploi,
        nbr_beneficiaires, detail_nbr_beneficiaires, duree_mois, echeancier,
        annee_debut, annee_fin, fc_disponibilite, fc_visibilite,
        statut_juridique_id, fc_assiette_assine, etude, etude_etat,
        axe_id, secteur_id, moa_id, moe_id, gestionnaire_projet_id, objectif_id
      ]
    );

    return result.rows[0];
  }

  // Mettre à jour un projet
  static async update(id, projectData) {
    const {
      num_projet, intitule, objectifs, composantes, superficie_lineaire,
      cout_total_mdh, detail_cout, nbr_emplois_directs, detail_nbr_emploi,
      nbr_beneficiaires, detail_nbr_beneficiaires, duree_mois, echeancier,
      annee_debut, annee_fin, fc_disponibilite, fc_visibilite,
      statut_juridique_id, fc_assiette_assine, etude, etude_etat,
      axe_id, secteur_id, moa_id, moe_id, gestionnaire_projet_id, objectif_id
    } = projectData;

    const result = await db.query(
      `UPDATE projets SET
        num_projet = $1, intitule = $2, objectifs = $3, composantes = $4,
        superficie_lineaire = $5, cout_total_mdh = $6, detail_cout = $7,
        nbr_emplois_directs = $8, detail_nbr_emploi = $9,
        nbr_beneficiaires = $10, detail_nbr_beneficiaires = $11,
        duree_mois = $12, echeancier = $13, annee_debut = $14, annee_fin = $15,
        fc_disponibilite = $16, fc_visibilite = $17, statut_juridique_id = $18,
        fc_assiette_assine = $19, etude = $20, etude_etat = $21,
        axe_id = $22, secteur_id = $23, moa_id = $24, moe_id = $25,
        gestionnaire_projet_id = $26, objectif_id = $27
      WHERE id = $28 RETURNING *`,
      [
        num_projet, intitule, objectifs, composantes, superficie_lineaire,
        cout_total_mdh, detail_cout, nbr_emplois_directs, detail_nbr_emploi,
        nbr_beneficiaires, detail_nbr_beneficiaires, duree_mois, echeancier,
        annee_debut, annee_fin, fc_disponibilite, fc_visibilite,
        statut_juridique_id, fc_assiette_assine, etude, etude_etat,
        axe_id, secteur_id, moa_id, moe_id, gestionnaire_projet_id, objectif_id, id
      ]
    );

    return result.rows[0];
  }

  // Supprimer un projet
  static async delete(id) {
    const result = await db.query('DELETE FROM projets WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  // Récupérer les statistiques globales
  static async getStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_projets,
        COALESCE(SUM(cout_total_mdh), 0) as cout_total,
        COALESCE(SUM(nbr_emplois_directs), 0) as total_emplois,
        COALESCE(SUM(nbr_beneficiaires), 0) as total_beneficiaires
      FROM projets
    `);

    return result.rows[0];
  }

  // Récupérer les statistiques par pôle
  static async getStatsByPole(poleId) {
    const result = await db.query(`
      SELECT
        COUNT(p.id) as total_projets,
        COALESCE(SUM(p.cout_total_mdh), 0) as cout_total,
        COALESCE(SUM(p.nbr_emplois_directs), 0) as total_emplois,
        COALESCE(SUM(p.nbr_beneficiaires), 0) as total_beneficiaires
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      WHERE a.pole_id = $1
    `, [poleId]);

    return result.rows[0];
  }

  // NOUVELLE MÉTHODE: Récupérer les statistiques par objectif
  static async getStatsByObjectif(objectifId) {
    try {
      const result = await db.query(`
        SELECT
          COUNT(p.id) as total_projets,
          COALESCE(SUM(p.cout_total_mdh), 0) as cout_total,
          COALESCE(SUM(p.nbr_emplois_directs), 0) as total_emplois,
          COALESCE(SUM(p.nbr_beneficiaires), 0) as total_beneficiaires,
          o.nom_objectif,
          o.axe_id,
          a.lib_axe
        FROM projets p
        JOIN objectifs o ON p.objectif_id = o.id
        JOIN axes a ON o.axe_id = a.id
        WHERE p.objectif_id = $1
        GROUP BY o.id, o.nom_objectif, o.axe_id, a.lib_axe
      `, [objectifId]);

      return result.rows[0] || {
        total_projets: 0,
        cout_total: 0,
        total_emplois: 0,
        total_beneficiaires: 0
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des stats par objectif:', error);
      throw error;
    }
  }

  // NOUVELLE MÉTHODE: Récupérer tous les projets par objectif
  static async findByObjectif(objectifId) {
    try {
      const result = await db.query(`
        SELECT 
          p.*,
          a.lib_axe,
          s.lib_secteur,
          po.lib_pole,
          o.nom_objectif
        FROM projets p
        JOIN axes a ON p.axe_id = a.id
        JOIN secteurs s ON p.secteur_id = s.id
        JOIN poles po ON a.pole_id = po.id
        JOIN objectifs o ON p.objectif_id = o.id
        WHERE p.objectif_id = $1
        ORDER BY p.num_projet ASC
      `, [objectifId]);

      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des projets par objectif:', error);
      throw error;
    }
  }

  // Récupérer les communes associées à un projet
  static async getProjectCommunes(projectId) {
    const result = await db.query(`
      SELECT c.* FROM communes c
      JOIN projets_communes pc ON c.id = pc.commune_id
      WHERE pc.projet_id = $1
    `, [projectId]);

    return result.rows;
  }

  // Mettre à jour les communes associées à un projet
  static async updateProjectCommunes(projectId, communeIds) {
    // Supprimer toutes les associations existantes
    await db.query('DELETE FROM projets_communes WHERE projet_id = $1', [projectId]);
    
    // Ajouter les nouvelles associations
    if (communeIds && communeIds.length > 0) {
      const values = communeIds.map((id, index) => `($1, $${index + 2})`).join(',');
      await db.query(`
        INSERT INTO projets_communes (projet_id, commune_id)
        VALUES ${values}
      `, [projectId, ...communeIds]);
    }
  }

  // NOUVELLE MÉTHODE: Récupérer tous les objectifs
  static async getAllObjectifs() {
    try {
      const result = await db.query(`
        SELECT 
          o.id,
          o.nom_objectif,
          o.axe_id,
          a.lib_axe,
          COUNT(p.id) as nb_projets
        FROM objectifs o
        JOIN axes a ON o.axe_id = a.id
        LEFT JOIN projets p ON o.id = p.objectif_id
        GROUP BY o.id, o.nom_objectif, o.axe_id, a.lib_axe
        ORDER BY a.lib_axe, o.nom_objectif
      `);

      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des objectifs:', error);
      throw error;
    }
  }

  // NOUVELLE MÉTHODE: Récupérer les objectifs par axe
  static async getObjectifsByAxe(axeId) {
    try {
      const result = await db.query(`
        SELECT 
          o.id,
          o.nom_objectif,
          o.axe_id,
          COUNT(p.id) as nb_projets
        FROM objectifs o
        LEFT JOIN projets p ON o.id = p.objectif_id
        WHERE o.axe_id = $1
        GROUP BY o.id, o.nom_objectif, o.axe_id
        ORDER BY o.nom_objectif
      `, [axeId]);

      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des objectifs par axe:', error);
      throw error;
    }
  }
}

module.exports = Project;
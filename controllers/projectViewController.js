// =============================================
// CONTRÔLEUR CORRIGÉ : controllers/projectViewController.js
// Gère les profils Pacha (7) et Chef Cercle (8)
// =============================================

const Project = require('../models/Project');
const db = require('../config/database');

class ProjectViewController {
  
  /**
   * CORRECTION 2 : Récupérer tous les projets d'un axe spécifique
   * Filtre par cercle pour les profils 7 et 8
   */
  static async getProjectsByAxe(axeId, userId, profileId, codeCercle) {
    try {
      let query;
      let params;
      
      // CORRECTION: Pour les profils Pacha (7) et Chef Cercle (8), filtrer par cercle
      if ((profileId === 7 || profileId === 8) && codeCercle) {
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
        params = [axeId, codeCercle];
        
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
      return result.rows;
      
    } catch (error) {
      console.error('Erreur lors de la récupération des projets par axe:', error);
      return [];
    }
  }

  /**
   * CORRECTION 2 & 3 : Afficher la page de consultation détaillée d'un projet
   * Gère le retour au dashboard pacha pour les profils 7 et 8
   * Filtre les projets de l'axe par cercle pour ces profils
   */
  static async getProjectDetails(req, res) {
    try {
      const projectId = req.params.id;
      const user = req.user;
      
      // Validation de l'ID
      if (!projectId || isNaN(projectId)) {
        return res.status(400).render('error', {
          title: 'Requête invalide',
          pageTitle: 'Erreur 400',
          message: 'ID de projet invalide.',
          error: { status: 400, stack: '' },
          layout: 'layout'
        });
      }

      // Récupérer les détails complets du projet
      const project = await Project.findByIdWithDetails(projectId);
      
      if (!project) {
        return res.status(404).render('error', {
          title: 'Projet non trouvé',
          pageTitle: 'Erreur 404',
          message: 'Le projet demandé n\'existe pas.',
          error: { status: 404, stack: '' },
          layout: 'layout'
        });
      }

      // Récupérer les communes associées
      const communes = await Project.getProjectCommunesWithDetails(projectId);
      
      // Récupérer les financements
      const financements = await Project.getProjectFinancements(projectId);
      
      // Calculer les indicateurs de performance
      const indicators = await Project.getProjectIndicators(projectId);
      
      // CORRECTION 3: Récupérer tous les projets de l'axe (filtrés par cercle si profil 7 ou 8)
      const axeProjects = await ProjectViewController.getProjectsByAxe(
        project.axe_id,
        user.id,
        user.profile_id,
        user.code_cercle
      );

      // Formatage des données pour l'affichage
      const formattedProject = {
        ...project,
        cout_total_formatted: project.cout_total_mdh ? 
          parseFloat(project.cout_total_mdh).toLocaleString('fr-FR') : '0',
        nbr_emplois_formatted: project.nbr_emplois_directs ? 
          parseInt(project.nbr_emplois_directs).toLocaleString('fr-FR') : '0',
        nbr_beneficiaires_formatted: project.nbr_beneficiaires ? 
          parseInt(project.nbr_beneficiaires).toLocaleString('fr-FR') : '0',
        duree_formatted: project.duree_mois ? 
          `${project.duree_mois} mois${project.duree_mois > 1 ? '' : ''}` : 'Non définie',
        periode_formatted: ProjectViewController.formatPeriod(project.annee_debut, project.annee_fin)
      };

      // CORRECTION 2: Déterminer la route de retour selon le profil
      let returnToDashboard = '/dashboard';
      if (user.profile_id === 7 || user.profile_id === 8) {
        returnToDashboard = '/dashboard/pacha';
      } else if (user.profile_id === 1) {
        returnToDashboard = '/dashboard/admin';
      } else if (user.profile_id === 2 || user.profile_id === 3) {
        returnToDashboard = '/dashboard/gouverneur';
      } else if (user.profile_id === 4) {
        returnToDashboard = '/dashboard/coordinateur';
      } else if (user.profile_id === 5) {
        returnToDashboard = '/dashboard/chefPole';
      }

      res.render('projects/view', {
        title: `Projet ${project.num_projet} - PDTI Safi`,
        pageTitle: `Détails du projet ${project.num_projet}`,
        project: formattedProject,
        communes: communes,
        financements: financements,
        indicators: indicators,
        axeProjects: axeProjects,
        returnToDashboard: returnToDashboard, // CORRECTION 2: URL de retour selon le profil
        userProfile: user.profile_id // AJOUT: Passer le profil utilisateur à la vue
      });

    } catch (error) {
      console.error('Erreur lors de la consultation du projet:', error);
      res.status(500).render('error', {
        title: 'Erreur',
        pageTitle: 'Erreur 500',
        message: 'Une erreur est survenue lors de la consultation du projet.',
        error: error,
        layout: 'layout'
      });
    }
  }

  /**
   * API pour récupérer les détails d'un projet en JSON
   */
  static async getProjectDetailsAPI(req, res) {
    try {
      const projectId = req.params.id;
      
      if (!projectId || isNaN(projectId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de projet invalide'
        });
      }

      const project = await Project.findByIdWithDetails(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé'
        });
      }

      const communes = await Project.getProjectCommunesWithDetails(projectId);
      const financements = await Project.getProjectFinancements(projectId);
      const indicators = await Project.getProjectIndicators(projectId);

      res.json({
        success: true,
        data: {
          project,
          communes,
          financements,
          indicators
        }
      });

    } catch (error) {
      console.error('Erreur API détails projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des détails du projet'
      });
    }
  }

  /**
   * Formater la période d'un projet
   */
  static formatPeriod(anneeDebut, anneeFin) {
    if (!anneeDebut && !anneeFin) {
      return 'Période non définie';
    }
    
    if (anneeDebut && anneeFin) {
      if (anneeDebut === anneeFin) {
        return `Année ${anneeDebut}`;
      }
      return `${anneeDebut} - ${anneeFin}`;
    }
    
    if (anneeDebut) {
      return `Depuis ${anneeDebut}`;
    }
    
    return `Jusqu'en ${anneeFin}`;
  }

  /**
   * Exporter les détails d'un projet en PDF (future fonctionnalité)
   */
  static async exportProjectToPDF(req, res) {
    try {
      const projectId = req.params.id;
      
      // TODO: Implémenter l'export PDF
      res.status(501).json({
        success: false,
        message: 'Fonctionnalité d\'export PDF à implémenter'
      });

    } catch (error) {
      console.error('Erreur export PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export PDF'
      });
    }
  }
}

module.exports = ProjectViewController;

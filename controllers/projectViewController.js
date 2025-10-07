// =============================================
// NOUVEAU CONTRÔLEUR : controllers/projectViewController.js
// =============================================

const Project = require('../models/Project');

class ProjectViewController {
  
  /**
   * Afficher la page de consultation détaillée d'un projet
   */
  static async getProjectDetails(req, res) {
    try {
      const projectId = req.params.id;
      
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
      
      // Récupérer les projets similaires
      const similarProjects = await Project.findSimilarProjects(projectId);

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

      res.render('projects/view', {
        title: `Projet ${project.num_projet} - PDTI Safi`,
        pageTitle: `Détails du projet ${project.num_projet}`,
        project: formattedProject,
        communes: communes,
        financements: financements,
        indicators: indicators,
        similarProjects: similarProjects
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




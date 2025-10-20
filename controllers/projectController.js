// controllers/projectController.js - Version corrigée avec validation d'unicité conditionnelle

const Project = require('../models/Project');
const { validationResult, body } = require('express-validator');
const db = require('../config/database');

// Règles de validation personnalisées pour les projets
const projectValidationRules = () => {
  return [
    // Validation du numéro de projet
    body('num_projet')
      .notEmpty()
      .withMessage('Le numéro de projet est obligatoire')
      .isInt({ min: 1, max: 99999 })
      .withMessage('Le numéro de projet doit être un entier entre 1 et 99999'),

    // Validation de l'intitulé
    body('intitule')
      .notEmpty()
      .withMessage('L\'intitulé du projet est obligatoire')
      .isLength({ min: 10, max: 500 })
      .withMessage('L\'intitulé doit contenir entre 10 et 500 caractères')
      .trim(),

    // Validation des champs optionnels avec limites
    body('objectifs')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 1000 })
      .withMessage('Les objectifs ne peuvent pas dépasser 1000 caractères')
      .trim(),

    body('composantes')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 1000 })
      .withMessage('Les composantes ne peuvent pas dépasser 1000 caractères')
      .trim(),

    // Validation des champs numériques
    body('cout_total_mdh')
      .optional({ nullable: true, checkFalsy: true })
      .isFloat({ min: 0, max: 999999.99 })
      .withMessage('Le coût total doit être un nombre positif inférieur à 1 000 000 MDH'),

    body('nbr_emplois_directs')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 0, max: 999999 })
      .withMessage('Le nombre d\'emplois directs doit être un entier positif'),

    body('nbr_beneficiaires')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 0, max: 9999999 })
      .withMessage('Le nombre de bénéficiaires doit être un entier positif'),

    body('duree_mois')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1, max: 1200 })
      .withMessage('La durée doit être comprise entre 1 et 1200 mois'),

    // Validation des années
    body('annee_debut')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 2020, max: 2050 })
      .withMessage('L\'année de début doit être comprise entre 2020 et 2050'),

    body('annee_fin')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 2020, max: 2050 })
      .withMessage('L\'année de fin doit être comprise entre 2020 et 2050')
      .custom((value, { req }) => {
        if (value && req.body.annee_debut && parseInt(value) < parseInt(req.body.annee_debut)) {
          throw new Error('L\'année de fin doit être supérieure ou égale à l\'année de début');
        }
        return true;
      }),

    // Validation des champs obligatoires de localisation
    body('axe_id')
      .notEmpty()
      .withMessage('L\'axe est obligatoire')
      .isInt({ min: 1 })
      .withMessage('Veuillez sélectionner un axe valide'),

    body('secteur_id')
      .notEmpty()
      .withMessage('Le secteur est obligatoire')
      .isInt({ min: 1 })
      .withMessage('Veuillez sélectionner un secteur valide'),

    // Validation des champs de texte avec limites - CORRIGÉ: .escape() retiré
    body('detail_cout')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 1000 })
      .withMessage('Le détail du coût ne peut pas dépasser 1000 caractères')
      .trim(),

    body('detail_nbr_emploi')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 500 })
      .withMessage('Le détail des emplois ne peut pas dépasser 500 caractères')
      .trim(),

    body('detail_nbr_beneficiaires')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 500 })
      .withMessage('Le détail des bénéficiaires ne peut pas dépasser 500 caractères')
      .trim(),

    body('superficie_lineaire')
      .optional({ nullable: true, checkFalsy: true })
      .customSanitizer(value => {
        // Nettoyer et convertir les valeurs vides en null
        if (!value || value.trim() === '') return null;
        return value.trim();
      })
      .isLength({ max: 100 })
      .withMessage('La superficie/linéaire ne peut pas dépasser 100 caractères'),

    body('echeancier')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 100 })
      .withMessage('L\'échéancier ne peut pas dépasser 100 caractères')
      .trim(),

    // Validation conditionnelle pour l'état d'étude
    body('etude_etat')
      .optional({ nullable: true, checkFalsy: true })
      .isIn(['', 'APS', 'APD', 'DE'])
      .withMessage('L\'état d\'étude doit être APS, APD ou DE')
      .custom((value, { req }) => {
        if (value && !req.body.etude) {
          throw new Error('L\'état d\'étude ne peut être défini que si l\'étude est marquée comme réalisée');
        }
        return true;
      }),

    // MODIFICATION: Les IDs optionnels ne sont plus obligatoires
    body('statut_juridique_id')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('Veuillez sélectionner un statut juridique valide'),

    body('moa_id')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('Veuillez sélectionner un MOA valide'),

    body('moe_id')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('Veuillez sélectionner un MOE valide'),

    body('gestionnaire_projet_id')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('Veuillez sélectionner un gestionnaire valide'),

    // Validation des communes
    body('communes')
      .optional({ nullable: true })
      .custom((value, { req }) => {
        if (!value) return true;
        
        const communes = Array.isArray(value) ? value : [value];
        
        for (const communeId of communes) {
          if (!communeId || isNaN(parseInt(communeId))) {
            throw new Error('Communes sélectionnées non valides');
          }
        }
        return true;
      })
  ];
};

/* NOUVELLE FONCTION: Vérification d'unicité du numéro de projet
async function checkProjectNumberUniqueness(numProjet, projectId = null) {
  try {
    let query = 'SELECT id FROM projets WHERE num_projet = $1';
    let params = [numProjet];
    
    // Si c'est une modification, exclure le projet actuel
    if (projectId) {
      query += ' AND id != $2';
      params.push(projectId);
    }
    
    const result = await db.query(query, params);
    return result.rows.length === 0; // Retourne true si le numéro est unique
  } catch (error) {
    console.error('Erreur lors de la vérification d\'unicité:', error);
    return false;
  }
}*/

// Liste des projets (inchangée)
exports.getProjects = async (req, res) => {
  try {
    const filters = {};
   
    if (req.user.profile_id === 4 || req.user.profile_id === 5) {
      filters.pole_id = req.user.pole_id;
    }

    const projects = await Project.findAll(filters);
   
    res.render('projects/list', {
      title: 'Projets - PDTI Safi',
      pageTitle: 'Liste des projets',
      projects: projects
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des projets:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de la récupération des projets.',
      error: error,
      layout: 'layout'
    });
  }
};

// Formulaire d'ajout de projet (modifié pour inclure les objectifs ET le pôle)
exports.getAddProject = async (req, res) => {
  try {
    let axesQuery = 'SELECT * FROM axes ORDER BY lib_axe ASC';
    let axesParams = [];
   
    if (req.user.profile_id === 4 || req.user.profile_id === 5) {
      axesQuery = 'SELECT * FROM axes WHERE pole_id = $1 ORDER BY lib_axe ASC';
      axesParams = [req.user.pole_id];
    }

    // MODIFICATION: Ajout de la récupération des objectifs ET du pôle
    const queries = [
      db.query(axesQuery, axesParams),
      db.query('SELECT * FROM secteurs ORDER BY lib_secteur ASC'),
      db.query('SELECT * FROM moa ORDER BY nom_moa ASC'),
      db.query('SELECT * FROM moe ORDER BY nom_moe ASC'),
      db.query('SELECT * FROM gestionnaires_projets ORDER BY nom_gestionnaire ASC'),
      db.query('SELECT * FROM statuts_juridiques ORDER BY lib_statut ASC'),
      db.query('SELECT * FROM communes ORDER BY nom_fr ASC'),
      db.query('SELECT id, nom_objectif, axe_id FROM objectifs ORDER BY axe_id, nom_objectif ASC')
    ];

    // NOUVEAU: Ajouter la requête du pôle si l'utilisateur est coordinateur ou chef de pôle
    if (req.user.profile_id === 4 || req.user.profile_id === 5) {
      queries.push(
        db.query('SELECT id, lib_pole FROM poles WHERE id = $1', [req.user.pole_id])
      );
    }

    const results = await Promise.all(queries);

    const [axes, secteurs, moas, moes, gestionnaires, statuts, communes, objectifs] = results;
    
    // NOUVEAU: Récupérer les informations du pôle si disponibles
    const poleInfo = (req.user.profile_id === 4 || req.user.profile_id === 5) && results[8] 
      ? results[8].rows[0] 
      : null;

    let backUrl = '/projects';
    if (req.user.profile_id === 4) {
      backUrl = '/dashboard/coordinateur';
    } else if (req.user.profile_id === 5) {
      backUrl = '/dashboard/chefPole';
    }

    res.render('projects/add', {
      title: 'Ajouter un projet - PDTI Safi',
      pageTitle: 'Ajouter un nouveau projet',
      axes: axes.rows,
      secteurs: secteurs.rows,
      moas: moas.rows,
      moes: moes.rows,
      gestionnaires: gestionnaires.rows,
      statuts: statuts.rows,
      communes: communes.rows,
      objectifs: objectifs.rows,
      poleInfo: poleInfo, // NOUVEAU: Passer les infos du pôle à la vue
      errors: [],
      backUrl: backUrl,
      project: null,
      user: req.user,
      app_name: process.env.APP_NAME || 'PDTI Safi',
      company_name: process.env.COMPANY_NAME || 'Province de Safi'
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire d\'ajout:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du formulaire.',
      error: error,
      layout: 'layout'
    });
  }
};

// MODIFICATION: Ajouter un projet avec vérification d'unicité
exports.postAddProject = [
  ...projectValidationRules(),
 
  async (req, res) => {
    const errors = validationResult(req);
    let customErrors = [];

    /* Vérification d'unicité du numéro de projet pour l'ajout
    if (req.body.num_projet) {
      const isUnique = await checkProjectNumberUniqueness(req.body.num_projet);
      if (!isUnique) {
        customErrors.push({
          param: 'num_projet',
          msg: 'Ce numéro de projet existe déjà',
          value: req.body.num_projet
        });
      }
    }*/

    // Combiner les erreurs de validation et les erreurs personnalisées
    const allErrors = errors.isEmpty() ? customErrors : [...errors.array(), ...customErrors];

    if (allErrors.length > 0) {
      let axesQuery = 'SELECT * FROM axes ORDER BY lib_axe ASC';
      let axesParams = [];
     
      if (req.user.profile_id === 4 || req.user.profile_id === 5) {
        axesQuery = 'SELECT * FROM axes WHERE pole_id = $1 ORDER BY lib_axe ASC';
        axesParams = [req.user.pole_id];
      }

      // MODIFICATION: Ajout de la récupération des objectifs ET du pôle
      const queries = [
        db.query(axesQuery, axesParams),
        db.query('SELECT * FROM secteurs ORDER BY lib_secteur ASC'),
        db.query('SELECT * FROM moa ORDER BY nom_moa ASC'),
        db.query('SELECT * FROM moe ORDER BY nom_moe ASC'),
        db.query('SELECT * FROM gestionnaires_projets ORDER BY nom_gestionnaire ASC'),
        db.query('SELECT * FROM statuts_juridiques ORDER BY lib_statut ASC'),
        db.query('SELECT * FROM communes ORDER BY nom_fr ASC'),
        db.query('SELECT id, nom_objectif, axe_id FROM objectifs ORDER BY axe_id, nom_objectif ASC')
      ];

      // NOUVEAU: Ajouter la requête du pôle si l'utilisateur est coordinateur ou chef de pôle
      if (req.user.profile_id === 4 || req.user.profile_id === 5) {
        queries.push(
          db.query('SELECT id, lib_pole FROM poles WHERE id = $1', [req.user.pole_id])
        );
      }

      const results = await Promise.all(queries);

      const [axes, secteurs, moas, moes, gestionnaires, statuts, communes, objectifs] = results;
      
      // NOUVEAU: Récupérer les informations du pôle si disponibles
      const poleInfo = (req.user.profile_id === 4 || req.user.profile_id === 5) && results[8] 
        ? results[8].rows[0] 
        : null;

      let backUrl = '/projects';
      if (req.user.profile_id === 4) {
        backUrl = '/dashboard/coordinateur';
      } else if (req.user.profile_id === 5) {
        backUrl = '/dashboard/chefPole';
      }

      return res.render('projects/add', {
        title: 'Ajouter un projet - PDTI Safi',
        pageTitle: 'Ajouter un nouveau projet',
        errors: allErrors,
        project: req.body,
        axes: axes.rows,
        secteurs: secteurs.rows,
        moas: moas.rows,
        moes: moes.rows,
        gestionnaires: gestionnaires.rows,
        statuts: statuts.rows,
        communes: communes.rows,
        objectifs: objectifs.rows,
        poleInfo: poleInfo, // NOUVEAU: Passer les infos du pôle à la vue
        backUrl: backUrl,
        user: req.user,
        app_name: process.env.APP_NAME || 'PDTI Safi',
        company_name: process.env.COMPANY_NAME || 'Province de Safi'
      });
    }

    try {
      const processedData = processProjectData(req.body);
      const newProject = await Project.create(processedData);
      await handleProjectCommunes(newProject.id, req.body.communes);

      if (req.user.profile_id === 4) {
        req.session.successMessage = 'Projet ajouté avec succès!';
        res.redirect('/dashboard/coordinateur');
      } else if (req.user.profile_id === 5) {
        req.session.successMessage = 'Projet ajouté avec succès!';
        res.redirect('/dashboard/chefPole');
      } else {
        req.session.successMessage = 'Projet ajouté avec succès!';
        res.redirect('/projects');
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du projet:', error);
      res.status(500).render('error', {
        title: 'Erreur',
        pageTitle: 'Erreur 500',
        message: 'Une erreur est survenue lors de l\'ajout du projet.',
        error: error,
        layout: 'layout'
      });
    }
  }
];

// Formulaire de modification de projet (inchangé)
// Formulaire de modification de projet
exports.getEditProject = async (req, res) => {
  try {
    if (isNaN(req.params.id)) {
      return res.status(400).render('error', {
        title: 'Requête invalide',
        pageTitle: 'Erreur 400',
        message: 'ID de projet invalide.',
        error: { status: 400, stack: '' },
        layout: 'layout'
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).render('error', {
        title: 'Projet non trouvé',
        pageTitle: 'Erreur 404',
        message: 'Le projet demandé n\'existe pas.',
        error: { status: 404, stack: '' },
        layout: 'layout'
      });
    }

    let axesQuery = 'SELECT * FROM axes ORDER BY lib_axe ASC';
    let axesParams = [];
   
    if (req.user.profile_id === 4 || req.user.profile_id === 5) {
      axesQuery = 'SELECT * FROM axes WHERE pole_id = $1 ORDER BY lib_axe ASC';
      axesParams = [req.user.pole_id];
    }

    // Récupération de toutes les données nécessaires incluant le pôle
    const [axes, secteurs, moas, moes, gestionnaires, statuts, communes, objectifs, poleInfo] = await Promise.all([
      db.query(axesQuery, axesParams),
      db.query('SELECT * FROM secteurs ORDER BY lib_secteur ASC'),
      db.query('SELECT * FROM moa ORDER BY nom_moa ASC'),
      db.query('SELECT * FROM moe ORDER BY nom_moe ASC'),
      db.query('SELECT * FROM gestionnaires_projets ORDER BY nom_gestionnaire ASC'),
      db.query('SELECT * FROM statuts_juridiques ORDER BY lib_statut ASC'),
      db.query('SELECT * FROM communes ORDER BY nom_fr ASC'),
      db.query('SELECT id, nom_objectif, axe_id FROM objectifs ORDER BY axe_id, nom_objectif ASC'),
      // Récupérer le pôle du projet via l'axe
      db.query(`
        SELECT p.lib_pole, p.id as pole_id
        FROM projets pr
        JOIN axes a ON pr.axe_id = a.id
        JOIN poles p ON a.pole_id = p.id
        WHERE pr.id = $1
      `, [req.params.id])
    ]);

    const projectCommunes = await Project.getProjectCommunes(req.params.id);

    let backUrl = '/projects';
    if (req.user.profile_id === 4) {
      backUrl = '/dashboard/coordinateur';
    } else if (req.user.profile_id === 5) {
      backUrl = '/dashboard/chefPole';
    }

    res.render('projects/edit', {
      title: 'Modifier un projet - PDTI Safi',
      pageTitle: 'Modifier un projet',
      project: project,
      axes: axes.rows,
      secteurs: secteurs.rows,
      moas: moas.rows,
      moes: moes.rows,
      gestionnaires: gestionnaires.rows,
      statuts: statuts.rows,
      communes: communes.rows,
      objectifs: objectifs.rows,
      projectCommunes: projectCommunes,
      poleInfo: poleInfo.rows[0] || null,
      errors: [],
      backUrl: backUrl,
      user: req.user,
      app_name: process.env.APP_NAME || 'PDTI Safi',
      company_name: process.env.COMPANY_NAME || 'Province de Safi'
    });

  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire de modification:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'affichage du formulaire.',
      error: error,
      layout: 'layout'
    });
  }
};

// MODIFICATION: Modifier un projet avec vérification d'unicité conditionnelle
// MODIFICATION: Modifier un projet avec vérification d'unicité conditionnelle
exports.postEditProject = [
  ...projectValidationRules(),
 
  async (req, res) => {
    const errors = validationResult(req);
    let customErrors = [];
    const projectId = req.params.id;

    try {
      // Récupérer le projet actuel pour comparer le numéro
      const currentProject = await Project.findById(projectId);
      if (!currentProject) {
        return res.status(404).render('error', {
          title: 'Projet non trouvé',
          pageTitle: 'Erreur 404',
          message: 'Le projet que vous essayez de modifier n\'existe pas.',
          error: { status: 404, stack: '' },
          layout: 'layout'
        });
      }

      /* Vérification d'unicité SEULEMENT si le numéro a changé
      if (req.body.num_projet && parseInt(req.body.num_projet) !== parseInt(currentProject.num_projet)) {
        const isUnique = await checkProjectNumberUniqueness(req.body.num_projet, projectId);
        if (!isUnique) {
          customErrors.push({
            param: 'num_projet',
            msg: 'Ce numéro de projet existe déjà',
            value: req.body.num_projet
          });
        }
      }*/

      // Combiner les erreurs
      const allErrors = errors.isEmpty() ? customErrors : [...errors.array(), ...customErrors];

      if (allErrors.length > 0) {
        let axesQuery = 'SELECT * FROM axes ORDER BY lib_axe ASC';
        let axesParams = [];
        
        if (req.user.profile_id === 4 || req.user.profile_id === 5) {
          axesQuery = 'SELECT * FROM axes WHERE pole_id = $1 ORDER BY lib_axe ASC';
          axesParams = [req.user.pole_id];
        }

        // Récupération de toutes les données incluant le pôle
        const [axes, secteurs, moas, moes, gestionnaires, statuts, communes, objectifs, poleInfo] = await Promise.all([
          db.query(axesQuery, axesParams),
          db.query('SELECT * FROM secteurs ORDER BY lib_secteur ASC'),
          db.query('SELECT * FROM moa ORDER BY nom_moa ASC'),
          db.query('SELECT * FROM moe ORDER BY nom_moe ASC'),
          db.query('SELECT * FROM gestionnaires_projets ORDER BY nom_gestionnaire ASC'),
          db.query('SELECT * FROM statuts_juridiques ORDER BY lib_statut ASC'),
          db.query('SELECT * FROM communes ORDER BY nom_fr ASC'),
          db.query('SELECT id, nom_objectif, axe_id FROM objectifs ORDER BY axe_id, nom_objectif ASC'),
          // Récupérer le pôle du projet
          db.query(`
            SELECT p.lib_pole, p.id as pole_id
            FROM projets pr
            JOIN axes a ON pr.axe_id = a.id
            JOIN poles p ON a.pole_id = p.id
            WHERE pr.id = $1
          `, [projectId])
        ]);

        const projectCommunes = await Project.getProjectCommunes(projectId);

        let backUrl = '/projects';
        if (req.user.profile_id === 4) {
          backUrl = '/dashboard/coordinateur';
        } else if (req.user.profile_id === 5) {
          backUrl = '/dashboard/chefPole';
        }

        return res.render('projects/edit', {
          title: 'Modifier un projet - PDTI Safi',
          pageTitle: 'Modifier un projet',
          errors: allErrors,
          project: { ...currentProject, ...req.body },
          axes: axes.rows,
          secteurs: secteurs.rows,
          moas: moas.rows,
          moes: moes.rows,
          gestionnaires: gestionnaires.rows,
          statuts: statuts.rows,
          communes: communes.rows,
          objectifs: objectifs.rows,
          projectCommunes: projectCommunes,
          poleInfo: poleInfo.rows[0] || null,
          backUrl: backUrl,
          user: req.user,
          app_name: process.env.APP_NAME || 'PDTI Safi',
          company_name: process.env.COMPANY_NAME || 'Province de Safi'
        });
      }

      // Mise à jour du projet
      const processedData = processProjectData(req.body);
      await Project.update(projectId, processedData);
      await handleProjectCommunes(projectId, req.body.communes);

      // Redirection selon le profil
      if (req.user.profile_id === 4) {
        req.session.successMessage = 'Projet modifié avec succès!';
        res.redirect('/dashboard/coordinateur');
      } else if (req.user.profile_id === 5) {
        req.session.successMessage = 'Projet modifié avec succès!';
        res.redirect('/dashboard/chefPole');
      } else {
        req.session.successMessage = 'Projet modifié avec succès!';
        res.redirect('/projects');
      }

    } catch (error) {
      console.error('Erreur lors de la modification du projet:', error);
      
      const project = await Project.findById(projectId);
      let axesQuery = 'SELECT * FROM axes ORDER BY lib_axe ASC';
      let axesParams = [];
      
      if (req.user.profile_id === 4 || req.user.profile_id === 5) {
        axesQuery = 'SELECT * FROM axes WHERE pole_id = $1 ORDER BY lib_axe ASC';
        axesParams = [req.user.pole_id];
      }

      // Récupération de toutes les données incluant le pôle pour le catch
      const [axes, secteurs, moas, moes, gestionnaires, statuts, communes, objectifs, poleInfo] = await Promise.all([
        db.query(axesQuery, axesParams),
        db.query('SELECT * FROM secteurs ORDER BY lib_secteur ASC'),
        db.query('SELECT * FROM moa ORDER BY nom_moa ASC'),
        db.query('SELECT * FROM moe ORDER BY nom_moe ASC'),
        db.query('SELECT * FROM gestionnaires_projets ORDER BY nom_gestionnaire ASC'),
        db.query('SELECT * FROM statuts_juridiques ORDER BY lib_statut ASC'),
        db.query('SELECT * FROM communes ORDER BY nom_fr ASC'),
        db.query('SELECT id, nom_objectif, axe_id FROM objectifs ORDER BY axe_id, nom_objectif ASC'),
        // Récupérer le pôle du projet
        db.query(`
          SELECT p.lib_pole, p.id as pole_id
          FROM projets pr
          JOIN axes a ON pr.axe_id = a.id
          JOIN poles p ON a.pole_id = p.id
          WHERE pr.id = $1
        `, [projectId])
      ]);

      const projectCommunes = await Project.getProjectCommunes(projectId);

      let backUrl = '/projects';
      if (req.user.profile_id === 4) {
        backUrl = '/dashboard/coordinateur';
      } else if (req.user.profile_id === 5) {
        backUrl = '/dashboard/chefPole';
      }

      res.status(500).render('projects/edit', {
        title: 'Modifier un projet - PDTI Safi',
        pageTitle: 'Modifier un projet',
        project: { ...project, ...req.body },
        axes: axes.rows,
        secteurs: secteurs.rows,
        moas: moas.rows,
        moes: moes.rows,
        gestionnaires: gestionnaires.rows,
        statuts: statuts.rows,
        communes: communes.rows,
        objectifs: objectifs.rows,
        projectCommunes: projectCommunes,
        poleInfo: poleInfo.rows[0] || null,
        errors: [{ msg: 'Une erreur est survenue lors de la modification du projet: ' + error.message }],
        backUrl: backUrl,
        user: req.user,
        app_name: process.env.APP_NAME || 'PDTI Safi',
        company_name: process.env.COMPANY_NAME || 'Province de Safi'
      });
    }
  }
];

// Supprimer un projet (inchangé)
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    if (req.user.profile_id === 4 || req.user.profile_id === 5) {
      const projectPoleResult = await db.query(
        `SELECT p.id, a.pole_id
         FROM projets p
         JOIN axes a ON p.axe_id = a.id
         WHERE p.id = $1`,
        [req.params.id]
      );

      if (projectPoleResult.rows.length === 0 || projectPoleResult.rows[0].pole_id !== req.user.pole_id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas les permissions pour supprimer ce projet'
        });
      }
    }

    await Project.delete(req.params.id);
   
    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du projet:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la suppression du projet.'
    });
  }
};

// MODIFICATION: Fonction utilitaire pour traiter les données - champs optionnels
// Fonction utilitaire pour traiter les données - champs optionnels (modifiée)
function processProjectData(data) {
  return {
    ...data,
    // NOUVEAU: Traitement de l'objectif_id
    objectif_id: data.objectif_id && data.objectif_id !== '' ? 
      parseInt(data.objectif_id) : null,
    
    // Permettre les valeurs nulles pour les champs optionnels
    statut_juridique_id: data.statut_juridique_id && data.statut_juridique_id !== '' ? 
      parseInt(data.statut_juridique_id) : null,
    moa_id: data.moa_id && data.moa_id !== '' ? 
      parseInt(data.moa_id) : null,
    moe_id: data.moe_id && data.moe_id !== '' ? 
      parseInt(data.moe_id) : null,
    gestionnaire_projet_id: data.gestionnaire_projet_id && data.gestionnaire_projet_id !== '' ? 
      parseInt(data.gestionnaire_projet_id) : null,
   
    // Conversion des valeurs numériques avec validation
    cout_total_mdh: data.cout_total_mdh && data.cout_total_mdh !== '' ? 
      parseFloat(data.cout_total_mdh) : null,
    nbr_emplois_directs: data.nbr_emplois_directs && data.nbr_emplois_directs !== '' ? 
      parseInt(data.nbr_emplois_directs) : null,
    nbr_beneficiaires: data.nbr_beneficiaires && data.nbr_beneficiaires !== '' ? 
      parseInt(data.nbr_beneficiaires) : null,
    duree_mois: data.duree_mois && data.duree_mois !== '' ? 
      parseInt(data.duree_mois) : null,
    annee_debut: data.annee_debut && data.annee_debut !== '' ? 
      parseInt(data.annee_debut) : null,
    annee_fin: data.annee_fin && data.annee_fin !== '' ? 
      parseInt(data.annee_fin) : null,
   
    // Transformation des valeurs de cases à cocher
    fc_disponibilite: data.fc_disponibilite === 'on',
    fc_visibilite: data.fc_visibilite === 'on',
    fc_assiette_assine: data.fc_assiette_assine === 'on',
    etude: data.etude === 'on',
   
    // Traitement du champ etude_etat selon la case etude
    etude_etat: data.etude === 'on' && ['APS', 'APD', 'DE'].includes(data.etude_etat)
      ? data.etude_etat
      : null,
   
    // Nettoyage des champs texte
    intitule: data.intitule ? data.intitule.trim() : '',
    objectifs: data.objectifs ? data.objectifs.trim() : null,
    composantes: data.composantes ? data.composantes.trim() : null,
    detail_cout: data.detail_cout ? data.detail_cout.trim() : null,
    detail_nbr_emploi: data.detail_nbr_emploi ? data.detail_nbr_emploi.trim() : null,
    detail_nbr_beneficiaires: data.detail_nbr_beneficiaires ? data.detail_nbr_beneficiaires.trim() : null,
    superficie_lineaire: data.superficie_lineaire && data.superficie_lineaire.trim() !== '' ? 
    data.superficie_lineaire.trim() : null,
    echeancier: data.echeancier ? data.echeancier.trim() : null
  };
}

// Fonction utilitaire pour gérer les communes associées au projet (inchangée)
async function handleProjectCommunes(projectId, communeIds) {
  try {
    let communes = communeIds || [];
    if (typeof communes === 'string') {
      communes = [communes];
    }
   
    if (communes.length > 0) {
      const validCommunes = await db.query(
        'SELECT id FROM communes WHERE id = ANY($1)',
        [communes]
      );
     
      if (validCommunes.rows.length !== communes.length) {
        throw new Error('Certaines communes sélectionnées n\'existent pas');
      }
    }
   
    await Project.updateProjectCommunes(projectId, communes);
   
  } catch (error) {
    console.error('Erreur lors de la gestion des communes:', error);
    throw error;
  }
}

module.exports = exports;
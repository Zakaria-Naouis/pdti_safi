const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

// Charger les variables d'environnement
dotenv.config();

const app = express();

// Configuration du port
const PORT = process.env.PORT || 3000;

// Configuration du moteur de templates EJS avec layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout'); // Définit le layout par défaut
app.use(expressLayouts); // Utilise le middleware express-ejs-layouts

// Middlewares de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Middleware pour les variables globales de l'application
app.use((req, res, next) => {
  res.locals.app_name = process.env.APP_NAME || 'PDTI Safi';
  res.locals.company_name = process.env.COMPANY_NAME || 'Province de Safi';
  next();
});

// Middleware pour gérer les messages flash via cookies
app.use((req, res, next) => {
  // Initialiser req.session comme un objet vide
  req.session = {};

  // Créer un proxy pour intercepter l'assignation à req.session
  const handler = {
    set: function(obj, prop, value) {
      // Si on assigne successMessage ou errorMessage, on le stocke dans un cookie
      if (prop === 'successMessage' || prop === 'errorMessage') {
        res.cookie(prop, value, { 
          httpOnly: true, 
          maxAge: 24 * 60 * 60 * 1000, // 24 heures
          secure: process.env.NODE_ENV === 'production'
        });
      }
      obj[prop] = value;
      return true;
    }
  };

  // Remplacer req.session par un proxy
  req.session = new Proxy(req.session, handler);

  // Récupérer les messages des cookies s'ils existent
  const successMessage = req.cookies.successMessage;
  const errorMessage = req.cookies.errorMessage;

  // Les rendre disponibles dans les vues
  res.locals.successMessage = successMessage;
  res.locals.errorMessage = errorMessage;

  // Effacer les cookies pour qu'ils ne soient lus qu'une fois
  if (successMessage) {
    res.cookie('successMessage', '', { expires: new Date(0) });
  }
  if (errorMessage) {
    res.cookie('errorMessage', '', { expires: new Date(0) });
  }

  next();
});

// Middleware pour passer l'utilisateur à toutes les vues
const { setUserInLocals } = require('./middleware/auth');
app.use(setUserInLocals);

// Middleware pour la navigation dans le menu
const menuMiddleware = require('./middleware/menu');
app.use(menuMiddleware);

// Middleware de sécurité CSP (Content Security Policy) pour les formulaires
app.use((req, res, next) => {
  if (req.path.includes('/projects/edit') || req.path.includes('/projects/add')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
      "font-src 'self' https://cdnjs.cloudflare.com; " +
      "connect-src 'self';"
    );
  }
  next();
});

// Middleware de validation des en-têtes pour les requêtes AJAX
app.use('/api', (req, res, next) => {
  // Vérifier que la requête provient bien du même domaine
  const origin = req.get('origin');
  const referer = req.get('referer');
  
  if (req.method !== 'GET' && !origin && !referer) {
    return res.status(403).json({
      success: false,
      message: 'Requête non autorisée'
    });
  }
  
  // Headers de sécurité pour les réponses API
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
});

// Middleware de limitation du taux de requêtes pour les API de validation
const rateLimit = require('express-rate-limit');

// Limiter les appels API de validation
const validationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requêtes par fenêtre de 15 minutes
  message: {
    success: false,
    message: 'Trop de requêtes de validation. Veuillez patienter.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Importation des routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const dashboardRoutes = require('./routes/dashboard');
const instructionRoutes = require('./routes/instructions');
const exportRoutes = require('./routes/export');
const indexRoutes = require('./routes/index');

// Utilisation des routes
app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/projects', projectRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/instructions', instructionRoutes);
app.use('/export', exportRoutes);

// =============================================
// ROUTES API AMÉLIORÉES POUR LA VALIDATION
// =============================================

// Route API pour récupérer les secteurs par axe avec validation renforcée
app.get('/api/secteurs-by-axe/:axeId', async (req, res) => {
  try {
    const db = require('./config/database');
    const axeId = req.params.axeId;
    
    // Validation stricte de l'ID de l'axe
    if (isNaN(axeId) || axeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID d\'axe invalide'
      });
    }
    
    // Vérifier que l'axe existe
    const axeCheck = await db.query('SELECT id FROM axes WHERE id = $1', [axeId]);
    if (axeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Axe non trouvé'
      });
    }
    
    // Récupérer les secteurs avec tri alphabétique
    const result = await db.query(
      'SELECT * FROM secteurs WHERE axe_id = $1 ORDER BY lib_secteur ASC',
      [axeId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des secteurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des secteurs'
    });
  }
});

// Route API pour récupérer les axes par pôle (pour coordinateur et chef de pôle)
app.get('/api/axes-by-pole/:poleId', async (req, res) => {
  try {
    const db = require('./config/database');
    const poleId = req.params.poleId;
    
    // Validation de l'ID du pôle
    if (isNaN(poleId) || poleId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de pôle invalide' 
      });
    }
    
    // Vérifier que le pôle existe
    const poleCheck = await db.query('SELECT id FROM poles WHERE id = $1', [poleId]);
    if (poleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pôle non trouvé'
      });
    }
    
    const result = await db.query(
      'SELECT * FROM axes WHERE pole_id = $1 ORDER BY lib_axe ASC', 
      [poleId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des axes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération des axes' 
    });
  }
});

// Route API pour vérifier l'unicité du numéro de projet avec sécurité renforcée
app.get('/api/check-project-number/:numero', validationRateLimit, async (req, res) => {
  try {
    const db = require('./config/database');
    const numero = req.params.numero;
    const projectId = req.query.projectId; // Pour exclure le projet actuel lors de la modification
    
    // Validation stricte du numéro
    if (isNaN(numero) || numero <= 0 || numero > 99999) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de projet invalide (doit être entre 1 et 99999)'
      });
    }
    
    // Validation de l'ID de projet (si fourni pour modification)
    if (projectId && (isNaN(projectId) || projectId <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'ID de projet invalide'
      });
    }
    
    let query = 'SELECT id FROM projets WHERE num_projet = $1';
    let params = [numero];
    
    // Exclure le projet actuel si on est en mode modification
    if (projectId && !isNaN(projectId)) {
      query += ' AND id != $2';
      params.push(projectId);
    }
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      exists: result.rows.length > 0,
      message: result.rows.length > 0 ? 'Ce numéro de projet existe déjà' : 'Numéro de projet disponible',
      checked_number: parseInt(numero)
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du numéro de projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification'
    });
  }
});

// Route API pour validation en temps réel d'un champ spécifique
app.post('/api/validate-field', validationRateLimit, async (req, res) => {
  try {
    const { field, value, context } = req.body;
    
    // Validation des paramètres d'entrée
    if (!field || !['num_projet', 'intitule', 'cout_total_mdh', 'axe_id', 'secteur_id', 'annee_debut', 'annee_fin'].includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Champ non autorisé pour la validation'
      });
    }
    
    let isValid = true;
    let message = '';
    let suggestions = [];
    
    const db = require('./config/database');
    
    // Logique de validation par champ
    switch (field) {
      case 'num_projet':
        if (!value) {
          isValid = false;
          message = 'Le numéro de projet est obligatoire';
        } else if (isNaN(value) || parseInt(value) < 1 || parseInt(value) > 99999) {
          isValid = false;
          message = 'Le numéro doit être un entier entre 1 et 99999';
        } else {
          // Vérification d'unicité
          const result = await db.query(
            'SELECT id FROM projets WHERE num_projet = $1 AND id != $2',
            [parseInt(value), context?.projectId || 0]
          );
          
          if (result.rows.length > 0) {
            isValid = false;
            message = 'Ce numéro de projet existe déjà';
            
            // Proposer des alternatives
            const nextAvailable = await db.query(
              'SELECT num_projet + 1 as suggestion FROM projets WHERE num_projet + 1 NOT IN (SELECT num_projet FROM projets) ORDER BY num_projet LIMIT 3'
            );
            suggestions = nextAvailable.rows.map(row => row.suggestion);
          }
        }
        break;
        
      case 'intitule':
        if (!value || value.trim().length < 10) {
          isValid = false;
          message = 'L\'intitulé doit contenir au minimum 10 caractères';
        } else if (value.length > 500) {
          isValid = false;
          message = 'L\'intitulé ne peut pas dépasser 500 caractères';
        }
        break;
        
      case 'cout_total_mdh':
        if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
          isValid = false;
          message = 'Le coût doit être un nombre positif';
        } else if (value && parseFloat(value) > 999999.99) {
          isValid = false;
          message = 'Le coût ne peut pas dépasser 999 999.99 MDH';
        }
        break;
        
      case 'axe_id':
        if (!value) {
          isValid = false;
          message = 'L\'axe est obligatoire';
        } else {
          const result = await db.query('SELECT id FROM axes WHERE id = $1', [parseInt(value)]);
          if (result.rows.length === 0) {
            isValid = false;
            message = 'Axe sélectionné invalide';
          }
        }
        break;
        
      case 'secteur_id':
        if (!value) {
          isValid = false;
          message = 'Le secteur est obligatoire';
        } else if (context?.axe_id) {
          const result = await db.query(
            'SELECT id FROM secteurs WHERE id = $1 AND axe_id = $2', 
            [parseInt(value), parseInt(context.axe_id)]
          );
          if (result.rows.length === 0) {
            isValid = false;
            message = 'Le secteur ne correspond pas à l\'axe sélectionné';
          }
        }
        break;
        
      case 'annee_debut':
        if (value && (isNaN(value) || parseInt(value) < 2020 || parseInt(value) > 2050)) {
          isValid = false;
          message = 'L\'année de début doit être comprise entre 2020 et 2050';
        }
        break;
        
      case 'annee_fin':
        if (value && (isNaN(value) || parseInt(value) < 2020 || parseInt(value) > 2050)) {
          isValid = false;
          message = 'L\'année de fin doit être comprise entre 2020 et 2050';
        } else if (value && context?.annee_debut && parseInt(value) < parseInt(context.annee_debut)) {
          isValid = false;
          message = 'L\'année de fin doit être supérieure ou égale à l\'année de début';
        }
        break;
    }
    
    res.json({
      success: true,
      isValid: isValid,
      message: message,
      suggestions: suggestions,
      field: field,
      value: value
    });
  } catch (error) {
    console.error('Erreur lors de la validation du champ:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation'
    });
  }
});

// Route API pour vérifier l'authentification
app.get('/api/check-auth', async (req, res) => {
  const token = req.cookies.jwt;
  
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('./models/User');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }
    
    res.json({ 
      authenticated: true,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        profile_id: user.profile_id,
        pole_id: user.pole_id
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification d\'authentification:', error);
    res.status(401).json({ authenticated: false });
  }
});

// Route API pour récupérer les communes avec pagination et recherche
app.get('/api/communes', async (req, res) => {
  try {
    const db = require('./config/database');
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    let query = 'SELECT * FROM communes';
    let params = [];
    let whereConditions = [];
    
    // Ajouter une condition de recherche si fournie
    if (search.trim()) {
      whereConditions.push('nom_fr ILIKE $' + (params.length + 1));
      params.push('%' + search.trim() + '%');
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY nom_fr ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des communes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération des communes' 
    });
  }
});

// Route API pour obtenir les statistiques globales
app.get('/api/stats', async (req, res) => {
  try {
    const db = require('./config/database');
    const result = await db.query(`
      SELECT
        COUNT(*) as total_projets,
        COALESCE(SUM(cout_total_mdh), 0) as cout_total,
        COALESCE(SUM(nbr_emplois_directs), 0) as total_emplois,
        COALESCE(SUM(nbr_beneficiaires), 0) as total_beneficiaires
      FROM projets
    `);
    
    const stats = result.rows[0] || {};
    
    res.json({
      success: true,
      data: {
        total_projets: parseInt(stats.total_projets) || 0,
        cout_total: parseFloat(stats.cout_total) || 0,
        total_emplois: parseInt(stats.total_emplois) || 0,
        total_beneficiaires: parseInt(stats.total_beneficiaires) || 0
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération des statistiques' 
    });
  }
});

// Route API pour obtenir des statistiques de validation
app.get('/api/validation-stats', async (req, res) => {
  try {
    const db = require('./config/database');
    
    // Statistiques sur les projets
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN num_projet IS NOT NULL THEN 1 END) as projects_with_number,
        COUNT(CASE WHEN intitule IS NOT NULL AND LENGTH(intitule) >= 10 THEN 1 END) as projects_with_valid_title,
        MAX(num_projet) as max_project_number,
        MIN(num_projet) as min_project_number
      FROM projets
    `);
    
    // Derniers numéros de projets utilisés
    const recentNumbers = await db.query(`
      SELECT num_projet 
      FROM projets 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        recent_numbers: recentNumbers.rows.map(row => row.num_projet)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// =============================================
// Ajout de route pour la consultation)
// =============================================

// Route API pour récupérer un projet spécifique (consultation rapide)
app.get('/api/project/:id', async (req, res) => {
  try {
    const { isAuthenticated } = require('./middleware/auth');
    
    // Vérifier l'authentification
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    const projectId = req.params.id;
    
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de projet invalide'
      });
    }

    const Project = require('./models/Project');
    const project = await Project.findByIdWithDetails(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    // Vérification des permissions selon le rôle
    const userCanView = req.user.profile_id === 1 || // Administrateur
                       req.user.profile_id === 2 || // Gouverneur  
                       req.user.profile_id === 3 || // Secrétaire Général
                       (req.user.pole_id && project.pole_id === req.user.pole_id); // Même pôle

    if (!userCanView) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce projet'
      });
    }

    res.json({
      success: true,
      data: project
    });

  } catch (error) {
    console.error('Erreur API projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});



// =============================================
// GESTION DES ERREURS
// =============================================

// Gestionnaire d'erreurs spécifique pour les API de validation
app.use('/api', (error, req, res, next) => {
  console.error('Erreur API de validation:', error);
  
  // Ne pas exposer les détails de l'erreur en production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    message: isDevelopment ? error.message : 'Erreur interne du serveur',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Gestionnaire d'erreurs 404
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Page non trouvée',
    pageTitle: 'Erreur 404',
    message: 'La page que vous cherchez n\'existe pas.',
    error: { status: 404, stack: '' },
    layout: 'layout'
  });
});

// Gestionnaire d'erreurs général
app.use((err, req, res, next) => {
  console.error('Erreur application:', err.stack);
  
  // Ne pas exposer les détails de l'erreur en production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).render('error', {
    title: 'Erreur',
    pageTitle: `Erreur ${err.status || 500}`,
    message: isDevelopment ? err.message : 'Une erreur est survenue',
    error: isDevelopment ? err : { status: err.status || 500, stack: '' },
    layout: 'layout'
  });
});

// =============================================
// DÉMARRAGE DU SERVEUR
// =============================================

// Fonction pour vérifier la connexion à la base de données au démarrage
const checkDatabaseConnection = async () => {
  try {
    const db = require('./config/database');
    await db.query('SELECT 1');
    console.log('✅ Connexion à la base de données établie');
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error.message);
    return false;
  }
};

// Démarrage du serveur avec vérification de la base de données
const startServer = async () => {
  try {
    // Vérifier la connexion à la base de données
    const dbConnected = await checkDatabaseConnection();
    
    if (!dbConnected) {
      console.error('⚠️  Le serveur démarrera sans connexion à la base de données');
    }
    
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`🚀 Serveur PDTI Safi démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📋 Application accessible sur: http://localhost:${PORT}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Mode développement activé`);
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Gestion propre de l'arrêt du serveur
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur demandé...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur (SIGTERM)...');
  process.exit(0);
});

// Démarrer l'application
startServer();
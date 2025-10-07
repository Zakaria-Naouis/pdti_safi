// middleware/rbac.js
const User = require('../models/User');

// Middleware pour vérifier les permissions basées sur les rôles
module.exports.checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Vérifier si l'utilisateur est défini
      if (!req.user) {
        return res.status(401).render('error', {
          title: 'Non authentifié',
          pageTitle: 'Erreur 401',
          message: 'Vous devez être connecté pour accéder à cette ressource.',
          error: { status: 401, stack: '' },
          layout: 'layout'
        });
      }

      // Vérifier si l'utilisateur a un profil
      if (!req.user.profile_id) {
        return res.status(403).render('error', {
          title: 'Profil manquant',
          pageTitle: 'Erreur 403',
          message: 'Votre compte n\'a pas de profil associé. Contactez l\'administrateur.',
          error: { status: 403, stack: '' },
          layout: 'layout'
        });
      }

      // Cas spécial pour la modification de projet dans son pôle
      if (permission === 'Modifier projet dans son pôle') {
        // Les administrateurs, gouverneurs et SG peuvent modifier tous les projets
        if (req.user.profile_id === 1 || req.user.profile_id === 2 || req.user.profile_id === 3) {
          return next();
        }
        
        // Les coordinateurs et chefs de pôle peuvent modifier les projets de leur pôle
        if (req.user.profile_id === 4 || req.user.profile_id === 5) {
          // Vérifier si le projet appartient au pôle de l'utilisateur
          if (req.params.id) {
            const projectId = req.params.id;
            const db = require('../config/database');
            
            const projectResult = await db.query(
              `SELECT p.id, a.pole_id 
               FROM projets p 
               JOIN axes a ON p.axe_id = a.id 
               WHERE p.id = $1`,
              [projectId]
            );
            
            if (projectResult.rows.length > 0 && projectResult.rows[0].pole_id === req.user.pole_id) {
              return next();
            }
          }
        }
      }

      // Cas spécial pour la modification de projet (pour compatibilité)
      if (permission === 'Modifier projet') {
        // Les administrateurs, gouverneurs et SG peuvent modifier tous les projets
        if (req.user.profile_id === 1 || req.user.profile_id === 2 || req.user.profile_id === 3) {
          return next();
        }
        
        // Les coordinateurs et chefs de pôle peuvent modifier les projets de leur pôle
        if (req.user.profile_id === 4 || req.user.profile_id === 5) {
          // Vérifier si le projet appartient au pôle de l'utilisateur
          if (req.params.id) {
            const projectId = req.params.id;
            const db = require('../config/database');
            
            const projectResult = await db.query(
              `SELECT p.id, a.pole_id 
               FROM projets p 
               JOIN axes a ON p.axe_id = a.id 
               WHERE p.id = $1`,
              [projectId]
            );
            
            if (projectResult.rows.length > 0 && projectResult.rows[0].pole_id === req.user.pole_id) {
              return next();
            }
          }
        }
      }

      // Vérification standard des permissions
      const userPermissions = await User.getProfilePermissions(req.user.profile_id);
      
      if (userPermissions.includes(permission)) {
        return next();
      }
      
      res.status(403).render('error', {
        title: 'Accès refusé',
        pageTitle: 'Erreur 403',
        message: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource.',
        error: { status: 403, stack: '' },
        layout: 'layout'
      });
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      res.status(500).render('error', {
        title: 'Erreur',
        pageTitle: 'Erreur 500',
        message: 'Une erreur est survenue lors de la vérification des permissions.',
        error: error,
        layout: 'layout'
      });
    }
  };
};

// Middleware pour vérifier si l'utilisateur est administrateur
module.exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.profile_id === 1) { // ID du profil administrateur
    return next();
  }
  res.status(403).render('error', {
    title: 'Accès refusé',
    pageTitle: 'Erreur 403',
    message: 'Accès réservé aux administrateurs.',
    error: { status: 403, stack: '' },
    layout: 'layout'
  });
};

// Middleware pour vérifier si l'utilisateur est gouverneur ou secrétaire général
module.exports.isGouverneurOrSG = (req, res, next) => {
  if (req.user && (req.user.profile_id === 2 || req.user.profile_id === 3)) { // ID des profils gouverneur et SG
    return next();
  }
  res.status(403).render('error', {
    title: 'Accès refusé',
    pageTitle: 'Erreur 403',
    message: 'Accès réservé au Gouverneur et au Secrétaire Général.',
    error: { status: 403, stack: '' },
    layout: 'layout'
  });
};

// Middleware pour vérifier si l'utilisateur est coordinateur
module.exports.isCoordinateur = (req, res, next) => {
  if (req.user && req.user.profile_id === 4) { // ID du profil coordinateur
    return next();
  }
  res.status(403).render('error', {
    title: 'Accès refusé',
    pageTitle: 'Erreur 403',
    message: 'Accès réservé aux coordinateurs.',
    error: { status: 403, stack: '' },
    layout: 'layout'
  });
};

// Middleware pour vérifier si l'utilisateur est chef de pôle
module.exports.isChefPole = (req, res, next) => {
  if (req.user && req.user.profile_id === 5) { // ID du profil chef de pôle
    return next();
  }
  res.status(403).render('error', {
    title: 'Accès refusé',
    pageTitle: 'Erreur 403',
    message: 'Accès réservé aux chefs de pôle.',
    error: { status: 403, stack: '' },
    layout: 'layout'
  });
};
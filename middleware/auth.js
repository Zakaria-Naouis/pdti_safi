// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware pour vérifier le token JWT (API)
module.exports.authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token non fourni' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token invalide' });
  }
};

// Middleware pour vérifier si l'utilisateur est authentifié (pour les vues)
module.exports.isAuthenticated = async (req, res, next) => {
  const token = req.cookies.jwt;

  // Si pas de token, rediriger vers login
  if (!token) {
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      res.clearCookie('jwt');
      return res.redirect('/login');
    }
    
    req.user = user;
    res.locals.user = user;
    
    // Ajouter des headers pour empêcher le cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    res.clearCookie('jwt');
    return res.redirect('/login');
  }
};

// ============================================
// CORRECTION: Middleware amélioré pour passer l'utilisateur à toutes les vues
// ============================================
module.exports.setUserInLocals = async (req, res, next) => {
  // Si req.user existe déjà (défini par isAuthenticated), l'utiliser
  if (req.user) {
    res.locals.user = req.user;
    return next();
  }

  // Sinon, essayer de récupérer l'utilisateur via le cookie JWT
  const token = req.cookies.jwt;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user) {
        req.user = user;
        res.locals.user = user;
      } else {
        res.locals.user = null;
      }
    } catch (error) {
      // Token invalide ou expiré, on ne fait rien (l'utilisateur sera null)
      res.locals.user = null;
    }
  } else {
    // Pas de token, l'utilisateur n'est pas connecté
    res.locals.user = null;
  }
  
  next();
};
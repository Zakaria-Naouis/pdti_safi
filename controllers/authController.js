// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Page de connexion
exports.getLogin = (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', {
    title: 'Connexion - PDTI Safi',
    pageTitle: 'Connexion à votre compte',
    layout: false
  });
};

// Traitement de la connexion
exports.postLogin = async (req, res) => {
  const { email, mot_de_passe } = req.body;
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return res.render('auth/login', {
        title: 'Connexion - PDTI Safi',
        pageTitle: 'Connexion à votre compte',
        error: 'Email ou mot de passe incorrect',
        layout: false
      });
    }

    const isMatch = await User.verifyPassword(mot_de_passe, user.mot_de_passe);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Connexion - PDTI Safi',
        pageTitle: 'Connexion à votre compte',
        error: 'Email ou mot de passe incorrect',
        layout: false
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, profile_id: user.profile_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('jwt', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production'
    });

    req.user = user;

    if (user.profile_id === 1) {
      res.redirect('/dashboard/admin');
    } else if (user.profile_id === 2 || user.profile_id === 3) {
      res.redirect('/dashboard/gouverneur');
    } else if (user.profile_id === 4) {
      res.redirect('/dashboard/coordinateur');
    } else if (user.profile_id === 5) {
      res.redirect('/dashboard/chefPole');
    } else if (user.profile_id === 7 || user.profile_id === 8 ) {  // CORRIGÉ: profile_id 7 pour Pacha 8 pour Chef de Cercle
      res.redirect('/dashboard/pacha');
    } else {
      res.redirect('/dashboard');
    }
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de la connexion.',
      layout: false
    });
  }
};

// Déconnexion avec désactivation du cache
exports.logout = (req, res) => {
  // Supprimer le cookie JWT
  res.clearCookie('jwt');
  
  // Désactiver le cache du navigateur
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.redirect('/login');
};
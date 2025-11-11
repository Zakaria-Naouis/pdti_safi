// middleware/menu.js
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(req, res, next) {
  // Définir les éléments du menu par défaut
  const menuItems = [];

  // ============================================
  // CORRECTION: Vérifier l'authentification via JWT
  // ============================================
  let user = req.user; // Utiliser req.user s'il existe déjà
  
  // Si req.user n'existe pas, essayer de le récupérer via le cookie JWT
  if (!user) {
    const token = req.cookies.jwt;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
        req.user = user; // Mettre à jour req.user
        res.locals.user = user; // Mettre à jour res.locals.user
      } catch (error) {
        console.error('Erreur lors de la vérification du token dans menu.js:', error);
      }
    }
  }

  // Si l'utilisateur est authentifié, construire le menu
  if (user) {
    // Menu Tableau de bord - toujours visible pour les utilisateurs connectés
    menuItems.push({
      title: 'Tableau de bord',
      url: '/dashboard',
      icon: 'fas fa-tachometer-alt',
      active: req.path.includes('/dashboard')
    });

    // ============================================
    // MENU INSTRUCTIONS - TEMPORAIREMENT DÉSACTIVÉ
    // ============================================
    // Pour réactiver ce menu, décommentez le bloc ci-dessous
    /*
    // Menu Instructions avec notifications selon le profil
    if (user.profile_id === 1 || user.profile_id === 2 || user.profile_id === 3 || user.profile_id === 4 || user.profile_id === 5) {
      let instructionCount = 0;
      
      try {
        // Calculer le nombre d'instructions selon le profil
        if (user.profile_id === 2 || user.profile_id === 3) {
          // Gouverneur/SG - instructions émises en cours ou en retard
          const result = await db.query(`
            SELECT COUNT(*) as count
            FROM instructions i
            JOIN statuts_instructions s ON i.statut_id = s.id
            WHERE i.emetteur_id = $1 AND s.lib_statut IN ('En Cours', 'En Retard')
          `, [user.id]);
          instructionCount = parseInt(result.rows[0].count) || 0;
        } else if (user.profile_id === 4) {
          // Coordinateur - instructions reçues non exécutées
          const result = await db.query(`
            SELECT COUNT(*) as count
            FROM instructions i
            JOIN statuts_instructions s ON i.statut_id = s.id
            WHERE i.destinataire_id = $1 AND s.lib_statut != 'Exécuté'
          `, [user.id]);
          instructionCount = parseInt(result.rows[0].count) || 0;
        } else if (user.profile_id === 5) {
          // Chef de pôle - instructions concernant son pôle
          const result = await db.query(`
            SELECT COUNT(*) as count
            FROM instructions i
            JOIN utilisateurs u ON i.destinataire_id = u.id
            JOIN statuts_instructions s ON i.statut_id = s.id
            WHERE u.pole_id = $1 AND s.lib_statut != 'Exécuté'
          `, [user.pole_id]);
          instructionCount = parseInt(result.rows[0].count) || 0;
        } else if (user.profile_id === 1) {
          // Admin - toutes les instructions non exécutées
          const result = await db.query(`
            SELECT COUNT(*) as count
            FROM instructions i
            JOIN statuts_instructions s ON i.statut_id = s.id
            WHERE s.lib_statut != 'Exécuté'
          `);
          instructionCount = parseInt(result.rows[0].count) || 0;
        }
      } catch (error) {
        console.error('Erreur lors du calcul des notifications d\'instructions:', error);
        instructionCount = 0;
      }

      menuItems.push({
        title: 'Instructions',
        url: '/instructions',
        icon: 'fas fa-tasks',
        active: req.path.includes('/instructions'),
        badge: instructionCount > 0 ? instructionCount : null,
        badgeClass: instructionCount > 0 ? 'bg-danger' : null
      });
    }
    */
    // FIN DU BLOC MENU INSTRUCTIONS COMMENTÉ
    // ============================================

    // ============================================
    // Menu Export - Coordinateur ET Administrateur (profile_id === 4 OU 1)
    // ============================================
    if (user.profile_id === 4 || user.profile_id === 1) {
      console.log(`✅ Menu Export ajouté pour l'utilisateur ${user.email} (profile_id: ${user.profile_id}${user.pole_id ? ', pole_id: ' + user.pole_id : ''})`);
      menuItems.push({
        title: 'Export',
        url: '#',
        icon: 'fas fa-download',
        active: false,
        dropdown: [
          {
            title: 'Canevas Projets Global',
            url: '/export/canvas-global',
            icon: 'fas fa-file-excel'
          },
          {
            title: 'Canevas Projets 2026',
            url: '/export/canvas-2026',
            icon: 'fas fa-file-excel'
          }
        ]
      });
    } else {
      console.log(`ℹ️ Menu Export NON ajouté pour l'utilisateur ${user.email} (profile_id: ${user.profile_id})`);
    }
  }

  // Passer les éléments du menu à toutes les vues
  res.locals.menuItems = menuItems;
  next();
};
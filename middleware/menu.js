// middleware/menu.js
const db = require('../config/database');

module.exports = async function(req, res, next) {
  // Définir les éléments du menu par défaut
  const menuItems = [];

  if (req.user) {
    // Menu Tableau de bord - toujours visible pour les utilisateurs connectés
    menuItems.push({
      title: 'Tableau de bord',
      url: '/dashboard',
      icon: 'fas fa-tachometer-alt',
      active: req.path.includes('/dashboard')
    });

    // Menu Instructions avec notifications selon le profil
    if (req.user.profile_id === 1 || req.user.profile_id === 2 || req.user.profile_id === 3 || req.user.profile_id === 4 || req.user.profile_id === 5) {
      let instructionCount = 0;
      
      try {
        // Calculer le nombre d'instructions selon le profil
        if (req.user.profile_id === 2 || req.user.profile_id === 3) {
          // Gouverneur/SG - instructions émises en cours ou en retard
          const result = await db.query(`
            SELECT COUNT(*) as count
            FROM instructions i
            JOIN statuts_instructions s ON i.statut_id = s.id
            WHERE i.emetteur_id = $1 AND s.lib_statut IN ('En Cours', 'En Retard')
          `, [req.user.id]);
          instructionCount = parseInt(result.rows[0].count) || 0;
        } else if (req.user.profile_id === 4) {
          // Coordinateur - instructions reçues non exécutées
          const result = await db.query(`
            SELECT COUNT(*) as count
            FROM instructions i
            JOIN statuts_instructions s ON i.statut_id = s.id
            WHERE i.destinataire_id = $1 AND s.lib_statut != 'Exécuté'
          `, [req.user.id]);
          instructionCount = parseInt(result.rows[0].count) || 0;
        } else if (req.user.profile_id === 5) {
          // Chef de pôle - instructions concernant son pôle
          const result = await db.query(`
            SELECT COUNT(*) as count
            FROM instructions i
            JOIN utilisateurs u ON i.destinataire_id = u.id
            JOIN statuts_instructions s ON i.statut_id = s.id
            WHERE u.pole_id = $1 AND s.lib_statut != 'Exécuté'
          `, [req.user.pole_id]);
          instructionCount = parseInt(result.rows[0].count) || 0;
        } else if (req.user.profile_id === 1) {
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

    // Menu Exporter - visible pour tous les utilisateurs connectés
    menuItems.push({
      title: 'Exporter',
      url: '#',
      icon: 'fas fa-download',
      active: false,
      dropdown: [
        {
          title: 'Axe 1: Investissement & emplois',
          url: '/export/projects/axes',
          icon: 'fas fa-chart-line'
        },
        {
          title: 'Axe 2: Éducation et enseignement',
          url: '/export/projects/axes?filter=education',
          icon: 'fas fa-graduation-cap'
        },
        {
          title: 'Axe 3: Santé',
          url: '/export/projects/axes?filter=sante',
          icon: 'fas fa-heartbeat'
        },
        {
          title: 'Axe 4: Infrastructures',
          url: '/export/projects/axes?filter=infrastructures',
          icon: 'fas fa-building'
        },
        {
          title: 'Axe 5: Eau',
          url: '/export/projects/axes?filter=eau',
          icon: 'fas fa-tint'
        }
      ]
    });
  }

  // Passer les éléments du menu à toutes les vues
  res.locals.menuItems = menuItems;
  next();
};
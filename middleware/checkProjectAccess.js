// middleware/checkProjectAccess.js
const db = require('../config/database');

exports.checkProjectAccessForPacha = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const user = req.user;
    
    if (user.profile_id === 1) {
      return next();
    }
    
    if (user.profile_id === 7) {
      if (!user.code_cercle) {
        return res.status(403).render('error', {
          title: 'Accès non autorisé',
          pageTitle: 'Erreur 403',
          message: 'Votre compte n\'est pas associé à un pachalik.',
          error: { status: 403 }
        });
      }
      
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM projets p
        WHERE p.id = $1
        AND p.id IN (
          SELECT DISTINCT pc.projet_id
          FROM projets_communes pc
          JOIN communes c ON pc.commune_id = c.id
          WHERE c.code_cercle = $2
        )
      `, [projectId, user.code_cercle]);
      
      if (parseInt(result.rows[0].count) === 0) {
        return res.status(403).render('error', {
          title: 'Accès non autorisé',
          pageTitle: 'Erreur 403',
          message: 'Ce projet n\'appartient pas à votre pachalik.',
          error: { status: 403 }
        });
      }
    }
    
    next();
    
  } catch (error) {
    console.error('Erreur checkProjectAccess:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Erreur lors de la vérification des droits.',
      error: error
    });
  }
};
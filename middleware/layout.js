module.exports = function(req, res, next) {
  // Définir le layout par défaut
  res.locals.layout = 'layout';
  
  // Passer l'utilisateur à toutes les vues
  res.locals.user = req.user || null;
  
  next();
};
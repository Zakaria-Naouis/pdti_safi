// controllers/exportController.js
const Project = require('../models/Project');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// Exporter les projets par axes avec filtre optionnel
exports.exportProjectsByAxes = async (req, res) => {
    try {
        const filter = req.params.filter;
        let query = 'SELECT * FROM axes';
        let params = [];
        
        // Appliquer le filtre en fonction du paramètre
        if (filter) {
            switch(filter) {
                case 'investissement':
                    query += " WHERE lib_axe LIKE '%investissement%' OR lib_axe LIKE '%emplois%'";
                    break;
                case 'education':
                    query += " WHERE lib_axe LIKE '%éducation%' OR lib_axe LIKE '%enseignement%'";
                    break;
                case 'sante':
                    query += " WHERE lib_axe LIKE '%santé%'";
                    break;
                case 'infrastructures':
                    query += " WHERE lib_axe LIKE '%infrastructures%' OR lib_axe LIKE '%mise à niveau%'";
                    break;
                case 'eau':
                    query += " WHERE lib_axe LIKE '%eau%'";
                    break;
                default:
                    // Par défaut, on filtre sur l'investissement et emplois
                    query += " WHERE lib_axe LIKE '%investissement%' OR lib_axe LIKE '%emplois%'";
            }
        }

        const axes = await db.query(query, params);
        const projectsByAxes = [];

        for (const axe of axes.rows) {
            const projects = await Project.findAll({ axe_id: axe.id });
            projectsByAxes.push({
                axe: axe.lib_axe,
                projects: projects
            });
        }

        // Créer un nom de fichier descriptif
        let filename = 'projets_par_axes';
        if (filter) {
            switch(filter) {
                case 'investissement':
                    filename += '_investissement_emplois';
                    break;
                case 'education':
                    filename += '_education_enseignement';
                    break;
                case 'sante':
                    filename += '_sante';
                    break;
                case 'infrastructures':
                    filename += '_infrastructures';
                    break;
                case 'eau':
                    filename += '_eau';
                    break;
                default:
                    filename += '_investissement_emplois';
            }
        }
        filename += `_${new Date().toISOString().split('T')[0]}.csv`;

        const filepath = path.join(__dirname, '../public/exports', filename);
        
        // Assurer que le répertoire existe
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const ws = fs.createWriteStream(filepath);
        
        // Écrire l'en-tête
        ws.write('Axe,Numéro Projet,Intitulé,Coût (MDH),Emplois Directs,Bénéficiaires\n');
        
        // Écrire les données
        for (const item of projectsByAxes) {
            if (item.projects && item.projects.length > 0) {
                for (const project of item.projects) {
                    ws.write(`"${item.axe}",${project.num_projet},"${project.intitule}",${project.cout_total_mdh || 0},${project.nbr_emplois_directs || 0},${project.nbr_beneficiaires || 0}\n`);
                }
            } else {
                ws.write(`"${item.axe}",,,,,\n`);
            }
        }
        
        ws.end();
        
        // Envoyer le fichier
        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Erreur lors du téléchargement:', err);
            }
            // Supprimer le fichier après le téléchargement
            fs.unlinkSync(filepath);
        });
    } catch (error) {
        console.error('Erreur lors de l\'exportation:', error);
        res.status(500).render('error', {
            title: 'Erreur',
            pageTitle: 'Erreur 500',
            message: 'Une erreur est survenue lors de l\'exportation des projets.'
        });
    }
};

// Exporter les projets par secteurs
exports.exportProjectsBySectors = async (req, res) => {
  try {
    const secteurs = await db.query('SELECT * FROM secteurs');
    const projectsBySectors = [];

    for (const secteur of secteurs.rows) {
      const projects = await Project.findAll({ secteur_id: secteur.id });
      projectsBySectors.push({
        secteur: secteur.lib_secteur,
        projects: projects
      });
    }

    // Créer un fichier CSV
    const filename = `projets_par_secteurs_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join(__dirname, '../public/exports', filename);

    // Assurer que le répertoire existe
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const ws = fs.createWriteStream(filepath);
    
    // Écrire l'en-tête
    ws.write('Secteur,Numéro Projet,Intitulé,Coût (MDH),Emplois Directs,Bénéficiaires\n');

    // Écrire les données
    for (const item of projectsBySectors) {
      if (item.projects && item.projects.length > 0) {
        for (const project of item.projects) {
          ws.write(`"${item.secteur}",${project.num_projet},"${project.intitule}",${project.cout_total_mdh || 0},${project.nbr_emplois_directs || 0},${project.nbr_beneficiaires || 0}\n`);
        }
      } else {
        ws.write(`"${item.secteur}",,,,,\n`);
      }
    }

    ws.end();

    // Envoyer le fichier
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement:', err);
      }
      // Supprimer le fichier après le téléchargement
      fs.unlinkSync(filepath);
    });
  } catch (error) {
    console.error('Erreur lors de l\'exportation:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'exportation des projets.'
    });
  }
};

// Exporter les projets par communes
exports.exportProjectsByCommunes = async (req, res) => {
  try {
    const communes = await db.query('SELECT * FROM communes');
    const projectsByCommunes = [];

    for (const commune of communes.rows) {
      // Récupérer les projets pour cette commune via la table de liaison
      const projectsResult = await db.query(`
        SELECT p.* 
        FROM projets p
        JOIN projets_communes pc ON p.id = pc.projet_id
        WHERE pc.commune_id = $1
      `, [commune.id]);
      
      projectsByCommunes.push({
        commune: commune.nom_fr,
        projects: projectsResult.rows
      });
    }

    // Créer un fichier CSV
    const filename = `projets_par_communes_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join(__dirname, '../public/exports', filename);

    // Assurer que le répertoire existe
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const ws = fs.createWriteStream(filepath);
    
    // Écrire l'en-tête
    ws.write('Commune,Numéro Projet,Intitulé,Coût (MDH),Emplois Directs,Bénéficiaires\n');

    // Écrire les données
    for (const item of projectsByCommunes) {
      if (item.projects && item.projects.length > 0) {
        for (const project of item.projects) {
          ws.write(`"${item.commune}",${project.num_projet},"${project.intitule}",${project.cout_total_mdh || 0},${project.nbr_emplois_directs || 0},${project.nbr_beneficiaires || 0}\n`);
        }
      } else {
        ws.write(`"${item.commune}",,,,,\n`);
      }
    }

    ws.end();

    // Envoyer le fichier
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement:', err);
      }
      // Supprimer le fichier après le téléchargement
      fs.unlinkSync(filepath);
    });
  } catch (error) {
    console.error('Erreur lors de l\'exportation:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'exportation des projets.'
    });
  }
};
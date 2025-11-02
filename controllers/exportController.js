// controllers/exportController.js
// VERSION FINALE - Avec gestion élégante des messages d'erreur

const db = require('../config/database');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/**
 * Export Canevas Global - Filtre les projets selon le pôle de l'utilisateur
 * Pour les coordinateurs (profile_id = 4), exporte uniquement les projets de leur pôle
 * Utilise une sous-requête car la vue ne contient pas directement pole_id
 */
exports.exportCanvasGlobal = async (req, res) => {
  try {
    // Récupérer l'utilisateur connecté
    const user = req.user;
    
    if (!user) {
      return res.status(401).render('error', {
        title: 'Non authentifié',
        pageTitle: 'Erreur 401',
        message: 'Vous devez être connecté pour accéder à cette ressource.',
        layout: 'layout'
      });
    }

    console.log(`📊 Export Canvas Global demandé par ${user.email} (profile_id: ${user.profile_id}, pole_id: ${user.pole_id})`);

    // Construire la requête SQL avec filtrage par pôle pour les coordinateurs
    let query = `
      SELECT v.* 
      FROM vue_export_canevas v
    `;
    const params = [];

    // Si l'utilisateur est coordinateur (profile_id = 4), filtrer par son pôle
    if (user.profile_id === 4) {
      if (!user.pole_id) {
        return res.status(403).render('error', {
          title: 'Pôle non assigné',
          pageTitle: 'Erreur 403',
          message: 'Votre compte n\'a pas de pôle assigné. Veuillez contacter l\'administrateur pour résoudre ce problème.',
          layout: 'layout'
        });
      }
      
      // Filtrer par pôle en utilisant une sous-requête sur la table axes
      query += `
        WHERE v."Axe" IN (
          SELECT a.lib_axe 
          FROM axes a 
          WHERE a.pole_id = $1
        )
      `;
      params.push(user.pole_id);
      
      console.log(`🔍 Filtrage activé pour pole_id = ${user.pole_id}`);
    } else {
      // Administrateur, Gouverneur, SG : voir tous les projets
      console.log(`🔓 Pas de filtrage (profile_id: ${user.profile_id}) - Export de tous les projets`);
    }

    query += ' ORDER BY v."Num Projet"';

    const result = await db.query(query, params);
    const data = result.rows;

    console.log(`📋 Nombre de projets à exporter: ${data.length}`);

    // Gérer le cas où aucun projet n'est trouvé - Afficher une page HTML
    if (!data || data.length === 0) {
      const messageUtilisateur = user.profile_id === 4 
        ? `Aucun projet n'a été trouvé pour votre pôle (Pôle ${user.pole_id}).`
        : 'Aucun projet n\'a été trouvé dans la base de données.';
      
      return res.render('error', {
        title: 'Aucun projet à exporter',
        pageTitle: 'Export impossible',
        message: messageUtilisateur,
        error: { 
          status: 404, 
          stack: '' 
        },
        layout: 'layout'
      });
    }

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Canevas Global', { 
      pageSetup: { paperSize: 9, orientation: 'landscape' } 
    });

      const columnHeaders = [
      'Num Projet', 'Axe', 'Secteur', 'Intitulé du Projet', 'Commune', 'Objectifs Globaux',
      'Objectifs du projet (argumentaires)', 'Composantes du projet', 'Consistance du projet (superficie, linéaire,…)',
      'Coût du projet (MDHs)', 'Détail du Coût', 'Nombre d\'emplois direct', 'Détail Nombre d\'Emplois',
      'Nombres des bénéficiaires par catégories cibles', 'Détail Nombre Bénéficiaires', 'Durée du projet (En mois)',
      'Echéancier', 'Année Début', 'Année Fin', 'Maître d\'ouvrage', 'Maître d\'ouvrage délégué',
      'Disponibilité Foncier', 'Si non, visibilité sur sa mobilisation sans contrainte (oui/no',
      'Statut juridique', 'Assiette assainie', 'Etude Disponible', 'Si Oui état d\'avancement',
      'Gestionnaire après achèvement du projet', 'Partenaires', 'Indicateurs à améliorer'
    ];

    worksheet.columns = columnHeaders.map(header => ({
      header: header,
      key: header,
      width: 18
    }));

    // Style de l'en-tête
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

    // Ajouter les données
    data.forEach(row => {
      worksheet.addRow(row);
    });

    worksheet.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75 };

    // Nom du fichier avec indication du pôle pour les coordinateurs
    const poleInfo = user.profile_id === 4 ? `_Pole${user.pole_id}` : '';
    const fileName = `Canevas_Projets_Global${poleInfo}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    console.log(`✅ Export réussi: ${fileName} (${data.length} projets)`);

    res.download(filePath, fileName, (err) => {
      if (err) console.error('Erreur lors du téléchargement:', err);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Erreur lors de la suppression du fichier:', err);
      });
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'export Canvas Global:', error);
    res.status(500).render('error', {
      title: 'Erreur lors de l\'export',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'export des projets. Veuillez réessayer ou contacter l\'administrateur.',
      error: process.env.NODE_ENV === 'development' ? error : { status: 500, stack: '' },
      layout: 'layout'
    });
  }
};

/**
 * Export Canevas 2026 - Filtre par pôle ET par échéancier 2026
 * Pour les coordinateurs (profile_id = 4), exporte uniquement :
 * - Les projets de leur pôle
 * - Les projets avec échéancier = 2026
 */
exports.exportCanvas2026 = async (req, res) => {
  try {
    // Récupérer l'utilisateur connecté
    const user = req.user;
    
    if (!user) {
      return res.status(401).render('error', {
        title: 'Non authentifié',
        pageTitle: 'Erreur 401',
        message: 'Vous devez être connecté pour accéder à cette ressource.',
        layout: 'layout'
      });
    }

    console.log(`📊 Export Canvas 2026 demandé par ${user.email} (profile_id: ${user.profile_id}, pole_id: ${user.pole_id})`);

    // Construire la requête SQL avec filtrage par pôle ET échéancier 2026
    let query = `
      SELECT v.* 
      FROM vue_export_canevas v
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Si l'utilisateur est coordinateur (profile_id = 4), filtrer par son pôle
    if (user.profile_id === 4) {
      if (!user.pole_id) {
        return res.status(403).render('error', {
          title: 'Pôle non assigné',
          pageTitle: 'Erreur 403',
          message: 'Votre compte n\'a pas de pôle assigné. Veuillez contacter l\'administrateur pour résoudre ce problème.',
          layout: 'layout'
        });
      }
      
      // Filtrer par pôle en utilisant une sous-requête sur la table axes
      query += `
        AND v."Axe" IN (
          SELECT a.lib_axe 
          FROM axes a 
          WHERE a.pole_id = $${paramIndex}
        )
      `;
      params.push(user.pole_id);
      paramIndex++;
      
      console.log(`🔍 Filtrage activé pour pole_id = ${user.pole_id}`);
    } else {
      console.log(`🔓 Pas de filtrage par pôle (profile_id: ${user.profile_id})`);
    }

    // IMPORTANT: Filtrer par échéancier 2026 pour TOUS les utilisateurs
    query += ` AND (v."Echéancier" = $${paramIndex} OR v."Echéancier"::text LIKE '%2026%')`;
    params.push('2026');
    
    console.log(`📅 Filtrage par échéancier = 2026`);

    query += ' ORDER BY v."Num Projet"';

    const result = await db.query(query, params);
    const data = result.rows;

    console.log(`📋 Nombre de projets 2026 à exporter: ${data.length}`);

    // ============================================
    // GESTION ÉLÉGANTE : Aucun projet 2026 trouvé
    // ============================================
    if (!data || data.length === 0) {
      let messageUtilisateur = '';
      let suggestion = '';
      
      if (user.profile_id === 4) {
        // Message pour coordinateur
        messageUtilisateur = `Aucun projet avec l'échéancier 2026 n'a été trouvé pour votre pôle (Pôle ${user.pole_id}).`;
        suggestion = 'Vérifiez que des projets avec l\'échéancier 2026 ont bien été enregistrés dans votre pôle, ou contactez l\'administrateur.';
      } else {
        // Message pour admin/gouverneur/SG
        messageUtilisateur = 'Aucun projet avec l\'échéancier 2026 n\'a été trouvé dans la base de données.';
        suggestion = 'Vérifiez que des projets avec l\'échéancier 2026 ont bien été enregistrés, ou modifiez les échéanciers des projets existants.';
      }
      
      console.log(`⚠️ Aucun projet 2026 trouvé pour ${user.email}`);
      
      return res.render('error', {
        title: 'Aucun projet 2026',
        pageTitle: 'Export Canvas 2026',
        message: messageUtilisateur,
        error: { 
          status: 404,
          stack: suggestion  // Utilise le champ stack pour afficher la suggestion
        },
        layout: 'layout'
      });
    }

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Canevas 2026', { 
      pageSetup: { paperSize: 9, orientation: 'landscape' } 
    });

      const columnHeaders = [
    'Num Projet', 'Axe', 'Secteur', 'Intitulé du Projet', 'Commune', 'Objectifs Globaux',
    'Objectifs du projet (argumentaires)', 'Composantes du projet', 'Consistance du projet (superficie, linéaire,…)',
    'Coût du projet (MDHs)', 'Détail du Coût', 'Nombre d\'emplois direct', 'Détail Nombre d\'Emplois',
    'Nombres des bénéficiaires par catégories cibles', 'Détail Nombre Bénéficiaires', 'Durée du projet (En mois)',
    'Echéancier', 'Année Début', 'Année Fin', 'Maître d\'ouvrage', 'Maître d\'ouvrage délégué',
    'Disponibilité Foncier', 'Si non, visibilité sur sa mobilisation sans contrainte (oui/no',
    'Statut juridique', 'Assiette assainie', 'Etude Disponible', 'Si Oui état d\'avancement',
    'Gestionnaire après achèvement du projet', 'Partenaires', 'Indicateurs à améliorer'
  ];

    worksheet.columns = columnHeaders.map(header => ({
      header: header,
      key: header,
      width: 18
    }));

    // Style de l'en-tête (couleur différente pour 2026)
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

    // Ajouter les données
    data.forEach(row => {
      worksheet.addRow(row);
    });

    worksheet.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75 };

    // Nom du fichier avec indication du pôle pour les coordinateurs
    const poleInfo = user.profile_id === 4 ? `_Pole${user.pole_id}` : '';
    const fileName = `Canevas_Projets_2026${poleInfo}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    console.log(`✅ Export 2026 réussi: ${fileName} (${data.length} projets)`);

    res.download(filePath, fileName, (err) => {
      if (err) console.error('Erreur lors du téléchargement:', err);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Erreur lors de la suppression du fichier:', err);
      });
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'export Canvas 2026:', error);
    res.status(500).render('error', {
      title: 'Erreur lors de l\'export',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'export des projets 2026. Veuillez réessayer ou contacter l\'administrateur.',
      error: process.env.NODE_ENV === 'development' ? error : { status: 500, stack: '' },
      layout: 'layout'
    });
  }
};
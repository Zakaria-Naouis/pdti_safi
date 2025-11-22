// controllers/exportController.js
// VERSION FINALE AVEC CORRECTIONS:
// 1. Colonne "Nombre de Bénéficiaires" - Utiliser nbr_beneficiaires de la table projets
// 2. Nettoyer les entités HTML (&#x27;, &amp;, etc.)

const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs/promises');
const path = require('path');
const db = require('../config/database');
const textCleaner = require('../utils/textCleaner');

// ================================================================
// COLONNES COMMUNES - Utilisées dans Canevas Global ET Canvas 2026
// ================================================================

const COLUMN_HEADERS = [
  'Num Projet', 'Axe', 'Secteur', 'Intitulé du Projet', 'Commune', 
  'Objectifs Globaux',
  'Objectifs du projet (argumentaires)', 'Composantes du projet', 
  'Consistance du projet (superficie, linéaire,…)',
  'Coût du projet (MDHs)', 'Détail du Coût', 
  'Nombre d\'emplois direct', 'Détail Nombre d\'Emplois',
  'Nombre de Bénéficiaires', 'Détail Nombre Bénéficiaires',
  'Durée du projet (En mois)', 'Echéancier', 'Année Début', 'Année Fin',
  'Maître d\'ouvrage', 'Maître d\'ouvrage délégué', 
  'Disponibilité Foncier', 'Si non, visibilité sur sa mobilisation sans contrainte (oui/no',
  'Statut juridique', 'Assiette assainie', 'Etude Disponible', 'Si Oui état d\'avancement',
  'Gestionnaire après achèvement du projet', 'Partenaires',
  'Indicateurs à améliorer'
];

const COLUMN_CONFIG = [
  { key: 'Num Projet', width: 12 },
  { key: 'Axe', width: 28 },
  { key: 'Secteur', width: 22 },
  { key: 'Intitulé du Projet', width: 35 },
  { key: 'Commune', width: 18 },
  { key: 'Objectifs Globaux', width: 25 },
  { key: 'Objectifs du projet (argumentaires)', width: 30 },
  { key: 'Composantes du projet', width: 28 },
  { key: 'Consistance du projet (superficie, linéaire,…)', width: 28 },
  { key: 'Coût du projet (MDHs)', width: 15 },
  { key: 'Détail du Coût', width: 25 },
  { key: 'Nombre d\'emplois direct', width: 15 },
  { key: 'Détail Nombre d\'Emplois', width: 25 },
  { key: 'Nombre de Bénéficiaires', width: 18 },
  { key: 'Détail Nombre Bénéficiaires', width: 25 },
  { key: 'Durée du projet (En mois)', width: 15 },
  { key: 'Echéancier', width: 12 },
  { key: 'Année Début', width: 12 },
  { key: 'Année Fin', width: 12 },
  { key: 'Maître d\'ouvrage', width: 22 },
  { key: 'Maître d\'ouvrage délégué', width: 22 },
  { key: 'Disponibilité Foncier', width: 15 },
  { key: 'Si non, visibilité sur sa mobilisation sans contrainte (oui/no', width: 25 },
  { key: 'Statut juridique', width: 18 },
  { key: 'Assiette assainie', width: 15 },
  { key: 'Etude Disponible', width: 15 },
  { key: 'Si Oui état d\'avancement', width: 20 },
  { key: 'Gestionnaire après achèvement du projet', width: 28 },
  { key: 'Partenaires', width: 30 },
  { key: 'Indicateurs à améliorer', width: 30 }
];

/**
 * CORRECTION 1: Nettoyer les données de la vue
 * - Décoder les entités HTML (&#x27;, &amp;, etc.)
 * - Ajouter nbr_beneficiaires de la table projets
 */
function cleanRowData(row) {
  if (!row) return row;

  const cleaned = { ...row };

  // Fonction pour nettoyer les valeurs texte
  const formatValue = (val) => {
    if (val === null || val === undefined || val === '' || val === 0 || val === '0') {
      return '–';
    }
    if (typeof val === 'string') {
      // Décoder les entités HTML et nettoyer le texte
      return textCleaner.cleanText(val);
    }
    return val;
  };

  // Nettoyer les colonnes de texte (décoder les entités HTML)
  cleaned['Intitulé du Projet'] = formatValue(cleaned['Intitulé du Projet']);
  cleaned['Secteur'] = formatValue(cleaned['Secteur']);
  cleaned['Commune'] = formatValue(cleaned['Commune']);
  cleaned['Objectifs Globaux'] = formatValue(cleaned['Objectifs Globaux']);
  cleaned['Objectifs du projet (argumentaires)'] = textCleaner.cleanTextWithBullets(
    cleaned['Objectifs du projet (argumentaires)']
  );
  cleaned['Composantes du projet'] = textCleaner.cleanTextWithBullets(
    cleaned['Composantes du projet']
  );
  cleaned['Consistance du projet (superficie, linéaire,…)'] = formatValue(
    cleaned['Consistance du projet (superficie, linéaire,…)']
  );
  cleaned['Détail du Coût'] = textCleaner.cleanTextWithBullets(cleaned['Détail du Coût']);
  cleaned['Détail Nombre d\'Emplois'] = textCleaner.cleanTextWithBullets(
    cleaned['Détail Nombre d\'Emplois']
  );
  cleaned['Maître d\'ouvrage'] = formatValue(cleaned['Maître d\'ouvrage']);
  cleaned['Maître d\'ouvrage délégué'] = formatValue(cleaned['Maître d\'ouvrage délégué']);
  cleaned['Détail Nombre Bénéficiaires'] = textCleaner.cleanTextWithBullets(
    cleaned['Détail Nombre Bénéficiaires']
  );
  cleaned['Statut juridique'] = formatValue(cleaned['Statut juridique']);
  cleaned['Gestionnaire après achèvement du projet'] = formatValue(
    cleaned['Gestionnaire après achèvement du projet']
  );
  cleaned['Partenaires'] = textCleaner.cleanTextWithBullets(cleaned['Partenaires']);
  cleaned['Indicateurs à améliorer'] = textCleaner.cleanTextWithBullets(
    cleaned['Indicateurs à améliorer']
  );

  // La vue contient déjà "Nombres des bénéficiaires par catégories cibles"
  // On le mappe vers "Nombre de Bénéficiaires" pour l'Excel
  if (cleaned['Nombres des bénéficiaires par catégories cibles']) {
    cleaned['Nombre de Bénéficiaires'] = cleaned['Nombres des bénéficiaires par catégories cibles'];
  }

  return cleaned;
}

/**
 * Fonction utilitaire: Créer un worksheet Excel avec formatage
 */
function createExcelWorksheet(workbook, sheetName, columnHeaders, columnConfig, headerColor) {
  const worksheet = workbook.addWorksheet(sheetName, { 
    pageSetup: { paperSize: 9, orientation: 'landscape' } 
  });

  // Formatage de l'en-tête
  const headerRow = worksheet.addRow(columnHeaders);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: headerColor }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 35;

  // Configuration des colonnes
  worksheet.columns = columnConfig;

  return worksheet;
}

/**
 * Fonction utilitaire: Ajouter les bordures aux lignes de données
 */
function addBordersToRows(worksheet) {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        };
      });
    }
  });
}

// ================================================================
// EXPORT CANEVAS GLOBAL
// ================================================================

/**
 * Export Canevas Global
 * 
 * Profil Coordinateur (profile_id = 4):
 *   - Exporte uniquement les projets de son Pôle
 *   - Comme chaque pôle = 1 axe, cela filtre automatiquement par Axe
 *   - Triés par Numéro de Projet
 * 
 * Profil Administrateur (profile_id = 1):
 *   - Exporte tous les projets de tous les Axes
 *   - Triés par Axe (ordre ID) puis par Numéro de Projet
 */
exports.exportCanvasGlobal = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).render('error', {
        title: 'Non authentifié',
        pageTitle: 'Erreur 401',
        message: 'Vous devez être connecté pour accéder à cette ressource.'
      });
    }

    console.log(`📊 Export Canevas Global demandé par ${user.email} (profile_id: ${user.profile_id}, pole_id: ${user.pole_id})`);

    // ✅ SOLUTION: La vue contient DÉJÀ toutes les colonnes nécessaires incluant nbr_beneficiaires
    // On évite tout JOIN pour éliminer les doublons
    let query = `
      SELECT 
        v."Num Projet",
        v."Axe",
        v."Secteur",
        v."Intitulé du Projet",
        v."Commune",
        v."Objectifs Globaux",
        v."Objectifs du projet (argumentaires)",
        v."Composantes du projet",
        v."Consistance du projet (superficie, linéaire,…)",
        v."Coût du projet (MDHs)",
        v."Détail du Coût",
        v."Nombre d'emplois direct",
        v."Détail Nombre d'Emplois",
        v."Nombres des bénéficiaires par catégories cibles" AS "Nombre de Bénéficiaires",
        v."Détail Nombre Bénéficiaires",
        v."Durée du projet (En mois)",
        v."Echéancier",
        v."Année Début",
        v."Année Fin",
        v."Maître d'ouvrage",
        v."Maître d'ouvrage délégué",
        v."Disponibilité Foncier",
        v."Si non, visibilité sur sa mobilisation sans contrainte (oui/no",
        v."Statut juridique",
        v."Assiette assainie",
        v."Etude Disponible",
        v."Si Oui état d'avancement",
        v."Gestionnaire après achèvement du projet",
        v."Partenaires",
        v."Indicateurs à améliorer"
      FROM vue_export_canevas v
    `;
    const params = [];

    // Filtrage selon le profil
    if (user.profile_id === 4) {
      // PROFIL COORDINATEUR : Filtrer par Pôle de l'utilisateur
      if (!user.pole_id) {
        return res.status(403).render('error', {
          title: 'Pôle non assigné',
          pageTitle: 'Erreur 403',
          message: 'Votre compte n\'a pas de pôle assigné. Veuillez contacter l\'administrateur.'
        });
      }
      
      // Filtrer par pôle en utilisant une sous-requête sur l'axe
      query += `
        WHERE v."Axe" IN (
          SELECT a.lib_axe 
          FROM axes a 
          WHERE a.pole_id = $1
        )
      `;
      params.push(user.pole_id);
      console.log(`🔍 Filtrage Coordinateur activé pour pole_id = ${user.pole_id}`);
    }

    // Tri : Par axe_id puis par Numéro de Projet
    query += `
      ORDER BY 
        (SELECT a.id FROM axes a WHERE a.lib_axe = v."Axe" LIMIT 1),
        CAST(v."Num Projet" AS INTEGER)
    `;

    const result = await db.query(query, params);
    let data = result.rows;

    console.log(`📋 Nombre de projets à exporter: ${data.length}`);

    if (!data || data.length === 0) {
      const messageUtilisateur = user.profile_id === 4 
        ? `Aucun projet n'a été trouvé pour votre pôle (Pôle ${user.pole_id}).`
        : 'Aucun projet n\'a été trouvé dans la base de données.';
      
      return res.render('error', {
        title: 'Aucun projet à exporter',
        pageTitle: 'Export impossible',
        message: messageUtilisateur,
        error: { status: 404, stack: '' }
      });
    }

    // ✅ CORRECTION: Nettoyer les données (HTML entities)
    data = data.map(row => cleanRowData(row));

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = createExcelWorksheet(workbook, 'Canevas Global', COLUMN_HEADERS, COLUMN_CONFIG, 'FF4472C4');

    // Ajouter les données
    data.forEach(row => {
      const excelRow = worksheet.addRow(row);
      excelRow.alignment = { vertical: 'top', wrapText: true };
      excelRow.height = 22;
    });

    // Ajouter les bordures
    addBordersToRows(worksheet);

    // Envoyer le fichier
    const fileName = user.profile_id === 4 
      ? `Canevas_Global_Pole_${user.pole_id}_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Canevas_Global_PDTI_Safi_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Export Canevas Global réussi - ${data.length} projets (${fileName})`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'export Canevas Global:', error);
    res.status(500).render('error', {
      title: 'Erreur lors de l\'export',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'export. Veuillez réessayer.',
      error: process.env.NODE_ENV === 'development' ? error : { status: 500, stack: '' }
    });
  }
};

// ================================================================
// EXPORT CANVAS 2026
// ================================================================

/**
 * Export Canvas 2026
 * 
 * ✅ CORRECTION: Export TOUS les 30 colonnes (identiques au Canevas Global)
 * Filtre les projets avec "Année Début" = 2026 (colonne INTEGER)
 * 
 * Profil Coordinateur (profile_id = 4):
 *   - Exporte uniquement les projets 2026 de son Pôle
 *   - Triés par Numéro de Projet
 * 
 * Profil Administrateur (profile_id = 1):
 *   - Exporte tous les projets 2026 de tous les Axes
 *   - Triés par Axe (ordre ID) puis par Numéro de Projet
 */
exports.exportCanvas2026 = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).render('error', {
        title: 'Non authentifié',
        pageTitle: 'Erreur 401',
        message: 'Vous devez être connecté pour accéder à cette ressource.'
      });
    }

    console.log(`📊 Export Canvas 2026 demandé par ${user.email} (profile_id: ${user.profile_id}, pole_id: ${user.pole_id})`);

    // ✅ SOLUTION: Utiliser uniquement la vue sans JOIN pour éviter les doublons
    let query = `
      SELECT 
        v."Num Projet",
        v."Axe",
        v."Secteur",
        v."Intitulé du Projet",
        v."Commune",
        v."Objectifs Globaux",
        v."Objectifs du projet (argumentaires)",
        v."Composantes du projet",
        v."Consistance du projet (superficie, linéaire,…)",
        v."Coût du projet (MDHs)",
        v."Détail du Coût",
        v."Nombre d'emplois direct",
        v."Détail Nombre d'Emplois",
        v."Nombres des bénéficiaires par catégories cibles" AS "Nombre de Bénéficiaires",
        v."Détail Nombre Bénéficiaires",
        v."Durée du projet (En mois)",
        v."Echéancier",
        v."Année Début",
        v."Année Fin",
        v."Maître d'ouvrage",
        v."Maître d'ouvrage délégué",
        v."Disponibilité Foncier",
        v."Si non, visibilité sur sa mobilisation sans contrainte (oui/no",
        v."Statut juridique",
        v."Assiette assainie",
        v."Etude Disponible",
        v."Si Oui état d'avancement",
        v."Gestionnaire après achèvement du projet",
        v."Partenaires",
        v."Indicateurs à améliorer"
      FROM vue_export_canevas v
      WHERE v."Année Début" = 2026
      AND v."Année Fin" = 2026
    `;
    const params = [];

    // Filtrage selon le profil
    if (user.profile_id === 4) {
      // PROFIL COORDINATEUR : Filtrer par Pôle de l'utilisateur
      if (!user.pole_id) {
        return res.status(403).render('error', {
          title: 'Pôle non assigné',
          pageTitle: 'Erreur 403',
          message: 'Votre compte n\'a pas de pôle assigné. Veuillez contacter l\'administrateur.'
        });
      }
      
      query += `
        AND v."Axe" IN (
          SELECT a.lib_axe 
          FROM axes a 
          WHERE a.pole_id = $1
        )
      `;
      params.push(user.pole_id);
      console.log(`🔍 Filtrage Coordinateur activé pour pole_id = ${user.pole_id}`);
    }

    // Tri : Par axe_id puis par Numéro de Projet
    query += `
      ORDER BY 
        (SELECT a.id FROM axes a WHERE a.lib_axe = v."Axe" LIMIT 1),
        CAST(v."Num Projet" AS INTEGER)
    `;

    const result = await db.query(query, params);
    let data = result.rows;

    console.log(`📋 Projets 2026 à exporter: ${data.length}`);

    if (!data || data.length === 0) {
      const messageUtilisateur = user.profile_id === 4 
        ? `Aucun projet 2026 n'a été trouvé pour votre pôle.`
        : 'Aucun projet 2026 n\'a été trouvé dans la base de données.';
      
      return res.render('error', {
        title: 'Aucun projet 2026 à exporter',
        pageTitle: 'Export impossible',
        message: messageUtilisateur,
        error: { status: 404, stack: '' }
      });
    }

    // ✅ CORRECTION: Nettoyer les données (HTML entities)
    data = data.map(row => cleanRowData(row));

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    // ✅ CORRECTION: Utiliser les MÊMES colonnes que Canevas Global (30 colonnes)
    const worksheet = createExcelWorksheet(workbook, 'Canvas 2026', COLUMN_HEADERS, COLUMN_CONFIG, 'FF70AD47');

    // Ajouter les données - TOUTES LES COLONNES
    data.forEach(row => {
      const excelRow = worksheet.addRow(row);
      excelRow.alignment = { vertical: 'top', wrapText: true };
      excelRow.height = 22;
    });

    // Ajouter les bordures
    addBordersToRows(worksheet);

    // Envoyer le fichier
    const fileName = user.profile_id === 4 
      ? `Canvas_2026_Pole_${user.pole_id}_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Canvas_2026_PDTI_Safi_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Export Canvas 2026 réussi - ${data.length} projets (${fileName}) - TOUTES LES COLONNES INCLUSES`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'export Canvas 2026:', error);
    res.status(500).render('error', {
      title: 'Erreur lors de l\'export',
      pageTitle: 'Erreur 500',
      message: 'Une erreur est survenue lors de l\'export. Veuillez réessayer.',
      error: process.env.NODE_ENV === 'development' ? error : { status: 500, stack: '' }
    });
  }
};

// ================================================================
// EXPORT FICHES PROJETS PAR AXE (PDF)
// ================================================================

/**
 * Export Fiches Projets par Axe en PDF
 */
exports.exportFichesParAxe = async (req, res) => {
  try {
    const axeId = parseInt(req.params.axeId);
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (!axeId || isNaN(axeId)) {
      return res.status(400).json({ error: 'ID d\'axe invalide' });
    }

    console.log(`📄 Export Fiches Projets - Axe ${axeId} demandé par ${user.email}`);

    // Vérification des permissions pour les coordinateurs
    if (user.profile_id === 4 && user.pole_id) {
      const axeCheckQuery = `
        SELECT id FROM axes WHERE id = $1 AND pole_id = $2
      `;
      const axeCheckResult = await db.query(axeCheckQuery, [axeId, user.pole_id]);
      
      if (axeCheckResult.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Vous n\'avez pas la permission d\'exporter les fiches de cet axe',
          userPoleId: user.pole_id,
          requestedAxeId: axeId
        });
      }
    }

    // Récupérer le nom de l'axe d'abord
    const axeQuery = `SELECT lib_axe FROM axes WHERE id = $1`;
    const axeResult = await db.query(axeQuery, [axeId]);
    
    if (axeResult.rows.length === 0) {
      return res.status(404).json({ 
        error: `Axe ${axeId} non trouvé` 
      });
    }
    
    const libAxe = axeResult.rows[0].lib_axe;

    // Récupérer les projets de l'axe - UNIQUEMENT depuis la vue
    const query = `
      SELECT 
        v."Num Projet",
        v."Axe",
        v."Secteur",
        v."Intitulé du Projet",
        v."Commune",
        v."Objectifs Globaux",
        v."Objectifs du projet (argumentaires)",
        v."Composantes du projet",
        v."Consistance du projet (superficie, linéaire,…)",
        v."Coût du projet (MDHs)",
        v."Détail du Coût",
        v."Nombre d'emplois direct",
        v."Détail Nombre d'Emplois",
        v."Nombres des bénéficiaires par catégories cibles" AS "Nombre de Bénéficiaires",
        v."Détail Nombre Bénéficiaires",
        v."Durée du projet (En mois)",
        v."Echéancier",
        v."Année Début",
        v."Année Fin",
        v."Maître d'ouvrage",
        v."Maître d'ouvrage délégué",
        v."Disponibilité Foncier",
        v."Si non, visibilité sur sa mobilisation sans contrainte (oui/no",
        v."Statut juridique",
        v."Assiette assainie",
        v."Etude Disponible",
        v."Si Oui état d'avancement",
        v."Gestionnaire après achèvement du projet",
        v."Partenaires",
        v."Indicateurs à améliorer"
      FROM vue_export_canevas v
      WHERE v."Axe" = $1
      ORDER BY CAST(v."Num Projet" AS INTEGER)
    `;

    const result = await db.query(query, [libAxe]);
    let projets = result.rows;

    console.log(`📊 Projets trouvés pour l'axe ${axeId}: ${projets.length}`);

    if (!projets || projets.length === 0) {
      return res.status(404).json({ 
        error: `Aucun projet trouvé pour l'axe ${axeId}`,
        axeId: axeId
      });
    }

    // Configuration des couleurs par axe
    const axeColors = {
      1: { 
        main: '#BF9000', 
        light: '#FFF8E7', 
        grid: '#D4A017', 
        name: 'Investissements et emplois' 
      },
      2: { 
        main: '#DD6615', 
        light: '#FFE8D6', 
        grid: '#E87E2E', 
        name: 'Renforcement et amélioration des services sociaux de base : Education' 
      },
      3: { 
        main: '#385623', 
        light: '#E8F0E0', 
        grid: '#5A7A3D', 
        name: 'Renforcement des services sociaux de base : Santé' 
      },
      4: { 
        main: '#002060', 
        light: '#E6E6F0', 
        grid: '#003399', 
        name: 'Gestion Proactive et durable des ressources en eau' 
      },
      5: { 
        main: '#595959', 
        light: '#F0F0F0', 
        grid: '#808080', 
        name: 'Infrastructures de base et mise à niveau' 
      }
    };

    const color = axeColors[axeId] || { 
      main: '#666666', 
      light: '#F8F8F8', 
      grid: '#CCCCCC',
      name: projets[0]?.Axe || libAxe || 'Axe Stratégique' 
    };

    console.log(`🎨 Axe ${axeId} - ${color.name} (${color.main}) - ${projets.length} projets`);

    // ✅ CORRECTION: Nettoyer les données (HTML entities + nbr_beneficiaires)
    const cleanedProjets = projets.map(projet => {
      const cleaned = cleanRowData(projet);
      return cleaned;
    });

    // Chemin vers le template EJS
    const templatePath = path.join(__dirname, '../views/fiches-projets-template.ejs');
    
    try {
      await fs.access(templatePath);
    } catch (err) {
      console.error('❌ Template non trouvé:', templatePath);
      return res.status(500).json({ 
        error: 'Template de fiche projet non trouvé',
        path: templatePath 
      });
    }

    // Rendu du HTML avec EJS
    console.log('🔨 Génération du HTML avec EJS...');
    const html = await ejs.renderFile(templatePath, { 
      projets: cleanedProjets,
      color, 
      axeId 
    });

    // Génération du PDF avec Puppeteer
    console.log('🚀 Lancement de Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-accelerated-2d-canvas', 
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    console.log('📄 Génération du PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });

    await browser.close();
    console.log('✅ PDF généré avec succès');

    // Envoyer le fichier
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Fiches_Projets_Axe${axeId}_${color.name.replace(/\s+/g, '_').replace(/:/g, '')}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);

    console.log(`✅ Export réussi: ${fileName} (${projets.length} projets)`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'export des Fiches Projets:', error);
    console.error('Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Erreur lors de l\'export PDF',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = exports;
// ================================================================
// EXPORT FICHES PROJETS 2026 PAR AXE (PDF)
// ================================================================

/**
 * Export Fiches Projets 2026 par Axe en PDF
 * Filtre les projets avec date_debut = 2026
 */
exports.exportFichesParAxe2026 = async (req, res) => {
  try {
    const axeId = parseInt(req.params.axeId);
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (!axeId || isNaN(axeId)) {
      return res.status(400).json({ error: 'ID d\'axe invalide' });
    }

    console.log(`📄 Export Fiches Projets 2026 - Axe ${axeId} demandé par ${user.email}`);

    // Vérification des permissions pour les coordinateurs
    if (user.profile_id === 4 && user.pole_id) {
      const axeCheckQuery = `
        SELECT id FROM axes WHERE id = $1 AND pole_id = $2
      `;
      const axeCheckResult = await db.query(axeCheckQuery, [axeId, user.pole_id]);
      
      if (axeCheckResult.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Vous n\'avez pas la permission d\'exporter les fiches de cet axe',
          userPoleId: user.pole_id,
          requestedAxeId: axeId
        });
      }
    }

    // Récupérer le nom de l'axe
    const axeQuery = `SELECT lib_axe FROM axes WHERE id = $1`;
    const axeResult = await db.query(axeQuery, [axeId]);
    
    if (axeResult.rows.length === 0) {
      return res.status(404).json({ 
        error: `Axe ${axeId} non trouvé` 
      });
    }
    
    const libAxe = axeResult.rows[0].lib_axe;

    // Récupérer les projets 2026 de l'axe
    const query = `
      SELECT 
        v."Num Projet",
        v."Axe",
        v."Secteur",
        v."Intitulé du Projet",
        v."Commune",
        v."Objectifs Globaux",
        v."Objectifs du projet (argumentaires)",
        v."Composantes du projet",
        v."Consistance du projet (superficie, linéaire,…)",
        v."Coût du projet (MDHs)",
        v."Détail du Coût",
        v."Nombre d'emplois direct",
        v."Détail Nombre d'Emplois",
        v."Nombres des bénéficiaires par catégories cibles" AS "Nombre de Bénéficiaires",
        v."Détail Nombre Bénéficiaires",
        v."Durée du projet (En mois)",
        v."Echéancier",
        v."Année Début",
        v."Année Fin",
        v."Maître d'ouvrage",
        v."Maître d'ouvrage délégué",
        v."Disponibilité Foncier",
        v."Si non, visibilité sur sa mobilisation sans contrainte (oui/no",
        v."Statut juridique",
        v."Assiette assainie",
        v."Etude Disponible",
        v."Si Oui état d'avancement",
        v."Gestionnaire après achèvement du projet",
        v."Partenaires",
        v."Indicateurs à améliorer"
      FROM vue_export_canevas v
      WHERE v."Axe" = $1
        AND v."Année Début" = '2026'
        AND v."Année Fin" = 2026
      ORDER BY CAST(v."Num Projet" AS INTEGER)
    `;

    const result = await db.query(query, [libAxe]);
    let projets = result.rows;

    console.log(`📊 Projets 2026 trouvés pour l'axe ${axeId}: ${projets.length}`);

    if (!projets || projets.length === 0) {
      return res.status(404).json({ 
        error: `Aucun projet 2026 trouvé pour l'axe ${axeId}`,
        axeId: axeId
      });
    }

    // Configuration des couleurs par axe
    const axeColors = {
      1: { 
        main: '#BF9000', 
        light: '#FFF8E7', 
        grid: '#D4A017', 
        name: 'Investissements et emplois' 
      },
      2: { 
        main: '#DD6615', 
        light: '#FFE8D6', 
        grid: '#E87E2E', 
        name: 'Renforcement et amélioration des services sociaux de base : Education' 
      },
      3: { 
        main: '#385623', 
        light: '#E8F0E0', 
        grid: '#5A7A3D', 
        name: 'Renforcement des services sociaux de base : Santé' 
      },
      4: { 
        main: '#002060', 
        light: '#E6E6F0', 
        grid: '#003399', 
        name: 'Gestion Proactive et durable des ressources en eau' 
      },
      5: { 
        main: '#595959', 
        light: '#F0F0F0', 
        grid: '#808080', 
        name: 'Infrastructures de base et mise à niveau' 
      }
    };

    const color = axeColors[axeId] || { 
      main: '#666666', 
      light: '#F8F8F8', 
      grid: '#CCCCCC',
      name: projets[0]?.Axe || libAxe || 'Axe Stratégique' 
    };

    console.log(`🎨 Axe ${axeId} - ${color.name} (${color.main}) - ${projets.length} projets 2026`);

    // Nettoyer les données
    const cleanedProjets = projets.map(projet => {
      const cleaned = cleanRowData(projet);
      return cleaned;
    });

    // Chemin vers le template EJS
    const templatePath = path.join(__dirname, '../views/fiches-projets-template.ejs');
    
    try {
      await fs.access(templatePath);
    } catch (err) {
      console.error('❌ Template non trouvé:', templatePath);
      return res.status(500).json({ 
        error: 'Template de fiche projet non trouvé',
        path: templatePath 
      });
    }

    // Rendu du HTML avec EJS
    console.log('🔨 Génération du HTML avec EJS...');
    const html = await ejs.renderFile(templatePath, { 
      projets: cleanedProjets,
      color, 
      axeId 
    });

    // Génération du PDF avec Puppeteer
    console.log('🚀 Lancement de Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-accelerated-2d-canvas', 
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    console.log('📄 Génération du PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });

    await browser.close();
    console.log('✅ PDF généré avec succès');

    // Envoyer le fichier
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Fiches_Projets_2026_Axe${axeId}_${color.name.replace(/\s+/g, '_').replace(/:/g, '')}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);

    console.log(`✅ Export 2026 réussi: ${fileName} (${projets.length} projets)`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'export des Fiches Projets 2026:', error);
    console.error('Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Erreur lors de l\'export PDF 2026',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ================================================================
// EXPORTS POUR PROFIL PACHA (profile_id = 7)
// ================================================================

/**
 * Export Canevas Global pour Pacha
 * Tous les projets du cercle (code_cercle)
 */
/**
 * Export Canevas Global pour Pacha - VERSION CORRIGÉE
 * Le problème: La table communes n'a PAS de colonne libelle_cercle
 * Solution: Utiliser nom_fr de la table communes comme nom du pachalik
 */
// ================================================================
// EXPORTS POUR PROFIL PACHA (profile_id = 7)
// ================================================================

/**
 * Export Canevas Global pour Pacha - VERSION CORRIGÉE DÉFINITIVE
 */
exports.exportCanvasGlobalPacha = async (req, res) => {
  try {
    console.log('[exportCanvasGlobalPacha] Début export Pacha');
    
    if (req.user.profile_id !== 7 && req.user.profile_id !== 8) {
      return res.status(403).json({ error: 'Accès réservé au profil Pacha' });
    }
    
    if (!req.user.code_cercle) {
      return res.status(403).json({ error: 'Code cercle manquant' });
    }
    
    const codeCercle = req.user.code_cercle;
    console.log(`[exportCanvasGlobalPacha] Code cercle: ${codeCercle}`);
    
    // Récupérer le nom du pachalik
  const cercleResult = await db.query(`
  SELECT 
    code_cercle,
    nom_cercle_fr
  FROM cercles
  WHERE code_cercle = $1
  LIMIT 1
`, [codeCercle]);

const nomCercle = cercleResult.rows[0]?.nom_cercle_fr || `Cercle_${codeCercle}`;
 
    console.log(`[exportCanvasGlobalPacha] Nom du cercle: ${nomCercle}`);
    
    // ✅ REQUÊTE CORRIGÉE avec les bons noms de colonnes et bons JOINS
    const result = await db.query(`
      WITH projets_cercle AS (
        SELECT DISTINCT p.id
        FROM projets p
        JOIN projets_communes pc ON p.id = pc.projet_id
        JOIN communes c ON pc.commune_id = c.id
        WHERE c.code_cercle = $1
      ),
      communes_par_projet AS (
        SELECT 
          pc.projet_id,
          STRING_AGG(DISTINCT c.nom_fr, ', ' ORDER BY c.nom_fr) as communes
        FROM projets_communes pc
        JOIN communes c ON pc.commune_id = c.id
        WHERE c.code_cercle = $1
        GROUP BY pc.projet_id
      ),
      partenaires_par_projet AS (
        SELECT 
          pp.projet_id,
          STRING_AGG(DISTINCT part.nom_partenaire, ', ' ORDER BY part.nom_partenaire) as partenaires
        FROM projets_partenaires pp
        JOIN partenaires part ON pp.partenaire_id = part.id
        GROUP BY pp.projet_id
      )
      SELECT 
        p.num_projet AS "Num Projet",
        a.lib_axe AS "Axe",
        s.lib_secteur AS "Secteur",
        p.intitule AS "Intitulé du Projet",
        cpp.communes AS "Commune",
        o.nom_objectif AS "Objectifs Globaux",
        p.objectifs AS "Objectifs du projet (argumentaires)",
        p.composantes AS "Composantes du projet",
        p.superficie_lineaire AS "Consistance du projet (superficie, linéaire,…)",
        p.cout_total_mdh AS "Coût du projet (MDHs)",
        p.detail_cout AS "Détail du Coût",
        p.nbr_emplois_directs AS "Nombre d'emplois direct",
        p.detail_nbr_emploi AS "Détail Nombre d'Emplois",
        p.nbr_beneficiaires AS "Nombre de Bénéficiaires",
        p.detail_nbr_beneficiaires AS "Détail Nombre Bénéficiaires",
        p.duree_mois AS "Durée du projet (En mois)",
        p.echeancier AS "Echéancier",
        p.annee_debut AS "Année Début",
        p.annee_fin AS "Année Fin",
        moa.nom_moa AS "Maître d'ouvrage",
        moe.nom_moe AS "Maître d'ouvrage délégué",
        CASE WHEN p.fc_disponibilite = true THEN 'Oui' ELSE 'Non' END AS "Disponibilité Foncier",
        CASE WHEN p.fc_visibilite = true THEN 'Oui' ELSE 'Non' END AS "Si non, visibilité sur sa mobilisation sans contrainte (oui/no",
        sj.lib_statut AS "Statut juridique",
        CASE WHEN p.fc_assiette_assine = true THEN 'Oui' ELSE 'Non' END AS "Assiette assainie",
        CASE WHEN p.etude = true THEN 'Oui' ELSE 'Non' END AS "Etude Disponible",
        p.etude_etat AS "Si Oui état d'avancement",
        gp.nom_gestionnaire AS "Gestionnaire après achèvement du projet",
        ppp.partenaires AS "Partenaires",
        p.indicateurs AS "Indicateurs à améliorer",
        a.id AS "Code Axe"
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN secteurs s ON p.secteur_id = s.id
      LEFT JOIN objectifs o ON p.objectif_id = o.id
      LEFT JOIN communes_par_projet cpp ON p.id = cpp.projet_id
      LEFT JOIN moa moa ON p.moa_id = moa.id
      LEFT JOIN moe moe ON p.moe_id = moe.id
      LEFT JOIN statuts_juridiques sj ON p.statut_juridique_id = sj.id
      LEFT JOIN gestionnaires_projets gp ON p.gestionnaire_projet_id = gp.id
      LEFT JOIN partenaires_par_projet ppp ON p.id = ppp.projet_id
      WHERE p.id IN (SELECT id FROM projets_cercle)
      ORDER BY a.id, p.num_projet
    `, [codeCercle]);
    
    console.log(`[exportCanvasGlobalPacha] ${result.rows.length} lignes trouvées`);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Aucun projet trouvé pour ce pachalik',
        code_cercle: codeCercle,
        nom_cercle: nomCercle
      });
    }

    // ✅ CORRECTION: Nettoyer les données (HTML entities)
    const data = result.rows.map(row => cleanRowData(row));

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = createExcelWorksheet(workbook, `Canevas Global ${nomCercle}`, COLUMN_HEADERS, COLUMN_CONFIG, 'FF4472C4');

    // Ajouter les données
    data.forEach(row => {
      const excelRow = worksheet.addRow(row);
      excelRow.alignment = { vertical: 'top', wrapText: true };
      excelRow.height = 22;
    });

    // Ajouter les bordures
    addBordersToRows(worksheet);

    // Envoyer le fichier
    const fileName = `Canevas_Global_${nomCercle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Export Canevas Global Pacha réussi - ${data.length} projets (${fileName})`);

  } catch (error) {
    console.error('[exportCanvasGlobalPacha] Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'export',
      message: error.message 
    });
  }
};

/**
 * Export Canvas 2026 pour Pacha - VERSION CORRIGÉE DÉFINITIVE
 */
exports.exportCanvas2026Pacha = async (req, res) => {
  try {
    console.log('[exportCanvas2026Pacha] Début export Pacha 2026');
    
    if (req.user.profile_id !== 7 && req.user.profile_id !== 8) {
  return res.status(403).json({ error: 'Accès réservé aux profils Pacha et Chef Cercle' });
    }
    
    if (!req.user.code_cercle) {
      return res.status(403).json({ error: 'Code cercle manquant' });
    }
    
    const codeCercle = req.user.code_cercle;
    console.log(`[exportCanvas2026Pacha] Code cercle: ${codeCercle}`);
    
    // Récupérer le nom du pachalik
    const cercleResult = await db.query(`
    SELECT 
      code_cercle,
      nom_cercle_fr
    FROM cercles
    WHERE code_cercle = $1
    LIMIT 1
  `, [codeCercle]);

    const nomCercle = cercleResult.rows[0]?.nom_cercle_fr || `Cercle_${codeCercle}`;
    console.log(`[exportCanvas2026Pacha] Nom du cercle: ${nomCercle}`);

    
    // ✅ REQUÊTE CORRIGÉE avec les bons noms de colonnes et bons JOINS
    const result = await db.query(`
      WITH projets_cercle AS (
        SELECT DISTINCT p.id
        FROM projets p
        JOIN projets_communes pc ON p.id = pc.projet_id
        JOIN communes c ON pc.commune_id = c.id
        WHERE c.code_cercle = $1
        AND p.annee_debut = 2026
        AND p.annee_fin = 2026
      ),
      communes_par_projet AS (
        SELECT 
          pc.projet_id,
          STRING_AGG(DISTINCT c.nom_fr, ', ' ORDER BY c.nom_fr) as communes
        FROM projets_communes pc
        JOIN communes c ON pc.commune_id = c.id
        WHERE c.code_cercle = $1
        GROUP BY pc.projet_id
      ),
      partenaires_par_projet AS (
        SELECT 
          pp.projet_id,
          STRING_AGG(DISTINCT part.nom_partenaire, ', ' ORDER BY part.nom_partenaire) as partenaires
        FROM projets_partenaires pp
        JOIN partenaires part ON pp.partenaire_id = part.id
        GROUP BY pp.projet_id
      )
      SELECT 
        p.num_projet AS "Num Projet",
        a.lib_axe AS "Axe",
        s.lib_secteur AS "Secteur",
        p.intitule AS "Intitulé du Projet",
        cpp.communes AS "Commune",
        o.nom_objectif AS "Objectifs Globaux",
        p.objectifs AS "Objectifs du projet (argumentaires)",
        p.composantes AS "Composantes du projet",
        p.superficie_lineaire AS "Consistance du projet (superficie, linéaire,…)",
        p.cout_total_mdh AS "Coût du projet (MDHs)",
        p.detail_cout AS "Détail du Coût",
        p.nbr_emplois_directs AS "Nombre d'emplois direct",
        p.detail_nbr_emploi AS "Détail Nombre d'Emplois",
        p.nbr_beneficiaires AS "Nombre de Bénéficiaires",
        p.detail_nbr_beneficiaires AS "Détail Nombre Bénéficiaires",
        p.duree_mois AS "Durée du projet (En mois)",
        p.echeancier AS "Echéancier",
        p.annee_debut AS "Année Début",
        p.annee_fin AS "Année Fin",
        moa.nom_moa AS "Maître d'ouvrage",
        moe.nom_moe AS "Maître d'ouvrage délégué",
        CASE WHEN p.fc_disponibilite = true THEN 'Oui' ELSE 'Non' END AS "Disponibilité Foncier",
        CASE WHEN p.fc_visibilite = true THEN 'Oui' ELSE 'Non' END AS "Si non, visibilité sur sa mobilisation sans contrainte (oui/no",
        sj.lib_statut AS "Statut juridique",
        CASE WHEN p.fc_assiette_assine = true THEN 'Oui' ELSE 'Non' END AS "Assiette assainie",
        CASE WHEN p.etude = true THEN 'Oui' ELSE 'Non' END AS "Etude Disponible",
        p.etude_etat AS "Si Oui état d'avancement",
        gp.nom_gestionnaire AS "Gestionnaire après achèvement du projet",
        ppp.partenaires AS "Partenaires",
        p.indicateurs AS "Indicateurs à améliorer",
        a.id AS "Code Axe"
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN secteurs s ON p.secteur_id = s.id
      LEFT JOIN objectifs o ON p.objectif_id = o.id
      LEFT JOIN communes_par_projet cpp ON p.id = cpp.projet_id
      LEFT JOIN moa moa ON p.moa_id = moa.id
      LEFT JOIN moe moe ON p.moe_id = moe.id
      LEFT JOIN statuts_juridiques sj ON p.statut_juridique_id = sj.id
      LEFT JOIN gestionnaires_projets gp ON p.gestionnaire_projet_id = gp.id
      LEFT JOIN partenaires_par_projet ppp ON p.id = ppp.projet_id
      WHERE p.id IN (SELECT id FROM projets_cercle)
      ORDER BY a.id, p.num_projet
    `, [codeCercle]);
    
    console.log(`[exportCanvas2026Pacha] ${result.rows.length} projets 2026 trouvés`);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Aucun projet 2026 trouvé pour ce pachalik/Cercle',
        code_cercle: codeCercle,
        nom_cercle: nomCercle
      });
    }

    // ✅ CORRECTION: Nettoyer les données (HTML entities)
    const data = result.rows.map(row => cleanRowData(row));

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = createExcelWorksheet(workbook, `Canvas 2026 ${nomCercle}`, COLUMN_HEADERS, COLUMN_CONFIG, 'FF70AD47');

    // Ajouter les données
    data.forEach(row => {
      const excelRow = worksheet.addRow(row);
      excelRow.alignment = { vertical: 'top', wrapText: true };
      excelRow.height = 22;
    });

    // Ajouter les bordures
    addBordersToRows(worksheet);

    // Envoyer le fichier
    const fileName = `Canvas_2026_${nomCercle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Export Canvas 2026 Pacha réussi - ${data.length} projets (${fileName})`);

  } catch (error) {
    console.error('[exportCanvas2026Pacha] Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'export',
      message: error.message 
    });
  }
};
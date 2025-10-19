// test-db.js
const db = require('./config/database');

async function testAxeProjects() {
  try {
    console.log('=== TEST DE RÉCUPÉRATION DES PROJETS PAR AXE ===\n');
    
    // Test pour l'axe 2
    const axeId = 2;
    console.log(`1. Test pour l'axe ${axeId}:\n`);
    
    const result = await db.query(`
      SELECT 
        p.id,
        p.num_projet,
        p.intitule,
        p.cout_total_mdh,
        p.nbr_emplois_directs,
        p.nbr_beneficiaires,
        p.annee_debut,
        p.annee_fin,
        p.axe_id,
        a.lib_axe,
        s.id as secteur_id,
        s.lib_secteur,
        po.id as pole_id,
        po.lib_pole
      FROM projets p
      JOIN axes a ON p.axe_id = a.id
      JOIN secteurs s ON p.secteur_id = s.id
      JOIN poles po ON a.pole_id = po.id
      WHERE p.axe_id = $1
      ORDER BY p.num_projet ASC
    `, [axeId]);
    
    console.log(`   Nombre de projets trouvés: ${result.rows.length}\n`);
    
    if (result.rows.length > 0) {
      console.log('   Premiers projets:');
      result.rows.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. Projet ${p.num_projet}: ${p.intitule.substring(0, 50)}...`);
      });
    }
    
    console.log('\n2. Liste de tous les axes:\n');
    const axes = await db.query('SELECT id, lib_axe FROM axes ORDER BY id');
    axes.rows.forEach(axe => {
      console.log(`   Axe ${axe.id}: ${axe.lib_axe}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('ERREUR:', error);
    process.exit(1);
  }
}

testAxeProjects();
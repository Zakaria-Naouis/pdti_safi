// config/database.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});
/*const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});*/


// Test de la connexion
pool.on('connect', () => {
  console.log('Connecté à PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Erreur de connexion à PostgreSQL', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  end: () => pool.end(),
};
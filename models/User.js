const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * User class that handles user-related database operations
 * Contains static methods for finding, creating, and verifying users
 */
class User {
  /**
   * Find a user by their email address
   * @param {string} email - The email address to search for
   * @returns {Promise<Object|null>} - Returns the user object if found, null otherwise
   */
  static async findByEmail(email) {
    const result = await db.query('SELECT * FROM utilisateurs WHERE email = $1', [email]);
    return result.rows[0];
  }

  /**
   * Find a user by their ID
   * @param {number} id - The user ID to search for
   * @returns {Promise<Object|null>} - Returns the user object if found, null otherwise
   */
  static async findById(id) {
    const result = await db.query(`
      SELECT 
        u.*, 
        p.lib_pole,
        u.code_cercle
      FROM utilisateurs u 
      LEFT JOIN poles p ON u.pole_id = p.id 
      WHERE u.id = $1
    `, [id]);
    return result.rows[0];
  }

  /**
   * Create a new user in the database
   * @param {Object} userData - User data containing nom, prenom, email, mot_de_passe, profile_id, pole_id, and code_cercle
   * @returns {Promise<Object>} - Returns the newly created user object
   */
  static async create(userData) {
    const { nom, prenom, email, mot_de_passe, profile_id, pole_id, code_cercle } = userData;
    // Hachage du mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(mot_de_passe, saltRounds);

    const result = await db.query(
      'INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, profile_id, pole_id, code_cercle) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [nom, prenom, email, hashedPassword, profile_id, pole_id, code_cercle]
    );
    return result.rows[0];
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async getProfilePermissions(profileId) {
    try {
      if (!profileId) {
        throw new Error('ID de profil non fourni');
      }
      
      const result = await db.query(
        `SELECT p.lib_permission
        FROM permissions p
        JOIN profile_permissions pp ON p.id = pp.permission_id
        WHERE pp.profile_id = $1`,
        [profileId]
      );
      
      return result.rows.map(row => row.lib_permission);
    } catch (error) {
      console.error('Erreur lors de la récupération des permissions:', error);
      return []; // Retourner un tableau vide en cas d'erreur
    }
  }
}

module.exports = User;

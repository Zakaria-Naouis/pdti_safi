// models/Instruction.js - Version corrigée et améliorée
const db = require('../config/database');

/**
 * Represents an Instruction with various database operations.
 * This class provides static methods to interact with the instructions table in the database.
 */
class Instruction {
  /**
   * Retrieve all instructions with optional filters
   * @param {Object} filters - Optional filters for the query
   * @returns {Promise<Array>} - Array of instruction records
   */
  static async findAll(filters = {}) {
    // Base SQL query to select all instructions with related user and status information
    let query = `
      SELECT i.*, 
             e.nom as emetteur_nom, e.prenom as emetteur_prenom,
             d.nom as destinataire_nom, d.prenom as destinataire_prenom,
             s.lib_statut,
             s.id as statut_id
      FROM instructions i
      JOIN utilisateurs e ON i.emetteur_id = e.id
      JOIN utilisateurs d ON i.destinataire_id = d.id
      JOIN statuts_instructions s ON i.statut_id = s.id
    `;
    const params = [];
    const conditions = [];

    // Filtrer par émetteur si spécifié
    if (filters.emetteur_id) {
      conditions.push(`i.emetteur_id = $${params.length + 1}`);
      params.push(filters.emetteur_id);
    }

    // Filtrer par destinataire si spécifié
    if (filters.destinataire_id) {
      conditions.push(`i.destinataire_id = $${params.length + 1}`);
      params.push(filters.destinataire_id);
    }

    // Filtrer par statut si spécifié
    if (filters.statut_id) {
      conditions.push(`i.statut_id = $${params.length + 1}`);
      params.push(filters.statut_id);
    }

    // Filtrer par période si spécifié
    if (filters.date_debut) {
      conditions.push(`i.date_instruction >= $${params.length + 1}`);
      params.push(filters.date_debut);
    }

    if (filters.date_fin) {
      conditions.push(`i.date_instruction <= $${params.length + 1}`);
      params.push(filters.date_fin);
    }

    // Recherche textuelle si spécifiée
    if (filters.search) {
      conditions.push(`(i.sujet ILIKE $${params.length + 1} OR i.num_instruction ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY i.date_instruction DESC, i.id DESC';

    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des instructions:', error);
      throw error;
    }
  }

  /**
   * Find a record by its ID in the database
   * @param {number} id - The unique identifier of the record to find
   * @returns {Promise<object>} - A promise that resolves to the found record
   */
  static async findById(id) {
    try {
      // Execute a SQL query to find a record with the given ID
      const result = await db.query('SELECT * FROM instructions WHERE id = $1', [id]);
      // Return the first row from the query result
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'instruction par ID:', error);
      throw error;
    }
  }

  /**
   * Find an instruction by its number
   * @param {string} numInstruction - The instruction number
   * @returns {Promise<object>} - A promise that resolves to the found record
   */
  static async findByNumber(numInstruction) {
    try {
      const result = await db.query('SELECT * FROM instructions WHERE num_instruction = $1', [numInstruction]);
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'instruction par numéro:', error);
      throw error;
    }
  }

  /**
   * Static method to create a new instruction in the database
   * @param {Object} instructionData - An object containing all necessary fields for creating an instruction
   * @returns {Promise<Object>} - Returns the newly created instruction record
   */
  static async create(instructionData) {
    try {
      // Destructure the instructionData object to extract individual fields
      const {
        num_instruction, date_instruction, sujet, date_limite,
        statut_id, emetteur_id, destinataire_id, observations
      } = instructionData;

      // Validate required fields
      if (!sujet || !date_instruction || !date_limite || !emetteur_id || !destinataire_id) {
        throw new Error('Champs requis manquants pour créer l\'instruction');
      }

      // Validate dates
      if (new Date(date_limite) <= new Date(date_instruction)) {
        throw new Error('La date limite doit être postérieure à la date d\'instruction');
      }

      // Execute SQL query to insert a new record into the instructions table
      const result = await db.query(
        `INSERT INTO instructions (
          num_instruction, date_instruction, sujet, date_limite,
          statut_id, emetteur_id, destinataire_id, observations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          num_instruction, date_instruction, sujet, date_limite,
          statut_id, emetteur_id, destinataire_id, observations
        ]
      );
      // Return the first row from the query result (the newly created instruction)
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la création de l\'instruction:', error);
      throw error;
    }
  }

  /**
   * Update an existing instruction
   * @param {number} id - The ID of the instruction to update
   * @param {Object} instructionData - The updated instruction data
   * @returns {Promise<Object>} - Returns the updated instruction record
   */
  static async update(id, instructionData) {
    try {
      const {
        num_instruction, date_instruction, sujet, date_limite,
        statut_id, emetteur_id, destinataire_id, observations, date_execution
      } = instructionData;

      // Validate required fields
      if (!sujet || !date_instruction || !date_limite || !emetteur_id || !destinataire_id || !statut_id) {
        throw new Error('Champs requis manquants pour mettre à jour l\'instruction (y compris statut_id)');
      }

      // Validate dates
      if (new Date(date_limite) <= new Date(date_instruction)) {
        throw new Error('La date limite doit être postérieure à la date d\'instruction');
      }

      const result = await db.query(
        `UPDATE instructions SET
          num_instruction = $1, date_instruction = $2, sujet = $3,
          date_limite = $4, statut_id = $5, emetteur_id = $6,
          destinataire_id = $7, observations = $8, date_execution = $9
        WHERE id = $10 RETURNING *`,
        [
          num_instruction, date_instruction, sujet, date_limite,
          statut_id, emetteur_id, destinataire_id, observations, date_execution, id
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'instruction:', error);
      throw error;
    }
  }

  /**
   * Mark an instruction as executed
   * @param {number} id - The ID of the instruction to mark as executed
   * @param {Date} date_execution - The execution date
   * @returns {Promise<Object>} - Returns the updated instruction record
   */
  static async markAsExecuted(id, date_execution) {
    try {
      // First, get the "Exécuté" status ID
      const statusResult = await db.query('SELECT id FROM statuts_instructions WHERE lib_statut = $1', ['Exécuté']);
      
      if (statusResult.rows.length === 0) {
        throw new Error('Statut "Exécuté" non trouvé dans la base de données');
      }

      const executedStatusId = statusResult.rows[0].id;

      const result = await db.query(
        `UPDATE instructions SET 
          statut_id = $1,
          date_execution = $2
        WHERE id = $3 RETURNING *`,
        [executedStatusId, date_execution, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Instruction non trouvée');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Erreur lors du marquage de l\'instruction comme exécutée:', error);
      throw error;
    }
  }

  /**
   * Delete an instruction
   * @param {number} id - The ID of the instruction to delete
   * @returns {Promise<boolean>} - Returns true if deletion was successful
   */
  static async delete(id) {
    try {
      const result = await db.query('DELETE FROM instructions WHERE id = $1 RETURNING id', [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'instruction:', error);
      throw error;
    }
  }

  /**
   * Retrieves the count of pending instructions for a specific recipient
   * @param {number} destinataireId - The ID of the recipient
   * @returns {Promise<number>} - A promise that resolves to the count of pending instructions
   */
  static async getPendingCount(destinataireId) {
    try {
      // Execute a SQL query to count pending instructions
      const result = await db.query(
        `SELECT COUNT(*) as count
         FROM instructions i
         JOIN statuts_instructions s ON i.statut_id = s.id
         WHERE i.destinataire_id = $1 AND s.lib_statut != 'Exécuté'`,
        [destinataireId]
      );
      // Parse and return the count as an integer
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Erreur lors de la récupération du nombre d\'instructions en attente:', error);
      throw error;
    }
  }

  /**
   * Get instructions statistics for a user
   * @param {number} userId - The user ID
   * @param {number} profileId - The user's profile ID
   * @returns {Promise<Object>} - Statistics object
   */
  static async getStatsForUser(userId, profileId) {
    try {
      let query;
      let params;

      if (profileId === 2 || profileId === 3) {
        // Gouverneur ou SG - instructions émises
        query = `
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN s.lib_statut = 'Exécuté' THEN 1 END) as executed,
            COUNT(CASE WHEN s.lib_statut = 'En Cours' THEN 1 END) as in_progress,
            COUNT(CASE WHEN s.lib_statut = 'En Retard' THEN 1 END) as overdue,
            COUNT(CASE WHEN i.date_limite < CURRENT_DATE AND s.lib_statut != 'Exécuté' THEN 1 END) as urgent
          FROM instructions i
          JOIN statuts_instructions s ON i.statut_id = s.id
          WHERE i.emetteur_id = $1
        `;
        params = [userId];
      } else if (profileId === 4) {
        // Coordinateur - instructions reçues
        query = `
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN s.lib_statut = 'Exécuté' THEN 1 END) as executed,
            COUNT(CASE WHEN s.lib_statut = 'En Cours' THEN 1 END) as in_progress,
            COUNT(CASE WHEN s.lib_statut = 'En Retard' THEN 1 END) as overdue,
            COUNT(CASE WHEN i.date_limite < CURRENT_DATE AND s.lib_statut != 'Exécuté' THEN 1 END) as urgent
          FROM instructions i
          JOIN statuts_instructions s ON i.statut_id = s.id
          WHERE i.destinataire_id = $1
        `;
        params = [userId];
      } else {
        // Administrateur - toutes les instructions
        query = `
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN s.lib_statut = 'Exécuté' THEN 1 END) as executed,
            COUNT(CASE WHEN s.lib_statut = 'En Cours' THEN 1 END) as in_progress,
            COUNT(CASE WHEN s.lib_statut = 'En Retard' THEN 1 END) as overdue,
            COUNT(CASE WHEN i.date_limite < CURRENT_DATE AND s.lib_statut != 'Exécuté' THEN 1 END) as urgent
          FROM instructions i
          JOIN statuts_instructions s ON i.statut_id = s.id
        `;
        params = [];
      }

      const result = await db.query(query, params);
      const stats = result.rows[0] || {};

      return {
        total: parseInt(stats.total) || 0,
        executed: parseInt(stats.executed) || 0,
        in_progress: parseInt(stats.in_progress) || 0,
        overdue: parseInt(stats.overdue) || 0,
        urgent: parseInt(stats.urgent) || 0
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  }

  /**
   * Check if an instruction number already exists
   * @param {string} numInstruction - The instruction number to check
   * @param {number} excludeId - ID to exclude from the check (for updates)
   * @returns {Promise<boolean>} - True if the number exists
   */
  static async numberExists(numInstruction, excludeId = 0) {
    try {
      const result = await db.query(
        'SELECT id FROM instructions WHERE num_instruction = $1 AND id != $2',
        [numInstruction, excludeId]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification d\'unicité du numéro:', error);
      throw error;
    }
  }

  /**
   * Update instruction status automatically based on date_limite
   * This method should be called periodically to update overdue instructions
   * @returns {Promise<number>} - Number of instructions updated
   */
  static async updateOverdueInstructions() {
    try {
      // Get the "En Retard" status ID
      const overdueStatusResult = await db.query('SELECT id FROM statuts_instructions WHERE lib_statut = $1', ['En Retard']);
      
      if (overdueStatusResult.rows.length === 0) {
        throw new Error('Statut "En Retard" non trouvé');
      }

      const overdueStatusId = overdueStatusResult.rows[0].id;

      // Get the "En Cours" status ID
      const inProgressStatusResult = await db.query('SELECT id FROM statuts_instructions WHERE lib_statut = $1', ['En Cours']);
      
      if (inProgressStatusResult.rows.length === 0) {
        throw new Error('Statut "En Cours" non trouvé');
      }

      const inProgressStatusId = inProgressStatusResult.rows[0].id;

      // Update instructions that are past their deadline and still "En Cours"
      const result = await db.query(
        `UPDATE instructions SET 
          statut_id = $1
        WHERE date_limite < CURRENT_DATE 
          AND statut_id = $2
        RETURNING id`,
        [overdueStatusId, inProgressStatusId]
      );

      return result.rows.length;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des instructions en retard:', error);
      throw error;
    }
  }

  /**
   * Get instructions with full details including user and status information
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of detailed instruction records
   */
  static async findAllWithDetails(filters = {}) {
    try {
      let query = `
        SELECT 
          i.*,
          e.nom as emetteur_nom, 
          e.prenom as emetteur_prenom,
          e.email as emetteur_email,
          d.nom as destinataire_nom, 
          d.prenom as destinataire_prenom,
          d.email as destinataire_email,
          s.lib_statut,
          s.id as statut_id,
          pe.lib_pole as emetteur_pole,
          pd.lib_pole as destinataire_pole,
          CASE 
            WHEN s.lib_statut = 'Exécuté' THEN 'success'
            WHEN s.lib_statut = 'En Cours' AND i.date_limite >= CURRENT_DATE THEN 'warning'
            WHEN s.lib_statut = 'En Retard' OR (s.lib_statut = 'En Cours' AND i.date_limite < CURRENT_DATE) THEN 'danger'
            ELSE 'secondary'
          END as status_class
        FROM instructions i
        JOIN utilisateurs e ON i.emetteur_id = e.id
        JOIN utilisateurs d ON i.destinataire_id = d.id
        JOIN statuts_instructions s ON i.statut_id = s.id
        LEFT JOIN poles pe ON e.pole_id = pe.id
        LEFT JOIN poles pd ON d.pole_id = pd.id
      `;

      const conditions = [];
      const params = [];

      // Apply filters same as findAll method
      if (filters.emetteur_id) {
        conditions.push(`i.emetteur_id = ${params.length + 1}`);
        params.push(filters.emetteur_id);
      }

      if (filters.destinataire_id) {
        conditions.push(`i.destinataire_id = ${params.length + 1}`);
        params.push(filters.destinataire_id);
      }

      if (filters.statut_id) {
        conditions.push(`i.statut_id = ${params.length + 1}`);
        params.push(filters.statut_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY i.date_instruction DESC, i.id DESC';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des instructions avec détails:', error);
      throw error;
    }
  }
}

module.exports = Instruction;
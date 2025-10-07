// public/js/validation.js - Utilitaires de validation réutilisables

/**
 * Utilitaires de validation pour les formulaires PDTI
 * Ces fonctions peuvent être utilisées dans d'autres formulaires de l'application
 */

// Configuration globale des validations
const ValidationUtils = {
  // Expressions régulières communes
  patterns: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^(\+212|0)[5-7]\d{8}$/,
    numbers: /^\d+$/,
    decimal: /^\d+(\.\d{1,2})?$/,
    alphanumeric: /^[a-zA-Z0-9\s\u00C0-\u017F]+$/
  },

  // Messages d'erreur standardisés
  messages: {
    required: 'Ce champ est obligatoire',
    email: 'Veuillez saisir une adresse email valide',
    phone: 'Veuillez saisir un numéro de téléphone valide',
    minLength: 'Ce champ doit contenir au minimum {min} caractères',
    maxLength: 'Ce champ doit contenir au maximum {max} caractères',
    min: 'La valeur doit être supérieure ou égale à {min}',
    max: 'La valeur doit être inférieure ou égale à {max}',
    positive: 'La valeur doit être positive',
    integer: 'Veuillez saisir un nombre entier',
    decimal: 'Veuillez saisir un nombre décimal valide',
    unique: 'Cette valeur existe déjà',
    match: 'Les valeurs ne correspondent pas',
    dateRange: 'La date de fin doit être postérieure à la date de début'
  },

  // Types de validation disponibles
  validators: {
    /**
     * Validation de champ requis
     */
    required: function(value) {
      return value !== null && value !== undefined && value.toString().trim() !== '';
    },

    /**
     * Validation d'email
     */
    email: function(value) {
      if (!value) return true; // Optionnel si pas requis
      return this.patterns.email.test(value);
    },

    /**
     * Validation de numéro de téléphone marocain
     */
    phone: function(value) {
      if (!value) return true;
      return this.patterns.phone.test(value);
    },

    /**
     * Validation de longueur minimale
     */
    minLength: function(value, min) {
      if (!value) return true;
      return value.toString().length >= parseInt(min);
    },

    /**
     * Validation de longueur maximale
     */
    maxLength: function(value, max) {
      if (!value) return true;
      return value.toString().length <= parseInt(max);
    },

    /**
     * Validation de valeur minimale
     */
    min: function(value, min) {
      if (!value) return true;
      return parseFloat(value) >= parseFloat(min);
    },

    /**
     * Validation de valeur maximale
     */
    max: function(value, max) {
      if (!value) return true;
      return parseFloat(value) <= parseFloat(max);
    },

    /**
     * Validation de nombre positif
     */
    positive: function(value) {
      if (!value) return true;
      return parseFloat(value) > 0;
    },

    /**
     * Validation de nombre positif ou zéro
     */
    positiveOrZero: function(value) {
      if (!value) return true;
      return parseFloat(value) >= 0;
    },

    /**
     * Validation d'entier
     */
    integer: function(value) {
      if (!value) return true;
      return Number.isInteger(parseFloat(value));
    },

    /**
     * Validation de nombre décimal
     */
    decimal: function(value) {
      if (!value) return true;
      return this.patterns.decimal.test(value);
    },

    /**
     * Validation de plage d'années
     */
    yearRange: function(value, min = 2020, max = 2050) {
      if (!value) return true;
      const year = parseInt(value);
      return year >= min && year <= max;
    },

    /**
     * Validation de comparaison de dates/années
     */
    dateAfter: function(value, compareValue) {
      if (!value || !compareValue) return true;
      return parseInt(value) >= parseInt(compareValue);
    },

    /**
     * Validation d'alphanumerique avec caractères spéciaux français
     */
    alphanumeric: function(value) {
      if (!value) return true;
      return this.patterns.alphanumeric.test(value);
    }
  },

  /**
   * Fonction principale de validation d'un champ
   * @param {string} value - Valeur à valider
   * @param {Array} rules - Règles de validation ['required', 'minLength:5', etc.]
   * @param {Object} context - Contexte additionnel (autres valeurs du formulaire)
   * @returns {Object} - {isValid: boolean, message: string}
   */
  validateField: function(value, rules, context = {}) {
    if (!rules || rules.length === 0) {
      return { isValid: true, message: '' };
    }

    for (const rule of rules) {
      const [ruleName, ruleParam] = rule.split(':');
      
      if (this.validators[ruleName]) {
        const isValid = this.validators[ruleName].call(this.validators, value, ruleParam, context);
        
        if (!isValid) {
          let message = this.messages[ruleName] || `Validation ${ruleName} échouée`;
          
          // Remplacer les paramètres dans le message
          if (ruleParam) {
            message = message.replace(`{${ruleName}}`, ruleParam);
          }
          
          return { isValid: false, message: message };
        }
      }
    }

    return { isValid: true, message: '' };
  },

  /**
   * Validation asynchrone (pour les vérifications côté serveur)
   * @param {string} field - Nom du champ
   * @param {string} value - Valeur à valider
   * @param {Object} context - Contexte (projectId, etc.)
   * @returns {Promise} - Promise avec résultat de validation
   */
  validateAsync: async function(field, value, context = {}) {
    try {
      const response = await fetch('/api/validate-field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          field: field,
          value: value,
          context: context
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur de validation côté serveur');
      }

      return {
        isValid: result.isValid,
        message: result.message || '',
        suggestions: result.suggestions || []
      };
    } catch (error) {
      console.error('Erreur lors de la validation asynchrone:', error);
      return {
        isValid: true, // En cas d'erreur, on laisse passer pour ne pas bloquer l'utilisateur
        message: '',
        error: error.message
      };
    }
  },

  /**
   * Validation d'unicité (numéro de projet par exemple)
   * @param {string} endpoint - URL de l'API de vérification
   * @param {string} value - Valeur à vérifier
   * @param {Object} params - Paramètres additionnels
   * @returns {Promise} - Promise avec résultat de validation
   */
  checkUnique: async function(endpoint, value, params = {}) {
    try {
      const url = new URL(endpoint, window.location.origin);
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur de vérification');
      }

      return {
        isValid: !result.exists,
        message: result.message || '',
        suggestions: result.suggestions || []
      };
    } catch (error) {
      console.error('Erreur lors de la vérification d\'unicité:', error);
      return {
        isValid: true, // En cas d'erreur, on laisse passer
        message: '',
        error: error.message
      };
    }
  },

  /**
   * Debounce une fonction (utile pour les validations en temps réel)
   * @param {Function} func - Fonction à debouncer
   * @param {number} wait - Délai en millisecondes
   * @returns {Function} - Fonction debouncée
   */
  debounce: function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Affiche un message de validation sur un champ
   * @param {HTMLElement} field - Élément du champ
   * @param {boolean} isValid - État de validation
   * @param {string} message - Message à afficher
   */
  displayValidation: function(field, isValid, message) {
    // Nettoyer les classes précédentes
    field.classList.remove('is-valid', 'is-invalid', 'shake');
    
    // Trouver ou créer l'élément de message
    let messageElement = document.getElementById(field.id + '_message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.id = field.id + '_message';
      messageElement.className = 'validation-message';
      field.parentNode.appendChild(messageElement);
    }

    if (isValid) {
      field.classList.add('is-valid');
      messageElement.textContent = '';
      messageElement.className = 'validation-message success';
    } else {
      field.classList.add('is-invalid');
      field.classList.add('shake');
      
      // Retirer l'animation après un délai
      setTimeout(() => field.classList.remove('shake'), 500);
      
      messageElement.textContent = message;
      messageElement.className = 'validation-message error';
    }
  },

  /**
   * Compte les caractères d'un champ et met à jour l'affichage
   * @param {HTMLElement} field - Élément du champ
   * @param {HTMLElement} counter - Élément compteur
   */
  updateCharCounter: function(field, counter) {
    const length = field.value.length;
    const maxLength = field.getAttribute('maxlength');
    
    counter.textContent = length;
    
    if (maxLength) {
      const percentage = (length / parseInt(maxLength)) * 100;
      counter.className = percentage > 90 ? 'text-danger fw-bold' : 
                        percentage > 80 ? 'text-warning' : 
                        percentage > 60 ? 'text-info' : '';
    }
  },

  /**
   * Initialise la validation sur un formulaire
   * @param {string} formId - ID du formulaire
   * @param {Object} options - Options de configuration
   */
  initFormValidation: function(formId, options = {}) {
    const form = document.getElementById(formId);
    if (!form) {
      console.error(`Formulaire avec ID ${formId} non trouvé`);
      return;
    }

    const config = {
      validateOnInput: true,
      validateOnBlur: true,
      showSuccessMessages: false,
      debounceDelay: 300,
      ...options
    };

    // Initialiser les compteurs de caractères
    this.initCharCounters(form);

    // Ajouter les écouteurs d'événements
    const fields = form.querySelectorAll('[data-validate]');
    fields.forEach(field => {
      const rules = field.dataset.validate.split(',');
      
      if (config.validateOnInput) {
        const debouncedValidation = this.debounce(() => {
          this.validateSingleField(field, rules, form);
        }, config.debounceDelay);
        
        field.addEventListener('input', debouncedValidation);
      }

      if (config.validateOnBlur) {
        field.addEventListener('blur', () => {
          this.validateSingleField(field, rules, form);
        });
      }
    });

    // Validation à la soumission
    form.addEventListener('submit', async (e) => {
      const isValid = await this.validateForm(form);
      if (!isValid) {
        e.preventDefault();
        this.scrollToFirstError(form);
      }
    });
  },

  /**
   * Initialise les compteurs de caractères
   * @param {HTMLElement} form - Élément du formulaire
   */
  initCharCounters: function(form) {
    const fieldsWithCounters = form.querySelectorAll('[maxlength]');
    
    fieldsWithCounters.forEach(field => {
      const counterId = field.id + '_count';
      const counter = document.getElementById(counterId);
      
      if (counter) {
        // Initialiser le compteur
        this.updateCharCounter(field, counter);
        
        // Mettre à jour en temps réel
        field.addEventListener('input', () => {
          this.updateCharCounter(field, counter);
        });
      }
    });
  },

  /**
   * Valide un champ individuel
   * @param {HTMLElement} field - Élément du champ
   * @param {Array} rules - Règles de validation
   * @param {HTMLElement} form - Formulaire parent
   * @returns {Promise<boolean>} - Résultat de la validation
   */
  validateSingleField: async function(field, rules, form) {
    const value = field.value;
    const context = this.getFormContext(form);

    // Validation synchrone
    const syncResult = this.validateField(value, rules, context);
    if (!syncResult.isValid) {
      this.displayValidation(field, false, syncResult.message);
      return false;
    }

    // Validation asynchrone si nécessaire
    if (rules.includes('unique-project')) {
      const asyncResult = await this.checkUnique(
        `/api/check-project-number/${value}`,
        value,
        { projectId: context.projectId }
      );
      
      if (!asyncResult.isValid) {
        this.displayValidation(field, false, asyncResult.message);
        return false;
      }
    }

    this.displayValidation(field, true, '');
    return true;
  },

  /**
   * Valide tout le formulaire
   * @param {HTMLElement} form - Élément du formulaire
   * @returns {Promise<boolean>} - true si valide, false sinon
   */
  validateForm: async function(form) {
    const fields = form.querySelectorAll('[data-validate]');
    const validationPromises = [];

    for (const field of fields) {
      const rules = field.dataset.validate.split(',');
      validationPromises.push(this.validateSingleField(field, rules, form));
    }

    const results = await Promise.all(validationPromises);
    return results.every(result => result === true);
  },

  /**
   * Récupère le contexte du formulaire (autres valeurs)
   * @param {HTMLElement} form - Élément du formulaire
   * @returns {Object} - Contexte du formulaire
   */
  getFormContext: function(form) {
    const formData = new FormData(form);
    const context = {};
    
    for (const [key, value] of formData.entries()) {
      context[key] = value;
    }
    
    // Ajouter des données spécifiques au contexte PDTI
    const projectIdElement = form.querySelector('[name="projectId"]') || 
                            document.querySelector('meta[name="project-id"]');
    if (projectIdElement) {
      context.projectId = projectIdElement.value || projectIdElement.content;
    }

    return context;
  },

  /**
   * Fait défiler vers la première erreur
   * @param {HTMLElement} form - Élément du formulaire
   */
  scrollToFirstError: function(form) {
    const firstError = form.querySelector('.is-invalid');
    if (firstError) {
      firstError.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      firstError.focus();
    }
  },

  /**
   * Affiche un toast de notification
   * @param {string} message - Message à afficher
   * @param {string} type - Type de toast (success, error, warning, info)
   * @param {number} duration - Durée en millisecondes
   */
  showToast: function(message, type = 'info', duration = 3000) {
    const toastId = 'validation-toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'position-fixed top-0 end-0 p-3';
    toast.style.zIndex = '1055';
    
    const bgClass = {
      success: 'bg-success',
      error: 'bg-danger',
      warning: 'bg-warning',
      info: 'bg-info'
    }[type] || 'bg-info';

    const iconClass = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-triangle',
      warning: 'fas fa-exclamation-circle',
      info: 'fas fa-info-circle'
    }[type] || 'fas fa-info-circle';

    toast.innerHTML = `
      <div class="toast show" role="alert">
        <div class="toast-header ${bgClass} text-white">
          <i class="${iconClass} me-2"></i>
          <strong class="me-auto">Validation</strong>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">${message}</div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Supprimer automatiquement après la durée spécifiée
    setTimeout(() => {
      const element = document.getElementById(toastId);
      if (element) {
        element.remove();
      }
    }, duration);
  },

  /**
   * Réinitialise la validation d'un formulaire
   * @param {HTMLElement} form - Élément du formulaire
   */
  resetValidation: function(form) {
    const fields = form.querySelectorAll('.is-valid, .is-invalid');
    fields.forEach(field => {
      field.classList.remove('is-valid', 'is-invalid', 'shake');
    });

    const messages = form.querySelectorAll('.validation-message');
    messages.forEach(message => {
      message.textContent = '';
      message.className = 'validation-message';
    });
  }
};

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationUtils;
} else if (typeof window !== 'undefined') {
  window.ValidationUtils = ValidationUtils;
}

// Initialisation automatique sur DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  // Auto-initialiser les formulaires avec la classe 'auto-validate'
  const autoValidateForms = document.querySelectorAll('form.auto-validate');
  autoValidateForms.forEach(form => {
    ValidationUtils.initFormValidation(form.id, {
      validateOnInput: true,
      validateOnBlur: true,
      debounceDelay: 500
    });
  });
});
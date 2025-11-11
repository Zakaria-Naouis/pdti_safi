// utils/textCleaner.js

/**
 * Nettoie le texte en éliminant les entités HTML et les caractères spéciaux
 */
class TextCleaner {
  /**
   * Décode les entités HTML
   */
  static decodeHTMLEntities(text) {
    if (!text) return text;
    
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#60;': '<',
      '&#62;': '>',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&ndash;': '–',
      '&mdash;': '—',
      '&lsquo;': '\u2019',  // Correction: guillemet simple gauche échappé
      '&rsquo;': '\u2019',  // Correction: guillemet simple droit échappé
      '&ldquo;': '\u201C',  // Correction: guillemet double gauche échappé
      '&rdquo;': '\u201D',  // Correction: guillemet double droit échappé
      '&hellip;': '…',
      '&bull;': '•',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™'
    };
    
    let cleaned = text;
    for (const [entity, char] of Object.entries(entities)) {
      cleaned = cleaned.replace(new RegExp(entity, 'g'), char);
    }
    
    return cleaned;
  }
  
  /**
   * Nettoie les caractères de liste (*, ▪, •, -)
   */
  static cleanListCharacters(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // Nettoie les caractères de liste en début de ligne
    cleaned = cleaned.replace(/^\s*[*▪•\-]\s*/gm, '');
    
    // Nettoie les caractères de liste avec espaces
    cleaned = cleaned.replace(/^\s*\*\s*/gm, '');
    cleaned = cleaned.replace(/^\s*▪\s*/gm, '');
    cleaned = cleaned.replace(/^\s*•\s*/gm, '');
    cleaned = cleaned.replace(/^\s*-\s*/gm, '');
    
    // Nettoie les caractères spéciaux
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    return cleaned;
  }
  
  /**
   * Nettoie les espaces multiples et les sauts de ligne
   */
  static cleanWhitespace(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // Remplace les sauts de ligne multiples par un seul
    cleaned = cleaned.replace(/\n\s*\n/g, '\n');
    
    // Remplace les espaces multiples par un seul
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Nettoie les espaces en début et fin de ligne
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
    
    return cleaned.trim();
  }
  
  /**
   * Nettoie complètement le texte
   */
  static clean(text) {
    if (!text) return text;
    
    let cleaned = String(text);
    
    // Décode les entités HTML
    cleaned = this.decodeHTMLEntities(cleaned);
    
    // Nettoie les caractères de liste
    cleaned = this.cleanListCharacters(cleaned);
    
    // Nettoie les espaces
    cleaned = this.cleanWhitespace(cleaned);
    
    return cleaned;
  }
  
  /**
   * Formate le texte en liste HTML si nécessaire
   */
  static formatAsList(text) {
    if (!text || text === '–') return text;
    
    let str = this.clean(text);
    
    // Si le texte contient des retours à la ligne multiples
    if (str.includes('\n')) {
      const lines = str.split(/\n+/)
        .map(l => l.trim())
        .filter(l => l.length > 0);
      
      if (lines.length > 1) {
        return '<ul class="bullet-list">' + 
               lines.map(line => '<li>' + line + '</li>').join('') + 
               '</ul>';
      }
    }
    
    return str;
  }
  
  /**
   * Formate le texte pour affichage simple
   */
  static formatText(text) {
    if (!text || text === '–') return text;
    
    return this.clean(text);
  }
  
  /**
   * Nettoie le texte simple (alias pour clean)
   */
  static cleanText(text) {
    if (!text || text === '–') return '–';
    return this.clean(text);
  }
  
  /**
   * Nettoie le texte avec bullets (pour les listes)
   */
  static cleanTextWithBullets(text) {
    if (!text || text === '–') return '–';
    
    let cleaned = String(text);
    
    // Décode les entités HTML
    cleaned = this.decodeHTMLEntities(cleaned);
    
    // Nettoie les espaces mais garde les sauts de ligne pour les listes
    cleaned = cleaned.trim();
    
    // Remplace les sauts de ligne multiples par un seul
    cleaned = cleaned.replace(/\n\s*\n+/g, '\n');
    
    // Nettoie les espaces en début et fin de chaque ligne
    cleaned = cleaned.split('\n').map(line => line.trim()).filter(line => line).join('\n');
    
    return cleaned;
  }
}

module.exports = TextCleaner;
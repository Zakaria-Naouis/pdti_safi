// Fonction pour confirmer les actions sensibles
function confirmAction(message) {
  return confirm(message);
}

// Fonction de formatage des nombres avec séparateurs de milliers
function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Initialisation des tooltips Bootstrap
document.addEventListener('DOMContentLoaded', function() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Formatage automatique des nombres avec l'attribut data-format-number
  document.querySelectorAll('[data-format-number]').forEach(element => {
    const value = parseFloat(element.textContent);
    element.textContent = formatNumber(value);
  });
});

// Fonction pour afficher les alertes temporaires
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.setAttribute('role', 'alert');
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  const container = document.querySelector('.container');
  container.insertBefore(alertDiv, container.firstChild);

  setTimeout(() => {
    alertDiv.classList.remove('show');
    setTimeout(() => {
      alertDiv.remove();
    }, 150);
  }, 5000);
}

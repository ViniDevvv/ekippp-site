// Échappe tout texte contrôlé par un membre (nom RP, article vendu, notes, nom d'org...)
// avant de l'interpoler dans un template injecté via innerHTML — sinon n'importe quel
// membre actif peut stocker du HTML/JS qui s'exécute dans le navigateur des autres membres
// (vol du token de session Supabase en localStorage, defacement...). À utiliser à CHAQUE
// interpolation de donnée utilisateur dans un template HTML, y compris quand la valeur a
// déjà transité par un attribut data-* (le navigateur la redécode au passage).
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Regroupement manuel par milliers (ASCII, pas de piège d'espace insécable Intl) — convention $ façon GTA V.
export function formatMoney(amount) {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(n).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped} $`;
}

// Routeur minimal par hash — pas de framework, pas de build step.
const routes = {};
let currentPanel = null;
let currentCtx = null;
let panelRootEl = null;
let refreshBanner = null;

export function registerRoute(hash, panelModule) {
  routes[hash] = panelModule;
}

function isEditingInPanel() {
  const el = document.activeElement;
  if (!el || !panelRootEl || !panelRootEl.contains(el)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

function hideRefreshBanner() {
  if (refreshBanner) { refreshBanner.remove(); refreshBanner = null; }
}

function showRefreshBanner() {
  if (refreshBanner) return;
  refreshBanner = document.createElement('div');
  refreshBanner.className = 'panel-card';
  refreshBanner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-color:rgba(139,92,246,.4)';
  refreshBanner.innerHTML = `<span style="font-size:12px;color:var(--tm);font-weight:700">Nouvelles données disponibles.</span>
    <button class="btn-primary" id="btn-apply-refresh" style="width:auto;padding:8px 16px">Actualiser</button>`;
  panelRootEl.parentElement.insertBefore(refreshBanner, panelRootEl);
  refreshBanner.querySelector('#btn-apply-refresh').addEventListener('click', () => refreshCurrentPanel({ force: true }));
}

// Point d'entrée pour realtime.js : re-render le panel actuellement monté avec son
// (container, ctx) d'origine, sauf si l'utilisateur saisit un champ éditable à l'intérieur
// de #panel-root — dans ce cas on diffère et on affiche un bandeau discret plutôt que
// d'écraser sa saisie en cours.
export async function refreshCurrentPanel({ force = false } = {}) {
  if (!currentPanel || !panelRootEl || !currentCtx) return;
  if (!force && isEditingInPanel()) {
    showRefreshBanner();
    return;
  }
  hideRefreshBanner();
  try {
    await currentPanel.render(panelRootEl, currentCtx);
  } catch (err) {
    console.error(err);
  }
}

export function startRouter(ctx) {
  panelRootEl = document.getElementById('panel-root');
  const topTitle = document.getElementById('topbar-title');
  const topSub = document.getElementById('topbar-sub');

  async function render() {
    const hash = window.location.hash.replace('#', '') || 'accueil';
    const panel = routes[hash] ?? routes['accueil'];

    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.route === hash);
    });

    if (topTitle) topTitle.textContent = panel.title ?? '';
    if (topSub) topSub.textContent = panel.subtitle ?? '';

    hideRefreshBanner();
    currentPanel = panel;
    currentCtx = ctx;

    panelRootEl.innerHTML = '<div class="loading-state">Chargement…</div>';
    try {
      await panel.render(panelRootEl, ctx);
    } catch (err) {
      console.error(err);
      panelRootEl.innerHTML = `<div class="empty-state">Erreur de chargement : ${err.message ?? err}</div>`;
    }
  }

  window.addEventListener('hashchange', render);
  render();
}

import { requireSession, logout } from './auth.js';
import { fetchMyMemberships, resolveCurrentMembership, setStoredOrgId, isAdmin } from './org.js';
import { registerRoute, startRouter } from './router.js';
import { startRealtime } from './realtime.js';
import { startSessionWatchdog } from './session-watchdog.js';
import { escapeHtml } from './format.js';
import * as accueil from './panels/accueil.js';
import * as laboratoire from './panels/laboratoire.js';
import * as recolte from './panels/recolte.js';
import * as classement from './panels/classement.js';
import * as transaction from './panels/transaction.js';
import * as braquages from './panels/braquages.js';
import * as quotas from './panels/quotas.js';
import * as profil from './panels/profil.js';

const root = document.getElementById('root');

function renderGate(org) {
  root.innerHTML = `
    <div class="gate-screen">
      <div class="gate-card">
        <div class="icon">⏳</div>
        <h2>${escapeHtml(org.name)} — en attente de validation</h2>
        <p>Contacte-nous sur Discord pour finaliser l'activation de ton organisation. Une fois validée, clique sur "Vérifier à nouveau" ci-dessous.</p>
        <button class="btn-primary" id="btn-recheck-gate" style="max-width:220px;margin:0 auto">Vérifier à nouveau</button>
      </div>
    </div>`;
  document.getElementById('btn-recheck-gate').addEventListener('click', () => window.location.reload());
}

const NAV_ITEMS = [
  { hash: 'accueil', label: 'Accueil', icon: '🏠', enabled: true },
  { hash: 'quotas', label: 'Quotas Hebdo', icon: '🎯', enabled: true },
  { hash: 'classement', label: 'Classement', icon: '🏆', enabled: true },
  { hash: 'recolte', label: 'Récolte', icon: '🌿', enabled: true },
  { hash: 'laboratoire', label: 'Laboratoire', icon: '⚗️', enabled: true },
  { hash: 'transaction', label: 'Transaction', icon: '💰', enabled: true },
  { hash: 'braquages', label: 'Braquages', icon: '🎯', enabled: true },
  { hash: 'profil', label: 'Mon Profil', icon: '👤', enabled: true },
];

function renderShell(membership, memberships) {
  const org = membership.rp_organizations;
  const orgOptions = memberships.map(m =>
    `<option value="${m.org_id}" ${m.org_id === membership.org_id ? 'selected' : ''}>${escapeHtml(m.rp_organizations.name)}</option>`
  ).join('');

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">EKIPPP<span> GROUPE</span></div>
        ${memberships.length > 1 ? `
          <div class="org-switcher">
            <select id="org-select">${orgOptions}</select>
          </div>` : `<div class="org-switcher" style="color:var(--tm);font-weight:700">${escapeHtml(org.name)}</div>`}
        <div class="nav-group">Navigation</div>
        ${NAV_ITEMS.map(item => `
          <a href="#${item.hash}" class="nav-link ${item.enabled ? '' : 'soon'}" data-route="${item.hash}">
            <span>${item.icon}</span><span>${item.label}</span>
            ${item.enabled ? '' : '<span class="badge-soon">Bientôt</span>'}
          </a>`).join('')}
        <div class="sidebar-footer">
          <div class="user-chip">
            <img src="${escapeHtml(membership.discord_avatar_url ?? '')}" alt="" onerror="this.style.display='none'"/>
            <div>
              <div class="name" id="sidebar-user-name">${escapeHtml(membership.discord_username ?? 'Membre')}</div>
              <div class="rank" id="sidebar-user-rank">${membership.rp_rank ? escapeHtml(membership.rp_rank) : membership.role}</div>
            </div>
          </div>
          <button class="btn-logout" id="btn-logout">Se déconnecter</button>
        </div>
      </aside>
      <div class="main-area">
        <div class="topbar">
          <div>
            <h1 id="topbar-title"></h1>
            <p id="topbar-sub"></p>
          </div>
        </div>
        <div id="panel-root"></div>
      </div>
    </div>`;

  document.getElementById('btn-logout').addEventListener('click', logout);

  const orgSelect = document.getElementById('org-select');
  if (orgSelect) {
    orgSelect.addEventListener('change', () => {
      setStoredOrgId(orgSelect.value);
      window.location.reload();
    });
  }

  const ctx = { org, membership, admin: isAdmin(membership) };
  registerRoute('accueil', accueil);
  registerRoute('laboratoire', laboratoire);
  registerRoute('recolte', recolte);
  registerRoute('classement', classement);
  registerRoute('transaction', transaction);
  registerRoute('braquages', braquages);
  registerRoute('quotas', quotas);
  registerRoute('profil', profil);
  startRouter(ctx);
  return ctx;
}

async function boot() {
  const session = await requireSession();
  if (!session) return;

  let memberships;
  try {
    memberships = await fetchMyMemberships();
  } catch (err) {
    root.innerHTML = `<div class="empty-state" style="padding-top:100px">Erreur de chargement : ${err.message}</div>`;
    return;
  }

  if (memberships.length === 0) {
    window.location.href = 'onboarding.html';
    return;
  }

  const membership = resolveCurrentMembership(memberships);
  if (!membership.rp_organizations.is_active) {
    renderGate(membership.rp_organizations);
    return;
  }

  const ctx = renderShell(membership, memberships);
  startRealtime(ctx);
  startSessionWatchdog(ctx);
}

boot();

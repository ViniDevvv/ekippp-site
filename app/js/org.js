import { supabase } from './supabase-client.js';
import { escapeHtml } from './format.js';

const STORAGE_KEY = 'ekippp_groupe_current_org';

// Renvoie mes adhésions, chacune avec l'organisation jointe. Filtre explicitement par
// user_id : sans ça, la policy RLS rp_members_select laisse passer TOUTES les lignes des
// membres de mes organisations (nécessaire ailleurs pour la liste des membres), donc cette
// requête renvoyait aussi les lignes des AUTRES membres — resolveCurrentMembership() pouvait
// alors prendre la ligne d'un autre membre (ex: le owner) au lieu de la mienne.
export async function fetchMyMemberships(userId) {
  const { data, error } = await supabase
    .from('rp_members')
    .select('id, org_id, user_id, role, rp_rank, discord_username, discord_avatar_url, rp_organizations(id, name, slug, timezone, accent_color, is_active, owner_id, logo_url, tiers_seeded)')
    .eq('status', 'active')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export function getStoredOrgId() {
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredOrgId(orgId) {
  localStorage.setItem(STORAGE_KEY, orgId);
}

// Choisit l'organisation courante parmi mes adhésions : la dernière utilisée si elle
// existe toujours parmi mes adhésions, sinon la première.
export function resolveCurrentMembership(memberships) {
  if (!memberships.length) return null;
  const storedId = getStoredOrgId();
  const found = memberships.find(m => m.org_id === storedId);
  const chosen = found ?? memberships[0];
  setStoredOrgId(chosen.org_id);
  return chosen;
}

export function isAdmin(membership) {
  return membership && (membership.role === 'owner' || membership.role === 'admin');
}

// Factorisé pour être réutilisable au rendu initial de la sidebar (app-boot.js) ET pour un
// patch en direct de ce même avatar quand la photo change côté Realtime (realtime.js) —
// sans ça, un membre déjà connecté ne voit la nouvelle photo qu'après un rechargement.
export function buildOrgAvatarHtml(org) {
  return org.logo_url
    ? `<img class="org-avatar" src="${escapeHtml(org.logo_url)}" alt="" onerror="this.style.display='none'"/>`
    : `<div class="org-avatar org-avatar-fallback">${escapeHtml((org.name || '?').trim().charAt(0).toUpperCase())}</div>`;
}

import { supabase } from './supabase-client.js';

const STORAGE_KEY = 'ekippp_groupe_current_org';

// Renvoie mes adhésions, chacune avec l'organisation jointe.
export async function fetchMyMemberships() {
  const { data, error } = await supabase
    .from('rp_members')
    .select('id, org_id, user_id, role, rp_rank, discord_username, discord_avatar_url, rp_organizations(id, name, slug, timezone, accent_color, is_active, owner_id)')
    .eq('status', 'active');
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

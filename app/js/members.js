import { supabase } from './supabase-client.js';
import { escapeHtml } from './format.js';

// Les colonnes claimed_by/member_id/created_by/started_by des tables rp_* référencent
// auth.users, PAS rp_members — il n'existe aucune FK directe permettant une jointure
// embarquée PostgREST (`rp_members:member_id(...)`) vers rp_members. Toujours récupérer
// les membres séparément et construire une map côté client.

export async function fetchOrgMembers(orgId) {
  const { data, error } = await supabase
    .from('rp_members')
    .select('user_id, discord_username, discord_avatar_url, rp_rank, role, hierarchy_tier')
    .eq('org_id', orgId).eq('status', 'active');
  if (error) throw error;
  return data ?? [];
}

// Palier hiérarchique RP (Membre/Gradé/Co-Lead/Lead) — purement déclaratif, affiché et
// utilisé pour cibler des quotas ; distinct du rôle de permission (owner/admin/member).
export const TIER_LABELS = { membre: 'Membre', grade: 'Gradé', co_lead: 'Co-Lead', lead: 'Lead' };

// Le nom RP prime sur le pseudo Discord partout où on identifie un membre en une seule
// ligne (historiques, classements, sélecteurs) — le pseudo Discord ne sert que de repli.
export function displayName(m) {
  return escapeHtml(m?.rp_rank || m?.discord_username || '—');
}

export function buildNameMap(members) {
  const map = {};
  members.forEach(m => { map[m.user_id] = displayName(m); });
  return map;
}

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

// Paliers hiérarchiques RP (ex: Membre/Gradé/Co-Lead/Lead) — purement déclaratifs,
// affichés et utilisés pour cibler des quotas ; distincts du rôle de permission
// (owner/admin/member). Personnalisables par organisation (rp_org_tiers), contrairement
// à l'ancienne TIER_LABELS fixe et partagée par toutes les orgs.
const DEFAULT_TIERS = [
  { key: 'membre', label: 'Membre', sort_order: 0 },
  { key: 'grade', label: 'Gradé', sort_order: 1 },
  { key: 'co_lead', label: 'Co-Lead', sort_order: 2 },
  { key: 'lead', label: 'Lead', sort_order: 3 },
];

export async function fetchOrgTiers(orgId) {
  const { data, error } = await supabase
    .from('rp_org_tiers')
    .select('id, key, label, sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  if (data && data.length > 0) return data;

  // Organisation créée après la mise en place des grades personnalisables : la migration
  // one-shot ne les a pas semés (elle ne connaissait que les orgs déjà existantes). On les
  // sème ici à la première lecture — échoue silencieusement pour un membre non-admin (RLS
  // bloque l'insert), un admin qui visite Profil/Quotas ensuite refait la même tentative.
  const { error: seedError } = await supabase.from('rp_org_tiers')
    .insert(DEFAULT_TIERS.map(t => ({ org_id: orgId, ...t })));
  if (seedError) return [];

  const { data: seeded } = await supabase
    .from('rp_org_tiers')
    .select('id, key, label, sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  return seeded ?? [];
}

export function buildTierLabelMap(tiers) {
  const map = {};
  tiers.forEach(t => { map[t.key] = t.label; });
  return map;
}

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

import { supabase } from './supabase-client.js';
import { refreshCurrentPanel } from './router.js';

const ORG_ID_TABLES = [
  'rp_members', 'rp_invite_codes', 'rp_labs', 'rp_lab_slots', 'rp_production_log',
  'rp_quotas', 'rp_transactions',
  'rp_heist_log', 'rp_heist_log_participants',
];

const DEBOUNCE_MS = 500;
let channel = null;
let debounceTimer = null;

function scheduleRefresh() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => refreshCurrentPanel(), DEBOUNCE_MS);
}

// Une seule souscription pour toute la session (pas par panel : pas de hook d'unmount pour se
// désabonner à chaque changement de hash). Le payload de chaque évènement est ignoré — chaque
// handler planifie juste un refetch complet via refreshCurrentPanel(), le même pattern déjà
// utilisé partout ailleurs dans l'app (chaque mutation locale ré-appelle déjà render(container, ctx)).
export function startRealtime(ctx) {
  if (channel) return channel;
  channel = supabase.channel(`org-${ctx.org.id}-realtime`);

  channel.on('postgres_changes',
    { event: '*', schema: 'public', table: 'rp_organizations', filter: `id=eq.${ctx.org.id}` },
    scheduleRefresh);

  ORG_ID_TABLES.forEach(table => {
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table, filter: `org_id=eq.${ctx.org.id}` },
      scheduleRefresh);
  });

  // rp_lab_ingredients n'a pas de colonne org_id — pas de filtre client possible. La portée
  // reste correcte : Realtime évalue la policy RLS rp_lab_ing_select pour chaque ligne et
  // chaque abonné avant de livrer l'évènement, exactement comme pour un SELECT direct.
  channel.on('postgres_changes',
    { event: '*', schema: 'public', table: 'rp_lab_ingredients' },
    scheduleRefresh);

  channel.subscribe();
  return channel;
}

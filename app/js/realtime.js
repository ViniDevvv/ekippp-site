import { supabase } from './supabase-client.js';
import { refreshCurrentPanel } from './router.js';
import { buildOrgAvatarHtml } from './org.js';

const ORG_ID_TABLES = [
  'rp_members', 'rp_invite_codes', 'rp_labs', 'rp_lab_slots', 'rp_production_log',
  'rp_quotas', 'rp_transactions', 'rp_org_tiers',
  'rp_heist_log', 'rp_heist_log_participants',
];

const DEBOUNCE_MS = 500;
let channel = null;
let debounceTimer = null;

function scheduleRefresh() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => refreshCurrentPanel(), DEBOUNCE_MS);
}

// Contrairement aux autres tables (où refreshCurrentPanel() suffit car chaque panel
// requête ses propres données à chaque render), ctx.org est lu directement en mémoire par
// tous les panels sans jamais être re-fetché — le muter en place ici est ce qui permet à un
// membre déjà connecté de voir une photo d'org changée par un autre admin sans recharger.
// La sidebar (rendue une seule fois par app-boot.js) est patchée séparément puisqu'elle
// n'est pas concernée par refreshCurrentPanel(), qui ne touche que #panel-root.
async function refreshOrgAndSidebar(ctx) {
  const { data } = await supabase.from('rp_organizations')
    .select('id, name, slug, timezone, accent_color, is_active, owner_id, logo_url, tiers_seeded')
    .eq('id', ctx.org.id).single();
  if (!data) return;
  Object.assign(ctx.org, data);

  const avatarSlot = document.getElementById('org-avatar-slot');
  if (avatarSlot) avatarSlot.innerHTML = buildOrgAvatarHtml(ctx.org);
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
    () => { refreshOrgAndSidebar(ctx); scheduleRefresh(); });

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

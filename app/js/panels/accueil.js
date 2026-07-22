import { supabase } from '../supabase-client.js';
import { escapeHtml, formatMoney } from '../format.js';

export const title = 'Accueil';
export const subtitle = 'Vue d\'ensemble de ton organisation';

export async function render(container, ctx) {
  const { org, membership } = ctx;

  const [{ count: memberCount }, { count: labCount }, { data: recentProd }, { data: txAmounts }] = await Promise.all([
    supabase.from('rp_members').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'active'),
    supabase.from('rp_labs').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('category', 'laboratoire'),
    supabase.from('rp_production_log').select('quantity, unit, produced_at').eq('org_id', org.id).order('produced_at', { ascending: false }).limit(5),
    supabase.from('rp_transactions').select('amount').eq('org_id', org.id)
  ]);

  const revenue = (txAmounts ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  container.innerHTML = `
    <div class="stat-row">
      <div class="stat-card"><div class="num">${memberCount ?? 0}</div><div class="lbl">Membres actifs</div></div>
      <div class="stat-card"><div class="num">${labCount ?? 0}</div><div class="lbl">Laboratoires</div></div>
      <div class="stat-card"><div class="num">${formatMoney(revenue)}</div><div class="lbl">Revenus totaux</div></div>
      <div class="stat-card"><div class="num">${membership.rp_rank ? escapeHtml(membership.rp_rank) : membership.role}</div><div class="lbl">Nom RP</div></div>
    </div>
    <div class="panel-card">
      <h2>Dernières productions</h2>
      ${(recentProd?.length ?? 0) === 0
        ? '<div class="empty-state">Aucune production enregistrée pour l\'instant.</div>'
        : `<table class="data-table"><thead><tr><th>Quantité</th><th>Date</th></tr></thead><tbody>
            ${recentProd.map(p => `<tr><td>+${p.quantity} ${escapeHtml(p.unit)}</td><td>${new Date(p.produced_at).toLocaleString('fr-FR')}</td></tr>`).join('')}
          </tbody></table>`}
    </div>
  `;
}

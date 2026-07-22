import { supabase } from '../supabase-client.js';
import { isAdmin } from '../org.js';
import { fetchOrgMembers, buildNameMap, displayName } from '../members.js';
import { formatMoney, escapeHtml } from '../format.js';

export const title = 'Transaction';
export const subtitle = 'Journal des ventes';

export async function render(container, ctx) {
  const { org, membership } = ctx;
  const admin = isAdmin(membership);

  const [{ data: rows }, { data: allAmounts }, members] = await Promise.all([
    supabase.from('rp_transactions').select('id, member_id, item_name, quantity, unit, buyer_name, unit_price, amount, sold_at')
      .eq('org_id', org.id).order('sold_at', { ascending: false }).limit(50),
    supabase.from('rp_transactions').select('amount').eq('org_id', org.id),
    fetchOrgMembers(org.id)
  ]);

  const nameByUserId = buildNameMap(members);
  const total = (allAmounts ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  container.innerHTML = `
    <div class="stat-row">
      <div class="stat-card"><div class="num">${formatMoney(total)}</div><div class="lbl">Revenus totaux</div></div>
    </div>
    <div class="panel-card">
      <h2>Nouvelle vente</h2>
      <div style="display:grid;grid-template-columns:${admin ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr'};gap:10px;align-items:end">
        ${admin ? `
        <div class="field" style="margin:0"><label>Membre</label>
          <select id="tx-member" style="width:100%;padding:11px;background:var(--bg);border:1px solid var(--border);border-radius:9px;color:var(--t)">
            ${members.map(m => `<option value="${m.user_id}" ${m.user_id === membership.user_id ? 'selected' : ''}>${displayName(m)}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="field" style="margin:0"><label>Article</label><input type="text" id="tx-item" placeholder="Tranquillisant"/></div>
        <div class="field" style="margin:0"><label>Quantité</label><input type="number" id="tx-qty" placeholder="10"/></div>
        <div class="field" style="margin:0"><label>Acheteur</label><input type="text" id="tx-buyer" placeholder="Optionnel"/></div>
        <div class="field" style="margin:0"><label>Montant</label><input type="number" id="tx-amount" placeholder="500"/></div>
      </div>
      <button class="btn-primary" id="btn-add-tx" style="width:auto;padding:10px 24px;margin-top:10px">Enregistrer la vente</button>
      <div class="form-error" id="tx-error"></div>
    </div>
    <div class="panel-card">
      <h2>Historique</h2>
      ${(rows?.length ?? 0) === 0 ? '<div class="empty-state">Aucune vente enregistrée pour l\'instant.</div>' :
        `<table class="data-table"><thead><tr><th>Membre</th><th>Article</th><th>Quantité</th><th>Acheteur</th><th>Montant</th><th>Date</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
          ${rows.map(r => `
            <tr>
              <td>${nameByUserId[r.member_id] ?? '—'}</td>
              <td>${escapeHtml(r.item_name)}</td>
              <td>${r.quantity ?? '—'} ${escapeHtml(r.unit ?? '')}</td>
              <td>${escapeHtml(r.buyer_name ?? '—')}</td>
              <td>${formatMoney(r.amount)}</td>
              <td>${new Date(r.sold_at).toLocaleString('fr-FR')}</td>
              ${admin ? `<td><button class="btn-ghost" data-delete-tx="${r.id}" style="width:auto;padding:6px 12px">Suppr.</button></td>` : ''}
            </tr>`).join('')}
        </tbody></table>`}
    </div>
  `;

  document.getElementById('btn-add-tx').addEventListener('click', async () => {
    const memberSelect = document.getElementById('tx-member');
    const member_id = admin && memberSelect ? memberSelect.value : membership.user_id;
    const item_name = document.getElementById('tx-item').value.trim();
    const quantity = document.getElementById('tx-qty').value ? parseFloat(document.getElementById('tx-qty').value) : null;
    const buyer_name = document.getElementById('tx-buyer').value.trim() || null;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const err = document.getElementById('tx-error');
    err.textContent = '';
    if (!item_name) { err.textContent = 'Indique un article.'; return; }
    if (isNaN(amount) || amount < 0) { err.textContent = 'Indique un montant valide.'; return; }
    const { error } = await supabase.from('rp_transactions').insert({ org_id: org.id, member_id, item_name, quantity, buyer_name, amount });
    if (error) { err.textContent = error.message; return; }
    render(container, ctx);
  });

  container.querySelectorAll('[data-delete-tx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement cette vente ?')) return;
      const { error } = await supabase.from('rp_transactions').delete().eq('id', btn.dataset.deleteTx);
      if (error) { alert('Erreur : ' + error.message); return; }
      render(container, ctx);
    });
  });
}

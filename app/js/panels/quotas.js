import { supabase } from '../supabase-client.js';
import { fetchOrgMembers, displayName, TIER_LABELS } from '../members.js';

export const title = 'Quotas Hebdo';
export const subtitle = 'Objectifs de production attendus';

const CATEGORY_LABELS = { all: 'Tout', laboratoire: 'Laboratoire', recolte: 'Récolte', braquage: 'Braquage' };

export async function render(container, ctx) {
  const { org, membership } = ctx;
  const isOwner = membership.user_id === org.owner_id;

  const [{ data: quotas }, members] = await Promise.all([
    supabase.from('rp_quotas').select('id, tier, member_id, target_quantity, category').eq('org_id', org.id),
    fetchOrgMembers(org.id)
  ]);

  // Tableau statique de référence — pas de suivi de progression, juste "qui doit produire quoi".
  // Regroupé par cible : une même cible (ex: Gradé) peut avoir plusieurs objectifs par
  // catégorie (Laboratoire, Récolte, Braquage...) affichés sur une seule ligne.
  const groups = {};
  (quotas ?? []).forEach(q => {
    const key = q.member_id ? `member:${q.member_id}` : `tier:${q.tier}`;
    if (!groups[key]) {
      const name = q.member_id ? displayName(members.find(m => m.user_id === q.member_id)) : (TIER_LABELS[q.tier] ?? q.tier ?? '—');
      groups[key] = { name, items: [] };
    }
    groups[key].items.push({ id: q.id, categoryLabel: CATEGORY_LABELS[q.category] ?? 'Tout', target: q.target_quantity });
  });
  const rows = Object.values(groups);

  container.innerHTML = `
    ${isOwner ? `
    <div class="panel-card">
      <h2>Nouveau quota</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end">
        <div class="field" style="margin:0"><label>Cible</label>
          <select id="quota-target" style="width:100%;padding:11px;background:var(--bg);border:1px solid var(--border);border-radius:9px;color:var(--t)">
            ${Object.entries(TIER_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="margin:0"><label>Catégorie</label>
          <select id="quota-category" style="width:100%;padding:11px;background:var(--bg);border:1px solid var(--border);border-radius:9px;color:var(--t)">
            ${Object.entries(CATEGORY_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="margin:0"><label>Objectif</label><input type="number" id="quota-target-qty" placeholder="150"/></div>
        <button class="btn-primary" id="btn-add-quota" style="width:auto;padding:11px 20px">Ajouter</button>
      </div>
      <div class="form-error" id="quota-error"></div>
    </div>` : ''}
    <div class="panel-card">
      <h2>Quotas définis</h2>
      ${rows.length === 0 ? '<div class="empty-state">Aucun quota défini pour l\'instant.</div>' :
        `<table class="data-table"><thead><tr><th>Cible</th><th>Objectifs</th></tr></thead><tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.name}</td>
              <td>${r.items.map(i => `<span class="pill">${i.categoryLabel} : ${i.target}${isOwner ? ` <button data-delete-quota="${i.id}" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:900;padding:0 0 0 4px" title="Supprimer">×</button>` : ''}</span>`).join(' ')}</td>
            </tr>`).join('')}
        </tbody></table>`}
    </div>
  `;

  const addBtn = document.getElementById('btn-add-quota');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const targetVal = document.getElementById('quota-target').value;
      const category = document.getElementById('quota-category').value;
      const qty = parseFloat(document.getElementById('quota-target-qty').value);
      const err = document.getElementById('quota-error');
      err.textContent = '';
      if (isNaN(qty) || qty <= 0) { err.textContent = 'Indique un objectif valide.'; return; }
      const payload = { org_id: org.id, target_quantity: qty, category, tier: targetVal };
      const { error } = await supabase.from('rp_quotas').insert(payload);
      if (error) { err.textContent = error.message; return; }
      render(container, ctx);
    });
  }

  container.querySelectorAll('[data-delete-quota]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce quota ?')) return;
      const { error } = await supabase.from('rp_quotas').delete().eq('id', btn.dataset.deleteQuota);
      if (error) { alert('Erreur : ' + error.message); return; }
      render(container, ctx);
    });
  });
}

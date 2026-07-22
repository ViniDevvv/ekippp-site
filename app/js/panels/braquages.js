import { supabase } from '../supabase-client.js';
import { isAdmin } from '../org.js';
import { fetchOrgMembers, buildNameMap, displayName } from '../members.js';
import { formatMoney, escapeHtml } from '../format.js';

export const title = 'Braquages';
export const subtitle = 'Journal des braquages effectués';

export async function render(container, ctx) {
  const { org, membership } = ctx;
  const admin = isAdmin(membership);
  const myId = membership.user_id;

  const [{ data: logs }, { data: participants }, members] = await Promise.all([
    supabase.from('rp_heist_log').select('id, description, amount, declared_by, declared_at')
      .eq('org_id', org.id).order('declared_at', { ascending: false }).limit(50),
    supabase.from('rp_heist_log_participants').select('heist_log_id, member_id').eq('org_id', org.id),
    fetchOrgMembers(org.id)
  ]);

  const nameByUserId = buildNameMap(members);
  const participantsByLog = {};
  (participants ?? []).forEach(p => {
    if (!participantsByLog[p.heist_log_id]) participantsByLog[p.heist_log_id] = [];
    participantsByLog[p.heist_log_id].push(p.member_id);
  });

  container.innerHTML = `
    <div class="panel-card">
      <h2>Nouveau braquage</h2>
      <div class="field"><label>Quoi</label><input type="text" id="heist-desc" placeholder="Braquage de bijouterie"/></div>
      <div class="field"><label>Avec qui</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${members.map(m => `
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:7px 12px;cursor:pointer">
              <input type="checkbox" class="heist-participant" value="${m.user_id}" ${m.user_id === myId ? 'checked' : ''}/> ${displayName(m)}
            </label>`).join('')}
        </div>
      </div>
      <div class="field"><label>Combien récupéré</label><input type="number" id="heist-amount" placeholder="5000"/></div>
      <button class="btn-primary" id="btn-add-heist" style="width:auto;padding:10px 24px">Enregistrer</button>
      <div class="form-error" id="heist-error"></div>
    </div>
    <div class="panel-card">
      <h2>Historique</h2>
      ${(logs?.length ?? 0) === 0 ? '<div class="empty-state">Aucun braquage déclaré pour l\'instant.</div>' :
        `<table class="data-table"><thead><tr><th>Quoi</th><th>Avec qui</th><th>Combien</th><th>Date</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
          ${logs.map(l => {
            const roster = participantsByLog[l.id] ?? [];
            return `<tr>
              <td>${escapeHtml(l.description)}</td>
              <td>${roster.map(pid => nameByUserId[pid] ?? '—').join(', ') || '—'}</td>
              <td>${formatMoney(l.amount)}</td>
              <td>${new Date(l.declared_at).toLocaleString('fr-FR')}</td>
              ${admin ? `<td><button class="btn-ghost" data-delete-heist="${l.id}" style="width:auto;padding:6px 12px">Suppr.</button></td>` : ''}
            </tr>`;
          }).join('')}
        </tbody></table>`}
    </div>
  `;

  document.getElementById('btn-add-heist').addEventListener('click', async () => {
    const description = document.getElementById('heist-desc').value.trim();
    const amount = parseFloat(document.getElementById('heist-amount').value);
    const participantIds = Array.from(container.querySelectorAll('.heist-participant:checked')).map(el => el.value);
    const err = document.getElementById('heist-error');
    err.textContent = '';
    if (!description) { err.textContent = 'Indique ce qui a été fait.'; return; }
    if (isNaN(amount) || amount < 0) { err.textContent = 'Indique un montant valide.'; return; }
    const { error } = await supabase.rpc('rp_declare_heist', {
      p_org_id: org.id, p_description: description, p_amount: amount, p_participant_ids: participantIds
    });
    if (error) { err.textContent = error.message; return; }
    render(container, ctx);
  });

  container.querySelectorAll('[data-delete-heist]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement ce braquage ?')) return;
      const { error } = await supabase.from('rp_heist_log').delete().eq('id', btn.dataset.deleteHeist);
      if (error) { alert('Erreur : ' + error.message); return; }
      render(container, ctx);
    });
  });
}

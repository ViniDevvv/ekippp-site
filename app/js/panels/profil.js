import { supabase } from '../supabase-client.js';
import { isAdmin } from '../org.js';
import { displayName, TIER_LABELS } from '../members.js';
import { escapeHtml } from '../format.js';

export const title = 'Mon Profil';
export const subtitle = 'Tes informations et la gestion des membres';

function randomCode(length = 8) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

// Pas d'action sur la ligne du owner (ni pour lui-même, ni pour un autre admin) : la
// propriété ne bouge que via suppression + recréation de l'organisation.
function renderMemberActions(m, org, membership) {
  const isOwnerRow = m.user_id === org.owner_id;
  const isSelfRow = m.user_id === membership.user_id;
  if (isOwnerRow || isSelfRow) return '';
  const toggleRole = m.role === 'admin' ? 'member' : 'admin';
  const toggleLabel = m.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin';
  return `
    <button class="btn-ghost" data-toggle-role="${toggleRole}" data-member-id="${m.id}" style="width:auto;padding:6px 12px;margin-right:6px">${toggleLabel}</button>
    <button class="btn-ghost" data-kick="${m.id}" data-kick-name="${displayName(m)}" style="width:auto;padding:6px 12px;color:var(--red);border-color:rgba(239,68,68,.3)">Exclure</button>`;
}

export async function render(container, ctx) {
  const { org, membership } = ctx;
  const admin = isAdmin(membership);
  const isOwner = membership.user_id === org.owner_id;

  const { data: members } = await supabase
    .from('rp_members')
    .select('id, user_id, role, rp_rank, hierarchy_tier, discord_username, discord_avatar_url, joined_at')
    .eq('org_id', org.id).eq('status', 'active')
    .order('joined_at', { ascending: true });

  let invitesHtml = '';
  if (admin) {
    const { data: invites } = await supabase
      .from('rp_invite_codes')
      .select('id, code, uses_count, max_uses, revoked, created_at')
      .eq('org_id', org.id).eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(10);

    invitesHtml = `
      <div class="panel-card">
        <h2>Inviter des membres</h2>
        <button class="btn-primary" id="btn-new-invite" style="width:auto;padding:10px 20px;margin-bottom:16px">Générer un code</button>
        <div id="invite-feedback" class="form-error"></div>
        ${(invites?.length ?? 0) === 0
          ? '<div class="empty-state">Aucun code actif. Génères-en un ci-dessus.</div>'
          : `<table class="data-table"><thead><tr><th>Code</th><th>Utilisations</th><th>Créé le</th></tr></thead><tbody>
              ${invites.map(i => `<tr><td style="font-family:monospace;font-weight:800">${i.code}</td><td>${i.uses_count}${i.max_uses ? ' / ' + i.max_uses : ''}</td><td>${new Date(i.created_at).toLocaleDateString('fr-FR')}</td></tr>`).join('')}
            </tbody></table>`}
      </div>`;
  }

  const dangerZoneHtml = isOwner ? `
    <div class="panel-card" style="border-color:rgba(239,68,68,.3)">
      <h2 style="color:var(--red)">Zone de danger</h2>
      <p style="font-size:12px;color:var(--ts);margin-bottom:16px">Supprimer l'organisation efface définitivement tous ses membres, laboratoires, ventes, quotas et braquages. Cette action est irréversible.</p>
      <button class="btn-ghost" id="btn-delete-org" style="width:auto;padding:10px 20px;color:var(--red);border-color:rgba(239,68,68,.3)">Supprimer l'organisation</button>
    </div>` : '';

  container.innerHTML = `
    <div class="panel-card">
      <h2>Toi</h2>
      <div class="user-chip" style="padding:0;margin-bottom:16px">
        <img src="${escapeHtml(membership.discord_avatar_url ?? '')}" alt="" onerror="this.style.display='none'"/>
        <div>
          <div class="name">${escapeHtml(membership.discord_username ?? 'Membre')}</div>
          <div class="rank">${membership.rp_rank ? escapeHtml(membership.rp_rank) : membership.role}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:end;max-width:400px">
        <div class="field" style="margin:0;flex:1"><label>Nom RP</label><input type="text" id="my-rp-rank" placeholder="Ex: Don Vincenzo" value="${escapeHtml(membership.rp_rank ?? '')}" maxlength="60"/></div>
        <button class="btn-primary" id="btn-save-rp-rank" style="width:auto;padding:11px 20px">Enregistrer</button>
      </div>
      <div class="form-error" id="rp-rank-error"></div>
    </div>
    ${invitesHtml}
    <div class="panel-card">
      <h2>Membres de l'organisation (${members?.length ?? 0})</h2>
      <table class="data-table">
        <thead><tr><th>Membre</th><th>Nom RP</th><th>Grade</th><th>Rôle</th><th>Depuis</th>${admin ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${(members ?? []).map(m => `
            <tr>
              <td>${escapeHtml(m.discord_username ?? '—')}</td>
              <td>${escapeHtml(m.rp_rank ?? '—')}</td>
              <td>${admin ? `
                <select data-tier-select="${m.id}" style="padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:7px;color:var(--t);font-size:12px">
                  ${Object.entries(TIER_LABELS).map(([key, label]) => `<option value="${key}" ${m.hierarchy_tier === key ? 'selected' : ''}>${label}</option>`).join('')}
                </select>` : escapeHtml(TIER_LABELS[m.hierarchy_tier] ?? m.hierarchy_tier)}</td>
              <td><span class="pill ${m.role === 'owner' || m.role === 'admin' ? 'green' : ''}">${m.user_id === org.owner_id ? 'owner' : m.role}</span></td>
              <td>${new Date(m.joined_at).toLocaleDateString('fr-FR')}</td>
              ${admin ? `<td>${renderMemberActions(m, org, membership)}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${dangerZoneHtml}
  `;

  document.getElementById('btn-save-rp-rank').addEventListener('click', async (e) => {
    const btn = e.target;
    const rank = document.getElementById('my-rp-rank').value;
    const err = document.getElementById('rp-rank-error');
    err.textContent = '';
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const { error } = await supabase.rpc('rp_update_my_rp_rank', { p_org_id: org.id, p_rank: rank });
    btn.disabled = false; btn.textContent = 'Enregistrer';
    if (error) { err.textContent = 'Erreur : ' + error.message; return; }
    membership.rp_rank = rank.trim() || null;
    const sidebarRank = document.getElementById('sidebar-user-rank');
    if (sidebarRank) sidebarRank.textContent = membership.rp_rank ?? membership.role;
    render(container, ctx);
  });

  if (admin) {
    document.getElementById('btn-new-invite').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Génération…';
      const feedback = document.getElementById('invite-feedback');
      feedback.textContent = '';
      let lastError = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode();
        const { error } = await supabase.from('rp_invite_codes').insert({ org_id: org.id, code, created_by: membership.user_id, max_uses: 1 });
        if (!error) { render(container, ctx); return; }
        lastError = error;
        if (error.code !== '23505') break; // pas une collision de code → inutile de réessayer
      }
      feedback.textContent = 'Erreur : ' + (lastError?.message ?? 'inconnue');
      btn.disabled = false; btn.textContent = 'Générer un code';
    });

    container.querySelectorAll('[data-toggle-role]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await supabase.from('rp_members')
          .update({ role: btn.dataset.toggleRole }).eq('id', btn.dataset.memberId);
        if (error) { alert('Erreur : ' + error.message); return; }
        render(container, ctx);
      });
    });

    container.querySelectorAll('[data-tier-select]').forEach(select => {
      select.addEventListener('change', async () => {
        const { error } = await supabase.from('rp_members')
          .update({ hierarchy_tier: select.value }).eq('id', select.dataset.tierSelect);
        if (error) { alert('Erreur : ' + error.message); return; }
        render(container, ctx);
      });
    });

    container.querySelectorAll('[data-kick]').forEach(btn => {
      btn.addEventListener('click', () => openKickModal(container, ctx, btn.dataset.kick, btn.dataset.kickName));
    });
  }

  const deleteBtn = document.getElementById('btn-delete-org');
  if (deleteBtn) deleteBtn.addEventListener('click', () => openDeleteOrgModal(ctx));
}

function openKickModal(container, ctx, memberId, memberName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Exclure ${escapeHtml(memberName)}</h3>
      <p style="font-size:12px;color:var(--ts);margin-bottom:16px">Ce membre perdra immédiatement l'accès à l'organisation. Il pourra revenir avec un nouveau code d'invitation.</p>
      <div class="modal-actions">
        <button class="btn-ghost" id="modal-cancel">Annuler</button>
        <button class="btn-primary" id="modal-confirm">Exclure</button>
      </div>
      <div class="form-error" id="modal-error"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#modal-confirm').addEventListener('click', async () => {
    const { error } = await supabase.from('rp_members').update({ status: 'removed' }).eq('id', memberId);
    overlay.remove();
    if (error) { alert('Erreur : ' + error.message); return; }
    render(container, ctx);
  });
}

function openDeleteOrgModal(ctx) {
  const { org } = ctx;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Supprimer ${escapeHtml(org.name)}</h3>
      <p style="font-size:12px;color:var(--ts);margin-bottom:12px">Cette action est irréversible. Tape <strong>${escapeHtml(org.name)}</strong> ci-dessous pour confirmer.</p>
      <div class="field"><input type="text" id="delete-confirm-input" placeholder="${escapeHtml(org.name)}"/></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="modal-cancel">Annuler</button>
        <button class="btn-primary" id="modal-confirm" disabled>Supprimer définitivement</button>
      </div>
      <div class="form-error" id="modal-error"></div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#delete-confirm-input');
  const confirmBtn = overlay.querySelector('#modal-confirm');
  input.addEventListener('input', () => { confirmBtn.disabled = input.value !== org.name; });
  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true; confirmBtn.textContent = 'Suppression…';
    const { error } = await supabase.from('rp_organizations').delete().eq('id', org.id);
    if (error) {
      overlay.querySelector('#modal-error').textContent = 'Erreur : ' + error.message;
      confirmBtn.disabled = false; confirmBtn.textContent = 'Supprimer définitivement';
      return;
    }
    localStorage.removeItem('ekippp_groupe_current_org');
    window.location.href = 'onboarding.html';
  });
}

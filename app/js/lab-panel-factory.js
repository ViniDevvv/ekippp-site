import { supabase } from './supabase-client.js';
import { isAdmin } from './org.js';
import { todayInTz, fmtDateLabel, shiftDate, isHourPast } from './date-utils.js';
import { fetchOrgMembers, buildNameMap } from './members.js';
import { escapeHtml } from './format.js';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const STATE_LABELS = { disponible: 'Disponible', pris: 'Pris', a_declarer: 'À déclarer', realise: 'Réalisé', perte: 'Perte' };

// Factory partagée par Laboratoire et Récolte — même mécanique de grille horaire
// (claim/déclarer/libérer), seule la catégorie de labo (`rp_labs.category`) et les
// textes changent d'un panel à l'autre.
export function createLabPanel({ category, title, subtitle, createHeading, createHint,
                                  namePlaceholder, createButtonLabel, emptyMemberMsg, recipeCardTitle }) {

  // État local du panel (recréé à chaque montée, perdu en changeant d'onglet — acceptable).
  let state = { labs: [], currentLabId: null, currentDate: todayInTz('Europe/Paris'), org: null, membership: null, admin: false, isOwner: false };

  async function render(container, ctx) {
    state.org = ctx.org;
    state.membership = ctx.membership;
    state.admin = isAdmin(ctx.membership);
    state.isOwner = ctx.membership.user_id === ctx.org.owner_id;

    const { data: labs, error } = await supabase
      .from('rp_labs').select('id, name, description, output_item_name, output_unit')
      .eq('org_id', state.org.id).eq('is_active', true).eq('category', category)
      .order('created_at', { ascending: true });
    if (error) throw error;
    state.labs = labs ?? [];

    if (!state.currentLabId || !state.labs.find(l => l.id === state.currentLabId)) {
      state.currentLabId = state.labs[0]?.id ?? null;
    }

    if (state.labs.length === 0) {
      container.innerHTML = state.isOwner
        ? `<div class="panel-card">
             <h2>${createHeading}</h2>
             <p style="font-size:12px;color:var(--ts);margin-bottom:16px">${createHint}</p>
             <div class="field"><label>Nom</label><input type="text" id="new-lab-name" placeholder="${namePlaceholder}"/></div>
             <button class="btn-primary" id="btn-create-lab" style="width:auto;padding:10px 24px">${createButtonLabel}</button>
             <div class="form-error" id="create-lab-error"></div>
           </div>`
        : `<div class="empty-state">${emptyMemberMsg}</div>`;
      if (state.isOwner) {
        document.getElementById('btn-create-lab').addEventListener('click', async () => {
          const name = document.getElementById('new-lab-name').value.trim();
          const err = document.getElementById('create-lab-error');
          if (!name) { err.textContent = 'Donne un nom.'; return; }
          const { error } = await supabase.from('rp_labs')
            .insert({ org_id: state.org.id, name, created_by: state.membership.user_id, category });
          if (error) { err.textContent = error.message; return; }
          render(container, ctx);
        });
      }
      return;
    }

    await renderFull(container, ctx);
  }

  async function renderFull(container, ctx) {
    const lab = state.labs.find(l => l.id === state.currentLabId);

    const [{ data: slots }, { data: ingredients }, { data: history }, orgMembers] = await Promise.all([
      supabase.from('rp_lab_slots').select('id, slot_hour, state, claimed_by, batch_yield')
        .eq('lab_id', lab.id).eq('slot_date', state.currentDate),
      supabase.from('rp_lab_ingredients').select('id, item_name, quantity, unit').eq('lab_id', lab.id).order('sort_order'),
      supabase.from('rp_production_log').select('quantity, unit, produced_at, member_id')
        .eq('lab_id', lab.id).order('produced_at', { ascending: false }).limit(15),
      fetchOrgMembers(state.org.id)
    ]);

    const nameByUserId = buildNameMap(orgMembers);

    const slotByHour = {};
    (slots ?? []).forEach(s => { slotByHour[s.slot_hour] = s; });
    const myId = state.membership.user_id;
    const tz = state.org.timezone ?? 'Europe/Paris';

    const gridHtml = HOURS.map(h => {
      const s = slotByHour[h];
      let visualState = 'disponible';
      let who = '';
      if (s) {
        visualState = s.state;
        if (s.state === 'pris' && isHourPast(state.currentDate, h, tz)) visualState = 'a_declarer';
        who = nameByUserId[s.claimed_by] ?? '';
      }
      const mine = s && s.claimed_by === myId;
      return `<div class="slot-cell ${visualState}" data-hour="${h}" data-slot-id="${s?.id ?? ''}" data-mine="${mine ? '1' : '0'}" data-real-state="${s?.state ?? ''}">
        <div class="hour">${String(h).padStart(2, '0')}H</div>
        <div class="state-lbl">${STATE_LABELS[visualState]}</div>
        ${who ? `<div class="who">${who}</div>` : ''}
        ${s?.batch_yield ? `<div class="who">+${s.batch_yield} ${escapeHtml(lab.output_unit)}</div>` : ''}
      </div>`;
    }).join('');

    container.innerHTML = `
      <div class="lab-tabs">
        ${state.labs.map(l => `<button class="lab-tab ${l.id === lab.id ? 'active' : ''}" data-lab-id="${l.id}">${escapeHtml(l.name)}</button>`).join('')}
        ${state.isOwner ? `<button class="lab-tab" id="btn-open-create-lab">+ Nouveau</button>` : ''}
      </div>
      <div class="day-nav">
        <button id="btn-prev-day">←</button>
        <div class="day-label">${fmtDateLabel(state.currentDate)}</div>
        <button id="btn-next-day">→</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start">
        <div>
          <div class="slot-grid">${gridHtml}</div>
        </div>
        <div class="panel-card" style="margin-bottom:0">
          <h2>${recipeCardTitle} — ${escapeHtml(lab.name)}</h2>
          <ul class="ingredient-list">
            ${(ingredients ?? []).length === 0 ? '<li style="border:none;color:var(--ts)">Rien de renseigné.</li>' :
              ingredients.map(i => `<li><span>${escapeHtml(i.item_name)}</span><span>${i.quantity} ${escapeHtml(i.unit)}${state.admin ? ` <button data-delete-ing="${i.id}" style="background:none;border:none;color:var(--red);cursor:pointer;font-weight:900;padding:0 0 0 8px" title="Supprimer">×</button>` : ''}</span></li>`).join('')}
          </ul>
          ${state.admin ? `
            <div class="field" style="margin-top:14px"><input type="text" id="ing-name" placeholder="Élément"/></div>
            <div style="display:flex;gap:8px">
              <input type="number" id="ing-qty" placeholder="Qté" style="width:80px;padding:11px;background:var(--bg);border:1px solid var(--border);border-radius:9px;color:var(--t)"/>
              <button class="btn-primary" id="btn-add-ing" style="width:auto;padding:10px 16px">Ajouter</button>
            </div>` : ''}
          ${state.isOwner ? `<button class="btn-ghost" id="btn-delete-lab" style="width:auto;padding:8px 16px;margin-top:14px;color:var(--red);border-color:rgba(239,68,68,.3)">Supprimer « ${escapeHtml(lab.name)} »</button>` : ''}
        </div>
      </div>
      <div class="panel-card">
        <h2>Historique de production</h2>
        ${(history?.length ?? 0) === 0 ? '<div class="empty-state">Aucune production enregistrée pour ce labo.</div>' :
          `<table class="data-table"><thead><tr><th>Membre</th><th>Quantité</th><th>Date</th></tr></thead><tbody>
            ${history.map(h => `<tr><td>${nameByUserId[h.member_id] ?? '—'}</td><td>+${h.quantity} ${escapeHtml(h.unit)}</td><td>${new Date(h.produced_at).toLocaleString('fr-FR')}</td></tr>`).join('')}
          </tbody></table>`}
      </div>
    `;

    wireEvents(container, ctx, lab);
  }

  function wireEvents(container, ctx, lab) {
    container.querySelectorAll('.lab-tab[data-lab-id]').forEach(btn => {
      btn.addEventListener('click', () => { state.currentLabId = btn.dataset.labId; renderFull(container, ctx); });
    });
    const openCreateBtn = document.getElementById('btn-open-create-lab');
    if (openCreateBtn) openCreateBtn.addEventListener('click', () => openCreateLabModal(container, ctx));
    document.getElementById('btn-prev-day').addEventListener('click', () => { state.currentDate = shiftDate(state.currentDate, -1); renderFull(container, ctx); });
    document.getElementById('btn-next-day').addEventListener('click', () => { state.currentDate = shiftDate(state.currentDate, 1); renderFull(container, ctx); });

    const addIngBtn = document.getElementById('btn-add-ing');
    if (addIngBtn) {
      addIngBtn.addEventListener('click', async () => {
        const name = document.getElementById('ing-name').value.trim();
        const qty = parseFloat(document.getElementById('ing-qty').value);
        if (!name || isNaN(qty)) return;
        await supabase.from('rp_lab_ingredients').insert({ lab_id: lab.id, item_name: name, quantity: qty });
        renderFull(container, ctx);
      });
    }

    container.querySelectorAll('[data-delete-ing]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer cet ingrédient ?')) return;
        const { error } = await supabase.from('rp_lab_ingredients').delete().eq('id', btn.dataset.deleteIng);
        if (error) { alert('Erreur : ' + error.message); return; }
        renderFull(container, ctx);
      });
    });

    const deleteLabBtn = document.getElementById('btn-delete-lab');
    if (deleteLabBtn) {
      deleteLabBtn.addEventListener('click', async () => {
        if (!confirm(`Supprimer définitivement "${lab.name}" ? Tout son historique de production, ses créneaux et ses ingrédients seront perdus.`)) return;
        const { error } = await supabase.from('rp_labs').delete().eq('id', lab.id);
        if (error) { alert('Erreur : ' + error.message); return; }
        state.currentLabId = null;
        render(container, ctx);
      });
    }

    container.querySelectorAll('.slot-cell').forEach(cell => {
      cell.addEventListener('click', () => handleSlotClick(cell, container, ctx, lab));
    });
  }

  async function handleSlotClick(cell, container, ctx, lab) {
    const hour = parseInt(cell.dataset.hour, 10);
    const slotId = cell.dataset.slotId || null;
    const mine = cell.dataset.mine === '1';
    const realState = cell.dataset.realState;

    if (!slotId) {
      const { error } = await supabase.from('rp_lab_slots').insert({
        org_id: state.org.id, lab_id: lab.id, slot_date: state.currentDate, slot_hour: hour,
        state: 'pris', claimed_by: state.membership.user_id, claimed_at: new Date().toISOString()
      });
      if (error) alert('Impossible de réclamer ce créneau : ' + error.message);
      renderFull(container, ctx);
      return;
    }

    if (!mine && !state.admin) return;

    if (realState === 'pris') {
      openActionModal(container, ctx, lab, slotId, mine);
    }
  }

  function openActionModal(container, ctx, lab, slotId, mine) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    if (!mine) {
      overlay.innerHTML = `
        <div class="modal-box">
          <h3>Créneau — ${escapeHtml(lab.name)}</h3>
          <p style="font-size:12px;color:var(--ts);margin-bottom:16px">Ce créneau est réservé par un autre membre. Tu peux forcer sa libération.</p>
          <div class="modal-actions">
            <button class="btn-ghost" id="modal-cancel">Annuler</button>
            <button class="btn-primary" id="modal-release-admin">Forcer la libération</button>
          </div>
          <div class="form-error" id="modal-error"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
      overlay.querySelector('#modal-release-admin').addEventListener('click', async () => {
        const { error } = await supabase.from('rp_lab_slots').delete().eq('id', slotId);
        overlay.remove();
        if (error) alert('Impossible de libérer : ' + error.message);
        renderFull(container, ctx);
      });
      return;
    }

    overlay.innerHTML = `
      <div class="modal-box">
        <h3>Créneau — ${escapeHtml(lab.name)}</h3>
        <div class="field"><label>Résultat</label>
          <select id="modal-result" style="width:100%;padding:11px;background:var(--bg);border:1px solid var(--border);border-radius:9px;color:var(--t)">
            <option value="realise">Réalisé</option>
            <option value="perte">Perte</option>
          </select>
        </div>
        <div class="field" id="qty-field"><label>Quantité produite (${escapeHtml(lab.output_unit)})</label><input type="number" id="modal-qty"/></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="modal-cancel">Annuler</button>
          <button class="btn-primary" id="modal-confirm">Valider</button>
        </div>
        <button class="btn-ghost" id="modal-release" style="width:100%;margin-top:8px">Libérer le créneau</button>
        <div class="form-error" id="modal-error"></div>
      </div>`;
    document.body.appendChild(overlay);

    const resultSelect = overlay.querySelector('#modal-result');
    const qtyField = overlay.querySelector('#qty-field');
    resultSelect.addEventListener('change', () => { qtyField.style.display = resultSelect.value === 'realise' ? 'block' : 'none'; });

    overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#modal-release').addEventListener('click', async () => {
      const { error } = await supabase.from('rp_lab_slots').delete().eq('id', slotId);
      overlay.remove();
      if (error) alert('Impossible de libérer : ' + error.message);
      renderFull(container, ctx);
    });
    overlay.querySelector('#modal-confirm').addEventListener('click', async () => {
      const result = resultSelect.value;
      const qty = result === 'realise' ? parseFloat(overlay.querySelector('#modal-qty').value) : null;
      if (result === 'realise' && (isNaN(qty) || qty <= 0)) {
        overlay.querySelector('#modal-error').textContent = 'Indique une quantité valide.';
        return;
      }
      const { error } = await supabase.rpc('rp_complete_slot', { p_slot_id: slotId, p_result: result, p_quantity: qty });
      overlay.remove();
      if (error) alert('Erreur : ' + error.message);
      renderFull(container, ctx);
    });
  }

  function openCreateLabModal(container, ctx) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>${createButtonLabel}</h3>
        <div class="field"><label>Nom</label><input type="text" id="new-lab-name-modal" placeholder="${namePlaceholder}"/></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="modal-cancel">Annuler</button>
          <button class="btn-primary" id="modal-confirm">Créer</button>
        </div>
        <div class="form-error" id="modal-error"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#modal-confirm').addEventListener('click', async () => {
      const name = overlay.querySelector('#new-lab-name-modal').value.trim();
      const err = overlay.querySelector('#modal-error');
      if (!name) { err.textContent = 'Donne un nom.'; return; }
      const { data, error } = await supabase.from('rp_labs')
        .insert({ org_id: state.org.id, name, created_by: state.membership.user_id, category })
        .select('id').single();
      if (error) { err.textContent = error.message; return; }
      overlay.remove();
      state.currentLabId = data.id;
      render(container, ctx);
    });
  }

  return { title, subtitle, render };
}

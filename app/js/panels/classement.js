import { supabase } from '../supabase-client.js';
import { currentWeekRange, currentMonthRange } from '../date-utils.js';
import { fetchOrgMembers, buildNameMap } from '../members.js';
import { escapeHtml, formatMoney } from '../format.js';

export const title = 'Classement';
export const subtitle = 'Classement des membres par activité';

let state = { period: 'week', category: 'all' };

const PERIOD_LABELS = { week: 'Cette semaine', month: 'Ce mois', all: 'Depuis toujours' };
const CATEGORY_LABELS = { all: 'Tout', laboratoire: 'Laboratoire', recolte: 'Récolte', braquage: 'Braquage', transaction: 'Transaction' };

function periodRange(period, tz) {
  if (period === 'week') return currentWeekRange(tz);
  if (period === 'month') return currentMonthRange(tz);
  return null;
}

// Production (all/laboratoire/recolte) : classement par nombre de lots, pas par quantité
// sommée — différents labos ont des output_unit différents (grammes/unités/pierres),
// sommer les quantités brutes entre labos mélangerait des unités incompatibles. Le nombre
// de lots est comparable sans ambiguïté ; les quantités restent affichées groupées par unité.
async function computeProductionRows(org, category, range) {
  let query = supabase.from('rp_production_log').select('member_id, quantity, unit, lab_id, produced_at').eq('org_id', org.id);
  if (range) query = query.gte('produced_at', range.start.toISOString()).lt('produced_at', range.end.toISOString());
  const [{ data: logs }, { data: labs }] = await Promise.all([
    query,
    supabase.from('rp_labs').select('id, category').eq('org_id', org.id)
  ]);
  const categoryByLabId = {};
  (labs ?? []).forEach(l => { categoryByLabId[l.id] = l.category; });
  const filteredLogs = (logs ?? []).filter(l => category === 'all' || categoryByLabId[l.lab_id] === category);

  const statsByMember = {};
  filteredLogs.forEach(l => {
    if (!statsByMember[l.member_id]) statsByMember[l.member_id] = { count: 0, byUnit: {} };
    statsByMember[l.member_id].count += 1;
    statsByMember[l.member_id].byUnit[l.unit] = (statsByMember[l.member_id].byUnit[l.unit] ?? 0) + Number(l.quantity);
  });
  return Object.entries(statsByMember).map(([memberId, s]) => ({
    memberId, count: s.count,
    detail: Object.entries(s.byUnit).map(([unit, qty]) => `<span class="pill">${qty} ${escapeHtml(unit)}</span>`).join(' ')
  }));
}

// Braquage : nombre de braquages où le membre a participé, et somme des montants de ces
// braquages (montant total du braquage, pas divisé par participant — la déclaration ne
// stocke qu'un montant global, pas de part individuelle).
async function computeHeistRows(org, range) {
  let query = supabase.from('rp_heist_log').select('id, amount, declared_at').eq('org_id', org.id);
  if (range) query = query.gte('declared_at', range.start.toISOString()).lt('declared_at', range.end.toISOString());
  const { data: logs } = await query;
  const logIds = (logs ?? []).map(l => l.id);
  if (logIds.length === 0) return [];
  const amountByLog = {};
  (logs ?? []).forEach(l => { amountByLog[l.id] = Number(l.amount); });

  const { data: participants } = await supabase.from('rp_heist_log_participants')
    .select('heist_log_id, member_id').in('heist_log_id', logIds);

  const statsByMember = {};
  (participants ?? []).forEach(p => {
    if (!statsByMember[p.member_id]) statsByMember[p.member_id] = { count: 0, total: 0 };
    statsByMember[p.member_id].count += 1;
    statsByMember[p.member_id].total += amountByLog[p.heist_log_id] ?? 0;
  });
  return Object.entries(statsByMember).map(([memberId, s]) => ({
    memberId, count: s.count, detail: formatMoney(s.total)
  }));
}

// Transaction : nombre de ventes enregistrées et montant total par membre.
async function computeTransactionRows(org, range) {
  let query = supabase.from('rp_transactions').select('member_id, amount, sold_at').eq('org_id', org.id);
  if (range) query = query.gte('sold_at', range.start.toISOString()).lt('sold_at', range.end.toISOString());
  const { data: rows } = await query;
  const statsByMember = {};
  (rows ?? []).forEach(r => {
    if (!statsByMember[r.member_id]) statsByMember[r.member_id] = { count: 0, total: 0 };
    statsByMember[r.member_id].count += 1;
    statsByMember[r.member_id].total += Number(r.amount);
  });
  return Object.entries(statsByMember).map(([memberId, s]) => ({
    memberId, count: s.count, detail: formatMoney(s.total)
  }));
}

const COUNT_LABELS = { laboratoire: 'Labos produits', recolte: 'Labos produits', braquage: 'Braquages faits', transaction: 'Ventes faites' };
const DETAIL_LABELS = { laboratoire: 'Quantités', recolte: 'Quantités', braquage: 'Montant total', transaction: 'Montant total' };

const rankBadge = (i) => {
  if (i === 0) return '<span class="rank-badge gold">1</span>';
  if (i === 1) return '<span class="rank-badge silver">2</span>';
  if (i === 2) return '<span class="rank-badge bronze">3</span>';
  return `<span class="rank-badge">${i + 1}</span>`;
};

export async function render(container, ctx) {
  const { org, membership } = ctx;
  const tz = org.timezone ?? 'Europe/Paris';
  const range = periodRange(state.period, tz);

  const members = await fetchOrgMembers(org.id);
  const nameByUserId = buildNameMap(members);

  if (state.category === 'all') {
    await renderAll(container, ctx, org, range, nameByUserId, membership);
    return;
  }

  const stats = state.category === 'braquage' ? await computeHeistRows(org, range)
    : state.category === 'transaction' ? await computeTransactionRows(org, range)
    : await computeProductionRows(org, state.category, range);

  const rows = stats
    .map(s => ({ ...s, name: nameByUserId[s.memberId] ?? '—' }))
    .sort((a, b) => b.count - a.count);

  container.innerHTML = `
    ${renderTabs()}
    <div class="panel-card">
      ${rows.length === 0 ? '<div class="empty-state">Aucune activité sur cette période.</div>' :
        `<table class="data-table"><thead><tr><th>Rang</th><th>Membre</th><th>${COUNT_LABELS[state.category]}</th><th>${DETAIL_LABELS[state.category]}</th></tr></thead><tbody>
          ${rows.map((r, i) => `
            <tr class="${r.memberId === membership.user_id ? 'me' : ''}">
              <td>${rankBadge(i)}</td>
              <td>${r.name}</td>
              <td>${r.count}</td>
              <td>${r.detail}</td>
            </tr>`).join('')}
        </tbody></table>`}
    </div>
  `;
  wireTabs(container, ctx);
}

// "Tout" combine les 4 sources d'activité (labo, récolte, braquage, transaction) sur une
// seule ligne par membre — impossible de les réduire à un seul nombre comparable (lots vs
// $), donc chaque type garde sa propre paire de colonnes. Classé par activité totale.
async function renderAll(container, ctx, org, range, nameByUserId, membership) {
  const [labo, recolte, heist, tx] = await Promise.all([
    computeProductionRows(org, 'laboratoire', range),
    computeProductionRows(org, 'recolte', range),
    computeHeistRows(org, range),
    computeTransactionRows(org, range)
  ]);

  const byMember = {};
  const ensure = (id) => {
    if (!byMember[id]) byMember[id] = {
      memberId: id, name: nameByUserId[id] ?? '—',
      labo: { count: 0, detail: '' }, recolte: { count: 0, detail: '' },
      heist: { count: 0, detail: formatMoney(0) }, tx: { count: 0, detail: formatMoney(0) }
    };
    return byMember[id];
  };
  labo.forEach(s => { ensure(s.memberId).labo = s; });
  recolte.forEach(s => { ensure(s.memberId).recolte = s; });
  heist.forEach(s => { ensure(s.memberId).heist = s; });
  tx.forEach(s => { ensure(s.memberId).tx = s; });

  const rows = Object.values(byMember)
    .map(r => ({ ...r, total: r.labo.count + r.recolte.count + r.heist.count + r.tx.count }))
    .sort((a, b) => b.total - a.total);

  container.innerHTML = `
    ${renderTabs()}
    <div class="panel-card">
      ${rows.length === 0 ? '<div class="empty-state">Aucune activité sur cette période.</div>' :
        `<div style="overflow-x:auto"><table class="data-table"><thead><tr>
            <th>Rang</th><th>Membre</th>
            <th>Labos produits</th><th>Quantités labo</th>
            <th>Points de récolte</th><th>Quantités récolte</th>
            <th>Braquages faits</th><th>Montant braquages</th>
            <th>Ventes faites</th><th>Montant ventes</th>
          </tr></thead><tbody>
          ${rows.map((r, i) => `
            <tr class="${r.memberId === membership.user_id ? 'me' : ''}">
              <td>${rankBadge(i)}</td>
              <td>${r.name}</td>
              <td>${r.labo.count}</td><td>${r.labo.detail || '—'}</td>
              <td>${r.recolte.count}</td><td>${r.recolte.detail || '—'}</td>
              <td>${r.heist.count}</td><td>${r.heist.detail}</td>
              <td>${r.tx.count}</td><td>${r.tx.detail}</td>
            </tr>`).join('')}
        </tbody></table></div>`}
    </div>
  `;
  wireTabs(container, ctx);
}

function renderTabs() {
  return `
    <div class="lab-tabs">
      ${Object.entries(PERIOD_LABELS).map(([key, label]) =>
        `<button class="lab-tab ${state.period === key ? 'active' : ''}" data-period="${key}">${label}</button>`).join('')}
    </div>
    <div class="lab-tabs">
      ${Object.entries(CATEGORY_LABELS).map(([key, label]) =>
        `<button class="lab-tab ${state.category === key ? 'active' : ''}" data-category="${key}">${label}</button>`).join('')}
    </div>`;
}

function wireTabs(container, ctx) {
  container.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => { state.period = btn.dataset.period; render(container, ctx); });
  });
  container.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => { state.category = btn.dataset.category; render(container, ctx); });
  });
}

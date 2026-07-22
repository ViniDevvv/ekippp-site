import { supabase } from './supabase-client.js';
import { requireSession, logout } from './auth.js';
import { setStoredOrgId } from './org.js';

async function init() {
  const session = await requireSession();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', logout);

  const createForm = document.getElementById('form-create');
  const createErr = document.getElementById('create-error');
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    createErr.textContent = '';
    const name = document.getElementById('org-name').value.trim();
    if (!name) { createErr.textContent = 'Donne un nom à ton organisation.'; return; }
    const btn = createForm.querySelector('button');
    btn.disabled = true; btn.textContent = 'Création…';
    const { data, error } = await supabase.rpc('rp_create_organization', { p_name: name });
    btn.disabled = false; btn.textContent = 'Créer mon organisation';
    if (error) { createErr.textContent = "Erreur : " + error.message; return; }
    const orgId = data?.[0]?.org_id;
    if (orgId) setStoredOrgId(orgId);
    window.location.href = 'app.html';
  });

  const joinForm = document.getElementById('form-join');
  const joinErr = document.getElementById('join-error');
  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    joinErr.textContent = '';
    const code = document.getElementById('invite-code').value.trim();
    if (!code) { joinErr.textContent = 'Entre un code d\'invitation.'; return; }
    const btn = joinForm.querySelector('button');
    btn.disabled = true; btn.textContent = 'Vérification…';
    const { data, error } = await supabase.rpc('rp_redeem_invite_code', { p_code: code });
    btn.disabled = false; btn.textContent = 'Rejoindre';
    if (error) {
      console.error('rp_redeem_invite_code error:', error);
      if (error.message.includes('already a member')) {
        joinErr.textContent = 'Tu es déjà membre de cette organisation.';
      } else if (error.message.includes('invalid or expired code')) {
        joinErr.textContent = 'Code invalide ou expiré.';
      } else {
        joinErr.textContent = 'Erreur : ' + error.message;
      }
      return;
    }
    const orgId = data?.[0]?.org_id;
    if (orgId) setStoredOrgId(orgId);
    window.location.href = 'app.html';
  });
}

init();

import { supabase } from './supabase-client.js';

// Chemins relatifs partout (jamais de "/xxx.html") — l'app doit pouvoir tourner à la racine
// d'un domaine (omertaos.vercel.app) ou sous un sous-chemin (ekippp-site.vercel.app/app/)
// sans aucun changement de code.
export async function loginWithDiscord() {
  const redirectTo = new URL('callback.html', window.location.href).href;
  await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo } });
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('ekippp_groupe_current_org');
  window.location.href = 'index.html';
}

// Retourne la session, ou null. Ne redirige jamais elle-même — laisse la page appelante décider.
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

// Garde de session à utiliser sur toute page qui exige d'être connecté.
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

import { fetchMyMemberships } from './org.js';

const CHECK_INTERVAL_MS = 20000;

// Filet de sécurité indépendant de Realtime. Si un membre est exclu (status='removed') ou
// si son org est désactivée/supprimée, sa propre policy RLS peut cesser de le laisser voir
// cet évènement en Realtime (la policy s'évalue sur l'état déjà révoqué au moment de la
// livraison) — on ne peut pas garantir la réception de sa propre exclusion par Realtime seul.
// Ce sondage périodique revérifie l'appartenance réelle et recharge la page si elle n'est
// plus valide, ce qui relance tout app-boot.js et renvoie l'utilisateur exactement là où il
// doit être (gate screen, onboarding, ou une autre org encore valide, via le fallback déjà
// existant dans resolveCurrentMembership). Volontairement PAS soumis au garde-fou "ne pas
// interrompre un formulaire" de refreshCurrentPanel : une révocation d'accès doit rester
// fiable même en pleine saisie.
export function startSessionWatchdog(ctx) {
  setInterval(async () => {
    let memberships;
    try {
      memberships = await fetchMyMemberships();
    } catch {
      return; // erreur réseau transitoire : on retente au prochain tick, pas de faux positif
    }
    const current = memberships.find(m => m.org_id === ctx.org.id);
    if (!current || !current.rp_organizations.is_active) {
      window.location.reload();
    }
  }, CHECK_INTERVAL_MS);
}

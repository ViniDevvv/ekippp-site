// Calculs de bornes jour/semaine/mois "en cours" dans le fuseau d'une organisation.
// Ne pas utiliser pour l'affichage cosmétique d'un timestamp historique (voir CLAUDE conventions
// existantes : l'historique de production/dépenses/etc. reste new Date(x).toLocaleString('fr-FR')
// sans paramètre timeZone).

export function todayInTz(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
}

export function fmtDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function shiftDate(dateStr, deltaDays) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + deltaDays);
  return d.toLocaleDateString('en-CA');
}

// Une heure est "passée" si son créneau (heure+1) est déjà terminé dans le fuseau donné.
export function isHourPast(dateStr, hour, tz) {
  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const slotEnd = new Date(dateStr + 'T00:00:00');
  slotEnd.setHours(hour + 1, 0, 0, 0);
  return nowInTz >= slotEnd;
}

export function currentWeekRange(tz) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const day = (now.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(now); monday.setDate(now.getDate() - day); monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);
  return { start: monday, end: nextMonday };
}

export function currentMonthRange(tz) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

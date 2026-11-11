/* Progresso de projetos derivado de horas confirmadas */
export function projectProgress(p) {
  const pct = Math.min(100, Math.round((Number(p.contributedHours) / Number(p.goalHours)) * 100) || 0);
  return { pct, remaining: Math.max(0, Number(p.goalHours) - Number(p.contributedHours)) };
}
export function filterProjects(list, { q = '', category = 'todas', location = 'todas', status = 'todas', onlyNeeds = false } = {}) {
  let out = list.slice();
  if (category !== 'todas') out = out.filter(p => p.category === category);
  if (location !== 'todas') out = out.filter(p => p.location === location);
  if (status !== 'todas') out = out.filter(p => p.status === status);
  if (onlyNeeds) out = out.filter(p => Number(p.contributedHours) < Number(p.goalHours));
  if (q) {
    const s = q.toLowerCase();
    out = out.filter(p => (p.title + ' ' + p.description + ' ' + p.objective).toLowerCase().includes(s));
  }
  return out;
}

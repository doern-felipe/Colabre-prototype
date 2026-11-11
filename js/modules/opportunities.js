/* Filtros e ordenação de oportunidades */
export function filterOpportunities(list, { q = '', type = 'todas', category = 'todas', modality = 'todas', duration = 'todas', sort = 'recentes' } = {}) {
  let out = list.filter(o => o.status !== 'cancelled');
  if (type !== 'todas') out = out.filter(o => o.type === type);
  if (category !== 'todas') out = out.filter(o => o.category === category);
  if (modality !== 'todas') out = out.filter(o => o.modality === modality || o.modality === 'ambas');
  if (duration === 'ate1') out = out.filter(o => o.durationHours <= 1);
  if (duration === '1a2') out = out.filter(o => o.durationHours > 1 && o.durationHours <= 2);
  if (duration === 'mais2') out = out.filter(o => o.durationHours > 2);
  if (q) {
    const s = q.toLowerCase();
    out = out.filter(o => (o.title + ' ' + o.description + ' ' + o.category).toLowerCase().includes(s));
  }
  if (sort === 'recentes') out = [...out].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (sort === 'duracao') out = [...out].sort((a, b) => a.durationHours - b.durationHours);
  if (sort === 'relevancia') out = [...out].sort((a, b) => (a.title.length - b.title.length));
  return out;
}

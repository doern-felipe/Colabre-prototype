/* Regra de níveis — consistente, transparente e calculada a partir de dados reais.
   Pontuação = 10×atividades concluídas + 2×horas contribuídas + 2×avaliações recebidas
              + 1×pessoas ajudadas + 5×projetos participando.
   Avaliações usam a média real (incluindo o histórico inicial de perfis de exemplo). */
export const LEVELS = ['Iniciante', 'Colaborador', 'Participante ativo', 'Referência comunitária', 'Embaixador'];

export const LEVEL_THRESHOLDS = [0, 25, 75, 150, 250];

export const LEVEL_WEIGHTS = {
  completed: 10,
  hours: 2,
  ratings: 2,
  people: 1,
  projects: 5,
};

export function computeLevel({ completed = 0, hours = 0, ratingsCount = 0, peopleHelped = 0, projects = 0 } = {}) {
  const score = Math.round((
    Number(completed) * LEVEL_WEIGHTS.completed +
    Number(hours) * LEVEL_WEIGHTS.hours +
    Number(ratingsCount) * LEVEL_WEIGHTS.ratings +
    Number(peopleHelped) * LEVEL_WEIGHTS.people +
    Number(projects) * LEVEL_WEIGHTS.projects
  ) * 10) / 10;

  let index = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (score >= LEVEL_THRESHOLDS[i]) index = i;
  }
  const current = LEVEL_THRESHOLDS[index];
  const next = index < LEVEL_THRESHOLDS.length - 1 ? LEVEL_THRESHOLDS[index + 1] : null;
  const progress = next == null ? 100 : Math.max(0, Math.min(100, Math.round(((score - current) / (next - current)) * 100)));
  return {
    level: LEVELS[index],
    levelIndex: index,
    score,
    nextLevel: next == null ? null : LEVELS[index + 1],
    nextThreshold: next,
    pointsToNext: next == null ? 0 : Math.max(0, Math.ceil((next - score) * 10) / 10),
    progress,
    breakdown: {
      completed: Number(completed),
      hours: Number(hours),
      ratingsCount: Number(ratingsCount),
      peopleHelped: Number(peopleHelped),
      projects: Number(projects),
    },
  };
}

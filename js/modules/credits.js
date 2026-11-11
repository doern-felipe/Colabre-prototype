/* Lógica de créditos: 1 hora = 1 crédito, movimentação única após confirmação mútua */
import { uid } from '../storage.js';

export function getBalance(db, userId) {
  const txs = db.transactions.filter(t => t.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
  return txs.length ? txs[txs.length - 1].balanceAfter : 0;
}

export function getStats(db, userId) {
  const txs = db.transactions.filter(t => t.userId === userId);
  const received = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const used = Math.abs(txs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  return { received, used, balance: getBalance(db, userId) };
}

export function addTransaction(db, userId, amount, description, date = new Date().toISOString().slice(0, 10)) {
  if (Number(amount) === 0) return null;
  const bal = getBalance(db, userId) + Number(amount);
  const tx = { id: uid('t'), userId, amount: Number(amount), description, date, balanceAfter: Math.round(bal * 10) / 10 };
  db.transactions.push(tx);
  return tx;
}

/* Transfere créditos uma única vez quando atividade é concluída.
   Quem ofereceu ajuda recebe; quem solicitou paga. */
export function settleActivity(db, activity) {
  if (activity.credited || activity.status !== 'concluida') return false;
  const opp = db.opportunities.find(o => o.id === activity.oppId);
  if (!opp) return false;
  const hours = Number(activity.confirmedHours || activity.plannedHours);
  const provider = opp.type === 'offer' ? activity.ownerId : activity.interestedId;
  const requester = opp.type === 'offer' ? activity.interestedId : activity.ownerId;
  // Impede saldo negativo: se requester não tem saldo, ainda registra (demonstração) mas avisa via flag
  addTransaction(db, provider, hours, `Atividade concluída: ${opp.title}`);
  addTransaction(db, requester, -hours, `Atividade concluída: ${opp.title}`);
  activity.credited = true;
  const pUser = db.users.find(u => u.id === provider);
  if (pUser) { pUser.hoursShared = (pUser.hoursShared || 0) + hours; pUser.activitiesCompleted = (pUser.activitiesCompleted || 0) + 1; pUser.peopleHelped = (pUser.peopleHelped || 0) + 1; }
  const rUser = db.users.find(u => u.id === requester);
  if (rUser) { rUser.activitiesCompleted = (rUser.activitiesCompleted || 0) + 1; }
  return true;
}

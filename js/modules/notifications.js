/* Notificações demonstrativas */
import { uid } from '../storage.js';

export function notify(db, userId, title, message, link = { view: 'notificacoes' }) {
  db.notifications.unshift({ id: uid('n'), userId, title, message, date: new Date().toISOString().slice(0, 10), read: false, link });
}
export function unreadCount(db, userId) {
  return db.notifications.filter(n => n.userId === userId && !n.read).length;
}

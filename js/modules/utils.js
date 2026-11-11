/* Utilidades compartilhadas */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initials(name = '') {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function fmtCredits(n) {
  const v = Number(n);
  return (v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ','));
}
export function fmtHoursDesc(hours) {
  const h = Number(hours);
  const whole = Math.floor(h), min = Math.round((h - whole) * 60);
  if (whole === 0) return `${min} minutos`;
  if (min === 0) return whole === 1 ? '1 hora' : `${whole} horas`;
  return `${whole}h${String(min).padStart(2, '0')}`;
}
export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function toast(msg, type = 'success') {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3400);
}
export function confirmModal({ title, message, confirmLabel = 'Confirmar', onConfirm }) {
  const m = $('#modal');
  $('#modal-title').textContent = title;
  $('#modal-message').textContent = message;
  const btn = $('#modal-confirm');
  btn.textContent = confirmLabel;
  btn.onclick = () => { closeModal(); onConfirm && onConfirm(); };
  m.classList.add('open');
}
export function closeModal() { $('#modal').classList.remove('open'); }
export function groupBy(arr, key) {
  return arr.reduce((a, x) => { (a[x[key]] = a[x[key]] || []).push(x); return a; }, {});
}

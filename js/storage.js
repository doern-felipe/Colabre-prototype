/* O Tempo Vale — Persistência demonstrativa (localStorage) */
import { seedData } from './data.js';

const KEY = 'otempoVale_v1';

export function loadDB() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const db = seedData();
      localStorage.setItem(KEY, JSON.stringify(db));
      return db;
    }
    return JSON.parse(raw);
  } catch (e) {
    const db = seedData();
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }
}

export function saveDB(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function resetDB() {
  const db = seedData();
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

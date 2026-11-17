/* Autenticação real: scrypt, sessões HttpOnly, códigos de e-mail com expiração,
   uso único, limite de tentativas e proteção contra abuso. */
import { scryptSync, timingSafeEqual, randomBytes, randomInt, createHmac, createHash } from 'node:crypto';
import { getDB, hashToken, metaSecret, nowISO, uid } from './db.mjs';

const DAY = 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
export const SESSION_DAYS = 30;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function passwordProblem(password, confirm) {
  const p = String(password || '');
  if (p.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'A senha precisa misturar letras e números.';
  if (confirm !== undefined && p !== String(confirm || '')) return 'As senhas não conferem.';
  return null;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
  return `scrypt$16384$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    if (!stored) return false;
    const [algo, nRaw, salt, expectedHex] = String(stored).split('$');
    if (algo !== 'scrypt' || !salt || !expectedHex) return false;
    const n = Number(nRaw) || 16384;
    const got = scryptSync(String(password), salt, 64, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const expected = Buffer.from(expectedHex, 'hex');
    if (got.length !== expected.length) return false;
    return timingSafeEqual(got, expected);
  } catch (_) {
    return false;
  }
}

/* ---------- Limite de tentativas ---------- */
export function rateLimit(key, limit, windowMs) {
  const db = getDB();
  const now = Date.now();
  const row = db.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').get(key);
  if (!row || now - Number(row.window_start) > windowMs) {
    db.prepare('INSERT INTO rate_limits (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start')
      .run(key, now);
    return { ok: true, remaining: limit - 1 };
  }
  if (Number(row.count) >= limit) {
    return { ok: false, retryAfter: Math.ceil((Number(row.window_start) + windowMs - now) / 1000) };
  }
  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return { ok: true, remaining: limit - Number(row.count) - 1 };
}

export function resetRateLimit(key) {
  getDB().prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
}

/* ---------- Códigos de verificação / recuperação ---------- */
function codeHash(userId, kind, code) {
  return createHmac('sha256', metaSecret()).update(`${userId}:${kind}:${code}`).digest('hex');
}

export function issueCode(userId, kind) {
  const db = getDB();
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const now = nowISO();
  const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();
  // Invalida códigos anteriores do mesmo tipo.
  db.prepare('UPDATE auth_codes SET used = 1 WHERE user_id = ? AND kind = ? AND used = 0').run(userId, kind);
  db.prepare('INSERT INTO auth_codes (user_id,kind,code_hash,expires_at,attempts,used,created_at) VALUES (?,?,?,?,0,0,?)')
    .run(userId, kind, codeHash(userId, kind, code), expires, now);
  return code;
}

export function verifyCode(userId, kind, code) {
  const db = getDB();
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== 6) return { ok: false, error: 'Informe o código de 6 dígitos.' };
  const row = db.prepare('SELECT * FROM auth_codes WHERE user_id = ? AND kind = ? AND used = 0 ORDER BY id DESC LIMIT 1')
    .get(userId, kind);
  if (!row) return { ok: false, error: 'Nenhum código ativo. Solicite um novo código.' };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').run(row.id);
    return { ok: false, error: 'Este código expirou. Solicite um novo.' };
  }
  if (Number(row.attempts) >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: 'Muitas tentativas. Solicite um novo código.' };
  }
  const expected = Buffer.from(row.code_hash, 'hex');
  const got = Buffer.from(codeHash(userId, kind, clean), 'hex');
  const match = expected.length === got.length && timingSafeEqual(expected, got);
  if (!match) {
    const attempts = Number(row.attempts) + 1;
    db.prepare('UPDATE auth_codes SET attempts = ? WHERE id = ?').run(attempts, row.id);
    if (attempts >= MAX_CODE_ATTEMPTS) {
      db.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').run(row.id);
      return { ok: false, error: 'Muitas tentativas. Solicite um novo código.' };
    }
    return { ok: false, error: `Código incorreto. Tentativas restantes: ${MAX_CODE_ATTEMPTS - attempts}.` };
  }
  db.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').run(row.id);
  return { ok: true };
}

export function lastCodeAge(userId, kind) {
  const row = getDB().prepare('SELECT created_at FROM auth_codes WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT 1')
    .get(userId, kind);
  if (!row) return Infinity;
  return Date.now() - new Date(row.created_at).getTime();
}

/* ---------- Sessões ---------- */
export function createSession(userId, ip = '', userAgent = '') {
  const db = getDB();
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * DAY);
  db.prepare('INSERT INTO sessions (token_hash,user_id,created_at,expires_at,ip,user_agent) VALUES (?,?,?,?,?,?)')
    .run(hashToken(token), userId, now.toISOString(), expires.toISOString(), ip || '', String(userAgent || '').slice(0, 300));
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now.toISOString(), userId);
  return { token, expiresAt: expires.toISOString() };
}

export function sessionFromToken(token) {
  if (!token) return null;
  const db = getDB();
  const row = db.prepare(`SELECT s.token_hash, s.expires_at, u.*
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`).get(hashToken(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  return row;
}

export function destroySession(token) {
  if (!token) return;
  getDB().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function destroyAllSessions(userId) {
  getDB().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function cleanupExpired() {
  const db = getDB();
  const now = nowISO();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM auth_codes WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(Date.now() - 24 * 60 * 60 * 1000);
}

export function newUserId() { return uid('u'); }
export function newInviteCode(db, makeCode) { return makeCode(db); }

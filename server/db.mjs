/* Colabre — banco de dados SQLite (Node 22+ / node:sqlite)
   Nenhuma dependência externa. O banco é a fonte oficial de verdade. */
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { seedData } from '../js/data.js';

export const DB_PATH = process.env.DB_PATH
  ? resolve(process.env.DB_PATH)
  : resolve(process.cwd(), 'data', 'colabre.sqlite');

export function uid(prefix = 'id') {
  return prefix + '_' + randomBytes(6).toString('base64url');
}

export function nowISO() { return new Date().toISOString(); }

let _db = null;

export function getDB() {
  if (_db) return _db;
  if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  _db.exec('PRAGMA busy_timeout = 5000;');
  migrate(_db);
  seedIfEmpty(_db);
  return _db;
}

export function closeDB() {
  if (_db) { try { _db.close(); } catch (_) {} _db = null; }
}

function migrate(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#2563EB',
    bio TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT '',
    privacy TEXT NOT NULL DEFAULT 'publico' CHECK (privacy IN ('publico','conexoes','privado')),
    show_activity INTEGER NOT NULL DEFAULT 1,
    invite_code TEXT UNIQUE,
    referred_by TEXT,
    referral_confirmed_at TEXT,
    is_seed INTEGER NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    hours_shared REAL NOT NULL DEFAULT 0,
    activities_completed INTEGER NOT NULL DEFAULT 0,
    people_helped INTEGER NOT NULL DEFAULT 0,
    rating_sum_base REAL NOT NULL DEFAULT 0,
    rating_count_base INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_seen_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS auth_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('verify','reset')),
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_auth_codes_user ON auth_codes(user_id, kind, used);

  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, name)
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('offer','request')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    modality TEXT NOT NULL,
    duration_hours REAL NOT NULL,
    availability TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'published',
    is_seed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_opps_created ON opportunities(created_at DESC);

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    objective TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    start_date TEXT NOT NULL,
    goal_hours REAL NOT NULL,
    contributed_hours REAL NOT NULL DEFAULT 0,
    expected_participants INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'Ativo',
    visibility TEXT NOT NULL DEFAULT 'aberto',
    emoji TEXT NOT NULL DEFAULT '🌱',
    color_light TEXT NOT NULL DEFAULT '#10B981',
    color_dark TEXT NOT NULL DEFAULT '#059669',
    is_seed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_needs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    hours REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS project_participants (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS project_updates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    hours REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    opp_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interested_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'interesse'
      CHECK (status IN ('interesse','aceita','em_andamento','finalizada','concluida','contestada','cancelada')),
    planned_hours REAL NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    confirmed_hours REAL,
    requester_confirmed INTEGER NOT NULL DEFAULT 0,
    provider_confirmed INTEGER NOT NULL DEFAULT 0,
    credited INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    start_code_hash TEXT,
    start_code_used INTEGER NOT NULL DEFAULT 0,
    start_code_expires TEXT,
    contest_reason TEXT,
    proposed_hours REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (opp_id, interested_id)
  );
  CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_id);
  CREATE INDEX IF NOT EXISTS idx_activities_interested ON activities(interested_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    activity_id TEXT,
    date TEXT NOT NULL,
    balance_after REAL NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (activity_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC);

  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (activity_id, from_id),
    CHECK (from_id <> to_id)
  );
  CREATE INDEX IF NOT EXISTS idx_ratings_to ON ratings(to_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendente'
      CHECK (status IN ('pendente','aceito','recusado','cancelado')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (requester_id <> addressee_id),
    UNIQUE (requester_id, addressee_id)
  );
  CREATE INDEX IF NOT EXISTS idx_conn_requester ON connections(requester_id);
  CREATE INDEX IF NOT EXISTS idx_conn_addressee ON connections(addressee_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_view TEXT NOT NULL DEFAULT 'notificacoes',
    link_id TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    activity_id TEXT REFERENCES activities(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_participants (
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (chat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
  `);
}

export function generateInviteCode(db) {
  for (let i = 0; i < 20; i++) {
    const code = randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
    const exists = db.prepare('SELECT 1 FROM users WHERE invite_code = ?').get(code);
    if (!exists) return code;
  }
  return randomBytes(8).toString('hex').toUpperCase();
}

function seedIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (row && row.n > 0) return;
  const seed = seedData();
  const now = nowISO();
  const insertUser = db.prepare(`INSERT INTO users
    (id,name,email,password_hash,email_verified,color,bio,location,availability,photo,privacy,
     invite_code,hours_shared,activities_completed,people_helped,rating_sum_base,rating_count_base,
     is_seed,created_at,updated_at)
    VALUES (?,?,?,?,1,?,?,?,?,'','publico',?,?,?,?,?,?,1,?,?)`);

  const seedUsers = seed.users.filter(u => u.id !== 'u9');
  for (const u of seedUsers) {
    const email = `seed-${u.id}@colabre.local`;
    const code = generateInviteCode(db);
    const count = Number(u.ratingsCount || 0);
    const avg = Number(u.ratingAvg || 0);
    insertUser.run(
      u.id, u.name, email, null, u.color, u.bio, u.location, u.availability,
      code, Number(u.hoursShared || 0), Number(u.activitiesCompleted || 0), Number(u.peopleHelped || 0),
      Math.round(avg * count * 10) / 10, count, now, now
    );
    for (const s of (u.skills || [])) {
      db.prepare('INSERT OR IGNORE INTO user_skills (user_id,name,created_at) VALUES (?,?,?)').run(u.id, s, now);
    }
  }

  const insOpp = db.prepare(`INSERT INTO opportunities
    (id,owner_id,type,title,description,category,modality,duration_hours,availability,location,status,is_seed,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'published',1,?,?)`);
  for (const o of seed.opportunities) {
    insOpp.run(o.id, o.ownerId, o.type, o.title, o.description, o.category, o.modality,
      Number(o.durationHours), o.availability || '', o.location || '', o.publishedAt + 'T12:00:00.000Z', o.publishedAt + 'T12:00:00.000Z');
  }

  const insProject = db.prepare(`INSERT INTO projects
    (id,owner_id,title,description,objective,category,location,start_date,goal_hours,contributed_hours,
     expected_participants,status,visibility,emoji,color_light,color_dark,is_seed,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`);
  const insNeed = db.prepare('INSERT INTO project_needs (id,project_id,title,hours) VALUES (?,?,?,?)');
  const insPart = db.prepare('INSERT OR IGNORE INTO project_participants (project_id,user_id,joined_at) VALUES (?,?,?)');
  const insUpdate = db.prepare('INSERT INTO project_updates (id,project_id,user_id,text,hours,created_at) VALUES (?,?,?,?,?,?)');
  const covers = {
    p1: { emoji: '🌳', light: '#16A34A', dark: '#15803D' },
    p2: { emoji: '💻', light: '#3B82F6', dark: '#2563EB' },
    p3: { emoji: '🥕', light: '#F97316', dark: '#EA580C' },
    p4: { emoji: '🧘', light: '#8B5CF6', dark: '#7C3AED' },
  };
  for (const p of seed.projects) {
    const cover = covers[p.id] || { emoji: '🌱', light: '#10B981', dark: '#059669' };
    insProject.run(p.id, p.ownerId, p.title, p.description, p.objective, p.category, p.location,
      p.startDate, Number(p.goalHours), Number(p.contributedHours), Number(p.expectedParticipants || 10),
      p.status, p.visibility, cover.emoji, cover.light, cover.dark,
      p.createdAt + 'T12:00:00.000Z', p.createdAt + 'T12:00:00.000Z');
    for (const [i, n] of (p.needs || []).entries()) {
      insNeed.run(`${p.id}_n${i}`, p.id, n.title, Number(n.hours || 0));
    }
    for (const userId of (p.participants || [])) {
      insPart.run(p.id, userId, p.createdAt + 'T12:00:00.000Z');
    }
    for (const [i, u] of (p.updates || []).entries()) {
      insUpdate.run(`${p.id}_up${i}`, p.id, p.ownerId, u.text, 0, u.date + 'T12:00:00.000Z');
    }
  }

  const insAct = db.prepare(`INSERT INTO activities
    (id,opp_id,owner_id,interested_id,status,planned_hours,confirmed_hours,started_at,ended_at,
     requester_confirmed,provider_confirmed,credited,note,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const statusMap = { interesse: 'interesse', confirmada: 'aceita', realizada: 'finalizada', concluida: 'concluida', cancelada: 'cancelada' };
  for (const a of seed.activities) {
    const st = statusMap[a.status] || a.status;
    const concluded = st === 'concluida';
    insAct.run(a.id, a.oppId, a.ownerId, a.interestedId, st, Number(a.plannedHours),
      concluded ? Number(a.confirmedHours || a.plannedHours) : null,
      concluded ? '2026-10-28T13:00:00.000Z' : null,
      concluded ? '2026-10-28T14:00:00.000Z' : null,
      concluded ? 1 : 0, concluded ? 1 : 0, concluded ? 1 : 0,
      a.note || '', a.createdAt + 'T12:00:00.000Z', a.createdAt + 'T12:00:00.000Z');
  }

  const insTx = db.prepare(`INSERT INTO transactions
    (id,user_id,amount,description,activity_id,date,balance_after,created_at)
    VALUES (?,?,?,?,NULL,?,?,?)`);
  // Ordena cronologicamente para preservar o saldo final da seed.
  const txs = [...seed.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of txs) {
    insTx.run(t.id, t.userId, Number(t.amount), t.description, t.date, Number(t.balanceAfter), t.date + 'T12:00:00.000Z');
  }

  const insNotif = db.prepare(`INSERT INTO notifications
    (id,user_id,title,message,link_view,link_id,is_read,created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  for (const n of seed.notifications) {
    insNotif.run(n.id, n.userId, n.title, n.message, n.link?.view || 'notificacoes', n.link?.id || null, n.read ? 1 : 0, n.date + 'T12:00:00.000Z');
  }

  const insChat = db.prepare('INSERT INTO chats (id,activity_id,created_at) VALUES (?,?,?)');
  const insCP = db.prepare('INSERT INTO chat_participants (chat_id,user_id) VALUES (?,?)');
  const insMsg = db.prepare('INSERT INTO messages (id,chat_id,sender_id,text,created_at) VALUES (?,?,?,?,?)');
  for (const c of seed.chats) {
    const act = seed.activities.find(a => a.id === c.activityId);
    insChat.run(c.id, c.activityId, '2026-10-01T12:00:00.000Z');
    if (act) {
      insCP.run(c.id, act.ownerId);
      insCP.run(c.id, act.interestedId);
    }
    for (const m of c.messages) {
      insMsg.run(m.id, c.id, m.senderId, m.text, m.date.length === 16 ? m.date + ':00.000Z' : m.date);
    }
  }

  const insRating = db.prepare('INSERT OR IGNORE INTO ratings (id,activity_id,from_id,to_id,stars,comment,created_at) VALUES (?,?,?,?,?,?,?)');
  for (const r of seed.ratings) {
    insRating.run(r.id, r.activityId, r.fromId, r.toId, Number(r.stars), r.comment || '', r.date + 'T12:00:00.000Z');
  }

  // Conexões de exemplo entre perfis fictícios (marcados como exemplo).
  const insConn = db.prepare('INSERT OR IGNORE INTO connections (id,requester_id,addressee_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)');
  insConn.run('conn_seed_1', 'u1', 'u2', 'aceito', '2026-09-01T12:00:00.000Z', '2026-09-02T12:00:00.000Z');
  insConn.run('conn_seed_2', 'u1', 'u4', 'aceito', '2026-09-05T12:00:00.000Z', '2026-09-06T12:00:00.000Z');
  insConn.run('conn_seed_3', 'u2', 'u3', 'aceito', '2026-09-10T12:00:00.000Z', '2026-09-11T12:00:00.000Z');
  insConn.run('conn_seed_4', 'u5', 'u1', 'pendente', '2026-11-10T12:00:00.000Z', '2026-11-10T12:00:00.000Z');
}

export function getMeta(key) {
  const db = getDB();
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setMeta(key, value) {
  const db = getDB();
  db.prepare('INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function metaSecret() {
  let secret = getMeta('secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    setMeta('secret', secret);
  }
  return secret;
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

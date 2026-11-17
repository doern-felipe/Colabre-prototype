/* Monta o estado consumido pelo frontend. Toda filtragem de privacidade
   e autorização de leitura acontece aqui, no servidor. */
import { getDB, uid, nowISO } from './db.mjs';
import { computeLevel } from './levels.mjs';

function toDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}
function cleanUserRow(row) {
  if (!row) return null;
  return row;
}

export function ratingAggregate(db, userId) {
  const real = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(stars),0) AS s FROM ratings WHERE to_id = ?').get(userId);
  const row = db.prepare('SELECT rating_sum_base AS bsum, rating_count_base AS bcount FROM users WHERE id = ?').get(userId);
  const count = Number(real?.n || 0) + Number(row?.bcount || 0);
  const sum = Number(real?.s || 0) + Number(row?.bsum || 0);
  return { count, sum, avg: count ? Math.round((sum / count) * 10) / 10 : 0 };
}

export function projectCountFor(db, userId) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM project_participants WHERE user_id = ?').get(userId);
  return Number(row?.n || 0);
}

function connectionBetween(db, a, b) {
  if (!a || !b || a === b) return null;
  return db.prepare(`SELECT * FROM connections
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
    ORDER BY updated_at DESC LIMIT 1`).get(a, b, b, a) || null;
}

function relationFor(viewerId, conn) {
  if (!conn || !viewerId) return null;
  if (conn.status === 'aceito') return { status: 'aceito', id: conn.id };
  if (conn.status === 'pendente') {
    return { status: conn.requester_id === viewerId ? 'enviado' : 'recebido', id: conn.id };
  }
  if (conn.status === 'recusado') return { status: 'recusado', id: conn.id };
  if (conn.status === 'cancelado') return { status: 'cancelado', id: conn.id };
  return null;
}

export function shapeUser(db, row, viewerId, { includePrivate = false } = {}) {
  if (!row) return null;
  const rating = ratingAggregate(db, row.id);
  const projects = projectCountFor(db, row.id);
  const level = computeLevel({
    completed: row.activities_completed,
    hours: row.hours_shared,
    ratingsCount: rating.count,
    peopleHelped: row.people_helped,
    projects,
  });
  const isSelf = viewerId && viewerId === row.id;
  const conn = connectionBetween(db, viewerId, row.id);
  const relation = relationFor(viewerId, conn);
  const canSeeDetails = row.privacy === 'publico'
    || isSelf
    || (row.privacy === 'conexoes' && relation?.status === 'aceito');
  const canSeeLocation = row.privacy !== 'privado' || isSelf;
  const skills = canSeeDetails
    ? db.prepare('SELECT name FROM user_skills WHERE user_id = ? ORDER BY created_at ASC, name ASC').all(row.id).map(r => r.name)
    : [];
  const inviteSent = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?').get(row.id)?.n || 0;
  const inviteConfirmed = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_confirmed_at IS NOT NULL').get(row.id)?.n || 0;

  const out = {
    id: row.id,
    name: row.name,
    firstName: String(row.name || '').split(' ')[0] || row.name,
    color: row.color,
    bio: canSeeDetails ? row.bio : '',
    location: canSeeLocation ? row.location : 'Localidade privada',
    availability: canSeeDetails ? row.availability : '',
    photo: row.photo || '',
    skills: canSeeDetails ? skills : [],
    hoursShared: Math.round(Number(row.hours_shared || 0) * 10) / 10,
    activitiesCompleted: Number(row.activities_completed || 0),
    peopleHelped: Number(row.people_helped || 0),
    ratingAvg: rating.avg,
    ratingsCount: rating.count,
    joinedAt: toDate(row.created_at),
    privacy: row.privacy,
    showActivity: Boolean(row.show_activity),
    isSeed: Boolean(row.is_seed),
    level: level.level,
    levelIndex: level.levelIndex,
    levelScore: level.score,
    levelProgress: level.progress,
    levelBreakdown: level.breakdown,
    nextLevel: level.nextLevel,
    pointsToNext: level.pointsToNext,
    connectionStatus: relation?.status || null,
    connectionId: relation?.id || null,
    inviteSent: Number(inviteSent),
    inviteConfirmed: Number(inviteConfirmed),
  };
  if (isSelf || includePrivate) {
    out.email = row.email;
    out.inviteCode = row.invite_code;
    out.emailVerified = Boolean(row.email_verified);
    out.referredBy = row.referred_by || null;
  }
  return out;
}

function mapOpportunity(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    modality: row.modality,
    durationHours: Number(row.duration_hours),
    availability: row.availability,
    location: row.location,
    publishedAt: toDate(row.created_at),
    status: row.status,
    isSeed: Boolean(row.is_seed),
  };
}

function mapActivity(row, ratingsByActivity) {
  const ratedBy = {};
  for (const r of (ratingsByActivity.get(row.id) || [])) {
    ratedBy[r.from_id] = { stars: Number(r.stars), comment: r.comment || '', date: toDate(r.created_at) };
  }
  return {
    id: row.id,
    oppId: row.opp_id,
    ownerId: row.owner_id,
    interestedId: row.interested_id,
    status: row.status,
    plannedHours: Number(row.planned_hours),
    confirmedHours: row.confirmed_hours == null ? null : Number(row.confirmed_hours),
    startedAt: row.started_at || null,
    endedAt: row.ended_at || null,
    requesterConfirmed: Boolean(row.requester_confirmed),
    providerConfirmed: Boolean(row.provider_confirmed),
    credited: Boolean(row.credited),
    note: row.note || '',
    startCodeUsed: Boolean(row.start_code_used),
    startCodeExpires: row.start_code_expires || null,
    contestReason: row.contest_reason || null,
    proposedHours: row.proposed_hours == null ? null : Number(row.proposed_hours),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ratedBy,
  };
}

function mapProject(db, row) {
  const needs = db.prepare('SELECT title, hours FROM project_needs WHERE project_id = ?').all(row.id)
    .map(n => ({ title: n.title, hours: Number(n.hours) }));
  const participants = db.prepare('SELECT user_id FROM project_participants WHERE project_id = ?').all(row.id)
    .map(p => p.user_id);
  const updates = db.prepare('SELECT user_id, text, hours, created_at FROM project_updates WHERE project_id = ? ORDER BY created_at ASC').all(row.id)
    .map(u => ({ userId: u.user_id, text: u.text, hours: Number(u.hours), date: toDate(u.created_at), createdAt: u.created_at }));
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    objective: row.objective,
    category: row.category,
    location: row.location,
    startDate: toDate(row.start_date),
    createdAt: toDate(row.created_at),
    goalHours: Number(row.goal_hours),
    contributedHours: Number(row.contributed_hours),
    expectedParticipants: Number(row.expected_participants),
    skillsNeeded: [],
    needs,
    participants,
    status: row.status,
    visibility: row.visibility,
    updates,
    emoji: row.emoji,
    colorLight: row.color_light,
    colorDark: row.color_dark,
    isSeed: Boolean(row.is_seed),
  };
}

export function buildState({ viewerId = null, publicOnly = false } = {}) {
  const db = getDB();
  const viewerRow = viewerId ? cleanUserRow(db.prepare('SELECT * FROM users WHERE id = ?').get(viewerId)) : null;
  if (viewerId && !viewerRow) return null;

  const userRows = db.prepare('SELECT * FROM users WHERE is_demo = 0 ORDER BY created_at ASC').all();
  const users = userRows.map(row => shapeUser(db, row, viewerId));

  const opportunities = db.prepare(`SELECT * FROM opportunities WHERE status = 'published' ORDER BY created_at DESC`).all()
    .map(mapOpportunity);

  const projectRows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  const projects = projectRows
    .filter(p => {
      if (!viewerId) return p.visibility === 'aberto';
      if (p.visibility === 'convite') {
        const isOwner = p.owner_id === viewerId;
        const isPart = db.prepare('SELECT 1 FROM project_participants WHERE project_id = ? AND user_id = ?').get(p.id, viewerId);
        return isOwner || Boolean(isPart);
      }
      return true;
    })
    .map(p => mapProject(db, p));

  const allRatings = db.prepare('SELECT * FROM ratings ORDER BY created_at DESC').all();
  const ratingsByActivity = new Map();
  for (const r of allRatings) {
    if (!ratingsByActivity.has(r.activity_id)) ratingsByActivity.set(r.activity_id, []);
    ratingsByActivity.get(r.activity_id).push(r);
  }

  let activities;
  if (viewerId) {
    activities = db.prepare('SELECT * FROM activities WHERE owner_id = ? OR interested_id = ? ORDER BY created_at DESC')
      .all(viewerId, viewerId);
  } else {
    activities = db.prepare(`SELECT * FROM activities WHERE status = 'concluida' ORDER BY created_at DESC`).all();
  }
  const activityList = activities.map(a => mapActivity(a, ratingsByActivity));

  const ratings = allRatings.map(r => ({
    id: r.id,
    activityId: r.activity_id,
    fromId: r.from_id,
    toId: r.to_id,
    stars: Number(r.stars),
    comment: r.comment || '',
    date: toDate(r.created_at),
    createdAt: r.created_at,
  }));

  const state = {
    serverNow: new Date().toISOString(),
    users,
    opportunities,
    projects,
    activities: activityList,
    ratings,
    transactions: [],
    notifications: [],
    chats: [],
    connections: [],
    me: null,
    invite: null,
    mode: 'server',
  };

  if (!viewerId || publicOnly) return state;

  state.me = shapeUser(db, viewerRow, viewerId, { includePrivate: true });

  state.transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date ASC, created_at ASC').all(viewerId)
    .map(t => ({
      id: t.id,
      userId: t.user_id,
      amount: Number(t.amount),
      description: t.description,
      activityId: t.activity_id,
      date: toDate(t.date),
      balanceAfter: Number(t.balance_after),
      createdAt: t.created_at,
    }));

  state.notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(viewerId)
    .map(n => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message,
      date: toDate(n.created_at),
      createdAt: n.created_at,
      read: Boolean(n.is_read),
      link: { view: n.link_view, id: n.link_id || undefined },
    }));

  const chatRows = db.prepare(`SELECT c.* FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = ? ORDER BY c.created_at DESC`).all(viewerId);
  state.chats = chatRows.map(c => {
    const participants = db.prepare('SELECT user_id FROM chat_participants WHERE chat_id = ?').all(c.id).map(p => p.user_id);
    const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC').all(c.id)
      .map(m => ({ id: m.id, senderId: m.sender_id, text: m.text, date: m.created_at }));
    return { id: c.id, activityId: c.activity_id, participants, messages, createdAt: c.created_at };
  });

  state.connections = db.prepare(`SELECT * FROM connections WHERE requester_id = ? OR addressee_id = ? ORDER BY updated_at DESC`)
    .all(viewerId, viewerId)
    .map(c => ({
      id: c.id,
      requesterId: c.requester_id,
      addresseeId: c.addressee_id,
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

  const sent = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?').get(viewerId)?.n || 0;
  const confirmed = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_confirmed_at IS NOT NULL').get(viewerId)?.n || 0;
  state.invite = {
    code: viewerRow.invite_code,
    sent: Number(sent),
    confirmed: Number(confirmed),
    creditAwarded: 0,
  };

  return state;
}

export function getActivityWithOpp(db, activityId) {
  const a = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!a) return null;
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(a.opp_id);
  return { activity: a, opp };
}

export function activityRoles(activity, opp) {
  const provider = opp.type === 'offer' ? activity.owner_id : activity.interested_id;
  const requester = opp.type === 'offer' ? activity.interested_id : activity.owner_id;
  return { provider, requester };
}

export function balanceOf(db, userId) {
  const row = db.prepare('SELECT balance_after FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 1').get(userId);
  return row ? Number(row.balance_after) : 0;
}

export function notifyUser(db, userId, title, message, linkView = 'notificacoes', linkId = null) {
  db.prepare('INSERT INTO notifications (id,user_id,title,message,link_view,link_id,is_read,created_at) VALUES (?,?,?,?,?,?,0,?)')
    .run(uid('n'), userId, title, message, linkView, linkId, nowISO());
}

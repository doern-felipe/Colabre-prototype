/* Colabre — API HTTP. Toda autorização e regra de negócio vive aqui.
   Nenhuma credencial, código de início ou operação de crédito é decidida no cliente. */
import { createHmac } from 'node:crypto';
import { getDB, uid, nowISO, generateInviteCode, metaSecret } from './db.mjs';
import {
  normalizeEmail, isValidEmail, passwordProblem, hashPassword, verifyPassword,
  createSession, destroySession, destroyAllSessions, sessionFromToken,
  issueCode, verifyCode, lastCodeAge, rateLimit,
} from './auth.mjs';
import { sendVerificationCode, sendPasswordResetCode, emailStatus, devCodesAllowed } from './email.mjs';
import { emailFormatProblem, emailDomainReceivesMail, mxValidationEnabled } from './email-validation.mjs';
import { buildState, notifyUser, balanceOf, activityRoles } from './state.mjs';

class ApiError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

function fail(status, message, extra) { throw new ApiError(status, message, extra); }

function bodyOf(ctx) {
  const raw = ctx.body;
  if (!raw || typeof raw !== 'string') return {};
  if (raw.length > 3 * 1024 * 1024) fail(413, 'Conteúdo muito grande.');
  try { return JSON.parse(raw); } catch (_) { fail(400, 'Corpo da requisição inválido.'); }
}

function userRow(ctx) {
  if (ctx.user) return ctx.user;
  if (!ctx.token) return null;
  return sessionFromToken(ctx.token);
}

function requireUser(ctx, { verified = true } = {}) {
  const row = userRow(ctx);
  if (!row) fail(401, 'Entre na sua conta para continuar.');
  if (verified && !row.email_verified) fail(403, 'Confirme seu e-mail para continuar.', { needsVerification: true });
  return row;
}

function requireAdminOwner(row, ownerId, message = 'Você não tem permissão para alterar este conteúdo.') {
  if (!row || row.id !== ownerId) fail(403, message);
}

const COLORS = ['#3D5145', '#CC5500', '#4F8062', '#2F5D6C', '#9C4A6B', '#8A6D3B', '#2563EB', '#7C3AED'];

function trimStr(v, max = 500) { return String(v == null ? '' : v).trim().slice(0, max); }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

export function startCodeFor(activityId) {
  // Código de 4 dígitos derivado apenas no servidor. Nunca é armazenado em texto puro.
  const digest = createHmac('sha256', metaSecret()).update(`start:${activityId}`).digest('hex');
  return String(parseInt(digest.slice(0, 8), 16) % 10000).padStart(4, '0');
}

/* ---------- Créditos ---------- */
export function quarterHours(ms) {
  const minutes = Math.max(0, ms) / 60000;
  return Math.max(0.25, Math.round(minutes / 15) / 4);
}

function settleCredits(db, activity, hours) {
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(activity.opp_id);
  if (!opp) fail(409, 'Publicação não encontrada.');
  const { provider, requester } = activityRoles(activity, opp);
  const amount = Math.max(0.25, Math.round(Number(hours) * 4) / 4);

  const already = db.prepare('SELECT 1 FROM transactions WHERE activity_id = ? LIMIT 1').get(activity.id);
  if (already) fail(409, 'Esta atividade já gerou créditos.');

  const requesterBalance = balanceOf(db, requester);
  if (requesterBalance + 1e-9 < amount) {
    fail(402, `Saldo insuficiente: são necessários ${amount.toFixed(2)} créditos e há ${requesterBalance.toFixed(2)}.`);
  }
  const providerBalance = balanceOf(db, provider);

  db.exec('BEGIN IMMEDIATE');
  try {
    const now = nowISO();
    db.prepare(`INSERT INTO transactions (id,user_id,amount,description,activity_id,date,balance_after,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      uid('t'), provider, amount,
      `Atividade concluída: ${opp.title}`, activity.id, now.slice(0, 10),
      Math.round((providerBalance + amount) * 100) / 100, now
    );
    db.prepare(`INSERT INTO transactions (id,user_id,amount,description,activity_id,date,balance_after,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      uid('t'), requester, -amount,
      `Atividade concluída: ${opp.title}`, activity.id, now.slice(0, 10),
      Math.round((requesterBalance - amount) * 100) / 100, now
    );
    db.prepare(`UPDATE users SET hours_shared = hours_shared + ?, activities_completed = activities_completed + 1,
      people_helped = people_helped + 1, updated_at = ? WHERE id = ?`).run(amount, now, provider);
    db.prepare(`UPDATE users SET activities_completed = activities_completed + 1, updated_at = ? WHERE id = ?`).run(now, requester);
    db.prepare(`UPDATE activities SET status = 'concluida', confirmed_hours = ?, requester_confirmed = 1,
      provider_confirmed = 1, credited = 1, updated_at = ? WHERE id = ?`).run(amount, now, activity.id);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw err;
  }
  notifyUser(db, provider, 'Créditos recebidos', `Você recebeu ${amount.toFixed(2)} créditos por "${opp.title}".`, 'carteira', activity.id);
  notifyUser(db, requester, 'Atividade concluída', `"${opp.title}" foi concluída. ${amount.toFixed(2)} créditos foram transferidos.`, 'atividades', activity.id);
  return amount;
}

function activityBundle(db, id) {
  const a = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!a) fail(404, 'Atividade não encontrada.');
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(a.opp_id);
  if (!opp) fail(404, 'Publicação não encontrada.');
  return { activity: a, opp };
}

function participant(ctx, bundle) {
  const me = requireUser(ctx);
  const { activity } = bundle;
  if (me.id !== activity.owner_id && me.id !== activity.interested_id) fail(403, 'Você não participa desta atividade.');
  return me;
}

function roleOf(row, bundle) {
  const { provider, requester } = activityRoles(bundle.activity, bundle.opp);
  if (row.id === provider) return 'provider';
  if (row.id === requester) return 'requester';
  return null;
}

function notifyRefresh(ctx) {
  if (typeof ctx.refresh === 'function') ctx.refresh();
}

/* ---------- Rotas ---------- */
const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
}
function match(method, path) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
  }
  return null;
}

/* Auth */
route('POST', '/api/auth/register', async ctx => {
  const b = bodyOf(ctx);
  const name = trimStr(b.name, 120);
  const email = normalizeEmail(b.email);
  if (name.length < 3) fail(400, 'Informe seu nome completo.');
  const emailProblem = emailFormatProblem(email);
  if (emailProblem) fail(400, emailProblem);
  if (mxValidationEnabled()) {
    const receives = await emailDomainReceivesMail(email);
    if (!receives) fail(400, 'O domínio deste e-mail não recebe mensagens. Use um endereço de e-mail real.');
  }
  const pwdProblem = passwordProblem(b.password, b.confirm);
  if (pwdProblem) fail(400, pwdProblem);
  const limit = rateLimit(`register:${ctx.ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) fail(429, `Muitas tentativas. Tente novamente em ${limit.retryAfter}s.`);

  const db = getDB();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'Este e-mail já está cadastrado.');

  let referredBy = null;
  const ref = trimStr(b.ref, 30).toUpperCase();
  if (ref) {
    const sponsor = db.prepare('SELECT id FROM users WHERE invite_code = ?').get(ref);
    if (sponsor) referredBy = sponsor.id;
  }

  const id = uid('u');
  const now = nowISO();
  let code = generateInviteCode(db);
  db.prepare(`INSERT INTO users (id,name,email,password_hash,email_verified,color,bio,location,availability,photo,privacy,
      invite_code,referred_by,is_seed,created_at,updated_at)
    VALUES (?,?,?,?,0,?,'',?, '', '', 'publico',?,?,0,?,?)`).run(
    id, name, email, hashPassword(b.password), COLORS[db.prepare('SELECT COUNT(*) AS n FROM users').get().n % COLORS.length],
    'Minha comunidade', code, referredBy, now, now
  );

  const verification = issueCode(id, 'verify');
  let delivered = false;
  let devCode = null;
  try {
    const sent = await sendVerificationCode(email, verification, name.split(' ')[0]);
    delivered = Boolean(sent.delivered);
  } catch (err) {
    console.error('[register] falha ao enviar e-mail:', err.message);
  }
  if (devCodesAllowed()) devCode = verification;

  notifyRefresh(ctx);
  return {
    ok: true,
    email,
    delivered,
    devCode,
    message: delivered
      ? 'Enviamos um código de 6 dígitos para o seu e-mail.'
      : 'Conta criada. O envio de e-mail não está configurado; use o código exibido abaixo (ambiente de desenvolvimento).',
    needsVerification: true,
  };
});

route('POST', '/api/auth/verify', async ctx => {
  const b = bodyOf(ctx);
  const email = normalizeEmail(b.email);
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) fail(404, 'Conta não encontrada.');
  if (user.email_verified) fail(409, 'Este e-mail já foi confirmado. Faça login.');
  const limit = rateLimit(`verify:${ctx.ip}:${email}`, 20, 15 * 60 * 1000);
  if (!limit.ok) fail(429, `Muitas tentativas. Tente novamente em ${limit.retryAfter}s.`);
  const result = verifyCode(user.id, 'verify', b.code);
  if (!result.ok) fail(400, result.error);

  const now = nowISO();
  db.prepare('UPDATE users SET email_verified = 1, referral_confirmed_at = CASE WHEN referred_by IS NOT NULL THEN ? ELSE NULL END, updated_at = ? WHERE id = ?')
    .run(now, now, user.id);

  // Crédito único de boas-vindas ao confirmar a conta.
  const hasTx = db.prepare('SELECT 1 FROM transactions WHERE user_id = ? LIMIT 1').get(user.id);
  if (!hasTx) {
    db.prepare('INSERT INTO transactions (id,user_id,amount,description,activity_id,date,balance_after,created_at) VALUES (?,?,?,?,NULL,?,?,?)')
      .run(uid('t'), user.id, 1, 'Crédito de boas-vindas', now.slice(0, 10), 1, now);
  }

  const session = createSession(user.id, ctx.ip, ctx.userAgent);
  notifyRefresh(ctx);
  return { ok: true, token: session.token, expiresAt: session.expiresAt, user: publicMe(db, user.id) };
});

route('POST', '/api/auth/resend', async ctx => {
  const b = bodyOf(ctx);
  const email = normalizeEmail(b.email);
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return { ok: true, message: 'Se este e-mail estiver cadastrado, enviaremos um novo código.' };
  if (user.email_verified) fail(409, 'Este e-mail já está confirmado.');
  const limit = rateLimit(`resend:${ctx.ip}:${email}`, 5, 60 * 60 * 1000);
  if (!limit.ok) fail(429, `Muitas solicitações. Aguarde ${limit.retryAfter}s.`);
  if (lastCodeAge(user.id, 'verify') < 60 * 1000) fail(429, 'Aguarde pelo menos 60 segundos para reenviar o código.');
  const code = issueCode(user.id, 'verify');
  let delivered = false;
  try { const sent = await sendVerificationCode(email, code, user.name.split(' ')[0]); delivered = Boolean(sent.delivered); }
  catch (err) { console.error('[resend] falha no e-mail:', err.message); }
  return { ok: true, delivered, devCode: devCodesAllowed() ? code : null, message: 'Novo código gerado.' };
});

route('POST', '/api/auth/login', async ctx => {
  const b = bodyOf(ctx);
  const email = normalizeEmail(b.email);
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const limit = rateLimit(`login:${ctx.ip}:${email || 'vazio'}`, 12, 15 * 60 * 1000);
  if (!limit.ok) fail(429, `Muitas tentativas. Aguarde ${limit.retryAfter}s.`);
  if (!user || !user.password_hash) fail(401, 'E-mail ou senha incorretos.');
  if (!verifyPassword(b.password, user.password_hash)) fail(401, 'E-mail ou senha incorretos.');
  if (!user.email_verified) fail(403, 'Confirme seu e-mail antes de entrar.', { needsVerification: true, email: user.email });
  const session = createSession(user.id, ctx.ip, ctx.userAgent);
  notifyRefresh(ctx);
  return { ok: true, token: session.token, expiresAt: session.expiresAt, user: publicMe(db, user.id) };
});

route('POST', '/api/auth/logout', async ctx => {
  destroySession(ctx.token);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/auth/forgot', async ctx => {
  const b = bodyOf(ctx);
  const email = normalizeEmail(b.email);
  const emailProblem = emailFormatProblem(email);
  if (emailProblem) fail(400, emailProblem);
  const limit = rateLimit(`forgot:${ctx.ip}:${email}`, 5, 60 * 60 * 1000);
  if (!limit.ok) fail(429, `Muitas solicitações. Aguarde ${limit.retryAfter}s.`);
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return { ok: true, message: 'Se este e-mail estiver cadastrado, enviaremos um código de redefinição.' };
  if (lastCodeAge(user.id, 'reset') < 60 * 1000) fail(429, 'Aguarde pelo menos 60 segundos para solicitar outro código.');
  const code = issueCode(user.id, 'reset');
  let delivered = false;
  try { const sent = await sendPasswordResetCode(email, code, user.name.split(' ')[0]); delivered = Boolean(sent.delivered); }
  catch (err) { console.error('[forgot] falha no e-mail:', err.message); }
  return { ok: true, delivered, devCode: devCodesAllowed() ? code : null, message: 'Código de redefinição gerado.' };
});

route('POST', '/api/auth/reset', async ctx => {
  const b = bodyOf(ctx);
  const email = normalizeEmail(b.email);
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) fail(404, 'Conta não encontrada.');
  const limit = rateLimit(`reset:${ctx.ip}:${email}`, 10, 15 * 60 * 1000);
  if (!limit.ok) fail(429, `Muitas tentativas. Aguarde ${limit.retryAfter}s.`);
  const result = verifyCode(user.id, 'reset', b.code);
  if (!result.ok) fail(400, result.error);
  const problem = passwordProblem(b.password, b.confirm);
  if (problem) fail(400, problem);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(b.password), nowISO(), user.id);
  destroyAllSessions(user.id);
  notifyRefresh(ctx);
  return { ok: true, message: 'Senha redefinida. Entre com a nova senha.' };
});

/* Sa�de */
route('GET', '/api/health', async () => {
  return { ok: true, service: 'colabre', time: nowISO(), email: emailStatus(), devCodes: devCodesAllowed() };
});

/* Estado */
route('GET', '/api/state', async ctx => {
  const row = userRow(ctx);
  const state = buildState({ viewerId: row ? row.id : null });
  if (row && !state) { destroySession(ctx.token); return { state: buildState({}), user: null, email: emailStatus(), devCodes: devCodesAllowed() }; }
  return {
    state,
    user: row ? publicMe(getDB(), row.id) : null,
    email: emailStatus(),
    devCodes: devCodesAllowed(),
    serverNow: nowISO(),
  };
});

route('GET', '/api/invite', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const row = db.prepare('SELECT invite_code FROM users WHERE id = ?').get(me.id);
  const sent = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?').get(me.id)?.n || 0;
  const confirmed = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_confirmed_at IS NOT NULL').get(me.id)?.n || 0;
  return { code: row?.invite_code, sent, confirmed, creditAwarded: 0 };
});

/* Perfil */
function publicMe(db, id) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id, name: row.name, email: row.email, emailVerified: Boolean(row.email_verified),
    photo: row.photo || '', inviteCode: row.invite_code, privacy: row.privacy,
  };
}

route('PATCH', '/api/profile', async ctx => {
  const me = requireUser(ctx);
  const b = bodyOf(ctx);
  const db = getDB();
  const name = b.name === undefined ? me.name : trimStr(b.name, 120);
  if (name.length < 3) fail(400, 'Informe seu nome completo.');
  const privacy = ['publico', 'conexoes', 'privado'].includes(b.privacy) ? b.privacy : me.privacy;
  db.prepare(`UPDATE users SET name = ?, bio = ?, location = ?, availability = ?, privacy = ?, show_activity = ?, updated_at = ? WHERE id = ?`)
    .run(name,
      b.bio === undefined ? me.bio : trimStr(b.bio, 800),
      b.location === undefined ? me.location : trimStr(b.location, 120),
      b.availability === undefined ? me.availability : trimStr(b.availability, 160),
      privacy,
      b.showActivity === undefined ? me.show_activity : (b.showActivity ? 1 : 0),
      nowISO(), me.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/profile/photo', async ctx => {
  const me = requireUser(ctx);
  const b = bodyOf(ctx);
  const photo = String(b.photo || '');
  if (photo && !/^data:image\/(png|jpe?g|webp);base64,/.test(photo)) fail(400, 'Formato de imagem inválido.');
  if (photo.length > 2.5 * 1024 * 1024) fail(413, 'A imagem é muito grande. Escolha um arquivo menor.');
  getDB().prepare('UPDATE users SET photo = ?, updated_at = ? WHERE id = ?').run(photo, nowISO(), me.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('DELETE', '/api/profile/photo', async ctx => {
  const me = requireUser(ctx);
  getDB().prepare("UPDATE users SET photo = '', updated_at = ? WHERE id = ?").run(nowISO(), me.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/profile/skills', async ctx => {
  const me = requireUser(ctx);
  const name = trimStr(bodyOf(ctx).name, 60);
  if (name.length < 2) fail(400, 'Informe o nome da habilidade.');
  const db = getDB();
  const exists = db.prepare('SELECT 1 FROM user_skills WHERE user_id = ? AND name = ? COLLATE NOCASE').get(me.id, name);
  if (exists) fail(409, 'Essa habilidade já está no perfil.');
  db.prepare('INSERT INTO user_skills (user_id,name,created_at) VALUES (?,?,?)').run(me.id, name, nowISO());
  notifyRefresh(ctx);
  return { ok: true };
});

route('DELETE', '/api/profile/skills/:name', async ctx => {
  const me = requireUser(ctx);
  getDB().prepare('DELETE FROM user_skills WHERE user_id = ? AND name = ?').run(me.id, ctx.params.name);
  notifyRefresh(ctx);
  return { ok: true };
});

/* Oportunidades */
route('POST', '/api/opportunities', async ctx => {
  const me = requireUser(ctx);
  const b = bodyOf(ctx);
  const title = trimStr(b.title, 140);
  const description = trimStr(b.description, 2000);
  const type = b.type === 'request' ? 'request' : 'offer';
  const duration = num(b.durationHours, 1);
  if (title.length < 5) fail(400, 'O título precisa ter pelo menos 5 caracteres.');
  if (description.length < 15) fail(400, 'A descrição precisa ter pelo menos 15 caracteres.');
  if (duration < 0.25 || duration > 24) fail(400, 'A duração deve ficar entre 15 minutos e 24 horas.');
  const rounded = Math.round(duration * 4) / 4;
  const db = getDB();
  const id = uid('o');
  const now = nowISO();
  db.prepare(`INSERT INTO opportunities (id,owner_id,type,title,description,category,modality,duration_hours,
      availability,location,status,is_seed,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'published',0,?,?)`).run(
    id, me.id, type, title, description, trimStr(b.category, 80) || 'Outros',
    ['online', 'presencial', 'ambas'].includes(b.modality) ? b.modality : 'online',
    rounded, trimStr(b.availability, 120), trimStr(b.location, 120), now, now
  );
  notifyRefresh(ctx);
  return { ok: true, id };
});

route('DELETE', '/api/opportunities/:id', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(ctx.params.id);
  if (!opp) fail(404, 'Publicação não encontrada.');
  requireAdminOwner(me, opp.owner_id);
  const active = db.prepare("SELECT 1 FROM activities WHERE opp_id = ? AND status IN ('aceita','em_andamento') LIMIT 1").get(opp.id);
  if (active) fail(409, 'Não é possível excluir uma publicação com atividade ativa.');
  db.prepare('DELETE FROM opportunities WHERE id = ?').run(opp.id);
  notifyRefresh(ctx);
  return { ok: true };
});

/* Interesse / aceite */
route('POST', '/api/opportunities/:id/interest', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(ctx.params.id);
  if (!opp) fail(404, 'Publicação não encontrada.');
  if (opp.owner_id === me.id) fail(400, 'Você não pode aceitar a própria publicação.');
  if (opp.status !== 'published') fail(409, 'Esta publicação não está mais disponível.');

  const accepted = db.prepare("SELECT 1 FROM activities WHERE opp_id = ? AND status IN ('aceita','em_andamento','finalizada','contestada','concluida') LIMIT 1").get(opp.id);
  if (accepted) fail(409, 'Esta oportunidade já foi aceita por outra pessoa.');

  const existing = db.prepare('SELECT * FROM activities WHERE opp_id = ? AND interested_id = ?').get(opp.id, me.id);
  if (existing) {
    if (existing.status === 'interesse') fail(409, 'Você já demonstrou interesse nesta oportunidade.');
    db.prepare("UPDATE activities SET status = 'interesse', created_at = ?, updated_at = ? WHERE id = ?").run(nowISO(), nowISO(), existing.id);
    notifyUser(db, opp.owner_id, 'Novo interesse', `${me.name} demonstrou interesse em "${opp.title}".`, 'atividades', existing.id);
    notifyRefresh(ctx);
    return { ok: true, id: existing.id };
  }

  const id = uid('a');
  const now = nowISO();
  db.prepare(`INSERT INTO activities (id,opp_id,owner_id,interested_id,status,planned_hours,created_at,updated_at)
    VALUES (?,?,?,?, 'interesse', ?,?,?)`).run(id, opp.id, opp.owner_id, me.id, opp.duration_hours, now, now);
  notifyUser(db, opp.owner_id, 'Novo interesse', `${me.name} demonstrou interesse em "${opp.title}".`, 'atividades', id);
  notifyRefresh(ctx);
  return { ok: true, id };
});

route('POST', '/api/activities/:id/accept', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  if (bundle.activity.owner_id !== me.id) fail(403, 'Apenas o autor da publicação pode aceitar.');
  if (bundle.activity.interested_id === me.id) fail(400, 'Você não pode aceitar a própria participação.');
  if (bundle.activity.status !== 'interesse') fail(409, 'Esta atividade não está aguardando aceite.');

  const other = db.prepare("SELECT 1 FROM activities WHERE opp_id = ? AND id <> ? AND status IN ('aceita','em_andamento','finalizada','contestada','concluida') LIMIT 1")
    .get(bundle.opp.id, bundle.activity.id);
  if (other) fail(409, 'Já existe outra atividade aceita para esta publicação.');

  const now = nowISO();
  db.exec('BEGIN IMMEDIATE');
  try {
    const changed = db.prepare("UPDATE activities SET status = 'aceita', start_code_used = 0, start_code_expires = ?, updated_at = ? WHERE id = ? AND status = 'interesse'")
      .run(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), now, bundle.activity.id);
    if (!changed.changes) throw new ApiError(409, 'Esta atividade acabou de ser alterada. Recarregue e tente novamente.');
    db.prepare("UPDATE opportunities SET status = 'accepted', updated_at = ? WHERE id = ?").run(now, bundle.opp.id);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw err;
  }

  const { provider, requester } = activityRoles(bundle.activity, bundle.opp);
  notifyUser(db, provider, 'Interesse aceito', `Sua participação em "${bundle.opp.title}" foi aceita.`, 'atividades', bundle.activity.id);
  notifyUser(db, requester, 'Atividade aceita', `A atividade "${bundle.opp.title}" foi aceita. O código de início está disponível para você.`, 'atividades', bundle.activity.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/activities/:id/reject', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  if (bundle.activity.owner_id !== me.id) fail(403, 'Apenas o autor da publicação pode recusar.');
  if (!['interesse', 'aceita'].includes(bundle.activity.status)) fail(409, 'Esta atividade não pode ser recusada.');
  db.prepare("UPDATE activities SET status = 'cancelada', updated_at = ? WHERE id = ?").run(nowISO(), bundle.activity.id);
  notifyUser(db, bundle.activity.interested_id, 'Interesse recusado', `Sua participação em "${bundle.opp.title}" não foi aceita.`, 'atividades', bundle.activity.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/activities/:id/cancel', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  participant(ctx, bundle);
  if (!['interesse', 'aceita'].includes(bundle.activity.status)) fail(409, 'Esta atividade já começou e não pode ser cancelada.');
  db.prepare("UPDATE activities SET status = 'cancelada', updated_at = ? WHERE id = ?").run(nowISO(), bundle.activity.id);
  const other = bundle.activity.owner_id === me.id ? bundle.activity.interested_id : bundle.activity.owner_id;
  notifyUser(db, other, 'Atividade cancelada', `A atividade "${bundle.opp.title}" foi cancelada.`, 'atividades', bundle.activity.id);
  notifyRefresh(ctx);
  return { ok: true };
});

/* Código de início */
route('GET', '/api/activities/:id/code', async ctx => {
  const row = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  participant(ctx, bundle);
  const role = roleOf(row, bundle);
  if (role !== 'requester') fail(403, 'Somente quem solicitou a ajuda pode ver o código de início.');
  if (bundle.activity.status !== 'aceita') fail(409, 'O código só fica disponível enquanto a atividade aguarda início.');
  if (bundle.activity.start_code_used) fail(409, 'Este código já foi utilizado.');
  return { code: startCodeFor(bundle.activity.id), expiresAt: bundle.activity.start_code_expires };
});

route('POST', '/api/activities/:id/start', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  participant(ctx, bundle);
  if (roleOf(me, bundle) !== 'provider') fail(403, 'Somente quem vai prestar a ajuda pode iniciar.');
  if (bundle.activity.status !== 'aceita') fail(409, 'Esta atividade não está pronta para iniciar.');
  if (bundle.activity.start_code_used) fail(409, 'O código de início já foi utilizado.');
  if (bundle.activity.start_code_expires && new Date(bundle.activity.start_code_expires).getTime() < Date.now()) {
    fail(400, 'O código de início expirou. Peça ao solicitante para gerar um novo.');
  }
  const clean = String(bodyOf(ctx).code || '').replace(/\D/g, '');
  if (clean.length !== 4) fail(400, 'Informe o código de 4 dígitos.');
  if (clean !== startCodeFor(bundle.activity.id)) fail(400, 'Código de início incorreto.');

  const now = nowISO();
  const changed = db.prepare("UPDATE activities SET status = 'em_andamento', started_at = ?, start_code_used = 1, updated_at = ? WHERE id = ? AND status = 'aceita' AND start_code_used = 0")
    .run(now, now, bundle.activity.id);
  if (!changed.changes) fail(409, 'Não foi possível iniciar. Recarregue a página.');

  const { requester } = activityRoles(bundle.activity, bundle.opp);
  notifyUser(db, requester, 'Atividade iniciada', `"${bundle.opp.title}" começou. O cronômetro está em andamento.`, 'atividades', bundle.activity.id);
  notifyRefresh(ctx);
  return { ok: true, startedAt: now };
});

route('POST', '/api/activities/:id/finish', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  participant(ctx, bundle);
  if (roleOf(me, bundle) !== 'provider') fail(403, 'Somente quem prestou a ajuda pode finalizar.');
  if (bundle.activity.status !== 'em_andamento') fail(409, 'A atividade não está em andamento.');
  const started = new Date(bundle.activity.started_at).getTime();
  const hours = quarterHours(Date.now() - started);
  const now = nowISO();
  db.prepare(`UPDATE activities SET status = 'finalizada', ended_at = ?, confirmed_hours = ?, provider_confirmed = 1, updated_at = ? WHERE id = ?`)
    .run(now, hours, now, bundle.activity.id);
  const { requester } = activityRoles(bundle.activity, bundle.opp);
  notifyUser(db, requester, 'Atividade finalizada', `"${bundle.opp.title}" foi finalizada. Confirme as horas para liberar os créditos.`, 'atividades', bundle.activity.id);
  notifyRefresh(ctx);
  return { ok: true, hours };
});

route('POST', '/api/activities/:id/confirm', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  participant(ctx, bundle);
  if (roleOf(me, bundle) !== 'requester') fail(403, 'Somente quem solicitou a ajuda pode confirmar.');
  if (bundle.activity.status !== 'finalizada') fail(409, 'Esta atividade não está aguardando confirmação.');
  const hours = Number(bundle.activity.confirmed_hours || bundle.activity.planned_hours);
  const amount = settleCredits(db, bundle.activity, hours);
  notifyRefresh(ctx);
  return { ok: true, hours: amount };
});

route('POST', '/api/activities/:id/contest', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  participant(ctx, bundle);
  if (roleOf(me, bundle) !== 'requester') fail(403, 'Somente quem solicitou a ajuda pode contestar.');
  if (bundle.activity.status !== 'finalizada') fail(409, 'Esta atividade não está aguardando confirmação.');
  const b = bodyOf(ctx);
  const proposed = Math.round(num(b.proposedHours, bundle.activity.confirmed_hours) * 4) / 4;
  if (proposed < 0.25 || proposed > 24) fail(400, 'Informe um tempo entre 15 minutos e 24 horas.');
  const reason = trimStr(b.reason, 500);
  if (reason.length < 5) fail(400, 'Explique brevemente o motivo da contestação.');
  db.prepare("UPDATE activities SET status = 'contestada', proposed_hours = ?, contest_reason = ?, updated_at = ? WHERE id = ?")
    .run(proposed, reason, nowISO(), bundle.activity.id);
  const { provider } = activityRoles(bundle.activity, bundle.opp);
  notifyUser(db, provider, 'Horas contestadas', `O tempo de "${bundle.opp.title}" foi contestado. Proposta: ${proposed.toFixed(2)}h.`, 'atividades', bundle.activity.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/activities/:id/resolve', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const bundle = activityBundle(db, ctx.params.id);
  participant(ctx, bundle);
  if (roleOf(me, bundle) !== 'provider') fail(403, 'Somente quem prestou a ajuda pode responder à contestação.');
  if (bundle.activity.status !== 'contestada') fail(409, 'Não há contestação pendente.');
  const acceptProposal = Boolean(bodyOf(ctx).accept);
  if (acceptProposal) {
    const amount = settleCredits(db, bundle.activity, Number(bundle.activity.proposed_hours));
    notifyRefresh(ctx);
    return { ok: true, hours: amount };
  }
  db.prepare("UPDATE activities SET status = 'finalizada', updated_at = ? WHERE id = ?").run(nowISO(), bundle.activity.id);
  const { requester } = activityRoles(bundle.activity, bundle.opp);
  notifyUser(db, requester, 'Contestação recusada', `O prestador não aceitou o tempo proposto em "${bundle.opp.title}". Revise e confirme.`, 'atividades', bundle.activity.id);
  notifyRefresh(ctx);
  return { ok: true };
});

/* Avaliações */
route('POST', '/api/ratings', async ctx => {
  const me = requireUser(ctx);
  const b = bodyOf(ctx);
  const db = getDB();
  const bundle = activityBundle(db, b.activityId);
  participant(ctx, bundle);
  if (bundle.activity.status !== 'concluida') fail(409, 'Só é possível avaliar atividades concluídas.');
  const stars = Math.round(num(b.stars, 0));
  if (stars < 1 || stars > 5) fail(400, 'A nota deve ser de 1 a 5 estrelas.');
  const to = bundle.activity.owner_id === me.id ? bundle.activity.interested_id : bundle.activity.owner_id;
  if (to === me.id) fail(400, 'Você não pode avaliar a si mesmo.');
  const exists = db.prepare('SELECT 1 FROM ratings WHERE activity_id = ? AND from_id = ?').get(bundle.activity.id, me.id);
  if (exists) fail(409, 'Você já avaliou esta atividade.');
  db.prepare('INSERT INTO ratings (id,activity_id,from_id,to_id,stars,comment,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uid('r'), bundle.activity.id, me.id, to, stars, trimStr(b.comment, 800), nowISO());
  notifyUser(db, to, 'Nova avaliação', `${me.name} avaliou você com ${stars} ${stars === 1 ? 'estrela' : 'estrelas'}.`, 'perfil-publico', me.id);
  notifyRefresh(ctx);
  return { ok: true };
});

/* Conexões */
function connectionPair(db, a, b) {
  return db.prepare(`SELECT * FROM connections
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
    ORDER BY updated_at DESC LIMIT 1`).get(a, b, b, a) || null;
}

route('POST', '/api/connections', async ctx => {
  const me = requireUser(ctx);
  const targetId = trimStr(bodyOf(ctx).userId, 80);
  if (!targetId || targetId === me.id) fail(400, 'Escolha outra pessoa para conectar.');
  const db = getDB();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) fail(404, 'Usuário não encontrado.');
  const existing = connectionPair(db, me.id, targetId);
  if (existing) {
    if (existing.status === 'aceito') fail(409, 'Vocês já estão conectados.');
    if (existing.status === 'pendente') fail(409, 'Já existe uma solicitação pendente entre vocês.');
    db.prepare("UPDATE connections SET requester_id = ?, addressee_id = ?, status = 'pendente', updated_at = ? WHERE id = ?")
      .run(me.id, targetId, nowISO(), existing.id);
  } else {
    db.prepare('INSERT INTO connections (id,requester_id,addressee_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run(uid('conn'), me.id, targetId, 'pendente', nowISO(), nowISO());
  }
  notifyUser(db, targetId, 'Nova solicitação de conexão', `${me.name} quer se conectar com você.`, 'perfil-publico', me.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/connections/:id/accept', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const c = db.prepare('SELECT * FROM connections WHERE id = ?').get(ctx.params.id);
  if (!c) fail(404, 'Solicitação não encontrada.');
  if (c.addressee_id !== me.id) fail(403, 'Você não pode aceitar esta solicitação.');
  if (c.status !== 'pendente') fail(409, 'Esta solicitação não está pendente.');
  db.prepare("UPDATE connections SET status = 'aceito', updated_at = ? WHERE id = ?").run(nowISO(), c.id);
  notifyUser(db, c.requester_id, 'Conexão aceita', `${me.name} aceitou sua solicitação de conexão.`, 'perfil-publico', me.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/connections/:id/decline', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const c = db.prepare('SELECT * FROM connections WHERE id = ?').get(ctx.params.id);
  if (!c) fail(404, 'Solicitação não encontrada.');
  if (c.addressee_id !== me.id) fail(403, 'Você não pode recusar esta solicitação.');
  if (c.status !== 'pendente') fail(409, 'Esta solicitação não está pendente.');
  db.prepare("UPDATE connections SET status = 'recusado', updated_at = ? WHERE id = ?").run(nowISO(), c.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/connections/:id/cancel', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const c = db.prepare('SELECT * FROM connections WHERE id = ?').get(ctx.params.id);
  if (!c) fail(404, 'Solicitação não encontrada.');
  if (c.requester_id !== me.id) fail(403, 'Você não pode cancelar esta solicitação.');
  if (!['pendente', 'aceito'].includes(c.status)) fail(409, 'Esta conexão não pode ser cancelada.');
  db.prepare("UPDATE connections SET status = 'cancelado', updated_at = ? WHERE id = ?").run(nowISO(), c.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('DELETE', '/api/connections/:id', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const c = db.prepare('SELECT * FROM connections WHERE id = ?').get(ctx.params.id);
  if (!c) fail(404, 'Conexão não encontrada.');
  if (c.requester_id !== me.id && c.addressee_id !== me.id) fail(403, 'Você não participa desta conexão.');
  db.prepare('DELETE FROM connections WHERE id = ?').run(c.id);
  notifyRefresh(ctx);
  return { ok: true };
});

/* Projetos */
route('POST', '/api/projects', async ctx => {
  const me = requireUser(ctx);
  const b = bodyOf(ctx);
  const title = trimStr(b.title, 140);
  const description = trimStr(b.description, 2000);
  const objective = trimStr(b.objective, 1200);
  if (title.length < 5) fail(400, 'O nome do projeto precisa de pelo menos 5 caracteres.');
  if (description.length < 15) fail(400, 'A descrição precisa de pelo menos 15 caracteres.');
  if (objective.length < 10) fail(400, 'O objetivo precisa de pelo menos 10 caracteres.');
  const db = getDB();
  const id = uid('p');
  const now = nowISO();
  const goalHours = Math.max(1, num(b.goalHours, 40));
  const colorLight = /^#[0-9a-f]{6}$/i.test(b.colorLight || '') ? b.colorLight : '#10B981';
  const colorDark = /^#[0-9a-f]{6}$/i.test(b.colorDark || '') ? b.colorDark : '#059669';
  db.prepare(`INSERT INTO projects (id,owner_id,title,description,objective,category,location,start_date,
      goal_hours,contributed_hours,expected_participants,status,visibility,emoji,color_light,color_dark,is_seed,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,0,?, 'Ativo',?,?,?,?,0,?,?)`).run(
    id, me.id, title, description, objective, trimStr(b.category, 80) || 'Outros', trimStr(b.location, 120),
    trimStr(b.startDate, 20) || now.slice(0, 10), goalHours, Math.max(1, Math.round(num(b.expectedParticipants, 10))),
    b.visibility === 'convite' ? 'convite' : 'aberto', trimStr(b.emoji, 8) || '🌱', colorLight, colorDark, now, now
  );
  db.prepare('INSERT INTO project_participants (project_id,user_id,joined_at) VALUES (?,?,?)').run(id, me.id, now);
  const needs = Array.isArray(b.needs) ? b.needs.slice(0, 12) : [];
  for (const n of needs) {
    const nt = trimStr(n?.title, 100);
    if (nt) db.prepare('INSERT INTO project_needs (id,project_id,title,hours) VALUES (?,?,?,?)').run(uid('pn'), id, nt, Math.max(0, num(n?.hours, 0)));
  }
  db.prepare('INSERT INTO project_updates (id,project_id,user_id,text,hours,created_at) VALUES (?,?,?,?,0,?)')
    .run(uid('pu'), id, me.id, 'Projeto criado e aberto à comunidade.', now);
  notifyRefresh(ctx);
  return { ok: true, id };
});

route('POST', '/api/projects/:id/join', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(ctx.params.id);
  if (!p) fail(404, 'Projeto não encontrado.');
  if (p.visibility === 'convite' && p.owner_id !== me.id) {
    const allowed = db.prepare('SELECT 1 FROM project_participants WHERE project_id = ? AND user_id = ?').get(p.id, me.id);
    if (!allowed) fail(403, 'Este projeto é restrito a convidados.');
  }
  const exists = db.prepare('SELECT 1 FROM project_participants WHERE project_id = ? AND user_id = ?').get(p.id, me.id);
  if (exists) fail(409, 'Você já participa deste projeto.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO project_participants (project_id,user_id,joined_at) VALUES (?,?,?)').run(p.id, me.id, nowISO());
    db.prepare('INSERT INTO project_updates (id,project_id,user_id,text,hours,created_at) VALUES (?,?,?,?,0,?)')
      .run(uid('pu'), p.id, me.id, `${me.name} entrou para o projeto.`, nowISO());
    db.exec('COMMIT');
  } catch (err) { try { db.exec('ROLLBACK'); } catch (_) {} throw err; }
  notifyUser(db, p.owner_id, 'Novo participante', `${me.name} entrou em "${p.title}".`, 'projeto', p.id);
  notifyRefresh(ctx);
  return { ok: true };
});

route('POST', '/api/projects/:id/updates', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(ctx.params.id);
  if (!p) fail(404, 'Projeto não encontrado.');
  const isOwner = p.owner_id === me.id;
  const isPart = db.prepare('SELECT 1 FROM project_participants WHERE project_id = ? AND user_id = ?').get(p.id, me.id);
  if (!isOwner && !isPart) fail(403, 'Participe do projeto para registrar atualizações.');
  const b = bodyOf(ctx);
  const text = trimStr(b.text, 1500);
  if (text.length < 5) fail(400, 'Escreva uma atualização com pelo menos 5 caracteres.');
  const hours = isOwner ? Math.max(0, Math.round(num(b.hours, 0) * 4) / 4) : 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO project_updates (id,project_id,user_id,text,hours,created_at) VALUES (?,?,?,?,?,?)')
      .run(uid('pu'), p.id, me.id, text, hours, nowISO());
    if (hours > 0) {
      db.prepare('UPDATE projects SET contributed_hours = contributed_hours + ?, updated_at = ? WHERE id = ?').run(hours, nowISO(), p.id);
    } else {
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowISO(), p.id);
    }
    db.exec('COMMIT');
  } catch (err) { try { db.exec('ROLLBACK'); } catch (_) {} throw err; }
  const parts = db.prepare('SELECT user_id FROM project_participants WHERE project_id = ?').all(p.id);
  for (const { user_id } of parts) {
    if (user_id !== me.id) notifyUser(db, user_id, 'Atualização de projeto', `${me.name} publicou uma atualização em "${p.title}".`, 'projeto', p.id);
  }
  notifyRefresh(ctx);
  return { ok: true };
});

/* Notificações */
route('POST', '/api/notifications/read', async ctx => {
  const me = requireUser(ctx);
  const id = trimStr(bodyOf(ctx).id, 80);
  getDB().prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, me.id);
  return { ok: true };
});

route('POST', '/api/notifications/read-all', async ctx => {
  const me = requireUser(ctx);
  getDB().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(me.id);
  return { ok: true };
});

/* Conversas */
function chatFor(db, meId, { activityId, userId }) {
  if (activityId) {
    const a = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    if (!a) fail(404, 'Atividade não encontrada.');
    if (a.owner_id !== meId && a.interested_id !== meId) fail(403, 'Você não participa desta atividade.');
    let chat = db.prepare('SELECT * FROM chats WHERE activity_id = ?').get(activityId);
    if (!chat) {
      chat = { id: uid('c'), activity_id: activityId };
      db.prepare('INSERT INTO chats (id,activity_id,created_at) VALUES (?,?,?)').run(chat.id, activityId, nowISO());
      db.prepare('INSERT INTO chat_participants (chat_id,user_id) VALUES (?,?)').run(chat.id, a.owner_id);
      db.prepare('INSERT INTO chat_participants (chat_id,user_id) VALUES (?,?)').run(chat.id, a.interested_id);
    }
    return chat.id;
  }
  if (userId) {
    if (userId === meId) fail(400, 'Escolha outra pessoa para conversar.');
    const target = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
    if (!target) fail(404, 'Usuário não encontrado.');
    const row = db.prepare(`SELECT c.id FROM chats c
      JOIN chat_participants a ON a.chat_id = c.id AND a.user_id = ?
      JOIN chat_participants b ON b.chat_id = c.id AND b.user_id = ?
      WHERE c.activity_id IS NULL LIMIT 1`).get(meId, userId);
    if (row) return row.id;
    const id = uid('c');
    db.prepare('INSERT INTO chats (id,activity_id,created_at) VALUES (?,NULL,?)').run(id, nowISO());
    db.prepare('INSERT INTO chat_participants (chat_id,user_id) VALUES (?,?)').run(id, meId);
    db.prepare('INSERT INTO chat_participants (chat_id,user_id) VALUES (?,?)').run(id, userId);
    return id;
  }
  fail(400, 'Informe uma atividade ou uma pessoa.');
}

route('POST', '/api/chats', async ctx => {
  const me = requireUser(ctx);
  const b = bodyOf(ctx);
  const id = chatFor(getDB(), me.id, { activityId: trimStr(b.activityId, 80), userId: trimStr(b.userId, 80) });
  notifyRefresh(ctx);
  return { ok: true, id };
});

route('POST', '/api/chats/:id/messages', async ctx => {
  const me = requireUser(ctx);
  const db = getDB();
  const member = db.prepare('SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?').get(ctx.params.id, me.id);
  if (!member) fail(403, 'Você não participa desta conversa.');
  const text = trimStr(bodyOf(ctx).text, 2000);
  if (!text) fail(400, 'Escreva uma mensagem.');
  db.prepare('INSERT INTO messages (id,chat_id,sender_id,text,created_at) VALUES (?,?,?,?,?)')
    .run(uid('m'), ctx.params.id, me.id, text, nowISO());
  notifyRefresh(ctx);
  return { ok: true };
});

/* Despacho */
export async function handleApi(ctx) {
  const found = match(ctx.method, ctx.path);
  if (!found) return { handled: false };
  const { handler, params } = found;
  ctx.params = params;
  return { handled: true, data: await handler(ctx) };
}

export { ApiError };

/* Colabre — modo demonstração isolado.
   Usa apenas localStorage próprio (colabre_demo_v2). Nunca chama a API de produção. */
import { esc, fmtDate, fmtCredits, fmtHoursDesc } from './modules/utils.js';

const KEY = 'colabre_demo_v2';
const ME = 'demo_me';
const SPEEDS = [1, 5, 10, 30];

const CHARS = [
  { id: 'demo_c1', name: 'Carlos Mendes', color: '#F59E0B', location: 'Centro', bio: 'Técnico em manutenção e eletricidade. Gosta de ensinar o básico de ferramentas e reparos.', skills: ['Manutenção', 'Eletricidade', 'Reparos domésticos'], ratingAvg: 4.8, ratingsCount: 12, credits: 4 },
  { id: 'demo_c2', name: 'Marina Santos', color: '#9C4A6B', location: 'Jardim Aurora', bio: 'Professora de inglês e organizadora de eventos comunitários.', skills: ['Inglês', 'Educação', 'Eventos'], ratingAvg: 4.9, ratingsCount: 9, credits: 6 },
  { id: 'demo_c3', name: 'Tia Joana', color: '#4F8062', location: 'Vila Nova', bio: 'Cozinheira e jardineira. Ama transformar quintais em hortas coletivas.', skills: ['Culinária', 'Jardinagem'], ratingAvg: 5.0, ratingsCount: 7, credits: 3 },
];

function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
const today = () => new Date().toISOString().slice(0, 10);

function seed() {
  const now = Date.now();
  return {
    version: 2,
    virtualNow: now,
    lastReal: now,
    speed: 1,
    inviteCode: 'DEMO' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    invitesSent: 2,
    invitesConfirmed: 1,
    me: {
      id: ME, name: 'Visitante da demonstração', color: '#3D5145', location: 'Sua comunidade',
      bio: 'Esta é a sua conta fictícia no ambiente de demonstração. Nada aqui afeta usuários reais.',
      skills: ['Organização', 'Comunicação'], photo: '', joinedAt: today(),
      hoursShared: 1, activitiesCompleted: 1, peopleHelped: 1, credits: 1,
    },
    chars: CHARS.map(c => ({ ...c })),
    opportunities: [
      { id: 'demo_o1', ownerId: 'demo_c2', type: 'offer', title: 'Aula de inglês para viagem', description: 'Uma hora de conversação focada em situações de viagem, com material simples.', category: 'Idiomas', modality: 'online', durationHours: 1, location: 'Online', publishedAt: today() },
      { id: 'demo_o2', ownerId: 'demo_c1', type: 'offer', title: 'Pequenos reparos domésticos', description: 'Ajuda para instalar prateleiras, trocar tomadas e ajustar portas.', category: 'Serviços domésticos', modality: 'presencial', durationHours: 1, location: 'Centro', publishedAt: today() },
    ],
    projects: [
      { id: 'demo_p1', ownerId: 'demo_c3', title: 'Horta comunitária da Vila Nova', description: 'Mutirão para preparar canteiros e plantar hortaliças na praça.', objective: 'Criar uma horta cuidada por vizinhos.', category: 'Meio ambiente', location: 'Vila Nova', goalHours: 40, contributedHours: 18, participants: ['demo_c3', 'demo_c1'], status: 'Ativo', updates: [{ date: today(), text: 'Primeiro mutirão reuniu 9 pessoas.' }] },
      { id: 'demo_p2', ownerId: 'demo_c2', title: 'Clube de conversação em inglês', description: 'Encontros semanais gratuitos para praticar inglês.', objective: 'Praticar idiomas sem custo.', category: 'Educação', location: 'Jardim Aurora', goalHours: 24, contributedHours: 9, participants: ['demo_c2', ME], status: 'Ativo', updates: [{ date: today(), text: 'Inscrições abertas para novos participantes.' }] },
    ],
    activities: [],
    notifications: [
      { id: uid('dn'), title: 'Bem-vindo à demonstração', message: 'Crie uma solicitação ou ofereça ajuda para ver o fluxo completo. O tempo pode ser acelerado.', read: false, at: now - 60000 },
    ],
    transactions: [
      { id: uid('dt'), amount: 1, description: 'Crédito fictício de boas-vindas', date: today(), balanceAfter: 1, activityId: null },
    ],
    ratings: [
      { id: uid('dr'), activityId: 'seed_a1', fromId: 'demo_c2', toId: ME, stars: 5, comment: 'Pessoa atenciosa e pontual.', date: today(), seeded: true },
    ],
    connections: [
      { id: 'demo_conn1', requesterId: ME, addresseeId: 'demo_c2', status: 'aceito' },
    ],
    sim: {},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); save(s); return s; }
    const s = JSON.parse(raw);
    if (!s || s.version !== 2) { const n = seed(); save(n); return n; }
    return s;
  } catch (_) { const s = seed(); save(s); return s; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }
function cfg() { return window.__colabre || {}; }
function toast(msg, type = 'success') { if (cfg().toast) cfg().toast(msg, type); }
function refresh() { if (window.__colabreDemoRefresh) window.__colabreDemoRefresh(); }
function char(s, id) { return s.chars.find(c => c.id === id) || { name: 'Personagem', color: '#999', skills: [] }; }
function userLike(s, id) {
  if (id === ME) return s.me;
  const c = char(s, id);
  return c;
}
function pushNote(s, title, message) {
  s.notifications.unshift({ id: uid('dn'), title, message, read: false, at: Date.now() });
}
function addTx(s, amount, description, activityId = null) {
  s.me.credits = Math.round((s.me.credits + amount) * 100) / 100;
  s.transactions.unshift({ id: uid('dt'), amount, description, date: today(), balanceAfter: s.me.credits, activityId });
  s.me.credits = s.me.credits;
}
function hoursFromMs(ms) { return Math.max(0.25, Math.round((ms / 60000) / 15) / 4); }
function role(s, a) {
  const opp = s.opportunities.find(o => o.id === a.oppId);
  const type = opp ? opp.type : 'request';
  return { type, provider: type === 'offer' ? a.ownerId : a.interestedId, requester: type === 'offer' ? a.interestedId : a.ownerId };
}
function myRole(a, roles) { return a.interestedId === ME ? 'requester' : 'provider'; }

function processSimulation(s) {
  let changed = false;
  for (const a of s.activities) {
    if (a.autoAcceptAt && Date.now() >= a.autoAcceptAt) {
      delete a.autoAcceptAt;
      if (a.status === 'interesse') {
        a.status = 'aceita';
        a.code = String(Math.floor(1000 + Math.random() * 9000));
        a.acceptedBy = a.oppType === 'request' ? a.interestedId : a.ownerId;
        if (a.oppType === 'request') {
          pushNote(s, 'Sua solicitação foi aceita', `${char(s, a.interestedId).name} aceitou ajudar. O código de início está disponível para você.`);
        } else {
          pushNote(s, 'Novo interesse recebido', `${char(s, a.interestedId).name} demonstrou interesse na sua oferta.`);
        }
        changed = true;
      }
    }
    if (a.autoConfirmAt && Date.now() >= a.autoConfirmAt) {
      delete a.autoConfirmAt;
      if (a.status === 'finalizada') {
        conclude(s, a, a.confirmedHours);
        changed = true;
      }
    }
    if (a.autoRateAt && Date.now() >= a.autoRateAt) {
      delete a.autoRateAt;
      rateFromChar(s, a);
      changed = true;
    }
  }
  return changed;
}

function conclude(s, a, hours) {
  if (a.credited) return;
  a.status = 'concluida';
  a.confirmedHours = hours;
  a.credited = true;
  const r = role(s, a);
  const providerName = userLike(s, r.provider).name;
  if (r.requester === ME) {
    addTx(s, -hours, `Atividade concluída: ${a.title}`, a.id);
  } else {
    addTx(s, hours, `Créditos recebidos: ${a.title}`, a.id);
  }
  s.me.activitiesCompleted += 1;
  if (r.provider === ME) s.me.hoursShared = Math.round((s.me.hoursShared + hours) * 100) / 100;
  if (r.provider !== ME) s.me.peopleHelped += 1;
  a.autoRateAt = Date.now() + 2500;
  pushNote(s, 'Atividade concluída', `"${a.title}" foi concluída. ${fmtCredits(hours)} crédito(s) movimentado(s) no ambiente fictício.`);
}

function rateFromChar(s, a) {
  if (s.ratings.some(r => r.activityId === a.id && r.fromId !== ME)) return;
  const r = role(s, a);
  const from = r.provider === ME ? r.requester : r.provider;
  const stars = 5;
  s.ratings.unshift({ id: uid('dr'), activityId: a.id, fromId: from, toId: ME, stars, comment: 'Experiência excelente na demonstração!', date: today() });
  const mine = s.ratings.filter(x => x.toId === ME && !x.seeded);
  const total = s.me.ratingsCount || 0;
  const sum = (s.me.ratingAvg || 0) * total + stars;
  s.me.ratingsCount = total + 1;
  s.me.ratingAvg = Math.round((sum / s.me.ratingsCount) * 10) / 10;
  pushNote(s, 'Nova avaliação', `${char(s, from).name} avaliou você com 5 estrelas.`);
}

function ensureTicker() {
  if (window.__demoTicker) return;
  window.__demoTicker = setInterval(() => {
    const s = load();
    s.virtualNow += (Date.now() - s.lastReal) * s.speed;
    s.lastReal = Date.now();
    const changed = processSimulation(s);
    save(s);
    if (changed) { refresh(); return; }
    document.querySelectorAll('[data-demo-clock]').forEach(el => {
      const started = Number(el.dataset.demoClock);
      if (!started) return;
      const ms = Math.max(0, s.virtualNow - started);
      const total = Math.floor(ms / 1000);
      el.textContent = `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      const creditsEl = el.parentElement?.querySelector('[data-demo-credit]');
      if (creditsEl) creditsEl.textContent = fmtCredits(hoursFromMs(ms));
    });
    const vclock = document.getElementById('demo-virtual-clock');
    if (vclock) vclock.textContent = new Date(s.virtualNow).toLocaleTimeString('pt-BR');
    const speedBadge = document.getElementById('demo-speed-badge');
    if (speedBadge) speedBadge.textContent = s.speed > 1 ? `⏩ Tempo acelerado em ${s.speed}x` : 'Tempo normal';
  }, 500);
}

function chip(label, active) { return `<span class="badge badge-status" style="${active ? 'background:var(--accent);color:#fff' : ''}">${label}</span>`; }

function activityPanel(s, a) {
  const r = role(s, a);
  const mine = myRole(a, r);
  const otherId = mine === 'provider' ? r.requester : r.provider;
  const other = userLike(s, otherId);
  const label = {
    interesse: 'Aguardando aceite', aceita: 'Aceita', em_andamento: 'Em andamento',
    finalizada: 'Finalizada', concluida: 'Concluída', cancelada: 'Cancelada',
  }[a.status] || a.status;
  let controls = '';
  if (a.status === 'aceita') {
    if (r.requester === ME) {
      controls = `<div class="readme" style="margin:8px 0"><strong>Código de início:</strong> <span style="font-size:28px;letter-spacing:7px;font-weight:800">${a.code}</span><div class="kv">Mostre este código para ${esc(other.name)}. Ele é de uso único.</div></div>
        <button class="btn btn-accent btn-sm" data-demo-action="d-start" data-id="${a.id}">Personagem chegou — iniciar cronômetro</button>`;
    } else {
      controls = `<div class="readme" style="margin:8px 0"><strong>${esc(other.name)}</strong> informou o código de início <strong style="letter-spacing:4px">${a.code}</strong>.<div class="kv">Valide o código para iniciar o cronômetro oficial.</div></div>
        <button class="btn btn-accent btn-sm" data-demo-action="d-start" data-id="${a.id}">Validar código e iniciar</button>`;
    }
  } else if (a.status === 'em_andamento') {
    const clock = fmtClock(s.virtualNow - a.startedAt);
    const elapsedHours = hoursFromMs(s.virtualNow - a.startedAt);
    controls = `<div class="memory-strip" style="margin-top:8px"><strong>⏱ <span data-demo-clock="${a.startedAt}">${clock}</span></strong><span class="kv">tempo acelerado · <span data-demo-credit>${fmtCredits(elapsedHours)}</span> crédito(s) até agora</span></div>
      <div class="inline" style="margin-top:8px"><button class="btn btn-outline btn-sm" data-demo-action="d-advance-activity" data-id="${a.id}" data-mins="5">Avançar 5 min</button><button class="btn btn-outline btn-sm" data-demo-action="d-advance-activity" data-id="${a.id}" data-mins="15">Avançar 15 min</button>${r.provider === ME ? `<button class="btn btn-accent btn-sm" data-demo-action="d-finish" data-id="${a.id}">Finalizar atividade</button>` : `<button class="btn btn-accent btn-sm" data-demo-action="d-finish-char" data-id="${a.id}">Simular finalização do personagem</button>`}</div>`;
  } else if (a.status === 'finalizada') {
    controls = `<div class="readme" style="margin:8px 0"><strong>Tempo registrado:</strong> ${fmtHoursDesc(a.confirmedHours)} · ${fmtCredits(a.confirmedHours)} crédito(s)<div class="kv">No fluxo real, o solicitante confirma ou contesta antes de qualquer crédito.</div></div>
      ${r.requester === ME ? `<div class="inline"><button class="btn btn-accent btn-sm" data-demo-action="d-confirm" data-id="${a.id}">Confirmar tempo e créditos</button><button class="btn btn-outline btn-sm" data-demo-action="d-contest" data-id="${a.id}">Contestar tempo</button></div>` : `<p class="kv">Aguardando confirmação de ${esc(other.name)}…</p>`}`;
  } else if (a.status === 'contestada') {
    controls = `<div class="readme" style="margin:8px 0"><strong>Horas contestadas.</strong> Proposta: ${fmtHoursDesc(a.proposedHours)}.<div class="kv">Créditos bloqueados até a resolução.</div></div>
      ${r.provider === ME ? `<button class="btn btn-accent btn-sm" data-demo-action="d-resolve" data-id="${a.id}">Aceitar tempo proposto</button>` : `<p class="kv">Aguardando resposta de ${esc(other.name)}…</p>`}`;
  } else if (a.status === 'concluida') {
    const mineRate = s.ratings.find(x => x.activityId === a.id && x.fromId === ME);
    const theirs = s.ratings.find(x => x.activityId === a.id && x.toId === ME);
    controls = `<div class="rating-summary"><span><strong>Sua avaliação:</strong> ${mineRate ? '★'.repeat(mineRate.stars) : 'pendente'}</span><span><strong>Avaliação recebida:</strong> ${theirs ? '★'.repeat(theirs.stars) : 'aguardando'}</span></div>
      ${mineRate ? '' : `<div class="field" style="margin-top:8px"><label>Avaliar ${esc(other.name)}</label><div class="rate" id="d-stars-${a.id}">${[1,2,3,4,5].map(n => `<button type="button" data-demo-action="d-star" data-id="${a.id}" data-star="${n}" aria-label="${n} estrelas">☆</button>`).join('')}</div><textarea id="d-comment-${a.id}" placeholder="Comentário opcional"></textarea><button class="btn btn-primary btn-sm" data-demo-action="d-rate" data-id="${a.id}">Enviar avaliação</button></div>`}`;
  }

  return `<article class="opp-card">
    <div class="inline"><span class="badge ${a.oppType === 'offer' ? 'badge-offer' : 'badge-request'}">${a.oppType === 'offer' ? 'OFERTA' : 'SOLICITAÇÃO'}</span><span class="badge badge-status">${label}</span><span class="badge badge-cat">${a.credited ? 'Créditos movimentados' : 'Créditos pendentes'}</span></div>
    <h3>${esc(a.title)}</h3>
    <div class="userrow"><div class="avatar" style="background:${other.color || '#999'}">${esc((other.name || 'P')[0])}</div><div><strong>${esc(other.name)}</strong><div class="kv">personagem fictício · ${esc(other.location || '')}</div></div></div>
    <div class="opp-meta"><span class="meta">⏱ ${fmtHoursDesc(a.plannedHours)}</span><span class="meta">${fmtCredits(a.confirmedHours || a.plannedHours)} crédito(s)</span><span class="meta">${a.credited ? 'creditado' : 'sem créditos ainda'}</span></div>
    ${a.note ? `<p class="kv">${esc(a.note)}</p>` : ''}
    ${controls}
  </article>`;
}

function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function demoView() {
  ensureTicker();
  const s = load();
  const speed = SPEEDS.includes(Number(s.speed)) ? Number(s.speed) : 1;
  const acts = s.activities;
  const pending = acts.filter(a => ['aceita', 'em_andamento', 'finalizada', 'contestada'].includes(a.status));
  const done = acts.filter(a => a.status === 'concluida');
  const received = s.ratings.filter(r => r.toId === ME);
  const charList = s.chars;
  const conns = s.connections || [];

  return `
  <div class="demo-banner"><span>🤖</span><b>Ambiente de demonstração isolado.</b> Tudo aqui é fictício e nenhuma ação afeta usuários ou dados reais. <span class="badge badge-status">DADOS SIMULADOS</span></div>
  <div class="page-head inline" style="align-items:flex-start"><div style="flex:1"><h1>Modo demonstração</h1><p>Experimente o ciclo completo: interesse → aceite → código de 4 dígitos → cronômetro → confirmação → créditos → avaliações.</p></div><button class="btn btn-outline" data-demo-action="d-reset">Reiniciar demonstração</button></div>

  <div class="card" style="margin-bottom:14px">
    <div class="inline" style="flex-wrap:wrap"><strong>Velocidade do tempo:</strong>${SPEEDS.map(v => `<button class="btn ${speed === v ? 'btn-accent' : 'btn-outline'} btn-sm" data-demo-action="d-speed" data-speed="${v}">${v}x</button>`).join('')}
      <span style="flex:1"></span><span class="kv">Relógio virtual: <strong id="demo-virtual-clock">${new Date(s.virtualNow).toLocaleTimeString('pt-BR')}</strong></span></div>
    <div class="inline" style="margin-top:8px;flex-wrap:wrap"><span class="kv">Avançar tempo manualmente:</span>
      <button class="btn btn-outline btn-sm" data-demo-action="d-advance" data-mins="1">+1 min</button>
      <button class="btn btn-outline btn-sm" data-demo-action="d-advance" data-mins="5">+5 min</button>
      <button class="btn btn-outline btn-sm" data-demo-action="d-advance" data-mins="15">+15 min</button>
      <button class="btn btn-outline btn-sm" data-demo-action="d-advance" data-mins="30">+30 min</button>
      <span class="badge badge-status" id="demo-speed-badge">${speed > 1 ? `⏩ Tempo acelerado em ${speed}x` : 'Tempo normal'}</span></div>
  </div>

  <div class="grid3" style="margin-bottom:14px">
    <div class="card stat"><div class="ic">⏰</div><div><strong>${fmtCredits(s.me.credits)} créditos</strong><span class="text-muted">Saldo fictício</span></div></div>
    <div class="card stat"><div class="ic">🌟</div><div><strong>${s.me.activitiesCompleted} atividades</strong><span class="text-muted">${s.me.hoursShared}h compartilhadas · ${s.me.peopleHelped} pessoas ajudadas</span></div></div>
    <div class="card stat"><div class="ic">⭐</div><div><strong>${s.me.ratingAvg ? s.me.ratingAvg.toFixed(1) : '—'} ★</strong><span class="text-muted">${s.me.ratingsCount || 0} avaliações recebidas</span></div></div>
  </div>

  <div class="grid2" style="margin-bottom:14px">
    <div class="card"><h3>1. Solicitar ajuda</h3><p class="small text-muted">Crie uma solicitação. Em cerca de 5 segundos um personagem fictício aceita.</p>
      <div class="field"><label>Título</label><input id="d-req-title" class="input" value="Preciso de ajuda para instalar uma prateleira"></div>
      <div class="field"><label>Tempo estimado</label><select id="d-req-mins" class="input"><option value="15">15 minutos</option><option value="30" selected>30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option></select></div>
      <button class="btn btn-accent btn-block" data-demo-action="d-create-request">Criar solicitação simulada</button>
    </div>
    <div class="card"><h3>2. Oferecer ajuda</h3><p class="small text-muted">Publique uma oferta. Um personagem demonstra interesse para você aceitar.</p>
      <div class="field"><label>Título</label><input id="d-off-title" class="input" value="Aula de informática básica para vizinhos"></div>
      <div class="field"><label>Tempo estimado</label><select id="d-off-mins" class="input"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45" selected>45 minutos</option><option value="60">1 hora</option></select></div>
      <button class="btn btn-accent btn-block" data-demo-action="d-create-offer">Criar oferta simulada</button>
    </div>
  </div>

  ${pending.length ? `<h2 style="margin:20px 0 10px">Atividades em andamento (${pending.length})</h2><div class="grid2">${pending.map(a => activityPanel(s, a)).join('')}</div>` : ''}

  <h2 style="margin:20px 0 10px">Atividades concluídas (${done.length})</h2>
  <div class="grid2">${done.length ? done.map(a => activityPanel(s, a)).join('') : '<div class="card empty"><div class="big">🗓️</div><h3>Nenhuma atividade concluída ainda</h3><p>Crie uma solicitação ou uma oferta para começar.</p></div>'}</div>

  <div class="two-col" style="margin-top:18px">
    <div class="stack">
      <div class="card"><h3>Notificações fictícias</h3><div class="inline" style="margin-bottom:8px"><button class="btn btn-ghost btn-sm" data-demo-action="d-read-all">Marcar todas como lidas</button></div>
        <div class="stack">${s.notifications.slice(0, 10).map(n => `<div class="note-item ${n.read ? '' : 'unread'}"><div style="flex:1"><strong>${esc(n.title)}</strong><div class="small text-muted">${esc(n.message)}</div><div class="kv">${new Date(n.at).toLocaleString('pt-BR')}</div></div>${n.read ? '' : `<button class="btn btn-ghost btn-sm" data-demo-action="d-read" data-id="${n.id}">Marcar lida</button>`}</div>`).join('')}</div>
      </div>
      <div class="card"><h3>Histórico de créditos</h3><div class="stack">${s.transactions.map(t => `<div class="inline"><strong>${t.amount > 0 ? '+' : '−'}${fmtCredits(Math.abs(t.amount))}</strong><span style="flex:1">${esc(t.description)}</span><span class="kv">${fmtDate(t.date)} · saldo ${fmtCredits(t.balanceAfter)}</span></div>`).join('')}</div></div>
    </div>
    <div class="stack">
      <div class="card"><h3>Personagens e conexões</h3>
        <div class="stack">${charList.map(c => {
          const isConn = conns.some(x => x.status === 'aceito' && (x.requesterId === c.id || x.addresseeId === c.id));
          const cRatings = s.ratings.filter(r => r.toId === c.id);
          return `<div class="inline">${avatarDemo(c)}<div style="flex:1"><strong>${esc(c.name)}</strong><div class="kv">${esc(c.location)} · ${c.ratingAvg.toFixed(1)} ★ (${c.ratingsCount})</div><div class="chips">${c.skills.map(x => `<span class="badge badge-cat">${esc(x)}</span>`).join('')}</div></div>${isConn ? '<span class="badge badge-status">✓ conectado</span>' : `<button class="btn btn-outline btn-sm" data-demo-action="d-connect" data-id="${c.id}">Conectar</button>`}</div>`;
        }).join('')}</div>
      </div>
      <div class="card"><h3>Convites</h3><p class="small text-muted">Link pessoal fictício. Nenhum cadastro real é criado.</p>
        <input class="input" readonly value="${esc((location.origin || '') + '/register?ref=' + s.inviteCode)}">
        <div class="inline" style="margin-top:8px"><button class="btn btn-outline btn-sm" data-demo-action="d-copy-invite">Copiar link</button><button class="btn btn-outline btn-sm" data-demo-action="d-simulate-invite">Simular cadastro confirmado</button></div>
        <div class="opp-meta" style="margin-top:8px"><span class="meta">👥 ${s.invitesSent} enviados</span><span class="meta">✅ ${s.invitesConfirmed} confirmados</span><span class="meta">Código ${s.inviteCode}</span></div>
        <p class="kv">Convites não concedem créditos automaticamente.</p>
      </div>
      <div class="card"><h3>Projetos fictícios</h3><div class="stack">${s.projects.map(p => `<div class="inline"><strong>${esc(p.title)}</strong><span class="kv">${fmtCredits(p.contributedHours)}/${fmtCredits(p.goalHours)}h</span><span style="flex:1"></span>${p.participants.includes(ME) ? '<span class="badge badge-status">participando</span>' : `<button class="btn btn-outline btn-sm" data-demo-action="d-join-project" data-id="${p.id}">Participar</button>`}</div>`).join('')}</div></div>
      <div class="card"><h3>Avaliações recebidas</h3><div class="stack">${received.map(r => { const author = userLike(s, r.fromId); return `<div class="review"><div class="inline"><div class="avatar" style="background:${author.color || '#999'}">${esc((author.name || 'P')[0])}</div><div style="flex:1"><strong>${esc(author.name)}</strong><div class="kv">${fmtDate(r.date)}</div></div><span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span></div>${r.comment ? `<p class="small" style="margin:6px 0 0">${esc(r.comment)}</p>` : ''}</div>`; }).join('') || '<span class="kv">Nenhuma avaliação recebida ainda.</span>'}</div></div>
    </div>
  </div>

  <div class="readme" style="margin-top:16px">Este ambiente é reiniciável e permanece totalmente separado dos dados reais. Use as velocidades 1x, 5x, 10x ou 30x e os botões de avanço para simular 30 minutos em poucos segundos.</div>`;
}

function avatarDemo(c) {
  return `<div class="avatar" style="background:${c.color || '#999'}">${esc((c.name || 'P').split(' ').map(p => p[0]).slice(0, 2).join(''))}</div>`;
}

function findAct(s, id) { return s.activities.find(a => a.id === id); }

function paintSpeed(speed){
  document.querySelectorAll('[data-demo-action="d-speed"]').forEach(b=>{
    const on = Number(b.dataset.speed) === speed;
    b.classList.toggle('btn-accent', on);
    b.classList.toggle('btn-outline', !on);
  });
  const badge = document.getElementById('demo-speed-badge');
  if (badge) badge.textContent = speed > 1 ? `⏩ Tempo acelerado em ${speed}x` : 'Tempo normal';
}

function paintNotification(s, n){
  const item = document.querySelector(`[data-demo-action="d-read"][data-id="${n.id}"]`)?.closest('.note-item');
  if (item) { item.classList.remove('unread'); const btn = item.querySelector('[data-demo-action="d-read"]'); if (btn) btn.remove(); }
}

export async function demoAction(action, el) {
  const s = load();
  s.virtualNow += (Date.now() - s.lastReal) * s.speed;
  s.lastReal = Date.now();
  const id = el?.dataset?.id;
  const mins = Number(el?.dataset?.mins || 0);
  let message = null;
  let type = 'success';
  let render = true;

  switch (action) {
    case 'd-speed': {
      s.speed = SPEEDS.includes(Number(el.dataset.speed)) ? Number(el.dataset.speed) : 1;
      save(s);
      paintSpeed(s.speed);
      return { toast: `Velocidade ajustada para ${s.speed}x.`, render: false };
    }
    case 'd-advance': {
      s.virtualNow += mins * 60000;
      save(s);
      return { toast: `Tempo avançado em ${mins} minuto(s).`, render: false };
    }
    case 'd-advance-activity': {
      s.virtualNow += mins * 60000;
      save(s);
      return { toast: `Tempo avançado em ${mins} minuto(s).`, render: false };
    }
    case 'd-reset': {
      save(seed());
      return { toast: 'Demonstração reiniciada com os dados iniciais.', render: true };
    }
    case 'd-create-request': {
      const title = (document.getElementById('d-req-title')?.value || '').trim();
      const minutes = Number(document.getElementById('d-req-mins')?.value || 30);
      if (title.length < 5) { toast('Descreva o que você precisa.', 'error'); save(s); return { render: false }; }
      const hours = minutes / 60;
      const c = s.chars[1];
      const opp = { id: uid('do'), ownerId: ME, type: 'request', title, description: 'Solicitação criada no modo demonstração.', category: 'Serviços domésticos', modality: 'presencial', durationHours: hours, location: 'Sua comunidade', publishedAt: today() };
      s.opportunities.unshift(opp);
      const a = { id: uid('da'), oppId: opp.id, title, oppType: 'request', ownerId: ME, interestedId: c.id, status: 'interesse', plannedHours: hours, confirmedHours: null, startedAt: null, credited: false, note: 'Aguardando um personagem aceitar…', autoAcceptAt: Date.now() + 5000 };
      s.activities.unshift(a);
      pushNote(s, 'Solicitação publicada', `Aguardando alguém aceitar "${title}". Em alguns segundos um personagem fictício vai aceitar.`);
      message = 'Solicitação criada. Aguarde cerca de 5 segundos.';
      break;
    }
    case 'd-create-offer': {
      const title = (document.getElementById('d-off-title')?.value || '').trim();
      const minutes = Number(document.getElementById('d-off-mins')?.value || 45);
      if (title.length < 5) { toast('Descreva o que você oferece.', 'error'); save(s); return { render: false }; }
      const hours = minutes / 60;
      const c = s.chars[0];
      const opp = { id: uid('do'), ownerId: ME, type: 'offer', title, description: 'Oferta criada no modo demonstração.', category: 'Tecnologia', modality: 'presencial', durationHours: hours, location: 'Sua comunidade', publishedAt: today() };
      s.opportunities.unshift(opp);
      const a = { id: uid('da'), oppId: opp.id, title, oppType: 'offer', ownerId: ME, interestedId: c.id, status: 'interesse', plannedHours: hours, confirmedHours: null, startedAt: null, credited: false, note: 'Aguardando o interesse do personagem…', autoAcceptAt: Date.now() + 5000 };
      s.activities.unshift(a);
      pushNote(s, 'Oferta publicada', `Aguardando interesse em "${title}". Um personagem fictício vai demonstrar interesse em instantes.`);
      message = 'Oferta criada. Aguarde cerca de 5 segundos.';
      break;
    }
    case 'd-star': {
      const stars = Number(el.dataset.star || 0);
      document.querySelectorAll(`#d-stars-${id} button`).forEach(b => {
        const on = Number(b.dataset.star) <= stars;
        b.textContent = on ? '★' : '☆';
        b.classList.toggle('on', on);
      });
      save(s);
      return { render: false };
    }
    case 'd-rate': {
      const a = findAct(s, id); if (!a) break;
      const buttons = document.querySelectorAll(`#d-stars-${id} button.on`);
      const stars = buttons.length ? Number(buttons[buttons.length - 1].dataset.star) : 0;
      if (!stars) { toast('Escolha de 1 a 5 estrelas.', 'error'); save(s); return { render: false }; }
      const comment = (document.getElementById(`d-comment-${id}`)?.value || '').trim();
      const r = role(s, a);
      const to = r.provider === ME ? r.requester : r.provider;
      if (s.ratings.some(x => x.activityId === a.id && x.fromId === ME)) { message = 'Você já avaliou esta atividade.'; break; }
      s.ratings.unshift({ id: uid('dr'), activityId: a.id, fromId: ME, toId: to, stars, comment, date: today() });
      pushNote(s, 'Avaliação enviada', `Você avaliou ${char(s, to).name} com ${stars} estrela(s).`);
      message = 'Avaliação registrada na demonstração.';
      break;
    }
    case 'd-start': {
      const a = findAct(s, id); if (!a) break;
      a.status = 'em_andamento';
      a.startedAt = s.virtualNow;
      a.note = 'Cronômetro iniciado com o código correto.';
      pushNote(s, 'Atividade iniciada', `"${a.title}" começou. O cronômetro usa o horário do relógio da demonstração.`);
      message = 'Código validado e cronômetro iniciado.';
      break;
    }
    case 'd-finish': {
      const a = findAct(s, id); if (!a) break;
      a.status = 'finalizada';
      a.endedAt = s.virtualNow;
      a.confirmedHours = hoursFromMs(s.virtualNow - a.startedAt);
      a.note = 'Finalizada pelo prestador. Aguardando confirmação do solicitante.';
      pushNote(s, 'Atividade finalizada', `"${a.title}" foi finalizada com ${fmtHoursDesc(a.confirmedHours)}. Confirme o tempo.`);
      message = 'Atividade finalizada. Confirme o tempo para liberar os créditos.';
      break;
    }
    case 'd-finish-char': {
      const a = findAct(s, id); if (!a) break;
      a.status = 'finalizada';
      a.endedAt = s.virtualNow;
      a.confirmedHours = hoursFromMs(s.virtualNow - a.startedAt);
      a.note = 'O personagem finalizou. Você, como solicitante, deve confirmar ou contestar.';
      pushNote(s, 'Atividade finalizada', `${char(s, a.interestedId).name} finalizou "${a.title}" com ${fmtHoursDesc(a.confirmedHours)}.`);
      message = 'O personagem finalizou. Agora confirme ou conteste o tempo.';
      break;
    }
    case 'd-confirm': {
      const a = findAct(s, id); if (!a) break;
      conclude(s, a, a.confirmedHours);
      message = 'Tempo confirmado. Créditos fictícios movimentados.';
      break;
    }
    case 'd-contest': {
      const a = findAct(s, id); if (!a) break;
      const proposed = Math.max(0.25, Math.round((a.confirmedHours / 2) * 4) / 4);
      a.status = 'contestada';
      a.proposedHours = proposed;
      a.note = 'Tempo contestado pelo solicitante. Créditos bloqueados até a resolução.';
      pushNote(s, 'Horas contestadas', `Você contestou "${a.title}". Proposta: ${fmtHoursDesc(proposed)}.`);
      message = 'Contestação registrada. Os créditos ficam bloqueados.';
      break;
    }
    case 'd-resolve': {
      const a = findAct(s, id); if (!a) break;
      conclude(s, a, a.proposedHours);
      message = 'Tempo proposto aceito e créditos liberados.';
      break;
    }
    case 'd-connect': {
      const c = char(s, id);
      if ((s.connections || []).some(x => (x.requesterId === id || x.addresseeId === id) && x.status === 'aceito')) { message = 'Vocês já estão conectados.'; break; }
      s.connections = s.connections || [];
      s.connections.push({ id: uid('dc'), requesterId: ME, addresseeId: id, status: 'aceito' });
      pushNote(s, 'Conexão aceita', `${c.name} aceitou sua conexão fictícia.`);
      message = `Conexão com ${c.name} criada na demonstração.`;
      break;
    }
    case 'd-join-project': {
      const p = s.projects.find(x => x.id === id); if (!p) break;
      if (!p.participants.includes(ME)) p.participants.push(ME);
      message = `Você entrou no projeto "${p.title}" (simulação).`;
      break;
    }
    case 'd-read': {
      const n = s.notifications.find(x => x.id === id);
      if (n) { n.read = true; paintNotification(s, n); }
      save(s);
      return { render: false };
    }
    case 'd-read-all': {
      s.notifications.forEach(n => { n.read = true; paintNotification(s, n); });
      save(s);
      return { toast: 'Notificações fictícias marcadas como lidas.', render: false };
    }
    case 'd-copy-invite': {
      const url = `${location.origin || ''}/register?ref=${s.inviteCode}`;
      const c = cfg();
      const ok = c.copyText ? await c.copyText(url) : false;
      toast(ok ? 'Link de convite fictício copiado!' : 'Não foi possível copiar o link.', ok ? 'success' : 'error');
      save(s);
      return { render: false };
    }
    case 'd-simulate-invite': {
      s.invitesSent += 1;
      s.invitesConfirmed += 1;
      pushNote(s, 'Convite confirmado', 'Um personagem fictício concluiu o cadastro pelo seu link (simulação).');
      message = 'Cadastro confirmado simulado. Nenhum crédito foi concedido.';
      break;
    }
    default:
      save(s);
      return { render: false };
  }

  processSimulation(s);
  save(s);
  return { toast: message, type, render };
}

/* Colabre — App (SPA demonstrativa, Vanilla JS)
   Autenticação e persistência são apenas demonstrativas via localStorage. */
import { loadDB, saveDB, resetDB, uid } from './storage.js';
import { $, $$, esc, fmtDate, fmtCredits, fmtHoursDesc, toast, confirmModal, closeModal } from './modules/utils.js';
import { getBalance, getStats, addTransaction, settleActivity } from './modules/credits.js';
import { filterOpportunities } from './modules/opportunities.js';
import { projectProgress, filterProjects } from './modules/projects.js';
import { notify, unreadCount } from './modules/notifications.js';

let db = loadDB();
const savedTheme = localStorage.getItem('colabre_theme');
if(savedTheme){ document.documentElement.setAttribute('data-theme', savedTheme); }
function toggleTheme(){ const isDark = document.documentElement.getAttribute('data-theme')==='dark'; document.documentElement.setAttribute('data-theme', isDark?'light':'dark'); localStorage.setItem('colabre_theme', isDark?'light':'dark'); }
const CATEGORIES = ['Educação','Tecnologia','Idiomas','Saúde e bem-estar','Artes e criatividade','Serviços domésticos','Esportes','Apoio comunitário','Outros'];
const PROJ_CATEGORIES = ['Meio ambiente','Educação','Inclusão social','Tecnologia','Cultura','Infraestrutura comunitária','Saúde e bem-estar','Outros'];
const LEVELS = ['Iniciante','Colaborador','Participante ativo','Referência comunitária','Embaixador'];

const ui = { explore:{q:'',type:'todas',category:'todas',modality:'todas',duration:'todas',sort:'recentes'}, proj:{q:'',category:'todas',status:'todas',location:'todas',onlyNeeds:false}, activityTab:'todas', createStep:1, create:{type:'offer',title:'',description:'',category:'Educação',modality:'online',durationHours:1,availability:'',location:''}, createProj:{}, editMode:false, evalFor:null };

function me(){ return db.users.find(u=>u.id===db.currentUserId); }
function userById(id){ return db.users.find(u=>u.id===id) || {name:'Usuário', color:'#999'}; }
function avatar(u, cls=''){ return `<div class="avatar ${cls}" style="background:${u.color||'#3D5145'}" aria-hidden="true">${esc((u.name||'U').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase())}</div>`; }
function avatarName(u){ return `<div class="userrow">${avatar(u)}<div><strong>${esc(u.name)}</strong><div class="kv">${esc(u.location||'')}</div></div></div>`; }
function logout(){ db.currentUserId=null; saveDB(db); location.hash='#/login'; render(); }
function go(view, id){ location.hash = id ? `#/${view}/${id}` : `#/${view}`; }
function parseRoute(){ const h = location.hash.replace('#/',''); const [v, id] = h.split('/'); return { view: v||'login', id }; }

function layout(inner, active){
  const u = me(); const un = unreadCount(db, u.id);
  const links = [['dashboard','🏠','Início'],['explorar','🔍','Explorar'],['atividades','🗓️','Minhas atividades'],['projetos','🌱','Projetos'],['carteira','⏰','Carteira'],['perfil','👤','Meu perfil'],['config','⚙️','Configurações']];
  return `
  <div class="app">
    <aside class="sidebar">
      <div class="logo">Colabre</div>
      <nav class="nav" aria-label="Principal">
        ${links.map(([v,ic,l])=>`<a href="#/${v}" class="${active===v?'active':''}"><span class="ico">${ic}</span>${l}</a>`).join('')}
      </nav>
      <div class="side-user">${avatar(u)}<div style="min-width:0"><strong class="small">${esc(u.name)}</strong><div class="kv">${fmtCredits(getBalance(db,u.id))} créditos</div></div></div>
    </aside>
    <div class="main">
      <header class="topbar"><div class="topbar-in">
        <strong style="color:var(--primary)">Colabre</strong>
        <span class="chip" style="background:var(--accent-light);color:#8F3B00;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:800">⏰ ${fmtCredits(getBalance(db,u.id))} créditos</span>
        <div class="spacer"></div>
        <a class="btn btn-outline btn-sm" href="#/criar">＋ Criar</a>
        <button class="iconbtn" data-action="notif" aria-label="Notificações">🔔${un?`<span class="dot">${un}</span>`:''}</button>
        <button class="iconbtn theme-toggle" data-action="theme" aria-label="Alternar tema">🌙</button>
        <button class="iconbtn" data-action="logout" aria-label="Sair">↪</button>
      </div></header>
      <div class="content"><div class="page">${inner}</div></div>
    </div>
  </div>
  <nav class="mobile-nav" aria-label="Navegação móvel">
    <a href="#/dashboard" class="${active==='dashboard'?'active':''}">🏠<span>Início</span></a>
    <a href="#/explorar" class="${active==='explorar'?'active':''}">🔍<span>Explorar</span></a>
    <a href="#/criar" class="${active==='criar'?'active':''}"><span class="fab">＋</span><span>Criar</span></a>
    <a href="#/projetos" class="${active==='projetos'?'active':''}">🌱<span>Projetos</span></a>
    <a href="#/perfil" class="${active==='perfil'?'active':''}">👤<span>Perfil</span></a>
  </nav>`;
}

/* ---------- Auth ---------- */
function renderAuth(){
  $('#root').innerHTML = `
  <div class="auth">
    <section class="auth-hero">
      <div>
        <div class="logo" style="color:#fff;padding:0">Colabre</div>
        <h1 style="margin-top:26px">Seu tempo tem valor. Sua comunidade também.</h1>
        <p class="sub">Conectamos pessoas para compartilhar habilidades, oferecer ajuda e transformar pequenas contribuições em grandes mudanças.</p>
        <div class="benefits">
          <div class="benefit"><span>🤝</span><div><strong>Compartilhe o que você sabe</strong><div class="small" style="color:#D9E3DB">Ofereça aulas, consertos, orientação e muito mais.</div></div></div>
          <div class="benefit"><span>💬</span><div><strong>Receba ajuda quando precisar</strong><div class="small" style="color:#D9E3DB">Uma hora de contribuição equivale a um crédito de tempo.</div></div></div>
          <div class="benefit"><span>🌱</span><div><strong>Construa algo maior com sua comunidade</strong><div class="small" style="color:#D9E3DB">Participe de projetos coletivos que transformam bairros.</div></div></div>
        </div>
        <div class="hero-illu">🤝 Uma hora de contribuição = <strong>1 crédito de tempo</strong> — sem dinheiro, com confiança e vizinhança.</div>
      </div>
      <div class="small" style="color:#B9C9BD;margin-top:20px">Protótipo acadêmico demonstrativo · Dados salvos apenas no navegador (localStorage).</div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <div class="logo">Colabre</div>
        <h2 style="margin:10px 0 4px">Entrar na plataforma</h2>
        <p class="text-muted small">Use a conta demo ou crie uma conta para explorar.</p>
        <form id="login-form" novalidate>
          <div class="field"><label for="login-email">E-mail</label><input id="login-email" type="email" placeholder="demo@tempovale.com" required></div>
          <div class="field"><label for="login-pass">Senha</label><input id="login-pass" type="password" placeholder="Qualquer senha (demo)" required></div>
          <p class="error" id="login-error"></p>
          <button class="btn btn-accent btn-block" type="submit">Entrar</button>
        </form>
        <div class="inline" style="margin-top:10px;justify-content:center">
          <button class="btn btn-primary" data-action="demo">Acessar demonstração</button>
          <button class="btn btn-outline" data-action="visitor">Continuar como visitante</button>
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">
        <h3>Criar conta (demo)</h3>
        <form id="signup-form" novalidate>
          <div class="field"><label for="su-name">Nome completo</label><input id="su-name" type="text" placeholder="Seu nome" required></div>
          <div class="field"><label for="su-email">E-mail</label><input id="su-email" type="email" placeholder="voce@exemplo.com" required></div>
          <div class="field"><label for="su-pass">Senha</label><input id="su-pass" type="password" placeholder="Crie uma senha" required></div>
          <p class="error" id="su-error"></p>
          <button class="btn btn-outline btn-block" type="submit">Criar conta</button>
        </form>
        <p class="lang-note" style="margin-top:12px">Demo: <strong>demo@tempovale.com</strong> / qualquer senha · Visitante entra como Marina Santos.</p>
      </div>
    </section>
  </div>`;
  $('#login-form').addEventListener('submit', e=>{
    e.preventDefault();
    const email = $('#login-email').value.trim().toLowerCase();
    const pass = $('#login-pass').value;
    const found = db.users.find(u=>u.email.toLowerCase()===email);
    if(!email || !pass){ $('#login-error').textContent='Preencha e-mail e senha.'; return; }
    if(!found){ $('#login-error').textContent='Conta não encontrada. Crie uma conta ou use a demonstração.'; return; }
    db.currentUserId = found.id; saveDB(db); location.hash='#/dashboard'; render();
  });
  $('#signup-form').addEventListener('submit', e=>{
    e.preventDefault();
    const name = $('#su-name').value.trim(); const email = $('#su-email').value.trim().toLowerCase(); const pass = $('#su-pass').value;
    if(name.length<3){ $('#su-error').textContent='Informe seu nome completo.'; return; }
    if(!email.includes('@')){ $('#su-error').textContent='E-mail inválido.'; return; }
    if(pass.length<4){ $('#su-error').textContent='A senha precisa de ao menos 4 caracteres.'; return; }
    if(db.users.some(u=>u.email.toLowerCase()===email)){ $('#su-error').textContent='Este e-mail já está cadastrado.'; return; }
    const colors=['#3D5145','#CC5500','#4F8062','#2F5D6C','#9C4A6B','#8A6D3B'];
    const nu = {id:uid('u'), name, firstName:name.split(' ')[0], email, password:pass, color:colors[db.users.length%colors.length], bio:'Novo participante do Colabre.', location:'Minha comunidade', skills:[], hoursShared:0, activitiesCompleted:0, peopleHelped:0, ratingAvg:0, ratingsCount:0, joinedAt:new Date().toISOString().slice(0,10), availability:'A combinar', level:'Iniciante'};
    db.users.push(nu); addTransaction(db, nu.id, 2, 'Crédito de boas-vindas'); db.currentUserId=nu.id; saveDB(db); location.hash='#/dashboard'; render();
    setTimeout(()=>toast('Conta criada! Você recebeu 2 créditos de boas-vindas.'),100);
  });
}

/* ---------- Componentes ---------- */
function oppCard(o){
  const u = userById(o.ownerId); const mine = o.ownerId===db.currentUserId;
  return `<article class="opp-card">
    <div class="inline"><span class="badge ${o.type==='offer'?'badge-offer':'badge-request'}">${o.type==='offer'?'OFERTA DE AJUDA':'SOLICITAÇÃO DE AJUDA'}</span><span class="badge badge-cat">${esc(o.category)}</span>${mine?'<span class="badge badge-status">Sua publicação</span>':''}</div>
    <h3>${esc(o.title)}</h3><p>${esc(o.description)}</p>
    ${avatarName(u)}
    <div class="opp-meta"><span class="meta">⏱ ${fmtHoursDesc(o.durationHours)}</span><span class="meta">${fmtCredits(o.durationHours)} ${o.durationHours==1?'crédito':'créditos'}</span><span class="meta">${o.modality==='online'?'🖥️ Online':o.modality==='presencial'?'📍 Presencial':'🖥️📍 Ambas'}</span><span class="meta">📍 ${esc(o.location)}</span><span class="meta">🗓️ ${fmtDate(o.publishedAt)}</span></div>
    <div class="inline"><span class="badge badge-status">${o.availability||''}</span><span style="flex:1"></span><button class="btn btn-outline btn-sm" data-action="opp-detail" data-id="${o.id}">Ver oportunidade</button></div>
  </article>`;
}
function projCard(p){
  const {pct,remaining} = projectProgress(p); const owner=userById(p.ownerId);
  const colors={'post':'#2563EB','p1':'linear-gradient(120deg,#10B981,#2563EB)','p2':'linear-gradient(120deg,#0EA5E9,#2563EB)','p3':'linear-gradient(120deg,#F59E0B,#D97706)','p4':'linear-gradient(120deg,#8B5CF6,#2563EB)'};
  const emojis={p1:'🌳',p2:'💻',p3:'🥕',p4:'🧘'};
  const bg = colors[p.id]||'linear-gradient(120deg,#3D5145,#2E4238)';
  return `<article class="card proj-card">
    <div class="proj-cover" style="background:${bg}"><span class="cover-emoji" aria-hidden="true">${emojis[p.id]||'🌱'}</span></div>
    <div class="proj-body">
      <div class="inline"><span class="badge badge-cat">${esc(p.category)}</span><span class="badge badge-status">${esc(p.status)}</span><span class="badge badge-status">${esc(p.location)}</span></div>
      <h3 style="margin:8px 0 6px">${esc(p.title)}</h3>
      <p class="text-muted small" style="min-height:40px">${esc(p.description)}</p>
      <div class="kv">${fmtCredits(p.contributedHours)} de ${fmtCredits(p.goalHours)} horas · ${p.participants.length} participantes · faltam ${fmtCredits(remaining)}h</div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>
      <div class="kv">${pct}% da meta · por ${esc(owner.name)}</div>
      <div style="margin-top:10px"><button class="btn btn-outline btn-sm" data-action="proj-detail" data-id="${p.id}">Ver projeto</button></div>
    </div>
  </article>`;
}

/* ---------- Dashboard ---------- */
function renderDashboard(){
  const u=me(); const isDemo = u && (u.email === 'demo@colabre.com' || u.id === 'u1'); const bal=getBalance(db,u.id); const stats=getStats(db,u.id);
  const activityDone = db.activities.filter(a=>(a.ownerId===u.id||a.interestedId===u.id)&&a.status==='concluida').length;
  const recs = db.opportunities.filter(o=>o.ownerId!==u.id && o.status!=='cancelled').slice(0,4);
  const projs = db.projects.filter(p=>p.status==='Ativo').slice(0,3);
  const recent = [...db.transactions.filter(t=>t.userId===u.id)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const eq = fmtHoursDesc(bal);
  return layout(`
  <div class="page-head"><h1>Olá, ${isDemo ? 'Usuário' : esc(u.firstName)}! 👋</h1><p>Que bom ter você por aqui. Vamos fazer seu tempo valer?</p></div>
  <div class="grid3">
    <div class="card stat"><div class="ic">⏰</div><div><strong>${fmtCredits(bal)} créditos</strong><span class="text-muted">Disponíveis para utilizar · Equivalente a ${eq}</span><div style="margin-top:8px"><a class="btn btn-outline btn-sm" href="#/carteira">Ver carteira</a></div></div></div>
    <div class="card stat"><div class="ic">🤲</div><div><strong>${fmtCredits(u.hoursShared||0)} horas</strong><span class="text-muted">Compartilhadas · Seu tempo já ajudou outras pessoas</span></div></div>
    <div class="card stat"><div class="ic">🌟</div><div><strong>${(u.activitiesCompleted||0)} atividades</strong><span class="text-muted">Concluídas · ${u.peopleHelped||0} pessoas beneficiadas</span></div></div>
  </div>
  <h2 style="margin:22px 0 10px">Ações rápidas</h2>
  <div class="grid3">
    <a class="card" href="#/criar?type=offer" style="display:block"><div style="font-size:24px">🎁</div><strong>Oferecer ajuda</strong><p class="text-muted small" style="margin:4px 0 0">Publique uma oferta e acumule créditos.</p></a>
    <a class="card" href="#/criar?type=request" style="display:block"><div style="font-size:24px">🙋</div><strong>Solicitar ajuda</strong><p class="text-muted small" style="margin:4px 0 0">Peça apoio à comunidade com seus créditos.</p></a>
    <a class="card" href="#/criar-projeto" style="display:block"><div style="font-size:24px">🌱</div><strong>Criar projeto</strong><p class="text-muted small" style="margin:4px 0 0">Mobilize vizinhos em uma causa comum.</p></a>
  </div>
  <h2 style="margin:22px 0 10px">Oportunidades para você</h2>
  <div class="grid3">${recs.map(oppCard).join('')||'<div class="empty">Nenhuma oportunidade no momento.</div>'}</div>
  <h2 style="margin:22px 0 10px">Projetos em destaque</h2>
  <div class="grid3">${projs.map(projCard).join('')}</div>
  <h2 style="margin:22px 0 10px">Atividade recente</h2>
  <div class="card"><ul class="timeline">${recent.map(t=>`<li><strong>${t.amount>0?'+':'−'}${fmtCredits(Math.abs(t.amount))} crédito${Math.abs(t.amount)==1?'':'s'}</strong> — ${esc(t.description)}<div class="kv">${fmtDate(t.date)} · saldo ${fmtCredits(t.balanceAfter)}</div></li>`).join('')||'<li>Sem movimentações ainda.</li>'}</ul></div>
  <div class="banner" style="margin-top:22px"><div><h2>Grandes mudanças começam quando alguém decide compartilhar um pouco do que tem.</h2><p class="small" style="color:#D9E3DB;margin:6px 0 0">Seu tempo vale aqui.</p></div><a class="btn btn-accent" href="#/explorar">Explorar oportunidades</a></div>
  `,'dashboard');
}

/* ---------- Explorar ---------- */
function renderExplore(){
  const f=ui.explore; const list=filterOpportunities(db.opportunities,f);
  return layout(`
  <div class="page-head"><h1>Encontre oportunidades</h1><p>Descubra pessoas, conhecimentos e habilidades que podem fazer parte da sua jornada.</p></div>
  <div class="filters">
    <div class="toolbar"><div class="grow"><input class="input" id="q-exp" placeholder="Do que você precisa ou o que gostaria de aprender?" value="${esc(f.q)}" aria-label="Buscar oportunidades"></div><button class="btn btn-outline" data-action="clear-filters">Limpar filtros</button></div>
    <div class="row">
      <div class="field" style="margin:0"><label>Tipo</label><select id="f-type"><option value="todas">Todas</option><option value="offer" ${f.type==='offer'?'selected':''}>Ofertas de ajuda</option><option value="request" ${f.type==='request'?'selected':''}>Solicitações de ajuda</option></select></div>
      <div class="field" style="margin:0"><label>Categoria</label><select id="f-cat"><option value="todas">Todas</option>${CATEGORIES.map(c=>`<option ${f.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>Modalidade</label><select id="f-mod"><option value="todas">Todas</option><option value="presencial" ${f.modality==='presencial'?'selected':''}>Presencial</option><option value="online" ${f.modality==='online'?'selected':''}>Online</option><option value="ambas" ${f.modality==='ambas'?'selected':''}>Ambas</option></select></div>
      <div class="field" style="margin:0"><label>Duração</label><select id="f-dur"><option value="todas">Todas</option><option value="ate1" ${f.duration==='ate1'?'selected':''}>Até 1 hora</option><option value="1a2" ${f.duration==='1a2'?'selected':''}>1 a 2 horas</option><option value="mais2" ${f.duration==='mais2'?'selected':''}>Mais de 2 horas</option></select></div>
      <div class="field" style="margin:0"><label>Ordenar</label><select id="f-sort"><option value="recentes" ${f.sort==='recentes'?'selected':''}>Mais recentes</option><option value="duracao" ${f.sort==='duracao'?'selected':''}>Menor duração</option><option value="relevancia" ${f.sort==='relevancia'?'selected':''}>Mais relevantes</option></select></div>
    </div>
  </div>
  <div class="kv" style="margin-bottom:10px">${list.length} resultado${list.length===1?'':'s'}</div>
  ${list.length?`<div class="grid3">${list.map(oppCard).join('')}</div>`:`<div class="card empty"><div class="big">🔍</div><h3>Nenhuma oportunidade encontrada</h3><p>Tente ajustar a busca ou limpar os filtros.</p><button class="btn btn-outline" data-action="clear-filters">Limpar filtros</button></div>`}
  `,'explorar');
}

/* ---------- Detalhe oportunidade ---------- */
function renderOppDetail(id){
  const o=db.opportunities.find(x=>x.id===id); if(!o) return renderExplore();
  const u=userById(o.ownerId); const isMine=o.ownerId===db.currentUserId;
  const myAct=db.activities.find(a=>a.oppId===id && (a.interestedId===db.currentUserId||a.ownerId===db.currentUserId));
  return layout(`
  <button class="btn btn-ghost" data-action="back">← Voltar</button>
  <div class="two-col" style="margin-top:10px">
    <div class="stack">
      <div class="card">
        <div class="inline"><span class="badge ${o.type==='offer'?'badge-offer':'badge-request'}">${o.type==='offer'?'OFERTA DE AJUDA':'SOLICITAÇÃO DE AJUDA'}</span><span class="badge badge-cat">${esc(o.category)}</span></div>
        <h1 style="margin:10px 0">${esc(o.title)}</h1>
        <p class="text-muted">${esc(o.description)}</p>
        <div class="opp-meta"><span class="meta">⏱ ${fmtHoursDesc(o.durationHours)}</span><span class="meta">${fmtCredits(o.durationHours)} ${o.durationHours==1?'crédito':'créditos'}</span><span class="meta">${o.modality}</span><span class="meta">📍 ${esc(o.location)}</span><span class="meta">🗓️ ${esc(o.availability||'')}</span><span class="meta">Publicado ${fmtDate(o.publishedAt)}</span></div>
        <div class="readme">No Colabre, o tempo é nossa unidade de troca. Cada hora de contribuição equivale a um crédito. A movimentação acontece apenas após a atividade e a confirmação mútua.</div>
      </div>
      <div class="card"><h3>Sobre quem publicou</h3><div class="userrow" style="margin-top:10px">${avatar(u,'avatar-lg')}<div><strong>${esc(u.name)}</strong><div class="kv">${esc(u.location)} · nível ${esc(u.level||'Colaborador')} · ${fmtCredits(u.hoursShared||0)}h compartilhadas</div><p class="small text-muted" style="margin:6px 0 0">${esc(u.bio)}</p><div class="chips">${(u.skills||[]).map(s=>`<span class="badge badge-cat">${esc(s)}</span>`).join('')}</div></div></div></div>
    </div>
    <div class="card stack">
      <h3>Participar</h3>
      ${isMine?'<p class="text-muted small">Esta é a sua publicação. Você pode acompanhá-la em Minhas atividades.</p><a class="btn btn-primary btn-block" href="#/atividades">Ver em Minhas atividades</a>':
        myAct?`<p class="text-muted small">Você já demonstrou interesse nesta oportunidade. Status: <strong>${myAct.status}</strong></p><a class="btn btn-primary btn-block" href="#/atividades">Ver em Minhas atividades</a>`:
        `<button class="btn btn-accent btn-block" data-action="interest" data-id="${o.id}">${o.type==='offer'?'Tenho interesse':'Quero ajudar'}</button>
         <p class="kv">Demonstração de interesse não conclui a atividade nem movimenta créditos. A confirmação das horas é necessária.</p>`}
    </div>
  </div>`);
}

/* ---------- Criar oportunidade (multietapas) ---------- */
function renderCreate(){
  const c=ui.create; const typeQ=new URLSearchParams(location.hash.split('?')[1]||''); if(typeQ.get('type')) c.type=typeQ.get('type');
  const steps=['Tipo','Informações','Tempo','Revisão'];
  let body='';
  if(ui.createStep===1) body=`
    <h2>O que você gostaria de fazer?</h2>
    <div class="grid2" style="margin-top:12px">
      <button class="card ${c.type==='offer'?'sel':''}" data-action="set-type" data-type="offer" style="text-align:left;border:${c.type==='offer'?'2px solid var(--accent)':'1px solid var(--border)'}"><div style="font-size:26px">🎁</div><strong>Oferecer ajuda</strong><p class="text-muted small">Compartilhe uma habilidade e receba créditos.</p></button>
      <button class="card" data-action="set-type" data-type="request" style="text-align:left;border:${c.type==='request'?'2px solid var(--accent)':'1px solid var(--border)'}"><div style="font-size:26px">🙋</div><strong>Solicitar ajuda</strong><p class="text-muted small">Peça apoio à comunidade com seus créditos.</p></button>
    </div>`;
  if(ui.createStep===2) body=`
    <h2>Informações principais</h2>
    <div class="field"><label>Título *</label><input id="c-title" class="input" value="${esc(c.title)}" placeholder="Ex.: Aula de inglês para iniciantes"></div>
    <div class="field"><label>Descrição detalhada *</label><textarea id="c-desc" placeholder="Descreva sua oferta ou solicitação...">${esc(c.description)}</textarea></div>
    <div class="grid2">
      <div class="field"><label>Categoria *</label><select id="c-cat">${CATEGORIES.map(x=>`<option ${c.category===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Modalidade *</label><select id="c-mod"><option value="online" ${c.modality==='online'?'selected':''}>Online</option><option value="presencial" ${c.modality==='presencial'?'selected':''}>Presencial</option><option value="ambas" ${c.modality==='ambas'?'selected':''}>Ambas</option></select></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Disponibilidade</label><input id="c-avail" class="input" value="${esc(c.availability)}" placeholder="Ex.: Sábados às 10h"></div>
      <div class="field"><label>Localidade (se presencial)</label><input id="c-loc" class="input" value="${esc(c.location)}" placeholder="Ex.: Jardim Aurora"></div>
    </div>`;
  if(ui.createStep===3) body=`
    <h2>Informações de tempo</h2>
    <div class="readme">No Colabre, o tempo é nossa unidade de troca. Cada hora de contribuição equivale a um crédito.</div>
    <div class="field" style="margin-top:12px"><label>Tempo estimado *</label>
    <select id="c-dur">${[0.5,1,1.5,2,3].map(v=>`<option value="${v}" ${c.durationHours===v?'selected':''}>${fmtHoursDesc(v)} (${fmtCredits(v)} crédito${v==1?'':'s'})</option>`).join('')}</select></div>
    <p class="kv">30 minutos = 0,5 crédito · 1 hora = 1 crédito · 2 horas = 2 créditos</p>`;
  if(ui.createStep===4) body=`
    <h2>Revisão</h2>
    <div class="review">
      <div class="inline"><span class="badge ${c.type==='offer'?'badge-offer':'badge-request'}">${c.type==='offer'?'OFERTA DE AJUDA':'SOLICITAÇÃO DE AJUDA'}</span><span class="badge badge-cat">${esc(c.category)}</span></div>
      <h3 style="margin:8px 0">${esc(c.title||'(sem título)')}</h3><p class="text-muted">${esc(c.description||'')}</p>
      <div class="opp-meta"><span class="meta">⏱ ${fmtHoursDesc(c.durationHours)}</span><span class="meta">${c.modality}</span><span class="meta">📍 ${esc(c.location||'Online')}</span><span class="meta">${esc(c.availability||'')}</span></div>
    </div>`;
  return layout(`
  <div class="page-head"><h1>Criar oportunidade</h1><p>Etapa ${ui.createStep} de 4 · Os dados ficam salvos nesta tela até você voltar.</p></div>
  <div class="card">
    <div class="steps">${steps.map((s,i)=>`<div class="step ${ui.createStep===i+1?'active':''}">${i+1}. ${s}</div>`).join('')}</div>
    ${body}
    <div class="inline" style="margin-top:16px">
      ${ui.createStep>1?'<button class="btn btn-outline" data-action="step-back">Voltar</button>':''}
      <span style="flex:1"></span>
      ${ui.createStep<4?'<button class="btn btn-accent" data-action="step-next">Continuar</button>':'<button class="btn btn-accent" data-action="publish">Publicar oportunidade</button>'}
    </div>
  </div>`);
}
function readCreateForm(){
  const c=ui.create;
  if(ui.createStep===2){ c.title=$('#c-title')?.value.trim()||c.title; c.description=$('#c-desc')?.value.trim()||c.description; c.category=$('#c-cat')?.value||c.category; c.modality=$('#c-mod')?.value||c.modality; c.availability=$('#c-avail')?.value.trim()||c.availability; c.location=$('#c-loc')?.value.trim()||c.location; }
  if(ui.createStep===3){ c.durationHours=parseFloat($('#c-dur')?.value||c.durationHours); }
}
function validateStep(){
  readCreateForm();
  if(ui.createStep===2){ if(ui.create.title.length<6){toast('Informe um título com pelo menos 6 caracteres.','error');return false;} if(ui.create.description.length<15){toast('Descreva com um pouco mais de detalhes (15+ caracteres).','error');return false;} }
  return true;
}
function publishOpp(){
  const c=ui.create;
  const o={id:uid('o'),ownerId:db.currentUserId,type:c.type,title:c.title,description:c.description,category:c.category,modality:c.modality,durationHours:c.durationHours,availability:c.availability||'A combinar',location:c.location||(c.modality==='online'?'Online':'A combinar'),publishedAt:new Date().toISOString().slice(0,10),status:'published'};
  db.opportunities.unshift(o); saveDB(db);
  ui.create={type:'offer',title:'',description:'',category:'Educação',modality:'online',durationHours:1,availability:'',location:''}; ui.createStep=1;
  toast('Oportunidade publicada com sucesso!'); go('oportunidade',o.id);
}

/* ---------- Minhas atividades ---------- */
const STATUS_LABEL={interesse:'Aguardando resposta',confirmada:'Confirmada',realizada:'Em andamento',concluida:'Concluída',cancelada:'Cancelada',publicada:'Publicada'};
function activityCard(a){
  const opp=db.opportunities.find(o=>o.id===a.oppId)||{title:'(oportunidade removida)',type:'offer'};
  const otherId = a.ownerId===db.currentUserId ? a.interestedId : a.ownerId; const other=userById(otherId);
  const iAmOwner = a.ownerId===db.currentUserId;
  const mine = iAmOwner || a.interestedId===db.currentUserId;
  let actions='';
  if(a.status==='interesse' && iAmOwner) actions=`<button class="btn btn-accent btn-sm" data-action="accept" data-id="${a.id}">Aceitar e confirmar</button> <button class="btn btn-outline btn-sm" data-action="cancel-act" data-id="${a.id}">Recusar</button>`;
  if(a.status==='confirmada' && mine) actions+=`<button class="btn btn-primary btn-sm" data-action="mark-done" data-id="${a.id}">Marcar como realizada</button>`;
  if(a.status==='realizada' && mine && !a[ iAmOwner?'ownerConfirmed':'interestedConfirmed']) actions+=`<button class="btn btn-accent btn-sm" data-action="confirm-hours" data-id="${a.id}">Confirmar horas (${fmtHoursDesc(a.plannedHours)})</button>`;
  if(a.status==='concluida' && mine && !a.rated) actions+=`<button class="btn btn-outline btn-sm" data-action="rate" data-id="${a.id}">Avaliar experiência</button>`;
  if(['interesse','confirmada'].includes(a.status) && mine) actions+=`<button class="btn btn-outline btn-sm" data-action="cancel-act" data-id="${a.id}">Cancelar</button>`;
  return `<article class="opp-card">
    <div class="inline"><span class="badge ${opp.type==='offer'?'badge-offer':'badge-request'}">${opp.type==='offer'?'Oferta':'Solicitação'}</span><span class="badge badge-status">${STATUS_LABEL[a.status]||a.status}</span><span class="badge badge-cat">${a.credited?'Créditos movimentados':'Créditos pendentes'}</span></div>
    <h3>${esc(opp.title)}</h3>
    ${avatarName(other)}<div class="kv">${iAmOwner?'Você publicou · ':'Você demonstrou interesse · '} ${fmtDate(a.createdAt)}</div>
    <div class="opp-meta"><span class="meta">⏱ ${fmtHoursDesc(a.plannedHours)}</span><span class="meta">${fmtCredits(a.plannedHours)} créditos</span><span class="meta">Confirmações: ${a.ownerConfirmed?'✓ dono':'—'} ${a.interestedConfirmed?'✓ interesse':'—'}</span></div>
    ${a.note?`<p class="small text-muted">${esc(a.note)}</p>`:''}
    <div class="inline">${actions}<span style="flex:1"></span><button class="btn btn-ghost btn-sm" data-action="opp-detail" data-id="${opp.id||''}">Detalhes</button></div>
    ${ui.evalFor===a.id?ratingForm(a.id):''}
  </article>`;
}
function ratingForm(aid){
  return `<div class="review" style="margin-top:10px"><h3>Avalie a experiência</h3>
  <div class="rate" id="stars">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" aria-label="${n} estrelas">★</button>`).join('')}</div>
  <div class="field"><label>Comentário (opcional)</label><textarea id="rate-comment" placeholder="Como foi a comunicação e a colaboração?"></textarea></div>
  <button class="btn btn-primary btn-sm" data-action="submit-rate" data-id="${aid}">Enviar avaliação</button></div>`;
}
function myActivities(){
  const uid2=db.currentUserId;
  const mine=db.activities.filter(a=>a.ownerId===uid2||a.interestedId===uid2);
  const myOpps=db.opportunities.filter(o=>o.ownerId===uid2).map(o=>({id:'opp_'+o.id, oppId:o.id, ownerId:uid2, interestedId:'', status:'publicada', plannedHours:o.durationHours, createdAt:o.publishedAt, note:o.description, published:true}));
  return {acts:mine, opps:myOpps};
}
function renderActivities(){
  const {acts,opps}=myActivities(); const tab=ui.activityTab;
  let list=acts;
  if(tab==='offer') list=acts.filter(a=>{const o=db.opportunities.find(x=>x.id===a.oppId);return o&&o.type==='offer'&&a.ownerId===db.currentUserId;});
  if(tab==='request') list=acts.filter(a=>{const o=db.opportunities.find(x=>x.id===a.oppId);return o&&o.type==='request'&&a.ownerId===db.currentUserId;});
  if(tab==='andamento') list=acts.filter(a=>['interesse','confirmada','realizada'].includes(a.status));
  if(tab==='concluidas') list=acts.filter(a=>a.status==='concluida');
  const tabs=[['todas','Todas'],['offer','Oferecendo ajuda'],['request','Solicitando ajuda'],['andamento','Em andamento'],['concluidas','Concluídas']];
  return layout(`
  <div class="page-head"><h1>Minhas atividades</h1><p>Acompanhe ofertas, solicitações e trocas confirmadas.</p></div>
  <div class="tabs">${tabs.map(([k,l])=>`<button class="tab ${tab===k?'active':''}" data-action="tab" data-tab="${k}">${l}</button>`).join('')}</div>
  ${tab==='todas'&&opps.length?`<h2 style="margin-bottom:10px">Suas publicações</h2><div class="grid2" style="margin-bottom:18px">${opps.map(o=>{const opp=db.opportunities.find(x=>x.id===o.oppId);return oppCard(opp);}).join('')}</div>`:''}
  ${list.length?`<h2 style="margin-bottom:10px">Trocas e participações (${list.length})</h2><div class="grid2">${list.map(activityCard).join('')}</div>`:
    `<div class="card empty"><div class="big">🗓️</div><h3>Nenhuma atividade aqui</h3><p>Explore oportunidades para começar a trocar tempo.</p><a class="btn btn-accent" href="#/explorar">Explorar oportunidades</a></div>`}
  `,'atividades');
}

/* ---------- Projetos ---------- */
function renderProjects(){
  const f=ui.proj; const list=filterProjects(db.projects,f);
  const locs=[...new Set(db.projects.map(p=>p.location))];
  return layout(`
  <div class="page-head inline" style="align-items:flex-start"><div style="flex:1"><h1>Juntos podemos fazer mais.</h1><p>Descubra projetos comunitários e encontre uma maneira de contribuir.</p></div><a class="btn btn-accent" href="#/criar-projeto">Criar projeto</a></div>
  <div class="filters"><div class="toolbar"><div class="grow"><input class="input" id="q-proj" placeholder="Buscar projeto..." value="${esc(f.q)}" aria-label="Buscar projetos"></div></div>
    <div class="row">
      <div class="field" style="margin:0"><label>Categoria</label><select id="p-cat"><option value="todas">Todas</option>${PROJ_CATEGORIES.map(c=>`<option ${f.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>Localidade</label><select id="p-loc"><option value="todas">Todas</option>${locs.map(c=>`<option ${f.location===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>Status</label><select id="p-stat"><option value="todas">Todos</option>${['Ativo','Concluindo','Concluído'].map(c=>`<option ${f.status===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <label class="inline small" style="gap:6px"><input type="checkbox" id="p-needs" ${f.onlyNeeds?'checked':''}> Só quem precisa de voluntários</label>
    </div></div>
  ${list.length?`<div class="grid3">${list.map(projCard).join('')}</div>`:`<div class="card empty"><div class="big">🌱</div><h3>Nenhum projeto encontrado</h3><p>Ajuste os filtros ou crie um novo projeto.</p></div>`}
  <div style="margin-top:16px;text-align:center"><a class="btn btn-accent" href="#/criar-projeto">Criar projeto</a></div>
  `,'projetos');
}
function renderProjectDetail(id){
  const p=db.projects.find(x=>x.id===id); if(!p) return renderProjects();
  const {pct,remaining}=projectProgress(p); const owner=userById(p.ownerId); const isPart=p.participants.includes(db.currentUserId); const isOwner=p.ownerId===db.currentUserId;
  return layout(`
  <button class="btn btn-ghost" data-action="back">← Voltar</button>
  <div class="two-col" style="margin-top:10px">
    <div class="stack">
      <div class="card" style="padding:0;overflow:hidden">
        <div class="proj-cover" style="background:linear-gradient(120deg,#4F8062,#3D5145);height:140px"><span class="cover-emoji">🌱</span></div>
        <div style="padding:18px">
          <div class="inline"><span class="badge badge-cat">${esc(p.category)}</span><span class="badge badge-status">${esc(p.status)}</span><span class="badge badge-status">${esc(p.visibility)}</span></div>
          <h1 style="margin:8px 0">${esc(p.title)}</h1><p class="text-muted">${esc(p.description)}</p>
          <h3>Objetivo</h3><p class="text-muted">${esc(p.objective)}</p>
          <div class="opp-meta"><span class="meta">📍 ${esc(p.location)}</span><span class="meta">Criado em ${fmtDate(p.createdAt)}</span><span class="meta">Início ${fmtDate(p.startDate)}</span><span class="meta">👥 ${p.participants.length} participantes</span></div>
          <div class="kv">Responsável: <strong>${esc(owner.name)}</strong></div>
        </div>
      </div>
      <div class="card"><h3>Progresso</h3>
        <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>
        <div class="kv">${fmtCredits(p.contributedHours)}h contribuídas · meta ${fmtCredits(p.goalHours)}h · faltam ${fmtCredits(remaining)}h · ${pct}% da meta</div>
        <div class="grid4" style="margin-top:12px">
          <div class="card"><strong>${fmtCredits(p.contributedHours)}h</strong><div class="kv">Contribuídas</div></div>
          <div class="card"><strong>${p.participants.length}</strong><div class="kv">Participantes</div></div>
          <div class="card"><strong>${p.needs.length}</strong><div class="kv">Necessidades</div></div>
          <div class="card"><strong>${p.updates.length}</strong><div class="kv">Atualizações</div></div>
        </div>
      </div>
      <div class="card"><h3>Precisamos de pessoas que possam ajudar com:</h3><ul>${p.needs.map(n=>`<li>${esc(n.title)} <span class="kv">(${fmtCredits(n.hours)}h)</span></li>`).join('')}</ul><div class="chips">${(p.skillsNeeded||[]).map(s=>`<span class="badge badge-cat">${esc(s)}</span>`).join('')}</div></div>
      <div class="card"><h3>Participantes</h3><div class="chips">${p.participants.map(uid2=>{const u=userById(uid2);return `<span class="badge badge-status">${avatar(u)} ${esc(u.name)}</span>`;}).join('')}</div></div>
      <div class="card"><h3>Atualizações</h3><ul class="timeline">${p.updates.map(u=>`<li>${esc(u.text)}<div class="kv">${fmtDate(u.date)}</div></li>`).join('')}</ul></div>
    </div>
    <div class="card stack">
      <h3>Participar</h3>
      ${isPart?'<button class="btn btn-primary btn-block" disabled>Você já participa</button>':`<button class="btn btn-accent btn-block" data-action="join-proj" data-id="${p.id}">Participar do projeto</button>`}
      ${isOwner?`<button class="btn btn-outline btn-block" data-action="add-update" data-id="${p.id}">Registrar atualização</button><p class="kv">Responsável: você pode registrar horas confirmadas dos participantes.</p>`:'<p class="kv">Ao participar, suas horas confirmadas compõem o progresso do projeto.</p>'}
    </div>
  </div>`);
}
function renderCreateProject(){
  return layout(`
  <div class="page-head"><h1>Criar projeto comunitário</h1><p>Organize uma iniciativa e mobilize sua comunidade.</p></div>
  <div class="card"><form id="proj-form" novalidate>
    <div class="grid2">
      <div class="field"><label>Nome do projeto *</label><input id="pj-title" class="input" placeholder="Ex.: Revitalização da praça"></div>
      <div class="field"><label>Categoria *</label><select id="pj-cat">${PROJ_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Descrição *</label><textarea id="pj-desc" placeholder="O que será feito? Quem se beneficia?"></textarea></div>
    <div class="field"><label>Objetivo principal *</label><textarea id="pj-obj" placeholder="Objetivo da iniciativa"></textarea></div>
    <div class="grid2">
      <div class="field"><label>Localidade *</label><input id="pj-loc" class="input" placeholder="Ex.: Jardim Aurora"></div>
      <div class="field"><label>Data prevista de início *</label><input id="pj-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Meta de horas *</label><input id="pj-goal" type="number" min="1" value="40"></div>
      <div class="field"><label>Participantes esperados</label><input id="pj-part" type="number" min="1" value="10"></div>
    </div>
    <div class="field"><label>Habilidades necessárias (separadas por vírgula)</label><input id="pj-skills" class="input" placeholder="Jardinagem, Pintura, Organização"></div>
    <div class="field"><label>Visibilidade</label><select id="pj-vis"><option value="aberto">Aberto a todos</option><option value="local">Comunidade local</option><option value="convite">Convite restrito (simulado)</option></select></div>
    <p class="error" id="pj-error"></p>
    <div class="review" id="pj-preview"><h3>Prévia</h3><div id="pj-preview-body" class="text-muted small">Preencha os campos para ver a prévia.</div></div>
    <div class="inline" style="margin-top:14px"><button class="btn btn-accent" type="submit">Criar projeto</button><a class="btn btn-outline" href="#/projetos">Cancelar</a></div>
  </form></div>
  `,'projetos');
}

/* ---------- Carteira ---------- */
function renderWallet(){
  const u=me(); const bal=getBalance(db,u.id); const s=getStats(db,u.id);
  const txs=[...db.transactions.filter(t=>t.userId===u.id)].sort((a,b)=>b.date.localeCompare(a.date));
  return layout(`
  <div class="page-head"><h1>Carteira de tempo</h1><p>Seus créditos representam tempo contribuído — não dinheiro.</p></div>
  <div class="banner"><div><div class="small" style="color:#D9E3DB">Seu tempo disponível</div><div class="big">${fmtCredits(bal)} crédito${bal==1?'':'s'}</div><div class="small">Equivalente a ${fmtHoursDesc(bal)} disponíveis para compartilhar e receber ajuda.</div></div><div style="font-size:44px">⏰</div></div>
  <div class="grid4" style="margin-top:14px">
    <div class="card"><strong>+${fmtCredits(s.received)}</strong><div class="kv">Créditos recebidos</div></div>
    <div class="card"><strong>−${fmtCredits(s.used)}</strong><div class="kv">Créditos utilizados</div></div>
    <div class="card"><strong>${fmtCredits(u.hoursShared||0)}h</strong><div class="kv">Horas oferecidas</div></div>
    <div class="card"><strong>${fmtCredits((u.hoursShared||0)-(bal>0?bal:0))}h</strong><div class="kv">Horas recebidas (estim.)</div></div>
  </div>
  <h2 style="margin:20px 0 10px">Histórico</h2>
  <div class="card" style="overflow:auto">
    ${txs.length?`<table class="table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Data</th><th>Quantidade</th><th>Saldo após</th></tr></thead><tbody>
    ${txs.map(t=>`<tr><td>${t.amount>0?'<span class="badge badge-green">Recebido</span>':t.amount<0?'<span class="badge badge-red">Utilizado</span>':'<span class="badge badge-status">Saldo</span>'}</td><td>${esc(t.description)}</td><td>${fmtDate(t.date)}</td><td><strong>${t.amount>0?'+':'−'}${fmtCredits(Math.abs(t.amount))}</strong></td><td>${fmtCredits(t.balanceAfter)}</td></tr>`).join('')}
    </tbody></table>`: `<div class="empty"><div class="big">⏰</div><h3>Sem movimentações ainda</h3><p>Ofereça ou solicite ajuda para começar a trocar tempo.</p></div>`}
  </div>
  <div class="readme" style="margin-top:14px"><strong>Regras:</strong> 1 hora = 1 crédito · meia hora = meio crédito · sem compra ou venda · sem saldo negativo · a movimentação só ocorre após a conclusão e a confirmação mútua. Se apenas uma pessoa confirmar, o status fica como “Aguardando confirmação”.</div>
  `,'carteira');
}

/* ---------- Perfil ---------- */
function levelIndex(u){ const i=LEVELS.indexOf(u.level||'Iniciante'); return i>=0?i:0; }
function renderProfile(){
  const u=me(); const li=levelIndex(u);
  const myProjs=db.projects.filter(p=>p.participants.includes(u.id));
  return layout(`
  <div class="page-head"><h1>Meu perfil</h1><p>Sua identidade e trajetória de colaboração.</p></div>
  <div class="two-col">
    <div class="stack">
      <div class="card">
        <div class="userrow">${avatar(u,'avatar-lg')}<div><h2>${esc(u.name)}</h2><div class="kv">${esc(u.location)} · na plataforma desde ${fmtDate(u.joinedAt)} · disponibilidade: ${esc(u.availability||'')}</div><p class="text-muted small" style="margin:6px 0 0">${esc(u.bio)}</p></div></div>
        <div class="grid4" style="margin-top:14px">
          <div class="card"><strong>${fmtCredits(u.hoursShared||0)}h</strong><div class="kv">Horas contribuídas</div></div>
          <div class="card"><strong>${u.activitiesCompleted||0}</strong><div class="kv">Atividades concluídas</div></div>
          <div class="card"><strong>${u.peopleHelped||0}</strong><div class="kv">Pessoas ajudadas</div></div>
          <div class="card"><strong>${u.ratingAvg?u.ratingAvg.toFixed(1):'—'} ★</strong><div class="kv">Avaliação média (${u.ratingsCount||0})</div></div>
        </div>
      </div>
      <div class="card"><h3>Habilidades</h3><div class="chips">${(u.skills||[]).map(s=>`<span class="badge badge-cat">${esc(s)}</span>`).join('')||'<span class="kv">Nenhuma habilidade cadastrada.</span>'}</div>
      <div class="toolbar"><input id="new-skill" class="input" placeholder="Nova habilidade" aria-label="Nova habilidade"><button class="btn btn-outline btn-sm" data-action="add-skill">Adicionar</button></div></div>
      <div class="card"><h3>Níveis de participação</h3><p class="kv">O nível considera atividades concluídas, consistência e avaliações — não apenas o saldo. Níveis altos não autorizam automaticamente atividades sensíveis.</p><div class="levels">${LEVELS.map((l,i)=>`<span class="level-chip ${i===li?'cur':''}">${i+1}. ${l}${i===li?' ✓':''}</span>`).join('')}</div></div>
      <div class="card"><h3>Projetos participantes (${myProjs.length})</h3><div class="stack">${myProjs.map(p=>`<div class="inline"><strong>${esc(p.title)}</strong><span class="kv">${fmtCredits(p.contributedHours)}/${fmtCredits(p.goalHours)}h</span><span style="flex:1"></span><button class="btn btn-outline btn-sm" data-action="proj-detail" data-id="${p.id}">Ver</button></div>`).join('')||'<span class="kv">Você ainda não participa de projetos.</span>'}</div></div>
    </div>
    <div class="card">
      <h3>${ui.editMode?'Editar perfil':'Editar perfil'}</h3>
      <form id="profile-form">
        <div class="field"><label>Nome de exibição</label><input id="pf-name" class="input" value="${esc(u.name)}"></div>
        <div class="field"><label>Localidade aproximada (sem endereço)</label><input id="pf-loc" class="input" value="${esc(u.location)}"></div>
        <div class="field"><label>Biografia</label><textarea id="pf-bio">${esc(u.bio)}</textarea></div>
        <div class="field"><label>Disponibilidade</label><input id="pf-avail" class="input" value="${esc(u.availability||'')}"></div>
        <button class="btn btn-accent btn-block" type="submit">Salvar alterações</button>
      </form>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
      <button class="btn btn-outline btn-block" data-action="logout">Sair da conta</button>
    </div>
  </div>
  `,'perfil');
}

/* ---------- Notificações ---------- */
function renderNotifications(){
  const u=me(); const list=[...db.notifications.filter(n=>n.userId===u.id)].sort((a,b)=>b.date.localeCompare(a.date));
  return layout(`
  <div class="page-head inline"><div style="flex:1"><h1>Notificações</h1><p>Acompanhe interesses, confirmações e créditos.</p></div><button class="btn btn-outline" data-action="read-all">Marcar todas como lidas</button></div>
  <div class="card" style="padding:0;overflow:hidden">
    ${list.length?list.map(n=>`<div class="note-item ${n.read?'':'unread'}"><div style="flex:1"><strong>${esc(n.title)}</strong><div class="text-muted small">${esc(n.message)}</div><div class="kv">${fmtDate(n.date)}</div></div><div class="inline"><button class="btn btn-outline btn-sm" data-action="open-note" data-id="${n.id}">Abrir</button>${n.read?'':'<button class="btn btn-ghost btn-sm" data-action="read-note" data-id="'+n.id+'">Marcar lida</button>'}</div></div>`).join(''):
    `<div class="empty"><div class="big">🔔</div><h3>Sem notificações</h3><p>Quando alguém tiver interesse ou você receber créditos, avisaremos aqui.</p></div>`}
  </div>`,'notificacoes');
}

/* ---------- Config ---------- */
function renderConfig(){
  return layout(`
  <div class="page-head"><h1>Configurações</h1><p>Gestão demonstrativa da conta e dos dados.</p></div>
  <div class="card stack">
    <div><strong>Demonstração</strong><p class="text-muted small">Os dados são salvos apenas no seu navegador (localStorage). Não trate o localStorage como lugar seguro para dados sensíveis.</p></div>
    <div class="inline"><button class="btn btn-outline" data-action="reset">Restaurar dados demonstrativos iniciais</button></div>
    <hr style="border:none;border-top:1px solid var(--border)">
    <div class="inline"><button class="btn btn-outline" data-action="logout">Sair da conta</button></div>
  </div>`,'config');
}

/* ---------- Router ---------- */
function render(){
  const {view,id}=parseRoute();
  if(view==='login'||!db.currentUserId){ if(db.currentUserId) go('dashboard'); else { renderAuth(); return; } }
  window.scrollTo(0,0);
  const map={dashboard:renderDashboard,explorar:renderExplore,criar:renderCreate,atividades:renderActivities,projetos:renderProjects,'criar-projeto':renderCreateProject,carteira:renderWallet,perfil:renderProfile,notificacoes:renderNotifications,config:renderConfig};
  if(view==='oportunidade'){$('#root').innerHTML=renderOppDetail(id);return;}
  if(view==='projeto'){$('#root').innerHTML=renderProjectDetail(id);return;}
  const fn=map[view]||renderDashboard;
  $('#root').innerHTML=fn();
  bindView(view);
}
function bindView(view){
  if(view==='explorar'){
    const sync=()=>{ ui.explore={q:$('#q-exp').value,type:$('#f-type').value,category:$('#f-cat').value,modality:$('#f-mod').value,duration:$('#f-dur').value,sort:$('#f-sort').value}; render(); const el=$('#q-exp'); el.focus(); el.setSelectionRange(el.value.length,el.value.length); };
    $('#q-exp').addEventListener('input',sync);
    ['f-type','f-cat','f-mod','f-dur','f-sort'].forEach(x=>$('#'+x).addEventListener('change',sync));
  }
  if(view==='projetos'){
    const sync=()=>{ ui.proj={q:$('#q-proj').value,category:$('#p-cat').value,location:$('#p-loc').value,status:$('#p-stat').value,onlyNeeds:$('#p-needs').checked}; render(); const el=$('#q-proj'); el.focus(); el.setSelectionRange(el.value.length,el.value.length); };
    $('#q-proj').addEventListener('input',sync);
    ['p-cat','p-loc','p-stat','p-needs'].forEach(x=>$('#'+x).addEventListener('change',sync));
  }
  if(view==='criar-projeto'){
    const upd=()=>{ const t=$('#pj-title').value; $('#pj-preview-body').innerHTML = t?`<strong>${esc(t)}</strong> · ${esc($('#pj-cat').value)} · ${esc($('#pj-loc').value)} · meta ${esc($('#pj-goal').value)}h`:'Preencha os campos para ver a prévia.'; };
    ['pj-title','pj-cat','pj-loc','pj-goal'].forEach(x=>$('#'+x).addEventListener('input',upd)); upd();
    $('#proj-form').addEventListener('submit',e=>{
      e.preventDefault();
      const title=$('#pj-title').value.trim(), desc=$('#pj-desc').value.trim(), obj=$('#pj-obj').value.trim(), loc=$('#pj-loc').value.trim();
      if(title.length<5||desc.length<15||obj.length<10){$('#pj-error').textContent='Preencha nome, descrição (15+) e objetivo (10+).';return;}
      const p={id:uid('p'),ownerId:db.currentUserId,title,description:desc,objective:obj,category:$('#pj-cat').value,location:loc,startDate:$('#pj-date').value||new Date().toISOString().slice(0,10),createdAt:new Date().toISOString().slice(0,10),goalHours:parseFloat($('#pj-goal').value)||40,contributedHours:0,expectedParticipants:parseInt($('#pj-part').value)||10,skillsNeeded:$('#pj-skills').value.split(',').map(s=>s.trim()).filter(Boolean),needs:[{title:'Organização',hours:10},{title:'Divulgação',hours:5}],participants:[db.currentUserId],status:'Ativo',visibility:$('#pj-vis').value,updates:[{date:new Date().toISOString().slice(0,10),text:'Projeto criado e aberto à comunidade.'}]};
      db.projects.unshift(p); saveDB(db); toast('Projeto criado com sucesso!'); go('projeto',p.id);
    });
  }
  if(view==='perfil'){
    $('#profile-form').addEventListener('submit',e=>{
      e.preventDefault(); const u=me();
      u.name=$('#pf-name').value.trim()||u.name; u.firstName=u.name.split(' ')[0]; u.location=$('#pf-loc').value.trim(); u.bio=$('#pf-bio').value.trim(); u.availability=$('#pf-avail').value.trim(); saveDB(db); toast('Perfil atualizado!'); render();
    });
  }
}

/* ---------- Ações globais ---------- */
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action]'); if(!el) return;
  const a=el.dataset.action, id=el.dataset.id;
  const u=me();
  if(a==='notif'){ go('notificacoes'); return; }
  if(a==='theme'){ toggleTheme(); render(); return; }
  if(a==='logout'){ logout(); return; }
  if(a==='demo'){ db.currentUserId='u1'; saveDB(db); location.hash='#/dashboard'; render(); return; }
  if(a==='visitor'){ db.currentUserId='u1'; saveDB(db); location.hash='#/dashboard'; render(); toast('Você entrou como visitante (Marina Santos).'); return; }
  if(a==='back'){ history.back(); return; }
  if(a==='opp-detail'){ go('oportunidade',id); return; }
  if(a==='proj-detail'){ go('projeto',id); return; }
  if(a==='clear-filters'){ ui.explore={q:'',type:'todas',category:'todas',modality:'todas',duration:'todas',sort:'recentes'}; render(); return; }
  if(a==='interest'){
    const opp=db.opportunities.find(o=>o.id===id); if(!opp) return;
    const owner=userById(opp.ownerId);
    confirmModal({title:'Confirmar interesse',message:`Você demonstra interesse em "${opp.title}"? A atividade só será confirmada após o aceite de ${owner.name}.`,confirmLabel:'Confirmar interesse',onConfirm:()=>{
      db.activities.push({id:uid('a'),oppId:id,ownerId:opp.ownerId,interestedId:u.id,status:'interesse',plannedHours:opp.durationHours,confirmedHours:0,ownerConfirmed:false,interestedConfirmed:false,credited:false,createdAt:new Date().toISOString().slice(0,10),note:'Interesse demonstrado.'});
      notify(db,opp.ownerId,'Novo interesse',`${u.name} demonstrou interesse em "${opp.title}".`,{view:'atividades'});
      saveDB(db); toast('Interesse enviado! Aguardando resposta.'); render();
    }});
    return;
  }
  if(a==='accept'){ const act=db.activities.find(x=>x.id===id); act.status='confirmada'; notify(db,act.interestedId,'Atividade confirmada',`Sua participação em "${db.opportunities.find(o=>o.id===act.oppId).title}" foi confirmada.`,{view:'atividades'}); saveDB(db); toast('Atividade confirmada!'); render(); return; }
  if(a==='mark-done'){ const act=db.activities.find(x=>x.id===id); act.status='realizada'; saveDB(db); toast('Marcada como realizada. Agora confirme as horas.'); render(); return; }
  if(a==='confirm-hours'){ const act=db.activities.find(x=>x.id===id); const iAmOwner=act.ownerId===u.id; act[iAmOwner?'ownerConfirmed':'interestedConfirmed']=true; act.confirmedHours=act.plannedHours;
    if(act.ownerConfirmed&&act.interestedConfirmed){ act.status='concluida'; const ok=settleActivity(db,act); if(ok){ notify(db,act.ownerId,'Créditos movimentados','A atividade foi concluída e os créditos foram movimentados.',{view:'carteira'}); notify(db,act.interestedId,'Créditos movimentados','A atividade foi concluída e os créditos foram movimentados.',{view:'carteira'}); } }
    saveDB(db); toast(act.status==='concluida'?'Concluída! Créditos movimentados.':'Confirmação registrada. Aguardando a outra pessoa.'); render(); return; }
  if(a==='cancel-act'){ const act=db.activities.find(x=>x.id===id); act.status='cancelada'; saveDB(db); toast('Atividade cancelada.'); render(); return; }
  if(a==='tab'){ ui.activityTab=el.dataset.tab; render(); return; }
  if(a==='set-type'){ readCreateForm(); ui.create.type=el.dataset.type; render(); return; }
  if(a==='step-back'){ readCreateForm(); ui.createStep--; render(); return; }
  if(a==='step-next'){ if(!validateStep()) return; ui.createStep++; render(); return; }
  if(a==='publish'){ readCreateForm(); if(ui.create.title.length<6||ui.create.description.length<15){toast('Revise título e descrição.','error');return;} publishOpp(); return; }
  if(a==='join-proj'){ const p=db.projects.find(x=>x.id===id); if(p.participants.includes(u.id)){toast('Você já participa.');return;} p.participants.push(u.id); p.updates.push({date:new Date().toISOString().slice(0,10),text:`${u.name} entrou para o projeto.`}); notify(db,p.ownerId,'Novo participante',`${u.name} entrou em "${p.title}".`,{view:'projeto',id:p.id}); saveDB(db); toast('Bem-vindo(a) ao projeto!'); render(); return; }
  if(a==='add-update'){ const p=db.projects.find(x=>x.id===id); const txt=prompt('Nova atualização:'); if(!txt) return; p.updates.push({date:new Date().toISOString().slice(0,10),text:txt}); const add=parseFloat(prompt('Horas confirmadas nesta etapa (0 para só atualizar):')||'0'); if(add>0){ p.contributedHours=Math.round((p.contributedHours+add)*10)/10; const {pct}=projectProgress(p); if(pct>=100) p.status='Concluído'; else if(pct>=70) p.status='Concluindo'; } saveDB(db); toast('Atualização registrada!'); render(); return; }
  if(a==='add-skill'){ const s=$('#new-skill').value.trim(); if(!s) return; u.skills.push(s); saveDB(db); toast('Habilidade adicionada!'); render(); return; }
  if(a==='read-note'){ db.notifications.find(n=>n.id===id).read=true; saveDB(db); render(); return; }
  if(a==='read-all'){ db.notifications.filter(n=>n.userId===u.id).forEach(n=>n.read=true); saveDB(db); toast('Todas marcadas como lidas.'); render(); return; }
  if(a==='open-note'){ const n=db.notifications.find(x=>x.id===id); n.read=true; saveDB(db); go(n.link.view,n.link.id); return; }
  if(a==='reset'){ confirmModal({title:'Restaurar dados?',message:'Isto apaga alterações e restaura os dados demonstrativos iniciais.',confirmLabel:'Restaurar',onConfirm:()=>{ db=resetDB(); location.hash='#/login'; render(); toast('Dados restaurados.'); }}); return; }
  if(a==='rate'){ ui.evalFor=id; render(); const b=document.querySelector('[data-star="3"]'); if(b) b.classList.add('on'); return; }
});
document.addEventListener('click',e=>{ const s=e.target.closest('[data-star]'); if(!s) return; const n=+s.dataset.star; $$('[data-star]').forEach(b=>b.classList.toggle('on',+b.dataset.star<=n)); s.dataset.val=n; });
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action="submit-rate"]'); if(!b) return;
  const act=db.activities.find(x=>x.id===b.dataset.id); const stars=document.querySelectorAll('.rate button.on').length||3; const comment=$('#rate-comment')?.value.trim()||'';
  act.rated=true; act.rating={stars,comment};
  const otherId=act.ownerId===me().id?act.interestedId:act.ownerId; const other=userById(otherId);
  other.ratingsCount=(other.ratingsCount||0)+1; other.ratingAvg=Math.round(((other.ratingAvg||0)*(other.ratingsCount-1)+stars)*10)/10;
  ui.evalFor=null; saveDB(db); toast('Avaliação enviada! Obrigado.'); render();
});
$('#modal-cancel').addEventListener('click',closeModal);
$('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });
window.addEventListener('hashchange',render);
render();

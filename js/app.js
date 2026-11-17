/* Colabre — App (SPA em Vanilla JS)
   Dados oficiais vêm da API/servidor. O navegador guarda apenas tema e preferências. */
import { api, errorMessage } from './api.js';
import { $, $$, esc, fmtDate, fmtCredits, fmtHoursDesc, toast, confirmModal, closeModal } from './modules/utils.js';
import { getBalance, getStats } from './modules/credits.js';
import { filterOpportunities } from './modules/opportunities.js';
import { projectProgress, filterProjects } from './modules/projects.js';
import { demoView, demoAction } from './demo.js?v=3';

const VISITOR_USER = {
  id: 'u9', name: 'Visitante', firstName: 'Visitante', email: '', color: '#64748B',
  bio: 'Você está explorando o Colabre como visitante. Entre para participar.',
  location: 'Modo visitante', availability: '', skills: [], hoursShared: 0,
  activitiesCompleted: 0, peopleHelped: 0, ratingAvg: 0, ratingsCount: 0,
  joinedAt: '', level: 'Iniciante', levelIndex: 0, isVisitor: true,
};
const EMPTY_DB = {
  users: [], opportunities: [], projects: [], activities: [], transactions: [],
  notifications: [], chats: [], connections: [], ratings: [], me: null,
  currentUserId: VISITOR_USER.id, invite: null, serverNow: new Date().toISOString(),
};
let db = { ...EMPTY_DB };
let serverOffset = 0;
let refreshing = false;

function applyState(payload) {
  const st = payload && payload.state ? payload.state : EMPTY_DB;
  const meUser = st.me || null;
  const users = Array.isArray(st.users) ? [...st.users] : [];
  if (meUser && !users.some(u => u.id === meUser.id)) users.push(meUser);
  if (!meUser) users.push(VISITOR_USER);
  db = {
    ...EMPTY_DB, ...st,
    users: users.map(u => (meUser && u.id === meUser.id ? { ...u, ...meUser } : u)),
    me: meUser,
    currentUserId: meUser ? meUser.id : VISITOR_USER.id,
  };
  serverOffset = new Date(payload.serverNow || Date.now()).getTime() - Date.now();
}

async function loadState() {
  const payload = await api.state();
  applyState(payload);
  return payload;
}

async function refresh({ silent = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  try {
    await loadState();
    render();
  } catch (err) {
    if (!silent) toast(errorMessage(err), 'error');
  } finally {
    refreshing = false;
  }
}

function nowServer() { return Date.now() + serverOffset; }
function newId(prefix = 'id') { return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function unread(dbArg = db) { return (dbArg.notifications || []).filter(n => !n.read).length; }
const savedTheme = localStorage.getItem('colabre_theme');
if(savedTheme){ document.documentElement.setAttribute('data-theme', savedTheme); }
function toggleTheme(){ const isDark = document.documentElement.getAttribute('data-theme')==='dark'; document.documentElement.setAttribute('data-theme', isDark?'light':'dark'); localStorage.setItem('colabre_theme', isDark?'light':'dark'); }
const CATEGORIES = ['Educação','Tecnologia','Idiomas','Saúde e bem-estar','Artes e criatividade','Serviços domésticos','Esportes','Apoio comunitário','Outros'];
const PROJ_CATEGORIES = ['Meio ambiente','Educação','Inclusão social','Tecnologia','Cultura','Infraestrutura comunitária','Saúde e bem-estar','Outros'];
const LEVELS = ['Iniciante','Colaborador','Participante ativo','Referência comunitária','Embaixador'];

/* Banco de emojis para capa de projetos, organizado por categoria */
const PROJ_EMOJI_GROUPS = [
  { id:'natureza', label:'Natureza', emojis:['🌱','🌿','🍃','🌳','🌲','🌵','🪴','🌻','🌸','🌼','🌺','🌹','🍀','🍁','🌾','🌴','🌈','☀️','🌙','⭐','✨','🔥','💧','🌊'] },
  { id:'comunidade', label:'Comunidade', emojis:['🤝','🙌','🫶','❤️','💪','👥','👨‍👩‍👧','🏘️','🏡','🏫','🏛️','⛪','🏥','🚑','🚒','🧑‍🏫','🧑‍⚕️','🧑‍🌾','🧑‍🍳','🧑‍🔧','🧑‍🎨','🧑‍💻','🧑‍🚀','👶'] },
  { id:'comida', label:'Comida', emojis:['🍎','🍊','🍋','🍇','🍉','🍓','🫐','🥑','🥕','🥦','🌽','🥔','🍞','🥖','🧀','🥚','🍲','🍛','🍝','🍜','🍰','🍪','☕','🍵'] },
  { id:'animais', label:'Animais', emojis:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦉','🦋','🐝','🐢','🐬'] },
  { id:'atividades', label:'Atividades', emojis:['🎨','🖌️','🎭','🎬','🎵','🎶','🎸','🎹','🥁','⚽','🏀','🎾','🏐','🏓','🚴','🏃','🧘','🥋','🏊','⛺','🎲','🧩','🎯','🏆'] },
  { id:'objetos', label:'Objetos', emojis:['📚','📖','✏️','🖊️','📝','📐','🔬','🔭','💻','📱','🖥️','📷','🎥','🔧','🔨','🪚','🧰','🪛','💡','🔋','🌍','🗺️','🚀','🛠️'] },
];

/* Paleta de 16 cores para capa de projetos (versão clara / escura) */
const PROJ_COLORS = [
  { light:'#10B981', dark:'#059669', name:'Esmeralda' },
  { light:'#84CC16', dark:'#65A30D', name:'Lima' },
  { light:'#EAB308', dark:'#CA8A04', name:'Amarelo' },
  { light:'#F59E0B', dark:'#D97706', name:'Âmbar' },
  { light:'#F97316', dark:'#EA580C', name:'Laranja' },
  { light:'#FB7185', dark:'#E11D48', name:'Coral' },
  { light:'#EF4444', dark:'#DC2626', name:'Vermelho' },
  { light:'#EC4899', dark:'#DB2777', name:'Rosa' },
  { light:'#A855F7', dark:'#9333EA', name:'Violeta' },
  { light:'#8B5CF6', dark:'#7C3AED', name:'Roxo' },
  { light:'#6366F1', dark:'#4F46E5', name:'Índigo' },
  { light:'#3B82F6', dark:'#2563EB', name:'Azul' },
  { light:'#0EA5E9', dark:'#0284C7', name:'Céu' },
  { light:'#06B6D4', dark:'#0891B2', name:'Ciano' },
  { light:'#14B8A6', dark:'#0D9488', name:'Turquesa' },
  { light:'#64748B', dark:'#475569', name:'Grafite' },
];

/* Estado da capa no formulário de criação */
const coverState = { emoji:'🌱', color:0 };

/* Capa de projetos já existentes (sem emoji/cor salvos) */
const COVER_FALLBACKS = {
  p1:{ emoji:'🌳', light:'#16A34A', dark:'#15803D' },
  p2:{ emoji:'💻', light:'#3B82F6', dark:'#2563EB' },
  p3:{ emoji:'🥕', light:'#F97316', dark:'#EA580C' },
  p4:{ emoji:'🧘', light:'#8B5CF6', dark:'#7C3AED' },
};
function projectCover(p){
  const fb = COVER_FALLBACKS[p.id] || { emoji:'🌱', light:'#10B981', dark:'#059669' };
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  return {
    emoji: p.emoji || fb.emoji,
    light: p.colorLight || fb.light,
    dark: p.colorDark || fb.dark,
    bg: isDark ? (p.colorDark || fb.dark) : (p.colorLight || fb.light)
  };
}

const ui = { explore:{q:'',type:'todas',category:'todas',modality:'todas',duration:'todas',sort:'recentes'}, proj:{q:'',category:'todas',status:'todas',location:'todas',onlyNeeds:false}, activityTab:'todas', createStep:1, create:{type:'offer',title:'',description:'',category:'Educação',modality:'online',durationHours:1,availability:'',location:''}, createProj:{}, editMode:false, evalFor:null };

function me(){ return db.users.find(u=>u.id===db.currentUserId) || VISITOR_USER; }
function isVisitor(){ return !db.me; }
function isLogged(){ return Boolean(db.me); }
function visitorLock(title, active){
  return layout(`
  <div class="page-head"><h1>${title}</h1><p>Esta ação não está disponível no modo visitante.</p></div>
  <div class="card empty"><div class="big">🔒</div><h3>Modo visitante</h3><p>Você pode explorar oportunidades e projetos livremente, mas não pode criar nem aceitar ajuda enquanto estiver como visitante.</p><div class="inline" style="justify-content:center;margin-top:12px"><a class="btn btn-primary" href="#/explorar">Explorar oportunidades</a><button class="btn btn-outline" data-action="logout">Sair do modo visitante</button></div></div>`, active);
}
function projectUrl(id){ return location.href.split('#')[0] + '#/projeto/' + encodeURIComponent(id); }
const PENDING_KEY='colabre_pending_route';
function rememberPendingRoute(){ const h=location.hash; if(/^#\//.test(h) && !h.startsWith('#/login')){ try{ sessionStorage.setItem(PENDING_KEY,h); }catch(_){} } }
function takePendingRoute(fallback='#/dashboard'){ let h=null; try{ h=sessionStorage.getItem(PENDING_KEY); if(h) sessionStorage.removeItem(PENDING_KEY); }catch(_){} return h||fallback; }
async function copyText(text){
  try{ if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(text); return true; } }catch(_){}
  try{
    const ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('readonly','');
    ta.style.position='fixed'; ta.style.top='-1000px'; document.body.appendChild(ta);
    ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok;
  }catch(_){ return false; }
}
async function shareProject(p){
  const url=projectUrl(p.id);
  if(navigator.share){
    try{ await navigator.share({title:p.title,text:`Participe do projeto "${p.title}" no Colabre.`,url}); return; }
    catch(err){ if(err && err.name==='AbortError') return; }
  }
  const ok=await copyText(url);
  toast(ok?'Link do projeto copiado!':'Não foi possível copiar o link. Selecione o endereço exibido.', ok?'success':'error');
}
function userById(id){ return db.users.find(u=>u.id===id) || {name:'Usuário', color:'#999'}; }
function avatarInitials(u){ return esc((u.name||'U').split(' ').filter(Boolean).map(p=>p[0]).slice(0,2).join('').toUpperCase()); }
function avatarPhoto(u){ return (typeof u.photo==='string' && /^data:image\//.test(u.photo)) ? u.photo : ''; }
function avatar(u, cls=''){ const photo=avatarPhoto(u); return `<div class="avatar ${cls}" style="background:${u.color||'#3D5145'}" aria-hidden="true">${photo?`<img class="avatar-img" src="${photo}" alt="">`:avatarInitials(u)}</div>`; }
function readAndResizeImage(file, max=480, quality=0.85){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Arquivo de imagem inválido.'));
      img.onload=()=>{
        try{
          const scale=Math.min(1, max/Math.max(img.width,img.height));
          const w=Math.max(1,Math.round(img.width*scale)), h=Math.max(1,Math.round(img.height*scale));
          const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
          const ctx=cv.getContext('2d');
          if(!ctx) return resolve(reader.result);
          const surface=(getComputedStyle(document.documentElement).getPropertyValue('--surface')||'#fff').trim()||'#fff';
          ctx.fillStyle=surface; ctx.fillRect(0,0,w,h);
          ctx.drawImage(img,0,0,w,h);
          const out=cv.toDataURL('image/jpeg',quality);
          resolve(/^data:image\//.test(out)?out:reader.result);
        }catch(_){ resolve(reader.result); }
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function avatarName(u, clickable=false, id='', avatarCls=''){ const click = clickable && id ? ` data-action="goto-perfil-publico" data-id="${id}" style="cursor:pointer"` : ''; return `<div class="userrow"${click}>${avatar(u, avatarCls)}<div><strong>${esc(u.name)}</strong><div class="kv">${esc(u.location||'')}</div></div></div>`; }
async function logout(){
  stopSse();
  try { await api.logout(); } catch (_) {}
  try { sessionStorage.removeItem('colabre_visitor'); } catch (_) {}
  db = { ...EMPTY_DB };
  await loadState().catch(() => {});
  location.hash = '#/login';
  render();
  toast('Você saiu da sua conta.');
}
function go(view, id){ location.hash = id ? `#/${view}/${id}` : `#/${view}`; }
function parseRoute(){ const h = location.hash.replace('#/',''); const [path, query] = h.split('?'); const [v, id] = path.split('/'); const params = new URLSearchParams(query||''); return { view: v||'login', id, query: params }; }

function layout(inner, active){
  const u = me(); const un = unread(db);
  const links = [['dashboard','🏠','Início'],['explorar','🔍','Explorar'],['atividades','🗓️','Minhas atividades'],['projetos','🌱','Projetos'],['carteira','⏰','Carteira']];
  return `
  <div class="app">
    <aside class="sidebar">
      <div class="logo" data-action="goto-dashboard" style="cursor:pointer">Colabre</div>
      <nav class="nav" aria-label="Principal">
        ${links.map(([v,ic,l])=>`<a href="#/${v}" class="${active===v?'active':''}"><span class="ico">${ic}</span>${l}</a>`).join('')}
      </nav>
      <div class="side-user" data-action="goto-perfil" style="cursor:pointer">${avatar(u)}<div style="min-width:0"><strong class="small">${esc(u.name)}</strong><div class="kv">${fmtCredits(getBalance(db,u.id))} créditos</div></div></div>
    </aside>
    <div class="main">
      <header class="topbar"><div class="topbar-in">
        <strong style="color:var(--primary)">Colabre</strong>
        <span class="credit-chip">⏰ ${fmtCredits(getBalance(db,u.id))} créditos</span>
        <div class="spacer"></div>
        <button class="iconbtn" data-action="notif" aria-label="Notificações">🔔${un?`<span class="dot">${un}</span>`:''}</button>
        <button class="iconbtn theme-toggle" data-action="theme" aria-label="Alternar tema">${document.documentElement.getAttribute('data-theme')==='dark'?'☀️':'🌙'}</button>
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
const authState = { mode: 'login', email: '', devCode: '', notice: '', error: '', ref: '' };
function inviteRef(){
  try {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams((location.hash.split('?')[1] || ''));
    return String(q.get('ref') || h.get('ref') || '').trim().toUpperCase();
  } catch (_) { return ''; }
}
function enterVisitor(){
  try { sessionStorage.setItem('colabre_visitor', '1'); } catch (_) {}
  location.hash = takePendingRoute('#/explorar');
  if (!db.me) { db.users = [...db.users.filter(u => u.id !== VISITOR_USER.id), VISITOR_USER]; db.currentUserId = VISITOR_USER.id; }
  render();
  toast('Você entrou como visitante. Crie uma conta para participar.');
}
async function afterAuth(){
  await loadState();
  startSse();
  const target = takePendingRoute();
  if (location.hash === target) { render(); } else { location.hash = target; }
}
function renderAuth(){
  const ref = authState.ref || inviteRef();
  authState.ref = ref;
  const mode = authState.mode;
  const notice = authState.notice ? `<p class="kv" style="color:var(--green,#15803d);background:#ecfdf5;padding:8px 10px;border-radius:8px">${esc(authState.notice)}</p>` : '';
  const dev = authState.devCode ? `<p class="kv" style="background:#fff7ed;padding:8px 10px;border-radius:8px;word-break:break-word">Ambiente de desenvolvimento — código: <strong style="letter-spacing:3px">${esc(authState.devCode)}</strong>. Em produção ele é enviado apenas por e-mail.</p>` : '';
  const tabs = [['login', 'Entrar'], ['signup', 'Criar conta']];
  let panel = '';

  if (mode === 'login') {
    panel = `
      <h2 style="margin:10px 0 4px">Entrar na plataforma</h2>
      <p class="text-muted small">Acesse com o e-mail e a senha da sua conta.</p>
      ${notice}
      <form id="login-form" novalidate>
        <div class="field"><label for="login-email">E-mail</label><input id="login-email" class="input" type="email" autocomplete="email" placeholder="voce@exemplo.com" required></div>
        <div class="field"><label for="login-pass">Senha</label><input id="login-pass" class="input" type="password" autocomplete="current-password" placeholder="Sua senha" required></div>
        <p class="error" id="auth-error">${esc(authState.error)}</p>
        <button class="btn btn-accent btn-block" type="submit">Entrar</button>
      </form>
      <div class="inline" style="margin-top:10px;justify-content:space-between">
        <button class="btn btn-ghost btn-sm" type="button" data-auth="forgot">Esqueci minha senha</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="visitor">Continuar como visitante</button>
      </div>`;
  } else if (mode === 'signup') {
    panel = `
      <h2 style="margin:10px 0 4px">Criar conta</h2>
      <p class="text-muted small">Depois do cadastro enviaremos um código de 6 dígitos para confirmar seu e-mail.</p>
      ${notice}
      <form id="signup-form" novalidate>
        <div class="field"><label for="su-name">Nome completo</label><input id="su-name" class="input" type="text" autocomplete="name" placeholder="Seu nome" required></div>
        <div class="field"><label for="su-email">E-mail</label><input id="su-email" class="input" type="email" autocomplete="email" placeholder="voce@exemplo.com" required></div>
        <div class="field"><label for="su-pass">Senha</label><input id="su-pass" class="input" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras e números" required></div>
        <div class="field"><label for="su-confirm">Confirmar senha</label><input id="su-confirm" class="input" type="password" autocomplete="new-password" placeholder="Repita a senha" required></div>
        ${ref ? `<p class="kv">Convite de <strong>${esc(ref)}</strong> aplicado ao seu cadastro.</p>` : ''}
        <p class="error" id="auth-error">${esc(authState.error)}</p>
        <button class="btn btn-accent btn-block" type="submit">Criar conta</button>
      </form>`;
  } else if (mode === 'verify') {
    panel = `
      <h2 style="margin:10px 0 4px">Confirme seu e-mail</h2>
      <p class="text-muted small">Enviaremos (ou já enviamos) um código de 6 dígitos para <strong>${esc(authState.email)}</strong>. Ele expira em 15 minutos e só pode ser usado uma vez.</p>
      ${dev}
      <form id="verify-form" novalidate>
        <div class="field"><label for="vf-code">Código de confirmação</label><input id="vf-code" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div>
        <p class="error" id="auth-error">${esc(authState.error)}</p>
        <button class="btn btn-accent btn-block" type="submit">Confirmar e entrar</button>
      </form>
      <div class="inline" style="margin-top:10px;justify-content:space-between">
        <button class="btn btn-ghost btn-sm" type="button" data-auth="resend">Reenviar código</button>
        <button class="btn btn-ghost btn-sm" type="button" data-auth="login">Voltar ao login</button>
      </div>`;
  } else if (mode === 'forgot') {
    panel = `
      <h2 style="margin:10px 0 4px">Recuperar senha</h2>
      <p class="text-muted small">Informe seu e-mail. Se a conta existir, enviaremos um código de redefinição.</p>
      <form id="forgot-form" novalidate>
        <div class="field"><label for="fg-email">E-mail</label><input id="fg-email" class="input" type="email" autocomplete="email" placeholder="voce@exemplo.com" required></div>
        <p class="error" id="auth-error">${esc(authState.error)}</p>
        <button class="btn btn-accent btn-block" type="submit">Enviar código</button>
      </form>
      <button class="btn btn-ghost btn-sm" type="button" data-auth="login" style="margin-top:10px">Voltar ao login</button>`;
  } else if (mode === 'reset') {
    panel = `
      <h2 style="margin:10px 0 4px">Definir nova senha</h2>
      <p class="text-muted small">Informe o código recebido para <strong>${esc(authState.email)}</strong> e escolha uma nova senha.</p>
      ${dev}
      <form id="reset-form" novalidate>
        <div class="field"><label for="rs-code">Código de 6 dígitos</label><input id="rs-code" class="input" inputmode="numeric" maxlength="6" placeholder="000000" required></div>
        <div class="field"><label for="rs-pass">Nova senha</label><input id="rs-pass" class="input" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras e números" required></div>
        <div class="field"><label for="rs-confirm">Confirmar nova senha</label><input id="rs-confirm" class="input" type="password" autocomplete="new-password" placeholder="Repita a senha" required></div>
        <p class="error" id="auth-error">${esc(authState.error)}</p>
        <button class="btn btn-accent btn-block" type="submit">Redefinir senha</button>
      </form>
      <div class="inline" style="margin-top:10px;justify-content:space-between">
        <button class="btn btn-ghost btn-sm" type="button" data-auth="forgot">Reenviar código</button>
        <button class="btn btn-ghost btn-sm" type="button" data-auth="login">Voltar ao login</button>
      </div>`;
  }

  $('#root').innerHTML = `
  <div class="auth">
    <section class="auth-hero auth-hero-top">
      <button class="demo-btn-top" data-action="demo">Demonstração</button>
      <div>
        <div class="logo" style="color:#fff;padding:0">Colabre</div>
        <h1 style="margin-top:26px">Seu tempo tem valor. Sua comunidade também.</h1>
        <p class="sub">Conectamos pessoas para compartilhar habilidades, oferecer ajuda e transformar pequenas contribuições em grandes mudanças.</p>
        <div class="benefits">
          <div class="benefit"><span>🤝</span><div><strong>Compartilhe o que você sabe</strong><div class="small" style="color:#D9E3DB">Ofereça aulas, consertos, orientação e muito mais.</div></div></div>
          <div class="benefit"><span>💬</span><div><strong>Receba ajuda quando precisar</strong><div class="small" style="color:#D9E3DB">Troque tempo por tempo, sem dinheiro envolvido.</div></div></div>
          <div class="benefit"><span>🌱</span><div><strong>Construa algo maior com sua comunidade</strong><div class="small" style="color:#D9E3DB">Participe de projetos coletivos que transformam bairros.</div></div></div>
        </div>
        <div class="hero-illu">🤝 Troque tempo por tempo com confiança e vizinhança.</div>
      </div>
      <div class="small" style="color:#B9C9BD;margin-top:20px">Plataforma com contas reais, verificação de e-mail e dados sincronizados entre dispositivos.</div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <div class="logo">Colabre</div>
        ${['login','signup'].includes(mode) ? `<div class="tabs" style="margin:10px 0 6px">${tabs.map(([k,l])=>`<button class="tab ${mode===k?'active':''}" type="button" data-auth="${k}">${l}</button>`).join('')}</div>` : ''}
        ${panel}
        <div class="inline" style="margin-top:14px;justify-content:center">
          <button class="btn btn-outline btn-sm" data-action="demo">Acessar demonstração</button>
        </div>
        <p class="lang-note" style="margin-top:12px">Suas senhas são protegidas com hash no servidor. Nenhum dado sensível fica no navegador.</p>
      </div>
    </section>
  </div>`;

  const setError = msg => { const el = $('#auth-error'); if (el) el.textContent = msg || ''; };
  $$('[data-auth]').forEach(btn => btn.addEventListener('click', () => {
    const to = btn.dataset.auth;
    authState.mode = to; authState.error = ''; authState.notice = ''; authState.devCode = '';
    if (to === 'forgot' && authState.email) setTimeout(() => { const f = $('#fg-email'); if (f) f.value = authState.email; }, 0);
    renderAuth();
  }));

  $('#login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#login-email').value.trim().toLowerCase();
    const password = $('#login-pass').value;
    if (!email || !password) { setError('Preencha e-mail e senha.'); return; }
    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await api.login({ email, password });
      await afterAuth();
    } catch (err) {
      if (err.status === 403 && err.data?.needsVerification) {
        authState.mode = 'verify'; authState.email = err.data.email || email; authState.error = '';
        renderAuth(); toast('Confirme seu e-mail para entrar.');
      } else setError(errorMessage(err));
    } finally { if (btn) btn.disabled = false; }
  });

  $('#signup-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#su-name').value.trim();
    const email = $('#su-email').value.trim().toLowerCase();
    const password = $('#su-pass').value;
    const confirm = $('#su-confirm').value;
    if (name.length < 3) { setError('Informe seu nome completo.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError('Informe um e-mail válido.'); return; }
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não conferem.'); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const res = await api.register({ name, email, password, confirm, ref: authState.ref || inviteRef() });
      authState.mode = 'verify'; authState.email = email; authState.devCode = res.devCode || ''; authState.notice = res.message || ''; authState.error = '';
      renderAuth();
      toast('Conta criada. Confirme o código enviado.');
    } catch (err) { setError(errorMessage(err)); }
    finally { if (btn) btn.disabled = false; }
  });

  $('#verify-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#vf-code').value.replace(/\D/g, '');
    if (code.length !== 6) { setError('Informe o código de 6 dígitos.'); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await api.verify({ email: authState.email, code });
      authState.devCode = '';
      await afterAuth();
      toast('E-mail confirmado. Bem-vindo(a)!');
    } catch (err) { setError(errorMessage(err)); }
    finally { if (btn) btn.disabled = false; }
  });

  $('#forgot-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#fg-email').value.trim().toLowerCase();
    if (!email) { setError('Informe seu e-mail.'); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const res = await api.forgot({ email });
      authState.email = email; authState.mode = 'reset'; authState.devCode = res.devCode || ''; authState.notice = res.message || ''; authState.error = '';
      renderAuth();
      toast('Se a conta existir, o código foi gerado.');
    } catch (err) { setError(errorMessage(err)); }
    finally { if (btn) btn.disabled = false; }
  });

  $('#reset-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#rs-code').value.replace(/\D/g, '');
    const password = $('#rs-pass').value;
    const confirm = $('#rs-confirm').value;
    if (code.length !== 6) { setError('Informe o código de 6 dígitos.'); return; }
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não conferem.'); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await api.reset({ email: authState.email, code, password, confirm });
      authState.mode = 'login'; authState.notice = 'Senha redefinida. Entre com a nova senha.'; authState.devCode = ''; authState.error = '';
      renderAuth();
      toast('Senha redefinida.');
    } catch (err) { setError(errorMessage(err)); }
    finally { if (btn) btn.disabled = false; }
  });
}

/* ---------- Componentes ---------- */
function oppCard(o){
  const u = userById(o.ownerId); const mine = o.ownerId===db.currentUserId;
    return `<article class="opp-card">
    <div class="inline"><span class="badge ${o.type==='offer'?'badge-offer':'badge-request'}">${o.type==='offer'?'OFERTA DE AJUDA':'SOLICITAÇÃO DE AJUDA'}</span><span class="badge badge-cat">${esc(o.category)}</span>${mine?'<span class="badge badge-status">Sua publicação</span>':''}</div>
    <h3>${esc(o.title)}</h3><p>${esc(o.description)}</p>
    ${avatarName(u, u.id!==db.currentUserId, u.id)}
    <div class="opp-meta"><span class="meta">⏱ ${fmtHoursDesc(o.durationHours)}</span><span class="meta">${fmtCredits(o.durationHours)} ${o.durationHours==1?'crédito':'créditos'}</span><span class="meta">${o.modality==='online'?'🖥️ Online':o.modality==='presencial'?'📍 Presencial':'🖥️📍 Ambas'}</span><span class="meta">📍 ${esc(o.location)}</span><span class="meta">🗓️ ${fmtDate(o.publishedAt)}</span></div>
    <div class="inline"><span class="badge badge-status">${o.availability||''}</span><span style="flex:1"></span><button class="btn btn-outline btn-sm" data-action="opp-detail" data-id="${o.id}">Ver oportunidade</button></div>
  </article>`;
}
function projCard(p){
  const {pct,remaining} = projectProgress(p); const owner=userById(p.ownerId);
  const cover = projectCover(p);
  return `<article class="card proj-card">
    <div class="proj-cover" style="background:${cover.bg}"><span class="cover-emoji" aria-hidden="true">${cover.emoji}</span></div>
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
  const u=me(); const isDemo = u && (u.email === 'demo@colabre.com' || u.id === 'u1'); const isVisitante = u && u.id === 'u9'; const bal=getBalance(db,u.id); const stats=getStats(db,u.id);
  const activityDone = db.activities.filter(a=>(a.ownerId===u.id||a.interestedId===u.id)&&a.status==='concluida').length;
  const recs = db.opportunities.filter(o=>o.ownerId!==u.id && o.status!=='cancelled').slice(0,4);
  const projs = db.projects.filter(p=>p.status==='Ativo').slice(0,3);
  const recent = [...db.transactions.filter(t=>t.userId===u.id)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const eq = fmtHoursDesc(bal);
  const nomeSaudacao = isVisitante ? 'Visitante' : (isDemo ? 'Usuário' : esc(u.firstName));
  const acoesRapidas = isVisitante ? `
    <div class="card" style="opacity:0.5;pointer-events:none;background:var(--bg);border:1px dashed var(--border)"><div style="font-size:24px">🔒</div><strong>Oferecer ajuda</strong><p class="text-muted small" style="margin:4px 0 0">Visitante não pode oferecer ajuda.</p></div>
    <div class="card" style="opacity:0.5;pointer-events:none;background:var(--bg);border:1px dashed var(--border)"><div style="font-size:24px">🔒</div><strong>Solicitar ajuda</strong><p class="text-muted small" style="margin:4px 0 0">Visitante não pode solicitar ajuda.</p></div>
    <a class="card" href="#/criar-projeto" style="display:block;opacity:0.5;pointer-events:none"><div style="font-size:24px">🔒</div><strong>Criar projeto</strong><p class="text-muted small" style="margin:4px 0 0">Visitante não pode criar projetos.</p></a>
  ` : `
    <div class="card" data-action="criar-offer" style="cursor:pointer"><div style="font-size:24px">🎁</div><strong>Oferecer ajuda</strong><p class="text-muted small" style="margin:4px 0 0">Publique uma oferta e acumule créditos.</p></div>
    <div class="card" data-action="criar-request" style="cursor:pointer"><div style="font-size:24px">🙋</div><strong>Solicitar ajuda</strong><p class="text-muted small" style="margin:4px 0 0">Peça apoio à comunidade com seus créditos.</p></div>
    <a class="card" href="#/criar-projeto" style="display:block"><div style="font-size:24px">🌱</div><strong>Criar projeto</strong><p class="text-muted small" style="margin:4px 0 0">Mobilize vizinhos em uma causa comum.</p></a>
  `;
  return layout(`
  <div class="page-head"><h1>Olá, ${nomeSaudacao}! 👋</h1><p>Que bom ter você por aqui. Vamos fazer seu tempo valer?</p></div>
  <div class="grid3">
    <div class="card stat"><div class="ic">⏰</div><div><strong>${fmtCredits(bal)} créditos</strong><span class="text-muted">Disponíveis para utilizar · Equivalente a ${eq}</span><div style="margin-top:8px"><a class="btn btn-outline btn-sm" href="#/carteira">Ver carteira</a></div></div></div>
    <div class="card stat"><div class="ic">🤲</div><div><strong>${fmtCredits(u.hoursShared||0)} horas</strong><span class="text-muted">Compartilhadas · Seu tempo já ajudou outras pessoas</span></div></div>
    <div class="card stat"><div class="ic">🌟</div><div><strong>${(u.activitiesCompleted||0)} atividades</strong><span class="text-muted">Concluídas · ${u.peopleHelped||0} pessoas beneficiadas</span></div></div>
  </div>
  <h2 style="margin:22px 0 10px">Ações rápidas</h2>
  <div class="grid3">${acoesRapidas}</div>
  <h2 style="margin:22px 0 10px">Atividade recente</h2>
  <div class="card"><ul class="timeline">${recent.map(t=>`<li><strong>${t.amount>0?'+':'−'}${fmtCredits(Math.abs(t.amount))} crédito${Math.abs(t.amount)==1?'':'s'}</strong> — ${esc(t.description)}<div class="kv">${fmtDate(t.date)} · saldo ${fmtCredits(t.balanceAfter)}</div></li>`).join('')||'<li>Sem movimentações ainda.</li>'}</ul></div>
  <h2 style="margin:22px 0 10px">Oportunidades para você</h2>
  <div class="grid3">${recs.slice(0,3).map(oppCard).join('')||'<div class="empty">Nenhuma oportunidade no momento.</div>'}</div>
  <h2 style="margin:22px 0 10px">Projetos em destaque</h2>
  <div class="grid3">${projs.map(projCard).join('')}</div>
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
        <div class="readme">No Colabre, o tempo é nossa unidade de troca. A movimentação acontece apenas após a atividade e a confirmação mútua.</div>
      </div>
      <div class="card"><h3>Sobre quem publicou</h3><div class="userrow" style="margin-top:10px">${avatarName(u, u.id!==db.currentUserId, u.id, 'avatar-lg')}<div><strong>${esc(u.name)}</strong><div class="kv">${esc(u.location)} · nível ${esc(u.level||'Colaborador')} · ${fmtCredits(u.hoursShared||0)}h compartilhadas</div><p class="small text-muted" style="margin:6px 0 0">${esc(u.bio)}</p><div class="chips">${(u.skills||[]).map(s=>`<span class="badge badge-cat">${esc(s)}</span>`).join('')}</div></div></div></div>
    </div>
    <div class="card stack">
      <h3>Participar</h3>
      ${isVisitor()?'<p class="text-muted small">Modo visitante: entre com uma conta para demonstrar interesse ou aceitar ajuda.</p><button class="btn btn-outline btn-block" data-action="logout">Sair do modo visitante</button>':isMine?'<p class="text-muted small">Esta é a sua publicação. Você pode acompanhá-la em Minhas atividades.</p><a class="btn btn-primary btn-block" href="#/atividades">Ver em Minhas atividades</a>':
        myAct?`<p class="text-muted small">Você já demonstrou interesse nesta oportunidade. Status: <strong>${myAct.status}</strong></p><a class="btn btn-primary btn-block" href="#/atividades">Ver em Minhas atividades</a>`:
        `<button class="btn btn-accent btn-block" data-action="interest" data-id="${o.id}">${o.type==='offer'?'Tenho interesse':'Quero ajudar'}</button>
         <p class="kv">Demonstração de interesse não conclui a atividade nem movimenta créditos. A confirmação das horas é necessária.</p>`}
    </div>
  </div>`);
}

/* ---------- Criar oportunidade (multietapas) ---------- */
function renderCreate(){
  if(isVisitor()) return visitorLock('Criar oportunidade','criar');
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
    <div class="readme">No Colabre, o tempo é nossa unidade de troca. Cada hora de ajuda corresponde a um crédito de tempo.</div>
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
  if(isVisitor()){ toast('Modo visitante: você não pode publicar oportunidades.','error'); return; }
  const c=ui.create;
  if(!c.title || c.title.length<6 || !c.description || c.description.length<15){ toast('Revise título e descrição.','error'); return; }
  api.post('/api/opportunities', {
    type:c.type, title:c.title, description:c.description, category:c.category,
    modality:c.modality, durationHours:c.durationHours,
    availability:c.availability||'A combinar',
    location:c.location||(c.modality==='online'?'Online':'A combinar'),
  }).then(async res => {
    ui.create={type:'offer',title:'',description:'',category:'Educação',modality:'online',durationHours:1,availability:'',location:''}; ui.createStep=1;
    toast('Oportunidade publicada com sucesso!');
    await loadState();
    go('oportunidade',res.id);
    render();
  }).catch(err => toast(errorMessage(err),'error'));
}

/* ---------- Minhas atividades ---------- */
const STATUS_LABEL={
  interesse:'Aguardando aceite', aceita:'Aceita — aguardando início', em_andamento:'Em andamento',
  finalizada:'Finalizada — aguardando confirmação', concluida:'Concluída', contestada:'Horas contestadas',
  cancelada:'Cancelada', publicada:'Publicada',
};
function rolesOf(a){
  const opp=db.opportunities.find(o=>o.id===a.oppId);
  const type=opp?.type||'offer';
  return {
    provider: type==='offer' ? a.ownerId : a.interestedId,
    requester: type==='offer' ? a.interestedId : a.ownerId,
    type,
  };
}
function hoursFromStarted(startedAt){
  const ms=Math.max(0, nowServer()-new Date(startedAt).getTime());
  return Math.max(0.25, Math.round((ms/60000)/15)/4);
}
function clockText(startedAt){
  const ms=Math.max(0, nowServer()-new Date(startedAt).getTime());
  const total=Math.floor(ms/1000);
  const h=String(Math.floor(total/3600)).padStart(2,'0');
  const m=String(Math.floor((total%3600)/60)).padStart(2,'0');
  const s=String(total%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}
function startTimerTicker(){
  if(window.__colabreTimer) clearInterval(window.__colabreTimer);
  if(!document.querySelector('[data-timer]')) return;
  window.__colabreTimer=setInterval(()=>{
    $$('[data-timer]').forEach(el=>{
      const started=el.dataset.timer;
      if(!started) return;
      const clock=el.querySelector('[data-clock]');
      const credits=el.querySelector('[data-credit]');
      if(clock) clock.textContent=clockText(started);
      if(credits) credits.textContent=fmtCredits(hoursFromStarted(started));
    });
  },1000);
}
function ratingForm(aid){
  const a=db.activities.find(x=>x.id===aid); const alreadyRated = a?.ratedBy?.[db.currentUserId]; const myStars=alreadyRated?(Number(alreadyRated.stars)||0):0;
  if(!a) return '';
  const {requester,provider}=rolesOf(a);
  const otherId = db.currentUserId===provider ? requester : provider;
  const other=userById(otherId);
  return `<div class="review" style="margin-top:10px"><h3>Avalie a experiência</h3><p class="small text-muted">Sua avaliação para ${esc(other.name)} (1 a 5 estrelas)</p>
  <div class="rate" id="stars">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" class="${n<=myStars?'on':''}" aria-label="${n} estrelas">${n<=myStars?'★':'☆'}</button>`).join('')}</div>
  <div class="field"><label>Comentário (opcional)</label><textarea id="rate-comment" placeholder="Como foi a comunicação e a colaboração?"></textarea></div>
  ${alreadyRated?'<p class="kv small">Você já avaliou esta atividade.</p>':'<button class="btn btn-primary btn-sm" data-action="submit-rate" data-id="'+aid+'">Enviar avaliação</button>'}</div>`;
}
function myActivities(){
  const uid2=db.currentUserId;
  const mine=db.activities.filter(a=>a.ownerId===uid2||a.interestedId===uid2);
  const myOpps=db.opportunities.filter(o=>o.ownerId===uid2).map(o=>({id:'opp_'+o.id, oppId:o.id, ownerId:uid2, interestedId:'', status:'publicada', plannedHours:o.durationHours, createdAt:o.publishedAt, note:o.description, published:true}));
  return {acts:mine, opps:myOpps};
}
function activityCard(a){
  const opp=db.opportunities.find(o=>o.id===a.oppId)||{title:'(oportunidade removida)',type:'offer'};
  const {provider,requester,type}=rolesOf(a);
  const iAmProvider=a.ownerId===db.currentUserId && type==='offer';
  const iAmRequester=a.ownerId===db.currentUserId && type==='request';
  const iAmInterested=a.interestedId===db.currentUserId;
  const mine=a.ownerId===db.currentUserId||a.interestedId===db.currentUserId;
  const myRole=db.currentUserId===provider?'provider':db.currentUserId===requester?'requester':'';
  const otherId = db.currentUserId===provider ? requester : provider;
  const other=userById(otherId);
  const chat=db.chats?.find(c=>c.activityId===a.id);
  let actions='';

  if(a.status==='interesse' && a.ownerId===db.currentUserId){
    actions=`<button class="btn btn-accent btn-sm" data-action="accept" data-id="${a.id}">Aceitar interesse</button> <button class="btn btn-outline btn-sm" data-action="reject-act" data-id="${a.id}">Recusar</button>`;
  }
  if(a.status==='aceita'){
    if(myRole==='requester') actions+=`<button class="btn btn-code btn-sm" data-action="start-code" data-id="${a.id}">🔐 Ver código de início</button>`;
    if(myRole==='provider') actions+=`<button class="btn btn-accent btn-sm" data-action="start-code" data-id="${a.id}">▶ Iniciar com código</button>`;
    actions+=`<button class="btn btn-outline btn-sm" data-action="cancel-act" data-id="${a.id}">Cancelar</button>`;
  }
  if(a.status==='em_andamento' && myRole==='provider'){
    actions+=`<button class="btn btn-accent btn-sm" data-action="finish-act" data-id="${a.id}">Finalizar atividade</button>`;
  }
  if(a.status==='finalizada' && myRole==='requester'){
    actions+=`<button class="btn btn-accent btn-sm" data-action="confirm-hours" data-id="${a.id}">Confirmar ${fmtHoursDesc(a.confirmedHours||a.plannedHours)}</button>`;
    actions+=`<button class="btn btn-outline btn-sm" data-action="contest-hours" data-id="${a.id}">Contestar tempo</button>`;
  }
  if(a.status==='contestada' && myRole==='provider'){
    actions+=`<button class="btn btn-accent btn-sm" data-action="resolve-contest" data-id="${a.id}">Aceitar ${fmtHoursDesc(a.proposedHours)}</button>`;
    actions+=`<button class="btn btn-outline btn-sm" data-action="refuse-contest" data-id="${a.id}">Recusar proposta</button>`;
  }
  if(a.status==='concluida' && mine && !a.ratedBy?.[db.currentUserId]) actions+=`<button class="btn btn-outline btn-sm" data-action="rate" data-id="${a.id}">Avaliar experiência</button>`;
  if(a.status!=='cancelada' && mine){
    actions+=`<button class="btn btn-chat btn-sm" data-action="open-chat" data-id="${a.id}">💬 Conversar</button>`;
  }

  let live='';
  if(a.status==='em_andamento' && a.startedAt){
    live=`<div class="memory-strip" data-timer="${esc(a.startedAt)}" style="margin-top:8px;align-items:center"><strong>⏱ <span data-clock>${clockText(a.startedAt)}</span></strong><span class="kv">tempo oficial do servidor · <span data-credit>${fmtCredits(hoursFromStarted(a.startedAt))}</span> crédito(s) até agora</span></div>`;
  }
  let contest='';
  if(a.status==='contestada'){
    contest=`<p class="small text-muted">Contestação: ${esc(a.contestReason||'sem motivo informado')} · tempo proposto: <strong>${fmtHoursDesc(a.proposedHours)}</strong>.</p>`;
  }
  let feedback='';
  if(a.status==='concluida'){
    const mineR=a.ratedBy?.[db.currentUserId], theirsR=a.ratedBy?.[otherId];
    const stars=n=>'★'.repeat(n)+'☆'.repeat(Math.max(0,5-n));
    feedback=`<div class="rating-summary"><span><strong>Sua avaliação:</strong> ${mineR?`<span class="stars">${stars(mineR.stars)}</span> <span class="kv">${fmtDate(mineR.date)}</span>`:'pendente'}</span><span><strong>Avaliação de ${esc(other.name)}:</strong> ${theirsR?`<span class="stars">${stars(theirsR.stars)}</span> <span class="kv">${fmtDate(theirsR.date)}</span>`:'pendente'}</span></div>`;
  }  return `<article class="opp-card">
    <div class="inline"><span class="badge ${type==='offer'?'badge-offer':'badge-request'}">${type==='offer'?'Oferta':'Solicitação'}</span><span class="badge badge-status">${STATUS_LABEL[a.status]||a.status}</span><span class="badge badge-cat">${a.credited?'Créditos movimentados':'Créditos pendentes'}</span></div>
    <h3>${esc(opp.title)}</h3>
    ${avatarName(other, other.id!==db.currentUserId, other.id)}<div class="kv">${a.ownerId===db.currentUserId?'Você publicou · ':'Você demonstrou interesse · '} ${fmtDate(a.createdAt)}</div>
    <div class="opp-meta"><span class="meta">⏱ ${fmtHoursDesc(a.confirmedHours||a.plannedHours)}</span><span class="meta">${fmtCredits(a.confirmedHours||a.plannedHours)} créditos</span>${a.startedAt?`<span class="meta">Início ${new Date(a.startedAt).toLocaleString('pt-BR')}</span>`:''}</div>
    ${live}
    ${contest}
    ${a.note?`<p class="small text-muted">${esc(a.note)}</p>`:''}
    ${feedback}
    <div class="inline">${actions}<span style="flex:1"></span><button class="btn btn-ghost btn-sm" data-action="opp-detail" data-id="${opp.id||''}">Detalhes</button></div>
    ${ui.evalFor===a.id?ratingForm(a.id):''}
  </article>`;
}
function renderActivities(){
  const {acts,opps}=myActivities(); const tab=ui.activityTab; const uid2=db.currentUserId;
  let list=acts;
  if(tab==='offer') list=acts.filter(a=>{const o=db.opportunities.find(x=>x.id===a.oppId);return o&&o.type==='offer'&&a.ownerId===uid2;});
  if(tab==='request') list=acts.filter(a=>{const o=db.opportunities.find(x=>x.id===a.oppId);return o&&o.type==='request'&&a.ownerId===uid2;});
  if(tab==='andamento') list=acts.filter(a=>['interesse','aceita','em_andamento','finalizada','contestada'].includes(a.status));
  if(tab==='concluidas') list=acts.filter(a=>a.status==='concluida');
  const tabs=[['todas','Todas'],['offer','Oferecendo ajuda'],['request','Solicitando ajuda'],['andamento','Em andamento'],['concluidas','Concluídas']];
  return layout(`
  <div class="page-head"><h1>Minhas atividades</h1><p>Acompanhe interesses, códigos de início, cronômetros e confirmações.</p></div>
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
  <div class="page-head inline" style="align-items:flex-start"><div style="flex:1"><h1>Juntos podemos fazer mais.</h1><p>Descubra projetos comunitários e encontre uma maneira de contribuir.</p></div>${isVisitor()?'<span class="badge badge-status">🔒 Modo visitante</span>':'<a class="btn btn-accent" href="#/criar-projeto">Criar projeto</a>'}</div>
  <div class="filters"><div class="toolbar"><div class="grow"><input class="input" id="q-proj" placeholder="Buscar projeto..." value="${esc(f.q)}" aria-label="Buscar projetos"></div></div>
    <div class="row">
      <div class="field" style="margin:0"><label>Categoria</label><select id="p-cat"><option value="todas">Todas</option>${PROJ_CATEGORIES.map(c=>`<option ${f.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>Localidade</label><select id="p-loc"><option value="todas">Todas</option>${locs.map(c=>`<option ${f.location===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>Status</label><select id="p-stat"><option value="todas">Todos</option>${['Ativo','Concluindo','Concluído'].map(c=>`<option ${f.status===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <label class="inline small" style="gap:6px"><input type="checkbox" id="p-needs" ${f.onlyNeeds?'checked':''}> Só quem precisa de voluntários</label>
    </div></div>
  ${list.length?`<div class="grid3">${list.map(projCard).join('')}</div>`:`<div class="card empty"><div class="big">🌱</div><h3>Nenhum projeto encontrado</h3><p>Ajuste os filtros ou crie um novo projeto.</p></div>`}
  <div style="margin-top:16px;text-align:center">${isVisitor()?'<span class="badge badge-status">🔒 Modo visitante</span>':'<a class="btn btn-accent" href="#/criar-projeto">Criar projeto</a>'}</div>
  `,'projetos');
}
function renderProjectDetail(id){
  const p=db.projects.find(x=>x.id===id); if(!p) return renderProjects();
  const {pct,remaining}=projectProgress(p); const owner=userById(p.ownerId); const isPart=p.participants.includes(db.currentUserId); const isOwner=p.ownerId===db.currentUserId;
  const cover=projectCover(p);
  return layout(`
  <button class="btn btn-ghost" data-action="back">← Voltar</button>
  <div class="two-col" style="margin-top:10px">
    <div class="stack">
      <div class="card" style="padding:0;overflow:hidden">
        <div class="proj-cover" style="background:${cover.bg};height:140px"><span class="cover-emoji" aria-hidden="true">${cover.emoji}</span></div>
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
      ${isVisitor()?'<p class="text-muted small">Modo visitante: entre com uma conta para participar do projeto.</p><button class="btn btn-outline btn-block" data-action="logout">Sair do modo visitante</button>':isPart?'<button class="btn btn-primary btn-block" disabled>Você já participa</button>':`<button class="btn btn-accent btn-block" data-action="join-proj" data-id="${p.id}">Participar do projeto</button>`}
      ${isOwner?`<button class="btn btn-outline btn-block" data-action="add-update" data-id="${p.id}">Registrar atualização</button><p class="kv">Responsável: você pode registrar horas confirmadas dos participantes.</p>`:'<p class="kv">Ao participar, suas horas confirmadas compõem o progresso do projeto.</p>'}
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
      <h3>Compartilhar projeto</h3>
      <div class="field" style="margin-bottom:0">
        <label for="proj-share-url">Link direto do projeto</label>
        <div class="inline" style="flex-wrap:nowrap"><input id="proj-share-url" class="input" style="flex:1;min-width:0" readonly value="${esc(projectUrl(p.id))}" aria-label="Link direto do projeto"><button class="btn btn-outline btn-sm" data-action="share-project" data-id="${p.id}">Compartilhar</button></div>
        <p class="kv" style="margin-top:6px">Quem abrir este link vai direto para este projeto.</p>
      </div>
    </div>
  </div>`);
}
function renderCreateProject(){
  if(isVisitor()) return visitorLock('Criar projeto','projetos');
  const activeEmoji = coverState.emoji;
  const activeColor = PROJ_COLORS[coverState.color] ? coverState.color : 0;
  const activeColorData = PROJ_COLORS[activeColor];
  const themeIsDark = document.documentElement.getAttribute('data-theme')==='dark';
  const coverBg = themeIsDark ? activeColorData.dark : activeColorData.light;
  const emojiTabs = PROJ_EMOJI_GROUPS.map((g,i)=>`<button type="button" class="emoji-tab${i===0?' active':''}" data-emoji-cat="${g.id}" role="tab" aria-selected="${i===0}">${g.label}</button>`).join('');
  const emojiPanels = PROJ_EMOJI_GROUPS.map((g,i)=>`<div class="emoji-panel${i===0?' active':''}" data-emoji-panel="${g.id}" role="listbox" aria-label="${g.label}">${g.emojis.map(e=>`<button type="button" class="emoji-cell${e===activeEmoji?' selected':''}" data-emoji="${e}" role="option" aria-selected="${e===activeEmoji}" title="${e}">${e}</button>`).join('')}</div>`).join('');
  const colorSwatches = PROJ_COLORS.map((c,i)=>`<button type="button" class="color-swatch${i===activeColor?' selected':''}" data-color-index="${i}" style="--sw:${c.light};--sw-dark:${c.dark}" aria-label="${c.name}" aria-pressed="${i===activeColor}" title="${c.name}"><span class="color-check" aria-hidden="true">✓</span></button>`).join('');
  return layout(`
  <div class="page-head"><h1>Criar projeto comunitário</h1><p>Organize uma iniciativa e mobilize sua comunidade.</p></div>
  <div class="card"><form id="proj-form" novalidate>
    <div class="grid2">
      <div class="field"><label>Nome do projeto *</label><input id="pj-title" class="input" placeholder="Ex.: Revitalização da praça"></div>
      <div class="field"><label>Categoria *</label><select id="pj-cat">${PROJ_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
    </div>
    <div class="field">
      <label>Capa do projeto</label>
      <div class="cover-builder">
        <div class="cover-preview" id="cover-preview" style="background:${coverBg}">
          <span class="cover-preview-glow" aria-hidden="true"></span>
          <div class="cover-preview-top"><span class="cover-preview-label">Prévia da capa</span></div>
          <div class="cover-preview-emoji" id="cover-preview-emoji">${activeEmoji}</div>
          <div class="cover-preview-bottom">
            <strong id="cover-preview-title">Nome do projeto</strong>
            <span class="cover-preview-cat" id="cover-preview-cat">${PROJ_CATEGORIES[0]}</span>
          </div>
        </div>
        <div class="cover-controls">
          <div class="cover-group">
            <div class="cover-group-head"><span>Ícone</span><span class="cover-value" id="cover-emoji-value">${activeEmoji}</span></div>
            <div class="emoji-tabs" role="tablist" aria-label="Categorias de ícones">${emojiTabs}</div>
            <div class="emoji-panels">${emojiPanels}</div>
          </div>
          <div class="cover-group">
            <div class="cover-group-head"><span>Cor da capa</span><span class="cover-value" id="cover-color-value">${activeColorData.name}</span></div>
            <div class="color-grid">${colorSwatches}</div>
          </div>
        </div>
      </div>
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
  <div class="readme" style="margin-top:14px"><strong>Regras:</strong> Cada hora concluída equivale a um crédito de tempo; meia hora equivale a meio crédito. Sem compra ou venda de créditos. Sem saldo negativo. A movimentação só ocorre após a conclusão e a confirmação mútua. Se apenas uma pessoa confirmar, o status fica como “Aguardando confirmação”.</div>
  `,'carteira');
}

/* ---------- Perfil ---------- */
function levelIndex(u){ const i=LEVELS.indexOf(u.level||'Iniciante'); return i>=0?i:0; }
function renderProfile(){
  const u=me(); const li=levelIndex(u);
  const myProjs=db.projects.filter(p=>p.participants.includes(u.id));
  const conns=db.connections||[];
  const accepted=conns.filter(c=>c.status==='aceito');
  const received=conns.filter(c=>c.status==='pendente'&&c.addresseeId===u.id);
  const sent=conns.filter(c=>c.status==='pendente'&&c.requesterId===u.id);
  return layout(`
  <div class="page-head"><h1>Meu perfil</h1><p>Sua identidade e trajetória de colaboração.</p></div>
  <div class="two-col">
    <div class="stack">
      <div class="card">
        <div class="profile-photo">
          <div class="avatar-photo">
            ${avatar(u,'avatar-xl')}
            <label class="photo-edit" for="pf-photo" title="Alterar foto de perfil" aria-label="Alterar foto de perfil"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></label>
          </div>
          <div class="profile-identity">
            <h2>${esc(u.name)}</h2>
            <div class="kv">${esc(u.location)} · na plataforma desde ${fmtDate(u.joinedAt)} · disponibilidade: ${esc(u.availability||'')}</div>
            <p class="text-muted small" style="margin:6px 0 0">${esc(u.bio)}</p>
          </div>
        </div>
        <div class="photo-tools">
          <label class="btn btn-outline btn-sm" for="pf-photo"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Escolher foto</label>
          ${u.photo?'<button class="btn btn-ghost btn-sm" type="button" data-action="remove-photo">Remover foto</button>':''}
          <span class="photo-hint">JPG, PNG ou WEBP · a imagem é ajustada automaticamente</span>
        </div>
        <input type="file" id="pf-photo" class="sr-only" accept="image/*">
        <div id="pf-photo-error" class="error"></div>
        <div class="grid4" style="margin-top:14px">
          <div class="card"><strong>${fmtCredits(u.hoursShared||0)}h</strong><div class="kv">Horas contribuídas</div></div>
          <div class="card"><strong>${u.activitiesCompleted||0}</strong><div class="kv">Atividades concluídas</div></div>
          <div class="card"><strong>${u.peopleHelped||0}</strong><div class="kv">Pessoas ajudadas</div></div>
          <div class="card"><strong>${u.ratingAvg?u.ratingAvg.toFixed(1):'—'} ★</strong><div class="kv">Avaliação média (${u.ratingsCount||0})</div></div>
        </div>
      </div>
      <div class="card"><h3>Habilidades</h3><div class="chips">${(u.skills||[]).map((s,i)=>`<span class="badge badge-cat skill-badge">${esc(s)}<button type="button" class="skill-remove" data-action="remove-skill" data-index="${i}" aria-label="Remover ${esc(s)}" title="Remover habilidade">×</button></span>`).join('')||'<span class="kv">Nenhuma habilidade cadastrada.</span>'}</div>
      <div class="toolbar"><input id="new-skill" class="input" placeholder="Nova habilidade" aria-label="Nova habilidade"><button class="btn btn-outline btn-sm" data-action="add-skill">Adicionar</button></div></div>
      <div class="card"><h3>Níveis de participação</h3><p class="kv">O nível considera atividades concluídas, consistência e avaliações — não apenas o saldo. Níveis altos não autorizam automaticamente atividades sensíveis.</p><div class="levels">${LEVELS.map((l,i)=>`<span class="level-chip ${i===li?'cur':''}">${i+1}. ${l}${i===li?' ✓':''}</span>`).join('')}</div></div>
      <div class="card"><h3>Projetos participantes (${myProjs.length})</h3><div class="stack">${myProjs.map(p=>`<div class="inline"><strong>${esc(p.title)}</strong><span class="kv">${fmtCredits(p.contributedHours)}/${fmtCredits(p.goalHours)}h</span><span style="flex:1"></span><button class="btn btn-outline btn-sm" data-action="proj-detail" data-id="${p.id}">Ver</button></div>`).join('')||'<span class="kv">Você ainda não participa de projetos.</span>'}</div></div>
      <div class="card"><h3>Seu nível: ${esc(u.level||'Iniciante')}</h3>
        <div class="progress" role="progressbar" aria-valuenow="${u.levelProgress||0}" aria-valuemin="0" aria-valuemax="100"><div style="width:${u.levelProgress||0}%"></div></div>
        <div class="kv">${u.nextLevel?`${fmtCredits(u.pointsToNext)} pontos para ${esc(u.nextLevel)}`:'Nível máximo alcançado'} · pontuação ${fmtCredits(u.levelScore||0)}</div>
        <p class="kv" style="margin-top:6px">Atividades concluídas (10 pts), horas contribuídas (2 pts), avaliações recebidas (2 pts), pessoas ajudadas (1 pt) e projetos (5 pts). Calculado automaticamente pelo servidor.</p>
      </div>
      <div class="card"><h3>Convites</h3>
        <p class="small text-muted">Compartilhe seu link pessoal. O vínculo é confirmado após a pessoa verificar o e-mail.</p>
        <div class="inline" style="flex-wrap:nowrap"><input id="invite-url" class="input" style="flex:1;min-width:0" readonly value="${esc((location.origin||'') + '/register?ref=' + (db.invite?.code||u.inviteCode||''))}" aria-label="Seu link de convite"><button class="btn btn-outline btn-sm" data-action="copy-invite">Copiar</button><button class="btn btn-outline btn-sm" data-action="share-invite">Compartilhar</button></div>
        <div class="opp-meta" style="margin-top:8px"><span class="meta">👥 ${db.invite?.sent||0} convites enviados</span><span class="meta">✅ ${db.invite?.confirmed||0} cadastros confirmados</span><span class="meta">Código ${esc(db.invite?.code||u.inviteCode||'')}</span></div>
        <p class="kv">Convites não geram créditos automáticos.</p>
      </div>
      <div class="card"><h3>Conexões (${accepted.length})</h3>
        ${received.length?`<h4 style="margin:6px 0">Solicitações recebidas</h4><div class="stack">${received.map(c=>{const other=userById(c.requesterId);return `<div class="inline">${avatar(other)}<div style="flex:1"><strong>${esc(other.name)}</strong><div class="kv">quer se conectar</div></div><button class="btn btn-accent btn-sm" data-action="conn-accept" data-id="${c.id}">Aceitar</button><button class="btn btn-outline btn-sm" data-action="conn-decline" data-id="${c.id}">Recusar</button></div>`;}).join('')}</div>`:''}
        ${sent.length?`<h4 style="margin:10px 0 6px">Solicitações enviadas</h4><div class="stack">${sent.map(c=>{const other=userById(c.addresseeId);return `<div class="inline">${avatar(other)}<div style="flex:1"><strong>${esc(other.name)}</strong><div class="kv">aguardando resposta</div></div><button class="btn btn-outline btn-sm" data-action="conn-cancel" data-id="${c.id}">Cancelar</button></div>`;}).join('')}</div>`:''}
        <h4 style="margin:10px 0 6px">Suas conexões</h4>
        <div class="stack">${accepted.map(c=>{const other=userById(c.requesterId===u.id?c.addresseeId:c.requesterId);return `<div class="inline">${avatar(other)}<div style="flex:1"><strong>${esc(other.name)}</strong><div class="kv">${esc(other.location||'')}</div></div><button class="btn btn-outline btn-sm" data-action="goto-perfil-publico" data-id="${other.id}">Ver perfil</button><button class="btn btn-ghost btn-sm" data-action="conn-remove" data-id="${c.id}">Remover</button></div>`;}).join('')||'<span class="kv">Nenhuma conexão ainda.</span>'}</div>
      </div>
    </div>
    <div class="card">
      <h3>Editar perfil</h3>
      <form id="profile-form">
        <div class="field"><label>Nome de exibição</label><input id="pf-name" class="input" value="${esc(u.name)}"></div>
        <div class="field"><label>Localidade aproximada (sem endereço)</label><input id="pf-loc" class="input" value="${esc(u.location)}"></div>
        <div class="field"><label>Biografia</label><textarea id="pf-bio">${esc(u.bio)}</textarea></div>
        <div class="field"><label>Disponibilidade</label><input id="pf-avail" class="input" value="${esc(u.availability||'')}"></div>
        <div class="field"><label>Privacidade do perfil</label><select id="pf-privacy">
          <option value="publico" ${u.privacy==='publico'?'selected':''}>Público — qualquer pessoa vê detalhes</option>
          <option value="conexoes" ${u.privacy==='conexoes'?'selected':''}>Somente conexões veem detalhes</option>
          <option value="privado" ${u.privacy==='privado'?'selected':''}>Privado — apenas informações básicas</option>
        </select></div>
        <label class="inline small" style="gap:8px"><input type="checkbox" id="pf-show-activity" ${u.showActivity!==false?'checked':''}> Mostrar atividades no perfil</label>
        <button class="btn btn-accent btn-block" type="submit" style="margin-top:10px">Salvar alterações</button>
      </form>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
      <div class="inline"><button class="btn btn-outline btn-block" data-action="logout">Sair da conta</button></div>
      <p class="kv" style="margin-top:8px">Conta: ${esc(db.me?.email||'')} · e-mail verificado ✓</p>
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

/* ---------- Perfil público ---------- */
function renderPublicProfile(id){
  const u=userById(id); if(!u||u.id===db.currentUserId) return go('perfil');
  const myProjs=db.projects.filter(p=>p.participants.includes(u.id));
  const myActs=db.activities.filter(a=>(a.ownerId===u.id||a.interestedId===u.id)&&a.status==='concluida');
  return layout(`
  <div class="page-head"><h1>Perfil de ${esc(u.name)}</h1><p>Informações públicas de ${esc(u.name)}.</p></div>
  <div class="two-col">
    <div class="stack">
      <div class="public-profile-card">
        <div class="public-profile-header">
          ${avatar(u,'public-profile-avatar')}
          <div>
            <h2>${esc(u.name)}</h2>
            <div class="kv">${esc(u.location)} · na plataforma desde ${fmtDate(u.joinedAt)}</div>
            <p class="text-muted small" style="margin:6px 0 0">${esc(u.bio||'Sem biografia cadastrada.')}</p>
            <div class="chips" style="margin-top:8px">${(u.skills||[]).map(s=>`<span class="badge badge-cat">${esc(s)}</span>`).join('')||'<span class="kv">Nenhuma habilidade cadastrada.</span>'}</div>
          </div>
        </div>
        <div class="public-profile-stats">
          <div class="public-profile-stat"><strong>${fmtCredits(u.hoursShared||0)}h</strong><span>Horas contribuídas</span></div>
          <div class="public-profile-stat"><strong>${u.activitiesCompleted||0}</strong><span>Trabalhos concluídos</span></div>
          <div class="public-profile-stat"><strong>${u.ratingsCount||0}</strong><span>Avaliações recebidas</span></div>
          <div class="public-profile-stat"><strong>${u.ratingAvg?u.ratingAvg.toFixed(1):'—'} ★</strong><span>Avaliação média (${u.ratingsCount||0})</span></div>
        </div>
        <div class="public-profile-actions">
          ${isVisitor()?'<button class="btn btn-outline btn-sm" data-action="visitor">Entre para conectar</button>':`
            ${u.connectionStatus==='aceito'?'<span class="badge badge-status">✓ Conectados</span>':''}
            ${u.connectionStatus==='enviado'?'<button class="btn btn-outline btn-sm" data-action="conn-cancel" data-id="'+u.connectionId+'">Cancelar solicitação</button>':''}
            ${u.connectionStatus==='recebido'?`<button class="btn btn-accent btn-sm" data-action="conn-accept" data-id="${u.connectionId}">Aceitar conexão</button><button class="btn btn-outline btn-sm" data-action="conn-decline" data-id="${u.connectionId}">Recusar</button>`:''}
            ${!u.connectionStatus?`<button class="btn btn-primary btn-sm" data-action="conn-send" data-id="${u.id}">＋ Adicionar conexão</button>`:''}
            ${u.connectionStatus==='aceito'?`<button class="btn btn-ghost btn-sm" data-action="conn-remove" data-id="${u.connectionId}">Remover conexão</button>`:''}
            <button class="btn btn-primary btn-sm" data-action="start-chat-public" data-id="${u.id}">💬 Iniciar conversa</button>
          `}
          <button class="btn btn-outline btn-sm" data-action="invite-person" data-id="${u.id}">Convidar para o Colabre</button>
        </div>
      </div>
      <div class="card"><h3>Projetos participantes (${myProjs.length})</h3><div class="stack">${myProjs.map(p=>`<div class="inline"><strong>${esc(p.title)}</strong><span class="kv">${fmtCredits(p.contributedHours)}/${fmtCredits(p.goalHours)}h</span><span style="flex:1"></span><button class="btn btn-outline btn-sm" data-action="proj-detail" data-id="${p.id}">Ver</button></div>`).join('')||'<span class="kv">Não participa de projetos.</span>'}</div></div>
      <div class="card"><h3>Atividades concluídas (${myActs.length})</h3><div class="stack">${myActs.map(a=>{const opp=db.opportunities.find(o=>o.id===a.oppId);return `<div class="inline"><strong>${esc(opp?.title||'(removido)')}</strong><span class="kv badge badge-status">Concluída</span></div>`;}).join('')||'<span class="kv">Nenhuma atividade concluída.</span>'}</div></div>
      <div class="card"><h3>Avaliações recebidas (${u.ratingsCount||0})</h3>
        <div class="stack">${(db.ratings||[]).filter(r=>r.toId===u.id).map(r=>{const author=userById(r.fromId);const stars='★'.repeat(r.stars)+'☆'.repeat(Math.max(0,5-r.stars));return `<div class="review"><div class="inline">${avatar(author)}<div style="flex:1"><strong>${esc(author.name)}</strong><div class="kv">${fmtDate(r.date)}</div></div><span class="stars">${stars}</span></div>${r.comment?`<p class="small" style="margin:8px 0 0">${esc(r.comment)}</p>`:''}</div>`;}).join('')||'<span class="kv">Nenhuma avaliação recebida ainda.</span>'}</div>
      </div>
    </div>
  </div>
  `,'perfil');
}

function chatExists(otherId){
  return db.activities.some(a=>(a.ownerId===db.currentUserId&&a.interestedId===otherId)||(a.interestedId===db.currentUserId&&a.ownerId===otherId));
}

/* ---------- Chat ---------- */
function renderChat(id){
  let act=db.activities.find(x=>x.id===id);
  let chat=null, other=null, chatTitle='';
  if(act){
    const opp=db.opportunities.find(o=>o.id===act.oppId)||{title:''};
    const {provider,requester}=rolesOf(act);
    const otherId = db.currentUserId===provider ? requester : provider; other=userById(otherId);
    chat=db.chats?.find(c=>c.activityId===id);
    if(!chat){
      api.post('/api/chats',{activityId:id}).then(async()=>{ await loadState(); render(); }).catch(err=>toast(errorMessage(err),'error'));
      return layout(`<button class="btn btn-ghost" data-action="back">← Voltar</button><div class="card empty"><div class="big">💬</div><h3>Abrindo conversa…</h3></div>`,'chat');
    }
    chatTitle='Conversa sobre '+esc(opp.title);
  } else {
    chat=db.chats?.find(c=>c.id===id && Array.isArray(c.participants));
    if(!chat) return go('perfil');
    const otherId=chat.participants.find(x=>x!==db.currentUserId);
    other=userById(otherId);
    chatTitle='Conversa direta';
  }
  return layout(`
  <button class="btn btn-ghost" data-action="back">← Voltar</button>
  <div class="chat-header">
    ${avatar(other,'chat-header-avatar')}
    <div class="chat-header-info">
      <div class="chat-header-name">${esc(other.name)}</div>
      <div class="chat-header-sub">${chatTitle}</div>
    </div>
  </div>
  <div class="chat-window" id="chat-window">
    ${chat.messages.length?chat.messages.map(m=>{const s=m.senderId===db.currentUserId;const usr=userById(m.senderId);return `<div class="chat-msg ${s?'own':'other'}"><div class="msg-header">${esc(usr.name)}</div><div class="chat-row ${s?'own':'other'}">${s?`<div class="chat-bubble ${s?'own':'other'}">${esc(m.text)}</div>${avatar(usr,'chat-avatar')}`:`${avatar(usr,'chat-avatar')}<div class="chat-bubble ${s?'own':'other'}">${esc(m.text)}</div>`}</div><div class="chat-time">${m.date.slice(11,16)}</div></div>`;}).join(''):`<div class="chat-empty">Nenhuma mensagem ainda. Inicie a conversa!</div>`}
  </div>
  <div class="chat-input-wrap">
    <div class="chat-input">
      <input id="chat-msg" type="text" placeholder="Digite sua mensagem...">
      <button class="btn btn-accent" data-action="chat-send" data-id="${chat.id}">Enviar</button>
    </div>
  </div>
  `,'chat');
}

function renderChatMessage(chatId, message){
  const chat0=db.chats?.find(c=>c.id===chatId || c.activityId===chatId); if(!chat0) return;
  const me=db.currentUserId; const s=message.senderId===me; const usr=userById(message.senderId);
  const el=document.createElement('div');
  el.className='chat-msg '+(s?'own':'other');
  el.innerHTML='<div class="msg-header">'+esc(usr.name)+'</div><div class="chat-row '+(s?'own':'other')+'">'+(s?'<div class="chat-bubble own">'+esc(message.text)+'</div>'+avatar(usr,'chat-avatar'):avatar(usr,'chat-avatar')+'<div class="chat-bubble other">'+esc(message.text)+'</div>')+'</div><div class="chat-time">'+message.date.slice(11,16)+'</div>';
  const w=document.getElementById('chat-window');
  if(w){ w.appendChild(el); w.scrollTop=w.scrollHeight; }
}

/* ---------- Código de início ---------- */
function renderSecurityCode(id){
  const act=db.activities.find(x=>x.id===id); if(!act) return go('atividades');
  const opp=db.opportunities.find(o=>o.id===act.oppId)||{title:''};
  const {provider,requester}=rolesOf(act);
  const isRequester=db.currentUserId===requester;
  const otherId=isRequester?provider:requester;
  const who=userById(otherId);
  if(act.status!=='aceita') return layout(`<button class="btn btn-ghost" data-action="back">← Voltar</button><div class="card empty"><div class="big">🔐</div><h3>Código indisponível</h3><p>O código só fica disponível enquanto a atividade aguarda início.</p><a class="btn btn-outline" href="#/atividades">Ver minhas atividades</a></div>`,'atividades');
  const body = isRequester ? `
      <p class="text-muted small">Mostre este código para <strong>${esc(who.name)}</strong> ao iniciar a atividade. Ele é de uso único.</p>
      <div id="code-display" class="security-code" style="display:flex;gap:10px;justify-content:center;font-size:40px;font-weight:800;letter-spacing:8px;margin:18px 0">••••</div>
      <div id="code-error" class="error" style="text-align:center"></div>
      <p class="kv" style="text-align:center">Somente você, que solicitou a ajuda, pode ver este código. Não o envie por canais públicos.</p>` : `
      <p class="text-muted small">Peça o código de 4 dígitos para <strong>${esc(who.name)}</strong> e informe abaixo para iniciar oficialmente o cronômetro.</p>
      <div class="security-code" id="security-code-digits" style="display:flex;gap:10px;justify-content:center;margin:18px 0">
        ${[1,2,3,4].map(i=>`<input type="text" class="security-digit" id="sc-digit-${i}" maxlength="1" inputmode="numeric" placeholder="0" aria-label="Dígito ${i}">`).join('')}
      </div>
      <div id="sc-error" class="error" style="text-align:center"></div>
      <button class="btn btn-accent btn-block" data-action="validar-codigo" data-id="${id}">Validar código e iniciar</button>`;

  setTimeout(()=>{
    if(!isRequester){
      const digits=$$('#security-code-digits .security-digit');
      digits.forEach((inp,idx)=>inp.addEventListener('input',()=>{
        inp.value=inp.value.replace(/\D/g,'').slice(0,1);
        if(inp.value && digits[idx+1]) digits[idx+1].focus();
      }));
      if(digits[0]) digits[0].focus();
      return;
    }
    api.get(`/api/activities/${id}/code`).then(res=>{
      const el=document.getElementById('code-display');
      if(el) el.textContent=res.code;
    }).catch(err=>{
      const el=document.getElementById('code-error');
      if(el) el.textContent=errorMessage(err);
    });
  },0);

  return layout(`
  <button class="btn btn-ghost" data-action="back">← Voltar</button>
  <div class="page-head"><h1>${isRequester?'Código de início':'Iniciar atividade'}</h1><p>${esc(opp.title)}</p></div>
  <div class="card security-modal">${body}</div>
  `,'atividades');
}

/* ---------- Demonstração ---------- */
function renderDemoMode(){
  return layout(demoView(),'demo');
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
const PUBLIC_VIEWS = new Set(['login','registro','verificar','redefinir','recuperar','explorar','projetos','projeto','oportunidade','perfil-publico','demo']);
const VISITOR_LOCKED = {
  atividades:['Minhas atividades','atividades'],
  carteira:['Carteira','carteira'],
  perfil:['Perfil','perfil'],
  notificacoes:['Notificações','notificacoes'],
  chat:['Conversas','atividades'],
  'codigo-seguranca':['Código de início','atividades'],
  'criar-projeto':['Criar projeto','projetos'],
  criar:['Criar oportunidade','criar'],
};
let sseStarted = false;
let sseSource = null;
function startSse(){
  if(sseStarted || !db.me) return;
  if(!('EventSource' in window)) return;
  sseStarted = true;
  try {
     const es = new EventSource((window.COLABRE_API_BASE || '').replace(/\/$/, '') + '/api/events', { withCredentials: true });
    sseSource = es;
    es.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data);
        if(msg.type !== 'update' || !db.me) return;
        if(parseRoute().view==='demo') return;
        const el = document.activeElement;
        if(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        refresh({ silent: true });
      } catch (_) {}
    };
    es.onerror = () => {
      try { es.close(); } catch (_) {}
      sseStarted = false; sseSource = null;
    };
  } catch (_) {}
}
function stopSse(){
  if(sseSource){ try { sseSource.close(); } catch (_) {} }
  sseSource = null; sseStarted = false;
}
function render(opts){
  const {view,id}=parseRoute();
  if(!opts || opts.scroll !== false) window.scrollTo(0,0);
  if(['login','registro','verificar','redefinir','recuperar'].includes(view)){
    if(db.me){ go('dashboard'); return; }
    if(view==='registro') authState.mode='signup';
    else if(view==='verificar') authState.mode='verify';
    else if(view==='redefinir') authState.mode='reset';
    else if(view==='recuperar') authState.mode='forgot';
    renderAuth(); return;
  }
  if(!db.me){
    let visitorFlag=false; try{ visitorFlag=sessionStorage.getItem('colabre_visitor')==='1'; }catch(_){}
    if(view==='demo' && !visitorFlag){ try{ sessionStorage.setItem('colabre_visitor','1'); }catch(_){} visitorFlag=true; }
    if(view==='dashboard'){
      if(!visitorFlag){ rememberPendingRoute(); renderAuth(); return; }
    } else if(!PUBLIC_VIEWS.has(view)){
      if(visitorFlag){
        const locked=VISITOR_LOCKED[view];
        const title=locked?locked[0]:'Conta necessária';
        const active=locked?locked[1]:'perfil';
        $('#root').innerHTML=visitorLock(title,active);
        startTimerTicker();
        return;
      }
      rememberPendingRoute(); renderAuth(); return;
    }
  }
  const map={dashboard:renderDashboard,explorar:renderExplore,criar:renderCreate,atividades:renderActivities,projetos:renderProjects,'criar-projeto':renderCreateProject,carteira:renderWallet,perfil:renderProfile,notificacoes:renderNotifications};
  if(view==='oportunidade'){$('#root').innerHTML=renderOppDetail(id);startTimerTicker();return;}
  if(view==='projeto'){$('#root').innerHTML=renderProjectDetail(id);startTimerTicker();return;}
  if(view==='perfil-publico'){$('#root').innerHTML=renderPublicProfile(id);startTimerTicker();return;}
  if(view==='chat'){$('#root').innerHTML=renderChat(id);startTimerTicker();return;}
  if(view==='codigo-seguranca'){$('#root').innerHTML=renderSecurityCode(id);startTimerTicker();return;}
  if(view==='demo'){$('#root').innerHTML=renderDemoMode();startTimerTicker();return;}
  const fn=map[view]||renderDashboard;
  $('#root').innerHTML=fn();
  bindView(view);
  startTimerTicker();
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
    if(!$('#proj-form')) return;
    const preview = $('#cover-preview');
    const syncCover = ()=>{
      const c = PROJ_COLORS[coverState.color] || PROJ_COLORS[0];
      const isDark = document.documentElement.getAttribute('data-theme')==='dark';
      preview.style.background = isDark ? c.dark : c.light;
      $('#cover-preview-emoji').textContent = coverState.emoji;
      $('#cover-emoji-value').textContent = coverState.emoji;
      $('#cover-color-value').textContent = c.name;
      const t = $('#pj-title').value.trim();
      $('#cover-preview-title').textContent = t || 'Nome do projeto';
      $('#cover-preview-cat').textContent = $('#pj-cat').value;
    };
    ['pj-title','pj-cat'].forEach(x=>$('#'+x).addEventListener('input',syncCover));
    $('#pj-cat').addEventListener('change',syncCover);
    syncCover();

    // Abas de categorias de emojis
    $$('#proj-form .emoji-tab').forEach(tab=>tab.addEventListener('click',()=>{
      $$('#proj-form .emoji-tab').forEach(t=>{
        const on = t===tab; t.classList.toggle('active',on); t.setAttribute('aria-selected',on);
      });
      $$('#proj-form .emoji-panel').forEach(p=>p.classList.toggle('active',p.dataset.emojiPanel===tab.dataset.emojiCat));
    }));

    // Seleção de emoji
    $$('#proj-form .emoji-cell').forEach(cell=>cell.addEventListener('click',()=>{
      coverState.emoji = cell.dataset.emoji;
      $$('#proj-form .emoji-cell').forEach(c=>{
        const on = c===cell; c.classList.toggle('selected',on); c.setAttribute('aria-selected',on);
      });
      syncCover();
    }));

    // Seleção de cor
    $$('#proj-form .color-swatch').forEach(sw=>sw.addEventListener('click',()=>{
      coverState.color = parseInt(sw.dataset.colorIndex,10)||0;
      $$('#proj-form .color-swatch').forEach(s=>{
        const on = s===sw; s.classList.toggle('selected',on); s.setAttribute('aria-pressed',on);
      });
      syncCover();
    }));

    $('#proj-form').addEventListener('submit',async e=>{
      e.preventDefault();
      if(isVisitor()){ toast('Modo visitante: você não pode criar projetos.','error'); return; }
      const title=$('#pj-title').value.trim(), desc=$('#pj-desc').value.trim(), obj=$('#pj-obj').value.trim(), loc=$('#pj-loc').value.trim();
      if(title.length<5||desc.length<15||obj.length<10){$('#pj-error').textContent='Preencha nome, descrição (15+) e objetivo (10+).';return;}
      const chosen = PROJ_COLORS[coverState.color] || PROJ_COLORS[0];
      const btn=e.target.querySelector('button[type="submit"]'); if(btn) btn.disabled=true;
      try{
        const res=await api.post('/api/projects',{
          title, description:desc, objective:obj, category:$('#pj-cat').value, location:loc,
          startDate:$('#pj-date').value||new Date().toISOString().slice(0,10),
          goalHours:parseFloat($('#pj-goal').value)||40,
          expectedParticipants:parseInt($('#pj-part').value)||10,
          needs:[{title:'Organização',hours:10},{title:'Divulgação',hours:5}],
          visibility:$('#pj-vis').value, emoji:coverState.emoji, colorLight:chosen.light, colorDark:chosen.dark,
        });
        await loadState();
        toast('Projeto criado com sucesso!'); go('projeto',res.id); render();
      }catch(err){ $('#pj-error').textContent=errorMessage(err); }
      finally{ if(btn) btn.disabled=false; }
    });
  }
  if(view==='perfil'){
    $('#profile-form').addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=e.target.querySelector('button[type="submit"]'); if(btn) btn.disabled=true;
      try{
        await api.patch('/api/profile',{
          name:$('#pf-name').value.trim(), location:$('#pf-loc').value.trim(), bio:$('#pf-bio').value.trim(),
          availability:$('#pf-avail').value.trim(), privacy:$('#pf-privacy').value,
          showActivity:Boolean($('#pf-show-activity').checked),
        });
        await loadState(); toast('Perfil atualizado!'); render();
      }catch(err){ toast(errorMessage(err),'error'); }
      finally{ if(btn) btn.disabled=false; }
    });
    $('#pf-photo').addEventListener('change',async e=>{
      const file=e.target.files&&e.target.files[0];
      const err=$('#pf-photo-error');
      if(!file) return;
      err.textContent='';
      if(!file.type.startsWith('image/')){ err.textContent='Escolha um arquivo de imagem (JPG, PNG ou WEBP).'; e.target.value=''; return; }
      if(file.size>12*1024*1024){ err.textContent='A imagem deve ter no máximo 12 MB.'; e.target.value=''; return; }
      try{
        const photo=await readAndResizeImage(file);
        await api.post('/api/profile/photo',{photo});
        await loadState();
        toast('Foto de perfil atualizada!'); render();
      }catch(ex){
        err.textContent=ex.message||'Não foi possível carregar esta imagem. Tente outra.';
        e.target.value='';
      }
    });
  }
}

/* ---------- Atualização de projeto ---------- */
let updateProjectId=null;
function updatePreview(){
  const p=db.projects.find(x=>x.id===updateProjectId); if(!p) return;
  const add=Math.max(0,parseFloat($('#update-hours').value)||0);
  const total=Math.round((p.contributedHours+add)*10)/10;
  const pct=Math.min(100,Math.round((total/p.goalHours)*100)||0);
  $('#update-preview').textContent=`Novo total: ${fmtCredits(total)}h de ${fmtCredits(p.goalHours)}h · ${pct}% da meta`;
}
function openUpdateModal(p){
  updateProjectId=p.id;
  $('#update-modal-project').textContent=p.title;
  $('#update-text').value='';
  $('#update-hours').value='0';
  $('#update-error').textContent='';
  updatePreview();
  $('#update-modal').classList.add('open');
  setTimeout(()=>$('#update-text').focus(),60);
}
function closeUpdateModal(){ $('#update-modal').classList.remove('open'); updateProjectId=null; }
function saveProjectUpdate(){
  const p=db.projects.find(x=>x.id===updateProjectId); if(!p) return;
  const text=$('#update-text').value.trim();
  const add=parseFloat($('#update-hours').value)||0;
  if(text.length<5){ $('#update-error').textContent='Escreva pelo menos 5 caracteres para registrar a atualização.'; $('#update-text').focus(); return; }
  if(add<0 || !isFinite(add)){ $('#update-error').textContent='Informe uma quantidade de horas válida.'; return; }
  const id=p.id;
  api.post(`/api/projects/${encodeURIComponent(id)}/updates`,{text,hours:add}).then(async()=>{
    await loadState(); closeUpdateModal(); toast('Atualização registrada!'); render();
  }).catch(err=>{ $('#update-error').textContent=errorMessage(err); });
}
/* ---------- Ações globais ---------- */
const VISITOR_BLOCKED = ['interest','accept','reject-act','start-code','validar-codigo','finish-act','confirm-hours','contest-hours',
  'resolve-contest','refuse-contest','cancel-act','join-proj','publish','add-update','add-skill','remove-skill','remove-photo',
  'conn-send','conn-accept','conn-decline','conn-cancel','conn-remove','submit-rate','rate','start-chat-public','chat-send','share-invite'];

async function runApi(promise, successMsg) {
  try {
    await promise;
    await loadState();
    if (successMsg) toast(successMsg);
    render();
    return true;
  } catch (err) {
    toast(errorMessage(err), 'error');
    return false;
  }
}

function inviteUrl() {
  return `${location.origin || ''}/register?ref=${db.invite?.code || db.me?.inviteCode || ''}`;
}

async function shareInvite() {
  const url = inviteUrl();
  const data = { title: 'Colabre', text: 'Participe do Colabre e troque tempo por tempo com a comunidade.', url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const ok = await copyText(url);
  toast(ok ? 'Link de convite copiado!' : 'Não foi possível copiar. Selecione o link exibido.', ok ? 'success' : 'error');
}

function openContest(a) {
  if (!a) return;
  contestId = a.id;
  $('#contest-hours').value = String(a.confirmedHours || a.plannedHours || 0.25);
  $('#contest-reason').value = '';
  $('#contest-error').textContent = '';
  $('#contest-modal').classList.add('open');
}
function closeContestModal() { $('#contest-modal').classList.remove('open'); contestId = null; }

document.addEventListener('click', async e => {
  const demoEl = e.target.closest('[data-demo-action]');
  if (demoEl) {
    e.preventDefault();
    try {
      const res = await demoAction(demoEl.dataset.demoAction, demoEl);
      if (res && res.toast) toast(res.toast, res.type || 'success');
      if (!res || res.render !== false) render({ scroll: false });
    } catch (err) { toast(errorMessage(err), 'error'); }
    return;
  }

  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action, id = el.dataset.id;
  const u = me();

  if (isVisitor() && VISITOR_BLOCKED.includes(a)) {
    toast('Modo visitante: entre ou crie uma conta para participar.', 'error');
    rememberPendingRoute(); authState.mode = 'login'; go('login'); return;
  }

  if (a === 'notif') { go('notificacoes'); return; }
  if (a === 'theme') { toggleTheme(); render(); return; }
  if (a === 'goto-dashboard') { go('dashboard'); return; }
  if (a === 'goto-perfil') { go('perfil'); return; }
  if (a === 'logout') { await logout(); return; }
  if (a === 'demo') { try { sessionStorage.setItem('colabre_visitor','1'); } catch (_) {} clearInterval(window.__demoTicker); go('demo'); return; }
  if (a === 'visitor') { enterVisitor(); return; }
  if (a === 'back') { history.back(); return; }
  if (a === 'opp-detail') { go('oportunidade', id); return; }
  if (a === 'proj-detail') { go('projeto', id); return; }
  if (a === 'clear-filters') { ui.explore = { q: '', type: 'todas', category: 'todas', modality: 'todas', duration: 'todas', sort: 'recentes' }; render(); return; }
  if (a === 'goto-perfil-publico') { go('perfil-publico', id); return; }
  if (a === 'criar-offer') { ui.create.type = 'offer'; go('criar?type=offer'); render(); return; }
  if (a === 'criar-request') { ui.create.type = 'request'; go('criar?type=request'); render(); return; }
  if (a === 'tab') { ui.activityTab = el.dataset.tab; render(); return; }
  if (a === 'set-type') { readCreateForm(); ui.create.type = el.dataset.type; render(); return; }
  if (a === 'step-back') { readCreateForm(); ui.createStep--; render(); return; }
  if (a === 'step-next') { if (!validateStep()) return; ui.createStep++; render(); return; }
  if (a === 'publish') { readCreateForm(); if (ui.create.title.length < 6 || ui.create.description.length < 15) { toast('Revise título e descrição.', 'error'); return; } publishOpp(); return; }
  if (a === 'share-project') { const p = db.projects.find(x => x.id === id); if (p) shareProject(p); return; }
  if (a === 'add-update') { const p = db.projects.find(x => x.id === id); if (p) openUpdateModal(p); return; }
  if (a === 'rate') { ui.evalFor = id; render(); return; }
  if (a === 'open-chat') { go('chat', id); return; }
  if (a === 'start-code') { go('codigo-seguranca', id); return; }
  if (a === 'copy-invite') {
    const ok = await copyText(inviteUrl());
    toast(ok ? 'Link de convite copiado!' : 'Não foi possível copiar o link.', ok ? 'success' : 'error');
    return;
  }
  if (a === 'share-invite' || a === 'invite-person') { await shareInvite(); return; }

  if (a === 'remove-photo') { await runApi(api.del('/api/profile/photo'), 'Foto de perfil removida.'); return; }

  if (a === 'interest') {
    const opp = db.opportunities.find(o => o.id === id); if (!opp) return;
    const owner = userById(opp.ownerId);
    confirmModal({ title: 'Confirmar interesse', message: `Você demonstra interesse em "${opp.title}"? A atividade só será confirmada após o aceite de ${owner.name}.`, confirmLabel: 'Confirmar interesse', onConfirm: () => runApi(api.post(`/api/opportunities/${encodeURIComponent(id)}/interest`), 'Interesse enviado! Aguardando resposta.') });
    return;
  }
  if (a === 'accept') {
    confirmModal({ title: 'Aceitar interesse', message: 'Ao aceitar, a atividade passa para o estado Aceita. O solicitante receberá o código de início.', confirmLabel: 'Aceitar', onConfirm: () => runApi(api.post(`/api/activities/${encodeURIComponent(id)}/accept`), 'Atividade aceita. Código de início liberado para o solicitante.') });
    return;
  }
  if (a === 'reject-act') {
    confirmModal({ title: 'Recusar interesse', message: 'A atividade será cancelada e a outra pessoa será notificada.', confirmLabel: 'Recusar', onConfirm: () => runApi(api.post(`/api/activities/${encodeURIComponent(id)}/reject`), 'Interesse recusado.') });
    return;
  }
  if (a === 'cancel-act') {
    confirmModal({ title: 'Cancelar atividade', message: 'A atividade será cancelada. Nenhum crédito foi movimentado.', confirmLabel: 'Cancelar atividade', onConfirm: () => runApi(api.post(`/api/activities/${encodeURIComponent(id)}/cancel`), 'Atividade cancelada.') });
    return;
  }
  if (a === 'finish-act') {
    confirmModal({ title: 'Finalizar atividade', message: 'O horário de término será registrado no servidor e o solicitante precisará confirmar o tempo. Créditos só são movimentados após a confirmação.', confirmLabel: 'Finalizar', onConfirm: () => runApi(api.post(`/api/activities/${encodeURIComponent(id)}/finish`), 'Atividade finalizada. Aguardando confirmação do solicitante.') });
    return;
  }
  if (a === 'confirm-hours') {
    const act = db.activities.find(x => x.id === id); if (!act) return;
    const hours = act.confirmedHours || act.plannedHours;
    confirmModal({ title: 'Confirmar tempo e créditos', message: `Confirmar ${fmtHoursDesc(hours)} e transferir ${fmtCredits(hours)} crédito(s) para quem prestou a ajuda?`, confirmLabel: 'Confirmar e pagar', onConfirm: () => runApi(api.post(`/api/activities/${encodeURIComponent(id)}/confirm`), 'Atividade concluída e créditos transferidos.') });
    return;
  }
  if (a === 'contest-hours') { const act = db.activities.find(x => x.id === id); openContest(act); return; }
  if (a === 'resolve-contest') {
    const act = db.activities.find(x => x.id === id); if (!act) return;
    confirmModal({ title: 'Aceitar tempo proposto', message: `Aceitar ${fmtHoursDesc(act.proposedHours)} e liberar os créditos?`, confirmLabel: 'Aceitar proposta', onConfirm: () => runApi(api.post(`/api/activities/${encodeURIComponent(id)}/resolve`, { accept: true }), 'Proposta aceita e créditos transferidos.') });
    return;
  }
  if (a === 'refuse-contest') { await runApi(api.post(`/api/activities/${encodeURIComponent(id)}/resolve`, { accept: false }), 'Proposta recusada. O solicitante poderá revisar.'); return; }

  if (a === 'validar-codigo') {
    const digits = [1,2,3,4].map(i => $(`#sc-digit-${i}`)?.value || '').join('');
    if (digits.length !== 4) { const e2 = $('#sc-error'); if (e2) e2.textContent = 'Informe os 4 dígitos do código.'; return; }
    const btn = el; btn.disabled = true;
    try {
      await api.post(`/api/activities/${encodeURIComponent(id)}/start`, { code: digits });
      await loadState();
      toast('Código válido! Atividade iniciada e cronômetro registrado.');
      go('atividades'); render();
    } catch (err) {
      const e2 = $('#sc-error'); if (e2) e2.textContent = errorMessage(err);
      $$('#security-code-digits .security-digit').forEach(d => { d.classList.add('error'); setTimeout(() => d.classList.remove('error'), 500); });
    } finally { btn.disabled = false; }
    return;
  }

  if (a === 'join-proj') { await runApi(api.post(`/api/projects/${encodeURIComponent(id)}/join`), 'Bem-vindo(a) ao projeto!'); return; }
  if (a === 'add-skill') {
    const name = $('#new-skill')?.value.trim(); if (!name) return;
    await runApi(api.post('/api/profile/skills', { name }), 'Habilidade adicionada!');
    return;
  }
  if (a === 'remove-skill') {
    const i = parseInt(el.dataset.index, 10); const skill = (u.skills || [])[i];
    if (!skill) return;
    await runApi(api.del(`/api/profile/skills/${encodeURIComponent(skill)}`), `Habilidade "${skill}" removida.`);
    return;
  }

  if (a === 'read-note') { await runApi(api.post('/api/notifications/read', { id }), null); return; }
  if (a === 'read-all') { await runApi(api.post('/api/notifications/read-all'), 'Todas marcadas como lidas.'); return; }
  if (a === 'open-note') {
    const n = db.notifications.find(x => x.id === id);
    try { await api.post('/api/notifications/read', { id }); await loadState(); } catch (_) {}
    if (n && n.link) go(n.link.view, n.link.id); else render();
    return;
  }

  if (a === 'conn-send') {
    const target = userById(id);
    confirmModal({ title: 'Adicionar conexão', message: `Enviar uma solicitação de conexão para ${target.name}?`, confirmLabel: 'Enviar solicitação', onConfirm: () => runApi(api.post('/api/connections', { userId: id }), 'Solicitação de conexão enviada!') });
    return;
  }
  if (a === 'conn-accept') { await runApi(api.post(`/api/connections/${encodeURIComponent(id)}/accept`), 'Conexão aceita!'); return; }
  if (a === 'conn-decline') { await runApi(api.post(`/api/connections/${encodeURIComponent(id)}/decline`), 'Solicitação recusada.'); return; }
  if (a === 'conn-cancel') { await runApi(api.post(`/api/connections/${encodeURIComponent(id)}/cancel`), 'Solicitação cancelada.'); return; }
  if (a === 'conn-remove') {
    confirmModal({ title: 'Remover conexão', message: 'A conexão será removida para os dois participantes.', confirmLabel: 'Remover', onConfirm: () => runApi(api.del(`/api/connections/${encodeURIComponent(id)}`), 'Conexão removida.') });
    return;
  }

  if (a === 'start-chat-public') {
    if (db.currentUserId === id) return;
    try {
      const res = await api.post('/api/chats', { userId: id });
      await loadState();
      go('chat', res.id); render();
    } catch (err) { toast(errorMessage(err), 'error'); }
    return;
  }
  if (a === 'chat-send') {
    const input = $('#chat-msg'); const txt = input?.value.trim(); if (!txt) return;
    input.value = '';
    try {
      await api.post(`/api/chats/${encodeURIComponent(id)}/messages`, { text: txt });
      await loadState(); render();
    } catch (err) { input.value = txt; toast(errorMessage(err), 'error'); }
    return;
  }
});

document.addEventListener('click', e => { const s = e.target.closest('[data-star]'); if (!s) return; const n = +s.dataset.star; $$('[data-star]').forEach(b => b.classList.toggle('on', +b.dataset.star <= n)); s.dataset.val = n; });

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="submit-rate"]'); if (!b) return;
  const act = db.activities.find(x => x.id === b.dataset.id); if (!act) return;
  const starsEl = document.querySelectorAll('.rate button.on');
  const stars = starsEl.length > 0 ? +starsEl[starsEl.length - 1].dataset.star : 0;
  if (stars < 1) { toast('Escolha de 1 a 5 estrelas.', 'error'); return; }
  const comment = $('#rate-comment')?.value.trim() || '';
  b.disabled = true;
  try {
    await api.post('/api/ratings', { activityId: act.id, stars, comment });
    await loadState();
    ui.evalFor = null;
    toast('Avaliação enviada! Obrigado.');
    render();
  } catch (err) { toast(errorMessage(err), 'error'); b.disabled = false; }
});

let contestId = null;
$('#modal-cancel').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$('#update-cancel').addEventListener('click', closeUpdateModal);
$('#update-hours').addEventListener('input', updatePreview);
$('#update-save').addEventListener('click', saveProjectUpdate);
$('#update-modal').addEventListener('click', e => { if (e.target.id === 'update-modal') closeUpdateModal(); });
$('#contest-cancel').addEventListener('click', closeContestModal);
$('#contest-modal').addEventListener('click', e => { if (e.target.id === 'contest-modal') closeContestModal(); });
$('#contest-save').addEventListener('click', async () => {
  if (!contestId) return;
  const hours = parseFloat($('#contest-hours').value) || 0;
  const reason = $('#contest-reason').value.trim();
  if (hours < 0.25 || hours > 24) { $('#contest-error').textContent = 'Informe um tempo entre 15 minutos e 24 horas.'; return; }
  if (reason.length < 5) { $('#contest-error').textContent = 'Explique brevemente o motivo da contestação.'; return; }
  const btn = $('#contest-save'); btn.disabled = true;
  try {
    await api.post(`/api/activities/${encodeURIComponent(contestId)}/contest`, { proposedHours: hours, reason });
    await loadState(); closeContestModal(); toast('Contestação registrada. Os créditos ficam bloqueados até a resolução.'); render();
  } catch (err) { $('#contest-error').textContent = errorMessage(err); }
  finally { btn.disabled = false; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#update-modal').classList.contains('open')) closeUpdateModal();
  if (e.key === 'Escape' && $('#contest-modal').classList.contains('open')) closeContestModal();
});
window.addEventListener('hashchange', render);

window.__colabreDemoRefresh = () => { if (parseRoute().view === 'demo') render({ scroll: false }); };
window.__colabre = { render, toast, go, confirmModal, copyText };

(async function boot() {
  try {
    await loadState();
  } catch (err) {
    $('#root').innerHTML = `<div style="padding:32px;font-family:system-ui,sans-serif;max-width:620px;margin:0 auto">
      <h1 style="color:#3D5145">Colabre</h1>
      <p>Não foi possível conectar ao servidor.</p>
      <p class="text-muted">Inicie o backend com <code>npm start</code> e acesse <code>http://localhost:8100</code>. Se você abriu o arquivo diretamente, o navegador não consegue acessar a API.</p>
      <p class="kv">${esc(errorMessage(err))}</p></div>`;
    return;
  }
  render();
  startSse();
})();

/* Cliente da API do Colabre. Sess�o via cookie HttpOnly; nada sens�vel em localStorage. */
const API_BASE = String(window.COLABRE_API_BASE || '').replace(/\/$/, '');
function apiUrl(path) { return API_BASE ? API_BASE + path : path; }
async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(apiUrl(path), opts);
  } catch (_) {
    const err = new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
    err.status = 0;
    throw err;
  }
  let data = {};
  try { data = await res.json(); } catch (_) { data = {}; }
  if (!res.ok) {
    const err = new Error(data.error || `Falha na operação (${res.status}).`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: path => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: path => request('DELETE', path),
  state: () => request('GET', '/api/state'),
  register: body => request('POST', '/api/auth/register', body),
  verify: body => request('POST', '/api/auth/verify', body),
  resend: body => request('POST', '/api/auth/resend', body),
  login: body => request('POST', '/api/auth/login', body),
  logout: () => request('POST', '/api/auth/logout'),
  forgot: body => request('POST', '/api/auth/forgot', body),
  reset: body => request('POST', '/api/auth/reset', body),
};

export function errorMessage(err) {
  if (!err) return 'Não foi possível concluir a ação.';
  return err.message || 'Não foi possível concluir a ação.';
}

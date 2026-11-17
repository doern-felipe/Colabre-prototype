/* Colabre — servidor HTTP.
   Serve a SPA, a API JSON e um canal SSE para atualizações em tempo real.
   Uso: node server/index.mjs  (PORT=8100 por padrão) */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { handleApi, ApiError } from './api.mjs';
import { sessionFromToken, cleanupExpired, SESSION_DAYS } from './auth.mjs';
import { getDB } from './db.mjs';

const PORT = Number(process.env.PORT || 8100);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = resolve(process.cwd());
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'Lax').trim();
const COOKIE_NAME = 'colabre_session';
const MAX_BODY = 3 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.sqlite': 'application/octet-stream',
};

/* ---------- SSE ---------- */
const sseClients = new Set();

function broadcast() {
  const payload = `data: ${JSON.stringify({ type: 'update', at: Date.now() })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

setInterval(() => {
  for (const res of sseClients) {
    try { res.write(': ping\n\n'); } catch (_) { sseClients.delete(res); }
  }
}, 25000).unref();

setInterval(() => {
  try { cleanupExpired(); } catch (_) {}
}, 60 * 60 * 1000).unref();

/* ---------- Utilidades ---------- */
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function cookieHeader(token, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=' + COOKIE_SAMESITE,
    `Max-Age=${maxAge}`,
  ];
  if (IS_PROD) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader() {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=' + COOKIE_SAMESITE, 'Max-Age=0'];
  if (IS_PROD) parts.push('Secure');
  return parts.join('; ');
}

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new ApiError(413, 'Conteúdo muito grande.')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = String(req.headers.host || '');
    if (url.host === host) return true;
    const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    return extra.includes(origin);
  } catch (_) {
    return false;
  }
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  };
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !rel) rel = '/index.html';
  // Rotas amigáveis da SPA.
  if (!extname(rel)) rel = '/index.html';
  const target = normalize(join(ROOT, rel));
  if (!target.startsWith(ROOT + sep) && target !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
    const ext = extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      ...securityHeaders(),
    });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(target).pipe(res);
  } catch (_) {
    try {
      const fallback = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'], ...securityHeaders() });
      res.end(fallback);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
    }
  }
}

async function handleSse(req, res, token) {
  const session = token ? sessionFromToken(token) : null;
  if (!session) { res.writeHead(401, { 'Content-Type': 'text/plain' }); res.end('Não autorizado'); return; }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`data: ${JSON.stringify({ type: 'ready' })}\n\n`);
  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME] || '';

  try {
    if (path === '/api/events') { await handleSse(req, res, token); return; }

    if (path.startsWith('/api/')) {
      const origin = req.headers.origin;
      if (origin && originAllowed(req)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method || '') && !originAllowed(req)) {
        sendJson(res, 403, { error: 'Origem n�o autorizada.' }); return;
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          Allow: 'GET,POST,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Credentials': 'true',
          ...(origin && originAllowed(req) ? { 'Access-Control-Allow-Origin': origin } : {}),
        });
        res.end(); return;
      }
      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method || '') ? await readBody(req) : '';
      const ctx = {
        req, res, method: req.method, path, url, body, token,
        ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim(),
        userAgent: req.headers['user-agent'] || '',
        refresh: broadcast,
        user: null,
      };
      const result = await handleApi(ctx);
      if (!result.handled) { sendJson(res, 404, { error: 'Rota não encontrada.' }); return; }

      const data = result.data || {};
      const headers = {};
      if (data.token) {
        headers['Set-Cookie'] = cookieHeader(data.token);
        delete data.token;
      }
      if (path === '/api/auth/logout') headers['Set-Cookie'] = clearCookieHeader();
      sendJson(res, 200, data, headers);
      return;
    }

    if (!['GET', 'HEAD'].includes(req.method || '')) {
      res.writeHead(405, { Allow: 'GET,HEAD' }); res.end('Método não permitido'); return;
    }
    await serveStatic(req, res, path);
  } catch (err) {
    if (res.headersSent) { try { res.end(); } catch (_) {} return; }
    if (err instanceof ApiError) {
      sendJson(res, err.status, { error: err.message, ...err.extra });
      return;
    }
    console.error('[erro]', req.method, path, err);
    sendJson(res, 500, { error: 'Erro interno do servidor.' });
  }
});

server.listen(PORT, HOST, () => {
  try { getDB(); } catch (err) { console.error('Falha ao abrir o banco:', err); }
  console.log(`\nColabre rodando em http://localhost:${PORT}`);
  console.log(`Banco: ${process.env.DB_PATH || resolve(process.cwd(), 'data', 'colabre.sqlite')}`);
  console.log(`E-mail: ${process.env.EMAIL_DRIVER === 'resend' && process.env.RESEND_API_KEY ? 'Resend' : 'console (desenvolvimento)'}`);
  if (process.env.NODE_ENV !== 'production') console.log('Códigos de verificação aparecem no terminal e na tela.\n');
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });

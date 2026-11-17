/* Validação de endereços de e-mail.
   - Formato sintático (RFC básico).
   - Bloqueio de domínios descartáveis conhecidos.
   - Verificação opcional de registro MX (DNS) para garantir que o domínio recebe e-mail.
   Tudo roda no servidor; o cliente nunca decide se um e-mail é válido. */
import { promises as dns } from 'node:dns';

const DISPOSABLE = new Set([
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','yopmail.com',
  'trashmail.com','fakeinbox.com','sharklasers.com','spamgourmet.com','getnada.com',
  'maildrop.cc','dispostable.com','mintemail.com','throwaway.email','temp-mail.org',
]);

export function emailFormatProblem(email) {
  if (typeof email !== 'string') return 'Informe um e-mail válido.';
  const e = email.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return 'Informe um e-mail válido.';
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(e)) return 'Informe um e-mail válido.';
  const domain = e.split('@')[1];
  if (DISPOSABLE.has(domain)) return 'E-mails descartáveis não são aceitos. Use um endereço real.';
  return null;
}

export async function emailDomainReceivesMail(email) {
  // Retorna true se o domínio possui registro MX (ou A/AAAA como fallback).
  // Em caso de erro de rede/DNS, devolve true para não bloquear cadastros legítimos
  // em ambientes sem resolução DNS disponível (ex.: desenvolvimento offline).
  const domain = String(email).split('@')[1];
  if (!domain) return false;
  try {
    const mx = await dns.resolveMx(domain);
    if (Array.isArray(mx) && mx.length > 0) return true;
  } catch (_) {}
  try {
    await dns.resolve4(domain);
    return true;
  } catch (_) {}
  try {
    await dns.resolve6(domain);
    return true;
  } catch (_) {}
  return false;
}

export function mxValidationEnabled() {
  if (process.env.VALIDATE_EMAIL_DNS === '1') return true;
  if (process.env.VALIDATE_EMAIL_DNS === '0') return false;
  return process.env.NODE_ENV === 'production';
}
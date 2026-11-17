/* Envio de e-mail.
   Produção: defina EMAIL_DRIVER=resend, RESEND_API_KEY e EMAIL_FROM (domínio verificado).
   Desenvolvimento: sem credenciais, o código é impresso no terminal e devolvido à tela
   apenas quando ALLOW_DEV_CODES=1 (padrão fora de produção). */
const DRIVER = (process.env.EMAIL_DRIVER || 'console').toLowerCase();
const FROM = process.env.EMAIL_FROM || 'Colabre <nao-responda@colabre.local>';
const APP_URL = process.env.APP_URL || 'http://localhost:8100';

export function emailStatus() {
  const configured = DRIVER === 'resend' && Boolean(process.env.RESEND_API_KEY);
  return { driver: configured ? 'resend' : 'console', configured, from: FROM };
}

export function devCodesAllowed() {
  if (process.env.ALLOW_DEV_CODES === '1') return true;
  if (process.env.ALLOW_DEV_CODES === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export async function sendMail({ to, subject, text, html }) {
  if (DRIVER === 'resend' && process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Falha no envio de e-mail (${res.status}): ${body.slice(0, 300)}`);
    }
    return { delivered: true, provider: 'resend' };
  }
  // Driver de desenvolvimento: não finge entrega externa; registra no terminal.
  console.log(`\n[email:dev] Para: ${to}\n[email:dev] Assunto: ${subject}\n${text}\n`);
  return { delivered: false, provider: 'console' };
}

export async function sendVerificationCode(to, code, name = '') {
  const subject = 'Seu código de confirmação do Colabre';
  const text = `Olá${name ? ', ' + name : ''}!\n\nSeu código de confirmação é: ${code}\n\nEle expira em 15 minutos e só pode ser usado uma vez.\n\nSe você não criou uma conta no Colabre, ignore esta mensagem.\n\n${APP_URL}`;
  const html = `<p>Olá${name ? ', ' + name : ''}!</p>
  <p>Seu código de confirmação do <strong>Colabre</strong> é:</p>
  <p style="font-size:30px;letter-spacing:8px;font-weight:800">${code}</p>
  <p>Ele expira em <strong>15 minutos</strong> e só pode ser usado uma vez.</p>
  <p>Se você não criou uma conta, ignore esta mensagem.</p>`;
  return sendMail({ to, subject, text, html });
}

export async function sendPasswordResetCode(to, code, name = '') {
  const subject = 'Redefinição de senha do Colabre';
  const text = `Olá${name ? ', ' + name : ''}!\n\nRecebemos um pedido para redefinir sua senha.\n\nCódigo: ${code}\n\nEle expira em 15 minutos e só pode ser usado uma vez. Se não foi você, ignore esta mensagem.\n\n${APP_URL}`;
  const html = `<p>Olá${name ? ', ' + name : ''}!</p>
  <p>Recebemos um pedido para redefinir sua senha no <strong>Colabre</strong>.</p>
  <p>Seu código é:</p>
  <p style="font-size:30px;letter-spacing:8px;font-weight:800">${code}</p>
  <p>Ele expira em <strong>15 minutos</strong> e só pode ser usado uma vez.</p>
  <p>Se não foi você, ignore esta mensagem.</p>`;
  return sendMail({ to, subject, text, html });
}

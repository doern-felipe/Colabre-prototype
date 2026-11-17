# Colabre — Plataforma de Colaboração Comunitária

O **Colabre** é uma plataforma onde **1 hora de ajuda = 1 crédito de tempo**.  
Pessoas oferecem e solicitam ajuda, executam atividades com cronômetro oficial, avaliam umas às outras e constroem projetos coletivos — tudo sem dinheiro, apenas tempo.

> Projeto acadêmico (Global Solution). Não é um produto comercial.

---

## ✨ Funcionalidades

- **Autenticação real**: cadastro com verificação por código de 6 dígitos, login com sessão persistente, recuperação e redefinição de senha.
- **Publicações**: ofertas e solicitações de ajuda, visíveis para toda a comunidade.
- **Atividades completas**: interesse → aceite → código de início de 4 dígitos → cronômetro oficial do servidor → finalização → confirmação/contestação → créditos.
- **Créditos transacionais**: 1h = 1 crédito (15min = 0,25; 30min = 0,5; 45min = 0,75). Sem duplicidade e sem saldo negativo.
- **Avaliações bilaterais**: 1 a 5 estrelas + comentário, apenas após conclusão.
- **Conexões**: enviar, aceitar, recusar, cancelar, remover.
- **Convites por link**: código exclusivo por usuário, contador de enviados/confirmados.
- **Projetos comunitários**: criação, participação, atualizações e progresso.
- **Notificações em tempo real** (SSE).
- **Modo visitante**: navegação pública sem alterar dados.
- **Modo demonstração isolado**: simulação completa com velocidades 1x/5x/10x/30x e avanço manual de tempo.

---

## 🧱 Arquitetura

```
O_Tempo_Vale-site/
├── server/          # Backend Node.js (API, auth, SQLite, SSE)
│   ├── index.mjs    # Servidor HTTP + arquivos estáticos
│   ├── api.mjs      # Rotas e regras de negócio
│   ├── db.mjs       # Esquema SQLite + seed
│   ├── auth.mjs     # scrypt, sessões, códigos
│   ├── state.mjs    # Montagem do estado + privacidade
│   ├── email.mjs    # Envio de e-mail (Resend/console)
│   ├── email-validation.mjs
│   └── levels.mjs
├── js/              # Frontend (ES Modules)
│   ├── app.js       # SPA principal
│   ├── api.js       # Cliente HTTP
│   ├── demo.js      # Modo demonstração isolado
│   └── config.js    # URL do backend (para GitHub Pages)
├── css/             # Design system + responsivo
├── index.html       # Entrada da SPA
├── Dockerfile       # Deploy em container
├── .env.example     # Variáveis de ambiente
└── data/            # Banco SQLite (criado em runtime)
```

---

## 🚀 Como rodar localmente

### Pré-requisitos
- **Node.js 20+** — https://nodejs.org

### Passos
1. Clone ou baixe o projeto e entre na pasta:
   ```bash
   cd "O_Tempo_Vale-site"
   ```
2. (Opcional) Instale dependências, se houver `package.json`:
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
   Ou manualmente:
   ```powershell
   $env:PORT=8100
   $env:ALLOW_DEV_CODES=1
   node server/index.mjs
   ```
4. Abra no navegador:
   ```
   http://localhost:8100
   ```

### Variáveis de ambiente (desenvolvimento)
| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8100` | Porta do servidor |
| `HOST` | `0.0.0.0` | Host de escuta |
| `DB_PATH` | `./data/colabre.sqlite` | Caminho do banco SQLite |
| `NODE_ENV` | (vazio) | `production` ativa validações extras |
| `ALLOW_DEV_CODES` | `1` (dev) | Exibe códigos na tela/JSON |
| `EMAIL_DRIVER` | `console` | `resend` para envio real |
| `RESEND_API_KEY` | — | Chave da API Resend |
| `EMAIL_FROM` | `Colabre <...>` | Remetente dos e-mails |
| `APP_URL` | `http://localhost:8100` | URL pública do app |
| `ALLOWED_ORIGINS` | — | Origens CORS adicionais (vírgula) |
| `COOKIE_SAMESITE` | `Lax` | `None` para cross-origin (GitHub Pages) |
| `VALIDATE_EMAIL_DNS` | `1` (prod) | Validação MX do domínio |

---

## 📧 Ativar e-mails reais (produção)

1. Crie uma conta no **Resend** (ou outro provedor) e verifique seu domínio.
2. Obtenha a **API Key**.
3. Configure:
   ```env
   NODE_ENV=production
   EMAIL_DRIVER=resend
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
   EMAIL_FROM=Colabre <nao-responda@seudominio.com>
   APP_URL=https://seudominio.com
   ALLOW_DEV_CODES=0
   VALIDATE_EMAIL_DNS=1
   ```
4. Reinicie o servidor. O endpoint `/api/health` mostrará `email.configured: true`.

---

## 🌐 Deploy (100% gratuito)

### Opção A — GitHub Codespaces (sem cartão)
1. Suba o repo no GitHub.
2. **Code → Codespaces → Create codespace**.
3. No terminal:
   ```bash
   export ALLOW_DEV_CODES=1
   node server/index.mjs
   ```
4. Clique em **Make Public** na porta 8100 e compartilhe a URL.

### Opção B — Oracle Cloud Free Tier (permanente)
1. Crie uma VM Ubuntu (Always Free).
2. Instale Node.js 24 + Git.
3. Clone o repo e configure `.env` de produção.
4. Rode com `systemd` (24/7).
5. (Opcional) Configure domínio + Caddy para HTTPS.

### Opção C — Frontend no GitHub Pages + backend separado
1. Publique o frontend no GitHub Pages.
2. Hospede o backend (Render/Railway/VPS).
3. Em `js/config.js`:
   ```js
   window.COLABRE_API_BASE = 'https://seu-backend.com';
   ```
4. No backend:
   ```env
   COOKIE_SAMESITE=None
   ALLOWED_ORIGINS=https://seu-usuario.github.io
   ```

---

## 🧪 Testes

A suíte de integração da API (73 asserções) pode ser executada com:
```bash
node test/api-test.mjs
```
> Requer o servidor rodando em `http://localhost:8100`.

---

## 🔒 Segurança

- Senhas armazenadas com **scrypt** + salt por usuário.
- Sessões em cookie `HttpOnly` / `SameSite`.
- Códigos de verificação (6 dígitos) e de início (4 dígitos) gerados e validados no servidor, com expiração e uso único.
- Operações de crédito são **transacionais** com proteção contra duplicidade e saldo negativo.
- Modo demonstração totalmente isolado (`colabre_demo_v2`).
- Validação de e-mail (formato, domínios descartáveis, MX em produção).

---

## 📁 Arquivos importantes

| Arquivo | Descrição |
|---|---|
| `server/index.mjs` | Servidor HTTP, cookies, SSE, CSP |
| `server/api.mjs` | Rotas e regras de negócio |
| `server/db.mjs` | Esquema SQLite + seed |
| `server/auth.mjs` | Autenticação e códigos |
| `js/app.js` | SPA principal |
| `js/api.js` | Cliente HTTP |
| `js/demo.js` | Modo demonstração isolado |
| `js/config.js` | URL do backend (GitHub Pages) |

---

## 🛠️ Solução de problemas

### Porta 8100 em uso
```powershell
netstat -ano | findstr :8100
taskkill /PID <PID> /F
```

### Servidor não inicia
- Verifique se o Node.js está instalado (`node -v`).
- Confirme que está na pasta correta do projeto.

### Código de verificação não aparece
- Em desenvolvimento, os códigos aparecem no **terminal** e na **tela** (se `ALLOW_DEV_CODES=1`).
- Em produção, configure `RESEND_API_KEY` e `EMAIL_FROM`.

---

## 📄 Licença

Projeto acadêmico — uso livre para fins educacionais.
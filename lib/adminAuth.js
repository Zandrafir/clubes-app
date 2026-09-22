const crypto = require('crypto');

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.warn('AVISO: ADMIN_PASSWORD nao definida. Defina essa variavel de ambiente antes de usar a area administrativa em producao.');
}

const sessoes = new Map(); // token -> expiraEm (timestamp ms)

function limparSessoesExpiradas() {
  const agora = Date.now();
  for (const [token, expiraEm] of sessoes) {
    if (expiraEm < agora) sessoes.delete(token);
  }
}

function senhaCorreta(senhaFornecida) {
  if (!ADMIN_PASSWORD || typeof senhaFornecida !== 'string') return false;
  const a = Buffer.from(senhaFornecida);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function criarSessao() {
  limparSessoesExpiradas();
  const token = crypto.randomBytes(32).toString('hex');
  sessoes.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function sessaoValida(token) {
  if (!token) return false;
  const expiraEm = sessoes.get(token);
  if (!expiraEm) return false;
  if (expiraEm < Date.now()) {
    sessoes.delete(token);
    return false;
  }
  return true;
}

function destruirSessao(token) {
  sessoes.delete(token);
}

function requireAdminApi(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!sessaoValida(token)) {
    return res.status(401).json({ erro: 'Nao autenticado.' });
  }
  next();
}

function requireAdminPage(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!sessaoValida(token)) {
    return res.redirect('/admin/login.html');
  }
  next();
}

module.exports = {
  SESSION_COOKIE,
  senhaCorreta,
  criarSessao,
  destruirSessao,
  requireAdminApi,
  requireAdminPage,
};

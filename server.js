const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const db = require('./db/database');
const {
  SESSION_COOKIE,
  senhaCorreta,
  criarSessao,
  destruirSessao,
  requireAdminApi,
  requireAdminPage,
} = require('./lib/adminAuth');
const { gerarWorkbook } = require('./lib/exportarExcel');
const { normalizar } = require('./lib/normalizar');

const app = express();
const PORT = process.env.PORT || 3000;
const EM_PRODUCAO = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const TURMAS = [
  '6ºA', '6ºB', '6ºC',
  '7ºA', '7ºB', '7ºC',
  '8ºA', '8ºB', '8ºC', '8ºD', '8ºE',
  '9ºA', '9ºB', '9ºC', '9ºD', '9ºE',
];

function getClubesComVagas() {
  const clubes = db.prepare('SELECT * FROM clubes ORDER BY id').all();
  const contagem = db
    .prepare('SELECT clube_id, COUNT(*) as total FROM inscricoes GROUP BY clube_id')
    .all();
  const mapaContagem = Object.fromEntries(contagem.map((c) => [c.clube_id, c.total]));

  return clubes.map((c) => {
    const ocupadas = mapaContagem[c.id] || 0;
    return {
      id: c.id,
      nome: c.nome,
      resumo: c.resumo,
      presidente: c.presidente,
      padrinho: c.padrinho,
      limite: c.limite,
      ocupadas,
      restantes: Math.max(c.limite - ocupadas, 0),
      lotada: ocupadas >= c.limite,
    };
  });
}

app.get('/api/turmas', (req, res) => {
  res.json(TURMAS);
});

app.get('/api/clubes', (req, res) => {
  res.json(getClubesComVagas());
});

// Transacao garante atomicidade: checagem de duplicidade + vagas + insercao nao podem
// ser intercaladas por outra requisicao concorrente (better-sqlite3 e sincrono) — mesmo
// que dois PCs enviem a mesma inscricao no mesmissimo instante, uma sempre e resolvida
// (e gravada) antes da outra comecar a ser processada.
const inscreverTx = db.transaction((nomeCompleto, turma, clubeId, teste = false) => {
  const nomeNormalizado = normalizar(nomeCompleto);

  // Trava de inscricao duplicada: mesmo aluno (nome normalizado) + mesma turma,
  // independente de ja ter escolhido o mesmo clube ou outro diferente.
  // Alunos com o mesmo nome em turmas DIFERENTES nao sao afetados por essa checagem.
  const jaInscrito = db
    .prepare(
      `SELECT i.clube_id, c.nome as clube_nome
       FROM inscricoes i
       JOIN clubes c ON c.id = i.clube_id
       WHERE i.turma = ? AND i.nome_normalizado = ?
       LIMIT 1`
    )
    .get(turma, nomeNormalizado);

  if (jaInscrito) {
    return {
      ok: false,
      status: 409,
      erro: `Este aluno ja esta inscrito em "${jaInscrito.clube_nome}". Nao e possivel se inscrever em mais de um clube.`,
    };
  }

  const clube = db.prepare('SELECT * FROM clubes WHERE id = ?').get(clubeId);
  if (!clube) {
    return { ok: false, status: 404, erro: 'Clube nao encontrado.' };
  }

  const { total } = db
    .prepare('SELECT COUNT(*) as total FROM inscricoes WHERE clube_id = ?')
    .get(clubeId);

  if (total >= clube.limite) {
    return { ok: false, status: 409, erro: `Vagas esgotadas para ${clube.nome}.` };
  }

  const info = db
    .prepare('INSERT INTO inscricoes (nome_completo, nome_normalizado, turma, clube_id, teste) VALUES (?, ?, ?, ?, ?)')
    .run(nomeCompleto, nomeNormalizado, turma, clubeId, teste ? 1 : 0);

  return { ok: true, id: info.lastInsertRowid };
});

app.post('/api/inscricoes', (req, res) => {
  const { nomeCompleto, turma, clubeId } = req.body || {};

  if (typeof nomeCompleto !== 'string' || nomeCompleto.trim().length < 3) {
    return res.status(400).json({ erro: 'Nome completo invalido.' });
  }
  const nomeTrim = nomeCompleto.trim();
  if (nomeTrim.split(/\s+/).filter(Boolean).length < 2) {
    return res.status(400).json({ erro: 'Digite nome e sobrenome completos.' });
  }
  if (typeof turma !== 'string' || !TURMAS.includes(turma)) {
    return res.status(400).json({ erro: 'Turma invalida.' });
  }
  const idNum = Number(clubeId);
  if (!Number.isInteger(idNum)) {
    return res.status(400).json({ erro: 'Clube invalido.' });
  }

  const resultado = inscreverTx(nomeTrim, turma, idNum);

  if (!resultado.ok) {
    return res.status(resultado.status).json({ erro: resultado.erro });
  }

  res.status(201).json({ ok: true, id: resultado.id });
});

// --- Area administrativa (fora da pasta public/, nunca acessivel a alunos) ---

const ADMIN_DIR = path.join(__dirname, 'admin');

app.get('/admin/login.html', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'login.html')));
app.get('/admin/login.js', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'login.js')));
app.get('/admin/admin.css', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'admin.css')));

app.post('/api/admin/login', (req, res) => {
  const { senha } = req.body || {};
  if (!senhaCorreta(senha)) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }
  const token = criarSessao();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: EM_PRODUCAO,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) destruirSessao(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/admin/', requireAdminPage, (req, res) => res.sendFile(path.join(ADMIN_DIR, 'index.html')));
app.get('/admin', requireAdminPage, (req, res) => res.redirect('/admin/'));
app.get('/admin/admin.js', requireAdminPage, (req, res) => res.sendFile(path.join(ADMIN_DIR, 'admin.js')));

app.get('/api/admin/inscricoes', requireAdminApi, (req, res) => {
  const clubes = getClubesComVagas();
  const inscritosPorClube = db
    .prepare('SELECT clube_id, nome_completo, turma, criado_em, teste FROM inscricoes ORDER BY clube_id, turma, nome_completo')
    .all();

  const resultado = clubes.map((c) => ({
    ...c,
    inscritos: inscritosPorClube
      .filter((i) => i.clube_id === c.id)
      .map((i) => ({ ...i, teste: !!i.teste })),
  }));

  res.json(resultado);
});

// Limpa inscricoes — usado durante a fase de testes, antes do uso real pelos alunos.
// escopo=teste  -> remove so as inscricoes marcadas como geradas para teste
// escopo=tudo   -> remove absolutamente todas as inscricoes (inclusive as feitas manualmente)
app.delete('/api/admin/inscricoes', requireAdminApi, (req, res) => {
  const escopo = req.query.escopo === 'tudo' ? 'tudo' : 'teste';
  const info =
    escopo === 'tudo'
      ? db.prepare('DELETE FROM inscricoes').run()
      : db.prepare('DELETE FROM inscricoes WHERE teste = 1').run();
  res.json({ ok: true, escopo, removidas: info.changes });
});

const NOMES_TESTE = [
  'Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'Joao', 'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Otavio', 'Patricia',
  'Rafael', 'Sofia', 'Thiago', 'Vitoria', 'Wesley', 'Yasmin', 'Caio', 'Beatriz',
];
const SOBRENOMES_TESTE = [
  'Silva', 'Souza', 'Oliveira', 'Santos', 'Costa', 'Pereira', 'Rodrigues', 'Almeida',
  'Nascimento', 'Lima', 'Araujo', 'Ferreira', 'Carvalho', 'Gomes', 'Martins', 'Rocha',
];

function nomeAleatorioTeste() {
  const nome = NOMES_TESTE[Math.floor(Math.random() * NOMES_TESTE.length)];
  const sobrenome = SOBRENOMES_TESTE[Math.floor(Math.random() * SOBRENOMES_TESTE.length)];
  const sobrenome2 = SOBRENOMES_TESTE[Math.floor(Math.random() * SOBRENOMES_TESTE.length)];
  return `${nome} ${sobrenome} ${sobrenome2} (teste)`;
}

// Gera inscricoes ficticias, passando pela MESMA validacao de vagas usada pelos alunos reais
// (nao e insercao "crua" no banco) — assim o comportamento observado e identico ao real,
// incluindo casos em que o clube sorteado ja esta lotado.
app.post('/api/admin/seed', requireAdminApi, (req, res) => {
  const quantidade = Math.min(Math.max(Number(req.body?.quantidade) || 50, 1), 500);
  const clubes = db.prepare('SELECT id FROM clubes').all();

  let aceitas = 0;
  let rejeitadas = 0;
  const porClubeRejeitada = {};

  for (let i = 0; i < quantidade; i++) {
    const clube = clubes[Math.floor(Math.random() * clubes.length)];
    const turma = TURMAS[Math.floor(Math.random() * TURMAS.length)];
    const nome = nomeAleatorioTeste();

    const resultado = inscreverTx(nome, turma, clube.id, true);
    if (resultado.ok) {
      aceitas++;
    } else {
      rejeitadas++;
      porClubeRejeitada[clube.id] = (porClubeRejeitada[clube.id] || 0) + 1;
    }
  }

  res.json({ ok: true, solicitado: quantidade, aceitas, rejeitadas, porClubeRejeitada });
});

app.get('/api/admin/export.xlsx', requireAdminApi, async (req, res) => {
  const apenasReais = req.query.apenasReais === '1';
  const workbook = await gerarWorkbook(db, { apenasReais });
  const dataHoje = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="inscricoes-clubes-${dataHoje}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

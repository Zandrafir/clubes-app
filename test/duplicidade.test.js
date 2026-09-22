// Testa a trava de inscricao duplicada: mesmo aluno (mesma turma) nao pode se
// inscrever duas vezes, nem no mesmo clube nem em clubes diferentes — mas
// alunos com o mesmo nome em turmas DIFERENTES continuam livres para se inscrever.

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'db', 'clubes.db');
const PORT = 4021;
const BASE_URL = `http://localhost:${PORT}`;

function limparBanco() {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = DB_FILE + suffix;
    if (!fs.existsSync(f)) continue;
    try { fs.unlinkSync(f); } catch (err) { if (err.code !== 'EBUSY') throw err; }
  }
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function esperarServidor(proc) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando servidor')), 10000);
    proc.stdout.on('data', (data) => {
      if (data.toString().includes('Servidor rodando')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.stderr.on('data', (data) => console.error('[server stderr]', data.toString()));
    proc.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Servidor saiu com codigo ${code}`));
    });
  });
}

async function inscrever(nome, turma, clubeId) {
  const res = await fetch(`${BASE_URL}/api/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomeCompleto: nome, turma, clubeId }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function falhar(msg) {
  throw new Error(`FALHA: ${msg}`);
}

async function main() {
  limparBanco();
  const serverProc = spawn('node', [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), ADMIN_PASSWORD: 'teste123' },
  });

  try {
    await esperarServidor(serverProc);
    console.log(`Servidor de teste no ar em ${BASE_URL}\n`);

    // 1) Aluno se inscreve normalmente no clube 1
    const r1 = await inscrever('Joao Oliveira Santos', '8ºA', 1);
    if (!r1.ok) falhar(`primeira inscricao deveria funcionar: ${JSON.stringify(r1.data)}`);
    console.log('  OK Primeira inscricao (clube 1) aceita normalmente.');

    // 2) MESMO aluno, MESMA turma, tenta se inscrever em outro clube -> bloqueado
    const r2 = await inscrever('Joao Oliveira Santos', '8ºA', 12);
    if (r2.ok) falhar('deveria bloquear: mesmo aluno tentando se inscrever num segundo clube diferente');
    if (r2.status !== 409) falhar(`status esperado 409, obtido ${r2.status}`);
    console.log(`  OK Bloqueado ao tentar clube diferente: "${r2.data.erro}"`);

    // 3) MESMO aluno, MESMA turma, tenta se inscrever de novo no MESMO clube -> tambem bloqueado
    const r3 = await inscrever('Joao Oliveira Santos', '8ºA', 1);
    if (r3.ok) falhar('deveria bloquear: mesmo aluno tentando se inscrever de novo no mesmo clube');
    if (r3.status !== 409) falhar(`status esperado 409, obtido ${r3.status}`);
    console.log(`  OK Bloqueado ao tentar o mesmo clube de novo: "${r3.data.erro}"`);

    // 4) MESMO nome digitado com variacao (acento/caixa/espaco) -> ainda bloqueado
    const r4 = await inscrever('  JOAO   OLIVEIRA SANTOS ', '8ºA', 3);
    if (r4.ok) falhar('deveria bloquear mesmo com variacao de caixa/espacamento');
    console.log(`  OK Bloqueado mesmo com nome digitado com variacao de formatacao: "${r4.data.erro}"`);

    // 5) MESMO nome, TURMA DIFERENTE (8ºB) -> deve ser PERMITIDO (aluno diferente)
    const r5 = await inscrever('Joao Oliveira Santos', '8ºB', 1);
    if (!r5.ok) falhar(`NAO deveria bloquear: mesmo nome mas turma diferente (8ºB) e outro aluno. Erro: ${JSON.stringify(r5.data)}`);
    console.log('  OK Mesmo nome em turma DIFERENTE foi permitido corretamente (aluno diferente).');

    // 6) Esse aluno de 8ºB tambem nao pode se inscrever duas vezes
    const r6 = await inscrever('Joao Oliveira Santos', '8ºB', 5);
    if (r6.ok) falhar('deveria bloquear: o aluno de 8ºB (ja inscrito no passo 5) tentando se inscrever de novo');
    console.log('  OK Aluno de 8ºB tambem travado ao tentar segunda inscricao.');

    // 7) Aluno completamente diferente, mesma turma 8ºA -> deve passar normalmente
    const r7 = await inscrever('Maria Eduarda Costa', '8ºA', 5);
    if (!r7.ok) falhar(`NAO deveria bloquear aluno diferente: ${JSON.stringify(r7.data)}`);
    console.log('  OK Aluno diferente na mesma turma (8ºA) se inscreve normalmente.');

    // 8) Concorrencia: mesmo aluno, mesma turma, duas requisicoes SIMULTANEAS para clubes
    //    diferentes (simula literalmente dois PCs enviando ao mesmo tempo) -> so uma pode passar
    const [c1, c2] = await Promise.all([
      inscrever('Pedro Henrique Alves', '9ºA', 7),
      inscrever('Pedro Henrique Alves', '9ºA', 8),
    ]);
    const aceitas = [c1, c2].filter((r) => r.ok);
    const rejeitadas = [c1, c2].filter((r) => !r.ok);
    if (aceitas.length !== 1) {
      falhar(`sob concorrencia simultanea, deveria aceitar exatamente 1 e rejeitar 1, mas aceitou ${aceitas.length}`);
    }
    if (rejeitadas[0].status !== 409) falhar(`rejeicao concorrente deveria ser 409, foi ${rejeitadas[0].status}`);
    console.log('  OK Duas tentativas SIMULTANEAS do mesmo aluno (dois PCs ao mesmo tempo): exatamente 1 aceita, 1 bloqueada.');

    console.log('\nTODOS OS TESTES DE DUPLICIDADE PASSARAM');
    process.exitCode = 0;
  } catch (err) {
    console.error('\nTESTE FALHOU:', err.message);
    process.exitCode = 1;
  } finally {
    serverProc.kill();
    await aguardar(300);
    limparBanco();
  }
}

main();

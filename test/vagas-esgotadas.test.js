const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'db', 'clubes.db');
const PORT = 4022;
const BASE_URL = `http://localhost:${PORT}`;

function limparBanco() {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = DB_FILE + suffix;
    if (!fs.existsSync(f)) continue;
    try {
      fs.unlinkSync(f);
    } catch (err) {
      if (err.code !== 'EBUSY') throw err;
    }
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
  return { status: res.status, ok: res.ok, data };
}

async function buscarClubes() {
  const res = await fetch(`${BASE_URL}/api/clubes`);
  return res.json();
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
    console.log(`Servidor de teste no ar em ${BASE_URL}`);

    let clubes = await buscarClubes();
    const jornalEscolar = clubes.find((c) => c.nome === 'Jornal Escolar');
    const LIMITE = jornalEscolar.limite; // 14 (o menor limite entre os clubes de exemplo)

    // 1) Preenche exatamente ate o limite, uma matricula por vez (sequencial, sem concorrencia)
    console.log(`\nPreenchendo sequencialmente as ${LIMITE} vagas de "Jornal Escolar"...`);
    for (let i = 1; i <= LIMITE; i++) {
      const r = await inscrever(`Aluno Sequencial ${i}`, '6ºA', jornalEscolar.id);
      if (!r.ok) falhar(`inscricao ${i}/${LIMITE} deveria ter sido aceita, mas foi rejeitada: ${JSON.stringify(r.data)}`);
    }
    console.log(`  OK ${LIMITE} inscricoes aceitas normalmente.`);

    // 2) Confirma que a API ja reporta o clube como lotado, sem vagas restantes
    clubes = await buscarClubes();
    let estado = clubes.find((c) => c.id === jornalEscolar.id);
    if (estado.ocupadas !== LIMITE) falhar(`ocupadas=${estado.ocupadas}, esperado ${LIMITE}`);
    if (estado.restantes !== 0) falhar(`restantes=${estado.restantes}, esperado 0`);
    if (!estado.lotada) falhar('campo "lotada" deveria ser true');
    console.log(`  OK API reporta corretamente: ocupadas=${LIMITE}, restantes=0, lotada=true.`);

    // 3) Tenta uma inscricao extra e garante que e REJEITADA com aviso claro
    const extra = await inscrever('Aluno Fora Do Limite', '6ºB', jornalEscolar.id);
    if (extra.ok) falhar('a inscricao extra foi ACEITA — overbooking real, falso negativo grave!');
    if (extra.status !== 409) falhar(`status esperado 409, obtido ${extra.status}`);
    if (!extra.data.erro || !extra.data.erro.toLowerCase().includes('esgotad')) {
      falhar(`mensagem de erro nao indica vagas esgotadas: ${JSON.stringify(extra.data)}`);
    }
    console.log(`  OK Inscricao extra corretamente rejeitada (HTTP 409): "${extra.data.erro}"`);

    // 4) Garante que a rejeicao NAO deixou residuo: contagem continua exatamente no limite
    clubes = await buscarClubes();
    estado = clubes.find((c) => c.id === jornalEscolar.id);
    if (estado.ocupadas !== LIMITE) {
      falhar(`apos rejeicao, ocupadas mudou para ${estado.ocupadas} — inscricao foi gravada mesmo tendo sido recusada!`);
    }
    console.log(`  OK Nenhum registro fantasma: contagem permanece em ${LIMITE} apos a rejeicao.`);

    // 5) Testa multiplas tentativas extras simultaneas (simula varios alunos tentando depois de lotado)
    const tentativasExtras = await Promise.all(
      Array.from({ length: 5 }, (_, i) => inscrever(`Aluno Retardatario ${i + 1}`, '7ºA', jornalEscolar.id))
    );
    if (tentativasExtras.some((r) => r.ok)) {
      falhar('alguma tentativa extra apos lotacao foi aceita indevidamente');
    }
    clubes = await buscarClubes();
    estado = clubes.find((c) => c.id === jornalEscolar.id);
    if (estado.ocupadas !== LIMITE) {
      falhar(`contagem final incorreta: ${estado.ocupadas}, esperado ${LIMITE}`);
    }
    console.log(`  OK 5 tentativas extras simultaneas todas rejeitadas, contagem permanece em ${LIMITE}.`);

    console.log('\nTODOS OS TESTES DE ESGOTAMENTO DE VAGAS PASSARAM');
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

/**
 * Backend do Sistema de Escolha de Clubes — E.E. PEI José Ephim Mindlin
 * Roda como Google Apps Script Web App, usando uma Planilha Google como banco de dados.
 *
 * Abas esperadas na planilha:
 *  - "Clubes":     ClubeID | Nome | Resumo | Presidente | Padrinho | VagasMax
 *  - "Inscricoes": Timestamp | NomeAluno | Turma | ClubeID | ClubeNome
 *  - "Config":     Chave | Valor   (linha "AdminSenha" | "<senha>")
 */

const SHEET_CLUBES = 'Clubes';
const SHEET_INSCRICOES = 'Inscricoes';
const SHEET_CONFIG = 'Config';

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'listarClubes') return jsonOut(listarClubes());
    if (action === 'listarInscricoes') return jsonOut(adminListarInscricoes(e.parameter.senha));
    return jsonOut({ ok: false, erro: 'Ação desconhecida.' });
  } catch (err) {
    return jsonOut({ ok: false, erro: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'inscrever') return jsonOut(inscrever(body));
    if (action === 'adminLogin') return jsonOut(adminLogin(body.senha));
    if (action === 'adminSimularLote') return jsonOut(adminSimularLote(body));
    if (action === 'adminLimparSimulacao') return jsonOut(adminLimparSimulacao(body.senha));
    if (action === 'adminExcluirInscricao') return jsonOut(adminExcluirInscricao(body));

    return jsonOut({ ok: false, erro: 'Ação desconhecida.' });
  } catch (err) {
    return jsonOut({ ok: false, erro: err.message });
  }
}

// ---------- Clubes / Vagas ----------

function listarClubes() {
  const sheet = getSS().getSheetByName(SHEET_CLUBES);
  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;
  const ocupacao = contarInscritosPorClube();

  const clubes = rows
    .filter(r => r[0] !== '')
    .map(r => {
      const clubeId = String(r[0]);
      return {
        id: clubeId,
        nome: r[1],
        resumo: r[2],
        presidente: r[3],
        padrinho: r[4],
        vagasMax: Number(r[5]) || 0,
        vagasOcupadas: ocupacao[clubeId] || 0,
      };
    });

  return { ok: true, clubes };
}

function contarInscritosPorClube() {
  const sheet = getSS().getSheetByName(SHEET_INSCRICOES);
  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;
  const contagem = {};
  rows.forEach(r => {
    const clubeId = String(r[3]);
    if (!clubeId) return;
    contagem[clubeId] = (contagem[clubeId] || 0) + 1;
  });
  return contagem;
}

// ---------- Inscrição (com trava de concorrência) ----------

function inscrever(body) {
  const nome = (body.nomeAluno || '').trim();
  const turma = (body.turma || '').trim();
  const clubeId = String(body.clubeId || '').trim();

  if (!nome || !turma || !clubeId) {
    return { ok: false, erro: 'Preencha nome, turma e clube.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // até 30s esperando a vez, evita corrida em lançamentos simultâneos

  try {
    const ss = getSS();
    const clubesSheet = ss.getSheetByName(SHEET_CLUBES);
    const inscricoesSheet = ss.getSheetByName(SHEET_INSCRICOES);

    // Carrega dados frescos DEPOIS de pegar o lock
    const clubesData = clubesSheet.getDataRange().getValues();
    const clube = clubesData.find(r => String(r[0]) === clubeId);
    if (!clube) return { ok: false, erro: 'Clube não encontrado.' };

    const vagasMax = Number(clube[5]) || 0;
    const inscricoesData = inscricoesSheet.getDataRange().getValues();
    const linhas = inscricoesData.slice(1);

    // Regra: mesmo aluno (nome + turma) não pode estar em mais de um clube
    const jaInscrito = linhas.find(
      r => String(r[1]).trim().toLowerCase() === nome.toLowerCase() &&
           String(r[2]).trim() === turma
    );
    if (jaInscrito) {
      return { ok: false, erro: `${nome} (${turma}) já está inscrito no clube "${jaInscrito[4]}".` };
    }

    // Verifica vaga disponível (contagem feita dentro do lock = seguro contra concorrência)
    const ocupadas = linhas.filter(r => String(r[3]) === clubeId).length;
    if (ocupadas >= vagasMax) {
      return { ok: false, erro: 'Vagas esgotadas para este clube.' };
    }

    inscricoesSheet.appendRow([new Date(), nome, turma, clubeId, clube[1]]);

    return {
      ok: true,
      mensagem: `Inscrição confirmada em "${clube[1]}"!`,
      vagasOcupadas: ocupadas + 1,
      vagasMax,
    };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Admin ----------

function getSenhaAdmin() {
  const sheet = getSS().getSheetByName(SHEET_CONFIG);
  const data = sheet.getDataRange().getValues();
  const linha = data.find(r => String(r[0]).trim() === 'AdminSenha');
  return linha ? String(linha[1]) : null;
}

function checarSenha(senha) {
  const esperado = getSenhaAdmin();
  return esperado !== null && senha === esperado;
}

function adminLogin(senha) {
  if (checarSenha(senha)) return { ok: true };
  return { ok: false, erro: 'Senha incorreta.' };
}

function adminListarInscricoes(senha) {
  if (!checarSenha(senha)) return { ok: false, erro: 'Senha incorreta.' };
  const sheet = getSS().getSheetByName(SHEET_INSCRICOES);
  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;
  const inscricoes = rows
    .filter(r => r[1] !== '')
    .map((r, i) => ({
      linha: i + 2,
      timestamp: r[0],
      nomeAluno: r[1],
      turma: r[2],
      clubeId: String(r[3]),
      clubeNome: r[4],
    }));
  return { ok: true, inscricoes };
}

function adminExcluirInscricao(body) {
  if (!checarSenha(body.senha)) return { ok: false, erro: 'Senha incorreta.' };
  const sheet = getSS().getSheetByName(SHEET_INSCRICOES);
  const linha = Number(body.linha);
  if (!linha || linha < 2) return { ok: false, erro: 'Linha inválida.' };
  sheet.deleteRow(linha);
  return { ok: true };
}

/**
 * Simula um lote de inscrições fictícias para testar limites de vaga e concorrência.
 * body: { senha, clubeId, quantidade }
 */
function adminSimularLote(body) {
  if (!checarSenha(body.senha)) return { ok: false, erro: 'Senha incorreta.' };

  const quantidade = Number(body.quantidade) || 0;
  const clubeId = String(body.clubeId || '');
  const turmasTeste = ['6ºA', '6ºB', '6ºC', '7ºA', '7ºB', '7ºC', '8ºA', '8ºB', '8ºC', '8ºD', '8ºE', '9ºA', '9ºB', '9ºC', '9ºD', '9ºE'];

  const resultados = { sucesso: 0, falha: 0, erros: [] };

  for (let i = 0; i < quantidade; i++) {
    const nomeFake = `Aluno Teste ${Utilities.getUuid().slice(0, 8)}`;
    const turmaFake = turmasTeste[i % turmasTeste.length];
    const resultado = inscrever({ nomeAluno: nomeFake, turma: turmaFake, clubeId });
    if (resultado.ok) {
      resultados.sucesso++;
    } else {
      resultados.falha++;
      resultados.erros.push(resultado.erro);
    }
  }

  return { ok: true, resultados };
}

/** Remove todas as inscrições cujo nome começa com "Aluno Teste" (limpa dados de simulação). */
function adminLimparSimulacao(senha) {
  if (!checarSenha(senha)) return { ok: false, erro: 'Senha incorreta.' };
  const sheet = getSS().getSheetByName(SHEET_INSCRICOES);
  const data = sheet.getDataRange().getValues();

  let removidas = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]).startsWith('Aluno Teste')) {
      sheet.deleteRow(i + 1);
      removidas++;
    }
  }
  return { ok: true, removidas };
}

/**
 * Cria as abas e cabeçalhos iniciais na planilha ativa. Rode uma vez manualmente
 * pelo editor de Apps Script (menu "Executar" > selecionar "setupPlanilha").
 */
function setupPlanilha() {
  const ss = getSS();

  if (!ss.getSheetByName(SHEET_CLUBES)) {
    const s = ss.insertSheet(SHEET_CLUBES);
    s.appendRow(['ClubeID', 'Nome', 'Resumo', 'Presidente', 'Padrinho', 'VagasMax']);
  }
  if (!ss.getSheetByName(SHEET_INSCRICOES)) {
    const s = ss.insertSheet(SHEET_INSCRICOES);
    s.appendRow(['Timestamp', 'NomeAluno', 'Turma', 'ClubeID', 'ClubeNome']);
  }
  if (!ss.getSheetByName(SHEET_CONFIG)) {
    const s = ss.insertSheet(SHEET_CONFIG);
    s.appendRow(['Chave', 'Valor']);
    s.appendRow(['AdminSenha', 'troque-esta-senha']);
  }
}

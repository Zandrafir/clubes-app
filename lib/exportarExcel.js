const ExcelJS = require('exceljs');

// O SQLite grava criado_em em UTC (datetime('now')). Para exibir no horario
// real do Brasil (UTC-3), convertemos aqui antes de escrever na planilha —
// o painel admin ao vivo ja faz essa conversao no navegador, mas o Excel
// precisa do texto ja formatado (licao aprendida no eletivas-app: o export
// esqueceu de converter uma vez e mostrou hora errada).
function formatarDataBrasil(criadoEmUtc) {
  const dataUtc = new Date(criadoEmUtc.replace(' ', 'T') + 'Z');
  return dataUtc.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

async function gerarWorkbook(db, { apenasReais = false } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Escolha de Clubes';
  workbook.created = new Date();

  const filtroTeste = apenasReais ? 'AND teste = 0' : '';

  const clubes = db.prepare('SELECT * FROM clubes ORDER BY id').all();

  const resumo = workbook.addWorksheet('Resumo');
  resumo.columns = [
    { header: 'Clube', key: 'nome', width: 28 },
    { header: 'Presidente', key: 'presidente', width: 22 },
    { header: 'Padrinho', key: 'padrinho', width: 22 },
    { header: 'Limite de Vagas', key: 'limite', width: 16 },
    { header: 'Inscritos', key: 'ocupadas', width: 12 },
    { header: 'Vagas Restantes', key: 'restantes', width: 16 },
  ];
  resumo.getRow(1).font = { bold: true };

  for (const clube of clubes) {
    const { total } = db
      .prepare(`SELECT COUNT(*) as total FROM inscricoes WHERE clube_id = ? ${filtroTeste}`)
      .get(clube.id);
    resumo.addRow({
      nome: clube.nome,
      presidente: clube.presidente,
      padrinho: clube.padrinho,
      limite: clube.limite,
      ocupadas: total,
      restantes: Math.max(clube.limite - total, 0),
    });

    const nomeAba = clube.nome.slice(0, 31).replace(/[\\/*?:[\]]/g, '-');
    const aba = workbook.addWorksheet(nomeAba || `Clube ${clube.id}`);
    aba.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'Nome Completo', key: 'nome_completo', width: 34 },
      { header: 'Turma', key: 'turma', width: 10 },
      { header: 'Data da Inscricao', key: 'criado_em', width: 20 },
      { header: 'Presenca', key: 'presenca', width: 12 },
      { header: 'E teste?', key: 'teste', width: 10 },
    ];
    aba.getRow(1).font = { bold: true };

    const inscritos = db
      .prepare(`SELECT nome_completo, turma, criado_em, teste FROM inscricoes WHERE clube_id = ? ${filtroTeste} ORDER BY turma, nome_completo`)
      .all(clube.id);

    inscritos.forEach((inscrito, idx) => {
      aba.addRow({
        num: idx + 1,
        nome_completo: inscrito.nome_completo,
        turma: inscrito.turma,
        criado_em: formatarDataBrasil(inscrito.criado_em),
        presenca: '',
        teste: inscrito.teste ? 'Sim' : '',
      });
    });
  }

  return workbook;
}

module.exports = { gerarWorkbook };

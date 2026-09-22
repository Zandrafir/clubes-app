let senhaAdmin = '';
let clubesCache = [];
let inscricoesCache = [];

document.getElementById('btn-login').addEventListener('click', fazerLogin);
document.getElementById('input-senha').addEventListener('keydown', e => {
  if (e.key === 'Enter') fazerLogin();
});

async function fazerLogin() {
  const senha = document.getElementById('input-senha').value;
  const msg = document.getElementById('login-msg');
  msg.innerHTML = '<p>Verificando...</p>';

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'adminLogin', senha }),
    });
    const data = await resp.json();
    if (!data.ok) {
      msg.innerHTML = `<div class="mensagem erro">${data.erro}</div>`;
      return;
    }
    senhaAdmin = senha;
    document.getElementById('login-box').classList.remove('ativo');
    document.getElementById('painel-box').classList.add('ativo');
    await atualizarTudo();
  } catch (err) {
    msg.innerHTML = `<div class="mensagem erro">Erro de conexão.</div>`;
  }
}

document.getElementById('btn-atualizar').addEventListener('click', atualizarTudo);

async function atualizarTudo() {
  await Promise.all([carregarClubes(), carregarInscricoes()]);
  preencherSelectClubes();
  renderResumoVagas();
  renderTabelaInscricoes();
}

async function carregarClubes() {
  const resp = await fetch(`${APPS_SCRIPT_URL}?action=listarClubes`);
  const data = await resp.json();
  clubesCache = data.ok ? data.clubes : [];
}

async function carregarInscricoes() {
  const resp = await fetch(`${APPS_SCRIPT_URL}?action=listarInscricoes&senha=${encodeURIComponent(senhaAdmin)}`);
  const data = await resp.json();
  inscricoesCache = data.ok ? data.inscricoes : [];
}

function renderResumoVagas() {
  const container = document.getElementById('resumo-vagas');
  container.innerHTML = clubesCache.map(c => `
    <div class="linha-vaga">
      <span>${c.nome}</span>
      <strong>${c.vagasOcupadas} / ${c.vagasMax}</strong>
    </div>
  `).join('') || '<p>Nenhum clube cadastrado ainda.</p>';
}

function preencherSelectClubes() {
  const select = document.getElementById('select-clube-simular');
  select.innerHTML = clubesCache.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
}

function renderTabelaInscricoes() {
  const tbody = document.querySelector('#tabela-inscricoes tbody');
  tbody.innerHTML = inscricoesCache.map(i => `
    <tr>
      <td>${new Date(i.timestamp).toLocaleString('pt-BR')}</td>
      <td>${i.nomeAluno}</td>
      <td>${i.turma}</td>
      <td>${i.clubeNome}</td>
      <td><button class="btn btn-secundario" data-excluir="${i.linha}">Excluir</button></td>
    </tr>
  `).join('') || '<tr><td colspan="5">Nenhuma inscrição ainda.</td></tr>';

  tbody.querySelectorAll('[data-excluir]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir esta inscrição?')) return;
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'adminExcluirInscricao', senha: senhaAdmin, linha: btn.dataset.excluir }),
      });
      await atualizarTudo();
    });
  });
}

// ---------- Simulação de lote ----------
document.getElementById('btn-simular').addEventListener('click', async () => {
  const clubeId = document.getElementById('select-clube-simular').value;
  const quantidade = Number(document.getElementById('input-quantidade').value) || 0;
  const msg = document.getElementById('mensagem-simulacao');
  msg.innerHTML = '<p>Rodando simulação...</p>';

  const resp = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'adminSimularLote', senha: senhaAdmin, clubeId, quantidade }),
  });
  const data = await resp.json();

  if (!data.ok) {
    msg.innerHTML = `<div class="mensagem erro">${data.erro}</div>`;
    return;
  }

  const r = data.resultados;
  msg.innerHTML = `<div class="mensagem sucesso">Simulação concluída: ${r.sucesso} sucesso(s), ${r.falha} falha(s) (ex: vagas esgotadas).</div>`;
  await atualizarTudo();
});

document.getElementById('btn-limpar-simulacao').addEventListener('click', async () => {
  if (!confirm('Remover todas as inscrições de teste ("Aluno Teste...")?')) return;
  const resp = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'adminLimparSimulacao', senha: senhaAdmin }),
  });
  const data = await resp.json();
  document.getElementById('mensagem-simulacao').innerHTML =
    `<div class="mensagem sucesso">${data.removidas} inscrições de teste removidas.</div>`;
  await atualizarTudo();
});

// ---------- Exportar Excel (lista de chamada por clube) ----------
document.getElementById('btn-exportar').addEventListener('click', async () => {
  const workbook = new ExcelJS.Workbook();

  clubesCache.forEach(clube => {
    const sheet = workbook.addWorksheet(clube.nome.substring(0, 31)); // limite do Excel para nome de aba
    sheet.columns = [
      { header: 'Nº', key: 'n', width: 6 },
      { header: 'Nome do Aluno', key: 'nome', width: 36 },
      { header: 'Turma', key: 'turma', width: 12 },
      { header: 'Presença', key: 'presenca', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };

    const alunos = inscricoesCache
      .filter(i => i.clubeId === clube.id)
      .sort((a, b) => a.nomeAluno.localeCompare(b.nomeAluno, 'pt-BR'));

    alunos.forEach((aluno, idx) => {
      sheet.addRow({ n: idx + 1, nome: aluno.nomeAluno, turma: aluno.turma, presenca: '' });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Lista_Clubes_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
});

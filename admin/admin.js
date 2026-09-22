const tabelaClubes = document.getElementById('tabela-clubes');
const atualizadoEm = document.getElementById('atualizado-em');
const detalheBox = document.getElementById('detalhe-clube');
const detalheTitulo = document.getElementById('detalhe-titulo');
const detalheTbody = document.getElementById('detalhe-tbody');
const btnExportar = document.getElementById('btn-exportar');
const btnSair = document.getElementById('btn-sair');
const btnSeed = document.getElementById('btn-seed');
const qtdSeed = document.getElementById('qtd-seed');
const btnLimparTeste = document.getElementById('btn-limpar-teste');
const btnLimparTudo = document.getElementById('btn-limpar-tudo');
const resultadoSeed = document.getElementById('resultado-seed');

async function carregarDados() {
  const res = await fetch('/api/admin/inscricoes');
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    return;
  }
  const clubes = await res.json();

  tabelaClubes.innerHTML = '';
  for (const c of clubes) {
    const qtdTeste = c.inscritos.filter((i) => i.teste).length;
    const tr = document.createElement('tr');
    tr.dataset.id = c.id;
    tr.innerHTML = `
      <td>${c.nome}</td>
      <td>${c.presidente}</td>
      <td>${c.padrinho}</td>
      <td class="${c.ocupadas >= c.limite ? 'badge-cheia' : ''}">${c.ocupadas}/${c.limite}</td>
      <td>${c.inscritos.length} inscrito(s)${qtdTeste ? ` (${qtdTeste} de teste)` : ''} — clique para ver</td>
    `;
    tr.addEventListener('click', () => mostrarDetalhe(c));
    tabelaClubes.appendChild(tr);
  }

  atualizadoEm.textContent = `Atualizado em ${new Date().toLocaleTimeString('pt-BR')}`;
}

function mostrarDetalhe(clube) {
  detalheTitulo.textContent = `${clube.nome} — Presidente: ${clube.presidente} / Padrinho: ${clube.padrinho} (${clube.inscritos.length}/${clube.limite})`;
  detalheTbody.innerHTML = '';
  clube.inscritos.forEach((i, idx) => {
    const tr = document.createElement('tr');
    const data = new Date(i.criado_em + 'Z').toLocaleString('pt-BR');
    const marcaTeste = i.teste ? ' <span style="color:#b06000;font-size:0.75em;">(teste)</span>' : '';
    tr.innerHTML = `<td>${idx + 1}</td><td>${i.nome_completo}${marcaTeste}</td><td>${i.turma}</td><td>${data}</td>`;
    detalheTbody.appendChild(tr);
  });
  detalheBox.hidden = false;
  detalheBox.scrollIntoView({ behavior: 'smooth' });
}

btnExportar.addEventListener('click', () => {
  window.location.href = '/api/admin/export.xlsx';
});

btnSair.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

btnSeed.addEventListener('click', async () => {
  const quantidade = Math.min(Math.max(Number(qtdSeed.value) || 0, 1), 500);
  btnSeed.disabled = true;
  btnSeed.textContent = 'Gerando...';
  try {
    const res = await fetch('/api/admin/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantidade }),
    });
    const data = await res.json();
    if (!res.ok) {
      resultadoSeed.textContent = `Erro ao gerar dados: ${data.erro || res.status}`;
      return;
    }
    resultadoSeed.textContent =
      `Solicitado: ${data.solicitado} | Aceitas: ${data.aceitas} | Rejeitadas por falta de vaga: ${data.rejeitadas}\n` +
      (data.rejeitadas > 0
        ? 'Isso é esperado: quando o sorteio caiu num clube já cheio, a inscrição foi barrada — igual aconteceria com um aluno de verdade.'
        : '');
    await carregarDados();
  } catch (err) {
    resultadoSeed.textContent = 'Erro de conexão ao gerar dados de teste.';
  } finally {
    btnSeed.disabled = false;
    btnSeed.textContent = 'Gerar';
  }
});

btnLimparTeste.addEventListener('click', async () => {
  if (!confirm('Remover apenas as inscrições marcadas como "teste"? As inscrições reais/manuais não serão afetadas.')) return;
  const res = await fetch('/api/admin/inscricoes?escopo=teste', { method: 'DELETE' });
  const data = await res.json();
  resultadoSeed.textContent = `${data.removidas} inscrição(ões) de teste removida(s).`;
  await carregarDados();
  detalheBox.hidden = true;
});

btnLimparTudo.addEventListener('click', async () => {
  const confirmacao = prompt(
    'Isso vai apagar TODAS as inscrições, inclusive as feitas manualmente por você.\n\n' +
    'ATENÇÃO: não é a sua senha de admin — digite a palavra CONFIRMAR (sem acentos, sem espaços) para prosseguir:'
  );

  if (confirmacao === null) {
    return; // usuário clicou em cancelar
  }

  if (confirmacao.trim().toUpperCase() !== 'CONFIRMAR') {
    resultadoSeed.textContent = 'Limpeza cancelada: você precisa digitar exatamente a palavra CONFIRMAR (não é a senha de admin) para apagar tudo.';
    return;
  }

  const res = await fetch('/api/admin/inscricoes?escopo=tudo', { method: 'DELETE' });
  const data = await res.json();
  resultadoSeed.textContent = `${data.removidas} inscrição(ões) removida(s) (todas as listas zeradas).`;
  await carregarDados();
  detalheBox.hidden = true;
});

carregarDados();
setInterval(carregarDados, 10000);

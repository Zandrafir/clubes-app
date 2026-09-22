const estado = {
  clubeId: null,
  clubeNome: '',
};

let clubesCache = [];
let pollingTimer = null;

function corPorPercentual(pct) {
  if (pct >= 85) return 'vermelho';
  if (pct >= 50) return 'amarelo';
  return '';
}

// ---------- Turmas (mini-cards agrupados por série) ----------
function montarGridTurmas() {
  const container = document.getElementById('turmas-grupos');
  container.innerHTML = '';
  TURMAS.forEach(bloco => {
    const serieNum = bloco.serie.split('º')[0];
    const grupo = document.createElement('div');
    grupo.className = 'turma-grupo';
    grupo.innerHTML = `<span class="turma-grupo-label">${bloco.serie}</span><div class="turma-grupo-botoes"></div>`;
    const botoes = grupo.querySelector('.turma-grupo-botoes');
    bloco.letras.forEach(letra => {
      const codigo = `${serieNum}º${letra}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'turma-card';
      btn.textContent = codigo;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.turma-card').forEach(c => c.classList.remove('selecionada'));
        btn.classList.add('selecionada');
        estado.turma = codigo;
      });
      botoes.appendChild(btn);
    });
    container.appendChild(grupo);
  });
}

// ---------- Carregamento e renderização de clubes ----------
async function carregarClubes(silencioso) {
  const msg = document.getElementById('mensagem-clubes');
  if (!silencioso) msg.innerHTML = '<p>Carregando clubes...</p>';

  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?action=listarClubes`);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.erro || 'Erro ao carregar clubes.');

    clubesCache = data.clubes;
    msg.innerHTML = clubesCache.length ? '' : '<p>Nenhum clube cadastrado ainda.</p>';
    renderVagasSidebar();
    renderGridClubes();
  } catch (err) {
    if (!silencioso) msg.innerHTML = `<div class="alert">Não foi possível carregar os clubes. ${err.message}</div>`;
  }
}

function renderVagasSidebar() {
  const lista = document.getElementById('vagas-lista');
  lista.innerHTML = clubesCache.map(c => {
    const pct = c.vagasMax > 0 ? Math.min(100, Math.round((c.vagasOcupadas / c.vagasMax) * 100)) : 0;
    const cor = corPorPercentual(pct);
    return `
      <li>
        <div class="vaga-item-nome">
          <span>${c.nome}</span>
          <span class="vaga-contador ${cor}">${c.vagasOcupadas}/${c.vagasMax}</span>
        </div>
        <div class="vaga-barra-fundo"><div class="vaga-barra-preenchida ${cor}" style="width:${pct}%"></div></div>
      </li>
    `;
  }).join('');
}

function renderGridClubes() {
  const grid = document.getElementById('grid-clubes');
  grid.innerHTML = '';

  clubesCache.forEach(clube => {
    const pct = clube.vagasMax > 0 ? Math.min(100, Math.round((clube.vagasOcupadas / clube.vagasMax) * 100)) : 0;
    const lotado = clube.vagasOcupadas >= clube.vagasMax;
    const cor = corPorPercentual(pct);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `clube-card${lotado ? ' lotada' : ''}${estado.clubeId === clube.id ? ' selecionada' : ''}`;
    card.innerHTML = `
      <span class="nome">${clube.nome}</span>
      <span class="padrinho">Padrinho: ${clube.padrinho}</span>
      <span class="presidente">Presidente: ${clube.presidente}</span>
      <span class="resumo">${clube.resumo}</span>
      <span class="vaga-tag ${cor}">${lotado ? 'Esgotado' : `${clube.vagasOcupadas}/${clube.vagasMax} vagas`}</span>
      <div class="mini-barra-fundo"><div class="mini-barra-preenchida ${cor}" style="width:${pct}%"></div></div>
    `;

    if (!lotado) {
      card.addEventListener('click', () => {
        estado.clubeId = clube.id;
        estado.clubeNome = clube.nome;
        renderGridClubes();
      });
    }

    grid.appendChild(card);
  });
}

// ---------- Envio do formulário ----------
document.getElementById('form-inscricao').addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const nome = document.getElementById('input-nome').value.trim();
  const alertBox = document.getElementById('alert-box');
  alertBox.hidden = true;

  if (nome.length < 3 || nome.split(' ').filter(Boolean).length < 2) {
    alertBox.textContent = 'Digite seu nome completo (nome e sobrenome).';
    alertBox.hidden = false;
    return;
  }
  if (!estado.turma) {
    alertBox.textContent = 'Selecione sua turma.';
    alertBox.hidden = false;
    return;
  }
  if (!estado.clubeId) {
    alertBox.textContent = 'Selecione um clube.';
    alertBox.hidden = false;
    return;
  }

  const btn = document.getElementById('btn-enviar');
  btn.disabled = true;
  btn.innerHTML = '<span>Enviando...</span>';

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'inscrever',
        nomeAluno: nome,
        turma: estado.turma,
        clubeId: estado.clubeId,
      }),
    });
    const data = await resp.json();

    if (!data.ok) {
      alertBox.textContent = data.erro;
      alertBox.hidden = false;
      btn.disabled = false;
      btn.innerHTML = '<span>Confirmar Inscrição</span>';
      return;
    }

    document.getElementById('success-text').textContent =
      `${nome}, sua vaga no clube "${estado.clubeNome}" está garantida!`;
    document.getElementById('form-inscricao').hidden = true;
    document.getElementById('success-box').hidden = false;
    clearInterval(pollingTimer);
  } catch (err) {
    alertBox.textContent = 'Erro de conexão. Tente novamente.';
    alertBox.hidden = false;
    btn.disabled = false;
    btn.innerHTML = '<span>Confirmar Inscrição</span>';
  }
});

document.getElementById('btn-nova').addEventListener('click', () => location.reload());

montarGridTurmas();
carregarClubes(false);
pollingTimer = setInterval(() => carregarClubes(true), 4000);

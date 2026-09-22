// Estado da inscrição
const estado = {
  nome: '',
  turma: '',
  clubeId: null,
  clubeNome: '',
  presidente: '',
  padrinho: '',
};

let clubesCache = [];

function mostrarPasso(id) {
  document.querySelectorAll('.passo').forEach(p => p.classList.remove('ativo'));
  document.getElementById(id).classList.add('ativo');
}

document.querySelectorAll('[data-voltar]').forEach(btn => {
  btn.addEventListener('click', () => mostrarPasso(btn.dataset.voltar));
});

// ---------- Passo 1: Nome ----------
document.getElementById('btn-nome-avancar').addEventListener('click', () => {
  const nome = document.getElementById('input-nome').value.trim();
  if (nome.length < 3) {
    alert('Digite seu nome completo.');
    return;
  }
  estado.nome = nome;
  mostrarPasso('passo-turma');
});

// ---------- Passo 2: Turma ----------
function montarGridTurmas() {
  const container = document.getElementById('grid-series');
  TURMAS.forEach(bloco => {
    const div = document.createElement('div');
    div.className = 'serie-bloco';
    div.innerHTML = `<h3>${bloco.serie}</h3><div class="grid-cards"></div>`;
    const grid = div.querySelector('.grid-cards');
    bloco.letras.forEach(letra => {
      const codigo = `${bloco.serie.split('º')[0]}º${letra}`;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card-turma';
      card.textContent = codigo;
      card.addEventListener('click', () => {
        document.querySelectorAll('.card-turma').forEach(c => c.classList.remove('selecionada'));
        card.classList.add('selecionada');
        estado.turma = codigo;
        document.getElementById('btn-turma-avancar').disabled = false;
      });
      grid.appendChild(card);
    });
    container.appendChild(div);
  });
}

document.getElementById('btn-turma-avancar').addEventListener('click', async () => {
  mostrarPasso('passo-clube');
  await carregarClubes();
});

// ---------- Passo 3: Clubes ----------
async function carregarClubes() {
  const msg = document.getElementById('mensagem-clubes');
  const grid = document.getElementById('grid-clubes');
  grid.innerHTML = '';
  msg.innerHTML = '<p>Carregando clubes...</p>';

  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?action=listarClubes`);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.erro || 'Erro ao carregar clubes.');

    clubesCache = data.clubes;
    msg.innerHTML = '';
    renderClubes();
  } catch (err) {
    msg.innerHTML = `<div class="mensagem erro">Não foi possível carregar os clubes. ${err.message}</div>`;
  }
}

function renderClubes() {
  const grid = document.getElementById('grid-clubes');
  grid.innerHTML = '';

  clubesCache.forEach(clube => {
    const lotado = clube.vagasOcupadas >= clube.vagasMax;
    const pct = clube.vagasMax > 0 ? Math.min(100, (clube.vagasOcupadas / clube.vagasMax) * 100) : 0;

    const card = document.createElement('div');
    card.className = `card-clube${lotado ? ' lotado' : ''}${estado.clubeId === clube.id ? ' selecionado' : ''}`;
    card.innerHTML = `
      ${lotado ? '<span class="badge-lotado">Vagas esgotadas</span>' : ''}
      <h3>${clube.nome}</h3>
      <p class="professor">Presidente: ${clube.presidente}</p>
      <p class="professor">Padrinho: ${clube.padrinho}</p>
      <p class="resumo">${clube.resumo}</p>
      <div class="vagas-barra"><div class="preenchido" style="width:${pct}%"></div></div>
      <div class="vagas-texto"><span>${clube.vagasOcupadas} inscritos</span><span>${clube.vagasMax} vagas</span></div>
    `;

    if (!lotado) {
      card.addEventListener('click', () => {
        estado.clubeId = clube.id;
        estado.clubeNome = clube.nome;
        estado.presidente = clube.presidente;
        estado.padrinho = clube.padrinho;
        document.getElementById('btn-clube-avancar').disabled = false;
        renderClubes();
      });
    }

    grid.appendChild(card);
  });
}

document.getElementById('btn-clube-avancar').addEventListener('click', () => {
  document.getElementById('resumo-nome').textContent = estado.nome;
  document.getElementById('resumo-turma').textContent = estado.turma;
  document.getElementById('resumo-clube').textContent = estado.clubeNome;
  document.getElementById('resumo-presidente').textContent = estado.presidente;
  document.getElementById('resumo-padrinho').textContent = estado.padrinho;
  document.getElementById('mensagem-confirmar').innerHTML = '';
  mostrarPasso('passo-confirmar');
});

// ---------- Passo 4: Confirmar envio ----------
document.getElementById('btn-confirmar-envio').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirmar-envio');
  const msg = document.getElementById('mensagem-confirmar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enviando...';

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS no Apps Script
      body: JSON.stringify({
        action: 'inscrever',
        nomeAluno: estado.nome,
        turma: estado.turma,
        clubeId: estado.clubeId,
      }),
    });
    const data = await resp.json();

    if (!data.ok) {
      msg.innerHTML = `<div class="mensagem erro">${data.erro}</div>`;
      btn.disabled = false;
      btn.textContent = 'Confirmar Inscrição';
      return;
    }

    document.getElementById('texto-sucesso').textContent =
      `${estado.nome}, sua vaga no clube "${estado.clubeNome}" está garantida!`;
    mostrarPasso('passo-sucesso');
  } catch (err) {
    msg.innerHTML = `<div class="mensagem erro">Erro de conexão. Tente novamente.</div>`;
    btn.disabled = false;
    btn.textContent = 'Confirmar Inscrição';
  }
});

montarGridTurmas();

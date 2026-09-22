const vagasLista = document.getElementById('vagas-lista');
const form = document.getElementById('form-inscricao');
const turmaInput = document.getElementById('turma');
const turmasGrupos = document.getElementById('turmas-grupos');
const clubeInput = document.getElementById('clubeId');
const gridClubes = document.getElementById('grid-clubes');
const alertBox = document.getElementById('alert-box');
const btnEnviar = document.getElementById('btn-enviar');
const successBox = document.getElementById('success-box');
const successText = document.getElementById('success-text');
const btnNova = document.getElementById('btn-nova');

function corPorOcupacao(ocupadas, limite) {
  const pct = limite > 0 ? ocupadas / limite : 0;
  if (pct >= 0.85) return 'vermelho';
  if (pct >= 0.5) return 'amarelo';
  return '';
}

function mostrarErro(msg) {
  alertBox.textContent = msg;
  alertBox.hidden = false;
}

function limparErro() {
  alertBox.hidden = true;
  alertBox.textContent = '';
}

async function carregarTurmas() {
  const res = await fetch('/api/turmas');
  const turmas = await res.json();

  const grupos = new Map();
  for (const t of turmas) {
    const serie = t.charAt(0);
    if (!grupos.has(serie)) grupos.set(serie, []);
    grupos.get(serie).push(t);
  }

  turmasGrupos.innerHTML = '';
  for (const [serie, turmasDoGrupo] of grupos) {
    const grupoEl = document.createElement('div');
    grupoEl.className = 'turma-grupo';

    const labelEl = document.createElement('span');
    labelEl.className = 'turma-grupo-label';
    labelEl.textContent = `${serie}º Ano`;
    grupoEl.appendChild(labelEl);

    const botoesEl = document.createElement('div');
    botoesEl.className = 'turma-grupo-botoes';

    for (const t of turmasDoGrupo) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'turma-card';
      btn.dataset.turma = t;
      btn.textContent = t;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.addEventListener('click', () => selecionarTurma(t));
      botoesEl.appendChild(btn);
    }

    grupoEl.appendChild(botoesEl);
    turmasGrupos.appendChild(grupoEl);
  }
}

function selecionarTurma(turma) {
  turmaInput.value = turma;
  turmasGrupos.querySelectorAll('.turma-card').forEach((btn) => {
    const selecionado = btn.dataset.turma === turma;
    btn.classList.toggle('selecionada', selecionado);
    btn.setAttribute('aria-checked', String(selecionado));
  });
}

function renderizarVagas(clubes) {
  vagasLista.innerHTML = clubes.map((c) => {
    const pct = Math.min(100, Math.round((c.ocupadas / c.limite) * 100));
    const cor = corPorOcupacao(c.ocupadas, c.limite);
    return `
      <li>
        <div class="vaga-item-nome">
          <span>${c.nome}</span>
          <span class="vaga-contador ${cor}">${c.ocupadas}/${c.limite}</span>
        </div>
        <div class="vaga-barra-fundo"><div class="vaga-barra-preenchida ${cor}" style="width:${pct}%"></div></div>
      </li>
    `;
  }).join('');
}

function renderizarGridClubes(clubes) {
  const selecionadoAntes = clubeInput.value;
  gridClubes.innerHTML = '';

  for (const c of clubes) {
    const pct = Math.min(100, Math.round((c.ocupadas / c.limite) * 100));
    const cor = corPorOcupacao(c.ocupadas, c.limite);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'clube-card' + (c.lotada ? ' lotada' : '');
    card.dataset.id = c.id;
    card.dataset.nome = c.nome;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.disabled = c.lotada;

    card.innerHTML = `
      <span class="nome">${c.nome}</span>
      <span class="padrinho">Padrinho: ${c.padrinho}</span>
      <span class="presidente">Presidente: ${c.presidente}</span>
      <span class="resumo">${c.resumo}</span>
      <span class="vaga-tag ${cor}">${c.lotada ? 'Esgotado' : `${c.ocupadas}/${c.limite} vagas`}</span>
      <div class="mini-barra-fundo"><div class="mini-barra-preenchida ${cor}" style="width:${pct}%"></div></div>
    `;

    if (!c.lotada) {
      card.addEventListener('click', () => selecionarClube(c.id));
    }

    gridClubes.appendChild(card);
  }

  if (selecionadoAntes) {
    const aindaExiste = clubes.find((c) => String(c.id) === String(selecionadoAntes) && !c.lotada);
    if (aindaExiste) {
      selecionarClube(selecionadoAntes);
    } else {
      clubeInput.value = '';
    }
  }
}

function selecionarClube(id) {
  clubeInput.value = id;
  gridClubes.querySelectorAll('.clube-card').forEach((card) => {
    const selecionado = String(card.dataset.id) === String(id);
    card.classList.toggle('selecionada', selecionado);
    card.setAttribute('aria-checked', String(selecionado));
  });
}

async function carregarClubes() {
  const res = await fetch('/api/clubes');
  const clubes = await res.json();

  renderizarVagas(clubes);
  renderizarGridClubes(clubes);

  return clubes;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparErro();

  const nomeCompleto = document.getElementById('nomeCompleto').value.trim();
  const turma = turmaInput.value;
  const clubeId = clubeInput.value;
  const qtdPalavrasNome = nomeCompleto.split(/\s+/).filter(Boolean).length;

  if (nomeCompleto.length < 3 || !turma || !clubeId) {
    mostrarErro('Preencha todos os campos obrigatórios, incluindo a escolha de um clube.');
    return;
  }

  if (qtdPalavrasNome < 2) {
    mostrarErro('Digite seu nome completo (nome e pelo menos um sobrenome).');
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.querySelector('span').textContent = 'Enviando...';

  try {
    const res = await fetch('/api/inscricoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeCompleto, turma, clubeId }),
    });
    const data = await res.json();

    if (!res.ok) {
      mostrarErro(data.erro || 'Não foi possível concluir a inscrição.');
      await carregarClubes();
      return;
    }

    const cardSelecionado = gridClubes.querySelector(`.clube-card[data-id="${clubeId}"]`);
    const nomeClube = cardSelecionado ? cardSelecionado.dataset.nome : 'seu clube';
    successText.textContent = `${nomeCompleto}, sua inscrição em "${nomeClube}" foi registrada com sucesso.`;
    form.hidden = true;
    successBox.hidden = false;
  } catch (err) {
    mostrarErro('Erro de conexão. Tente novamente.');
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.querySelector('span').textContent = 'Confirmar Inscrição';
  }
});

btnNova.addEventListener('click', async () => {
  form.reset();
  clubeInput.value = '';
  turmaInput.value = '';
  turmasGrupos.querySelectorAll('.turma-card').forEach((btn) => {
    btn.classList.remove('selecionada');
    btn.setAttribute('aria-checked', 'false');
  });
  form.hidden = false;
  successBox.hidden = true;
  limparErro();
  await carregarClubes();
});

carregarTurmas();
carregarClubes();
setInterval(carregarClubes, 3000);

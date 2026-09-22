# Sistema de Escolha de Clubes — E.E. PEI José Ephim Mindlin

Sistema para alunos escolherem clubes/projetos, com controle de vagas em tempo real,
proteção contra dupla inscrição e simulados de carga para lançamentos simultâneos.

## Arquitetura

- **Frontend**: HTML/CSS/JS puro (`frontend/`), hospedado no **GitHub Pages**.
- **Admin**: painel separado (`admin/`), protegido por senha.
- **Backend + Banco de dados**: **Google Apps Script** (`apps-script/Code.gs`) + **Google Sheets**.
  O Apps Script expõe uma API (Web App) que lê/grava na planilha, com trava de concorrência
  (`LockService`) para garantir que o limite de vagas nunca seja ultrapassado mesmo com
  vários alunos se inscrevendo ao mesmo tempo.

## Passo a passo do deploy

### 1. Criar a Planilha Google + Apps Script
1. Crie uma nova Planilha Google (Google Sheets).
2. Menu **Extensões > Apps Script**.
3. Apague o conteúdo padrão e cole o conteúdo de [`apps-script/Code.gs`](apps-script/Code.gs).
4. Na barra de funções do editor, selecione `setupPlanilha` e clique em **Executar** (autorize as permissões pedidas). Isso cria as abas `Clubes`, `Inscricoes` e `Config`.
5. Na aba **Clubes**, preencha as linhas com: `ClubeID | Nome | Resumo | Presidente | Padrinho | VagasMax` (veja [`docs/DADOS_CLUBES_TEMPLATE.md`](docs/DADOS_CLUBES_TEMPLATE.md)). **Presidente** é o aluno que criou o clube; **Padrinho** é o professor responsável.
6. Na aba **Config**, troque o valor `troque-esta-senha` pela senha real do admin.
7. No editor do Apps Script: **Implantar > Nova implantação** > tipo **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
8. Copie a URL gerada (termina em `/exec`).

### 2. Configurar o frontend
1. Abra [`frontend/js/config.js`](frontend/js/config.js) e cole a URL do Apps Script em `APPS_SCRIPT_URL`.
2. Coloque os arquivos de logo em `frontend/assets/logo-escola.png` e `frontend/assets/logo-pei.png`.

### 3. Publicar no GitHub Pages
1. Crie um repositório no GitHub e suba esta pasta inteira.
2. Nas configurações do repositório: **Settings > Pages** > Source: branch `main`, pasta `/` (raiz) ou `/frontend` conforme preferir.
   - Se publicar a raiz, o link do aluno será `.../frontend/index.html` e o do admin `.../admin/index.html`.
3. Pronto — o link pode ser compartilhado com os alunos.

## Regras de negócio implementadas

- Um aluno (nome + turma) não pode se inscrever em mais de um clube.
- Vagas não podem ser ultrapassadas — checagem feita **dentro** da trava de concorrência no Apps Script.
- Painel admin exige senha, permite:
  - Ver ocupação de vagas por clube em tempo real.
  - Simular lotes de inscrições fictícias para testar limite de vagas e concorrência.
  - Limpar os dados de simulação.
  - Baixar a lista de chamada em Excel (uma aba por clube).
  - Excluir inscrições manualmente.

## Pendências antes de ir para produção

- [ ] Preencher a lista real de clubes (nome, resumo, presidente, padrinho, vagas) na aba `Clubes`.
- [ ] Trocar a senha padrão do admin na aba `Config`.
- [ ] Adicionar os logos reais em `frontend/assets/`.
- [ ] Definir a URL final do Apps Script em `frontend/js/config.js`.
- [ ] Rodar uma simulação de lote pelo painel admin para validar o limite de vagas antes do lançamento real.

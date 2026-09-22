# Sistema de Escolha de Clubes — E.E. PEI José Ephim Mindlin

Sistema para alunos escolherem clubes/projetos, com controle de vagas em tempo real,
proteção contra dupla inscrição e simulados de carga para lançamentos simultâneos.

## Arquitetura

- **Backend**: Node.js + Express 5
- **Banco**: SQLite via `better-sqlite3` (síncrono — transações atômicas sem condição de corrida), modo WAL
- **Front-end**: HTML/CSS/JS puro, servido estático pelo Express (`public/`)
- **Exportação**: ExcelJS (`.xlsx` com aba Resumo + uma aba por clube)
- **Autenticação admin**: senha única (env var `ADMIN_PASSWORD`) + cookie de sessão assinado
- **Deploy**: Fly.io — 1 máquina `shared-cpu-1x` 256MB, volume persistente, região `gru` (São Paulo)

Mesma arquitetura do sistema de eletivas da escola (testada com ~460 alunos reais), adaptada para clubes.

## Estrutura de arquivos

```
server.js              -> rotas e lógica principal
db/schema.sql          -> CREATE TABLE (tabelas base)
db/database.js         -> conexão + seed inicial (20 clubes de exemplo)
lib/normalizar.js      -> normalização de nomes (remove acento/espaço/caixa)
lib/exportarExcel.js   -> geração do Excel (converte fuso horário para America/Sao_Paulo)
lib/adminAuth.js       -> sessão/senha do admin
public/                -> front-end do aluno (index.html, app.js, style.css)
admin/                 -> painel admin (FORA de public/, nunca servido sem auth)
test/                  -> testes automatizados contra um servidor real
Dockerfile, fly.toml   -> deploy
```

## Rodando localmente

```bash
npm install
ADMIN_PASSWORD=troque-esta-senha npm start
```

Abra `http://localhost:3000` (alunos) e `http://localhost:3000/admin/` (painel).

## Rodando os testes

```bash
npm test
```

Cobre: duplicidade de inscrição (mesmo aluno/turma) e esgotamento exato de vagas
(incluindo concorrência simultânea), sempre contra um servidor real, sem mocks.

## Regras de negócio implementadas

- **Vaga atômica**: transação síncrona do better-sqlite3 garante que duas inscrições
  simultâneas nunca "passem juntas" — uma sempre resolve antes da outra começar.
- **Trava de duplicidade**: mesmo aluno (nome normalizado, sem acento/caixa/espaço) +
  mesma turma não pode se inscrever duas vezes, nem no mesmo clube nem em outro diferente.
  Alunos com nome igual em turmas DIFERENTES são tratados como pessoas diferentes.
- **Validação de nome**: mínimo 2 palavras (nome + sobrenome), no front e no back.

## Painel administrativo (`/admin/`)

- Login por senha (env var `ADMIN_PASSWORD`), cookie httpOnly.
- Dashboard: vagas ocupadas/limite por clube, clique mostra os inscritos.
- **Gerar inscrições fictícias**: passa pela MESMA validação real (respeita limite de
  vaga), marcadas com `teste=1` — permite simular lotes sem afetar dados reais.
- **Limpar**: `escopo=teste` (só remove o que foi gerado como teste) ou `escopo=tudo`
  (remove tudo, exige digitar a palavra "CONFIRMAR").
- **Exportar Excel**: aba "Resumo" + uma aba por clube (nome, turma, data, presença),
  com data/hora já convertida para `America/Sao_Paulo`.

## Deploy no Fly.io

Pré-requisitos: conta no [fly.io](https://fly.io) com cartão de crédito cadastrado
(exigido mesmo no tier gratuito, mas não cobra dentro do limite) e `flyctl` instalado.

```bash
flyctl auth login              # abre o navegador para login
flyctl launch --no-deploy      # usa o fly.toml já existente, não sobrescrever
flyctl volumes create clubes_data --size 1 --region gru
flyctl secrets set ADMIN_PASSWORD=sua-senha-aqui
flyctl deploy
```

O `Dockerfile` usa `node:22-slim` (necessário para compilar o `better-sqlite3`) e
instala `python3 make g++` para a build nativa do módulo.

## Pendências antes de ir para produção

- [ ] Preencher a lista real de clubes em `db/database.js` (array `CLUBES_EXEMPLO`) —
      veja [`docs/DADOS_CLUBES_TEMPLATE.md`](docs/DADOS_CLUBES_TEMPLATE.md).
- [ ] Trocar a senha padrão do admin (`ADMIN_PASSWORD`) antes do deploy real.
- [ ] Rodar o deploy no Fly.io (requer conta e cartão cadastrados pelo usuário).
- [ ] Rodar uma simulação de lote pelo painel admin para validar o limite de vagas
      antes do lançamento real.

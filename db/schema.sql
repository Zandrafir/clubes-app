CREATE TABLE IF NOT EXISTS clubes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  resumo TEXT NOT NULL DEFAULT '',
  presidente TEXT NOT NULL,
  padrinho TEXT NOT NULL,
  limite INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inscricoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_completo TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL DEFAULT '',
  turma TEXT NOT NULL,
  clube_id INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  teste INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (clube_id) REFERENCES clubes(id)
);

CREATE INDEX IF NOT EXISTS idx_inscricoes_turma_nome ON inscricoes(turma, nome_normalizado);

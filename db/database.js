const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Em producao (Fly.io), DB_DIR aponta para o volume persistente montado em /data.
// Localmente, usa a propria pasta db/ do projeto.
const dbDir = process.env.DB_DIR || __dirname;
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'clubes.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Dados de exemplo, so inseridos se a tabela estiver vazia. Substitua pelos
// clubes reais assim que tiver a lista definitiva (edite aqui ou via admin).
const CLUBES_EXEMPLO = [
  { nome: 'Robotica Criativa', resumo: 'Montagem e programacao de robos para desafios e mostras.', presidente: 'Lucas Andrade', padrinho: 'Ana Ferreira', limite: 20 },
  { nome: 'Xadrez em Movimento', resumo: 'Estrategia, raciocinio logico e torneios internos.', presidente: 'Beatriz Souza', padrinho: 'Carlos Mendes', limite: 24 },
  { nome: 'Teatro e Expressao', resumo: 'Jogos cenicos, improviso e montagem de pecas.', presidente: 'Rafael Lima', padrinho: 'Patricia Gomes', limite: 18 },
  { nome: 'Horta e Sustentabilidade', resumo: 'Cultivo, compostagem e educacao ambiental na pratica.', presidente: 'Camila Rocha', padrinho: 'Joao Pedro Alves', limite: 16 },
  { nome: 'Esportes em Equipe', resumo: 'Volei, handebol e futsal com foco em trabalho em equipe.', presidente: 'Gustavo Nunes', padrinho: 'Renata Alves', limite: 30 },
  { nome: 'Musica e Percussao', resumo: 'Bateria, percussao corporal e ensaios em grupo.', presidente: 'Isabela Martins', padrinho: 'Marcos Vinicius', limite: 20 },
  { nome: 'Cineclube JEM', resumo: 'Exibicao e debate de filmes nacionais e internacionais.', presidente: 'Pedro Henrique', padrinho: 'Fernanda Costa', limite: 22 },
  { nome: 'Games e Programacao', resumo: 'Criacao de jogos digitais simples e logica de programacao.', presidente: 'Julia Ferreira', padrinho: 'Ricardo Barbosa', limite: 18 },
  { nome: 'Danca e Movimento', resumo: 'Coreografias e expressao corporal em diversos ritmos.', presidente: 'Larissa Dias', padrinho: 'Tatiane Ribeiro', limite: 20 },
  { nome: 'Jornal Escolar', resumo: 'Producao de reportagens e edicao do jornal da escola.', presidente: 'Matheus Cardoso', padrinho: 'Vanessa Teixeira', limite: 14 },
  { nome: 'Artes Visuais e Pintura', resumo: 'Tecnicas de desenho, pintura e exposicoes na escola.', presidente: 'Sophia Almeida', padrinho: 'Eduardo Santos', limite: 18 },
  { nome: 'Culinaria Saudavel', resumo: 'Receitas praticas, nutricao e habitos alimentares.', presidente: 'Enzo Ribeiro', padrinho: 'Claudia Pereira', limite: 16 },
  { nome: 'Horta Comunitaria e Reciclagem', resumo: 'Projetos de reaproveitamento e horta coletiva.', presidente: 'Manuela Castro', padrinho: 'Roberto Lima', limite: 16 },
  { nome: 'Debate e Oratoria', resumo: 'Tecnicas de argumentacao e competicoes de debate.', presidente: 'Davi Moreira', padrinho: 'Simone Araujo', limite: 20 },
  { nome: 'Fotografia Digital', resumo: 'Composicao, edicao e ensaios fotograficos tematicos.', presidente: 'Alice Barros', padrinho: 'Fabio Nogueira', limite: 18 },
  { nome: 'Robotica Avancada', resumo: 'Projetos de automacao e sensores para competicoes.', presidente: 'Bernardo Freitas', padrinho: 'Juliana Melo', limite: 16 },
  { nome: 'Coral e Canto Coral', resumo: 'Tecnica vocal e apresentacoes em eventos da escola.', presidente: 'Laura Vieira', padrinho: 'Marcelo Correia', limite: 24 },
  { nome: 'Basquete e Fundamentos', resumo: 'Tecnica, tatica e jogos amistosos de basquete.', presidente: 'Thiago Pinto', padrinho: 'Aline Duarte', limite: 24 },
  { nome: 'Matematica em Jogos', resumo: 'Resolucao de problemas atraves de jogos e desafios logicos.', presidente: 'Helena Ramos', padrinho: 'Paulo Cesar', limite: 20 },
  { nome: 'Empreendedorismo Jovem', resumo: 'Ideias de negocio, planejamento e projetos praticos.', presidente: 'Nicolas Farias', padrinho: 'Cristina Lopes', limite: 18 },
];

const { count } = db.prepare('SELECT COUNT(*) as count FROM clubes').get();
if (count === 0) {
  const insertClube = db.prepare(
    'INSERT INTO clubes (nome, resumo, presidente, padrinho, limite) VALUES (?, ?, ?, ?, ?)'
  );
  const seedTx = db.transaction((lista) => {
    for (const c of lista) insertClube.run(c.nome, c.resumo, c.presidente, c.padrinho, c.limite);
  });
  seedTx(CLUBES_EXEMPLO);
}

module.exports = db;

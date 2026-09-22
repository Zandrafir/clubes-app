# Template de dados dos Clubes

Os clubes ficam definidos no array `CLUBES_EXEMPLO` em [`db/database.js`](../db/database.js).
Edite esse array com os dados reais e reinicie o servidor (ou refaça o deploy) —
ele só é inserido automaticamente se a tabela `clubes` estiver vazia, então para
clubes já existentes prefira editar direto pelo painel admin ou pelo banco.

```js
{ nome: 'Nome do Clube', resumo: 'Objetivo/descrição curta.', presidente: 'Nome do aluno', padrinho: 'Nome do professor', limite: 20 },
```

- **nome**: nome do clube, único, aparece nos cards.
- **resumo**: objetivo/descrição curta do clube (1-2 frases).
- **presidente**: nome do **aluno** que criou/lidera o clube.
- **padrinho**: nome do **professor** que apadrinha o clube.
- **limite**: número máximo de alunos que podem se inscrever.

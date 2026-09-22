// Remove acentos e normaliza espacos/caixa para comparar nomes com seguranca
// (ex: "Jose" === "José", "  Ana  Maria" === "Ana Maria").
function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

module.exports = { normalizar };

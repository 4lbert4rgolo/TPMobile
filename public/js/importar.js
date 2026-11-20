// Importar publicadores em lote (colando da planilha ou enviando .xlsx/.csv).
// Funções puras (sem tela e sem banco), testadas em tests/importar.test.mjs.
//
// Colunas aceitas (a primeira linha pode ter os títulos; a ordem não importa quando tem):
//   Nome* | Gênero* (M/F, irmão/irmã) | Telefone | Onde vota (pontos separados por vírgula, ou "Todos") | Precisa de trio (sim/não)
// Sem linha de títulos, vale a ordem acima.

import { normalizarBusca } from './busca.js';

export const COLUNAS = ['Nome', 'Gênero', 'Telefone', 'Onde vota', 'Precisa de trio'];

const APELIDOS = {
  nome: ['nome', 'publicador', 'irmao', 'irma', 'nome completo'],
  genero: ['genero', 'sexo'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'tel'],
  onde: ['onde vota', 'pontos', 'ponto', 'onde', 'local', 'locais'],
  trio: ['precisa de trio', 'trio', 'requer trio'],
};

/**
 * Lê o texto colado (ou um .csv) e devolve as linhas como listas de células.
 * Separador: tabulação (o que o Excel e o Google Planilhas usam ao copiar), senão ";" ou ",".
 * Aspas como no CSV: "Silva, João" fica numa célula só.
 */
export function lerTexto(texto) {
  const linhas = String(texto || '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
  if (!linhas.length) return [];
  const amostra = linhas.slice(0, 5).join('\n');
  const sep = amostra.includes('\t') ? '\t' : amostra.includes(';') ? ';' : ',';
  return linhas.map((linha) => {
    const celulas = [];
    let atual = '';
    let aspas = false;
    for (let i = 0; i < linha.length; i += 1) {
      const ch = linha[i];
      if (ch === '"') {
        if (aspas && linha[i + 1] === '"') { atual += '"'; i += 1; } else aspas = !aspas;
      } else if (ch === sep && !aspas) {
        celulas.push(atual); atual = '';
      } else {
        atual += ch;
      }
    }
    celulas.push(atual);
    return celulas.map((c) => c.trim());
  });
}

/** Descobre em que coluna está cada campo. Devolve null se a primeira linha não for de títulos. */
export function mapaDeColunas(primeira) {
  const mapa = {};
  primeira.forEach((titulo, i) => {
    const t = normalizarBusca(titulo).replace(/[*:]/g, '').trim();
    for (const [campo, nomes] of Object.entries(APELIDOS)) if (mapa[campo] === undefined && nomes.includes(t)) mapa[campo] = i;
  });
  return mapa.nome === undefined ? null : mapa;
}

const ORDEM_PADRAO = { nome: 0, genero: 1, telefone: 2, onde: 3, trio: 4 };

export function lerGenero(valor) {
  const v = normalizarBusca(valor);
  if (['f', 'feminino', 'irma', 'mulher', 'ir.ª', 'ira'].includes(v)) return 'F';
  if (['m', 'masculino', 'irmao', 'homem', 'ir.'].includes(v)) return 'M';
  return null;
}

export const lerSimNao = (valor) => ['sim', 's', 'x', 'true', '1', 'yes'].includes(normalizarBusca(valor));

/** Só os números do telefone; aceita de 10 a 13 dígitos (com ou sem 55 do Brasil). */
export function lerTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return { ok: true, telefone: '' };
  return digitos.length >= 10 && digitos.length <= 13 ? { ok: true, telefone: String(valor).trim() } : { ok: false };
}

/** "Bairro Novo, Atacadão" → ['Bairro Novo', 'Atacadão'] (nomes como estão em Menu > Pontos). */
export function lerPontos(valor, pontos) {
  const texto = String(valor || '').trim();
  if (!texto || normalizarBusca(texto) === 'todos') return { ok: true, lista: [] };
  const porChave = new Map(pontos.map((p) => [normalizarBusca(p), p]));
  const partes = texto.split(/[,;/]/).map((p) => p.trim()).filter(Boolean);
  const lista = [];
  const desconhecidos = [];
  for (const parte of partes) {
    const ponto = porChave.get(normalizarBusca(parte));
    if (ponto) { if (!lista.includes(ponto)) lista.push(ponto); } else desconhecidos.push(parte);
  }
  return desconhecidos.length ? { ok: false, desconhecidos } : { ok: true, lista };
}

/**
 * Transforma as linhas em publicadores novos, separando erros e nomes já cadastrados.
 * @returns {{ novos: object[], erros: {linha:number, nome:string, msg:string}[], ignorados: {linha:number, nome:string, msg:string}[] }}
 */
export function interpretarLinhas(linhas, { existentes = [], pontos = [] } = {}) {
  const resultado = { novos: [], erros: [], ignorados: [] };
  if (!linhas.length) return resultado;
  const mapa = mapaDeColunas(linhas[0]);
  const corpo = mapa ? linhas.slice(1) : linhas;
  const col = mapa || ORDEM_PADRAO;
  const inicio = mapa ? 2 : 1; // número da linha como aparece na planilha
  const jaTem = new Set(existentes.map((p) => normalizarBusca(p.nome)));

  corpo.forEach((celulas, i) => {
    const linha = inicio + i;
    const pegar = (campo) => (col[campo] === undefined ? '' : celulas[col[campo]] ?? '');
    const nome = pegar('nome').replace(/\s+/g, ' ').trim();
    if (!nome) {
      if (celulas.some((c) => c)) resultado.erros.push({ linha, nome: '', msg: 'sem nome' });
      return;
    }
    const chave = normalizarBusca(nome);
    if (jaTem.has(chave)) { resultado.ignorados.push({ linha, nome, msg: 'já está cadastrado' }); return; }

    const genero = lerGenero(pegar('genero'));
    if (!genero) { resultado.erros.push({ linha, nome, msg: 'gênero vazio ou desconhecido (use M ou F)' }); return; }
    const tel = lerTelefone(pegar('telefone'));
    if (!tel.ok) { resultado.erros.push({ linha, nome, msg: 'telefone incompleto (use DDD + número)' }); return; }
    const onde = lerPontos(pegar('onde'), pontos);
    if (!onde.ok) { resultado.erros.push({ linha, nome, msg: `ponto não encontrado: ${onde.desconhecidos.join(', ')}` }); return; }

    jaTem.add(chave);
    resultado.novos.push({
      nome,
      genero,
      telefone: tel.telefone,
      pontosVoto: onde.lista,
      requerTrio: lerSimNao(pegar('trio')),
      conjuge: '',
      ativo: true,
    });
  });
  return resultado;
}

/** Linhas do modelo para baixar (títulos + dois exemplos). */
export function linhasDoModelo(pontos) {
  return [
    COLUNAS,
    ['Maria da Silva', 'F', '(11) 91234-5678', 'Todos', 'não'],
    ['José Souza', 'M', '', pontos[0] || 'Bairro Novo', 'sim'],
  ];
}

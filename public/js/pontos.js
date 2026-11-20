// Configuração dos pontos de carrinho (lista, ordem, "em uso", renomear e remover).
// Funções puras, sem tela e sem banco: testadas em tests/pontos.test.mjs.
//
// Como fica guardado (documento config/geral):
//   pontos:         ['Bairro Novo', 'Atacadão Novo Mix', ...]   todos os pontos, na ordem da tela
//   pontosPausados: ['Morada dos Canários e Sabiás']            os que NÃO vêm marcados nas enquetes novas

import { normalizarBusca } from './busca.js';

/** Pontos que já vêm marcados numa enquete nova. */
export function pontosAtivos(config) {
  const pausados = new Set(config?.pontosPausados || []);
  return (config?.pontos || []).filter((p) => !pausados.has(p));
}

/** Monta a lista que a tela edita: um item por ponto, lembrando o nome original. */
export function itensDaConfig(config) {
  const pausados = new Set(config?.pontosPausados || []);
  return (config?.pontos || []).map((nome) => ({ nome, original: nome, ativo: !pausados.has(nome) }));
}

/**
 * Confere a lista antes de salvar. Devolve a mensagem de erro, ou null se estiver tudo certo.
 * "Bairro novo" e "Bairro Novo" contam como o mesmo nome (sem acento e sem maiúscula).
 */
export function validarPontos(itens) {
  if (!itens.length) return 'Cadastre pelo menos um ponto.';
  const vistos = new Set();
  for (const item of itens) {
    const nome = item.nome.trim();
    if (!nome) return 'Há um ponto sem nome. Escreva o nome ou remova a linha.';
    if (nome.length > 60) return `O nome "${nome.slice(0, 20)}…" está muito comprido (máximo 60 letras).`;
    const chave = normalizarBusca(nome);
    if (vistos.has(chave)) return `O ponto "${nome}" aparece duas vezes.`;
    vistos.add(chave);
  }
  if (!itens.some((i) => i.ativo)) return 'Deixe pelo menos um ponto "Em uso".';
  return null;
}

/**
 * Compara a lista editada com a original e diz o que mudou:
 * - renomeados: pares [nome antigo, nome novo]
 * - removidos: nomes que saíram da lista
 * - config: o que vai ser gravado em config/geral
 */
export function planoDeMudancas(originais, itens) {
  const limpos = itens.map((i) => ({ ...i, nome: i.nome.trim() }));
  const renomeados = limpos.filter((i) => i.original && i.original !== i.nome).map((i) => [i.original, i.nome]);
  const ficaram = new Set(limpos.map((i) => i.original).filter(Boolean));
  const removidos = originais.filter((p) => !ficaram.has(p));
  return {
    renomeados,
    removidos,
    config: {
      pontos: limpos.map((i) => i.nome),
      pontosPausados: limpos.filter((i) => !i.ativo).map((i) => i.nome),
    },
  };
}

const mapaDeNomes = (plano) => new Map(plano.renomeados);

/**
 * "Onde vota" de um publicador depois das mudanças. Devolve a lista nova, ou null se nada muda.
 * Sem nenhum ponto na lista, a pessoa volta a votar em todos (é a regra do app).
 */
export function pontosVotoAtualizados(pontosVoto, plano) {
  if (!pontosVoto?.length) return null;
  const novoNome = mapaDeNomes(plano);
  const removidos = new Set(plano.removidos);
  const nova = [...new Set(pontosVoto.filter((p) => !removidos.has(p)).map((p) => novoNome.get(p) || p))];
  return JSON.stringify(nova) === JSON.stringify(pontosVoto) ? null : nova;
}

/** Horários de costume ({ ponto: [...] }) depois das mudanças, ou null se nada muda. */
export function costumeAtualizado(padrao, plano) {
  if (!padrao) return null;
  const novoNome = mapaDeNomes(plano);
  const removidos = new Set(plano.removidos);
  let mudou = false;
  const novo = {};
  for (const [ponto, lista] of Object.entries(padrao)) {
    if (removidos.has(ponto)) { mudou = true; continue; }
    const nome = novoNome.get(ponto) || ponto;
    if (nome !== ponto) mudou = true;
    novo[nome] = [...new Set([...(novo[nome] || []), ...lista])];
  }
  return mudou ? novo : null;
}

/**
 * Enquete em RASCUNHO depois das mudanças, ou null se nada muda.
 * Enquetes abertas ou passadas não mudam: os votos e a escala delas guardam o nome do ponto.
 */
export function rascunhoAtualizado(enquete, plano) {
  if (enquete.status !== 'rascunho') return null;
  const novoNome = mapaDeNomes(plano);
  const removidos = new Set(plano.removidos);
  const trocar = (p) => novoNome.get(p) || p;
  const pontos = [...new Set(enquete.pontos.filter((p) => !removidos.has(p)).map(trocar))];
  const bloqueios = (enquete.bloqueios || [])
    .filter((b) => !b.ponto || !removidos.has(b.ponto))
    .map((b) => (b.ponto ? { ...b, ponto: trocar(b.ponto) } : b));
  const nova = { ...enquete, pontos, bloqueios };
  return JSON.stringify(nova) === JSON.stringify(enquete) ? null : nova;
}

/** Quem vota SÓ em pontos que vão ser removidos (essas pessoas passam a ver todos os pontos). */
export function afetadosPelaRemocao(publicadores, plano) {
  const removidos = new Set(plano.removidos);
  if (!removidos.size) return [];
  return publicadores.filter((p) => p.pontosVoto?.length && p.pontosVoto.every((x) => removidos.has(x)));
}

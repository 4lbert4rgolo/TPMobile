// "Preciso trocar": pedidos de troca e sugestão de substitutos.
// Funções puras (sem tela e sem banco), testadas em tests/trocas.test.mjs.
//
// Um pedido fica em enquetes/{id}/trocas/{idDaTroca}:
//   { publicadorId, nome, ponto, data, turno, motivo, status, criadoEm,
//     substitutoId?, substitutoNome?, resolvidoPor?, resolvidoEm? }
// status: 'aberta' → 'resolvida' (alguém entrou no lugar), 'dispensada' (organizador) ou 'cancelada' (a própria pessoa).

import { chave, pontosDoPublicador, contarParticipacoes, REGRAS_PADRAO, generosCompativeis, umaVezPorDia } from './escala.js';

/**
 * Identificação do pedido: a mesma pessoa no mesmo horário gera sempre o mesmo id,
 * então pedir duas vezes não duplica. Usa a posição do turno e do ponto (os nomes podem ter "/").
 */
export function idDaTroca(pubId, enquete, ponto, data, turno) {
  return `${pubId}_${data}_${enquete.turnos.indexOf(turno)}_${enquete.pontos.indexOf(ponto)}`;
}

export function novaTroca({ pubId, nome, enquete, ponto, data, turno, motivo = '' }, agora = new Date()) {
  return {
    id: idDaTroca(pubId, enquete, ponto, data, turno),
    publicadorId: pubId,
    nome,
    ponto,
    data,
    turno,
    motivo: String(motivo || '').trim().slice(0, 200),
    status: 'aberta',
    criadoEm: agora.toISOString(),
  };
}

export const trocasAbertas = (trocas) => (trocas || []).filter((t) => t.status === 'aberta');

/** Pedido aberto desta pessoa neste horário, se houver. */
export const trocaDoHorario = (trocas, pubId, ponto, data, turno) =>
  trocasAbertas(trocas).find((t) => t.publicadorId === pubId && t.ponto === ponto && t.data === data && t.turno === turno) || null;

/** A célula com o substituto no lugar de quem pediu a troca (na mesma posição). */
export function substituirPessoa(celula, saiId, entra) {
  if (celula?.tipo !== 'equipe') return celula;
  return { ...celula, pessoas: celula.pessoas.map((p) => (p.id === saiId ? { id: entra.id, nome: entra.nome } : p)) };
}

/**
 * Quem pode entrar no lugar: marcou o horário como "posso",
 * vota naquele ponto, está ativo, não está em outro ponto no mesmo horário (nem em outro horário do dia,
 * com a regra de uma vez por dia) e é do mesmo gênero
 * de quem fica na equipe (a não ser que forme casal com alguém dela).
 * Ordem: quem participou menos nesta escala primeiro.
 * `acimaDoLimite` avisa quando a irmã (ou o irmão, se houver limite) já chegou ao máximo.
 */
export function substitutos({ enquete, matriz, votos, publicadores, troca }, maximo = 8) {
  const regras = { ...REGRAS_PADRAO, ...(enquete.regras || {}) };
  const k = chave(troca.data, troca.turno);
  const celula = matriz?.[troca.ponto]?.[troca.data]?.[troca.turno];
  const naCelula = new Set(celula?.tipo === 'equipe' ? celula.pessoas.map((p) => p.id) : []);

  // Ocupados: no mesmo horário em outro ponto e, com a regra de uma vez por dia, em qualquer horário do dia.
  const ocupados = new Set();
  for (const ponto of Object.keys(matriz || {})) {
    for (const [turno, c] of Object.entries(matriz[ponto]?.[troca.data] || {})) {
      if (turno !== troca.turno && !umaVezPorDia(regras)) continue;
      if (turno === troca.turno && ponto === troca.ponto) continue; // a própria célula já está em naCelula
      if (c?.tipo === 'equipe') c.pessoas.forEach((p) => ocupados.add(p.id));
    }
  }

  const participacoes = contarParticipacoes(matriz || {});
  const votoDe = new Map((votos || []).map((v) => [v.publicadorId, v]));
  // Quem fica na equipe depois que a pessoa sair (para conferir irmão/irmã).
  const porId = new Map(publicadores.map((p) => [p.id, p]));
  const ficam = [...naCelula].filter((id) => id !== troca.publicadorId).map((id) => porId.get(id)).filter(Boolean);

  const lista = [];
  for (const p of publicadores) {
    if (p.ativo === false || p.id === troca.publicadorId || naCelula.has(p.id) || ocupados.has(p.id)) continue;
    if (!pontosDoPublicador(p, enquete.pontos).includes(troca.ponto)) continue;
    if (!generosCompativeis([...ficam, p])) continue; // equipe só de irmãos ou só de irmãs (casal é exceção)
    const v = votoDe.get(p.id);
    if (!(v?.disponibilidade?.[troca.ponto] || []).includes(k)) continue;
    const tipo = 'disponivel';
    const carga = participacoes.get(p.id)?.total || 0;
    const limite = p.genero === 'F' ? regras.maxIrmas : regras.maxIrmaos;
    lista.push({ id: p.id, nome: p.nome, tipo, carga, acimaDoLimite: Boolean(limite) && carga >= limite, requerTrio: Boolean(p.requerTrio) });
  }

  return lista
    .sort((a, b) => a.acimaDoLimite - b.acimaDoLimite || a.carga - b.carga || a.nome.localeCompare(b.nome, 'pt'))
    .slice(0, maximo);
}

/** Mensagem pronta para avisar o substituto pelo WhatsApp. */
export const mensagemSubstituto = (sub, troca, lugar) =>
  `Olá, ${sub.nome.split(' ')[0]}! Você entrou na escala do carrinho no lugar de ${troca.nome}: ${lugar}. Confira em Minha escala no app. Obrigado!`;

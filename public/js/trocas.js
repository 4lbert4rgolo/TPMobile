// "Preciso trocar": pedidos de troca e sugestão de substitutos.
// Funções puras (sem tela e sem banco), testadas em tests/trocas.test.mjs.
//
// Um pedido fica em enquetes/{id}/trocas/{idDaTroca}:
//   { publicadorId, nome, ponto, data, turno, motivo, status, criadoEm,
//     substitutoId?, substitutoNome?, resolvidoPor?, resolvidoEm? }
// status: 'aberta' → 'resolvida' (alguém entrou no lugar), 'dispensada' (organizador) ou 'cancelada' (a própria pessoa).

import { chave, pontosDoPublicador, contarParticipacoes, REGRAS_PADRAO } from './escala.js';

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
 * Quem pode entrar no lugar: marcou o horário como reserva ("só se precisar") ou como "posso",
 * vota naquele ponto, está ativo e não está em outro ponto no mesmo horário.
 * Ordem: reservas primeiro, depois quem participou menos nesta escala.
 * `acimaDoLimite` avisa quando a irmã (ou o irmão, se houver limite) já chegou ao máximo.
 */
export function substitutos({ enquete, matriz, votos, publicadores, troca }, maximo = 8) {
  const regras = { ...REGRAS_PADRAO, ...(enquete.regras || {}) };
  const k = chave(troca.data, troca.turno);
  const celula = matriz?.[troca.ponto]?.[troca.data]?.[troca.turno];
  const naCelula = new Set(celula?.tipo === 'equipe' ? celula.pessoas.map((p) => p.id) : []);

  const ocupados = new Set();
  for (const ponto of Object.keys(matriz || {})) {
    const c = matriz[ponto]?.[troca.data]?.[troca.turno];
    if (c?.tipo === 'equipe') c.pessoas.forEach((p) => ocupados.add(p.id));
  }

  const participacoes = contarParticipacoes(matriz || {});
  const votoDe = new Map((votos || []).map((v) => [v.publicadorId, v]));

  const lista = [];
  for (const p of publicadores) {
    if (p.ativo === false || p.id === troca.publicadorId || naCelula.has(p.id) || ocupados.has(p.id)) continue;
    if (!pontosDoPublicador(p, enquete.pontos).includes(troca.ponto)) continue;
    const v = votoDe.get(p.id);
    const tipo = (v?.reserva?.[troca.ponto] || []).includes(k) ? 'reserva'
      : (v?.disponibilidade?.[troca.ponto] || []).includes(k) ? 'disponivel' : null;
    if (!tipo) continue;
    const carga = participacoes.get(p.id)?.total || 0;
    const limite = p.genero === 'F' ? regras.maxIrmas : regras.maxIrmaos;
    lista.push({ id: p.id, nome: p.nome, tipo, carga, acimaDoLimite: Boolean(limite) && carga >= limite, requerTrio: Boolean(p.requerTrio) });
  }

  return lista
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'reserva' ? -1 : 1) || a.acimaDoLimite - b.acimaDoLimite || a.carga - b.carga || a.nome.localeCompare(b.nome, 'pt'))
    .slice(0, maximo);
}

/** Mensagem pronta para avisar o substituto pelo WhatsApp. */
export const mensagemSubstituto = (sub, troca, lugar) =>
  `Olá, ${sub.nome.split(' ')[0]}! Você entrou na escala do carrinho no lugar de ${troca.nome}: ${lugar}. Confira em Minha escala no app. Obrigado!`;

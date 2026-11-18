// Regra de retenção: quais enquetes já passaram do prazo de guarda.
// Fica separada de dados.js para poder ser testada sem navegador.

import { toISO } from './escala.js';

/** Quantos meses os dados de votação e escala ficam guardados. */
export const MESES_DE_RETENCAO = 3;

/** Data limite (AAAA-MM-DD): enquetes que terminaram antes dela são consideradas antigas. */
export function dataLimiteRetencao(hoje = new Date(), meses = MESES_DE_RETENCAO) {
  // Volta `meses` meses sem "estourar" o fim do mês (31/05 menos 3 meses vira 28/02, e não 03/03).
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(hoje.getDate(), ultimoDia));
  return toISO(alvo);
}

/**
 * Enquetes com mais de `meses` meses. Compara a data final (ou a inicial, se não houver) com a data limite.
 * Enquetes com votação aberta nunca entram, mesmo que sejam antigas.
 */
export function enquetesAntigas(enquetes, hoje = new Date(), meses = MESES_DE_RETENCAO) {
  const limite = dataLimiteRetencao(hoje, meses);
  return enquetes.filter((e) => {
    const fim = e.fim || e.inicio;
    return e.status !== 'aberta' && fim && fim < limite;
  });
}

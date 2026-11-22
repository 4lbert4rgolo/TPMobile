// Lógica pura (sem tela) da votação em dois passos: uma grade de horários + escolha dos pontos.
// Fica separada para poder ser testada com `npm test`, sem navegador.
import { chave, celulaBloqueada } from './escala.js';

const mesmoConjunto = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * Decide como a tela começa, a partir do voto que já existe.
 * - unificado: true  → todos os pontos escolhidos têm exatamente os mesmos horários (ou ainda não há voto);
 * - unificado: false → os pontos têm horários diferentes. Aí mostramos "ponto a ponto" para não perder nada.
 */
export function iniciarUnico(disp, permitidos, jaTemMarcas) {
  const comMarcas = permitidos.filter((p) => (disp[p]?.size || 0) > 0);
  const escolhidos = new Set(comMarcas.length ? comMarcas : permitidos);
  const base = [...escolhidos][0];
  const mestre = { disp: new Set(disp[base] || []) };
  const igual = [...escolhidos].every((p) => mesmoConjunto(disp[p] || new Set(), mestre.disp));
  return { mestre, escolhidos, unificado: igual || !jaTemMarcas };
}

/** Horário bloqueado em TODOS os pontos escolhidos (aí não adianta marcar). */
export function bloqueadoEmTodos(enquete, data, turno, escolhidos) {
  const lista = [...escolhidos];
  return lista.length > 0 && lista.every((p) => celulaBloqueada(enquete, data, turno, p));
}

/**
 * Copia a grade única para cada ponto escolhido (pulando horários bloqueados naquele ponto)
 * e esvazia os pontos não escolhidos. Devolve { disp } no formato que salvarVoto usa.
 */
export function aplicarMestre(enquete, mestre, escolhidos, permitidos) {
  const disp = {};
  for (const ponto of enquete.pontos) {
    disp[ponto] = new Set();
    if (!permitidos.includes(ponto) || !escolhidos.has(ponto)) continue;
    for (const dia of enquete.dias) {
      if (dia.ativo === false) continue;
      for (const turno of enquete.turnos) {
        const k = chave(dia.data, turno);
        if (celulaBloqueada(enquete, dia.data, turno, ponto)) continue;
        if (mestre.disp.has(k)) disp[ponto].add(k);
      }
    }
  }
  return { disp };
}

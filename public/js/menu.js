// Menu do TPMobile: grupos, ícones, contadores de pendência e a barra de botões de baixo.
// As funções daqui são puras (testadas em tests/menu.test.mjs); o desenho fica no shell.js.

/** Ícone de cada seção (ajuda a achar pela figura, principalmente com letra grande). */
export const ICONES = {
  inicio: '🏠', votar: '🗳️', minha: '📅', escala: '📋', enquetes: '📝', votos: '✅',
  publicadores: '👥', pontos: '📍', usuarios: '🔑', links: '🔗', auditoria: '🕘',
};

/** Grupos do menu, na ordem. Cada um só aparece se a pessoa tiver alguma seção dele. */
export const GRUPOS = [
  ['Para mim', ['inicio', 'votar', 'minha', 'escala']],
  ['Organizar a semana', ['enquetes', 'votos']],
  ['Cadastros', ['publicadores', 'pontos']],
  ['Administração', ['usuarios', 'links', 'auditoria']],
];

/** [[título, [[id, rótulo], ...]], ...] só com as seções que a pessoa pode ver. */
export function gruposDoMenu(abas) {
  const rotulo = new Map(abas);
  return GRUPOS
    .map(([titulo, ids]) => [titulo, ids.filter((id) => rotulo.has(id)).map((id) => [id, rotulo.get(id)])])
    .filter(([, itens]) => itens.length);
}

/** Botões fixos embaixo (celular): Início e os 3 lugares mais usados de cada perfil, mais o Menu. */
export function itensBarra(abas, organizador) {
  const tem = new Set(abas.map(([id]) => id));
  const preferidos = organizador ? ['inicio', 'enquetes', 'votos', 'escala'] : ['inicio', 'votar', 'minha', 'escala'];
  const curto = { inicio: 'Início', votar: 'Votar', minha: 'Minha escala', escala: 'Escala', enquetes: 'Enquetes', votos: 'Votos' };
  return preferidos.filter((id) => tem.has(id)).map((id) => [id, curto[id]]);
}

/** Texto do contador ao lado do nome: "faltam 4", "1 troca", "2 aguardando". Zero = sem contador. */
export function textoContador(id, n) {
  if (!n) return '';
  if (id === 'votos') return `faltam ${n}`;
  if (id === 'escala') return `${n} troca${n > 1 ? 's' : ''}`;
  if (id === 'usuarios') return `${n} aguardando`;
  return String(n);
}

/**
 * Calcula os contadores a partir dos dados já carregados:
 *  votos    → quantos ativos ainda não votaram na enquete aberta mais recente;
 *  escala   → pedidos de troca abertos na escala publicada mais recente;
 *  usuarios → contas aguardando aprovação (só o administrador vê).
 */
export function calcularContadores({ pubs = [], votosAberta = null, trocasPublicada = [], usuarios = null }) {
  const ativos = pubs.filter((p) => p.ativo !== false).map((p) => p.id);
  const votaram = new Set((votosAberta || []).map((v) => v.publicadorId));
  return {
    votos: votosAberta ? ativos.filter((id) => !votaram.has(id)).length : 0,
    escala: (trocasPublicada || []).filter((t) => t.status === 'aberta').length,
    usuarios: usuarios ? usuarios.filter((u) => u.papel === 'pendente').length : 0,
  };
}

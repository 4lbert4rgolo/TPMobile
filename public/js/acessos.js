/* ============================================================ acessos (regras puras, sem tela)
 * Junta os aparelhos que entraram pelo mesmo link pessoal numa pessoa só,
 * e descobre o perfil que um link dá. Usado em Usuários e em Links de acesso.
 * Não mexe na tela nem no banco: por isso dá para testar em tests/acessos.test.mjs.
 */

/** Perfis que um link pessoal pode dar, na ordem em que aparecem na tela. */
export const PAPEIS_LINK = ['votante', 'servo', 'admin'];

/** Do menos para o mais poderoso: usado quando os aparelhos de uma pessoa estão com perfis diferentes. */
const FORCA = { removido: 0, pendente: 1, votante: 2, servo: 3, admin: 4, anciao: 4 };

/** Perfil que o link dá. Links antigos (sem o campo) continuam valendo como Votante. */
export function papelDoConvite(convite) {
  const p = convite?.papel === 'anciao' ? 'admin' : convite?.papel;
  return PAPEIS_LINK.includes(p) ? p : 'votante';
}

/**
 * Agrupa os usuários: cada link pessoal vira UMA linha, não importa em quantos aparelhos foi aberto.
 * Contas de e-mail continuam uma linha cada.
 * Cada grupo traz: id (o primeiro uid, usado nos botões), uids (todos), aparelhos, papel,
 * misturado (true se os aparelhos estão com perfis diferentes) e o primeiro aceite de privacidade.
 */
export function agruparUsuarios(usuarios) {
  const grupos = new Map();
  for (const u of usuarios) {
    const chave = u.conviteId ? `link:${u.conviteId}` : `uid:${u.id}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(u);
  }
  return [...grupos.values()].map((lista) => {
    const papeis = [...new Set(lista.map((u) => u.papel))];
    const papel = papeis.reduce((a, b) => ((FORCA[b] ?? 0) > (FORCA[a] ?? 0) ? b : a));
    const aceites = lista.map((u) => u.privacidadeAceitaEm).filter(Boolean).sort();
    const base = lista[0];
    return {
      ...base,
      papel,
      uids: lista.map((u) => u.id),
      aparelhos: lista.length,
      misturado: papeis.length > 1,
      privacidadeAceitaEm: aceites[0] || null,
    };
  });
}

/**
 * Contas de e-mail (ativas) já ligadas a este publicador.
 * Serve para avisar antes de gerar um link para quem já entra com e-mail e senha.
 */
export function contasDeEmailDo(publicadorId, usuarios) {
  if (!publicadorId) return [];
  return usuarios.filter((u) => u.publicadorId === publicadorId && !u.conviteId && u.papel !== 'removido');
}

/**
 * Plano para unificar os acessos duplicados (feitos antes da v3.13).
 * Para cada link pessoal:
 *  - os aparelhos com perfis diferentes passam todos para o perfil do grupo (o maior entre eles);
 *  - o link passa a guardar esse perfil, para o próximo aparelho já entrar certo.
 * Aparelhos com acesso removido ficam como estão, a não ser que todos estejam removidos.
 * Não grava nada: devolve a lista de mudanças, que a tela aplica.
 */
export function planoDeUnificacao(usuarios, convites) {
  const usuariosMudar = [];
  const convitesMudar = [];
  const porId = new Map(convites.map((cv) => [cv.id, cv]));
  for (const g of agruparUsuarios(usuarios.filter((u) => u.conviteId))) {
    const ativos = usuarios.filter((u) => u.conviteId === g.conviteId && u.papel !== 'removido');
    if (!ativos.length) continue;
    const maior = agruparUsuarios(ativos)[0].papel;
    const alvo = maior === 'anciao' ? 'admin' : maior;
    if (!PAPEIS_LINK.includes(alvo)) continue;
    for (const u of ativos) if (u.papel !== alvo) usuariosMudar.push({ id: u.id, papel: alvo, nome: u.nome });
    const cv = porId.get(g.conviteId);
    if (cv && cv.ativo !== false && papelDoConvite(cv) !== alvo) convitesMudar.push({ id: cv.id, papel: alvo, nome: cv.nome });
  }
  return { usuarios: usuariosMudar, convites: convitesMudar };
}

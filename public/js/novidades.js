// Mural de novidades da tela Início: avisos escritos pelos servos ministeriais e administradores.
// Ex.: "Carrinho do Atacadão suspenso neste sábado". Cada novidade pode ter um "válido até":
// depois dessa data ela some sozinha do mural (continua no banco até alguém apagar).
// Funções puras, testadas em tests/novidades.test.mjs.

export const LIMITES_NOVIDADE = { titulo: 80, texto: 600 };
export const MAX_NO_MURAL = 5;

/** Novidades que aparecem hoje: sem data de fim ou com "válido até" hoje ou depois; mais novas primeiro. */
export function novidadesVisiveis(lista, hojeISO) {
  return (lista || [])
    .filter((n) => !n.ate || n.ate >= hojeISO)
    .sort((a, b) => String(b.criadoISO || '').localeCompare(String(a.criadoISO || '')))
    .slice(0, MAX_NO_MURAL);
}

/** Quantas a pessoa ainda não viu neste aparelho (mais novas que a última visita ao Início). */
export const naoLidas = (visiveis, ultimaVistaISO) =>
  visiveis.filter((n) => !ultimaVistaISO || String(n.criadoISO || '') > ultimaVistaISO).length;

/** Confere o formulário. Devolve a mensagem de erro, ou '' se estiver tudo certo. */
export function validarNovidade({ titulo, texto, ate }, hojeISO) {
  if (!String(titulo || '').trim()) return 'Escreva um título.';
  if (titulo.trim().length > LIMITES_NOVIDADE.titulo) return `O título pode ter até ${LIMITES_NOVIDADE.titulo} letras.`;
  if (String(texto || '').length > LIMITES_NOVIDADE.texto) return `O texto pode ter até ${LIMITES_NOVIDADE.texto} letras.`;
  if (ate && ate < hojeISO) return 'A data "mostrar até" já passou.';
  return '';
}

/** Aviso no celular de uma novidade nova (vai para todos). */
export function avisoNovidade({ titulo, texto }) {
  return {
    tipo: 'novidade',
    titulo: `📢 ${titulo}`.slice(0, 80),
    corpo: (texto || 'Toque para ver no mural do app.').slice(0, 300),
    url: '?aba=inicio',
    para: { todos: true },
  };
}

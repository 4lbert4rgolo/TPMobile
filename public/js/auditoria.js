// Registro de auditoria: quem fez o quê e quando.
// Funções puras (sem tela e sem banco), testadas em tests/auditoria.test.mjs.
//
// Cada evento fica na coleção "auditoria" assim:
//   { area: 'escala', acao: 'Trocou pessoas', alvo: 'Semana de 23/11 a 28/11',
//     detalhe: 'Bairro Novo · Seg 23/11 · 06:00 às 08:00: Ana / Bia → Ana / Carla',
//     enqueteId: 'abc', uid, nome, papel, quando }
// Ninguém edita nem apaga um evento (só o administrador, na limpeza dos dados com mais de 3 meses).

import { nomeDia, dataCurta } from './escala.js';

export const AREAS = {
  escala: 'Escala',
  trocas: 'Trocas',
  enquetes: 'Enquetes',
  novidades: 'Novidades',
  votos: 'Votos',
  publicadores: 'Publicadores',
  pontos: 'Pontos',
  usuarios: 'Usuários',
  links: 'Links de acesso',
  dados: 'Dados',
  privacidade: 'Privacidade',
};

/** Áreas que um votante também registra (o resto é só de organizador; ver firestore.rules). */
export const AREAS_DO_VOTANTE = ['privacidade', 'trocas'];

const LIMITES = { acao: 120, alvo: 160, detalhe: 600 };
const corta = (texto, max) => {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Monta o evento com o nome e o perfil de quem fez, cortando textos muito longos. */
export function montarEvento({ area, acao, alvo = '', detalhe = '', enqueteId = null }, perfil) {
  if (!AREAS[area]) throw new Error(`Área de auditoria desconhecida: ${area}`);
  return {
    area,
    acao: corta(acao, LIMITES.acao),
    alvo: corta(alvo, LIMITES.alvo),
    detalhe: corta(detalhe, LIMITES.detalhe),
    enqueteId: enqueteId || null,
    nome: perfil?.nome || '',
    papel: perfil?.papel || '',
  };
}

/** Nomes de uma célula da escala: "Ana / Bia", "vazio" ou o motivo do bloqueio. */
export function nomesCelula(cel) {
  if (!cel || cel.tipo === 'vazio') return 'vazio';
  if (cel.tipo === 'equipe') return cel.pessoas.map((p) => p.nome).join(' / ');
  return cel.nota || 'bloqueado';
}

/** "Bairro Novo · Seg 23/11 · 06:00 às 08:00" */
export const lugarDaCelula = (ponto, data, turno) => `${ponto} · ${nomeDia(data).slice(0, 3)} ${dataCurta(data)} · ${turno}`;

/** Detalhe de uma troca de pessoas num horário: "lugar: Ana / Bia → Ana / Carla". */
export const detalheTrocaCelula = (ponto, data, turno, antes, depois) =>
  `${lugarDaCelula(ponto, data, turno)}: ${nomesCelula(antes)} → ${nomesCelula(depois)}`;

/** Filtra pela área e pelo texto digitado (sem acento e sem maiúscula, em qualquer campo). */
export function filtrarEventos(eventos, { area = '', termo = '' } = {}, normalizar = (t) => t.toLowerCase()) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  return eventos.filter((e) => {
    if (area && e.area !== area) return false;
    if (!palavras.length) return true;
    const texto = normalizar([e.nome, e.acao, e.alvo, e.detalhe, AREAS[e.area]].join(' '));
    return palavras.every((p) => texto.includes(p));
  });
}

/** Junta os eventos por dia, do mais novo para o mais velho: [{ dia: '2026-11-20', eventos }]. */
export function agruparPorDia(eventos) {
  const grupos = new Map();
  for (const e of [...eventos].sort((a, b) => (b.quando || '').localeCompare(a.quando || ''))) {
    const d = new Date(e.quando);
    const dia = Number.isNaN(d.getTime()) ? 'sem data'
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(e);
  }
  return [...grupos].map(([dia, lista]) => ({ dia, eventos: lista }));
}

/** "14:32" no horário do aparelho. */
export function horaCurta(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

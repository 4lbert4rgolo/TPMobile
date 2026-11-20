// Impressão e Excel da escala: o texto de cada célula e o desenho da planilha.
// Funções puras (sem tela), testadas em tests/relatorios.test.mjs.

import { celulaBloqueada, nomeDia, dataCurta } from './escala.js';

/** Como os nomes de uma equipe aparecem na escala: "Ana / Bia". */
export const SEPARADOR_ESCALA = ' / ';

/** Cores do app (as mesmas da tela), em hexadecimal sem "#", como o Excel pede. */
export const CORES = {
  verde: '0F7A68', escuro: '0C3B34', menta: 'D5F1EC', claro: 'F4F7F6', linha: 'D3DEDB',
  texto: '1F2D2A', cinza: '9AA9A5', bege: 'FDF3E2', marrom: '8A5A12', branco: 'FFFFFF',
};

/** Texto de uma célula: nomes da equipe, "Pregação" (sem carrinho escalado) ou o motivo do bloqueio. */
export function textoCelula(enquete, matriz, ponto, data, turno) {
  const motivo = celulaBloqueada(enquete, data, turno, ponto);
  const cel = matriz?.[ponto]?.[data]?.[turno] || (motivo ? { tipo: 'bloqueio', nota: motivo } : { tipo: 'vazio' });
  if (cel.tipo === 'equipe') return { tipo: 'equipe', texto: cel.pessoas.map((p) => p.nome).join(SEPARADOR_ESCALA) };
  if (cel.tipo === 'bloqueio') return { tipo: 'bloqueio', texto: cel.nota || motivo || 'Sem carrinho' };
  return { tipo: 'vazio', texto: 'Pregação' };
}

/** "20/11/2026" */
export const dataLonga = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/* ------------------------------------------------------------ Excel */

const borda = { style: 'thin', color: { rgb: CORES.linha } };
const bordas = { top: borda, bottom: borda, left: borda, right: borda };
const centro = { horizontal: 'center', vertical: 'center', wrapText: true };

/** Estilo de cada tipo de célula, no formato da biblioteca xlsx-js-style. */
export const ESTILOS = {
  titulo: { font: { bold: true, sz: 16, color: { rgb: CORES.branco } }, fill: { fgColor: { rgb: CORES.verde } }, alignment: { vertical: 'center', indent: 1 } },
  subtitulo: { font: { sz: 11, color: { rgb: CORES.escuro } }, fill: { fgColor: { rgb: CORES.menta } }, alignment: { vertical: 'center', indent: 1 } },
  cabecalho: { font: { bold: true, color: { rgb: CORES.branco } }, fill: { fgColor: { rgb: CORES.escuro } }, alignment: centro, border: bordas },
  horario: { font: { bold: true, color: { rgb: CORES.escuro } }, fill: { fgColor: { rgb: CORES.menta } }, alignment: centro, border: bordas },
  equipe: (par) => ({ font: { bold: true, color: { rgb: CORES.texto } }, fill: { fgColor: { rgb: par ? CORES.claro : CORES.branco } }, alignment: centro, border: bordas }),
  vazio: (par) => ({ font: { italic: true, color: { rgb: CORES.cinza } }, fill: { fgColor: { rgb: par ? CORES.claro : CORES.branco } }, alignment: centro, border: bordas }),
  bloqueio: () => ({ font: { italic: true, color: { rgb: CORES.marrom } }, fill: { fgColor: { rgb: CORES.bege } }, alignment: centro, border: bordas }),
  rodape: { font: { italic: true, sz: 9, color: { rgb: '54625F' } } },
};

/** Nome de aba aceito pelo Excel (até 31 letras, sem / \ ? * [ ] :). */
export const nomeDaAba = (ponto) => ponto.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Ponto';

/**
 * Desenho de uma aba (um ponto): as linhas com os valores, o estilo de cada célula,
 * as células mescladas, as larguras das colunas e as alturas das linhas.
 * Endereços das células: linha e coluna começando em 0 (A1 = [0][0]).
 */
export function planilhaDoPonto(enquete, matriz, ponto, geradoEm = new Date()) {
  const colunas = enquete.dias.length + 1;
  const linhas = [];
  const estilos = [];
  const linha = (valores, estilosDaLinha) => { linhas.push(valores); estilos.push(estilosDaLinha); };

  const vazias = (n) => Array(n).fill('');
  linha([`Escala de Carrinhos — ${ponto}`, ...vazias(colunas - 1)], Array(colunas).fill(ESTILOS.titulo));
  linha([`Testemunho Público · ${enquete.titulo} · Período: ${dataCurta(enquete.inicio)} a ${dataCurta(enquete.fim)}`, ...vazias(colunas - 1)], Array(colunas).fill(ESTILOS.subtitulo));
  linha(vazias(colunas), Array(colunas).fill(null));
  linha(['Horário', ...enquete.dias.map((d) => `${nomeDia(d.data)}\n${dataCurta(d.data)}`)], Array(colunas).fill(ESTILOS.cabecalho));

  enquete.turnos.forEach((turno, i) => {
    const par = i % 2 === 1;
    const celulas = enquete.dias.map((d) => textoCelula(enquete, matriz, ponto, d.data, turno));
    linha([turno, ...celulas.map((c) => c.texto)], [ESTILOS.horario, ...celulas.map((c) => ESTILOS[c.tipo](par))]);
  });

  linha(vazias(colunas), Array(colunas).fill(null));
  linha([`Gerado pelo TPMobile em ${dataLonga(geradoEm)}`, ...vazias(colunas - 1)], [ESTILOS.rodape, ...Array(colunas - 1).fill(null)]);

  return {
    nome: nomeDaAba(ponto),
    linhas,
    estilos,
    mesclar: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colunas - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colunas - 1 } },
      { s: { r: linhas.length - 1, c: 0 }, e: { r: linhas.length - 1, c: colunas - 1 } },
    ],
    larguras: [{ wch: 16 }, ...enquete.dias.map(() => ({ wch: 24 }))],
    alturas: [{ hpt: 32 }, { hpt: 22 }, { hpt: 8 }, { hpt: 32 }, ...enquete.turnos.map(() => ({ hpt: 36 }))],
  };
}

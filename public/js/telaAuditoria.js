import { $, esc, estado, toast } from './nucleo.js';
import { montarEvento, filtrarEventos, agruparPorDia, horaCurta, AREAS } from './auditoria.js';
import { normalizarBusca } from './busca.js';
import { nomeDia, dataCurta } from './escala.js';
import { PAPEIS } from './data.js';

/* ============================================================ registrar */

/**
 * Grava um evento de auditoria sem fazer a pessoa esperar.
 * Se der erro (ex.: sem internet), a ação continua valendo; o erro vai só para o console.
 */
export function registrar(evento) {
  try {
    const dados = montarEvento(evento, estado.perfil);
    Promise.resolve(estado.backend.registrarAuditoria(dados)).catch((e) => console.error('auditoria', e));
  } catch (e) {
    console.error('auditoria', e);
  }
}

/* ============================================================ tela (Menu > Auditoria) */

function linhaEvento(e) {
  return `<li class="py-2 flex flex-wrap gap-x-3 gap-y-1">
    <span class="text-sm text-slate-500 w-12">${horaCurta(e.quando)}</span>
    <div class="flex-1 min-w-[12rem]">
      <p class="text-sm"><strong>${esc(e.nome || 'Alguém')}</strong> <span class="text-slate-500">(${esc(PAPEIS[e.papel] || e.papel || '—')})</span> · ${esc(e.acao)}${e.alvo ? ` · <span class="text-slate-600">${esc(e.alvo)}</span>` : ''}</p>
      ${e.detalhe ? `<p class="text-sm text-slate-600">${esc(e.detalhe)}</p>` : ''}
    </div>
    <span class="text-xs bg-slate-100 text-slate-600 rounded-full px-2 self-start">${esc(AREAS[e.area] || e.area)}</span>
  </li>`;
}

/** Lista agrupada por dia (usada na tela de Auditoria e no histórico da escala). */
export function htmlEventos(eventos) {
  if (!eventos.length) return '<p class="text-slate-500 text-sm">Nenhum registro encontrado.</p>';
  return agruparPorDia(eventos).map(({ dia, eventos: lista }) => `
    <section class="mb-4">
      <h3 class="font-bold text-sm text-slate-700 mb-1">${dia === 'sem data' ? 'Sem data' : `${nomeDia(dia)}, ${dataCurta(dia)}/${dia.slice(0, 4)}`}</h3>
      <ul class="bg-white rounded-xl border px-4 divide-y">${lista.map(linhaEvento).join('')}</ul>
    </section>`).join('');
}

function desenharLista() {
  const area = $('#aud-area')?.value || '';
  const termo = $('#aud-busca')?.value || '';
  const filtrados = filtrarEventos(estado.auditoria || [], { area, termo }, normalizarBusca);
  $('#aud-lista').innerHTML = `<p class="text-sm text-slate-500 mb-3">${filtrados.length} de ${(estado.auditoria || []).length} registro(s).</p>${htmlEventos(filtrados)}`;
}

export async function renderAuditoria() {
  const c = $('#conteudo');
  c.innerHTML = '<p class="text-slate-500">Carregando…</p>';
  try {
    estado.auditoria = await estado.backend.listarAuditoria({ limite: 500 });
  } catch (e) {
    console.error(e);
    estado.auditoria = [];
    toast('Não foi possível carregar a auditoria.', 'erro');
  }
  c.innerHTML = `
    <h2 class="text-lg font-bold mb-1">Auditoria</h2>
    <p class="text-sm text-slate-600 mb-4">Quem fez o quê e quando: escalas, enquetes, publicadores, pontos, usuários, links, dados e aceites de privacidade. Aparecem os últimos 500 registros. Os registros com mais de 3 meses são apagados junto com os dados antigos.</p>
    <div class="flex flex-wrap gap-2 mb-3">
      <input id="aud-busca" type="search" class="border rounded-lg p-2 flex-1 min-w-[12rem]" placeholder="Buscar por nome, ação ou detalhe" aria-label="Buscar na auditoria" data-aud-filtro>
      <select id="aud-area" class="border rounded-lg p-2" aria-label="Área" data-aud-filtro>
        <option value="">Todas as áreas</option>
        ${Object.entries(AREAS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select>
    </div>
    <div id="aud-lista"></div>`;
  desenharLista();
}

export const filtrarAuditoria = desenharLista;

/* ============================================================ histórico de uma escala */

export async function abrirHistoricoEscala(enqueteId, destino) {
  destino.innerHTML = '<p class="text-sm text-slate-500">Carregando…</p>';
  try {
    const eventos = await estado.backend.listarAuditoria({ enqueteId, limite: 200 });
    destino.innerHTML = htmlEventos(eventos);
  } catch (e) {
    console.error(e);
    destino.innerHTML = '<p class="text-sm text-red-700">Não foi possível carregar o histórico.</p>';
  }
}

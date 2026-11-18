import { $, STATUS, abrirModal, ehOrganizador, esc, estado, tentar, toast } from './nucleo.js';
import { renderAba } from './shell.js';
import { lembrar } from './votos.js';
import { gerarDias, nomeDia, dataCurta, parseISO, toISO } from './escala.js';

/* ============================================================ enquetes (organizadores) */

export const somarDias = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const proximaSegundaISO = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return toISO(d);
};
export const turnosDoEditor = (ed) => ed.turnosTexto.split('\n').map((t) => t.trim()).filter(Boolean);
export const tituloSugerido = (ed) => `${ed.tipo === 'evento' ? 'Evento' : 'Semana'} de ${dataCurta(ed.inicio)} a ${dataCurta(ed.fim)}`;

export function aplicarBloqueiosPadrao(ed) {
  const turnos = turnosDoEditor(ed);
  ed.bloqueios = [];
  for (const dia of ed.dias) {
    const dow = parseISO(dia.data).getDay();
    for (const b of estado.config.bloqueiosPadrao || []) {
      if (b.diaSemana === dow && turnos.includes(b.turno)) ed.bloqueios.push({ data: dia.data, turno: b.turno, motivo: b.motivo });
    }
  }
}

export function regenerarDias(ed) {
  const antigos = new Map(ed.dias.map((d) => [d.data, d]));
  ed.dias = gerarDias(ed.inicio, ed.fim).map((d) => antigos.get(d.data) || d);
  ed.bloqueios = ed.bloqueios.filter((b) => ed.dias.some((d) => d.data === b.data));
}

export function novoEditor(tipo = 'semana') {
  const cfg = estado.config;
  const inicio = proximaSegundaISO();
  const fim = somarDias(inicio, 5);
  const ed = {
    id: null, titulo: '', tipo, status: 'rascunho', inicio, fim,
    dias: gerarDias(inicio, fim),
    turnosTexto: cfg.turnos.join('\n'),
    pontos: new Set(cfg.pontos),
    bloqueios: [], maxIrmas: 3, maxIrmaos: '', parFixoJunto: true,
  };
  aplicarBloqueiosPadrao(ed);
  ed.titulo = tituloSugerido(ed);
  return ed;
}

export function editorDe(e, copia = false) {
  const desloc = copia ? 7 : 0;
  const ed = {
    id: copia ? null : e.id,
    titulo: copia ? `${e.titulo} (cópia)` : e.titulo,
    tipo: e.tipo || 'semana',
    status: copia ? 'rascunho' : e.status,
    inicio: somarDias(e.inicio, desloc),
    fim: somarDias(e.fim, desloc),
    dias: e.dias.map((d) => ({ ...d, data: somarDias(d.data, desloc) })),
    turnosTexto: e.turnos.join('\n'),
    pontos: new Set(e.pontos),
    bloqueios: (e.bloqueios || []).map((b) => ({ ...b, data: somarDias(b.data, desloc) })),
    maxIrmas: e.regras?.maxIrmas ?? 3,
    maxIrmaos: e.regras?.maxIrmaos ?? '',
    parFixoJunto: e.regras?.parFixoJunto ?? true,
  };
  return ed;
}

export async function renderEnquetes() {
  const c = $('#conteudo');
  if (estado.ed) return renderEditor();

  const ativosIds = new Set(estado.pubs.filter((p) => p.ativo !== false).map((p) => p.id));
  const progresso = new Map();
  await Promise.all(estado.enquetes.filter((e) => e.status === 'aberta').map(async (e) => {
    try { progresso.set(e.id, (await estado.backend.listarVotos(e.id)).filter((v) => ativosIds.has(v.publicadorId)).length); } catch { /* sem contador */ }
  }));

  c.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 class="text-lg font-bold">Enquetes</h2>
      <div class="flex gap-2">
        <button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold" data-acao="nova-enquete" data-id="semana">Nova enquete da semana</button>
        <button class="bg-blue-100 text-blue-800 rounded-lg px-4 py-2 font-semibold" data-acao="nova-enquete" data-id="evento">Nova enquete de evento</button>
      </div>
    </div>
    <div class="space-y-3">
      ${estado.enquetes.map((e) => {
        const [rotuloStatus, cor] = STATUS[e.status] || [e.status, 'bg-slate-200'];
        const botoes = [
          ['editar-enquete', 'Editar'],
          ['duplicar-enquete', 'Duplicar'],
          e.status === 'aberta' ? ['encerrar-votacao', 'Encerrar votação'] : ['abrir-votacao', e.status === 'rascunho' ? 'Abrir votação' : 'Reabrir votação'],
          ['ver-votos', 'Ver votos'],
          ['montar-escala', 'Montar escala'],
          ['texto-whats', 'Texto do WhatsApp'],
          ['excluir-enquete', 'Excluir'],
        ];
        return `<article class="bg-white rounded-xl shadow-sm border p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div><h3 class="font-bold">${esc(e.titulo)}</h3>
              <p class="text-sm text-slate-500">${dataCurta(e.inicio)} a ${dataCurta(e.fim)} · ${e.pontos.length} ponto(s) · ${e.tipo === 'evento' ? 'Evento' : 'Semana'}</p></div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${cor}">${rotuloStatus}</span>
          </div>
          ${progresso.has(e.id) ? `<p class="text-sm mt-2"><strong>${progresso.get(e.id)} de ${ativosIds.size}</strong> já votaram · <button class="text-green-700 underline font-semibold" data-acao="ver-votos" data-id="${esc(e.id)}">ver quem falta e lembrar</button></p>` : ''}
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
            ${botoes.map(([a, r]) => `<button class="${a === 'excluir-enquete' ? 'text-red-600' : 'text-blue-700'} underline" data-acao="${a}" data-id="${esc(e.id)}">${r}</button>`).join('')}
          </div></article>`;
      }).join('') || '<div class="bg-white rounded-xl border p-6 text-slate-600">Nenhuma enquete ainda. Crie a primeira com os botões acima.</div>'}
    </div>`;
}

export function renderEditor() {
  const ed = estado.ed;
  const turnos = turnosDoEditor(ed);
  const todosPontos = [...new Set([...estado.config.pontos, ...ed.pontos])];
  const diasAtivos = ed.dias.filter((d) => d.ativo !== false);

  $('#conteudo').innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-bold">${ed.id ? 'Editar enquete' : 'Nova enquete'}</h2>
      <button class="text-slate-600 underline" data-acao="cancelar-editor">Voltar sem salvar</button>
    </div>
    <div class="space-y-4">
      <section class="bg-white rounded-xl border p-4 grid sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2"><label class="text-sm font-medium" for="ed-titulo">Título</label>
          <input id="ed-titulo" class="w-full border rounded-lg p-2" value="${esc(ed.titulo)}" data-campo="titulo"></div>
        <div><label class="text-sm font-medium" for="ed-tipo">Tipo</label>
          <select id="ed-tipo" class="w-full border rounded-lg p-2" data-campo="tipo">
            <option value="semana" ${ed.tipo === 'semana' ? 'selected' : ''}>Semana comum</option>
            <option value="evento" ${ed.tipo === 'evento' ? 'selected' : ''}>Evento especial</option></select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm font-medium" for="ed-inicio">Início</label>
            <input id="ed-inicio" type="date" class="w-full border rounded-lg p-2" value="${esc(ed.inicio)}" data-campo="inicio"></div>
          <div><label class="text-sm font-medium" for="ed-fim">Fim</label>
            <input id="ed-fim" type="date" class="w-full border rounded-lg p-2" value="${esc(ed.fim)}" data-campo="fim"></div>
        </div>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-1">Dias</h3>
        <p class="text-sm text-slate-500 mb-3">Desmarque os dias sem carrinho e diga o motivo (por exemplo, congresso ou assembleia).</p>
        ${ed.dias.length ? `<div class="space-y-2">${ed.dias.map((d, i) => `
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 w-56 text-sm"><input type="checkbox" ${d.ativo !== false ? 'checked' : ''} data-campo="dia-ativo" data-i="${i}">
              ${nomeDia(d.data)} ${dataCurta(d.data)}</label>
            ${d.ativo === false ? `<input class="border rounded-lg p-2 text-sm flex-1 min-w-[12rem]" placeholder="Motivo (ex.: Assembleia)" value="${esc(d.motivo)}" data-campo="dia-motivo" data-i="${i}" aria-label="Motivo">` : ''}
          </div>`).join('')}</div>` : '<p class="text-red-600 text-sm">Confira as datas: o fim precisa ser depois do início.</p>'}
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-1">Horários</h3>
        <p class="text-sm text-slate-500 mb-2">Um horário por linha.</p>
        <textarea class="w-full border rounded-lg p-2 text-sm" rows="6" data-campo="turnos" aria-label="Horários">${esc(ed.turnosTexto)}</textarea>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-2">Pontos</h3>
        <div class="space-y-1 mb-3">${todosPontos.map((p) => `
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" value="${esc(p)}" ${ed.pontos.has(p) ? 'checked' : ''} data-campo="ponto"> ${esc(p)}</label>`).join('')}</div>
        <div class="flex gap-2"><input id="novo-ponto" class="border rounded-lg p-2 text-sm flex-1" placeholder="Adicionar outro ponto" aria-label="Novo ponto">
          <button type="button" class="bg-slate-100 rounded-lg px-3 text-sm" data-acao="add-ponto">Adicionar</button></div>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-1">Horários bloqueados</h3>
        <p class="text-sm text-slate-500 mb-2">Por exemplo, as reuniões. Nesses horários não há carrinho. Você pode bloquear em todos os pontos ou só em um.</p>
        <ul class="text-sm mb-3 space-y-1">${ed.bloqueios.map((b, i) => `
          <li class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1">
            <span>${nomeDia(b.data)} ${dataCurta(b.data)} · ${b.turno === '*' ? 'Dia todo' : esc(b.turno)} · ${esc(b.ponto || 'Todos os pontos')} · ${esc(b.motivo || 'Bloqueado')}</span>
            <button type="button" class="text-red-600 underline" data-acao="del-bloqueio" data-id="${i}">Remover</button></li>`).join('') || '<li class="text-slate-400">Nenhum.</li>'}</ul>
        <div class="grid sm:grid-cols-3 gap-2">
          <select id="bl-dia" class="border rounded-lg p-2 text-sm" aria-label="Dia">${diasAtivos.map((d) => `<option value="${esc(d.data)}">${nomeDia(d.data)} ${dataCurta(d.data)}</option>`).join('')}</select>
          <select id="bl-turno" class="border rounded-lg p-2 text-sm" aria-label="Horário"><option value="*">Dia todo</option>${turnos.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
          <select id="bl-ponto" class="border rounded-lg p-2 text-sm" aria-label="Ponto"><option value="">Todos os pontos</option>${[...ed.pontos].map((po) => `<option>${esc(po)}</option>`).join('')}</select>
        </div>
        <div class="flex gap-2 mt-2">
          <input id="bl-motivo" class="border rounded-lg p-2 text-sm flex-1" placeholder="Motivo (ex.: Reunião)" aria-label="Motivo">
          <button type="button" class="bg-slate-100 rounded-lg text-sm px-4" data-acao="add-bloqueio">Adicionar</button>
        </div>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-2">Regras da escala</h3>
        <div class="flex flex-wrap items-center gap-6 text-sm">
          <label class="flex items-center gap-2">Máximo de participações por irmã
            <select class="border rounded-lg p-1" data-campo="maxIrmas">${[2, 3, 4, 5].map((n) => `<option ${Number(ed.maxIrmas) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="flex items-center gap-2">Máximo por irmão
            <select class="border rounded-lg p-1" data-campo="maxIrmaos"><option value="">Sem limite</option>${[3, 4, 5, 6, 8, 10].map((n) => `<option ${Number(ed.maxIrmaos) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="flex items-center gap-2"><input type="checkbox" ${ed.parFixoJunto ? 'checked' : ''} data-campo="parFixoJunto"> Quem tem par fixo só participa junto com o par</label>
        </div>
        <p class="text-xs text-slate-500 mt-2">Quem "precisa de trio" sempre entra em equipe de 3 pessoas. As demais equipes são duplas.</p>
      </section>

      <div class="flex flex-wrap gap-2">
        <button class="bg-slate-200 rounded-lg px-5 py-2 font-semibold" data-acao="salvar-enquete" data-id="manter">Salvar</button>
        <button class="bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold" data-acao="salvar-enquete" data-id="aberta">Salvar e abrir votação</button>
      </div>
    </div>`;
}

export function campoMudou(el, digitando = false) {
  const ed = estado.ed;
  if (!ed) return;
  const i = Number(el.dataset.i);
  const sugeridoAntes = tituloSugerido(ed);

  switch (el.dataset.campo) {
    case 'titulo': ed.titulo = el.value; break;
    case 'tipo':
      ed.tipo = el.value;
      if (!ed.titulo || ed.titulo === sugeridoAntes) ed.titulo = tituloSugerido(ed);
      renderEditor();
      break;
    case 'inicio':
    case 'fim':
      if (digitando) return;
      ed[el.dataset.campo] = el.value;
      regenerarDias(ed);
      if (!ed.titulo || ed.titulo === sugeridoAntes) ed.titulo = tituloSugerido(ed);
      renderEditor();
      break;
    case 'dia-ativo': ed.dias[i].ativo = el.checked; renderEditor(); break;
    case 'dia-motivo': ed.dias[i].motivo = el.value; break;
    case 'turnos': ed.turnosTexto = el.value; if (!digitando) renderEditor(); break;
    case 'ponto': if (el.checked) ed.pontos.add(el.value); else ed.pontos.delete(el.value); break;
    case 'maxIrmas': ed.maxIrmas = el.value; break;
    case 'maxIrmaos': ed.maxIrmaos = el.value; break;
    case 'parFixoJunto': ed.parFixoJunto = el.checked; break;
    default: break;
  }
}

export async function recarregarEnquetes() {
  estado.enquetes = await estado.backend.listarEnquetes({ somenteVisiveis: !ehOrganizador() });
}

export async function salvarEditor(alvo) {
  const ed = estado.ed;
  const turnos = turnosDoEditor(ed);
  if (!ed.titulo.trim()) return toast('Dê um título à enquete.', 'erro');
  if (!ed.dias.length) return toast('Confira as datas de início e fim.', 'erro');
  if (!turnos.length) return toast('Informe pelo menos um horário.', 'erro');
  if (!ed.pontos.size) return toast('Marque pelo menos um ponto.', 'erro');

  const enquete = {
    id: ed.id || undefined,
    titulo: ed.titulo.trim(),
    tipo: ed.tipo,
    status: alvo === 'aberta' ? 'aberta' : ed.status || 'rascunho',
    inicio: ed.inicio,
    fim: ed.fim,
    dias: ed.dias,
    turnos,
    pontos: [...ed.pontos],
    bloqueios: ed.bloqueios.filter((b) => (b.turno === '*' || turnos.includes(b.turno)) && (!b.ponto || ed.pontos.has(b.ponto))),
    regras: { maxIrmas: Number(ed.maxIrmas) || 3, maxIrmaos: Number(ed.maxIrmaos) || null, parFixoJunto: ed.parFixoJunto },
  };

  const ok = await tentar(async () => {
    await estado.backend.salvarEnquete(enquete);
    const novos = enquete.pontos.filter((p) => !estado.config.pontos.includes(p));
    if (novos.length) {
      estado.config = { ...estado.config, pontos: [...estado.config.pontos, ...novos] };
      await estado.backend.salvarConfig(estado.config);
    }
  }, alvo === 'aberta' ? 'Enquete salva e votação aberta.' : 'Enquete salva.');

  if (ok) {
    estado.ed = null;
    await recarregarEnquetes();
    renderAba();
  }
}

export async function mudarStatus(id, status, mensagem) {
  const e = estado.enquetes.find((x) => x.id === id);
  if (!e) return;
  const ok = await tentar(() => estado.backend.salvarEnquete({ ...e, status }), mensagem);
  if (ok) { await recarregarEnquetes(); renderAba(); }
}

export async function excluirEnquete(id) {
  const e = estado.enquetes.find((x) => x.id === id);
  if (!e || !confirm(`Excluir "${e.titulo}"? Os votos e a escala dessa enquete serão apagados.`)) return;
  const ok = await tentar(() => estado.backend.excluirEnquete(id), 'Enquete excluída.');
  if (ok) { await recarregarEnquetes(); renderAba(); }
}

export function textoWhatsApp(e) {
  const link = `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
  const dias = e.dias.map((d) => `• ${nomeDia(d.data)} ${dataCurta(d.data)}${d.ativo === false ? ` — ${d.motivo || 'sem carrinho'}` : ''}`).join('\n');
  const obs = (e.bloqueios || []).length
    ? `\n*Atenção:*\n${e.bloqueios.map((b) => `• ${nomeDia(b.data)} ${dataCurta(b.data)}, ${b.turno === '*' ? 'dia todo' : b.turno}: ${b.motivo || 'sem carrinho'}${b.ponto ? ` (só em ${b.ponto})` : ''}`).join('\n')}\n`
    : '';
  return `🛒 *Enquete do carrinho — ${e.titulo}*\n\nPor favor, votem nos horários em que podem participar, pelo aplicativo:\n${link}\n\n*Pontos:* ${e.pontos.join(' · ')}\n\n*Dias:*\n${dias}\n\n*Horários:* ${e.turnos.join(' | ')}\n${obs}\nO voto pode ser alterado até a enquete ser encerrada.`;
}

export function abrirTextoWhats(id) {
  const e = estado.enquetes.find((x) => x.id === id);
  if (!e) return;
  abrirModal(`
    <h2 class="font-bold mb-2">Texto para o grupo</h2>
    <textarea id="texto-whats" class="w-full border rounded-lg p-2 text-sm" rows="14" readonly>${esc(textoWhatsApp(e))}</textarea>
    <div class="flex justify-end gap-2 mt-3">
      <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Fechar</button>
      <button class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="copiar-whats">Copiar</button>
    </div>`);
}

// Tela Início: o primeiro lugar que a pessoa vê ao abrir o app.
//  - "O que fazer agora": votar (com o prazo) ou "você já votou";
//  - o próximo horário da pessoa na escala;
//  - para servos e anciãos, o resumo da semana (votos, trocas, escala, usuários) com atalhos;
//  - o mural de novidades, escrito pelos servos e administradores.
// Cada bloco é carregado separado: se um falhar (sem internet, por exemplo), os outros aparecem.

import { $, abrirModal, ehOrganizador, esc, estado, fecharModal, gravarPref, lerPref, tentar, toast } from './nucleo.js';
import { votacaoAberta, textoPrazo } from './prazo.js';
import { carregarMeusHorarios } from './telaMinha.js';
import { rotuloDia } from './agenda.js';
import { toISO, dataCurta } from './escala.js';
import { calcularContadores } from './menu.js';
import { novidadesVisiveis, naoLidas, validarNovidade, avisoNovidade, LIMITES_NOVIDADE } from './novidades.js';
import { avisar } from './notificacoes.js';
import { registrar } from './telaAuditoria.js';

const hojeISO = () => toISO(new Date());
const visiveis = () => (estado.enquetes || []).filter((e) => !e.arquivada);

/** Botão grande de atalho. */
const atalho = (icone, rotulo, acao, extra = '') =>
  `<button class="atalho" data-acao="${acao}" ${extra}><span class="atalho-icone" aria-hidden="true">${icone}</span><span>${rotulo}</span></button>`;

/* ------------------------------------------------------------ blocos */

async function blocoAgora() {
  const aberta = visiveis().find((e) => votacaoAberta(e));
  const pubId = estado.perfil.publicadorId;
  if (!aberta) return `<div class="cartao-inicio"><p class="text-slate-600">Nenhuma votação aberta agora. Quando abrir, você recebe o aviso.</p></div>`;
  const prazo = aberta.prazo ? ` A votação fecha <strong>${esc(textoPrazo(aberta.prazo))}</strong>.` : '';
  if (!pubId) return `<div class="cartao-inicio"><p><strong>${esc(aberta.titulo)}</strong>: votação aberta.${prazo}</p></div>`;
  let jaVotou = false;
  try { jaVotou = Boolean(await estado.backend.getVoto(aberta.id, pubId)); } catch { /* sem internet: mostra como pendente */ }
  return jaVotou
    ? `<div class="cartao-inicio cartao-ok"><p class="font-semibold">✅ Você já votou em ${esc(aberta.titulo)}.</p>
        <p class="text-sm mt-1">Dá para mudar até a votação fechar.${prazo}</p>
        <button class="mt-3 px-4 py-2 rounded-lg bg-white border font-semibold" data-acao="aba" data-id="votar">Mudar meu voto</button></div>`
    : `<div class="cartao-inicio cartao-pendente"><p class="font-semibold">⏰ Falta o seu voto: ${esc(aberta.titulo)}</p>
        <p class="text-sm mt-1">Marque os horários em que você pode.${prazo}</p>
        <button class="mt-3 px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="aba" data-id="votar">Votar agora</button></div>`;
}

async function blocoProximo() {
  if (!estado.perfil.publicadorId) return '';
  let itens = [];
  try { itens = await carregarMeusHorarios(); } catch { return ''; }
  const prox = itens.find((i) => i.data >= hojeISO());
  if (!prox) return '';
  const com = prox.companheiros.length ? `, com ${prox.companheiros.map(esc).join(' e ')}` : '';
  return `<div class="cartao-inicio">
    <p class="titulo-bloco">📅 Seu próximo horário</p>
    <p class="text-lg font-bold">${esc(rotuloDia(prox.data))}</p>
    <p>${esc(prox.turno)} · ${esc(prox.ponto)}${com}</p>
    <button class="mt-3 px-4 py-2 rounded-lg bg-slate-100 font-semibold" data-acao="aba" data-id="minha">Ver minha escala ou pedir troca</button></div>`;
}

async function blocoResumo() {
  if (!ehOrganizador()) return '';
  const b = estado.backend;
  const aberta = visiveis().find((e) => e.status === 'aberta');
  const publicada = visiveis().find((e) => e.status === 'publicada');
  const fechada = visiveis().find((e) => e.status === 'fechada');
  const [votos, trocas, usuarios] = await Promise.all([
    aberta ? b.listarVotos(aberta.id).catch(() => null) : null,
    publicada ? b.listarTrocas(publicada.id).catch(() => []) : [],
    estado.perfil.papel === 'admin' ? b.listarUsuarios().catch(() => null) : null,
  ]);
  const c = calcularContadores({ pubs: estado.pubs, votosAberta: votos, trocasPublicada: trocas, usuarios });
  const ativos = (estado.pubs || []).filter((p) => p.ativo !== false).length;
  const linhas = [];
  if (aberta) linhas.push(['✅', `<strong>${ativos - c.votos} de ${ativos}</strong> já votaram em ${esc(aberta.titulo)}`, 'votos', c.votos ? `faltam ${c.votos}` : '']);
  if (fechada) linhas.push(['📋', `Votação de ${esc(fechada.titulo)} encerrada: <strong>falta gerar e publicar a escala</strong>`, 'escala', '']);
  if (publicada) linhas.push(['📋', `Escala de ${esc(publicada.titulo)} publicada`, 'escala', c.escala ? `${c.escala} troca${c.escala > 1 ? 's' : ''}` : '']);
  if (c.usuarios) linhas.push(['🔑', 'Acesso aguardando aprovação', 'usuarios', `${c.usuarios} aguardando`]);
  if (!linhas.length) linhas.push(['📝', 'Nenhuma enquete em andamento. Crie a da próxima semana.', 'enquetes', '']);
  return `<section class="cartao-inicio">
    <p class="titulo-bloco">Resumo da semana</p>
    <div class="divide-y">${linhas.map(([i, t, aba, pend]) => `
      <button class="linha-resumo" data-acao="aba" data-id="${aba}"><span aria-hidden="true">${i}</span><span class="flex-1 text-left">${t}</span>${pend ? `<span class="menu-contador">${pend}</span>` : ''}<span aria-hidden="true" class="text-slate-400">›</span></button>`).join('')}</div>
    <div class="grade-atalhos mt-3">
      ${atalho('➕', 'Nova enquete', 'ir-nova-enquete')}
      ${aberta ? atalho('📣', 'Avisar no grupo', 'texto-whats', `data-id="${esc(aberta.id)}"`) : ''}
      ${atalho('🗂️', 'Gerar escala', 'aba', 'data-id="escala"')}
      ${publicada ? atalho('📤', 'Enviar escala', 'aba', 'data-id="escala"') : ''}
    </div></section>`;
}

function blocoAtalhos() {
  const tem = (id) => (estado.perfil.publicadorId || id !== 'minha');
  return `<section><p class="titulo-bloco px-1">Atalhos</p><div class="grade-atalhos">
    ${atalho('🗳️', 'Votar', 'aba', 'data-id="votar"')}
    ${tem('minha') ? atalho('📅', 'Minha escala', 'aba', 'data-id="minha"') : ''}
    ${atalho('📋', 'Escala completa', 'aba', 'data-id="escala"')}
    ${atalho('🔔', 'Avisos no celular', 'abrir-avisos')}
  </div></section>`;
}

async function blocoNovidades() {
  let lista = [];
  try { lista = await estado.backend.listarNovidades(); } catch (e) { console.warn('novidades', e); }
  estado.novidades = lista;
  const mostrar = novidadesVisiveis(lista, hojeISO());
  // Marca de "já vi" por pessoa (num aparelho usado por duas pessoas, cada uma tem a sua).
  const chave = `novidades-vistas-${estado.perfil.uid || ''}`;
  const vista = lerPref(chave);
  gravarPref(chave, new Date().toISOString()); // a partir de agora, estas já foram vistas
  const org = ehOrganizador();
  const itens = mostrar.map((n) => {
    const nova = !vista || String(n.criadoISO || '') > vista;
    return `<article class="novidade">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-bold">${nova ? '<span class="selo-novo">Novo</span> ' : ''}${esc(n.titulo)}</h3>
        ${org ? `<span class="flex gap-3 text-sm shrink-0"><button class="text-blue-700 underline" data-acao="editar-novidade" data-id="${esc(n.id)}">Editar</button><button class="text-red-600 underline" data-acao="excluir-novidade" data-id="${esc(n.id)}">Apagar</button></span>` : ''}
      </div>
      ${n.texto ? `<p class="text-sm text-slate-700 mt-1 whitespace-pre-line">${esc(n.texto)}</p>` : ''}
      <p class="text-xs text-slate-500 mt-1">${esc(n.autorNome || '')}${n.criadoISO ? ` · ${dataCurta(toISO(new Date(n.criadoISO)))}` : ''}${n.ate ? ` · até ${dataCurta(n.ate)}` : ''}</p>
    </article>`;
  }).join('');
  return `<section class="cartao-inicio">
    <div class="flex items-center justify-between gap-2"><p class="titulo-bloco">📢 Novidades${naoLidas(mostrar, vista) ? ` <span class="menu-contador">${naoLidas(mostrar, vista)} nova${naoLidas(mostrar, vista) > 1 ? 's' : ''}</span>` : ''}</p>
      ${org ? '<button class="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm font-semibold" data-acao="nova-novidade">+ Escrever</button>' : ''}</div>
    ${itens || '<p class="text-sm text-slate-500">Nenhuma novidade por enquanto.</p>'}
  </section>`;
}

/* ------------------------------------------------------------ tela */

export async function renderInicio() {
  const c = $('#conteudo');
  const nome = (estado.perfil.nome || '').split(' ')[0];
  c.innerHTML = `<div class="space-y-4 max-w-3xl">
    <p class="text-xl font-bold">Olá, ${esc(nome)}!</p>
    <div id="ini-agora"></div><div id="ini-proximo"></div><div id="ini-resumo"></div><div id="ini-novidades"></div>
    ${blocoAtalhos()}
  </div>`;
  const encher = async (id, fn) => { try { const el = $(id); const html = await fn(); if (el) el.innerHTML = html; } catch (e) { console.warn(id, e); } };
  await Promise.all([encher('#ini-agora', blocoAgora), encher('#ini-proximo', blocoProximo), encher('#ini-resumo', blocoResumo), encher('#ini-novidades', blocoNovidades)]);
}

/* ------------------------------------------------------------ escrever novidade (servo / administrador) */

export function abrirNovidade(id) {
  const n = id ? (estado.novidades || []).find((x) => x.id === id) : null;
  abrirModal(`<h2 class="font-bold mb-2">${n ? 'Editar novidade' : 'Nova novidade'}</h2>
    <label class="text-sm font-medium" for="nv-titulo">Título</label>
    <input id="nv-titulo" class="w-full border rounded-lg p-2 mb-2" maxlength="${LIMITES_NOVIDADE.titulo}" value="${esc(n?.titulo || '')}" placeholder="Ex.: Carrinho do Atacadão suspenso no sábado">
    <label class="text-sm font-medium" for="nv-texto">Texto (opcional)</label>
    <textarea id="nv-texto" class="w-full border rounded-lg p-2 mb-2" rows="4" maxlength="${LIMITES_NOVIDADE.texto}">${esc(n?.texto || '')}</textarea>
    <label class="text-sm font-medium" for="nv-ate">Mostrar até (opcional)</label>
    <input id="nv-ate" type="date" class="w-full border rounded-lg p-2 mb-2" value="${esc(n?.ate || '')}">
    <p class="text-xs text-slate-500 mb-2">Depois dessa data, a novidade sai do mural sozinha.</p>
    ${n ? '' : '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="nv-avisar" checked> Avisar todos no celular</label>'}
    <div class="flex justify-end gap-2 mt-4">
      <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Cancelar</button>
      <button class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="salvar-novidade" data-id="${esc(n?.id || '')}">Publicar</button>
    </div>`);
  $('#nv-titulo')?.focus();
}

export async function salvarNovidade(id) {
  const dados = { titulo: $('#nv-titulo').value.trim(), texto: $('#nv-texto').value.trim(), ate: $('#nv-ate').value || null };
  const erro = validarNovidade(dados, hojeISO());
  if (erro) return toast(erro, 'erro');
  const avisarTodos = !id && $('#nv-avisar')?.checked;
  const ok = await tentar(() => estado.backend.salvarNovidade({ ...dados, id: id || undefined, autorNome: estado.perfil.nome || '' }), 'Novidade publicada.');
  if (!ok) return;
  registrar({ area: 'novidades', acao: id ? 'Editou uma novidade' : 'Publicou uma novidade', alvo: dados.titulo });
  if (avisarTodos) avisar(estado.backend, avisoNovidade(dados));
  fecharModal();
  renderInicio();
}

export async function excluirNovidade(id) {
  const n = (estado.novidades || []).find((x) => x.id === id);
  if (!n || !confirm(`Apagar a novidade "${n.titulo}"?`)) return;
  const ok = await tentar(() => estado.backend.excluirNovidade(id), 'Novidade apagada.');
  if (ok) { registrar({ area: 'novidades', acao: 'Apagou uma novidade', alvo: n.titulo }); renderInicio(); }
}

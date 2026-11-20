import { recarregarEnquetes } from './enquetes.js';
import { registrar } from './telaAuditoria.js';
import { detalheTrocaCelula, lugarDaCelula } from './auditoria.js';
import { trocasAbertas, substitutos, substituirPessoa, mensagemSubstituto } from './trocas.js';
import { urlWhats } from './votos.js';
import { $, abrirModal, ehOrganizador, enqueteAtual, erroAmigavel, esc, estado, fecharModal, pubPorId, tentar, toast } from './nucleo.js';
import { renderAba } from './shell.js';
import { escolherEnquetePadrao, seletorEnquete } from './votar.js';
import { gerarEscala, validarEscala, contarParticipacoes, chave, nomeDia, dataCurta, celulaBloqueada, REGRAS_PADRAO, trocarCelula, exigirVersao, historicoDeParticipacoes, SEMANAS_EQUILIBRIO } from './escala.js';

/* ============================================================ escala */

/** Separador entre as pessoas da mesma dupla/trio. Para usar "e", troque por ' e '. */
import { SEPARADOR_ESCALA, textoCelula, dataLonga, planilhaDoPonto } from './relatorios.js';

export { SEPARADOR_ESCALA };

export function htmlMatriz(enquete, matriz, ponto, { editavel = false, avisos = [], meuId = null, trocas = new Set() } = {}) {
  const marcas = new Map();
  for (const a of avisos) {
    if (a.ponto === ponto && a.data && a.turno) {
      const k = `${a.data}|${a.turno}`;
      if (marcas.get(k) !== 'erro') marcas.set(k, a.nivel);
    }
  }

  const celula = (dia, turno) => {
    const motivo = celulaBloqueada(enquete, dia.data, turno, ponto);
    const cel = matriz?.[ponto]?.[dia.data]?.[turno] || (motivo ? { tipo: 'bloqueio', nota: motivo } : { tipo: 'vazio' });

    if (cel.tipo === 'bloqueio') return `<td class="celula-bloqueio">${esc(cel.nota || motivo || 'Sem carrinho')}</td>`;

    const marca = marcas.get(`${dia.data}|${turno}`);
    const classes = [
      editavel ? 'celula-editavel' : '',
      marca === 'erro' ? 'celula-erro' : marca === 'aviso' ? 'celula-aviso' : '',
      cel.tipo === 'equipe' && meuId && cel.pessoas.some((p) => p.id === meuId) ? 'celula-minha font-semibold' : '',
      cel.tipo === 'vazio' ? 'celula-vazia' : '',
      trocas.has(`${dia.data}|${turno}`) ? 'celula-troca' : '',
    ].join(' ');
    const dados = editavel ? `data-acao="editar-celula" data-ponto="${esc(ponto)}" data-data="${esc(dia.data)}" data-turno="${esc(turno)}" tabindex="0"` : '';
    const conteudo = cel.tipo === 'equipe'
      ? cel.pessoas.map((p) => `<span class="nome-escala">${esc(p.nome)}</span>`).join(`<span class="sep-escala" aria-hidden="true">${SEPARADOR_ESCALA}</span>`)
      : 'Pregação';
    return `<td class="${classes}" ${dados}>${conteudo}</td>`;
  };

  return `<div class="overflow-x-auto"><table class="tabela-escala">
    <thead><tr><th>Horário</th>${enquete.dias.map((d) => `<th>${nomeDia(d.data)}<br><span class="font-normal">${dataCurta(d.data)}</span></th>`).join('')}</tr></thead>
    <tbody>${enquete.turnos.map((turno) => `<tr><td class="horario">${esc(turno)}</td>${enquete.dias.map((d) => celula(d, turno)).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export async function renderEscala() {
  const c = $('#conteudo');
  const org = ehOrganizador();
  // Enquetes arquivadas saem da lista (a não ser a que já está aberta na tela).
  const lista = (org ? estado.enquetes : estado.enquetes.filter((e) => e.status === 'publicada')).filter((e) => !e.arquivada || e.id === estado.enqueteId);

  if (!lista.length) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6"><h2 class="font-bold mb-1">Nenhuma escala disponível</h2>
      <p class="text-slate-600">${org ? 'Crie uma enquete na aba Enquetes.' : 'Quando a escala for publicada, ela aparece aqui.'}</p></div>`;
    return;
  }

  escolherEnquetePadrao(lista);
  const enquete = enqueteAtual();
  estado.escala = await estado.backend.getEscala(enquete.id);
  estado.votos = org ? await estado.backend.listarVotos(enquete.id) : [];
  estado.trocas = [];
  if (org) { try { estado.trocas = await estado.backend.listarTrocas(enquete.id); } catch (e) { console.error(e); } }
  if (!estado.ponto || !enquete.pontos.includes(estado.ponto)) estado.ponto = enquete.pontos[0];

  const publicada = enquete.status === 'publicada' && estado.escala?.publicada;

  c.innerHTML = `
    ${seletorEnquete(lista, 'escolher-enquete')}
    <div class="flex flex-wrap items-center gap-2 mb-4">
      ${org ? `
        <button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold text-sm" data-acao="gerar-escala">Gerar escala automática</button>
        ${publicada
          ? '<button class="bg-amber-100 text-amber-900 rounded-lg px-4 py-2 font-semibold text-sm" data-acao="despublicar-escala">Retirar da publicação</button>'
          : '<button class="bg-green-600 text-white rounded-lg px-4 py-2 font-semibold text-sm" data-acao="publicar-escala">Publicar para todos</button>'}
        <span class="text-sm ${publicada ? 'text-green-700' : 'text-slate-500'}">${publicada ? 'Publicada: todos podem ver.' : 'Ainda não publicada: só os organizadores veem.'}</span>` : ''}
      <span class="flex-1"></span>
      <button class="bg-slate-100 rounded-lg px-3 py-2 text-sm" data-acao="imprimir">Imprimir este ponto</button>
      <button class="bg-slate-100 rounded-lg px-3 py-2 text-sm" data-acao="imprimir-todos">Imprimir todos</button>
      <button class="bg-slate-100 rounded-lg px-3 py-2 text-sm" data-acao="exportar-excel">Exportar Excel</button>
    </div>
    <div id="escala-corpo"></div>`;

  desenharEscala();
}

export function desenharEscala() {
  const enquete = enqueteAtual();
  const corpo = $('#escala-corpo');
  if (!enquete || !corpo) return;

  const org = ehOrganizador();
  const escala = estado.escala;

  if (!escala?.matriz) {
    corpo.innerHTML = `<div class="bg-white rounded-xl border p-6 text-slate-600">${org
      ? 'Ainda não há escala para esta enquete. Clique em "Gerar escala automática".'
      : 'A escala ainda não foi publicada.'}</div>`;
    return;
  }

  const avisos = org ? validarEscala({ enquete, publicadores: estado.pubs, votos: estado.votos, matriz: escala.matriz }) : [];
  const meuId = estado.perfil.publicadorId || null;

  corpo.innerHTML = `
    <div class="flex flex-wrap gap-2 mb-3">
      ${enquete.pontos.map((p) => `<button class="px-4 py-2 rounded-lg text-sm font-semibold ${p === estado.ponto ? 'bg-blue-600 text-white' : 'bg-white border'}" data-acao="escolher-ponto" data-id="${esc(p)}">${esc(p)}</button>`).join('')}
    </div>
    ${org ? painelTrocas(enquete, escala.matriz) : ''}
    <div class="bg-white rounded-xl border p-3">${htmlMatriz(enquete, escala.matriz, estado.ponto, { editavel: org, avisos, meuId, trocas: marcasDeTroca(estado.ponto) })}</div>
    ${org ? `<p class="text-xs text-slate-500 mt-2">Clique em um horário para trocar as pessoas. Contorno vermelho = regra quebrada; amarelo = atenção.</p>
      ${escala.ajustadoPor && quando(escala.ajustadoEm) ? `<p class="text-xs text-slate-500">Última alteração: ${esc(escala.ajustadoPor)}, ${quando(escala.ajustadoEm)}.</p>` : ''}
      ${painelAvisos(avisos)}${painelParticipacoes(enquete, escala.matriz)}
      <details class="mt-4 bg-white rounded-xl border p-4" data-historico="${esc(enquete.id)}"><summary class="font-bold cursor-pointer">Histórico desta escala</summary>
        <div class="mt-3" id="historico-escala"></div></details>` : (meuId ? '<p class="text-xs text-slate-500 mt-2">Os horários em que você está escalado aparecem destacados em azul.</p>' : '')}`;
}

/* ------------------------------------------------------------ pedidos de troca */

/** Horários do ponto com pedido de troca aberto ("data|turno"), para marcar na tabela. */
function marcasDeTroca(ponto) {
  return new Set(trocasAbertas(estado.trocas).filter((t) => t.ponto === ponto).map((t) => `${t.data}|${t.turno}`));
}

export function painelTrocas(enquete, matriz) {
  const abertas = trocasAbertas(estado.trocas).sort((a, b) => a.data.localeCompare(b.data) || enquete.turnos.indexOf(a.turno) - enquete.turnos.indexOf(b.turno));
  if (!abertas.length) return '';
  return `<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
    <h3 class="font-bold text-amber-900 mb-1">Pedidos de troca (${abertas.length})</h3>
    <p class="text-sm text-amber-900 mb-3">Toque num nome para colocá-lo no lugar de quem pediu. Primeiro aparecem as reservas ("só se precisar"), depois quem marcou o horário e participou menos.</p>
    <ul class="space-y-3">${abertas.map((t) => {
      const subs = substitutos({ enquete, matriz, votos: estado.votos, publicadores: estado.pubs, troca: t });
      return `<li class="bg-white rounded-lg border p-3">
        <p class="text-sm"><strong>${esc(t.nome)}</strong> pediu troca · ${esc(lugarDaCelula(t.ponto, t.data, t.turno))}${t.motivo ? ` · <em>${esc(t.motivo)}</em>` : ''}</p>
        <div class="flex flex-wrap gap-2 mt-2">
          ${subs.map((s) => `<button class="text-sm rounded-full px-3 py-1 ${s.tipo === 'reserva' ? 'bg-amber-100 text-amber-900' : 'bg-green-50 text-green-800'}" data-acao="resolver-troca" data-id="${esc(t.id)}" data-sub="${esc(s.id)}">
            ${esc(s.nome)} · ${s.tipo === 'reserva' ? 'reserva' : 'marcou'} · ${s.carga}x${s.acimaDoLimite ? ' · no limite' : ''}${s.requerTrio ? ' · trio' : ''}</button>`).join('')
            || '<span class="text-sm text-slate-600">Ninguém marcou este horário como disponível ou reserva. Toque no horário na tabela para escolher outra pessoa.</span>'}
          <button class="text-sm underline text-slate-600 ml-auto" data-acao="dispensar-troca" data-id="${esc(t.id)}">Dispensar pedido</button>
        </div>
      </li>`;
    }).join('')}</ul>
  </div>`;
}

export async function resolverTroca(trocaId, subId) {
  const e = enqueteAtual();
  const t = estado.trocas.find((x) => x.id === trocaId);
  const sub = pubPorId(subId);
  if (!t || !sub) return;
  const antes = estado.escala.matriz?.[t.ponto]?.[t.data]?.[t.turno];
  if (antes?.tipo !== 'equipe' || !antes.pessoas.some((p) => p.id === t.publicadorId)) {
    toast(`${t.nome} já não está nesse horário. O pedido foi encerrado.`, 'erro');
    await estado.backend.salvarTroca(e.id, { ...t, status: 'resolvida', resolvidoPor: estado.perfil.nome, resolvidoEm: new Date().toISOString() });
    estado.trocas = await estado.backend.listarTrocas(e.id);
    return desenharEscala();
  }
  const depois = substituirPessoa(antes, t.publicadorId, sub);
  const ok = await gravarComVersao(
    (atual) => ({ ...trocarCelula(atual, { ponto: t.ponto, data: t.data, turno: t.turno, antes, depois, matrizLocal: estado.escala.matriz }), ajustadoPor: estado.perfil.nome }),
    `${sub.nome} entrou no lugar de ${t.nome}.`
  );
  if (!ok) return;
  await tentar(() => estado.backend.salvarTroca(e.id, { ...t, status: 'resolvida', substitutoId: sub.id, substitutoNome: sub.nome, resolvidoPor: estado.perfil.nome, resolvidoEm: new Date().toISOString() }));
  registrar({ area: 'trocas', acao: 'Resolveu um pedido de troca', alvo: e.titulo, enqueteId: e.id, detalhe: `${detalheTrocaCelula(t.ponto, t.data, t.turno, antes, depois)} (pedido de ${t.nome})` });
  estado.trocas = await estado.backend.listarTrocas(e.id);
  desenharEscala();
  if (confirm(`Avisar ${sub.nome} pelo WhatsApp agora?`)) {
    window.open(urlWhats(sub, mensagemSubstituto(sub, t, lugarDaCelula(t.ponto, t.data, t.turno))), '_blank', 'noopener');
  }
}

export async function dispensarTroca(trocaId) {
  const e = enqueteAtual();
  const t = estado.trocas.find((x) => x.id === trocaId);
  if (!t || !confirm(`Dispensar o pedido de troca de ${t.nome}? A escala não muda.`)) return;
  const ok = await tentar(() => estado.backend.salvarTroca(e.id, { ...t, status: 'dispensada', resolvidoPor: estado.perfil.nome, resolvidoEm: new Date().toISOString() }), 'Pedido dispensado.');
  if (!ok) return;
  registrar({ area: 'trocas', acao: 'Dispensou um pedido de troca', alvo: e.titulo, enqueteId: e.id, detalhe: `${t.nome} · ${lugarDaCelula(t.ponto, t.data, t.turno)}` });
  estado.trocas = await estado.backend.listarTrocas(e.id);
  desenharEscala();
}

export function painelAvisos(avisos) {
  if (!avisos.length) {
    return '<div class="mt-4 bg-green-50 text-green-800 rounded-lg p-3 text-sm">Nenhum aviso: a escala respeita as regras.</div>';
  }
  const ordenados = [...avisos].sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'erro' ? -1 : 1));
  return `<div class="mt-4 bg-white rounded-xl border p-4"><h3 class="font-bold mb-2">Avisos (${avisos.length})</h3>
    <ul class="text-sm space-y-1">${ordenados.map((a) => `<li class="${a.nivel === 'erro' ? 'text-red-700' : 'text-amber-800'}">
      ${a.nivel === 'erro' ? '●' : '○'} ${a.ponto ? `${esc(a.ponto)} · ` : ''}${a.data ? `${nomeDia(a.data)} ${dataCurta(a.data)} · ` : ''}${esc(a.turno || '')}${a.turno || a.data || a.ponto ? ': ' : ''}${esc(a.msg)}</li>`).join('')}</ul></div>`;
}

export function painelParticipacoes(enquete, matriz) {
  const regras = { ...REGRAS_PADRAO, ...(enquete.regras || {}) };
  const contagem = contarParticipacoes(matriz);
  const ativos = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  return `<div class="mt-4 bg-white rounded-xl border p-4"><h3 class="font-bold mb-2">Participações</h3>
    <div class="flex flex-wrap gap-2 text-sm">${ativos.map((p) => {
      const total = contagem.get(p.id)?.total || 0;
      const limite = p.genero === 'F' ? regras.maxIrmas : regras.maxIrmaos;
      const passou = Boolean(limite) && total > limite;
      return `<span class="px-3 py-1 rounded-full ${passou ? 'bg-red-100 text-red-800' : total === 0 ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-800'}">
        ${esc(p.nome)}: ${total}${limite ? `/${limite}` : ''}</span>`;
    }).join('')}</div></div>`;
}

export function editarCelula(ponto, data, turno) {
  const enquete = enqueteAtual();
  const atual = estado.escala.matriz?.[ponto]?.[data]?.[turno];
  estado.celulaAntes = atual ? structuredClone(atual) : null; // para saber se alguém mudou este horário enquanto o modal estava aberto
  const selecionados = new Set(atual?.tipo === 'equipe' ? atual.pessoas.map((p) => p.id) : []);
  const k = chave(data, turno);
  const voluntarios = new Set(estado.votos.filter((v) => (v.disponibilidade?.[ponto] || []).includes(k)).map((v) => v.publicadorId));
  const reservas = new Set(estado.votos.filter((v) => (v.reserva?.[ponto] || []).includes(k)).map((v) => v.publicadorId));

  // Ordem: quem votou neste horário, depois quem é reserva, depois os outros.
  const peso = (id) => (voluntarios.has(id) ? 0 : reservas.has(id) ? 1 : 2);
  const lista = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => peso(a.id) - peso(b.id) || a.nome.localeCompare(b.nome, 'pt'));

  abrirModal(`
    <div class="flex items-start justify-between mb-2">
      <div><h2 class="font-bold">${esc(ponto)}</h2><p class="text-sm text-slate-500">${nomeDia(data)} ${dataCurta(data)} · ${esc(turno)}</p></div>
      <button class="text-slate-500 text-xl leading-none" data-acao="fechar-modal" aria-label="Fechar">×</button>
    </div>
    <p id="resumo-celula" class="text-sm bg-slate-50 rounded-lg p-2 mb-2"></p>
    <div class="max-h-80 overflow-y-auto border rounded-lg divide-y" id="lista-celula" data-ponto="${esc(ponto)}" data-data="${esc(data)}" data-turno="${esc(turno)}">
      ${lista.map((p) => `<label class="flex items-center gap-3 p-2 text-sm">
        <input type="checkbox" name="celula" value="${esc(p.id)}" ${selecionados.has(p.id) ? 'checked' : ''}>
        <span class="flex-1">${esc(p.nome)} <span class="text-xs text-slate-400">${p.genero === 'F' ? 'irmã' : 'irmão'}</span></span>
        ${voluntarios.has(p.id) ? '<span class="text-xs bg-green-100 text-green-800 rounded-full px-2">votou neste horário</span>' : ''}
        ${reservas.has(p.id) ? '<span class="text-xs bg-amber-100 text-amber-800 rounded-full px-2">reserva neste horário</span>' : ''}
        ${p.requerTrio ? '<span class="text-xs bg-amber-100 text-amber-800 rounded-full px-2">trio</span>' : ''}
        ${p.conjuge ? `<span class="text-xs bg-slate-100 text-slate-600 rounded-full px-2">par: ${esc(pubPorId(p.conjuge)?.nome || '')}</span>` : ''}
        ${p.pontosVoto?.length ? `<span class="text-xs bg-slate-100 text-slate-600 rounded-full px-2">só em ${esc(p.pontosVoto.join(', '))}</span>` : ''}
      </label>`).join('')}
    </div>
    <div class="flex flex-wrap justify-between gap-2 mt-4">
      <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="limpar-celula">Deixar sem equipe</button>
      <div class="flex gap-2">
        <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Cancelar</button>
        <button class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="salvar-celula">Salvar</button>
      </div>
    </div>`);
  atualizarResumoCelula();
}

export function atualizarResumoCelula() {
  const resumo = $('#resumo-celula');
  if (!resumo) return;
  const marcados = [...document.querySelectorAll('#modal input[name=celula]:checked')].map((i) => pubPorId(i.value)).filter(Boolean);
  const precisaTrio = marcados.some((p) => p.requerTrio);
  const esperado = precisaTrio ? 3 : 2;
  const ok = marcados.length === esperado;
  resumo.className = `text-sm rounded-lg p-2 mb-2 ${ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`;
  resumo.textContent = `${marcados.length} pessoa(s) marcada(s). Equipe esperada: ${esperado}${precisaTrio ? ' (alguém precisa de trio)' : ' (dupla)'}.`;
}

export async function gravarCelula(pessoas) {
  const lista = $('#lista-celula');
  const { ponto, data, turno } = lista.dataset;
  const depois = pessoas.length ? { tipo: 'equipe', pessoas } : { tipo: 'vazio' };
  const antes = estado.celulaAntes;
  const ok = await gravarComVersao(
    (atual) => ({ ...trocarCelula(atual, { ponto, data, turno, antes, depois, matrizLocal: estado.escala.matriz }), ajustadoPor: estado.perfil.nome }),
    'Escala atualizada.'
  );
  if (ok) {
    registrar({ area: 'escala', acao: 'Trocou pessoas', alvo: enqueteAtual().titulo, enqueteId: enqueteAtual().id, detalhe: detalheTrocaCelula(ponto, data, turno, antes, depois) });
    fecharModal(); desenharEscala();
  }
}

/** Hora curta de uma data ISO: "18/11 às 14:32". */
function quando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Grava a escala pelo backend.atualizarEscala (que confere a versão no banco).
 * Se outro organizador mudou no meio do caminho, mostra a versão nova e avisa, sem apagar nada.
 */
export async function gravarComVersao(alterar, mensagem) {
  const e = enqueteAtual();
  try {
    estado.escala = await estado.backend.atualizarEscala(e.id, alterar);
    if (mensagem) toast(mensagem);
    return true;
  } catch (err) {
    if (err?.code !== 'app/conflito-escala') {
      console.error(err);
      toast(erroAmigavel(err), 'erro');
      return false;
    }
    const quem = err.atual?.ajustadoPor || 'Outro organizador';
    estado.escala = err.atual;
    fecharModal();
    desenharEscala();
    toast(`${quem} mudou ${err.tipo === 'celula' ? 'este horário' : 'a escala'} enquanto você editava. A tela já mostra a versão mais nova: confira e faça de novo.`, 'erro');
    return false;
  }
}

/**
 * Enquetes anteriores a esta (pela data de início), das mais novas para as mais velhas.
 * Rascunhos não contam.
 */
export function enquetesAnteriores(e, enquetes = estado.enquetes, quantas = SEMANAS_EQUILIBRIO) {
  return enquetes
    .filter((x) => x.id !== e.id && x.status !== 'rascunho' && (x.inicio || '') < (e.inicio || ''))
    .sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''))
    .slice(0, quantas);
}

/** Participações nas últimas escalas, para o equilíbrio entre semanas. */
async function historicoAnterior(e) {
  if (e.regras?.equilibrarSemanas === false) return new Map();
  try {
    const escalas = await Promise.all(enquetesAnteriores(e).map((x) => estado.backend.getEscala(x.id)));
    return historicoDeParticipacoes(escalas.map((item) => item?.matriz));
  } catch (err) {
    console.error(err); // sem histórico, a escala sai só com o equilíbrio da semana
    return new Map();
  }
}

export async function gerarEscalaAcao() {
  const e = enqueteAtual();
  const temEquipes = estado.escala?.matriz && JSON.stringify(estado.escala.matriz).includes('"equipe"');
  if (temEquipes && !confirm('Gerar de novo apaga os ajustes manuais desta escala. Continuar?')) return;
  if (!estado.votos.length) toast('Ainda não há votos nesta enquete: a escala sairá vazia.', 'erro');

  const historico = await historicoAnterior(e);
  const { matriz } = gerarEscala({ enquete: e, publicadores: estado.pubs, votos: estado.votos, historico });
  const versaoNaTela = estado.escala?.versao;
  const ok = await gravarComVersao((atual) => {
    exigirVersao(atual, versaoNaTela);
    return { ...(atual || {}), matriz, publicada: Boolean(atual?.publicada), geradoEm: new Date().toISOString(), ajustadoPor: estado.perfil.nome };
  }, 'Escala gerada. Confira os avisos e ajuste se precisar.');
  if (ok) {
    registrar({ area: 'escala', acao: versaoNaTela ? 'Gerou a escala de novo' : 'Gerou a escala', alvo: e.titulo, enqueteId: e.id });
    desenharEscala();
  }
}

export async function publicarEscala(publicar) {
  const e = enqueteAtual();
  const versaoNaTela = estado.escala?.versao;
  const ok = await gravarComVersao((atual) => {
    exigirVersao(atual, versaoNaTela);
    return { ...(atual || {}), matriz: atual?.matriz || estado.escala.matriz, publicada: publicar, ajustadoPor: estado.perfil.nome };
  });
  if (!ok) return;
  registrar({ area: 'escala', acao: publicar ? 'Publicou a escala' : 'Retirou a escala da publicação', alvo: e.titulo, enqueteId: e.id });
  const okEnquete = await tentar(
    () => estado.backend.salvarEnquete({ ...e, status: publicar ? 'publicada' : 'fechada' }),
    publicar ? 'Escala publicada para todos.' : 'Escala retirada da publicação.'
  );
  if (okEnquete) { await recarregarEnquetes(); renderAba(); }
}

/* ------------------------------------------------------------ impressão */

/** Uma página A4 deitada por ponto: faixa verde com o título, tabela centralizada e rodapé. */
export function htmlImpressao(enquete, matriz, ponto, geradoEm = new Date()) {
  const celula = (data, turno) => {
    const { tipo, texto } = textoCelula(enquete, matriz, ponto, data, turno);
    if (tipo === 'equipe') return `<td>${texto.split(SEPARADOR_ESCALA).map((n) => `<span class="imp-nome">${esc(n)}</span>`).join('<span class="imp-sep"> / </span>')}</td>`;
    return `<td class="imp-${tipo}">${esc(texto)}</td>`;
  };
  const quando = dataLonga(geradoEm);
  return `<div class="pagina-impressao">
    <div class="imp-topo">
      <div><p class="imp-rotulo">ESCALA DE CARRINHOS · TESTEMUNHO PÚBLICO</p><h2 class="imp-ponto">${esc(ponto)}</h2>
        ${/^semana de /i.test(enquete.titulo || '') ? '' : `<p class="imp-titulo">${esc(enquete.titulo)}</p>`}</div>
      <p class="imp-periodo">PERÍODO<br><strong>${dataCurta(enquete.inicio)} a ${dataCurta(enquete.fim)}</strong></p>
    </div>
    <table class="imp-tabela">
      <thead><tr><th>Horário</th>${enquete.dias.map((d) => `<th>${nomeDia(d.data)}<br><span>${dataCurta(d.data)}</span></th>`).join('')}</tr></thead>
      <tbody>${enquete.turnos.map((t) => `<tr><th scope="row">${esc(t)}</th>${enquete.dias.map((d) => celula(d.data, t)).join('')}</tr>`).join('')}</tbody>
    </table>
    <p class="imp-rodape"><span><span class="imp-legenda imp-legenda-vazio"></span> Pregação: horário sem carrinho escalado &nbsp; <span class="imp-legenda imp-legenda-bloqueio"></span> Sem carrinho (reunião, evento)</span><span>Gerado em ${quando} · TPMobile</span></p>
  </div>`;
}

export function imprimir(todos) {
  const e = enqueteAtual();
  if (!estado.escala?.matriz) return toast('Gere a escala primeiro.', 'erro');
  const pontos = todos ? e.pontos : [estado.ponto];
  $('#area-impressao').innerHTML = pontos.map((p) => htmlImpressao(e, estado.escala.matriz, p)).join('');
  window.print();
}

export function exportarExcel() {
  const e = enqueteAtual();
  if (!estado.escala?.matriz) return toast('Gere a escala primeiro.', 'erro');
  if (typeof XLSX === 'undefined') return toast('A biblioteca do Excel não carregou. Verifique a internet.', 'erro');

  // Uma aba por ponto. As cores só aparecem quando a biblioteca xlsx-js-style carregou
  // (ela substitui a XLSX comum); senão a planilha sai igual, só sem as cores.
  const wb = XLSX.utils.book_new();
  for (const ponto of e.pontos) {
    const aba = planilhaDoPonto(e, estado.escala.matriz, ponto);
    const ws = XLSX.utils.aoa_to_sheet(aba.linhas);
    aba.estilos.forEach((estilosDaLinha, r) => estilosDaLinha.forEach((estilo, c) => {
      const endereco = XLSX.utils.encode_cell({ r, c });
      if (!estilo) return;
      if (!ws[endereco]) ws[endereco] = { t: 's', v: '' };
      ws[endereco].s = estilo;
    }));
    ws['!merges'] = aba.mesclar;
    ws['!cols'] = aba.larguras;
    ws['!rows'] = aba.alturas;
    XLSX.utils.book_append_sheet(wb, ws, aba.nome);
  }
  XLSX.writeFile(wb, `Escala - ${e.titulo.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`);
}

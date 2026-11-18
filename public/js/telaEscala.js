import { recarregarEnquetes } from './enquetes.js';
import { $, abrirModal, ehOrganizador, enqueteAtual, erroAmigavel, esc, estado, fecharModal, pubPorId, tentar, toast } from './nucleo.js';
import { renderAba } from './shell.js';
import { escolherEnquetePadrao, seletorEnquete } from './votar.js';
import { gerarEscala, validarEscala, contarParticipacoes, chave, nomeDia, dataCurta, celulaBloqueada, REGRAS_PADRAO, trocarCelula, exigirVersao, historicoDeParticipacoes, SEMANAS_EQUILIBRIO } from './escala.js';

/* ============================================================ escala */

/** Separador entre as pessoas da mesma dupla/trio. Para usar "e", troque por ' e '. */
export const SEPARADOR_ESCALA = ' / ';

export function htmlMatriz(enquete, matriz, ponto, { editavel = false, avisos = [], meuId = null } = {}) {
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
  const lista = org ? estado.enquetes : estado.enquetes.filter((e) => e.status === 'publicada');

  if (!lista.length) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6"><h2 class="font-bold mb-1">Nenhuma escala disponível</h2>
      <p class="text-slate-600">${org ? 'Crie uma enquete na aba Enquetes.' : 'Quando a escala for publicada, ela aparece aqui.'}</p></div>`;
    return;
  }

  escolherEnquetePadrao(lista);
  const enquete = enqueteAtual();
  estado.escala = await estado.backend.getEscala(enquete.id);
  estado.votos = org ? await estado.backend.listarVotos(enquete.id) : [];
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
    <div class="bg-white rounded-xl border p-3">${htmlMatriz(enquete, escala.matriz, estado.ponto, { editavel: org, avisos, meuId })}</div>
    ${org ? `<p class="text-xs text-slate-500 mt-2">Clique em um horário para trocar as pessoas. Contorno vermelho = regra quebrada; amarelo = atenção.</p>
      ${escala.ajustadoPor && quando(escala.ajustadoEm) ? `<p class="text-xs text-slate-500">Última alteração: ${esc(escala.ajustadoPor)}, ${quando(escala.ajustadoEm)}.</p>` : ''}
      ${painelAvisos(avisos)}${painelParticipacoes(enquete, escala.matriz)}` : (meuId ? '<p class="text-xs text-slate-500 mt-2">Os horários em que você está escalado aparecem destacados em azul.</p>' : '')}`;
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

  const lista = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => {
    const va = voluntarios.has(a.id) ? 0 : 1;
    const vb = voluntarios.has(b.id) ? 0 : 1;
    return va - vb || a.nome.localeCompare(b.nome, 'pt');
  });

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
  if (ok) { fecharModal(); desenharEscala(); }
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
  if (ok) desenharEscala();
}

export async function publicarEscala(publicar) {
  const e = enqueteAtual();
  const versaoNaTela = estado.escala?.versao;
  const ok = await gravarComVersao((atual) => {
    exigirVersao(atual, versaoNaTela);
    return { ...(atual || {}), matriz: atual?.matriz || estado.escala.matriz, publicada: publicar, ajustadoPor: estado.perfil.nome };
  });
  if (!ok) return;
  const okEnquete = await tentar(
    () => estado.backend.salvarEnquete({ ...e, status: publicar ? 'publicada' : 'fechada' }),
    publicar ? 'Escala publicada para todos.' : 'Escala retirada da publicação.'
  );
  if (okEnquete) { await recarregarEnquetes(); renderAba(); }
}

export function imprimir(todos) {
  const e = enqueteAtual();
  if (!estado.escala?.matriz) return toast('Gere a escala primeiro.', 'erro');
  const pontos = todos ? e.pontos : [estado.ponto];
  $('#area-impressao').innerHTML = pontos.map((p) => `
    <div class="pagina-impressao">
      <h2 style="font-size:18px;font-weight:700">${esc(e.titulo)} — ${esc(p)}</h2>
      <p style="margin-bottom:8px;font-size:12px">${dataCurta(e.inicio)} a ${dataCurta(e.fim)}</p>
      ${htmlMatriz(e, estado.escala.matriz, p)}
    </div>`).join('');
  window.print();
}

export function exportarExcel() {
  const e = enqueteAtual();
  if (!estado.escala?.matriz) return toast('Gere a escala primeiro.', 'erro');
  if (typeof XLSX === 'undefined') return toast('A biblioteca do Excel não carregou. Verifique a internet.', 'erro');

  const wb = XLSX.utils.book_new();
  for (const ponto of e.pontos) {
    const linhas = [[`${e.titulo} — ${ponto}`], [], ['Horário', ...e.dias.map((d) => `${nomeDia(d.data)} ${dataCurta(d.data)}`)]];
    for (const turno of e.turnos) {
      linhas.push([turno, ...e.dias.map((d) => {
        const cel = estado.escala.matriz?.[ponto]?.[d.data]?.[turno];
        if (!cel) return '';
        if (cel.tipo === 'equipe') return cel.pessoas.map((p) => p.nome).join(SEPARADOR_ESCALA);
        if (cel.tipo === 'bloqueio') return cel.nota || 'Sem carrinho';
        return 'Pregação';
      })]);
    }
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws['!cols'] = [{ wch: 16 }, ...e.dias.map(() => ({ wch: 24 }))];
    XLSX.utils.book_append_sheet(wb, ws, ponto.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  }
  XLSX.writeFile(wb, `Escala - ${e.titulo.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`);
}

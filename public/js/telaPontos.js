import { $, esc, estado, erroAmigavel, toast } from './nucleo.js';
import { registrar } from './telaAuditoria.js';
import {
  itensDaConfig, validarPontos, planoDeMudancas, pontosVotoAtualizados,
  costumeAtualizado, rascunhoAtualizado, afetadosPelaRemocao,
} from './pontos.js';
import { recarregarEnquetes } from './enquetes.js';

/* ============================================================ configuração de pontos */
// A tela edita uma cópia da lista (estado.pontosEd). Nada vai ao banco até "Salvar alterações".

function editor() {
  if (!estado.pontosEd) estado.pontosEd = itensDaConfig(estado.config);
  return estado.pontosEd;
}

export function renderPontos() {
  const itens = editor();
  const original = JSON.stringify(itensDaConfig(estado.config));
  const mudou = JSON.stringify(itens) !== original;

  $('#conteudo').innerHTML = `
    <h2 class="text-lg font-bold mb-1">Pontos</h2>
    <p class="text-sm text-slate-600 mb-4">Os pontos <strong>Em uso</strong> já vêm marcados em cada enquete nova. Desmarque um ponto que vai ficar parado por um tempo, sem precisar apagá-lo. A ordem aqui é a ordem das enquetes e da escala.</p>
    <div class="bg-white rounded-xl border divide-y">
      ${itens.map((item, i) => `
        <div class="p-3 flex flex-wrap items-center gap-3">
          <input class="border rounded-lg p-2 flex-1 min-w-[12rem]" value="${esc(item.nome)}" data-ponto-nome data-i="${i}" aria-label="Nome do ponto ${i + 1}" maxlength="60">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" ${item.ativo ? 'checked' : ''} data-ponto-ativo data-i="${i}"> Em uso</label>
          <div class="flex gap-2">
            <button type="button" class="bg-slate-100 rounded-lg px-3 py-1" data-acao="ponto-subir" data-id="${i}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="bg-slate-100 rounded-lg px-3 py-1" data-acao="ponto-descer" data-id="${i}" aria-label="Descer" ${i === itens.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
          <button type="button" class="text-red-600 underline text-sm" data-acao="ponto-remover" data-id="${i}">Remover</button>
          ${item.original && item.original !== item.nome.trim() ? `<p class="w-full text-xs text-slate-500">Antes: ${esc(item.original)}</p>` : ''}
          ${!item.original ? '<p class="w-full text-xs text-slate-500">Ponto novo</p>' : ''}
        </div>`).join('') || '<p class="p-4 text-slate-500">Nenhum ponto. Adicione o primeiro abaixo.</p>'}
    </div>
    <div class="flex gap-2 mt-3">
      <input id="ponto-novo" class="border rounded-lg p-2 flex-1" placeholder="Nome do novo ponto" aria-label="Nome do novo ponto" maxlength="60">
      <button type="button" class="bg-slate-100 rounded-lg px-4 font-semibold" data-acao="ponto-adicionar">Adicionar</button>
    </div>
    <div class="flex flex-wrap gap-2 mt-4">
      <button class="bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold" data-acao="pontos-salvar" ${mudou ? '' : 'disabled'}>Salvar alterações</button>
      ${mudou ? '<button class="bg-slate-200 rounded-lg px-5 py-2 font-semibold" data-acao="pontos-desfazer">Desfazer</button>' : ''}
    </div>
    <p class="text-xs text-slate-500 mt-3">Trocar o nome de um ponto atualiza o cadastro dos publicadores ("Onde vota"), os horários de costume e as enquetes em rascunho. Enquetes já abertas ou passadas continuam com o nome antigo, porque os votos e a escala delas usam esse nome.</p>`;
}

/* -------------------------------------------------------------- ações da tela */

export function nomeDoPontoMudou(el) {
  editor()[Number(el.dataset.i)].nome = el.value;
}

export function pontoAtivoMudou(el) {
  editor()[Number(el.dataset.i)].ativo = el.checked;
  renderPontos();
}

export function adicionarPonto() {
  const nome = $('#ponto-novo').value.trim();
  if (!nome) return toast('Escreva o nome do novo ponto.', 'erro');
  editor().push({ nome, original: null, ativo: true });
  renderPontos();
  $('#ponto-novo')?.focus();
}

export function moverPonto(i, passo) {
  const itens = editor();
  const j = i + passo;
  if (j < 0 || j >= itens.length) return;
  [itens[i], itens[j]] = [itens[j], itens[i]];
  renderPontos();
}

export function removerPonto(i) {
  editor().splice(i, 1);
  renderPontos();
}

export function desfazerPontos() {
  estado.pontosEd = null;
  renderPontos();
}

/** Texto da confirmação: só aparece quando a mudança mexe em outros cadastros. */
function textoConfirmacao(plano) {
  const linhas = [];
  for (const [antigo, novo] of plano.renomeados) linhas.push(`• "${antigo}" passa a se chamar "${novo}".`);
  for (const p of plano.removidos) linhas.push(`• "${p}" sai da lista.`);
  const afetados = afetadosPelaRemocao(estado.pubs, plano);
  if (afetados.length) {
    linhas.push('', `${afetados.length} publicador(es) votavam só nos pontos removidos e passarão a ver todos os pontos: ${afetados.map((p) => p.nome).join(', ')}.`);
  }
  return linhas.length ? `${linhas.join('\n')}\n\nContinuar?` : null;
}

export async function salvarPontos() {
  const itens = editor();
  const erro = validarPontos(itens);
  if (erro) return toast(erro, 'erro');

  const plano = planoDeMudancas(estado.config.pontos || [], itens);
  const pergunta = textoConfirmacao(plano);
  if (pergunta && !confirm(pergunta)) return;

  try {
    // 1. A lista de pontos.
    const config = { ...estado.config, ...plano.config };
    await estado.backend.salvarConfig(config);
    estado.config = config;

    // 2. O que guarda o nome do ponto: "Onde vota", horários de costume e rascunhos.
    let atualizados = 0;
    if (plano.renomeados.length || plano.removidos.length) {
      for (const p of estado.pubs) {
        const lista = pontosVotoAtualizados(p.pontosVoto, plano);
        if (lista) { await estado.backend.salvarPublicador({ ...p, pontosVoto: lista }); atualizados += 1; }
        try {
          const padrao = (await estado.backend.getPadrao(p.id))?.padrao;
          const novo = costumeAtualizado(padrao, plano);
          if (novo) await estado.backend.salvarPadrao(p.id, novo);
        } catch (e) {
          console.error(e); // um costume com problema não impede o resto
        }
      }
      for (const e of estado.enquetes) {
        const nova = rascunhoAtualizado(e, plano);
        if (nova) await estado.backend.salvarEnquete(nova);
      }
      estado.pubs = await estado.backend.listarPublicadores();
      await recarregarEnquetes();
    }

    const resumo = [
      ...plano.renomeados.map(([a, b]) => `"${a}" → "${b}"`),
      ...plano.removidos.map((p) => `removeu "${p}"`),
      `em uso: ${plano.config.pontos.filter((p) => !plano.config.pontosPausados.includes(p)).join(', ')}`,
    ];
    registrar({ area: 'pontos', acao: 'Alterou os pontos', detalhe: resumo.join(' · ') });
    estado.pontosEd = null;
    renderPontos();
    toast(atualizados ? `Pontos salvos. ${atualizados} cadastro(s) de publicador atualizado(s).` : 'Pontos salvos.');
  } catch (e) {
    console.error(e);
    toast(erroAmigavel(e), 'erro');
  }
}

import { $, esc, estado, tentar, toast } from './nucleo.js';
import { novaTroca, trocaDoHorario } from './trocas.js';
import { lugarDaCelula } from './auditoria.js';
import { registrar } from './telaAuditoria.js';
import { toISO } from './escala.js';
import { baixarArquivo } from './dados.js';
import { SEPARADOR_ESCALA } from './telaEscala.js';
import { gerarICS, linkGoogleAgenda, meusHorarios, rotuloDia } from './agenda.js';

/* ============================================================ minha escala */

/** Busca as escalas publicadas e monta a lista de horários da pessoa. */
async function carregarMeusHorarios() {
  const publicadas = estado.enquetes.filter((e) => e.status === 'publicada');
  const escalas = new Map();
  await Promise.all(publicadas.map(async (e) => {
    try {
      escalas.set(e.id, await estado.backend.getEscala(e.id));
    } catch (err) {
      console.error(err); // uma escala com problema não impede de mostrar as outras
    }
  }));
  // Pedidos de troca da própria pessoa (para mostrar "Troca pedida").
  const pubId = estado.perfil.publicadorId;
  estado.minhasTrocas = [];
  await Promise.all(publicadas.map(async (e) => {
    try {
      const lista = await estado.backend.listarTrocas(e.id, { publicadorId: pubId });
      estado.minhasTrocas.push(...lista.map((t) => ({ ...t, enqueteId: e.id })));
    } catch (err) {
      console.error(err);
    }
  }));
  return meusHorarios(publicadas, escalas, pubId);
}

function botaoTroca(i, futuro) {
  if (!futuro) return '';
  const pedido = trocaDoHorario(estado.minhasTrocas.filter((t) => t.enqueteId === i.enqueteId), estado.perfil.publicadorId, i.ponto, i.data, i.turno);
  const dados = `data-enquete="${esc(i.enqueteId)}" data-ponto="${esc(i.ponto)}" data-data="${esc(i.data)}" data-turno="${esc(i.turno)}"`;
  return pedido
    ? `<p class="text-sm text-amber-800 mt-1">Troca pedida: aguardando um organizador. <button class="underline" data-acao="cancelar-troca" ${dados}>Cancelar pedido</button></p>`
    : `<button class="text-sm underline text-amber-800 mt-1" data-acao="pedir-troca" ${dados}>Preciso trocar</button>`;
}

function cartaoDia(data, itens, futuro = true) {
  return `<div class="bg-white rounded-xl border p-4">
    <h3 class="font-bold mb-2">${esc(rotuloDia(data))}</h3>
    <ul class="space-y-3">${itens.map((i) => `
      <li class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-semibold">${esc(i.turno)} · ${esc(i.ponto)}</p>
          <p class="text-sm text-slate-600">${i.companheiros.length ? `Com ${esc(i.companheiros.join(SEPARADOR_ESCALA))}` : 'Sem companheiro definido'}</p>
          ${botaoTroca(i, futuro)}
        </div>
        <a class="text-sm underline text-blue-700 whitespace-nowrap" href="${esc(linkGoogleAgenda(i))}" target="_blank" rel="noopener">Google Agenda</a>
      </li>`).join('')}</ul>
  </div>`;
}

function porDia(itens, futuro = true) {
  const grupos = new Map();
  for (const i of itens) {
    if (!grupos.has(i.data)) grupos.set(i.data, []);
    grupos.get(i.data).push(i);
  }
  return [...grupos].map(([data, lista]) => cartaoDia(data, lista, futuro)).join('');
}

export async function renderMinha() {
  const c = $('#conteudo');
  if (!estado.perfil.publicadorId) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6"><h2 class="font-bold mb-1">Seu nome ainda não está ligado à lista</h2>
      <p class="text-slate-600">Para ver os seus horários, peça ao administrador para ligar o seu acesso ao seu nome na lista de publicadores.</p></div>`;
    return;
  }

  const itens = await carregarMeusHorarios();
  const hoje = toISO(new Date());
  const proximos = itens.filter((i) => i.data >= hoje);
  const passados = itens.filter((i) => i.data < hoje).reverse();
  estado.meusProximos = proximos;

  c.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h2 class="text-lg font-bold">Minha escala</h2>
      ${proximos.length ? '<button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold text-sm" data-acao="baixar-ics">Levar tudo para o calendário</button>' : ''}
    </div>
    <p class="text-sm text-slate-600 mb-4">Aqui aparecem só os horários em que você está escalado, nas escalas já publicadas.
      ${proximos.length ? 'No iPhone, "Levar tudo para o calendário" abre o Calendário com todos os horários. No Android, toque em <strong>Google Agenda</strong> em cada horário.' : ''}</p>
    ${proximos.length
      ? `<div class="space-y-3">${porDia(proximos)}</div>`
      : '<div class="bg-white rounded-xl border p-6 text-slate-600">Você não tem horários marcados nas próximas escalas publicadas.</div>'}
    ${passados.length ? `<details class="mt-4"><summary class="cursor-pointer font-bold">Horários que já passaram (${passados.length})</summary>
      <div class="space-y-3 mt-3">${porDia(passados, false)}</div></details>` : ''}`;
}

/* ------------------------------------------------------------ "Preciso trocar" */

export async function pedirTroca(el) {
  const { enquete: enqueteId, ponto, data, turno } = el.dataset;
  const enquete = estado.enquetes.find((e) => e.id === enqueteId);
  if (!enquete) return;
  const motivo = prompt(`Pedir troca de ${turno} em ${ponto} (${rotuloDia(data)})?\nSe quiser, escreva o motivo (opcional):`, '');
  if (motivo === null) return; // tocou em Cancelar
  const troca = novaTroca({ pubId: estado.perfil.publicadorId, nome: estado.perfil.nome, enquete, ponto, data, turno, motivo });
  const ok = await tentar(() => estado.backend.salvarTroca(enqueteId, troca), 'Pedido enviado. Os organizadores vão procurar alguém para o seu lugar.');
  if (!ok) return;
  registrar({ area: 'trocas', acao: 'Pediu troca', alvo: enquete.titulo, enqueteId, detalhe: `${lugarDaCelula(ponto, data, turno)}${troca.motivo ? ` · ${troca.motivo}` : ''}` });
  renderMinha();
}

export async function cancelarTroca(el) {
  const { enquete: enqueteId, ponto, data, turno } = el.dataset;
  const pedido = trocaDoHorario(estado.minhasTrocas.filter((t) => t.enqueteId === enqueteId), estado.perfil.publicadorId, ponto, data, turno);
  if (!pedido || !confirm('Cancelar o pedido de troca? Você continua escalado nesse horário.')) return;
  const { enqueteId: _ignorado, ...dados } = pedido;
  const ok = await tentar(() => estado.backend.salvarTroca(enqueteId, { ...dados, status: 'cancelada' }), 'Pedido cancelado.');
  if (!ok) return;
  registrar({ area: 'trocas', acao: 'Cancelou o pedido de troca', enqueteId, detalhe: lugarDaCelula(ponto, data, turno) });
  renderMinha();
}

export function baixarICS() {
  const itens = estado.meusProximos || [];
  if (!itens.length) return toast('Você não tem horários marcados nas próximas escalas.', 'erro');
  baixarArquivo('minha-escala-carrinho.ics', gerarICS(itens), 'text/calendar');
  toast('Arquivo do calendário baixado. Abra-o para adicionar os horários.');
}

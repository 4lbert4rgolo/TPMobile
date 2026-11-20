import { urlDoLink } from './links.js';
import { $, abrirModal, ehAdmin, enqueteAtual, esc, estado, pubPorId } from './nucleo.js';
import { carregarVoto, escolherEnquetePadrao, htmlVoto, seletorEnquete } from './votar.js';
import { pontosDoPublicador } from './escala.js';

/* ============================================================ votos (organizadores) */

export async function renderVotos() {
  const c = $('#conteudo');
  if (!estado.enquetes.length) {
    c.innerHTML = '<p class="text-slate-600">Ainda não há enquetes. Crie uma na aba Enquetes.</p>';
    return;
  }

  const naoArquivadas = estado.enquetes.filter((e) => !e.arquivada || e.id === estado.enqueteId);
  escolherEnquetePadrao(naoArquivadas.length ? naoArquivadas : estado.enquetes);
  const enquete = enqueteAtual();
  estado.votos = await estado.backend.listarVotos(enquete.id);

  const ativos = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const porPub = new Map(estado.votos.map((v) => [v.publicadorId, v]));
  const votaram = ativos.filter((p) => porPub.has(p.id)).length;
  const aberta = enquete.status === 'aberta';
  const faltam = ativos.length - votaram;
  const pct = ativos.length ? Math.round((votaram / ativos.length) * 100) : 0;
  if (ehAdmin()) {
    try { estado.convites = (await estado.backend.listarConvites()).filter((cv) => cv.ativo !== false); } catch { estado.convites = []; }
  }

  c.innerHTML = `
    ${seletorEnquete(estado.enquetes.filter((e) => !e.arquivada || e.id === estado.enqueteId), 'escolher-enquete')}
    <div class="mb-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-slate-700"><strong>${votaram} de ${ativos.length}</strong> publicadores já votaram${faltam ? ` · faltam ${faltam}` : ' · todos votaram 🎉'}.</p>
        ${aberta && faltam ? '<button class="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold" data-acao="lembrar-grupo">📣 Lembrar o grupo</button>' : ''}
      </div>
      <div class="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="h-2 bg-green-500 rounded-full" style="width:${pct}%"></div></div>
    </div>
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left"><tr><th class="p-3">Publicador</th><th class="p-3">Situação</th><th class="p-3"></th></tr></thead>
        <tbody>
          ${ativos.map((p) => {
            const v = porPub.get(p.id);
            const perm = pontosDoPublicador(p, enquete.pontos);
            const n = v ? Object.entries(v.disponibilidade || {}).filter(([pt]) => perm.includes(pt)).reduce((s, [, l]) => s + l.length, 0) : 0;
            const r = v ? Object.entries(v.reserva || {}).filter(([pt]) => perm.includes(pt)).reduce((s, [, l]) => s + l.length, 0) : 0;
            return `<tr class="border-t">
              <td class="p-3 font-medium">${esc(p.nome)}</td>
              <td class="p-3">${v ? `<span class="text-green-700">Votou · ${n} horário(s)${r ? ` · ${r} de reserva` : ''}</span>` : '<span class="text-slate-400">Ainda não votou</span>'}</td>
              <td class="p-3 text-right whitespace-nowrap">${!v && aberta ? `<button class="text-green-700 underline mr-3 font-semibold" data-acao="lembrar" data-id="${esc(p.id)}">Lembrar</button>` : ''}<button class="text-blue-700 underline" data-acao="votar-por" data-id="${esc(p.id)}">${v ? 'Editar votos' : 'Lançar votos'}</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/** Só os dígitos, com 55 (Brasil) na frente quando vier sem o código do país. */
export function numeroWhats(tel) {
  const d = String(tel || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  return d.length <= 11 ? `55${d}` : d;
}
export const urlWhats = (pub, texto) => `https://wa.me/${numeroWhats(pub?.telefone)}?text=${encodeURIComponent(texto)}`;

export const linkGeral = () => `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;

/** Abre o WhatsApp com o lembrete pronto. Usa o link pessoal, se existir; senão, o link geral. */
export function lembrar(pubId) {
  const e = enqueteAtual();
  const pub = pubPorId(pubId);
  if (!e || !pub) return;
  const cv = estado.convites.find((x) => x.publicadorId === pubId);
  const url = cv ? urlDoLink(cv.id) : linkGeral();
  const texto = `Olá, ${pub.nome}! 🛒 A enquete do carrinho "${e.titulo}" está aberta e ainda falta o seu voto. É rapidinho, é só tocar no link:\n${url}\nVocê pode mudar o voto depois, até a enquete encerrar.`;
  window.open(urlWhats(pub, texto), '_blank', 'noopener');
}

export function abrirLembreteGrupo() {
  const e = enqueteAtual();
  if (!e) return;
  const ativos = estado.pubs.filter((p) => p.ativo !== false);
  const votaram = new Set(estado.votos.map((v) => v.publicadorId));
  const faltam = ativos.filter((p) => !votaram.has(p.id)).length;
  const texto = `🛒 *Lembrete — ${e.titulo}*\n\nA votação do carrinho ainda está aberta e faltam ${faltam} de ${ativos.length} irmãos votarem.\n\nVote pelo aplicativo:\n${linkGeral()}\n\nVocê pode mudar o voto até a enquete encerrar.`;
  abrirModal(`
    <h2 class="font-bold mb-2">Lembrete para o grupo</h2>
    <textarea id="texto-whats" class="w-full border rounded-lg p-2 text-sm" rows="9" readonly>${esc(texto)}</textarea>
    <div class="flex flex-wrap justify-end gap-2 mt-3">
      <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Fechar</button>
      <button class="px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-semibold" data-acao="copiar-whats">Copiar</button>
      <button class="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold" data-acao="abrir-whats-texto">Abrir no WhatsApp</button>
    </div>`);
}

export async function votarPor(pubId) {
  const e = enqueteAtual();
  const pub = pubPorId(pubId);
  if (!e || !pub) return;
  await carregarVoto(e, pubId);
  estado.voto.forcarAberta = true;
  abrirModal(`
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-bold">Votos de ${esc(pub.nome)}</h2>
      <button class="text-slate-500 text-xl leading-none" data-acao="fechar-modal" aria-label="Fechar">×</button>
    </div>
    <p class="text-sm text-slate-500 mb-3">Você está lançando os votos em nome de ${esc(pub.nome)}. ${e.status !== 'aberta' ? 'A votação está encerrada, mas você pode ajustar.' : ''}</p>
    <div id="area-voto">${htmlVoto({ ...e, status: 'aberta' })}</div>`, 'max-w-4xl');
}

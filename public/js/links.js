import { $, esc, estado, pubPorId, tentar, toast } from './nucleo.js';
import { renderAba } from './shell.js';
import { recarregarUsuarios } from './usuarios.js';
import { urlWhats } from './votos.js';

/* ============================================================ links de acesso (administrador) */

export const novoToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
export const urlDoLink = (token) => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#convite-${token}`;

export async function renderLinks() {
  const c = $('#conteudo');
  const [convites] = await Promise.all([estado.backend.listarConvites(), recarregarUsuarios()]);
  estado.convites = convites.filter((cv) => cv.ativo !== false);
  const porPub = new Map(estado.convites.map((cv) => [cv.publicadorId, cv]));
  const aparelhos = (token) => estado.usuarios.filter((u) => u.conviteId === token && u.papel !== 'removido').length;
  const lista = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const semLink = lista.filter((p) => !porPub.has(p.id)).length;
  const demo = estado.backend.modo === 'demo';

  c.innerHTML = `
    <h2 class="text-lg font-bold mb-1">Links de acesso</h2>
    <p class="text-sm text-slate-700 mb-3">Cada publicador recebe um <strong>link pessoal</strong>. Ao tocar nele (no WhatsApp, por exemplo), a pessoa entra direto no app e já pode votar: <strong>sem e-mail e sem senha</strong>. Ideal para quem tem dificuldade com tecnologia.</p>
    <div class="bg-amber-50 text-amber-900 text-sm rounded-lg p-3 mb-4">
      Quem tiver o link entra como aquela pessoa (só para votar e ver a escala). Mande cada link só para a pessoa certa.
      Se um link for parar em mãos erradas, toque em <strong>Revogar</strong>: ele para de funcionar e os aparelhos que o usavam saem.
    </div>
    <div class="mb-3"><button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold ${semLink ? '' : 'opacity-50'}" data-acao="gerar-todos-links" ${semLink ? '' : 'disabled'}>Gerar links para quem ainda não tem (${semLink})</button></div>
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left"><tr><th class="p-3">Publicador</th><th class="p-3">Link</th><th class="p-3"></th></tr></thead>
        <tbody>${lista.map((p) => {
          const cv = porPub.get(p.id);
          return `<tr class="border-t">
            <td class="p-3 font-medium">${esc(p.nome)}</td>
            <td class="p-3">${cv ? `<span class="text-green-700">Ativo</span> <span class="text-xs text-slate-500">· ${aparelhos(cv.id)} aparelho(s)</span>` : '<span class="text-slate-400">Sem link</span>'}</td>
            <td class="p-3 text-right whitespace-nowrap">${cv ? `
              <button class="text-blue-700 underline mr-3" data-acao="copiar-link" data-id="${esc(cv.id)}">Copiar</button>
              <button class="bg-green-600 text-white rounded-lg px-3 py-1 mr-3" data-acao="whats-link" data-id="${esc(cv.id)}">Enviar no WhatsApp</button>
              ${demo ? `<button class="text-slate-600 underline mr-3" data-acao="testar-link" data-id="${esc(cv.id)}">Testar como esta pessoa</button>` : ''}
              <button class="text-slate-600 underline mr-3" data-acao="gerar-link" data-id="${esc(p.id)}">Gerar novo</button>
              <button class="text-red-600 underline" data-acao="revogar-link" data-id="${esc(cv.id)}">Revogar</button>`
              : `<button class="bg-blue-600 text-white rounded-lg px-3 py-1" data-acao="gerar-link" data-id="${esc(p.id)}">Gerar link</button>`}</td></tr>`;
        }).join('') || '<tr><td class="p-4 text-slate-500" colspan="3">Cadastre os publicadores primeiro.</td></tr>'}</tbody>
      </table>
    </div>`;
}

export async function criarLinkPara(pubId, { pergunta = true } = {}) {
  const pub = pubPorId(pubId);
  if (!pub) return false;
  const atual = estado.convites.find((cv) => cv.publicadorId === pubId);
  if (atual && pergunta && !confirm(`Gerar um link novo para ${pub.nome}? O link antigo para de funcionar e os aparelhos que o usavam saem.`)) return false;
  return tentar(async () => {
    if (atual) await estado.backend.revogarConvite(atual.id);
    await estado.backend.criarConvite(novoToken(), { publicadorId: pubId, nome: pub.nome });
  });
}

export async function gerarTodosLinks() {
  const comLink = new Set(estado.convites.map((cv) => cv.publicadorId));
  const faltam = estado.pubs.filter((p) => p.ativo !== false && !comLink.has(p.id));
  for (const p of faltam) if (!(await criarLinkPara(p.id, { pergunta: false }))) break;
  toast(`${faltam.length} link(s) gerado(s).`);
  renderAba();
}

export const mensagemDoLink = (nome, url) => `Olá, ${nome}! Este é o seu link pessoal para votar nas escalas do carrinho. É só tocar nele, não precisa de senha:\n${url}\nPor favor, não encaminhe para outras pessoas.`;

export async function copiarLink(token) {
  const url = urlDoLink(token);
  try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch { prompt('Copie o link:', url); }
}

export function enviarLinkWhats(token) {
  const cv = estado.convites.find((x) => x.id === token);
  if (!cv) return;
  window.open(urlWhats(pubPorId(cv.publicadorId), mensagemDoLink(cv.nome, urlDoLink(token))), '_blank', 'noopener');
}

export async function revogarLink(token) {
  const cv = estado.convites.find((x) => x.id === token);
  if (!cv || !confirm(`Revogar o link de ${cv.nome}? Ele para de funcionar e os aparelhos que o usavam saem.`)) return;
  if (await tentar(() => estado.backend.revogarConvite(token), 'Link revogado.')) renderAba();
}

import { $, esc, estado, pubPorId, tentar, toast } from './nucleo.js';
import { registrar } from './telaAuditoria.js';
import { renderAba } from './shell.js';
import { recarregarUsuarios, dataHora } from './usuarios.js';
import { PAPEIS } from './data.js';
import { PAPEIS_LINK, papelDoConvite, contasDeEmailDo } from './acessos.js';
import { urlWhats } from './votos.js';
import { campoBusca, textoBusca } from './busca.js';

/* ============================================================ links de acesso (administrador) */

export const novoToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
export const urlDoLink = (token) => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#convite-${token}`;

export async function renderLinks() {
  const c = $('#conteudo');
  const [convites] = await Promise.all([estado.backend.listarConvites(), recarregarUsuarios()]);
  estado.convites = convites.filter((cv) => cv.ativo !== false);
  const porPub = new Map(estado.convites.map((cv) => [cv.publicadorId, cv]));
  const aparelhos = (token) => estado.usuarios.filter((u) => u.conviteId === token && u.papel !== 'removido').length;
  // Data do primeiro aceite do aviso de privacidade feito por este link (em qualquer aparelho).
  const aceite = (token) => estado.usuarios.filter((u) => u.conviteId === token && u.privacidadeAceitaEm).map((u) => u.privacidadeAceitaEm).sort()[0];
  const lista = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  // "Gerar para todos" pula quem já entra com e-mail e senha, para não criar um segundo acesso da mesma pessoa.
  const semLink = lista.filter((p) => !porPub.has(p.id) && !contasDeEmailDo(p.id, estado.usuarios).length).length;
  const opcoesPerfil = (atual) => PAPEIS_LINK.map((v) => `<option value="${v}" ${v === atual ? 'selected' : ''}>${PAPEIS[v]}</option>`).join('');
  const demo = estado.backend.modo === 'demo';

  c.innerHTML = `
    <h2 class="text-lg font-bold mb-1">Links de acesso</h2>
    <p class="text-sm text-slate-700 mb-3">Cada publicador recebe um <strong>link pessoal</strong>. Ao tocar nele (no WhatsApp, por exemplo), a pessoa entra direto no app e já pode votar: <strong>sem e-mail e sem senha</strong>. Ideal para quem tem dificuldade com tecnologia.</p>
    <div class="bg-amber-50 text-amber-900 text-sm rounded-lg p-3 mb-4">
      Quem tiver o link entra como aquela pessoa, <strong>com o perfil escolhido no link</strong> (Votante, Servo Ministerial ou Administrador). Mande cada link só para a pessoa certa.
      Um link de Administrador dá acesso a tudo sem senha: use só para quem não consegue entrar com e-mail.
      Se um link for parar em mãos erradas, toque em <strong>Revogar</strong>: ele para de funcionar e os aparelhos que o usavam saem.
    </div>
    ${campoBusca('Buscar publicador')}
    <div class="mb-3"><button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold ${semLink ? '' : 'opacity-50'}" data-acao="gerar-todos-links" ${semLink ? '' : 'disabled'}>Gerar links para quem ainda não tem (${semLink})</button></div>
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left"><tr><th class="p-3">Publicador</th><th class="p-3">Perfil</th><th class="p-3">Link</th><th class="p-3"></th></tr></thead>
        <tbody>${lista.map((p) => {
          const cv = porPub.get(p.id);
          const contas = contasDeEmailDo(p.id, estado.usuarios);
          const perfil = cv ? papelDoConvite(cv) : 'votante';
          return `<tr class="border-t" data-busca="${esc(textoBusca(p.nome, cv ? 'ativo' : 'sem link', PAPEIS[perfil]))}">
            <td class="p-3 font-medium">${esc(p.nome)}
              ${contas.length ? `<p class="text-xs text-amber-700 font-normal mt-1">Já entra com e-mail (${esc(contas.map((u) => PAPEIS[u.papel] || u.papel).join(', '))})</p>` : ''}</td>
            <td class="p-3">${cv
              ? `<select class="border rounded-lg p-1" data-acao="perfil-link" data-id="${esc(cv.id)}" aria-label="Perfil do link de ${esc(p.nome)}">${opcoesPerfil(perfil)}</select>`
              : `<select class="border rounded-lg p-1" data-perfil-novo="${esc(p.id)}" aria-label="Perfil do novo link de ${esc(p.nome)}">${opcoesPerfil(perfil)}</select>`}</td>
            <td class="p-3">${cv ? `<span class="text-green-700">Ativo</span> <span class="text-xs text-slate-500">· ${aparelhos(cv.id)} aparelho(s)</span>
              <br><span class="text-xs ${aceite(cv.id) ? 'text-green-700' : 'text-slate-500'}">${aceite(cv.id) ? `Privacidade aceita em ${dataHora(aceite(cv.id))}` : 'Privacidade: ainda não aceitou'}</span>` : '<span class="text-slate-400">Sem link</span>'}</td>
            <td class="p-3 text-right whitespace-nowrap">${cv ? `
              <button class="text-blue-700 underline mr-3" data-acao="copiar-link" data-id="${esc(cv.id)}">Copiar</button>
              <button class="bg-green-600 text-white rounded-lg px-3 py-1 mr-3" data-acao="whats-link" data-id="${esc(cv.id)}">Enviar no WhatsApp</button>
              ${demo ? `<button class="text-slate-600 underline mr-3" data-acao="testar-link" data-id="${esc(cv.id)}">Testar como esta pessoa</button>` : ''}
              <button class="text-slate-600 underline mr-3" data-acao="gerar-link" data-id="${esc(p.id)}">Gerar novo</button>
              <button class="text-red-600 underline" data-acao="revogar-link" data-id="${esc(cv.id)}">Revogar</button>`
              : `<button class="bg-blue-600 text-white rounded-lg px-3 py-1" data-acao="gerar-link" data-id="${esc(p.id)}">Gerar link</button>`}</td></tr>`;
        }).join('') || '<tr><td class="p-4 text-slate-500" colspan="4">Cadastre os publicadores primeiro.</td></tr>'}</tbody>
      </table>
    </div>`;
}

/**
 * Gera (ou troca) o link pessoal de um publicador.
 * papel: perfil que o link dá. Se não vier, usa o escolhido na tela; num link trocado, mantém o do link antigo.
 */
export async function criarLinkPara(pubId, { pergunta = true, papel } = {}) {
  const pub = pubPorId(pubId);
  if (!pub) return false;
  const atual = estado.convites.find((cv) => cv.publicadorId === pubId);
  const escolhido = document.querySelector(`select[data-perfil-novo="${CSS.escape(pubId)}"]`)?.value;
  const perfil = papel || (atual ? papelDoConvite(atual) : escolhido) || 'votante';

  if (pergunta) {
    const contas = contasDeEmailDo(pubId, estado.usuarios);
    if (!atual && contas.length && !confirm(`${pub.nome} já entra com e-mail e senha (${contas.map((u) => PAPEIS[u.papel] || u.papel).join(', ')}). Um link cria um segundo acesso para a mesma pessoa. Gerar mesmo assim?`)) return false;
    if (atual && !confirm(`Gerar um link novo para ${pub.nome}? O link antigo para de funcionar e os aparelhos que o usavam saem.`)) return false;
    if (!atual && perfil === 'admin' && !confirm(`O link de ${pub.nome} vai dar acesso de Administrador, sem senha: quem tiver o link pode mudar tudo no app. Continuar?`)) return false;
  }
  const ok = await tentar(async () => {
    if (atual) await estado.backend.revogarConvite(atual.id);
    await estado.backend.criarConvite(novoToken(), { publicadorId: pubId, nome: pub.nome, papel: perfil });
  });
  if (ok) registrar({ area: 'links', acao: atual ? 'Gerou um link novo (o antigo parou)' : 'Gerou o link pessoal', alvo: pub.nome, detalhe: `perfil: ${PAPEIS[perfil]}` });
  return ok;
}

/** Muda o perfil de um link que já existe: vale para o link e para todos os aparelhos que já entraram por ele. */
export async function mudarPerfilDoLink(token, papel) {
  const cv = estado.convites.find((x) => x.id === token);
  if (!cv || !PAPEIS_LINK.includes(papel)) return;
  const antes = papelDoConvite(cv);
  if (antes === papel) return;
  const aparelhos = estado.usuarios.filter((u) => u.conviteId === token && u.papel !== 'removido');
  const outrosAdmins = estado.usuarios.filter((u) => u.papel === 'admin' && u.conviteId !== token);
  if (antes === 'admin' && !outrosAdmins.length) {
    toast('Este link é o único acesso de Administrador. Nomeie outro antes de mudar.', 'erro');
    return renderAba();
  }
  const aviso = papel === 'admin' ? '\n\nAtenção: quem tiver o link poderá mudar tudo no app, sem senha.' : '';
  if (!confirm(`Mudar o link de ${cv.nome} de ${PAPEIS[antes]} para ${PAPEIS[papel]}? Vale também para os ${aparelhos.length} aparelho(s) que já entraram por ele.${aviso}`)) return renderAba();
  const ok = await tentar(async () => {
    await estado.backend.atualizarConvite(token, { papel });
    for (const u of aparelhos) await estado.backend.atualizarUsuario(u.id, { papel });
  }, 'Perfil do link alterado.');
  if (ok) registrar({ area: 'links', acao: 'Mudou o perfil do link pessoal', alvo: cv.nome, detalhe: `${PAPEIS[antes]} → ${PAPEIS[papel]}` });
  renderAba();
}

export async function gerarTodosLinks() {
  const comLink = new Set(estado.convites.map((cv) => cv.publicadorId));
  const semLink = estado.pubs.filter((p) => p.ativo !== false && !comLink.has(p.id));
  // Quem já entra com e-mail fica de fora, para não duplicar o acesso.
  const faltam = semLink.filter((p) => !contasDeEmailDo(p.id, estado.usuarios).length);
  for (const p of faltam) if (!(await criarLinkPara(p.id, { pergunta: false }))) break;
  const pulados = semLink.length - faltam.length;
  toast(`${faltam.length} link(s) gerado(s).${pulados ? ` ${pulados} pessoa(s) que já entram com e-mail ficaram de fora.` : ''}`);
  renderAba();
}

export const mensagemDoLink = (nome, url, papel = 'votante') => (papel === 'votante'
  ? `Olá, ${nome}! Este é o seu link pessoal para votar nas escalas do carrinho. É só tocar nele, não precisa de senha:\n${url}\nPor favor, não encaminhe para outras pessoas.`
  : `Olá, ${nome}! Este é o seu link pessoal para entrar no TPMobile como ${PAPEIS[papel]}. É só tocar nele, não precisa de senha:\n${url}\nPor favor, não encaminhe para ninguém: quem tiver este link entra com o seu acesso.`);

export async function copiarLink(token) {
  const url = urlDoLink(token);
  try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch { prompt('Copie o link:', url); }
}

export function enviarLinkWhats(token) {
  const cv = estado.convites.find((x) => x.id === token);
  if (!cv) return;
  window.open(urlWhats(pubPorId(cv.publicadorId), mensagemDoLink(cv.nome, urlDoLink(token), papelDoConvite(cv))), '_blank', 'noopener');
}

export async function revogarLink(token) {
  const cv = estado.convites.find((x) => x.id === token);
  if (!cv || !confirm(`Revogar o link de ${cv.nome}? Ele para de funcionar e os aparelhos que o usavam saem.`)) return;
  if (await tentar(() => estado.backend.revogarConvite(token), 'Link revogado.')) {
    registrar({ area: 'links', acao: 'Revogou o link pessoal', alvo: cv.nome });
    renderAba();
  }
}

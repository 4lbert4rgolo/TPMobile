import { $, SEM_ACESSO, esc, estado, tentar, toast } from './nucleo.js';
import { carregarBase } from './sessao.js';
import { renderAba, renderApp } from './shell.js';
import { PAPEIS } from './data.js';

/* ============================================================ usuários (administrador) */

export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Se o nome da conta for igual ao de um único publicador, sugere a ligação. */
export function publicadorSugerido(usuario) {
  if (usuario.publicadorId) return null;
  const alvo = semAcento(usuario.nome);
  if (!alvo) return null;
  const achados = estado.pubs.filter((p) => semAcento(p.nome) === alvo);
  return achados.length === 1 ? achados[0].id : null;
}

export const ehUltimoAdmin = (uid) => {
  const admins = estado.usuarios.filter((u) => u.papel === 'admin');
  return admins.length === 1 && admins[0].id === uid;
};

export async function recarregarUsuarios() {
  estado.usuarios = await estado.backend.listarUsuarios();
}

export async function renderUsuarios() {
  const c = $('#conteudo');
  await recarregarUsuarios();

  const nomeOrdem = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt');
  const pendentes = estado.usuarios.filter((u) => u.papel === 'pendente').sort(nomeOrdem);
  const ativos = estado.usuarios.filter((u) => !SEM_ACESSO.includes(u.papel)).sort(nomeOrdem);
  const removidos = estado.usuarios.filter((u) => u.papel === 'removido').sort(nomeOrdem);
  const pubs = [...estado.pubs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  const linha = (u) => {
    const sugerido = publicadorSugerido(u);
    const escolhido = u.publicadorId || sugerido;
    const pendente = u.papel === 'pendente';
    return `<tr class="border-t ${pendente ? 'bg-amber-50' : ''}" data-uid="${esc(u.id)}">
      <td class="p-3">
        <input class="border rounded-lg p-1 w-full min-w-[9rem]" value="${esc(u.nome || '')}" data-campo-usuario="nome" aria-label="Nome">
        <p class="text-xs text-slate-500 mt-1">${u.conviteId ? 'Entrou pelo link pessoal' : esc(u.email || '')}</p></td>
      <td class="p-3"><select class="border rounded-lg p-1" data-campo-usuario="papel" aria-label="Perfil">
        ${Object.entries(PAPEIS).filter(([v]) => v !== 'removido').map(([v, r]) => `<option value="${v}" ${u.papel === v ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
      <td class="p-3"><select class="border rounded-lg p-1" data-campo-usuario="publicadorId" aria-label="Publicador">
        <option value="">— nenhum —</option>
        ${pubs.map((p) => `<option value="${esc(p.id)}" ${escolhido === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
        ${sugerido ? '<p class="text-xs text-amber-700 mt-1">Sugerido pelo nome. Confirme em Salvar.</p>' : ''}</td>
      <td class="p-3 text-right whitespace-nowrap">
        <button class="bg-blue-600 text-white rounded-lg px-3 py-1 mr-1" data-acao="salvar-usuario" data-id="${esc(u.id)}">Salvar</button>
        <button class="text-red-600 underline" data-acao="remover-usuario" data-id="${esc(u.id)}">${pendente ? 'Recusar' : 'Remover acesso'}</button>
      </td></tr>`;
  };

  const tabela = (lista) => `<div class="bg-white rounded-xl shadow-sm border overflow-x-auto mb-6">
    <table class="w-full text-sm">
      <thead class="bg-slate-100 text-left"><tr><th class="p-3">Pessoa</th><th class="p-3">Perfil</th><th class="p-3">Publicador</th><th class="p-3"></th></tr></thead>
      <tbody>${lista.map(linha).join('')}</tbody></table></div>`;

  c.innerHTML = `
    <h2 class="text-lg font-bold mb-1">Usuários</h2>
    <p class="text-sm text-slate-600 mb-4">Defina o perfil de cada pessoa e ligue o acesso dela ao nome na lista de publicadores. <strong>Remover acesso</strong> bloqueia na hora, e você pode reativar depois.</p>

    ${pendentes.length ? `<h3 class="font-bold text-amber-800 mb-2">Aguardando aprovação (${pendentes.length})</h3>${tabela(pendentes)}` : ''}

    <h3 class="font-bold mb-2">Com acesso (${ativos.length})</h3>
    ${ativos.length ? tabela(ativos) : '<p class="text-slate-500 mb-6">Ninguém ainda.</p>'}

    <details class="mb-6" ${removidos.length ? '' : 'hidden'}>
      <summary class="cursor-pointer font-bold">Acessos removidos (${removidos.length})</summary>
      <div class="bg-white rounded-xl shadow-sm border overflow-x-auto mt-2"><table class="w-full text-sm"><tbody>
        ${removidos.map((u) => `<tr class="border-t first:border-t-0">
          <td class="p-3"><p class="font-medium">${esc(u.nome || '—')}</p><p class="text-xs text-slate-500">${u.conviteId ? 'Entrava pelo link pessoal' : esc(u.email || '')}</p></td>
          <td class="p-3 text-right whitespace-nowrap">
            <button class="text-blue-700 underline mr-3" data-acao="reativar-usuario" data-id="${esc(u.id)}">Reativar como votante</button>
            <button class="text-red-600 underline" data-acao="excluir-usuario" data-id="${esc(u.id)}">Excluir registro</button></td></tr>`).join('')}
      </tbody></table></div>
    </details>

    <p class="text-xs text-slate-500">Quem tem conta por e-mail e foi removido continua com a conta de login criada, mas sem nenhum acesso aos dados. Para apagar a conta de login de vez, use Authentication no console do Firebase.</p>`;
}

export async function salvarUsuario(uid) {
  const linha = document.querySelector(`tr[data-uid="${CSS.escape(uid)}"]`);
  const nome = linha.querySelector('[data-campo-usuario=nome]').value.trim();
  const papel = linha.querySelector('[data-campo-usuario=papel]').value;
  const publicadorId = linha.querySelector('[data-campo-usuario=publicadorId]').value || null;

  if (!nome) return toast('Informe o nome.', 'erro');
  if (ehUltimoAdmin(uid) && papel !== 'admin') return toast('Este é o único administrador. Nomeie outro antes de mudar este perfil.', 'erro');
  if (uid === estado.perfil.uid && papel !== 'admin' && !confirm('Você está tirando o seu próprio perfil de administrador. Continuar?')) return;

  const ok = await tentar(() => estado.backend.atualizarUsuario(uid, { nome, papel, publicadorId }), 'Usuário atualizado.');
  if (!ok) return;
  if (uid === estado.perfil.uid) {
    estado.perfil = { ...estado.perfil, nome, papel, publicadorId };
    await carregarBase();
    renderApp();
  } else {
    renderAba();
  }
}

export async function removerAcesso(uid) {
  const u = estado.usuarios.find((x) => x.id === uid);
  if (!u) return;
  if (uid === estado.perfil.uid) return toast('Você não pode remover o seu próprio acesso.', 'erro');
  if (ehUltimoAdmin(uid)) return toast('Este é o único administrador. Nomeie outro antes de remover.', 'erro');
  if (!confirm(`${u.papel === 'pendente' ? 'Recusar' : 'Remover o acesso de'} ${u.nome || 'esta pessoa'}? A pessoa perde o acesso na hora. Você pode reativar depois.`)) return;
  if (await tentar(() => estado.backend.atualizarUsuario(uid, { papel: 'removido' }), 'Acesso removido.')) renderAba();
}

export async function reativarUsuario(uid) {
  if (await tentar(() => estado.backend.atualizarUsuario(uid, { papel: 'votante' }), 'Acesso reativado como votante.')) renderAba();
}

export async function excluirRegistroUsuario(uid) {
  const u = estado.usuarios.find((x) => x.id === uid);
  if (!u || !confirm(`Excluir o registro de ${u.nome || 'esta pessoa'}? Se ela entrar de novo com a mesma conta de e-mail, aparecerá como aguardando aprovação.`)) return;
  if (await tentar(() => estado.backend.excluirUsuario(uid), 'Registro excluído.')) renderAba();
}

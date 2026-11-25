import { $, SEM_ACESSO, esc, estado, tentar, toast } from './nucleo.js';
import { registrar } from './telaAuditoria.js';
import { carregarBase } from './sessao.js';
import { renderAba, renderApp } from './shell.js';
import { PAPEIS, normalizarPapel } from './data.js';
import { campoBusca } from './busca.js';
import { agruparUsuarios, contasDeEmailDo, PAPEIS_LINK } from './acessos.js';

/* ============================================================ usuários (administrador) */

export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Se o nome da conta for igual ao de um único publicador, sugere a ligação. */
/** "20/11/2026 às 14:32" */
export function dataHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dois = (n) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export function publicadorSugerido(usuario) {
  if (usuario.publicadorId) return null;
  const alvo = semAcento(usuario.nome);
  if (!alvo) return null;
  const achados = estado.pubs.filter((p) => semAcento(p.nome) === alvo);
  return achados.length === 1 ? achados[0].id : null;
}

/** Todos os uids da mesma pessoa: os aparelhos que entraram pelo mesmo link pessoal (ou só o próprio uid). */
export function uidsDoGrupo(uid) {
  const u = estado.usuarios.find((x) => x.id === uid);
  if (!u?.conviteId) return [uid];
  return estado.usuarios.filter((x) => x.conviteId === u.conviteId).map((x) => x.id);
}

/** true se, tirando esta pessoa (todos os aparelhos dela), não sobra nenhum administrador. */
export const ehUltimoAdmin = (uid) => {
  const grupo = new Set(uidsDoGrupo(uid));
  const admins = estado.usuarios.filter((u) => u.papel === 'admin');
  return admins.some((u) => grupo.has(u.id)) && !admins.some((u) => !grupo.has(u.id));
};

export async function recarregarUsuarios() {
  const lista = await estado.backend.listarUsuarios();
  // Perfil antigo "anciao": grava como "admin" (anciãos têm o mesmo acesso do administrador).
  for (const u of lista.filter((x) => x.papel === 'anciao')) {
    try {
      await estado.backend.atualizarUsuario(u.id, { papel: 'admin' });
    } catch (e) {
      console.error(e); // sem permissão agora: a tela mostra como Administrador mesmo assim
    }
  }
  estado.usuarios = lista.map((u) => ({ ...u, papel: normalizarPapel(u.papel) }));
}

export async function renderUsuarios() {
  const c = $('#conteudo');
  await recarregarUsuarios();

  const nomeOrdem = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt');
  // Uma linha por pessoa: os aparelhos que entraram pelo mesmo link pessoal ficam juntos.
  const grupos = agruparUsuarios(estado.usuarios);
  const pendentes = grupos.filter((u) => u.papel === 'pendente').sort(nomeOrdem);
  const ativos = grupos.filter((u) => !SEM_ACESSO.includes(u.papel)).sort(nomeOrdem);
  const removidos = grupos.filter((u) => u.papel === 'removido').sort(nomeOrdem);
  // Para avisar quando a mesma pessoa tem conta de e-mail E link pessoal (acesso duplicado).
  const temLink = new Set(estado.usuarios.filter((u) => u.conviteId && u.papel !== 'removido').map((u) => u.publicadorId));
  const comoEntra = (u) => (u.conviteId
    ? `Link pessoal · ${u.aparelhos} aparelho(s)${contasDeEmailDo(u.publicadorId, estado.usuarios).length ? ' · <span class="text-amber-700">também entra com e-mail</span>' : ''}`
    : `${esc(u.email || '')}${u.publicadorId && temLink.has(u.publicadorId) ? ' · <span class="text-amber-700">também entra pelo link pessoal</span>' : ''}`);
  const pubs = [...estado.pubs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  const linha = (u) => {
    const sugerido = publicadorSugerido(u);
    const escolhido = u.publicadorId || sugerido;
    const pendente = u.papel === 'pendente';
    const pub = estado.pubs.find((p) => p.id === u.publicadorId);
    return `<tr class="border-t ${pendente ? 'bg-amber-50' : ''}" data-uid="${esc(u.id)}" data-busca="${esc(semAcento([u.nome, u.email, pub?.nome, PAPEIS[u.papel]].filter(Boolean).join(' ')))}">
      <td class="p-3">
        <input class="border rounded-lg p-1 w-full min-w-[9rem]" value="${esc(u.nome || '')}" data-campo-usuario="nome" aria-label="Nome">
        <p class="text-xs text-slate-500 mt-1">${comoEntra(u)}</p>
        ${u.misturado ? '<p class="text-xs text-amber-700 mt-1">Os aparelhos desta pessoa estavam com perfis diferentes. Confira o perfil e toque em Salvar para igualar.</p>' : ''}
        <p class="text-xs mt-1 ${u.privacidadeAceitaEm ? 'text-green-700' : 'text-amber-700'}">${u.privacidadeAceitaEm ? `Privacidade aceita em ${dataHora(u.privacidadeAceitaEm)}` : 'Ainda não aceitou o aviso de privacidade'}</p></td>
      <td class="p-3"><select class="border rounded-lg p-1" data-campo-usuario="papel" aria-label="Perfil">
        ${Object.entries(PAPEIS).filter(([v]) => v !== 'removido' && (!u.conviteId || PAPEIS_LINK.includes(v))).map(([v, r]) => `<option value="${v}" ${u.papel === v ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
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
    <p class="text-sm text-slate-600 mb-4">Defina o perfil de cada pessoa e ligue o acesso dela ao nome na lista de publicadores. Quem entra pelo link pessoal aparece numa linha só, mesmo usando vários aparelhos: mudar o perfil aqui muda também o link. <strong>Remover acesso</strong> bloqueia na hora, e você pode reativar depois. Anciãos devem ter o perfil <strong>Administrador</strong>.</p>
    ${campoBusca('Buscar por nome, e-mail ou perfil')}

    ${pendentes.length ? `<h3 class="font-bold text-amber-800 mb-2">Aguardando aprovação (${pendentes.length})</h3>${tabela(pendentes)}` : ''}

    <h3 class="font-bold mb-2">Com acesso (${ativos.length})</h3>
    ${ativos.length ? tabela(ativos) : '<p class="text-slate-500 mb-6">Ninguém ainda.</p>'}

    <details class="mb-6" ${removidos.length ? '' : 'hidden'}>
      <summary class="cursor-pointer font-bold">Acessos removidos (${removidos.length})</summary>
      <div class="bg-white rounded-xl shadow-sm border overflow-x-auto mt-2"><table class="w-full text-sm"><tbody>
        ${removidos.map((u) => `<tr class="border-t first:border-t-0" data-busca="${esc(semAcento([u.nome, u.email].filter(Boolean).join(' ')))}">
          <td class="p-3"><p class="font-medium">${esc(u.nome || '—')}</p><p class="text-xs text-slate-500">${u.conviteId ? `Entrava pelo link pessoal · ${u.aparelhos} aparelho(s)` : esc(u.email || '')}</p></td>
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

  const antes = estado.usuarios.find((x) => x.id === uid);
  const uids = uidsDoGrupo(uid);
  const ok = await tentar(async () => {
    for (const id of uids) await estado.backend.atualizarUsuario(id, { nome, papel, publicadorId });
    // Link pessoal: o link guarda o mesmo perfil e nome, para o próximo aparelho já entrar certo (sem duplicar).
    if (antes?.conviteId && PAPEIS_LINK.includes(papel)) {
      try { await estado.backend.atualizarConvite(antes.conviteId, { papel, nome, ...(publicadorId ? { publicadorId } : {}) }); } catch (e) { console.error(e); /* link já revogado */ }
    }
  }, 'Usuário atualizado.');
  if (!ok) return;
  const mudancas = [];
  if (antes?.papel !== papel) mudancas.push(`perfil: ${PAPEIS[antes?.papel] || antes?.papel || '—'} → ${PAPEIS[papel] || papel}`);
  if ((antes?.publicadorId || null) !== publicadorId) mudancas.push(`ligado a: ${estado.pubs.find((p) => p.id === publicadorId)?.nome || 'ninguém'}`);
  if (antes?.nome !== nome) mudancas.push(`nome: ${antes?.nome || '—'} → ${nome}`);
  registrar({ area: 'usuarios', acao: antes?.papel === 'pendente' && papel !== 'pendente' ? 'Aprovou o acesso' : 'Alterou o usuário', alvo: nome, detalhe: mudancas.join(' · ') || 'sem mudança' });
  if (uids.includes(estado.perfil.uid)) {
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
  if (uidsDoGrupo(uid).includes(estado.perfil.uid)) return toast('Você não pode remover o seu próprio acesso.', 'erro');
  if (ehUltimoAdmin(uid)) return toast('Este é o único administrador. Nomeie outro antes de remover.', 'erro');
  if (!confirm(`${u.papel === 'pendente' ? 'Recusar' : 'Remover o acesso de'} ${u.nome || 'esta pessoa'}? A pessoa perde o acesso na hora. Você pode reativar depois.`)) return;
  if (await tentar(async () => {
    for (const id of uidsDoGrupo(uid)) await estado.backend.atualizarUsuario(id, { papel: 'removido' });
    // O link pessoal para de aceitar aparelhos novos (senão um celular novo entraria de novo, como outra pessoa).
    if (u.conviteId) { try { await estado.backend.atualizarConvite(u.conviteId, { ativo: false }); } catch (e) { console.error(e); } }
  }, 'Acesso removido.')) {
    registrar({ area: 'usuarios', acao: u.papel === 'pendente' ? 'Recusou o acesso' : 'Removeu o acesso', alvo: u.nome || u.email || uid });
    renderAba();
  }
}

export async function reativarUsuario(uid) {
  const u = estado.usuarios.find((x) => x.id === uid);
  if (await tentar(async () => {
    for (const id of uidsDoGrupo(uid)) await estado.backend.atualizarUsuario(id, { papel: 'votante' });
    if (u?.conviteId) { try { await estado.backend.atualizarConvite(u.conviteId, { ativo: true, papel: 'votante' }); } catch (e) { console.error(e); } }
  }, 'Acesso reativado como votante.')) {
    registrar({ area: 'usuarios', acao: 'Reativou o acesso (votante)', alvo: u?.nome || u?.email || uid });
    renderAba();
  }
}

export async function excluirRegistroUsuario(uid) {
  const u = estado.usuarios.find((x) => x.id === uid);
  if (!u || !confirm(`Excluir o registro de ${u.nome || 'esta pessoa'}? Se ela entrar de novo com a mesma conta de e-mail, aparecerá como aguardando aprovação.`)) return;
  if (await tentar(async () => { for (const id of uidsDoGrupo(uid)) await estado.backend.excluirUsuario(id); }, 'Registro excluído.')) {
    registrar({ area: 'usuarios', acao: 'Excluiu o registro do usuário', alvo: u.nome || u.email || uid });
    renderAba();
  }
}

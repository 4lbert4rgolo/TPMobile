import { $, abrirModal, esc, estado, fecharModal, pubPorId, tentar, toast } from './nucleo.js';
import { renderAba } from './shell.js';
import { numeroWhats } from './votos.js';
import { campoBusca, textoBusca } from './busca.js';

/* ============================================================ publicadores */

export async function renderPublicadores() {
  const c = $('#conteudo');
  const lista = [...estado.pubs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const ativos = lista.filter((p) => p.ativo !== false).length;

  c.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 class="text-lg font-bold">Publicadores <span class="text-sm font-normal text-slate-500">(${ativos} ativos)</span></h2>
      <button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold" data-acao="novo-publicador">Novo publicador</button>
    </div>
    <p class="text-sm text-slate-600 mb-3">Guarde só o necessário. "Par fixo" faz o casal participar sempre junto; "Precisa de trio" faz a equipe ter 3 pessoas (por idade ou necessidade especial).</p>
    ${campoBusca('Buscar por nome, ponto ou par fixo')}
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left"><tr><th class="p-3">Nome</th><th class="p-3">Gênero</th><th class="p-3">Pontos</th><th class="p-3">Par fixo</th><th class="p-3">Trio</th><th class="p-3">Situação</th><th class="p-3"></th></tr></thead>
        <tbody>
          ${lista.map((p) => `<tr class="border-t ${p.ativo === false ? 'text-slate-400' : ''}" data-busca="${esc(textoBusca(p.nome, p.genero === 'F' ? 'irmã' : 'irmão', (p.pontosVoto || []).join(' '), pubPorId(p.conjuge)?.nome, p.ativo === false ? 'inativo' : 'ativo'))}">
            <td class="p-3 font-medium">${esc(p.nome)}</td>
            <td class="p-3">${p.genero === 'F' ? 'Irmã' : 'Irmão'}</td>
            <td class="p-3">${p.pontosVoto?.length ? esc(p.pontosVoto.join(', ')) : 'Todos'}</td>
            <td class="p-3">${esc(pubPorId(p.conjuge)?.nome || '—')}</td>
            <td class="p-3">${p.requerTrio ? 'Sim' : '—'}</td>
            <td class="p-3">${p.ativo === false ? 'Inativo' : 'Ativo'}</td>
            <td class="p-3 text-right whitespace-nowrap">
              <button class="text-blue-700 underline mr-3" data-acao="editar-publicador" data-id="${esc(p.id)}">Editar</button>
              <button class="text-red-600 underline" data-acao="excluir-publicador" data-id="${esc(p.id)}">Excluir</button>
            </td></tr>`).join('') || '<tr><td class="p-4 text-slate-500" colspan="7">Nenhum publicador cadastrado.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

export const pontosConhecidos = () => [...new Set([...(estado.config?.pontos || []), ...estado.enquetes.flatMap((e) => e.pontos || [])])];

export function formularioPublicador(id) {
  const p = id ? pubPorId(id) : null;
  const restrito = Boolean(p?.pontosVoto?.length);
  const pontosForm = [...new Set([...pontosConhecidos(), ...(p?.pontosVoto || [])])];
  const outros = estado.pubs.filter((x) => x.id !== id && x.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  abrirModal(`
    <h2 class="font-bold mb-3">${p ? 'Editar publicador' : 'Novo publicador'}</h2>
    <form id="form-publicador" class="space-y-3" data-id="${esc(id || '')}">
      <div><label class="text-sm font-medium" for="pb-nome">Nome</label>
        <input id="pb-nome" class="w-full border rounded-lg p-2" value="${esc(p?.nome || '')}" required></div>
      <div><label class="text-sm font-medium" for="pb-genero">Gênero</label>
        <select id="pb-genero" class="w-full border rounded-lg p-2">
          <option value="M" ${p?.genero !== 'F' ? 'selected' : ''}>Irmão</option>
          <option value="F" ${p?.genero === 'F' ? 'selected' : ''}>Irmã</option></select></div>
      <div><label class="text-sm font-medium" for="pb-tel">Telefone com WhatsApp (opcional)</label>
        <input id="pb-tel" type="tel" inputmode="tel" autocomplete="off" placeholder="(11) 91234-5678" class="w-full border rounded-lg p-2" value="${esc(p?.telefone || '')}">
        <p class="text-xs text-slate-500 mt-1">Só serve para o botão "Lembrar" abrir a conversa direto com a pessoa. Fica visível apenas para os organizadores.</p></div>
      <div><label class="text-sm font-medium" for="pb-conjuge">Par fixo (opcional)</label>
        <select id="pb-conjuge" class="w-full border rounded-lg p-2"><option value="">Nenhum</option>
          ${outros.map((o) => `<option value="${esc(o.id)}" ${p?.conjuge === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></div>
      <fieldset class="border rounded-lg p-3">
        <legend class="text-sm font-medium px-1">Onde vota</legend>
        <label class="flex items-center gap-2 text-sm"><input type="radio" name="pb-onde" value="todos" ${restrito ? '' : 'checked'}> Todos os pontos</label>
        <label class="flex items-center gap-2 text-sm mt-1"><input type="radio" name="pb-onde" value="alguns" ${restrito ? 'checked' : ''}> Somente em:</label>
        <div class="ml-6 mt-1 space-y-1">${pontosForm.map((po) => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="pb-ponto" value="${esc(po)}" ${(p?.pontosVoto || []).includes(po) ? 'checked' : ''} ${restrito ? '' : 'disabled'}> ${esc(po)}</label>`).join('')}</div>
      </fieldset>
      <label class="flex items-center gap-2 text-sm"><input id="pb-trio" type="checkbox" ${p?.requerTrio ? 'checked' : ''}> Precisa de trio (idade ou necessidade especial)</label>
      <label class="flex items-center gap-2 text-sm"><input id="pb-ativo" type="checkbox" ${p?.ativo === false ? '' : 'checked'}> Ativo</label>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold">Salvar</button>
      </div>
    </form>`);
}

export async function salvarPublicadorForm(form) {
  const antigoId = form.dataset.id || null;
  const antigo = antigoId ? pubPorId(antigoId) : null;
  const nome = $('#pb-nome').value.trim();
  if (!nome) return toast('Informe o nome.', 'erro');
  const onde = document.querySelector('input[name=pb-onde]:checked')?.value;
  const marcados = [...document.querySelectorAll('input[name=pb-ponto]:checked')].map((i) => i.value);
  if (onde === 'alguns' && !marcados.length) return toast('Marque pelo menos um ponto ou escolha "Todos os pontos".', 'erro');
  const telefone = $('#pb-tel').value.trim();
  if (telefone && numeroWhats(telefone).length < 12) return toast('Telefone incompleto. Use DDD + número, ex.: (11) 91234-5678.', 'erro');
  const dados = {
    nome,
    telefone,
    pontosVoto: onde === 'alguns' ? marcados : [],
    genero: $('#pb-genero').value,
    conjuge: $('#pb-conjuge').value,
    requerTrio: $('#pb-trio').checked,
    ativo: $('#pb-ativo').checked,
  };

  const ok = await tentar(async () => {
    const b = estado.backend;
    const id = await b.salvarPublicador({ ...(antigo || {}), ...dados, id: antigoId || undefined });

    // O par fixo vale nos dois sentidos: ajusta quem estava ligado antes e quem está ligado agora.
    if (antigo?.conjuge && antigo.conjuge !== dados.conjuge) {
      const ex = pubPorId(antigo.conjuge);
      if (ex && ex.conjuge === id) await b.salvarPublicador({ ...ex, conjuge: '' });
    }
    if (dados.conjuge) {
      const par = pubPorId(dados.conjuge);
      if (par && par.conjuge !== id) {
        const exDoPar = par.conjuge ? pubPorId(par.conjuge) : null;
        if (exDoPar && exDoPar.conjuge === par.id) await b.salvarPublicador({ ...exDoPar, conjuge: '' });
        await b.salvarPublicador({ ...par, conjuge: id });
      }
    }
  }, 'Publicador salvo.');

  if (ok) {
    fecharModal();
    estado.pubs = await estado.backend.listarPublicadores();
    renderAba();
  }
}

export async function excluirPublicador(id) {
  const p = pubPorId(id);
  if (!p || !confirm(`Excluir ${p.nome}? Os votos e as escalas já feitas continuam guardados, mas o nome sai da lista.`)) return;
  const ok = await tentar(async () => {
    if (p.conjuge) {
      const par = pubPorId(p.conjuge);
      if (par && par.conjuge === id) await estado.backend.salvarPublicador({ ...par, conjuge: '' });
    }
    await estado.backend.excluirPublicador(id);
  }, 'Publicador excluído.');
  if (ok) {
    estado.pubs = await estado.backend.listarPublicadores();
    renderAba();
  }
}

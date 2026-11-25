import { $, abrirModal, carregarExcel, esc, estado, fecharModal, pubPorId, tentar, toast } from './nucleo.js';
import { registrar } from './telaAuditoria.js';
import { renderAba } from './shell.js';
import { numeroWhats } from './votos.js';
import { campoBusca, textoBusca } from './busca.js';
import { lerTexto, interpretarLinhas, linhasDoModelo, COLUNAS } from './importar.js';
import { ESTILOS } from './relatorios.js';

/* ============================================================ publicadores */

export async function renderPublicadores() {
  const c = $('#conteudo');
  const lista = [...estado.pubs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const ativos = lista.filter((p) => p.ativo !== false).length;

  c.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 class="text-lg font-bold">Publicadores <span class="text-sm font-normal text-slate-500">(${ativos} ativos)</span></h2>
      <div class="flex gap-2">
        <button class="bg-blue-100 text-blue-800 rounded-lg px-4 py-2 font-semibold" data-acao="importar-publicadores">Importar</button>
        <button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold" data-acao="novo-publicador">Novo publicador</button>
      </div>
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

/** Pontos da configuração (Menu > Pontos), na ordem de lá. */
export const pontosConhecidos = () => [...(estado.config?.pontos || [])];

const CAMPOS_PUB = { nome: 'nome', telefone: 'telefone', pontosVoto: 'onde vota', genero: 'gênero', conjuge: 'par fixo', requerTrio: 'trio', ativo: 'ativo' };

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
    const mudou = antigo ? Object.entries(dados).filter(([k, v]) => JSON.stringify(antigo[k] ?? (k === 'pontosVoto' ? [] : '')) !== JSON.stringify(v)).map(([k]) => CAMPOS_PUB[k] || k) : [];
    registrar({ area: 'publicadores', acao: antigo ? 'Editou o publicador' : 'Cadastrou o publicador', alvo: nome, detalhe: antigo ? (mudou.length ? `mudou: ${mudou.join(', ')}` : 'sem mudança') : '' });
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
    registrar({ area: 'publicadores', acao: 'Excluiu o publicador', alvo: p.nome });
    estado.pubs = await estado.backend.listarPublicadores();
    renderAba();
  }
}

/* ============================================================ importar em lote */

export function abrirImportacao() {
  estado.importacao = null;
  abrirModal(`
    <div class="flex items-start justify-between gap-3 mb-2">
      <h2 class="text-lg font-bold">Importar publicadores</h2>
      <button class="px-2 text-slate-500" data-acao="fechar-modal" aria-label="Fechar">✕</button>
    </div>
    <p class="text-sm text-slate-600 mb-2">Use as colunas <strong>${COLUNAS.join(' · ')}</strong>. Nome e gênero são obrigatórios. Em "Onde vota", escreva os pontos separados por vírgula ou "Todos". Quem já estiver cadastrado com o mesmo nome é ignorado. O par fixo você liga depois, editando cada pessoa.</p>
    <button class="text-sm underline text-blue-700 mb-3" data-acao="baixar-modelo-importacao">Baixar o modelo em Excel</button>
    <div class="space-y-3">
      <div><label class="text-sm font-medium" for="imp-arquivo">Enviar arquivo (.xlsx ou .csv)</label>
        <input id="imp-arquivo" type="file" accept=".xlsx,.xls,.csv,.txt" class="block w-full text-sm mt-1" data-importar-arquivo></div>
      <div><label class="text-sm font-medium" for="imp-texto">Ou cole aqui as linhas copiadas da planilha</label>
        <textarea id="imp-texto" rows="6" class="w-full border rounded-lg p-2 text-sm font-mono" placeholder="Nome&#9;Gênero&#9;Telefone&#9;Onde vota&#9;Precisa de trio"></textarea></div>
      <button class="bg-slate-200 rounded-lg px-4 py-2 font-semibold" data-acao="previa-importacao">Ver prévia</button>
    </div>
    <div id="imp-previa" class="mt-4"></div>`, 'max-w-3xl');
}

/** Lê o arquivo enviado e coloca as linhas na caixa de texto, para a pessoa conferir. */
export async function arquivoDeImportacao(input) {
  const arquivo = input.files?.[0];
  if (!arquivo) return;
  try {
    let linhas;
    if (/\.(xlsx|xls)$/i.test(arquivo.name)) {
      // Para LER planilhas usa a SheetJS 0.20.3 (corrige falhas de segurança na leitura de arquivos),
      // carregada só agora. A xlsx-js-style (global XLSX) fica só para gerar planilhas.
      let L;
      try { L = await import('../vendor/xlsx.mjs'); } catch (e) {
        console.error(e);
        return toast('A biblioteca do Excel não carregou. Verifique a internet ou cole as linhas.', 'erro');
      }
      const wb = L.read(await arquivo.arrayBuffer(), { type: 'array' });
      linhas = L.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false })
        .map((l) => l.map((c) => String(c ?? '').trim()));
    } else {
      linhas = lerTexto(await arquivo.text());
    }
    $('#imp-texto').value = linhas.filter((l) => l.some(Boolean)).map((l) => l.join('\t')).join('\n');
    previaImportacao();
  } catch (e) {
    console.error(e);
    toast('Não foi possível ler o arquivo. Confira o formato ou cole as linhas.', 'erro');
  }
}

export function previaImportacao() {
  const res = interpretarLinhas(lerTexto($('#imp-texto').value), { existentes: estado.pubs, pontos: estado.config.pontos || [] });
  estado.importacao = res;
  const lista = (titulo, itens, cor) => (itens.length ? `<div class="mb-3"><h3 class="font-semibold text-sm ${cor}">${titulo} (${itens.length})</h3>
    <ul class="text-sm list-disc pl-5">${itens.map((x) => `<li>${x.linha ? `Linha ${x.linha}: ` : ''}${esc(x.nome || '(sem nome)')}${x.msg ? ` — ${esc(x.msg)}` : ''}</li>`).join('')}</ul></div>` : '');
  $('#imp-previa').innerHTML = `
    ${res.novos.length ? `<div class="mb-3"><h3 class="font-semibold text-sm text-green-800">Serão cadastrados (${res.novos.length})</h3>
      <div class="overflow-x-auto border rounded-lg"><table class="w-full text-sm"><thead class="bg-slate-50 text-left"><tr><th class="p-2">Nome</th><th class="p-2">Gênero</th><th class="p-2">Telefone</th><th class="p-2">Onde vota</th><th class="p-2">Trio</th></tr></thead>
      <tbody>${res.novos.map((p) => `<tr class="border-t"><td class="p-2">${esc(p.nome)}</td><td class="p-2">${p.genero === 'F' ? 'Irmã' : 'Irmão'}</td><td class="p-2">${esc(p.telefone || '—')}</td><td class="p-2">${esc(p.pontosVoto.join(', ') || 'Todos')}</td><td class="p-2">${p.requerTrio ? 'Sim' : '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    ${lista('Com erro (corrija e veja a prévia de novo)', res.erros, 'text-red-700')}
    ${lista('Ignorados', res.ignorados, 'text-slate-600')}
    ${!res.novos.length && !res.erros.length && !res.ignorados.length ? '<p class="text-sm text-slate-500">Nenhuma linha encontrada.</p>' : ''}
    ${res.novos.length ? `<button class="bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold" data-acao="confirmar-importacao">Cadastrar ${res.novos.length} publicador(es)</button>` : ''}`;
}

export async function confirmarImportacao() {
  const novos = estado.importacao?.novos || [];
  if (!novos.length) return;
  let feitos = 0;
  const ok = await tentar(async () => {
    for (const p of novos) { await estado.backend.salvarPublicador(p); feitos += 1; }
  }, `${novos.length} publicador(es) cadastrado(s).`);
  if (feitos) {
    registrar({ area: 'publicadores', acao: 'Importou publicadores', detalhe: `${feitos} cadastrado(s): ${novos.slice(0, feitos).map((p) => p.nome).join(', ')}` });
    estado.pubs = await estado.backend.listarPublicadores();
  }
  if (ok) { fecharModal(); renderAba(); }
}

export async function baixarModeloImportacao() {
  if (!(await carregarExcel())) return toast('A biblioteca do Excel não carregou. Verifique a internet.', 'erro');
  const ws = XLSX.utils.aoa_to_sheet(linhasDoModelo(estado.config.pontos || []));
  COLUNAS.forEach((_, c) => { const k = XLSX.utils.encode_cell({ r: 0, c }); if (ws[k]) ws[k].s = ESTILOS.cabecalho; });
  ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 32 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Publicadores');
  XLSX.writeFile(wb, 'Modelo - importar publicadores.xlsx');
}

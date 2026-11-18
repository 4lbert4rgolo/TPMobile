// Privacidade, backup e limpeza de dados antigos.
// - A tela de privacidade explica, em linguagem simples, o que o app guarda e por quanto tempo.
// - O backup baixa um arquivo .json com tudo que importa (só o administrador vê).
// - A limpeza apaga enquetes antigas SOMENTE quando o administrador pede; nada é apagado sozinho.

import { toISO } from './escala.js';
import { MESES_DE_RETENCAO, enquetesAntigas } from './retencao.js';
import { abrirModal, ehAdmin, esc, estado, fecharModal, tentar, toast } from './nucleo.js';

/* ------------------------------------------------------------ privacidade */

export function abrirPrivacidade() {
  const admin = ehAdmin();
  abrirModal(`
    <div class="flex items-start justify-between gap-3 mb-3">
      <h2 class="text-lg font-bold">Privacidade e dados</h2>
      <button class="px-2 text-slate-500" data-acao="fechar-modal" aria-label="Fechar">✕</button>
    </div>
    <div class="space-y-3 text-sm text-slate-700">
      <p>Este aplicativo ajuda a organizar a escala dos carrinhos da congregação. Ele guarda só o necessário para isso.</p>
      <div>
        <h3 class="font-semibold text-slate-900">O que fica guardado</h3>
        <ul class="list-disc pl-5 space-y-1">
          <li>Nome, gênero e regras de participação de cada publicador.</li>
          <li>Telefone (opcional), usado só para abrir uma conversa no WhatsApp.</li>
          <li>Os horários em que cada pessoa votou e a escala montada.</li>
          <li>Nome e e-mail de quem criou uma conta, e o perfil de acesso.</li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold text-slate-900">Quem vê o quê</h3>
        <ul class="list-disc pl-5 space-y-1">
          <li>Quem só vota enxerga o próprio voto e a escala depois de publicada.</li>
          <li>Servos ministeriais e anciãos veem o cadastro e os votos para montar a escala.</li>
          <li>Só o administrador gerencia acessos, links pessoais e backups.</li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold text-slate-900">Por quanto tempo</h3>
        <p>Votos e escalas ficam guardados por <strong>${MESES_DE_RETENCAO} meses</strong> depois do fim da semana ou do evento. Depois disso, o administrador apaga os dados antigos por esta tela. Nada é apagado automaticamente.</p>
      </div>
      <div>
        <h3 class="font-semibold text-slate-900">Seus direitos</h3>
        <p>Qualquer pessoa pode pedir ao administrador para corrigir ou remover os próprios dados, inclusive o telefone.</p>
      </div>
      <p class="text-xs text-slate-500">Os dados ficam no Firebase (Google), com regras de acesso aplicadas no servidor. Os dados não são vendidos nem usados para outra finalidade.</p>
    </div>
    ${admin ? htmlDadosAdmin() : ''}
    <div class="mt-4 text-right"><button class="px-4 py-2 rounded-lg bg-slate-200 text-sm font-semibold" data-acao="fechar-modal">Fechar</button></div>
  `, 'max-w-xl');
  if (admin) atualizarResumoLimpeza();
}

function htmlDadosAdmin() {
  return `
    <div class="mt-5 border-t pt-4 space-y-3 text-sm">
      <h3 class="font-semibold text-slate-900">Dados (só administrador)</h3>
      <div class="bg-slate-50 rounded-lg p-3">
        <p class="font-semibold">Backup</p>
        <p class="text-slate-700 mb-2">Baixa um arquivo com publicadores, enquetes, votos, escalas e usuários. O arquivo tem nomes e telefones: guarde em local seguro. Os links pessoais não entram (podem ser gerados de novo).</p>
        <button class="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="backup">Baixar backup</button>
      </div>
      <div class="bg-amber-50 rounded-lg p-3">
        <p class="font-semibold">Dados antigos (mais de ${MESES_DE_RETENCAO} meses)</p>
        <p id="resumo-limpeza" class="text-amber-900 mb-2">Verificando…</p>
        <button id="btn-limpeza" class="px-3 py-2 rounded-lg bg-red-600 text-white font-semibold" data-acao="limpar-antigos" disabled>Apagar dados antigos</button>
      </div>
    </div>`;
}

async function atualizarResumoLimpeza() {
  const resumo = document.getElementById('resumo-limpeza');
  const botao = document.getElementById('btn-limpeza');
  if (!resumo) return;
  try {
    const lista = enquetesAntigas(await estado.backend.listarEnquetes());
    if (!lista.length) {
      resumo.textContent = 'Nenhuma enquete antiga para apagar.';
      return;
    }
    resumo.textContent = `${lista.length} enquete(s) antiga(s): ${lista.map((e) => e.titulo).join(', ')}. O backup é baixado antes de apagar.`;
    if (botao) botao.disabled = false;
  } catch (e) {
    console.error(e);
    resumo.textContent = 'Não foi possível verificar agora.';
  }
}

/* ------------------------------------------------------------ backup */

/** Junta tudo em um objeto simples, pronto para virar JSON. */
export async function montarBackup(backend = estado.backend) {
  const [publicadores, config, enquetes, usuarios] = await Promise.all([
    backend.listarPublicadores(), backend.getConfig(), backend.listarEnquetes(), backend.listarUsuarios(),
  ]);
  const padroes = [];
  for (const p of publicadores) {
    const padrao = await backend.getPadrao(p.id);
    if (padrao) padroes.push({ publicadorId: p.id, ...padrao });
  }
  const dadosEnquetes = [];
  for (const e of enquetes) {
    dadosEnquetes.push({ enquete: e, votos: await backend.listarVotos(e.id), escala: await backend.getEscala(e.id) });
  }
  return {
    app: 'TPMobile',
    geradoEm: new Date().toISOString(),
    observacao: 'Contém nomes e telefones. Guarde em local seguro. Links pessoais não estão incluídos.',
    publicadores,
    config,
    costumes: padroes,
    enquetes: dadosEnquetes,
    usuarios: usuarios.map(({ id, nome, email, papel, publicadorId }) => ({ id, nome, email, papel, publicadorId })),
  };
}

export function baixarArquivo(nome, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function baixarBackup() {
  if (!ehAdmin()) return toast('Só o administrador pode baixar o backup.', 'erro');
  const dados = await tentar(() => montarBackup());
  if (!dados) return false;
  const hoje = toISO(new Date());
  baixarArquivo(`tpmobile-backup-${hoje}.json`, JSON.stringify(dados, null, 2));
  toast('Backup baixado.');
  return true;
}

/* ------------------------------------------------------------ limpeza */

export async function limparDadosAntigos() {
  if (!ehAdmin()) return toast('Só o administrador pode apagar dados.', 'erro');
  const antigas = enquetesAntigas(await estado.backend.listarEnquetes());
  if (!antigas.length) return toast('Nenhuma enquete antiga para apagar.');
  const nomes = antigas.map((e) => `• ${e.titulo}`).join('\n');
  if (!confirm(`Apagar ${antigas.length} enquete(s) com mais de ${MESES_DE_RETENCAO} meses, com os votos e a escala de cada uma?\n\n${nomes}\n\nUm backup será baixado antes. Isso não tem volta.`)) return;
  if (!(await baixarBackup())) return; // sem backup, não apaga
  const ok = await tentar(async () => { for (const e of antigas) await estado.backend.excluirEnquete(e.id); }, `${antigas.length} enquete(s) apagada(s).`);
  if (ok) { fecharModal(); abrirPrivacidade(); }
}

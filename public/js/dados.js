// Privacidade, backup e limpeza de dados antigos.
// - A tela de privacidade explica, em linguagem simples, o que o app guarda e por quanto tempo.
// - O backup baixa um arquivo .json com tudo que importa (só o administrador vê).
// - A limpeza apaga enquetes antigas SOMENTE quando o administrador pede; nada é apagado sozinho.

import { toISO } from './escala.js';
import { MESES_DE_RETENCAO, enquetesAntigas } from './retencao.js';
import { $, SEM_ACESSO, abrirModal, ehAdmin, erroAmigavel, esc, estado, fecharModal, tentar, toast } from './nucleo.js';
import { registrar } from './telaAuditoria.js';
import { renderApp } from './shell.js';

/* ------------------------------------------------------------ privacidade */

/** Versão do aviso de privacidade (gravada junto com o aceite de cada pessoa). */
export const VERSAO_PRIVACIDADE = 1;

/** Texto do aviso: usado na tela de aceite do primeiro acesso e em Menu > Privacidade e dados. */
export function htmlTextoPrivacidade() {
  return `<div class="space-y-3 text-sm text-slate-700">
      <p>Este aplicativo ajuda a organizar a escala dos carrinhos da congregação. Ele guarda só o necessário para isso.</p>
      <div>
        <h3 class="font-semibold text-slate-900">O que fica guardado</h3>
        <ul class="list-disc pl-5 space-y-1">
          <li>Nome, gênero e regras de participação de cada publicador.</li>
          <li>Telefone (opcional), usado só para abrir uma conversa no WhatsApp.</li>
          <li>Os horários em que cada pessoa votou, os pedidos de troca e a escala montada.</li>
          <li>Nome e e-mail de quem criou uma conta, o perfil de acesso e a data em que aceitou este aviso.</li>
          <li>Um registro de quem alterou escalas, enquetes, cadastros e acessos, e quando (auditoria).</li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold text-slate-900">Quem vê o quê</h3>
        <ul class="list-disc pl-5 space-y-1">
          <li>Quem só vota enxerga o próprio voto, os próprios pedidos de troca e a escala depois de publicada.</li>
          <li>Servos ministeriais e administradores veem o cadastro, os votos e a auditoria para montar e acompanhar a escala.</li>
          <li>Só o administrador gerencia acessos, links pessoais e backups.</li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold text-slate-900">Por quanto tempo</h3>
        <p>Votos, escalas, pedidos de troca e registros de auditoria ficam guardados por <strong>${MESES_DE_RETENCAO} meses</strong>. Depois disso, o administrador apaga os dados antigos. Uma cópia de segurança diária fica no Google Drive do administrador por 90 dias.</p>
      </div>
      <div>
        <h3 class="font-semibold text-slate-900">Seus direitos</h3>
        <p>Qualquer pessoa pode pedir ao administrador para corrigir ou remover os próprios dados, inclusive o telefone.</p>
      </div>
      <p class="text-xs text-slate-500">Os dados ficam no Firebase (Google), com regras de acesso aplicadas no servidor. Os dados não são vendidos nem usados para outra finalidade.</p>
    </div>`;
}

/** Tela do primeiro acesso: a pessoa só usa o app depois de confirmar que leu o aviso. */
export function telaAceitePrivacidade() {
  return `<div class="bg-white rounded-2xl shadow p-6 max-w-2xl mx-auto">
    <h2 class="text-lg font-bold mb-1">Antes de começar: privacidade</h2>
    <p class="text-sm text-slate-600 mb-4">Leia como os seus dados são usados. Você só precisa confirmar uma vez.</p>
    ${htmlTextoPrivacidade()}
    <label class="flex items-start gap-3 mt-5 bg-slate-50 rounded-lg p-3 text-sm font-medium">
      <input type="checkbox" id="aceite-privacidade" class="mt-1">
      <span>Li e concordo com o uso dos meus dados para organizar a escala dos carrinhos, como descrito acima.</span>
    </label>
    <div class="flex flex-wrap gap-2 mt-4">
      <button class="bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold" data-acao="aceitar-privacidade">Confirmar e continuar</button>
      <button class="bg-slate-200 rounded-lg px-5 py-2 font-semibold" data-acao="sair">Sair</button>
    </div>
  </div>`;
}

export async function aceitarPrivacidade() {
  if (!$('#aceite-privacidade')?.checked) return toast('Marque a caixa "Li e concordo" para continuar.', 'erro');
  try {
    await estado.backend.aceitarPrivacidade(estado.perfil.uid, VERSAO_PRIVACIDADE);
  } catch (e) {
    console.error(e);
    // Proteção: se as regras novas do Firestore ainda não foram publicadas, o servidor recusa
    // a gravação. Nesse caso a pessoa segue usando o app e o aviso aparece de novo no próximo acesso.
    if (!String(e?.code || '').includes('permission-denied')) return toast(erroAmigavel(e), 'erro');
    toast('Obrigado! (O aceite será gravado no próximo acesso.)');
  }
  estado.perfil = { ...estado.perfil, privacidadeAceitaEm: new Date().toISOString(), privacidadeVersao: VERSAO_PRIVACIDADE };
  if (!SEM_ACESSO.includes(estado.perfil.papel)) registrar({ area: 'privacidade', acao: 'Aceitou o aviso de privacidade', detalhe: `versão ${VERSAO_PRIVACIDADE}` });
  renderApp();
}

export function abrirPrivacidade() {
  const admin = ehAdmin();
  abrirModal(`
    <div class="flex items-start justify-between gap-3 mb-3">
      <h2 class="text-lg font-bold">Privacidade e dados</h2>
      <button class="px-2 text-slate-500" data-acao="fechar-modal" aria-label="Fechar">✕</button>
    </div>
    ${htmlTextoPrivacidade()}
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
  registrar({ area: 'dados', acao: 'Baixou o backup' });
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
  let apagadosAuditoria = 0;
  const ok = await tentar(async () => {
    for (const e of antigas) await estado.backend.excluirEnquete(e.id);
    // A auditoria segue a mesma regra: registros com mais de 3 meses saem.
    const limite = new Date();
    limite.setMonth(limite.getMonth() - MESES_DE_RETENCAO);
    apagadosAuditoria = await estado.backend.apagarAuditoriaAntes(limite.toISOString());
  }, `${antigas.length} enquete(s) apagada(s).`);
  if (ok) {
    registrar({ area: 'dados', acao: 'Apagou os dados antigos', detalhe: `${antigas.map((e) => e.titulo).join(', ')} · ${apagadosAuditoria} registro(s) de auditoria` });
    fecharModal(); abrirPrivacidade();
  }
}

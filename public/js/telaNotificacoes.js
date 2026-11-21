// Tela "Avisos no celular": ativar e desativar as notificações neste aparelho.
// A lógica fica em notificacoes.js; aqui só os textos, os botões e a faixa de convite.

import { $, abrirModal, ehAdmin, estado, fecharModal, gravarPref, lerPref, toast } from './nucleo.js';
import { ehIOS, emModoApp } from './instalar.js';
import { chaveNotificacoes } from './firebase-config.js';
import { suporte, ativar, desativar, renovar, tokenGuardado } from './notificacoes.js';

/** Na demonstração não há chave de verdade: usa uma de mentira para dar para testar a tela. */
export const chave = () => (estado.backend?.modo === 'demo' ? 'demo' : chaveNotificacoes);
const situacao = () => suporte({ chave: chave(), ios: ehIOS(), instalado: emModoApp(), tokenGuardado: tokenGuardado() });

/** Faixa de convite, mostrada uma vez até a pessoa ativar ou tocar em "Agora não". */
export function faixaNotificacoes() {
  if (lerPref('avisos-dispensado') || situacao() !== 'pode-ativar') return '';
  return `<div class="faixa-avisos" id="faixa-avisos" role="region" aria-label="Avisos no celular">
    <span>🔔 <strong>Receber avisos no celular?</strong> Nova enquete, sua escala e trocas chegam na barra de notificação.</span>
    <span class="faixa-avisos-botoes">
      <button class="bg-blue-600 text-white rounded-lg px-3 py-1 text-sm font-semibold" data-acao="ativar-avisos">Ativar</button>
      <button class="text-sm underline" data-acao="dispensar-avisos">Agora não</button>
    </span>
  </div>`;
}

export function dispensarFaixa() {
  gravarPref('avisos-dispensado', '1');
  $('#faixa-avisos')?.remove();
}

const TEXTOS = {
  'sem-config': () => (ehAdmin()
    ? 'Os avisos ainda não foram configurados. Falta colar a "chave de notificações" no arquivo <code>firebase-config.js</code> (veja docs/NOTIFICACOES.md).'
    : 'Os avisos ainda não estão disponíveis. Fale com o administrador.'),
  'ios-instalar': () => 'No iPhone, os avisos só funcionam com o app instalado na tela de início (iOS 16.4 ou mais novo). Instale pelo Safari: Compartilhar > <strong>Adicionar à Tela de Início</strong>, abra pelo ícone e volte aqui.',
  'sem-suporte': () => 'Este navegador não recebe notificações. No Android, use o Chrome ou o app do TPMobile.',
  bloqueado: () => 'As notificações foram <strong>bloqueadas</strong> neste aparelho. Para liberar: toque no cadeado ao lado do endereço (ou nas configurações do app) > Permissões > Notificações > Permitir. Depois volte aqui.',
  ativo: () => 'Os avisos estão <strong>ativos</strong> neste aparelho. Você recebe: nova enquete, lembrete de votar, sua escala publicada e trocas.',
  'pode-ativar': () => 'Receba na barra de notificação: <strong>nova enquete</strong>, <strong>lembrete de votar</strong>, <strong>sua escala</strong> quando for publicada e avisos de <strong>troca</strong>. Pode desligar quando quiser.',
};

export function abrirAvisos() {
  const s = situacao();
  const botao = s === 'ativo'
    ? '<button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="desativar-avisos">Desativar neste aparelho</button>'
    : s === 'pode-ativar' ? '<button class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="ativar-avisos">Ativar avisos</button>' : '';
  abrirModal(`<h2 class="font-bold mb-2">🔔 Avisos no celular</h2>
    <p class="text-sm text-slate-700">${TEXTOS[s]()}</p>
    <p class="text-xs text-slate-500 mt-2">Os avisos podem levar alguns minutos para chegar. Cada aparelho ativa separado.</p>
    <div class="flex justify-end gap-2 mt-4">${botao}<button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Fechar</button></div>`);
}

export async function ativarAvisos() {
  try {
    const r = await ativar(estado.backend, chave(), estado.perfil.uid);
    if (r === 'negado') {
      toast('Você não permitiu as notificações. Dá para liberar depois nas configurações do navegador.', 'erro');
    } else {
      toast('Pronto! Os avisos vão chegar neste aparelho.');
    }
  } catch (e) {
    console.error(e);
    toast('Não foi possível ativar os avisos agora. Tente de novo mais tarde.', 'erro');
  }
  dispensarFaixa();
  fecharModal();
}

export async function desativarAvisos() {
  await desativar(estado.backend);
  toast('Avisos desligados neste aparelho.');
  fecharModal();
}

/** Ao entrar no app: renova o token sem perguntar nada (só se já estava ativo). */
export const renovarAvisos = () => renovar(estado.backend, chave(), estado.perfil?.uid);

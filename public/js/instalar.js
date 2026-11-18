import { $, abrirModal } from './nucleo.js';

/* ============================================================ app instalável */

export let eventoInstalar = null;
export const emModoApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const podeInstalar = () => !emModoApp() && Boolean(eventoInstalar || ehIOS());
export const botaoInstalar = (classes) => `<button class="${classes}" data-acao="instalar" ${podeInstalar() ? '' : 'hidden'}>📲 Instalar app</button>`;
export const atualizarBotaoInstalar = () => document.querySelectorAll('[data-acao=instalar]').forEach((b) => { b.hidden = !podeInstalar(); });

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; atualizarBotaoInstalar(); });
window.addEventListener('appinstalled', () => { eventoInstalar = null; atualizarBotaoInstalar(); });

export function instrucoesDeInstalacao() {
  const passos = ehIOS()
    ? `<li>Abra este endereço no <strong>Safari</strong>.</li>
       <li>Toque no botão <strong>Compartilhar</strong> (o quadrado com uma seta para cima).</li>
       <li>Role e toque em <strong>Adicionar à Tela de Início</strong>, e depois em <strong>Adicionar</strong>.</li>
       <li>Para entrar no app instalado: copie a mensagem que tem o seu link (segure o dedo nela e toque em Copiar), abra o app pelo ícone e cole o link no campo <strong>"Recebeu um link pessoal?"</strong>.</li>`
    : `<li>Toque no menu do navegador (os três pontinhos).</li>
       <li>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
       <li>Confirme. O ícone aparece na tela do celular.</li>`;
  abrirModal(`<h2 class="font-bold mb-2">Instalar o app</h2>
    <ol class="list-decimal ml-5 space-y-2 text-sm text-slate-700">${passos}</ol>
    <div class="flex justify-end mt-4"><button class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="fechar-modal">Entendi</button></div>`);
}

export async function instalarApp() {
  if (!eventoInstalar) return instrucoesDeInstalacao();
  eventoInstalar.prompt();
  const { outcome } = await eventoInstalar.userChoice;
  if (outcome === 'accepted') eventoInstalar = null;
  atualizarBotaoInstalar();
}

/** Pede ao navegador para não apagar o login guardado quando faltar espaço. */
export function pedirArmazenamentoPersistente() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* sem suporte */ }
}

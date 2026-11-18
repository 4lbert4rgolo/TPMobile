import { ORGANIZADORES } from './data.js';

/* ============================================================ utilidades */

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const STATUS = {
  rascunho: ['Rascunho', 'bg-slate-200 text-slate-700'],
  aberta: ['Votação aberta', 'bg-green-100 text-green-800'],
  fechada: ['Votação encerrada', 'bg-amber-100 text-amber-800'],
  publicada: ['Escala publicada', 'bg-blue-100 text-blue-800'],
};

export const estado = {
  backend: null,
  perfil: null,
  pubs: [],
  config: null,
  enquetes: [],
  aba: null,
  enqueteId: null,
  ponto: null,
  voto: null,
  ed: null,
  escala: null,
  votos: [],
  usuarios: [],
  convites: [],
  avisoLink: null,
  menuAberto: false,
};

export const SEM_ACESSO = ['pendente', 'removido'];
export const lerPref = (k) => { try { return localStorage.getItem(`tp:pref:${k}`); } catch { return null; } };
export const gravarPref = (k, v) => { try { localStorage.setItem(`tp:pref:${k}`, v); } catch { /* sem armazenamento */ } };
export const fonteGrande = () => document.documentElement.classList.contains('fonte-grande');
export const rotuloFonte = () => (fonteGrande() ? 'A− Letras normais' : 'A+ Letras maiores');
export const tokenDoLink = () => (/^#convite-([a-f0-9]{32})$/.exec(location.hash) || [])[1] || null;

export const ehOrganizador = () => ORGANIZADORES.includes(estado.perfil?.papel);
export const ehAdmin = () => estado.perfil?.papel === 'admin';
export const enqueteAtual = () => estado.enquetes.find((e) => e.id === estado.enqueteId) || null;
export const pubPorId = (id) => estado.pubs.find((p) => p.id === id) || null;

export function toast(msg, tipo = 'ok') {
  const cor = tipo === 'erro' ? 'bg-red-600' : 'bg-slate-800';
  const el = document.createElement('div');
  el.className = `${cor} text-white text-sm px-4 py-2 rounded-lg shadow-lg`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function abrirModal(html, largura = 'max-w-lg') {
  $('#modal').innerHTML = `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-acao="fechar-modal-fundo">
      <div class="bg-white rounded-xl shadow-xl w-full ${largura} max-h-[90vh] overflow-y-auto p-5" role="dialog" aria-modal="true">${html}</div>
    </div>`;
}
export const fecharModal = () => { $('#modal').innerHTML = ''; };

export function erroAmigavel(e) {
  const c = String(e?.code || '');
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'E-mail ou senha incorretos.';
  if (c.includes('email-already-in-use')) return 'Já existe uma conta com este e-mail.';
  if (c.includes('weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (c.includes('invalid-email')) return 'E-mail inválido.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (c.includes('network')) return 'Sem conexão. Verifique a internet.';
  if (c.includes('permission-denied')) return 'Você não tem permissão para esta ação.';
  return 'Não foi possível concluir. Tente novamente.';
}

export async function tentar(acao, mensagemOk) {
  try {
    const r = await acao();
    if (mensagemOk) toast(mensagemOk);
    return r ?? true;
  } catch (e) {
    console.error(e);
    toast(erroAmigavel(e), 'erro');
    return false;
  }
}

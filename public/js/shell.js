import { renderEnquetes } from './enquetes.js';
import { botaoInstalar } from './instalar.js';
import { renderLinks } from './links.js';
import { $, SEM_ACESSO, ehOrganizador, erroAmigavel, esc, estado, rotuloFonte } from './nucleo.js';
import { renderPublicadores } from './publicadores.js';
import { faixaDemo, telaPendente } from './sessao.js';
import { renderEscala } from './telaEscala.js';
import { renderUsuarios } from './usuarios.js';
import { renderVotar } from './votar.js';
import { renderVotos } from './votos.js';
import { PAPEIS, ORGANIZADORES } from './data.js';

/* ============================================================ estrutura da tela */

export function abasDoPerfil() {
  const papel = estado.perfil.papel;
  if (SEM_ACESSO.includes(papel)) return [];
  const abas = [['votar', 'Votar'], ['escala', 'Escala']];
  if (ORGANIZADORES.includes(papel)) abas.push(['enquetes', 'Enquetes'], ['votos', 'Votos'], ['publicadores', 'Publicadores']);
  if (papel === 'admin') abas.push(['usuarios', 'Usuários'], ['links', 'Links de acesso']);
  return abas;
}

export function renderApp() {
  const p = estado.perfil;
  if (!estado.aba) estado.aba = ehOrganizador() ? 'enquetes' : 'votar';
  const abas = abasDoPerfil();

  $('#app').innerHTML = `
    ${faixaDemo()}
    <header class="bg-blue-700 text-white">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <img src="icons/icon-192.png?v=27" alt="" width="40" height="40" style="border-radius:10px">
          <div>
            <h1 class="font-bold leading-tight">Gestor de Escalas de Carrinho</h1>
            <p class="text-xs text-blue-100">Testemunho Público</p>
          </div>
        </div>
        <div class="text-right text-sm">
          <p class="font-semibold">${esc(p.nome)}</p>
          <p class="text-xs text-blue-100">${esc(PAPEIS[p.papel] || p.papel)}</p>
          ${botaoInstalar('text-xs underline mr-3')}
          <button class="text-xs underline mr-3" data-acao="fonte">${rotuloFonte()}</button>
          <button class="text-xs underline" data-acao="sair">Sair</button>
        </div>
      </div>
    </header>
    <main class="max-w-6xl mx-auto p-4 sm:p-6">
      ${SEM_ACESSO.includes(p.papel) ? telaPendente() : `
        <nav class="flex flex-wrap gap-2 mb-5" aria-label="Seções">
          ${abas.map(([id, rotulo]) => `<button class="px-4 py-2 rounded-lg text-sm font-semibold ${estado.aba === id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border'}" data-acao="aba" data-id="${id}">${rotulo}</button>`).join('')}
        </nav>
        <div id="conteudo"></div>`}
    </main>
    <footer class="text-center text-xs text-slate-400 py-6">© 2026 TPMobile</footer>`;

  if (!SEM_ACESSO.includes(p.papel)) renderAba();
}

export async function renderAba() {
  const c = $('#conteudo');
  if (!c) return;
  c.innerHTML = '<p class="text-slate-500">Carregando…</p>';
  try {
    const telas = { votar: renderVotar, escala: renderEscala, enquetes: renderEnquetes, votos: renderVotos, publicadores: renderPublicadores, usuarios: renderUsuarios, links: renderLinks };
    await telas[estado.aba]();
  } catch (e) {
    console.error(e);
    c.innerHTML = `<p class="text-red-600">${esc(erroAmigavel(e))}</p>`;
  }
}

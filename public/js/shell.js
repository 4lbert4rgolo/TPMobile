import { renderEnquetes } from './enquetes.js';
import { faixaNotificacoes } from './telaNotificacoes.js';
import { botaoInstalar } from './instalar.js';
import { renderLinks } from './links.js';
import { $, SEM_ACESSO, ehOrganizador, erroAmigavel, esc, estado, rotuloFonte } from './nucleo.js';
import { renderPublicadores } from './publicadores.js';
import { faixaDemo, telaPendente } from './sessao.js';
import { renderEscala } from './telaEscala.js';
import { renderMinha } from './telaMinha.js';
import { renderPontos } from './telaPontos.js';
import { renderAuditoria } from './telaAuditoria.js';
import { telaAceitePrivacidade } from './dados.js';
import { renderUsuarios } from './usuarios.js';
import { renderVotar } from './votar.js';
import { renderVotos } from './votos.js';
import { renderInicio } from './telaInicio.js';
import { PAPEIS, ORGANIZADORES } from './data.js';
import { ICONES, gruposDoMenu, itensBarra, textoContador, calcularContadores } from './menu.js';

/* ============================================================ estrutura da tela */

export function abasDoPerfil() {
  const papel = estado.perfil.papel;
  if (SEM_ACESSO.includes(papel) || !estado.perfil.privacidadeAceitaEm) return [];
  const abas = [['inicio', 'Início'], ['votar', 'Votar'], ['escala', 'Escala']];
  if (estado.perfil.publicadorId) abas.push(['minha', 'Minha escala']);
  if (ORGANIZADORES.includes(papel)) abas.push(['enquetes', 'Enquetes'], ['votos', 'Votos'], ['publicadores', 'Publicadores'], ['pontos', 'Pontos']);
  if (papel === 'admin') abas.push(['usuarios', 'Usuários'], ['links', 'Links de acesso'], ['auditoria', 'Auditoria']);
  return abas;
}

/** Painel do menu hambúrguer: seções, preferências e saída. Fica fora da tela principal para abrir sem recarregá-la. */
export function htmlMenu(abas) {
  const p = estado.perfil;
  // Seções agrupadas por assunto, com ícone e, quando houver, o contador de pendências.
  const itens = gruposDoMenu(abas).map(([titulo, lista]) => `<p class="menu-titulo">${titulo}</p>${lista.map(([id, rotulo]) => `
    <button class="menu-item ${estado.aba === id ? 'ativo' : ''}" data-acao="aba" data-id="${id}" ${estado.aba === id ? 'aria-current="page"' : ''}>
      <span class="menu-icone" aria-hidden="true">${ICONES[id] || '•'}</span><span class="menu-rotulo">${rotulo}</span>${contador(id)}
    </button>`).join('')}`).join('');
  return `
    <div class="menu-fundo" data-acao="fechar-menu-fundo">
      <nav class="menu-painel" id="menu-painel" aria-label="Menu principal">
        <div class="menu-topo">
          <div>
            <p class="font-semibold">${esc(p.nome)}</p>
            <p class="text-xs text-slate-500">${esc(PAPEIS[p.papel] || p.papel)}</p>
          </div>
          <button class="menu-fechar" data-acao="fechar-menu" aria-label="Fechar menu">✕</button>
        </div>
        ${itens}
        <p class="menu-titulo">Preferências</p>
        ${botaoInstalar('menu-item')}
        <button class="menu-item" data-acao="abrir-avisos"><span class="menu-icone" aria-hidden="true">🔔</span>Avisos no celular</button>
        <button class="menu-item" data-acao="fonte">${rotuloFonte()}</button>
        <p class="menu-titulo">Sobre</p>
        <button class="menu-item" data-acao="privacidade"><span class="menu-icone" aria-hidden="true">🔒</span>Privacidade e dados</button>
        <div class="menu-fim"><button class="menu-item menu-sair" data-acao="sair"><span class="menu-icone" aria-hidden="true">🚪</span>Sair</button></div>
      </nav>
    </div>`;
}

export function renderApp() {
  const p = estado.perfil;
  // Ao tocar numa notificação, o app abre com "?aba=minha" (ou outra aba) no endereço.
  const pedida = new URLSearchParams(location.search).get('aba');
  if (pedida) {
    if (abasDoPerfil().some(([id]) => id === pedida)) estado.aba = pedida;
    history.replaceState(null, '', location.pathname + location.hash);
  }
  if (!estado.aba) estado.aba = 'inicio';
  estado.menuAberto = false;
  const abas = abasDoPerfil();
  const nomeAba = (abas.find(([id]) => id === estado.aba) || [])[1] || '';

  $('#app').innerHTML = `
    ${faixaDemo()}
    <header class="bg-blue-700 text-white">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <img src="icons/icon-192.png?v=27" alt="" width="40" height="40" style="border-radius:10px">
          <div class="min-w-0">
            <h1 class="font-bold leading-tight">Gestor de Escalas de Carrinho</h1>
            <p class="text-xs text-blue-100">Testemunho Público${nomeAba ? ` · ${esc(nomeAba)}` : ''}</p>
          </div>
        </div>
        <button class="botao-menu" data-acao="menu" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu-painel">
          <span class="botao-menu-barras" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="botao-menu-texto">Menu</span>
        </button>
      </div>
    </header>
    <div id="faixa-offline" class="faixa-offline" ${navigator.onLine ? 'hidden' : ''} role="status">
      <strong>Sem internet.</strong> Você está vendo a última versão salva neste aparelho. Votos ficam guardados e são enviados quando a conexão voltar; mudanças na escala precisam de internet.
    </div>
    <div id="menu"></div>
    <main class="max-w-6xl mx-auto p-4 sm:p-6">
      ${!p.privacidadeAceitaEm ? telaAceitePrivacidade() : SEM_ACESSO.includes(p.papel) ? telaPendente() : `${faixaNotificacoes()}<div id="conteudo"></div>`}
    </main>
    ${htmlBarra(abas)}`;
  document.body.classList.toggle('com-barra', abas.length > 0);
  atualizarContadores();

  // Primeiro acesso: só segue depois do aceite do aviso de privacidade.
  if (p.privacidadeAceitaEm && !SEM_ACESSO.includes(p.papel)) renderAba();
}

/* ============================================================ contadores e barra de baixo */

/** Contador pequeno ao lado do nome ("faltam 4"). Fica vazio (escondido) quando não há pendência. */
function contador(id) {
  const t = textoContador(id, estado.contadores?.[id]);
  return `<span class="menu-contador" data-contador="${id}" ${t ? '' : 'hidden'}>${t}</span>`;
}

/** Barra fixa embaixo (só no celular, pelo CSS): os lugares mais usados e o Menu. */
function htmlBarra(abas) {
  const itens = itensBarra(abas, ehOrganizador());
  if (!itens.length) return '';
  return `<nav class="barra-baixo" aria-label="Atalhos">
    ${itens.map(([id, rotulo]) => `<button class="barra-item ${estado.aba === id ? 'ativo' : ''}" data-acao="aba" data-id="${id}" ${estado.aba === id ? 'aria-current="page"' : ''}>
      <span class="barra-icone" aria-hidden="true">${ICONES[id]}</span><span>${rotulo}</span>
      <span class="barra-ponto" data-ponto-contador="${id}" ${estado.contadores?.[id] ? '' : 'hidden'}></span></button>`).join('')}
    <button class="barra-item" data-acao="menu" aria-label="Abrir menu"><span class="barra-icone" aria-hidden="true">☰</span><span>Menu</span></button>
  </nav>`;
}

/**
 * Busca o que falta resolver (só para organizadores) e atualiza os contadores na tela,
 * sem redesenhar nada. Se algo falhar (sem internet, por exemplo), os contadores só não aparecem.
 */
export async function atualizarContadores() {
  if (!ehOrganizador()) return;
  try {
    const b = estado.backend;
    const visiveis = (estado.enquetes || []).filter((e) => !e.arquivada);
    const aberta = visiveis.find((e) => e.status === 'aberta');
    const publicada = visiveis.find((e) => e.status === 'publicada');
    const [votosAberta, trocasPublicada, usuarios] = await Promise.all([
      aberta ? b.listarVotos(aberta.id) : null,
      publicada ? b.listarTrocas(publicada.id).catch(() => []) : [],
      estado.perfil.papel === 'admin' ? b.listarUsuarios().catch(() => null) : null,
    ]);
    estado.contadores = calcularContadores({ pubs: estado.pubs, votosAberta, trocasPublicada, usuarios });
    for (const [id, n] of Object.entries(estado.contadores)) {
      document.querySelectorAll(`[data-contador="${id}"]`).forEach((el) => { el.textContent = textoContador(id, n); el.hidden = !n; });
      document.querySelectorAll(`[data-ponto-contador="${id}"]`).forEach((el) => { el.hidden = !n; });
    }
  } catch (e) {
    console.warn('Contadores do menu:', e);
  }
}

export function abrirMenu() {
  estado.menuAberto = true;
  $('#menu').innerHTML = htmlMenu(abasDoPerfil());
  document.querySelector('[data-acao=menu]')?.setAttribute('aria-expanded', 'true');
  $('#menu-painel .menu-item')?.focus();
}

export function fecharMenu() {
  if (!estado.menuAberto) return;
  estado.menuAberto = false;
  const m = $('#menu');
  if (m) m.innerHTML = '';
  const b = document.querySelector('[data-acao=menu]');
  b?.setAttribute('aria-expanded', 'false');
  b?.focus();
}

export async function renderAba() {
  const c = $('#conteudo');
  if (!c) return;
  c.innerHTML = '<p class="text-slate-500">Carregando…</p>';
  try {
    const telas = { inicio: renderInicio, votar: renderVotar, escala: renderEscala, minha: renderMinha, pontos: renderPontos, auditoria: renderAuditoria, enquetes: renderEnquetes, votos: renderVotos, publicadores: renderPublicadores, usuarios: renderUsuarios, links: renderLinks };
    await telas[estado.aba]();
  } catch (e) {
    console.error(e);
    c.innerHTML = `<p class="text-red-600">${esc(erroAmigavel(e))}</p>`;
  }
}

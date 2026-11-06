import { firebaseConfig } from './firebase-config.js';
import { criarBackendFirebase, criarBackendDemo, configurado, PAPEIS, ORGANIZADORES, CONFIG_PADRAO } from './data.js';
import {
  gerarDias, gerarEscala, validarEscala, contarParticipacoes, chave, nomeDia, dataCurta,
  parseISO, toISO, celulaBloqueada, pontosDoPublicador, REGRAS_PADRAO,
} from './escala.js';

/* ============================================================ utilidades */

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS = {
  rascunho: ['Rascunho', 'bg-slate-200 text-slate-700'],
  aberta: ['Votação aberta', 'bg-green-100 text-green-800'],
  fechada: ['Votação encerrada', 'bg-amber-100 text-amber-800'],
  publicada: ['Escala publicada', 'bg-blue-100 text-blue-800'],
};

const estado = {
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
};

const SEM_ACESSO = ['pendente', 'removido'];
const lerPref = (k) => { try { return localStorage.getItem(`tp:pref:${k}`); } catch { return null; } };
const gravarPref = (k, v) => { try { localStorage.setItem(`tp:pref:${k}`, v); } catch { /* sem armazenamento */ } };
const fonteGrande = () => document.documentElement.classList.contains('fonte-grande');
const rotuloFonte = () => (fonteGrande() ? 'A− Letras normais' : 'A+ Letras maiores');
const tokenDoLink = () => (/^#convite-([a-f0-9]{32})$/.exec(location.hash) || [])[1] || null;

const ehOrganizador = () => ORGANIZADORES.includes(estado.perfil?.papel);
const ehAdmin = () => estado.perfil?.papel === 'admin';
const enqueteAtual = () => estado.enquetes.find((e) => e.id === estado.enqueteId) || null;
const pubPorId = (id) => estado.pubs.find((p) => p.id === id) || null;

function toast(msg, tipo = 'ok') {
  const cor = tipo === 'erro' ? 'bg-red-600' : 'bg-slate-800';
  const el = document.createElement('div');
  el.className = `${cor} text-white text-sm px-4 py-2 rounded-lg shadow-lg`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function abrirModal(html, largura = 'max-w-lg') {
  $('#modal').innerHTML = `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-acao="fechar-modal-fundo">
      <div class="bg-white rounded-xl shadow-xl w-full ${largura} max-h-[90vh] overflow-y-auto p-5" role="dialog" aria-modal="true">${html}</div>
    </div>`;
}
const fecharModal = () => { $('#modal').innerHTML = ''; };

function erroAmigavel(e) {
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

async function tentar(acao, mensagemOk) {
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

/* ============================================================ início e login */

/* ============================================================ app instalável */

let eventoInstalar = null;
const emModoApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const podeInstalar = () => !emModoApp() && Boolean(eventoInstalar || ehIOS());
const botaoInstalar = (classes) => `<button class="${classes}" data-acao="instalar" ${podeInstalar() ? '' : 'hidden'}>📲 Instalar app</button>`;
const atualizarBotaoInstalar = () => document.querySelectorAll('[data-acao=instalar]').forEach((b) => { b.hidden = !podeInstalar(); });

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; atualizarBotaoInstalar(); });
window.addEventListener('appinstalled', () => { eventoInstalar = null; atualizarBotaoInstalar(); });

function instrucoesDeInstalacao() {
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

async function instalarApp() {
  if (!eventoInstalar) return instrucoesDeInstalacao();
  eventoInstalar.prompt();
  const { outcome } = await eventoInstalar.userChoice;
  if (outcome === 'accepted') eventoInstalar = null;
  atualizarBotaoInstalar();
}

/** Pede ao navegador para não apagar o login guardado quando faltar espaço. */
function pedirArmazenamentoPersistente() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* sem suporte */ }
}

/** Entrar colando o link pessoal (útil no app instalado do iPhone, que tem armazenamento próprio). */
async function entrarComLink() {
  const achado = /([a-f0-9]{32})/i.exec($('#colar-link').value);
  if (!achado) return toast('Não achei um link pessoal nesse texto. Cole o link inteiro que você recebeu.', 'erro');

  estado.resgatando = true;
  try {
    await estado.backend.resgatarConvite(achado[1].toLowerCase());
    estado.avisoLink = null;
  } catch (e) {
    console.error(e);
    estado.resgatando = false;
    estado.avisoLink = e.code === 'app/convite-invalido' ? 'invalido' : 'falha';
    return renderLogin();
  }
  estado.resgatando = false;
  await aoAutenticar(estado.backend.usuarioAtual());
}

async function iniciar() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  document.documentElement.classList.toggle('fonte-grande', lerPref('fonte') === 'grande');
  try {
    estado.backend = configurado(firebaseConfig) ? await criarBackendFirebase(firebaseConfig) : criarBackendDemo();
  } catch (e) {
    console.error(e);
    $('#app').innerHTML = `<p class="p-8 text-center text-red-600">Não foi possível conectar ao Firebase. Confira o arquivo firebase-config.js.</p>`;
    return;
  }

  const token = tokenDoLink();
  if (token) {
    try {
      await estado.backend.resgatarConvite(token);
    } catch (e) {
      console.error(e);
      estado.avisoLink = e.code === 'app/convite-invalido' ? 'invalido' : 'falha';
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  estado.backend.onAuth((u) => (estado.resgatando ? undefined : aoAutenticar(u)));
}

async function aoAutenticar(u) {
  if (!u) {
    estado.perfil = null;
    estado.aba = null;
    return renderLogin();
  }
  try {
    let perfil = await estado.backend.getUsuario(u.uid);
    if (!perfil && u.anonimo) {
      // Sessão de um link que foi revogado: não vale mais.
      estado.avisoLink = 'invalido';
      await estado.backend.sair();
      return;
    }
    if (!perfil) {
      await estado.backend.criarUsuarioPendente(u.uid, u.nome || u.email, u.email);
      perfil = await estado.backend.getUsuario(u.uid);
    }
    estado.perfil = { ...perfil, uid: u.uid };
    if (!SEM_ACESSO.includes(estado.perfil.papel)) await carregarBase();
    renderApp();
    pedirArmazenamentoPersistente();
  } catch (e) {
    console.error(e);
    toast(erroAmigavel(e), 'erro');
    renderLogin();
  }
}

async function carregarBase() {
  const b = estado.backend;
  const org = ehOrganizador();
  estado.config = { ...CONFIG_PADRAO, ...(await b.getConfig()) };
  estado.enquetes = await b.listarEnquetes({ somenteVisiveis: !org });

  if (org) {
    estado.pubs = await b.listarPublicadores();
  } else if (estado.perfil.publicadorId) {
    const p = await b.getPublicador(estado.perfil.publicadorId);
    estado.pubs = p ? [p] : [];
  } else {
    estado.pubs = [];
  }
}

function faixaDemo() {
  if (estado.backend?.modo !== 'demo') return '';
  return `<div class="bg-amber-100 text-amber-900 text-sm px-4 py-2 text-center">
    <strong>Modo demonstração:</strong> os dados ficam só neste navegador. Para uso real, configure o Firebase (veja docs/CONFIGURAR_FIREBASE.md).
    <button class="underline ml-2" data-acao="reiniciar-demo">Reiniciar dados de exemplo</button>
  </div>`;
}

function renderLogin(modo = 'entrar') {
  const emDemo = estado.backend?.modo === 'demo';
  const demo = emDemo && !estado.previaLogin;
  const novo = modo === 'criar';
  $('#app').innerHTML = `
    ${faixaDemo()}
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
        <div class="text-right">${botaoInstalar('text-xs underline text-slate-600 mr-3')}<button class="text-xs underline text-slate-600" data-acao="fonte">${rotuloFonte()}</button></div>
        <h1 class="text-xl font-bold text-blue-800 text-center">Gestor de Escalas de Carrinho</h1>
        <p class="text-sm text-slate-500 text-center mb-5">Testemunho Público</p>
        ${estado.avisoLink ? `<div class="bg-red-50 text-red-800 text-sm rounded-lg p-3 mb-4">${estado.avisoLink === 'invalido'
          ? 'Este link não vale mais. Peça um link novo ao administrador ou entre com e-mail e senha.'
          : 'Não foi possível abrir o link. Verifique a internet e toque no link de novo.'}</div>` : ''}

        ${demo ? `
          <p class="text-sm text-slate-600 mb-3">Escolha um perfil para ver como o app funciona:</p>
          <div class="space-y-2">
            <button class="w-full bg-blue-600 text-white rounded-lg py-2 font-semibold" data-acao="entrar-demo" data-id="admin">Entrar como Administrador</button>
            <button class="w-full bg-blue-100 text-blue-800 rounded-lg py-2 font-semibold" data-acao="entrar-demo" data-id="anciao">Entrar como Ancião</button>
            <button class="w-full bg-blue-100 text-blue-800 rounded-lg py-2 font-semibold" data-acao="entrar-demo" data-id="servo">Entrar como Servo ministerial</button>
            <button class="w-full bg-slate-100 text-slate-700 rounded-lg py-2 font-semibold" data-acao="entrar-demo" data-id="votante">Entrar como Votante</button>
          </div>
          <button class="text-sm text-blue-700 underline mt-4" data-acao="previa-login">Ver a tela de login por e-mail e senha</button>` : `
          ${emDemo ? `<div class="bg-amber-50 text-amber-900 text-sm rounded-lg p-3 mb-3">
            <strong>Prévia da tela real.</strong> É esta tela que os publicadores usam depois que o Firebase estiver configurado. Aqui, no modo demonstração, o login por e-mail não funciona.
            <button class="underline ml-1" data-acao="sair-previa">Voltar</button></div>` : ''}
          <div class="flex mb-4 border-b">
            <button class="flex-1 py-2 font-semibold ${novo ? 'text-slate-400' : 'text-blue-700 border-b-2 border-blue-700'}" data-acao="modo-login" data-id="entrar">Entrar</button>
            <button class="flex-1 py-2 font-semibold ${novo ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-400'}" data-acao="modo-login" data-id="criar">Criar conta</button>
          </div>
          <form id="form-login" class="space-y-3" novalidate>
            ${novo ? `<div><label class="text-sm font-medium" for="lg-nome">Seu nome</label>
              <input id="lg-nome" class="w-full border rounded-lg p-2" autocomplete="name" required>
              <p class="text-xs text-slate-500 mt-1">Escreva o nome como aparece na lista de publicadores. Assim fica fácil liberar o seu acesso.</p></div>` : ''}
            <div><label class="text-sm font-medium" for="lg-email">E-mail</label>
              <input id="lg-email" type="email" class="w-full border rounded-lg p-2" autocomplete="email" required></div>
            <div><label class="text-sm font-medium" for="lg-senha">Senha</label>
              <input id="lg-senha" type="password" class="w-full border rounded-lg p-2" autocomplete="${novo ? 'new-password' : 'current-password'}" required></div>
            <p id="lg-erro" class="text-sm text-red-600 hidden"></p>
            <button class="w-full bg-blue-600 text-white rounded-lg py-2 font-semibold" type="submit">${novo ? 'Criar conta' : 'Entrar'}</button>
            ${novo ? '<p class="text-xs text-slate-500">Depois de criar a conta, um administrador precisa aprovar o seu acesso.</p>'
                   : '<button type="button" class="text-sm text-blue-700 underline" data-acao="esqueci-senha">Esqueci a minha senha</button>'}
          </form>`}
        <div class="mt-5 pt-4 border-t">
          <p class="text-sm font-medium">Recebeu um link pessoal?</p>
          <p class="text-xs text-slate-500 mb-2">Toque nele de novo na mensagem. Ou cole o link aqui:</p>
          <div class="flex gap-2">
            <input id="colar-link" class="border rounded-lg p-2 text-sm flex-1" placeholder="Cole o link aqui" aria-label="Link pessoal" autocomplete="off">
            <button type="button" class="bg-slate-100 rounded-lg px-3 text-sm" data-acao="entrar-com-link">Entrar</button>
          </div>
        </div>
      </div>
    </div>`;
}

function telaPendente() {
  if (estado.perfil.papel === 'removido') {
    return `<div class="bg-white rounded-xl shadow p-6 text-center max-w-lg mx-auto mt-10">
      <h2 class="text-lg font-bold mb-2">Acesso removido</h2>
      <p class="text-slate-600">O seu acesso foi removido. Se foi engano, fale com um administrador.</p></div>`;
  }
  return `<div class="bg-white rounded-xl shadow p-6 text-center max-w-lg mx-auto mt-10">
    <h2 class="text-lg font-bold mb-2">Conta aguardando aprovação</h2>
    <p class="text-slate-600 mb-4">Seu cadastro foi recebido. Um administrador precisa liberar o seu acesso. Depois disso, entre novamente.</p>
    <button class="bg-slate-200 rounded-lg px-4 py-2" data-acao="atualizar-perfil">Já fui aprovado: atualizar</button>
  </div>`;
}

/* ============================================================ estrutura da tela */

function abasDoPerfil() {
  const papel = estado.perfil.papel;
  if (SEM_ACESSO.includes(papel)) return [];
  const abas = [['votar', 'Votar'], ['escala', 'Escala']];
  if (ORGANIZADORES.includes(papel)) abas.push(['enquetes', 'Enquetes'], ['votos', 'Votos'], ['publicadores', 'Publicadores']);
  if (papel === 'admin') abas.push(['usuarios', 'Usuários'], ['links', 'Links de acesso']);
  return abas;
}

function renderApp() {
  const p = estado.perfil;
  if (!estado.aba) estado.aba = ehOrganizador() ? 'enquetes' : 'votar';
  const abas = abasDoPerfil();

  $('#app').innerHTML = `
    ${faixaDemo()}
    <header class="bg-blue-700 text-white">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 class="font-bold leading-tight">Gestor de Escalas de Carrinho</h1>
          <p class="text-xs text-blue-100">Testemunho Público</p>
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

async function renderAba() {
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

function seletorEnquete(lista, acaoId = 'escolher-enquete') {
  if (!lista.length) return '';
  return `<div class="mb-4"><label class="text-sm font-medium" for="sel-enquete">Enquete</label>
    <select id="sel-enquete" class="border rounded-lg p-2 w-full sm:w-auto" data-acao="${acaoId}">
      ${lista.map((e) => `<option value="${esc(e.id)}" ${e.id === estado.enqueteId ? 'selected' : ''}>${esc(e.titulo)} — ${STATUS[e.status]?.[0] || e.status}</option>`).join('')}
    </select></div>`;
}

function escolherEnquetePadrao(lista) {
  if (!lista.find((e) => e.id === estado.enqueteId)) estado.enqueteId = lista[0]?.id || null;
}

/* ============================================================ votar */

async function carregarVoto(enquete, pubId) {
  const existente = await estado.backend.getVoto(enquete.id, pubId);
  estado.voto = {
    enqueteId: enquete.id,
    pubId,
    jaVotou: Boolean(existente),
    filtro: lerPref('filtro-ponto') || '',
    disp: Object.fromEntries(enquete.pontos.map((ponto) => [ponto, new Set(existente?.disponibilidade?.[ponto] || [])])),
  };
}

/** Pontos em que esta pessoa vota (todos, se não houver restrição no cadastro). */
function pontosPermitidosDoVoto() {
  return pontosDoPublicador(pubPorId(estado.voto.pubId), enqueteAtual().pontos);
}

/** Pontos mostrados agora: os permitidos, ou só o que a pessoa escolheu no filtro. */
function pontosVisiveis(enquete) {
  const permitidos = pontosDoPublicador(pubPorId(estado.voto.pubId), enquete.pontos);
  const filtro = estado.voto.filtro;
  return permitidos.length > 1 && permitidos.includes(filtro) ? [filtro] : permitidos;
}

function totalMarcado() {
  const permitidos = pontosPermitidosDoVoto();
  return Object.entries(estado.voto.disp)
    .filter(([ponto]) => permitidos.includes(ponto))
    .reduce((soma, [, conjunto]) => soma + conjunto.size, 0);
}

function htmlVoto(enquete, leitura = false) {
  const v = estado.voto;
  const aberta = enquete.status === 'aberta' && !leitura;

  const permitidos = pontosDoPublicador(pubPorId(v.pubId), enquete.pontos);
  const visiveis = pontosVisiveis(enquete);

  const nota = permitidos.length < enquete.pontos.length
    ? `<p class="text-sm text-slate-700 mb-3">Você vota ${permitidos.length === 1 ? 'apenas em' : 'em'} <strong>${permitidos.map(esc).join(' e ')}</strong>.</p>`
    : '';
  const filtro = permitidos.length > 1
    ? `<div class="flex flex-wrap items-center gap-2 mb-3"><span class="text-sm text-slate-600">Mostrar:</span>
        <button type="button" class="chip-turno" aria-pressed="${visiveis.length === permitidos.length}" data-acao="filtro-ponto" data-ponto="">Todos os pontos</button>
        ${permitidos.map((p) => `<button type="button" class="chip-turno" aria-pressed="${visiveis.length === 1 && visiveis[0] === p}" data-acao="filtro-ponto" data-ponto="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>`
    : '';

  const pontos = visiveis.map((ponto) => `
    <section class="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 class="font-bold text-blue-800">${esc(ponto)}</h3>
        ${aberta ? `<div class="flex flex-wrap gap-2 text-sm">
          <button class="px-3 py-1 rounded-lg bg-slate-100" data-acao="marcar-tudo" data-ponto="${esc(ponto)}">Marcar tudo</button>
          <button class="px-3 py-1 rounded-lg bg-slate-100" data-acao="limpar-ponto" data-ponto="${esc(ponto)}">Limpar</button>
          ${permitidos.length > 1 ? `<button class="px-3 py-1 rounded-lg bg-blue-50 text-blue-800" data-acao="copiar-ponto" data-ponto="${esc(ponto)}">Copiar para todos os pontos</button>` : ''}
        </div>` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${enquete.dias.map((dia) => {
          if (dia.ativo === false) {
            return `<div class="border rounded-lg p-3 bg-slate-50"><p class="font-semibold text-sm">${nomeDia(dia.data)} ${dataCurta(dia.data)}</p>
              <p class="text-sm text-slate-500 italic mt-1">${esc(dia.motivo || 'Sem carrinho')}</p></div>`;
          }
          return `<div class="border rounded-lg p-3"><p class="font-semibold text-sm mb-2">${nomeDia(dia.data)} ${dataCurta(dia.data)}</p>
            <div class="flex flex-wrap gap-2">
              ${enquete.turnos.map((turno) => {
                const motivo = celulaBloqueada(enquete, dia.data, turno, ponto);
                const k = chave(dia.data, turno);
                const marcado = v.disp[ponto].has(k);
                return `<button type="button" class="chip-turno" ${motivo || !aberta ? 'disabled' : ''} title="${esc(motivo || '')}"
                  aria-pressed="${marcado}" data-acao="alternar-voto" data-ponto="${esc(ponto)}" data-chave="${esc(k)}">${esc(turno)}</button>`;
              }).join('')}
            </div></div>`;
        }).join('')}
      </div>
    </section>`).join('');

  const rodape = aberta
    ? `${v.salvo ? '<div id="aviso-salvo" class="bg-green-50 text-green-800 border border-green-200 rounded-xl p-4 mb-3 font-semibold">✔ Pronto! Seus votos foram salvos. Você pode mudar até a votação encerrar.</div>' : ''}
      <div class="sticky bottom-0 bg-slate-50/95 py-3 flex flex-wrap items-center gap-3">
        <button class="bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold" data-acao="salvar-voto">Salvar meus votos</button>
        <span class="text-sm text-slate-600" id="contagem-voto">${totalMarcado()} horário(s) marcado(s)</span>
      </div>`
    : `<p class="text-sm text-slate-500">${enquete.status === 'aberta' ? '' : 'A votação desta enquete está encerrada.'}</p>`;

  return nota + filtro + pontos + rodape;
}

function renderAreaVoto() {
  const e = enqueteAtual();
  const area = $('#area-voto');
  if (e && area) area.innerHTML = htmlVoto(e);
}

async function renderVotar() {
  const c = $('#conteudo');
  const pubId = estado.perfil.publicadorId;

  if (!pubId || !pubPorId(pubId)) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6">
      <h2 class="font-bold mb-1">Sua conta ainda não está ligada a um publicador</h2>
      <p class="text-slate-600">Peça a um administrador para ligar o seu acesso ao seu nome na lista de publicadores. Depois você poderá votar.</p></div>`;
    return;
  }

  const abertas = estado.enquetes.filter((e) => e.status === 'aberta');
  if (!abertas.length) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6"><h2 class="font-bold mb-1">Nenhuma enquete aberta</h2>
      <p class="text-slate-600">Quando uma nova enquete for aberta, ela aparece aqui. Se já houver uma escala publicada, veja na aba Escala.</p></div>`;
    return;
  }

  escolherEnquetePadrao(abertas);
  const enquete = enqueteAtual();
  await carregarVoto(enquete, pubId);

  c.innerHTML = `
    <div class="mb-3">
      <p class="text-lg font-bold">Olá, ${esc((estado.perfil.nome || '').split(' ')[0])}!</p>
      <h2 class="text-base font-semibold text-blue-800">${esc(enquete.titulo)}</h2>
      <ol class="text-sm text-slate-700 list-decimal ml-5 mt-1">
        <li>Toque nos horários em que você pode participar.</li>
        <li>No final da página, toque em <strong>Salvar meus votos</strong>.</li>
      </ol>
      ${estado.voto.jaVotou ? '<p class="text-sm text-green-700 mt-1"><strong>Você já votou.</strong> Se quiser, pode mudar e salvar de novo.</p>' : ''}
    </div>
    ${seletorEnquete(abertas, 'escolher-enquete')}
    <div id="area-voto">${htmlVoto(enquete)}</div>`;
}

function alternarVoto(botao) {
  const { ponto, chave: k } = botao.dataset;
  const conjunto = estado.voto.disp[ponto];
  if (conjunto.has(k)) conjunto.delete(k); else conjunto.add(k);
  botao.setAttribute('aria-pressed', String(conjunto.has(k)));
  estado.voto.salvo = false;
  $('#aviso-salvo')?.remove();
  const contagem = $('#contagem-voto');
  if (contagem) contagem.textContent = `${totalMarcado()} horário(s) marcado(s)`;
}

function marcarPonto(ponto, marcar) {
  const e = enqueteAtual();
  const conjunto = estado.voto.disp[ponto];
  conjunto.clear();
  if (marcar) {
    for (const dia of e.dias) for (const turno of e.turnos) if (!celulaBloqueada(e, dia.data, turno, ponto)) conjunto.add(chave(dia.data, turno));
  }
  renderAreaVoto();
}

function copiarPonto(ponto) {
  const origem = estado.voto.disp[ponto];
  for (const outro of pontosPermitidosDoVoto()) if (outro !== ponto) estado.voto.disp[outro] = new Set(origem);
  estado.voto.salvo = false;
  renderAreaVoto();
  toast('Horários copiados para todos os pontos.');
}

async function salvarVoto() {
  const e = enqueteAtual();
  const v = estado.voto;
  const pub = pubPorId(v.pubId);
  const permitidos = pontosPermitidosDoVoto();
  const disponibilidade = Object.fromEntries(
    Object.entries(v.disp).filter(([ponto]) => permitidos.includes(ponto)).map(([ponto, conjunto]) => [ponto, [...conjunto]])
  );
  const ok = await tentar(() => estado.backend.salvarVoto(e.id, v.pubId, { disponibilidade, nome: pub?.nome || '' }), 'Votos salvos!');
  if (ok && $('#modal').innerHTML) { fecharModal(); renderAba(); return; }
  if (ok) {
    estado.voto.salvo = true;
    estado.voto.jaVotou = true;
    renderAreaVoto();
    $('#aviso-salvo')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/* ============================================================ votos (organizadores) */

async function renderVotos() {
  const c = $('#conteudo');
  if (!estado.enquetes.length) {
    c.innerHTML = '<p class="text-slate-600">Ainda não há enquetes. Crie uma na aba Enquetes.</p>';
    return;
  }

  escolherEnquetePadrao(estado.enquetes);
  const enquete = enqueteAtual();
  estado.votos = await estado.backend.listarVotos(enquete.id);

  const ativos = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const porPub = new Map(estado.votos.map((v) => [v.publicadorId, v]));
  const votaram = ativos.filter((p) => porPub.has(p.id)).length;

  c.innerHTML = `
    ${seletorEnquete(estado.enquetes, 'escolher-enquete')}
    <p class="mb-3 text-slate-700"><strong>${votaram} de ${ativos.length}</strong> publicadores já votaram.</p>
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left"><tr><th class="p-3">Publicador</th><th class="p-3">Situação</th><th class="p-3"></th></tr></thead>
        <tbody>
          ${ativos.map((p) => {
            const v = porPub.get(p.id);
            const perm = pontosDoPublicador(p, enquete.pontos);
            const n = v ? Object.entries(v.disponibilidade || {}).filter(([pt]) => perm.includes(pt)).reduce((s, [, l]) => s + l.length, 0) : 0;
            return `<tr class="border-t">
              <td class="p-3 font-medium">${esc(p.nome)}</td>
              <td class="p-3">${v ? `<span class="text-green-700">Votou · ${n} horário(s)</span>` : '<span class="text-slate-400">Ainda não votou</span>'}</td>
              <td class="p-3 text-right"><button class="text-blue-700 underline" data-acao="votar-por" data-id="${esc(p.id)}">${v ? 'Editar votos' : 'Lançar votos'}</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

async function votarPor(pubId) {
  const e = enqueteAtual();
  const pub = pubPorId(pubId);
  if (!e || !pub) return;
  await carregarVoto(e, pubId);
  abrirModal(`
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-bold">Votos de ${esc(pub.nome)}</h2>
      <button class="text-slate-500 text-xl leading-none" data-acao="fechar-modal" aria-label="Fechar">×</button>
    </div>
    <p class="text-sm text-slate-500 mb-3">Você está lançando os votos em nome de ${esc(pub.nome)}. ${e.status !== 'aberta' ? 'A votação está encerrada, mas você pode ajustar.' : ''}</p>
    <div id="area-voto">${htmlVoto({ ...e, status: 'aberta' })}</div>`, 'max-w-4xl');
}

/* ============================================================ publicadores */

async function renderPublicadores() {
  const c = $('#conteudo');
  const lista = [...estado.pubs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const ativos = lista.filter((p) => p.ativo !== false).length;

  c.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 class="text-lg font-bold">Publicadores <span class="text-sm font-normal text-slate-500">(${ativos} ativos)</span></h2>
      <button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold" data-acao="novo-publicador">Novo publicador</button>
    </div>
    <p class="text-sm text-slate-600 mb-3">Guarde só o necessário. "Par fixo" faz o casal participar sempre junto; "Precisa de trio" faz a equipe ter 3 pessoas (por idade ou necessidade especial).</p>
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left"><tr><th class="p-3">Nome</th><th class="p-3">Gênero</th><th class="p-3">Pontos</th><th class="p-3">Par fixo</th><th class="p-3">Trio</th><th class="p-3">Situação</th><th class="p-3"></th></tr></thead>
        <tbody>
          ${lista.map((p) => `<tr class="border-t ${p.ativo === false ? 'text-slate-400' : ''}">
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

const pontosConhecidos = () => [...new Set([...(estado.config?.pontos || []), ...estado.enquetes.flatMap((e) => e.pontos || [])])];

function formularioPublicador(id) {
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

async function salvarPublicadorForm(form) {
  const antigoId = form.dataset.id || null;
  const antigo = antigoId ? pubPorId(antigoId) : null;
  const nome = $('#pb-nome').value.trim();
  if (!nome) return toast('Informe o nome.', 'erro');
  const onde = document.querySelector('input[name=pb-onde]:checked')?.value;
  const marcados = [...document.querySelectorAll('input[name=pb-ponto]:checked')].map((i) => i.value);
  if (onde === 'alguns' && !marcados.length) return toast('Marque pelo menos um ponto ou escolha "Todos os pontos".', 'erro');
  const dados = {
    nome,
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

async function excluirPublicador(id) {
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

/* ============================================================ enquetes (organizadores) */

const somarDias = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const proximaSegundaISO = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return toISO(d);
};
const turnosDoEditor = (ed) => ed.turnosTexto.split('\n').map((t) => t.trim()).filter(Boolean);
const tituloSugerido = (ed) => `${ed.tipo === 'evento' ? 'Evento' : 'Semana'} de ${dataCurta(ed.inicio)} a ${dataCurta(ed.fim)}`;

function aplicarBloqueiosPadrao(ed) {
  const turnos = turnosDoEditor(ed);
  ed.bloqueios = [];
  for (const dia of ed.dias) {
    const dow = parseISO(dia.data).getDay();
    for (const b of estado.config.bloqueiosPadrao || []) {
      if (b.diaSemana === dow && turnos.includes(b.turno)) ed.bloqueios.push({ data: dia.data, turno: b.turno, motivo: b.motivo });
    }
  }
}

function regenerarDias(ed) {
  const antigos = new Map(ed.dias.map((d) => [d.data, d]));
  ed.dias = gerarDias(ed.inicio, ed.fim).map((d) => antigos.get(d.data) || d);
  ed.bloqueios = ed.bloqueios.filter((b) => ed.dias.some((d) => d.data === b.data));
}

function novoEditor(tipo = 'semana') {
  const cfg = estado.config;
  const inicio = proximaSegundaISO();
  const fim = somarDias(inicio, 5);
  const ed = {
    id: null, titulo: '', tipo, status: 'rascunho', inicio, fim,
    dias: gerarDias(inicio, fim),
    turnosTexto: cfg.turnos.join('\n'),
    pontos: new Set(cfg.pontos),
    bloqueios: [], maxIrmas: 3, maxIrmaos: '', parFixoJunto: true,
  };
  aplicarBloqueiosPadrao(ed);
  ed.titulo = tituloSugerido(ed);
  return ed;
}

function editorDe(e, copia = false) {
  const desloc = copia ? 7 : 0;
  const ed = {
    id: copia ? null : e.id,
    titulo: copia ? `${e.titulo} (cópia)` : e.titulo,
    tipo: e.tipo || 'semana',
    status: copia ? 'rascunho' : e.status,
    inicio: somarDias(e.inicio, desloc),
    fim: somarDias(e.fim, desloc),
    dias: e.dias.map((d) => ({ ...d, data: somarDias(d.data, desloc) })),
    turnosTexto: e.turnos.join('\n'),
    pontos: new Set(e.pontos),
    bloqueios: (e.bloqueios || []).map((b) => ({ ...b, data: somarDias(b.data, desloc) })),
    maxIrmas: e.regras?.maxIrmas ?? 3,
    maxIrmaos: e.regras?.maxIrmaos ?? '',
    parFixoJunto: e.regras?.parFixoJunto ?? true,
  };
  return ed;
}

async function renderEnquetes() {
  const c = $('#conteudo');
  if (estado.ed) return renderEditor();

  c.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 class="text-lg font-bold">Enquetes</h2>
      <div class="flex gap-2">
        <button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold" data-acao="nova-enquete" data-id="semana">Nova enquete da semana</button>
        <button class="bg-blue-100 text-blue-800 rounded-lg px-4 py-2 font-semibold" data-acao="nova-enquete" data-id="evento">Nova enquete de evento</button>
      </div>
    </div>
    <div class="space-y-3">
      ${estado.enquetes.map((e) => {
        const [rotuloStatus, cor] = STATUS[e.status] || [e.status, 'bg-slate-200'];
        const botoes = [
          ['editar-enquete', 'Editar'],
          ['duplicar-enquete', 'Duplicar'],
          e.status === 'aberta' ? ['encerrar-votacao', 'Encerrar votação'] : ['abrir-votacao', e.status === 'rascunho' ? 'Abrir votação' : 'Reabrir votação'],
          ['ver-votos', 'Ver votos'],
          ['montar-escala', 'Montar escala'],
          ['texto-whats', 'Texto do WhatsApp'],
          ['excluir-enquete', 'Excluir'],
        ];
        return `<article class="bg-white rounded-xl shadow-sm border p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div><h3 class="font-bold">${esc(e.titulo)}</h3>
              <p class="text-sm text-slate-500">${dataCurta(e.inicio)} a ${dataCurta(e.fim)} · ${e.pontos.length} ponto(s) · ${e.tipo === 'evento' ? 'Evento' : 'Semana'}</p></div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${cor}">${rotuloStatus}</span>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
            ${botoes.map(([a, r]) => `<button class="${a === 'excluir-enquete' ? 'text-red-600' : 'text-blue-700'} underline" data-acao="${a}" data-id="${esc(e.id)}">${r}</button>`).join('')}
          </div></article>`;
      }).join('') || '<div class="bg-white rounded-xl border p-6 text-slate-600">Nenhuma enquete ainda. Crie a primeira com os botões acima.</div>'}
    </div>`;
}

function renderEditor() {
  const ed = estado.ed;
  const turnos = turnosDoEditor(ed);
  const todosPontos = [...new Set([...estado.config.pontos, ...ed.pontos])];
  const diasAtivos = ed.dias.filter((d) => d.ativo !== false);

  $('#conteudo').innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-bold">${ed.id ? 'Editar enquete' : 'Nova enquete'}</h2>
      <button class="text-slate-600 underline" data-acao="cancelar-editor">Voltar sem salvar</button>
    </div>
    <div class="space-y-4">
      <section class="bg-white rounded-xl border p-4 grid sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2"><label class="text-sm font-medium" for="ed-titulo">Título</label>
          <input id="ed-titulo" class="w-full border rounded-lg p-2" value="${esc(ed.titulo)}" data-campo="titulo"></div>
        <div><label class="text-sm font-medium" for="ed-tipo">Tipo</label>
          <select id="ed-tipo" class="w-full border rounded-lg p-2" data-campo="tipo">
            <option value="semana" ${ed.tipo === 'semana' ? 'selected' : ''}>Semana comum</option>
            <option value="evento" ${ed.tipo === 'evento' ? 'selected' : ''}>Evento especial</option></select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm font-medium" for="ed-inicio">Início</label>
            <input id="ed-inicio" type="date" class="w-full border rounded-lg p-2" value="${esc(ed.inicio)}" data-campo="inicio"></div>
          <div><label class="text-sm font-medium" for="ed-fim">Fim</label>
            <input id="ed-fim" type="date" class="w-full border rounded-lg p-2" value="${esc(ed.fim)}" data-campo="fim"></div>
        </div>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-1">Dias</h3>
        <p class="text-sm text-slate-500 mb-3">Desmarque os dias sem carrinho e diga o motivo (por exemplo, congresso ou assembleia).</p>
        ${ed.dias.length ? `<div class="space-y-2">${ed.dias.map((d, i) => `
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 w-56 text-sm"><input type="checkbox" ${d.ativo !== false ? 'checked' : ''} data-campo="dia-ativo" data-i="${i}">
              ${nomeDia(d.data)} ${dataCurta(d.data)}</label>
            ${d.ativo === false ? `<input class="border rounded-lg p-2 text-sm flex-1 min-w-[12rem]" placeholder="Motivo (ex.: Assembleia)" value="${esc(d.motivo)}" data-campo="dia-motivo" data-i="${i}" aria-label="Motivo">` : ''}
          </div>`).join('')}</div>` : '<p class="text-red-600 text-sm">Confira as datas: o fim precisa ser depois do início.</p>'}
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-1">Horários</h3>
        <p class="text-sm text-slate-500 mb-2">Um horário por linha.</p>
        <textarea class="w-full border rounded-lg p-2 text-sm" rows="6" data-campo="turnos" aria-label="Horários">${esc(ed.turnosTexto)}</textarea>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-2">Pontos</h3>
        <div class="space-y-1 mb-3">${todosPontos.map((p) => `
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" value="${esc(p)}" ${ed.pontos.has(p) ? 'checked' : ''} data-campo="ponto"> ${esc(p)}</label>`).join('')}</div>
        <div class="flex gap-2"><input id="novo-ponto" class="border rounded-lg p-2 text-sm flex-1" placeholder="Adicionar outro ponto" aria-label="Novo ponto">
          <button type="button" class="bg-slate-100 rounded-lg px-3 text-sm" data-acao="add-ponto">Adicionar</button></div>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-1">Horários bloqueados</h3>
        <p class="text-sm text-slate-500 mb-2">Por exemplo, as reuniões. Nesses horários não há carrinho. Você pode bloquear em todos os pontos ou só em um.</p>
        <ul class="text-sm mb-3 space-y-1">${ed.bloqueios.map((b, i) => `
          <li class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1">
            <span>${nomeDia(b.data)} ${dataCurta(b.data)} · ${b.turno === '*' ? 'Dia todo' : esc(b.turno)} · ${esc(b.ponto || 'Todos os pontos')} · ${esc(b.motivo || 'Bloqueado')}</span>
            <button type="button" class="text-red-600 underline" data-acao="del-bloqueio" data-id="${i}">Remover</button></li>`).join('') || '<li class="text-slate-400">Nenhum.</li>'}</ul>
        <div class="grid sm:grid-cols-3 gap-2">
          <select id="bl-dia" class="border rounded-lg p-2 text-sm" aria-label="Dia">${diasAtivos.map((d) => `<option value="${esc(d.data)}">${nomeDia(d.data)} ${dataCurta(d.data)}</option>`).join('')}</select>
          <select id="bl-turno" class="border rounded-lg p-2 text-sm" aria-label="Horário"><option value="*">Dia todo</option>${turnos.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
          <select id="bl-ponto" class="border rounded-lg p-2 text-sm" aria-label="Ponto"><option value="">Todos os pontos</option>${[...ed.pontos].map((po) => `<option>${esc(po)}</option>`).join('')}</select>
        </div>
        <div class="flex gap-2 mt-2">
          <input id="bl-motivo" class="border rounded-lg p-2 text-sm flex-1" placeholder="Motivo (ex.: Reunião)" aria-label="Motivo">
          <button type="button" class="bg-slate-100 rounded-lg text-sm px-4" data-acao="add-bloqueio">Adicionar</button>
        </div>
      </section>

      <section class="bg-white rounded-xl border p-4">
        <h3 class="font-bold mb-2">Regras da escala</h3>
        <div class="flex flex-wrap items-center gap-6 text-sm">
          <label class="flex items-center gap-2">Máximo de participações por irmã
            <select class="border rounded-lg p-1" data-campo="maxIrmas">${[2, 3, 4, 5].map((n) => `<option ${Number(ed.maxIrmas) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="flex items-center gap-2">Máximo por irmão
            <select class="border rounded-lg p-1" data-campo="maxIrmaos"><option value="">Sem limite</option>${[3, 4, 5, 6, 8, 10].map((n) => `<option ${Number(ed.maxIrmaos) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="flex items-center gap-2"><input type="checkbox" ${ed.parFixoJunto ? 'checked' : ''} data-campo="parFixoJunto"> Quem tem par fixo só participa junto com o par</label>
        </div>
        <p class="text-xs text-slate-500 mt-2">Quem "precisa de trio" sempre entra em equipe de 3 pessoas. As demais equipes são duplas.</p>
      </section>

      <div class="flex flex-wrap gap-2">
        <button class="bg-slate-200 rounded-lg px-5 py-2 font-semibold" data-acao="salvar-enquete" data-id="manter">Salvar</button>
        <button class="bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold" data-acao="salvar-enquete" data-id="aberta">Salvar e abrir votação</button>
      </div>
    </div>`;
}

function campoMudou(el, digitando = false) {
  const ed = estado.ed;
  if (!ed) return;
  const i = Number(el.dataset.i);
  const sugeridoAntes = tituloSugerido(ed);

  switch (el.dataset.campo) {
    case 'titulo': ed.titulo = el.value; break;
    case 'tipo':
      ed.tipo = el.value;
      if (!ed.titulo || ed.titulo === sugeridoAntes) ed.titulo = tituloSugerido(ed);
      renderEditor();
      break;
    case 'inicio':
    case 'fim':
      if (digitando) return;
      ed[el.dataset.campo] = el.value;
      regenerarDias(ed);
      if (!ed.titulo || ed.titulo === sugeridoAntes) ed.titulo = tituloSugerido(ed);
      renderEditor();
      break;
    case 'dia-ativo': ed.dias[i].ativo = el.checked; renderEditor(); break;
    case 'dia-motivo': ed.dias[i].motivo = el.value; break;
    case 'turnos': ed.turnosTexto = el.value; if (!digitando) renderEditor(); break;
    case 'ponto': if (el.checked) ed.pontos.add(el.value); else ed.pontos.delete(el.value); break;
    case 'maxIrmas': ed.maxIrmas = el.value; break;
    case 'maxIrmaos': ed.maxIrmaos = el.value; break;
    case 'parFixoJunto': ed.parFixoJunto = el.checked; break;
    default: break;
  }
}

async function recarregarEnquetes() {
  estado.enquetes = await estado.backend.listarEnquetes({ somenteVisiveis: !ehOrganizador() });
}

async function salvarEditor(alvo) {
  const ed = estado.ed;
  const turnos = turnosDoEditor(ed);
  if (!ed.titulo.trim()) return toast('Dê um título à enquete.', 'erro');
  if (!ed.dias.length) return toast('Confira as datas de início e fim.', 'erro');
  if (!turnos.length) return toast('Informe pelo menos um horário.', 'erro');
  if (!ed.pontos.size) return toast('Marque pelo menos um ponto.', 'erro');

  const enquete = {
    id: ed.id || undefined,
    titulo: ed.titulo.trim(),
    tipo: ed.tipo,
    status: alvo === 'aberta' ? 'aberta' : ed.status || 'rascunho',
    inicio: ed.inicio,
    fim: ed.fim,
    dias: ed.dias,
    turnos,
    pontos: [...ed.pontos],
    bloqueios: ed.bloqueios.filter((b) => (b.turno === '*' || turnos.includes(b.turno)) && (!b.ponto || ed.pontos.has(b.ponto))),
    regras: { maxIrmas: Number(ed.maxIrmas) || 3, maxIrmaos: Number(ed.maxIrmaos) || null, parFixoJunto: ed.parFixoJunto },
  };

  const ok = await tentar(async () => {
    await estado.backend.salvarEnquete(enquete);
    const novos = enquete.pontos.filter((p) => !estado.config.pontos.includes(p));
    if (novos.length) {
      estado.config = { ...estado.config, pontos: [...estado.config.pontos, ...novos] };
      await estado.backend.salvarConfig(estado.config);
    }
  }, alvo === 'aberta' ? 'Enquete salva e votação aberta.' : 'Enquete salva.');

  if (ok) {
    estado.ed = null;
    await recarregarEnquetes();
    renderAba();
  }
}

async function mudarStatus(id, status, mensagem) {
  const e = estado.enquetes.find((x) => x.id === id);
  if (!e) return;
  const ok = await tentar(() => estado.backend.salvarEnquete({ ...e, status }), mensagem);
  if (ok) { await recarregarEnquetes(); renderAba(); }
}

async function excluirEnquete(id) {
  const e = estado.enquetes.find((x) => x.id === id);
  if (!e || !confirm(`Excluir "${e.titulo}"? Os votos e a escala dessa enquete serão apagados.`)) return;
  const ok = await tentar(() => estado.backend.excluirEnquete(id), 'Enquete excluída.');
  if (ok) { await recarregarEnquetes(); renderAba(); }
}

function textoWhatsApp(e) {
  const link = `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
  const dias = e.dias.map((d) => `• ${nomeDia(d.data)} ${dataCurta(d.data)}${d.ativo === false ? ` — ${d.motivo || 'sem carrinho'}` : ''}`).join('\n');
  const obs = (e.bloqueios || []).length
    ? `\n*Atenção:*\n${e.bloqueios.map((b) => `• ${nomeDia(b.data)} ${dataCurta(b.data)}, ${b.turno === '*' ? 'dia todo' : b.turno}: ${b.motivo || 'sem carrinho'}${b.ponto ? ` (só em ${b.ponto})` : ''}`).join('\n')}\n`
    : '';
  return `🛒 *Enquete do carrinho — ${e.titulo}*\n\nPor favor, votem nos horários em que podem participar, pelo aplicativo:\n${link}\n\n*Pontos:* ${e.pontos.join(' · ')}\n\n*Dias:*\n${dias}\n\n*Horários:* ${e.turnos.join(' | ')}\n${obs}\nO voto pode ser alterado até a enquete ser encerrada.`;
}

function abrirTextoWhats(id) {
  const e = estado.enquetes.find((x) => x.id === id);
  if (!e) return;
  abrirModal(`
    <h2 class="font-bold mb-2">Texto para o grupo</h2>
    <textarea id="texto-whats" class="w-full border rounded-lg p-2 text-sm" rows="14" readonly>${esc(textoWhatsApp(e))}</textarea>
    <div class="flex justify-end gap-2 mt-3">
      <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Fechar</button>
      <button class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="copiar-whats">Copiar</button>
    </div>`);
}

/* ============================================================ escala */

function htmlMatriz(enquete, matriz, ponto, { editavel = false, avisos = [], meuId = null } = {}) {
  const marcas = new Map();
  for (const a of avisos) {
    if (a.ponto === ponto && a.data && a.turno) {
      const k = `${a.data}|${a.turno}`;
      if (marcas.get(k) !== 'erro') marcas.set(k, a.nivel);
    }
  }

  const celula = (dia, turno) => {
    const motivo = celulaBloqueada(enquete, dia.data, turno, ponto);
    const cel = matriz?.[ponto]?.[dia.data]?.[turno] || (motivo ? { tipo: 'bloqueio', nota: motivo } : { tipo: 'vazio' });

    if (cel.tipo === 'bloqueio') return `<td class="celula-bloqueio">${esc(cel.nota || motivo || 'Sem carrinho')}</td>`;

    const marca = marcas.get(`${dia.data}|${turno}`);
    const classes = [
      editavel ? 'celula-editavel' : '',
      marca === 'erro' ? 'celula-erro' : marca === 'aviso' ? 'celula-aviso' : '',
      cel.tipo === 'equipe' && meuId && cel.pessoas.some((p) => p.id === meuId) ? 'celula-minha font-semibold' : '',
      cel.tipo === 'vazio' ? 'celula-vazia' : '',
    ].join(' ');
    const dados = editavel ? `data-acao="editar-celula" data-ponto="${esc(ponto)}" data-data="${esc(dia.data)}" data-turno="${esc(turno)}" tabindex="0"` : '';
    const conteudo = cel.tipo === 'equipe' ? cel.pessoas.map((p) => `<div>${esc(p.nome)}</div>`).join('') : 'Pregação';
    return `<td class="${classes}" ${dados}>${conteudo}</td>`;
  };

  return `<div class="overflow-x-auto"><table class="tabela-escala">
    <thead><tr><th>Horário</th>${enquete.dias.map((d) => `<th>${nomeDia(d.data)}<br><span class="font-normal">${dataCurta(d.data)}</span></th>`).join('')}</tr></thead>
    <tbody>${enquete.turnos.map((turno) => `<tr><td class="horario">${esc(turno)}</td>${enquete.dias.map((d) => celula(d, turno)).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

async function renderEscala() {
  const c = $('#conteudo');
  const org = ehOrganizador();
  const lista = org ? estado.enquetes : estado.enquetes.filter((e) => e.status === 'publicada');

  if (!lista.length) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6"><h2 class="font-bold mb-1">Nenhuma escala disponível</h2>
      <p class="text-slate-600">${org ? 'Crie uma enquete na aba Enquetes.' : 'Quando a escala for publicada, ela aparece aqui.'}</p></div>`;
    return;
  }

  escolherEnquetePadrao(lista);
  const enquete = enqueteAtual();
  estado.escala = await estado.backend.getEscala(enquete.id);
  estado.votos = org ? await estado.backend.listarVotos(enquete.id) : [];
  if (!estado.ponto || !enquete.pontos.includes(estado.ponto)) estado.ponto = enquete.pontos[0];

  const publicada = enquete.status === 'publicada' && estado.escala?.publicada;

  c.innerHTML = `
    ${seletorEnquete(lista, 'escolher-enquete')}
    <div class="flex flex-wrap items-center gap-2 mb-4">
      ${org ? `
        <button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold text-sm" data-acao="gerar-escala">Gerar escala automática</button>
        ${publicada
          ? '<button class="bg-amber-100 text-amber-900 rounded-lg px-4 py-2 font-semibold text-sm" data-acao="despublicar-escala">Retirar da publicação</button>'
          : '<button class="bg-green-600 text-white rounded-lg px-4 py-2 font-semibold text-sm" data-acao="publicar-escala">Publicar para todos</button>'}
        <span class="text-sm ${publicada ? 'text-green-700' : 'text-slate-500'}">${publicada ? 'Publicada: todos podem ver.' : 'Ainda não publicada: só os organizadores veem.'}</span>` : ''}
      <span class="flex-1"></span>
      <button class="bg-slate-100 rounded-lg px-3 py-2 text-sm" data-acao="imprimir">Imprimir este ponto</button>
      <button class="bg-slate-100 rounded-lg px-3 py-2 text-sm" data-acao="imprimir-todos">Imprimir todos</button>
      <button class="bg-slate-100 rounded-lg px-3 py-2 text-sm" data-acao="exportar-excel">Exportar Excel</button>
    </div>
    <div id="escala-corpo"></div>`;

  desenharEscala();
}

function desenharEscala() {
  const enquete = enqueteAtual();
  const corpo = $('#escala-corpo');
  if (!enquete || !corpo) return;

  const org = ehOrganizador();
  const escala = estado.escala;

  if (!escala?.matriz) {
    corpo.innerHTML = `<div class="bg-white rounded-xl border p-6 text-slate-600">${org
      ? 'Ainda não há escala para esta enquete. Clique em "Gerar escala automática".'
      : 'A escala ainda não foi publicada.'}</div>`;
    return;
  }

  const avisos = org ? validarEscala({ enquete, publicadores: estado.pubs, votos: estado.votos, matriz: escala.matriz }) : [];
  const meuId = estado.perfil.publicadorId || null;

  corpo.innerHTML = `
    <div class="flex flex-wrap gap-2 mb-3">
      ${enquete.pontos.map((p) => `<button class="px-4 py-2 rounded-lg text-sm font-semibold ${p === estado.ponto ? 'bg-blue-600 text-white' : 'bg-white border'}" data-acao="escolher-ponto" data-id="${esc(p)}">${esc(p)}</button>`).join('')}
    </div>
    <div class="bg-white rounded-xl border p-3">${htmlMatriz(enquete, escala.matriz, estado.ponto, { editavel: org, avisos, meuId })}</div>
    ${org ? `<p class="text-xs text-slate-500 mt-2">Clique em um horário para trocar as pessoas. Contorno vermelho = regra quebrada; amarelo = atenção.</p>
      ${painelAvisos(avisos)}${painelParticipacoes(enquete, escala.matriz)}` : (meuId ? '<p class="text-xs text-slate-500 mt-2">Os horários em que você está escalado aparecem destacados em azul.</p>' : '')}`;
}

function painelAvisos(avisos) {
  if (!avisos.length) {
    return '<div class="mt-4 bg-green-50 text-green-800 rounded-lg p-3 text-sm">Nenhum aviso: a escala respeita as regras.</div>';
  }
  const ordenados = [...avisos].sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'erro' ? -1 : 1));
  return `<div class="mt-4 bg-white rounded-xl border p-4"><h3 class="font-bold mb-2">Avisos (${avisos.length})</h3>
    <ul class="text-sm space-y-1">${ordenados.map((a) => `<li class="${a.nivel === 'erro' ? 'text-red-700' : 'text-amber-800'}">
      ${a.nivel === 'erro' ? '●' : '○'} ${a.ponto ? `${esc(a.ponto)} · ` : ''}${a.data ? `${nomeDia(a.data)} ${dataCurta(a.data)} · ` : ''}${esc(a.turno || '')}${a.turno || a.data || a.ponto ? ': ' : ''}${esc(a.msg)}</li>`).join('')}</ul></div>`;
}

function painelParticipacoes(enquete, matriz) {
  const regras = { ...REGRAS_PADRAO, ...(enquete.regras || {}) };
  const contagem = contarParticipacoes(matriz);
  const ativos = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  return `<div class="mt-4 bg-white rounded-xl border p-4"><h3 class="font-bold mb-2">Participações</h3>
    <div class="flex flex-wrap gap-2 text-sm">${ativos.map((p) => {
      const total = contagem.get(p.id)?.total || 0;
      const limite = p.genero === 'F' ? regras.maxIrmas : regras.maxIrmaos;
      const passou = Boolean(limite) && total > limite;
      return `<span class="px-3 py-1 rounded-full ${passou ? 'bg-red-100 text-red-800' : total === 0 ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-800'}">
        ${esc(p.nome)}: ${total}${limite ? `/${limite}` : ''}</span>`;
    }).join('')}</div></div>`;
}

function editarCelula(ponto, data, turno) {
  const enquete = enqueteAtual();
  const atual = estado.escala.matriz?.[ponto]?.[data]?.[turno];
  const selecionados = new Set(atual?.tipo === 'equipe' ? atual.pessoas.map((p) => p.id) : []);
  const k = chave(data, turno);
  const voluntarios = new Set(estado.votos.filter((v) => (v.disponibilidade?.[ponto] || []).includes(k)).map((v) => v.publicadorId));

  const lista = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => {
    const va = voluntarios.has(a.id) ? 0 : 1;
    const vb = voluntarios.has(b.id) ? 0 : 1;
    return va - vb || a.nome.localeCompare(b.nome, 'pt');
  });

  abrirModal(`
    <div class="flex items-start justify-between mb-2">
      <div><h2 class="font-bold">${esc(ponto)}</h2><p class="text-sm text-slate-500">${nomeDia(data)} ${dataCurta(data)} · ${esc(turno)}</p></div>
      <button class="text-slate-500 text-xl leading-none" data-acao="fechar-modal" aria-label="Fechar">×</button>
    </div>
    <p id="resumo-celula" class="text-sm bg-slate-50 rounded-lg p-2 mb-2"></p>
    <div class="max-h-80 overflow-y-auto border rounded-lg divide-y" id="lista-celula" data-ponto="${esc(ponto)}" data-data="${esc(data)}" data-turno="${esc(turno)}">
      ${lista.map((p) => `<label class="flex items-center gap-3 p-2 text-sm">
        <input type="checkbox" name="celula" value="${esc(p.id)}" ${selecionados.has(p.id) ? 'checked' : ''}>
        <span class="flex-1">${esc(p.nome)} <span class="text-xs text-slate-400">${p.genero === 'F' ? 'irmã' : 'irmão'}</span></span>
        ${voluntarios.has(p.id) ? '<span class="text-xs bg-green-100 text-green-800 rounded-full px-2">votou neste horário</span>' : ''}
        ${p.requerTrio ? '<span class="text-xs bg-amber-100 text-amber-800 rounded-full px-2">trio</span>' : ''}
        ${p.conjuge ? `<span class="text-xs bg-slate-100 text-slate-600 rounded-full px-2">par: ${esc(pubPorId(p.conjuge)?.nome || '')}</span>` : ''}
        ${p.pontosVoto?.length ? `<span class="text-xs bg-slate-100 text-slate-600 rounded-full px-2">só em ${esc(p.pontosVoto.join(', '))}</span>` : ''}
      </label>`).join('')}
    </div>
    <div class="flex flex-wrap justify-between gap-2 mt-4">
      <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="limpar-celula">Deixar sem equipe</button>
      <div class="flex gap-2">
        <button class="px-4 py-2 rounded-lg bg-slate-100" data-acao="fechar-modal">Cancelar</button>
        <button class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" data-acao="salvar-celula">Salvar</button>
      </div>
    </div>`);
  atualizarResumoCelula();
}

function atualizarResumoCelula() {
  const resumo = $('#resumo-celula');
  if (!resumo) return;
  const marcados = [...document.querySelectorAll('#modal input[name=celula]:checked')].map((i) => pubPorId(i.value)).filter(Boolean);
  const precisaTrio = marcados.some((p) => p.requerTrio);
  const esperado = precisaTrio ? 3 : 2;
  const ok = marcados.length === esperado;
  resumo.className = `text-sm rounded-lg p-2 mb-2 ${ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`;
  resumo.textContent = `${marcados.length} pessoa(s) marcada(s). Equipe esperada: ${esperado}${precisaTrio ? ' (alguém precisa de trio)' : ' (dupla)'}.`;
}

async function gravarCelula(pessoas) {
  const lista = $('#lista-celula');
  const { ponto, data, turno } = lista.dataset;
  const matriz = estado.escala.matriz;
  matriz[ponto][data][turno] = pessoas.length ? { tipo: 'equipe', pessoas } : { tipo: 'vazio' };
  const ok = await persistirEscala('Escala atualizada.');
  if (ok) { fecharModal(); desenharEscala(); }
}

async function persistirEscala(mensagem) {
  const e = enqueteAtual();
  const dados = {
    matriz: estado.escala.matriz,
    publicada: Boolean(estado.escala.publicada),
    geradoEm: estado.escala.geradoEm || new Date().toISOString(),
    ajustadoPor: estado.perfil.nome,
  };
  const ok = await tentar(() => estado.backend.salvarEscala(e.id, dados), mensagem);
  if (ok) estado.escala = { ...estado.escala, ...dados };
  return ok;
}

async function gerarEscalaAcao() {
  const e = enqueteAtual();
  const temEquipes = estado.escala?.matriz && JSON.stringify(estado.escala.matriz).includes('"equipe"');
  if (temEquipes && !confirm('Gerar de novo apaga os ajustes manuais desta escala. Continuar?')) return;
  if (!estado.votos.length) toast('Ainda não há votos nesta enquete: a escala sairá vazia.', 'erro');

  const { matriz } = gerarEscala({ enquete: e, publicadores: estado.pubs, votos: estado.votos });
  estado.escala = { ...(estado.escala || {}), matriz, geradoEm: new Date().toISOString() };
  if (await persistirEscala('Escala gerada. Confira os avisos e ajuste se precisar.')) desenharEscala();
}

async function publicarEscala(publicar) {
  const e = enqueteAtual();
  estado.escala.publicada = publicar;
  const ok = await tentar(async () => {
    await estado.backend.salvarEscala(e.id, {
      matriz: estado.escala.matriz,
      publicada: publicar,
      geradoEm: estado.escala.geradoEm || new Date().toISOString(),
      ajustadoPor: estado.perfil.nome,
    });
    await estado.backend.salvarEnquete({ ...e, status: publicar ? 'publicada' : 'fechada' });
  }, publicar ? 'Escala publicada para todos.' : 'Escala retirada da publicação.');
  if (ok) { await recarregarEnquetes(); renderAba(); }
}

function imprimir(todos) {
  const e = enqueteAtual();
  if (!estado.escala?.matriz) return toast('Gere a escala primeiro.', 'erro');
  const pontos = todos ? e.pontos : [estado.ponto];
  $('#area-impressao').innerHTML = pontos.map((p) => `
    <div class="pagina-impressao">
      <h2 style="font-size:18px;font-weight:700">${esc(e.titulo)} — ${esc(p)}</h2>
      <p style="margin-bottom:8px;font-size:12px">${dataCurta(e.inicio)} a ${dataCurta(e.fim)}</p>
      ${htmlMatriz(e, estado.escala.matriz, p)}
    </div>`).join('');
  window.print();
}

function exportarExcel() {
  const e = enqueteAtual();
  if (!estado.escala?.matriz) return toast('Gere a escala primeiro.', 'erro');
  if (typeof XLSX === 'undefined') return toast('A biblioteca do Excel não carregou. Verifique a internet.', 'erro');

  const wb = XLSX.utils.book_new();
  for (const ponto of e.pontos) {
    const linhas = [[`${e.titulo} — ${ponto}`], [], ['Horário', ...e.dias.map((d) => `${nomeDia(d.data)} ${dataCurta(d.data)}`)]];
    for (const turno of e.turnos) {
      linhas.push([turno, ...e.dias.map((d) => {
        const cel = estado.escala.matriz?.[ponto]?.[d.data]?.[turno];
        if (!cel) return '';
        if (cel.tipo === 'equipe') return cel.pessoas.map((p) => p.nome).join(' / ');
        if (cel.tipo === 'bloqueio') return cel.nota || 'Sem carrinho';
        return 'Pregação';
      })]);
    }
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws['!cols'] = [{ wch: 16 }, ...e.dias.map(() => ({ wch: 24 }))];
    XLSX.utils.book_append_sheet(wb, ws, ponto.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  }
  XLSX.writeFile(wb, `Escala - ${e.titulo.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`);
}

/* ============================================================ usuários (administrador) */

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Se o nome da conta for igual ao de um único publicador, sugere a ligação. */
function publicadorSugerido(usuario) {
  if (usuario.publicadorId) return null;
  const alvo = semAcento(usuario.nome);
  if (!alvo) return null;
  const achados = estado.pubs.filter((p) => semAcento(p.nome) === alvo);
  return achados.length === 1 ? achados[0].id : null;
}

const ehUltimoAdmin = (uid) => {
  const admins = estado.usuarios.filter((u) => u.papel === 'admin');
  return admins.length === 1 && admins[0].id === uid;
};

async function recarregarUsuarios() {
  estado.usuarios = await estado.backend.listarUsuarios();
}

async function renderUsuarios() {
  const c = $('#conteudo');
  await recarregarUsuarios();

  const nomeOrdem = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt');
  const pendentes = estado.usuarios.filter((u) => u.papel === 'pendente').sort(nomeOrdem);
  const ativos = estado.usuarios.filter((u) => !SEM_ACESSO.includes(u.papel)).sort(nomeOrdem);
  const removidos = estado.usuarios.filter((u) => u.papel === 'removido').sort(nomeOrdem);
  const pubs = [...estado.pubs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  const linha = (u) => {
    const sugerido = publicadorSugerido(u);
    const escolhido = u.publicadorId || sugerido;
    const pendente = u.papel === 'pendente';
    return `<tr class="border-t ${pendente ? 'bg-amber-50' : ''}" data-uid="${esc(u.id)}">
      <td class="p-3">
        <input class="border rounded-lg p-1 w-full min-w-[9rem]" value="${esc(u.nome || '')}" data-campo-usuario="nome" aria-label="Nome">
        <p class="text-xs text-slate-500 mt-1">${u.conviteId ? 'Entrou pelo link pessoal' : esc(u.email || '')}</p></td>
      <td class="p-3"><select class="border rounded-lg p-1" data-campo-usuario="papel" aria-label="Perfil">
        ${Object.entries(PAPEIS).filter(([v]) => v !== 'removido').map(([v, r]) => `<option value="${v}" ${u.papel === v ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
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
    <p class="text-sm text-slate-600 mb-4">Defina o perfil de cada pessoa e ligue o acesso dela ao nome na lista de publicadores. <strong>Remover acesso</strong> bloqueia na hora, e você pode reativar depois.</p>

    ${pendentes.length ? `<h3 class="font-bold text-amber-800 mb-2">Aguardando aprovação (${pendentes.length})</h3>${tabela(pendentes)}` : ''}

    <h3 class="font-bold mb-2">Com acesso (${ativos.length})</h3>
    ${ativos.length ? tabela(ativos) : '<p class="text-slate-500 mb-6">Ninguém ainda.</p>'}

    <details class="mb-6" ${removidos.length ? '' : 'hidden'}>
      <summary class="cursor-pointer font-bold">Acessos removidos (${removidos.length})</summary>
      <div class="bg-white rounded-xl shadow-sm border overflow-x-auto mt-2"><table class="w-full text-sm"><tbody>
        ${removidos.map((u) => `<tr class="border-t first:border-t-0">
          <td class="p-3"><p class="font-medium">${esc(u.nome || '—')}</p><p class="text-xs text-slate-500">${u.conviteId ? 'Entrava pelo link pessoal' : esc(u.email || '')}</p></td>
          <td class="p-3 text-right whitespace-nowrap">
            <button class="text-blue-700 underline mr-3" data-acao="reativar-usuario" data-id="${esc(u.id)}">Reativar como votante</button>
            <button class="text-red-600 underline" data-acao="excluir-usuario" data-id="${esc(u.id)}">Excluir registro</button></td></tr>`).join('')}
      </tbody></table></div>
    </details>

    <p class="text-xs text-slate-500">Quem tem conta por e-mail e foi removido continua com a conta de login criada, mas sem nenhum acesso aos dados. Para apagar a conta de login de vez, use Authentication no console do Firebase.</p>`;
}

async function salvarUsuario(uid) {
  const linha = document.querySelector(`tr[data-uid="${CSS.escape(uid)}"]`);
  const nome = linha.querySelector('[data-campo-usuario=nome]').value.trim();
  const papel = linha.querySelector('[data-campo-usuario=papel]').value;
  const publicadorId = linha.querySelector('[data-campo-usuario=publicadorId]').value || null;

  if (!nome) return toast('Informe o nome.', 'erro');
  if (ehUltimoAdmin(uid) && papel !== 'admin') return toast('Este é o único administrador. Nomeie outro antes de mudar este perfil.', 'erro');
  if (uid === estado.perfil.uid && papel !== 'admin' && !confirm('Você está tirando o seu próprio perfil de administrador. Continuar?')) return;

  const ok = await tentar(() => estado.backend.atualizarUsuario(uid, { nome, papel, publicadorId }), 'Usuário atualizado.');
  if (!ok) return;
  if (uid === estado.perfil.uid) {
    estado.perfil = { ...estado.perfil, nome, papel, publicadorId };
    await carregarBase();
    renderApp();
  } else {
    renderAba();
  }
}

async function removerAcesso(uid) {
  const u = estado.usuarios.find((x) => x.id === uid);
  if (!u) return;
  if (uid === estado.perfil.uid) return toast('Você não pode remover o seu próprio acesso.', 'erro');
  if (ehUltimoAdmin(uid)) return toast('Este é o único administrador. Nomeie outro antes de remover.', 'erro');
  if (!confirm(`${u.papel === 'pendente' ? 'Recusar' : 'Remover o acesso de'} ${u.nome || 'esta pessoa'}? A pessoa perde o acesso na hora. Você pode reativar depois.`)) return;
  if (await tentar(() => estado.backend.atualizarUsuario(uid, { papel: 'removido' }), 'Acesso removido.')) renderAba();
}

async function reativarUsuario(uid) {
  if (await tentar(() => estado.backend.atualizarUsuario(uid, { papel: 'votante' }), 'Acesso reativado como votante.')) renderAba();
}

async function excluirRegistroUsuario(uid) {
  const u = estado.usuarios.find((x) => x.id === uid);
  if (!u || !confirm(`Excluir o registro de ${u.nome || 'esta pessoa'}? Se ela entrar de novo com a mesma conta de e-mail, aparecerá como aguardando aprovação.`)) return;
  if (await tentar(() => estado.backend.excluirUsuario(uid), 'Registro excluído.')) renderAba();
}

/* ============================================================ links de acesso (administrador) */

const novoToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
const urlDoLink = (token) => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#convite-${token}`;

async function renderLinks() {
  const c = $('#conteudo');
  const [convites] = await Promise.all([estado.backend.listarConvites(), recarregarUsuarios()]);
  estado.convites = convites.filter((cv) => cv.ativo !== false);
  const porPub = new Map(estado.convites.map((cv) => [cv.publicadorId, cv]));
  const aparelhos = (token) => estado.usuarios.filter((u) => u.conviteId === token && u.papel !== 'removido').length;
  const lista = estado.pubs.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const semLink = lista.filter((p) => !porPub.has(p.id)).length;
  const demo = estado.backend.modo === 'demo';

  c.innerHTML = `
    <h2 class="text-lg font-bold mb-1">Links de acesso</h2>
    <p class="text-sm text-slate-700 mb-3">Cada publicador recebe um <strong>link pessoal</strong>. Ao tocar nele (no WhatsApp, por exemplo), a pessoa entra direto no app e já pode votar: <strong>sem e-mail e sem senha</strong>. Ideal para quem tem dificuldade com tecnologia.</p>
    <div class="bg-amber-50 text-amber-900 text-sm rounded-lg p-3 mb-4">
      Quem tiver o link entra como aquela pessoa (só para votar e ver a escala). Mande cada link só para a pessoa certa.
      Se um link for parar em mãos erradas, toque em <strong>Revogar</strong>: ele para de funcionar e os aparelhos que o usavam saem.
    </div>
    <div class="mb-3"><button class="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold ${semLink ? '' : 'opacity-50'}" data-acao="gerar-todos-links" ${semLink ? '' : 'disabled'}>Gerar links para quem ainda não tem (${semLink})</button></div>
    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left"><tr><th class="p-3">Publicador</th><th class="p-3">Link</th><th class="p-3"></th></tr></thead>
        <tbody>${lista.map((p) => {
          const cv = porPub.get(p.id);
          return `<tr class="border-t">
            <td class="p-3 font-medium">${esc(p.nome)}</td>
            <td class="p-3">${cv ? `<span class="text-green-700">Ativo</span> <span class="text-xs text-slate-500">· ${aparelhos(cv.id)} aparelho(s)</span>` : '<span class="text-slate-400">Sem link</span>'}</td>
            <td class="p-3 text-right whitespace-nowrap">${cv ? `
              <button class="text-blue-700 underline mr-3" data-acao="copiar-link" data-id="${esc(cv.id)}">Copiar</button>
              <button class="bg-green-600 text-white rounded-lg px-3 py-1 mr-3" data-acao="whats-link" data-id="${esc(cv.id)}">Enviar no WhatsApp</button>
              ${demo ? `<button class="text-slate-600 underline mr-3" data-acao="testar-link" data-id="${esc(cv.id)}">Testar como esta pessoa</button>` : ''}
              <button class="text-slate-600 underline mr-3" data-acao="gerar-link" data-id="${esc(p.id)}">Gerar novo</button>
              <button class="text-red-600 underline" data-acao="revogar-link" data-id="${esc(cv.id)}">Revogar</button>`
              : `<button class="bg-blue-600 text-white rounded-lg px-3 py-1" data-acao="gerar-link" data-id="${esc(p.id)}">Gerar link</button>`}</td></tr>`;
        }).join('') || '<tr><td class="p-4 text-slate-500" colspan="3">Cadastre os publicadores primeiro.</td></tr>'}</tbody>
      </table>
    </div>`;
}

async function criarLinkPara(pubId, { pergunta = true } = {}) {
  const pub = pubPorId(pubId);
  if (!pub) return false;
  const atual = estado.convites.find((cv) => cv.publicadorId === pubId);
  if (atual && pergunta && !confirm(`Gerar um link novo para ${pub.nome}? O link antigo para de funcionar e os aparelhos que o usavam saem.`)) return false;
  return tentar(async () => {
    if (atual) await estado.backend.revogarConvite(atual.id);
    await estado.backend.criarConvite(novoToken(), { publicadorId: pubId, nome: pub.nome });
  });
}

async function gerarTodosLinks() {
  const comLink = new Set(estado.convites.map((cv) => cv.publicadorId));
  const faltam = estado.pubs.filter((p) => p.ativo !== false && !comLink.has(p.id));
  for (const p of faltam) if (!(await criarLinkPara(p.id, { pergunta: false }))) break;
  toast(`${faltam.length} link(s) gerado(s).`);
  renderAba();
}

const mensagemDoLink = (nome, url) => `Olá, ${nome}! Este é o seu link pessoal para votar nas escalas do carrinho. É só tocar nele, não precisa de senha:\n${url}\nPor favor, não encaminhe para outras pessoas.`;

async function copiarLink(token) {
  const url = urlDoLink(token);
  try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch { prompt('Copie o link:', url); }
}

function enviarLinkWhats(token) {
  const cv = estado.convites.find((x) => x.id === token);
  if (!cv) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(mensagemDoLink(cv.nome, urlDoLink(token)))}`, '_blank', 'noopener');
}

async function revogarLink(token) {
  const cv = estado.convites.find((x) => x.id === token);
  if (!cv || !confirm(`Revogar o link de ${cv.nome}? Ele para de funcionar e os aparelhos que o usavam saem.`)) return;
  if (await tentar(() => estado.backend.revogarConvite(token), 'Link revogado.')) renderAba();
}

/* ============================================================ eventos */

const acoes = {
  aba: (el) => { estado.aba = el.dataset.id; estado.ed = null; renderApp(); },
  sair: () => {
    if (estado.perfil?.conviteId && !confirm('Se sair, você vai precisar tocar no seu link pessoal outra vez para entrar. Sair mesmo?')) return;
    estado.backend.sair();
  },
  fonte: () => {
    const grande = !fonteGrande();
    document.documentElement.classList.toggle('fonte-grande', grande);
    gravarPref('fonte', grande ? 'grande' : 'normal');
    document.querySelectorAll('[data-acao=fonte]').forEach((b) => { b.textContent = rotuloFonte(); });
  },
  'entrar-demo': (el) => estado.backend.entrarDemo(el.dataset.id),
  'reiniciar-demo': () => { if (confirm('Voltar aos dados de exemplo?')) { estado.backend.reiniciarDemo(); location.reload(); } },
  'modo-login': (el) => renderLogin(el.dataset.id),
  instalar: instalarApp,
  'entrar-com-link': entrarComLink,
  'previa-login': () => { estado.previaLogin = true; renderLogin('entrar'); },
  'sair-previa': () => { estado.previaLogin = false; renderLogin(); },
  'esqueci-senha': async () => {
    const email = $('#lg-email').value.trim();
    if (!email) return toast('Digite o seu e-mail no campo acima.', 'erro');
    await tentar(() => estado.backend.resetSenha(email), 'Se o e-mail existir, enviamos o link para redefinir a senha.');
  },
  'atualizar-perfil': async () => {
    const perfil = await estado.backend.getUsuario(estado.perfil.uid);
    estado.perfil = { ...perfil, uid: estado.perfil.uid };
    if (!SEM_ACESSO.includes(perfil.papel)) await carregarBase();
    renderApp();
  },
  'fechar-modal': fecharModal,
  'fechar-modal-fundo': (el, e) => { if (e.target === el) fecharModal(); },

  'escolher-enquete': (el) => { estado.enqueteId = el.value; estado.ponto = null; renderAba(); },
  'escolher-ponto': (el) => { estado.ponto = el.dataset.id; desenharEscala(); },

  'alternar-voto': alternarVoto,
  'marcar-tudo': (el) => marcarPonto(el.dataset.ponto, true),
  'limpar-ponto': (el) => marcarPonto(el.dataset.ponto, false),
  'salvar-voto': salvarVoto,
  'copiar-ponto': (el) => copiarPonto(el.dataset.ponto),
  'filtro-ponto': (el) => { estado.voto.filtro = el.dataset.ponto; gravarPref('filtro-ponto', estado.voto.filtro); renderAreaVoto(); },
  'votar-por': (el) => votarPor(el.dataset.id),

  'novo-publicador': () => formularioPublicador(null),
  'editar-publicador': (el) => formularioPublicador(el.dataset.id),
  'excluir-publicador': (el) => excluirPublicador(el.dataset.id),

  'nova-enquete': (el) => { estado.ed = novoEditor(el.dataset.id); renderAba(); },
  'editar-enquete': (el) => { estado.ed = editorDe(estado.enquetes.find((e) => e.id === el.dataset.id)); renderAba(); },
  'duplicar-enquete': (el) => { estado.ed = editorDe(estado.enquetes.find((e) => e.id === el.dataset.id), true); renderAba(); },
  'cancelar-editor': () => { estado.ed = null; renderAba(); },
  'salvar-enquete': (el) => salvarEditor(el.dataset.id),
  'abrir-votacao': (el) => mudarStatus(el.dataset.id, 'aberta', 'Votação aberta.'),
  'encerrar-votacao': (el) => mudarStatus(el.dataset.id, 'fechada', 'Votação encerrada.'),
  'excluir-enquete': (el) => excluirEnquete(el.dataset.id),
  'ver-votos': (el) => { estado.enqueteId = el.dataset.id; estado.aba = 'votos'; renderApp(); },
  'montar-escala': (el) => { estado.enqueteId = el.dataset.id; estado.ponto = null; estado.aba = 'escala'; renderApp(); },
  'texto-whats': (el) => abrirTextoWhats(el.dataset.id),
  'copiar-whats': async () => {
    const texto = $('#texto-whats');
    try { await navigator.clipboard.writeText(texto.value); toast('Texto copiado.'); } catch { texto.select(); toast('Selecione e copie o texto.'); }
  },
  'add-ponto': () => {
    const nome = $('#novo-ponto').value.trim();
    if (!nome) return;
    estado.ed.pontos.add(nome);
    renderEditor();
  },
  'add-bloqueio': () => {
    const data = $('#bl-dia').value;
    const turno = $('#bl-turno').value;
    if (!data || !turno) return toast('Escolha o dia e o horário.', 'erro');
    estado.ed.bloqueios.push({ data, turno, ponto: $('#bl-ponto').value, motivo: $('#bl-motivo').value.trim() });
    renderEditor();
  },
  'del-bloqueio': (el) => { estado.ed.bloqueios.splice(Number(el.dataset.id), 1); renderEditor(); },

  'gerar-escala': gerarEscalaAcao,
  'publicar-escala': () => publicarEscala(true),
  'despublicar-escala': () => publicarEscala(false),
  imprimir: () => imprimir(false),
  'imprimir-todos': () => imprimir(true),
  'exportar-excel': exportarExcel,
  'editar-celula': (el) => editarCelula(el.dataset.ponto, el.dataset.data, el.dataset.turno),
  'limpar-celula': () => gravarCelula([]),
  'salvar-celula': () => {
    const pessoas = [...document.querySelectorAll('#modal input[name=celula]:checked')]
      .map((i) => pubPorId(i.value)).filter(Boolean).map((p) => ({ id: p.id, nome: p.nome }));
    gravarCelula(pessoas);
  },

  'salvar-usuario': (el) => salvarUsuario(el.dataset.id),
  'remover-usuario': (el) => removerAcesso(el.dataset.id),
  'reativar-usuario': (el) => reativarUsuario(el.dataset.id),
  'excluir-usuario': (el) => excluirRegistroUsuario(el.dataset.id),

  'gerar-link': async (el) => { if (await criarLinkPara(el.dataset.id)) renderAba(); },
  'gerar-todos-links': gerarTodosLinks,
  'copiar-link': (el) => copiarLink(el.dataset.id),
  'whats-link': (el) => enviarLinkWhats(el.dataset.id),
  'revogar-link': (el) => revogarLink(el.dataset.id),
  'testar-link': async (el) => { await estado.backend.resgatarConvite(el.dataset.id); estado.aba = null; },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el || el.tagName === 'SELECT') return;
  acoes[el.dataset.acao]?.(el, e);
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('td.celula-editavel')) {
    e.preventDefault();
    e.target.click();
  }
  if (e.key === 'Escape') fecharModal();
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('select[data-acao]')) acoes[el.dataset.acao]?.(el, e);
  else if (el.name === 'celula') atualizarResumoCelula();
  else if (el.name === 'pb-onde') document.querySelectorAll('input[name=pb-ponto]').forEach((i) => { i.disabled = el.value !== 'alguns'; });
  else if (el.dataset.campo) campoMudou(el);
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.campo) campoMudou(e.target, true);
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  if (form.id === 'form-publicador') return salvarPublicadorForm(form);

  if (form.id === 'form-login') {
    const novo = Boolean($('#lg-nome'));
    const erro = $('#lg-erro');
    erro.classList.add('hidden');
    if (estado.backend.modo === 'demo') {
      erro.textContent = 'Modo demonstração: o login por e-mail só funciona depois de configurar o Firebase.';
      erro.classList.remove('hidden');
      return;
    }
    try {
      const email = $('#lg-email').value.trim();
      const senha = $('#lg-senha').value;
      if (novo) {
        const nome = $('#lg-nome').value.trim();
        if (!nome) throw { code: 'x-nome' };
        await estado.backend.registrar(nome, email, senha);
      } else {
        await estado.backend.login(email, senha);
      }
    } catch (err) {
      erro.textContent = err.code === 'x-nome' ? 'Informe o seu nome.' : erroAmigavel(err);
      erro.classList.remove('hidden');
    }
  }
});

iniciar();

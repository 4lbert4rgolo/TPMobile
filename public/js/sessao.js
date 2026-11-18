import { botaoInstalar, pedirArmazenamentoPersistente } from './instalar.js';
import { $, SEM_ACESSO, ehOrganizador, erroAmigavel, estado, lerPref, rotuloFonte, toast, tokenDoLink } from './nucleo.js';
import { renderApp } from './shell.js';
import { firebaseConfig } from './firebase-config.js';
import { criarBackendFirebase, criarBackendDemo, configurado, CONFIG_PADRAO } from './data.js';

export async function entrarComLink() {
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

export async function iniciar() {
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

export async function aoAutenticar(u) {
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

export async function carregarBase() {
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

export function faixaDemo() {
  if (estado.backend?.modo !== 'demo') return '';
  return `<div class="bg-amber-100 text-amber-900 text-sm px-4 py-2 text-center">
    <strong>Modo demonstração:</strong> os dados ficam só neste navegador. Para uso real, configure o Firebase (veja docs/CONFIGURAR_FIREBASE.md).
    <button class="underline ml-2" data-acao="reiniciar-demo">Reiniciar dados de exemplo</button>
  </div>`;
}

export function renderLogin(modo = 'entrar') {
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

export function telaPendente() {
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

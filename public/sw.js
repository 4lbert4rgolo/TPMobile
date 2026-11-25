// Service worker do TPMobile.
// Faz o app ser instalável e abrir rápido, inclusive sem internet.
//
// Como as versões funcionam (v3.17):
//  - Cada versão publicada tem um nome próprio em VERSAO (o deploy do GitHub troca sozinho pelo
//    código do commit). Ao instalar, o service worker baixa TODOS os arquivos do app de uma vez
//    para uma "gaveta" (cache) com esse nome.
//  - Ao abrir, os arquivos do app vêm direto dessa gaveta: rápido e sempre da mesma versão
//    (nunca um arquivo novo misturado com um antigo).
//  - Enquanto isso, o navegador confere se há versão nova. Se houver, ela é baixada inteira em
//    segundo plano e o app recarrega sozinho para usá-la (veja sessao.js).
// As bibliotecas de outros endereços (Firebase, fontes) têm a versão no endereço, então
// são guardadas na primeira vez e usadas do aparelho depois.
// Os dados (Firestore) e o login não passam por aqui: o próprio Firebase guarda o cache deles.

const VERSAO = 'tpmobile-v3.17';
const BIBLIOTECAS = 'tpmobile-bibliotecas-v1';
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'favicon.png',
  'js/app.js', 'js/nucleo.js', 'js/instalar.js', 'js/sessao.js', 'js/shell.js', 'js/votar.js', 'js/votos.js',
  'js/publicadores.js', 'js/enquetes.js', 'js/telaEscala.js', 'js/usuarios.js', 'js/links.js', 'js/dados.js', 'js/retencao.js',
  'js/busca.js', 'js/agenda.js', 'js/telaMinha.js',
  'js/pontos.js', 'js/telaPontos.js',
  'js/votoUnico.js',
  'js/relatorios.js', 'js/auditoria.js', 'js/telaAuditoria.js', 'js/trocas.js', 'js/importar.js', 'js/compartilhar.js',
  'js/notificacoes.js', 'js/telaNotificacoes.js', 'js/prazo.js', 'js/menu.js',
  'js/novidades.js', 'js/telaInicio.js', 'js/acessos.js', 'js/falha-inicio.js',
  'js/data.js', 'js/escala.js', 'js/firebase-config.js',
  'css/tailwind.css', 'css/app.css', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' busca da internet (e não do cache do navegador), para a gaveta nova ser mesmo da versão nova.
  e.waitUntil(caches.open(VERSAO)
    .then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO && k !== BIBLIOTECAS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Endereços de bibliotecas com versão fixa (não muda o conteúdo sem mudar o endereço). */
function ehBiblioteca(url) {
  return (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))
    || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (!ehBiblioteca(url)) return;
    // Primeiro o aparelho; se ainda não tiver, busca e guarda.
    e.respondWith(caches.open(BIBLIOTECAS).then((c) => c.match(req).then((guardado) => guardado || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
    return;
  }

  // Endereços internos do Firebase Hosting (/__/...) e .well-known: sempre da internet, sem guardar.
  if (url.pathname.startsWith('/__/') || url.pathname.startsWith('/.well-known/')) return;

  // Arquivos do app: primeiro a gaveta desta versão; se faltar algum, busca na internet e guarda.
  // A página (index.html) vem da gaveta mesmo com ?aba=... no endereço (links das notificações).
  const pedido = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(
    caches.open(VERSAO).then((c) => c.match(pedido, { ignoreSearch: req.mode === 'navigate' }).then((guardado) => guardado || fetch(req)
      .then((res) => {
        if (res.ok && req.mode !== 'navigate') c.put(req, res.clone());
        return res;
      })
      .catch(() => c.match('index.html'))))
  );
});

/* ------------------------------------------------------------ notificações no celular */
// O script do Google manda o aviso pelo Firebase Cloud Messaging; o aparelho acorda este service
// worker com o evento "push", mesmo com o app fechado, e aqui o aviso vira uma notificação.
// O aviso vem como dados ({ titulo, corpo, url, tag }); "notification" fica como reserva.

self.addEventListener('push', (e) => {
  let conteudo = {};
  try { conteudo = e.data ? e.data.json() : {}; } catch { conteudo = { data: { corpo: e.data?.text() } }; }
  const d = conteudo.data || {};
  const n = conteudo.notification || {};
  const titulo = d.titulo || n.title || 'TPMobile';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: d.corpo || n.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || undefined,          // aviso com a mesma tag substitui o anterior (não acumula)
    data: { url: d.url || './' },
    lang: 'pt-BR',
  }));
});

// Tocou na notificação: abre o app (ou traz para frente a janela que já estava aberta).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    const aberta = janelas.find((j) => j.url.startsWith(self.registration.scope));
    if (aberta) return aberta.navigate(destino).then((j) => (j || aberta).focus()).catch(() => aberta.focus());
    return self.clients.openWindow(destino);
  }));
});

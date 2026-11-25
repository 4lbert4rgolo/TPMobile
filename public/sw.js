// Service worker do TPMobile.
// Faz o app ser instalável e abrir mais rápido. Sempre tenta a internet primeiro, para que
// uma versão nova do app apareça logo; a cópia guardada só entra se a internet falhar.
// As bibliotecas de outros endereços (Firebase, Excel, fontes) têm a versão no endereço, então
// são guardadas na primeira vez e usadas do aparelho depois: assim o app abre mesmo sem internet.
// Os dados (Firestore) e o login não passam por aqui: o próprio Firebase guarda o cache deles.

const VERSAO = 'tpmobile-v3.10';
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
  'js/data.js', 'js/escala.js', 'js/firebase-config.js',
  'css/tailwind.css', 'css/app.css', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
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
    || ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
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

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((guardado) => guardado || caches.match('index.html')))
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

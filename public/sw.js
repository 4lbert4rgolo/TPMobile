// Service worker do TPMobile.
// Faz o app ser instalável e abrir mais rápido. Sempre tenta a internet primeiro, para que
// uma versão nova do app apareça logo; a cópia guardada só entra se a internet falhar.
// Firebase, fontes e tudo que é de outro endereço passam direto (não são guardados).

const VERSAO = 'tpmobile-v2.4';
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'favicon.png',
  'js/app.js', 'js/data.js', 'js/escala.js', 'js/firebase-config.js',
  'css/tailwind.css', 'css/app.css', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

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

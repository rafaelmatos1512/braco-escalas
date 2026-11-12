// Busca sempre a versão nova; usa o cache só sem internet.
const C = 'braco-v17';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'music.js', 'chords.js', 'audio.js', 'backing.js', 'api.js', 'tuner.js', 'icon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // a API (conta, gravações) nunca passa pelo cache: são dados da sua conta, e o áudio usa pedidos parciais
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(url.href, { cache: 'no-cache' }).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

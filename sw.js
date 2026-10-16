const CACHE = 'schattepatatjes-shell-v2';
const SHELL = ['./','./index.html','./styles.css?v=2','./app.js?v=2','./assets/icon.svg','./assets/icon-192.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const request = e.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const u = new URL(request.url);
  if (u.pathname.endsWith('/api.php')) return;
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});

/* ==========================================================
   Service worker — basic offline cache for the guide.
   ========================================================== */
const CACHE = 'osrs-guide-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/sakura.js',
  './js/data.js',
  './js/extras.js',
  './js/pending.js',
  './js/hiscores.js',
  './js/recommender.js',
  './js/tasklist.js',
  './js/journal.js',
  './js/dailies.js',
  './js/goals.js',
  './js/ai.js',
  './js/confetti.js',
  './js/ui.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // never cache hiscores / API calls
  if (u.host.includes('runescape') || u.host.includes('wiseoldman') || u.host.includes('pollinations') || u.pathname.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (e.request.method === 'GET' && resp.ok && u.origin === location.origin) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});

// Offline support: app shell is cached; book data and covers are refreshed
// from the network when possible.
const CACHE = 'pp-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'js/app.js', 'js/wordsearch.js', 'js/coloring.js',
  'data/books.json', 'manifest.webmanifest', 'icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first, cache as fallback, so new books show up as soon as they are published.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

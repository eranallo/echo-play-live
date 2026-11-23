// Echo Play Live service worker: lets the app open with no signal.
//
// It keeps the app's own files (the page, scripts, styles, fonts, logo).
// It never touches /api/: the schedule itself is saved by the app on the
// phone (components/EplApp.js), so personal data isn't held here.
const CACHE = 'epl-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('epl-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const keep = (req, res) => {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: the network first so updates arrive; the saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => keep(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Built files have the version in their name and never change: saved copy first.
  if (/^\/(_next\/static|fonts|brand)\//.test(url.pathname) || url.pathname === '/apple-touch-icon.png') {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
  }
});

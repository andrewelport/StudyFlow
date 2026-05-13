const CACHE = 'studyflow-v24';
const PRECACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/scheduler.js',
  '/style.css',
  '/manifest.json',
  '/logo_192.png',
  '/logo_512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // Skip API calls — never cache these
  if (url.includes('supabase') || url.includes('groq.com') || url.includes('netlify/functions')) return;
  // Skip cross-origin fonts/CDN — let browser handle normally
  if (!url.startsWith(self.location.origin) && !url.includes('fonts.googleapis') && !url.includes('fonts.gstatic')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Serve cached immediately, refresh in background (stale-while-revalidate)
      const fresh = fetch(e.request).then(res => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

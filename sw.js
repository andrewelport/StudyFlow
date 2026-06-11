const CACHE = 'studyflow-v169';
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css?v=130',
  '/style_v6.css?v=132',
  '/scheduler.js?v=35',
  '/sf-01-core.js?v=5',
  '/sf-02-onboarding.js?v=7',
  '/sf-03-import.js?v=12',
  '/sf-04-progress.js?v=1',
  '/sf-05-planner.js?v=1',
  '/sf-06-schedule.js?v=3',
  '/sf-07-calendar.js?v=1',
  '/sf-08-chat-ai.js?v=2',
  '/sf-09-coach.js?v=1',
  '/sf-10-focus.js?v=1',
  '/logo_192.png',
  '/logo_512.png',
  '/manifest.json',
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
  // Never cache API calls
  if (url.includes('supabase') || url.includes('groq.com') || url.includes('netlify/functions')) return;
  // Let browser handle cross-origin (fonts, CDN)
  if (!url.startsWith(self.location.origin) && !url.includes('fonts.googleapis') && !url.includes('fonts.gstatic')) return;

  // NETWORK-FIRST for HTML/CSS/JS — always serve fresh, fall back to cache offline
  if (url.includes('.html') || url.includes('.css') || url.includes('.js') ||
      url.endsWith('/') || url === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for images/fonts (rarely change)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
    })
  );
});

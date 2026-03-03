/* ══════════════════════════════════════════════════════
   LELELEMON POS  —  Service Worker (sw.js)
   ══════════════════════════════════════════════════════
   Strategy: Cache-First for static assets,
             Network-First for API calls.
   ══════════════════════════════════════════════════════ */

const CACHE_NAME    = 'lelelemon-v1';
const OFFLINE_PAGE  = '/index.html';

// Files to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  // Google Fonts (cached on first load)
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap',
];


/* ── INSTALL ─────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        // Use individual adds so one failure doesn't block the rest
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache:', url, err);
          }))
        );
      })
      .then(() => self.skipWaiting())
  );
});


/* ── ACTIVATE ────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});


/* ── FETCH ───────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // ── API calls → Network-First (don't cache DB responses) ──
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('firebaseio.com') ||
      url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ── Everything else → Cache-First ──
  event.respondWith(cacheFirst(request));
});


/* ── Strategies ──────────────────────────────────────── */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback
    const fallback = await caches.match(OFFLINE_PAGE);
    return fallback || new Response('Offline — please reconnect.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    // Try cache as last resort
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


/* ── Background Sync (future-ready) ─────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-menu') {
    console.log('[SW] Background sync: sync-menu');
    // Future: flush queued offline writes to DB here
  }
});


/* ── Push Notifications (future-ready) ──────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Lelelemon POS', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
  });
});

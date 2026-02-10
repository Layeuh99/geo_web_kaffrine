// ============================================
// SERVICE WORKER - GéoWeb Kaffrine PWA
// Version: 3.0.0
// ============================================

// 🔥 VERSION (changer à chaque mise à jour importante)
const VERSION = 'v3';

const CACHE_NAME   = `web-gis-kaffrine-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const DATA_CACHE   = `data-${VERSION}`;

// ============================================
// Ressources statiques (PAS index.html)
// ============================================
const STATIC_ASSETS = [
  '/css/leaflet.css',
  '/css/app-modern.css',
  '/css/qgis2web.css',
  '/js/app-modern.js',
  '/js/leaflet.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ============================================
// INSTALL
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installation', VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATE — SUPPRIME TOUS LES ANCIENS CACHES
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation', VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (
            cache !== CACHE_NAME &&
            cache !== STATIC_CACHE &&
            cache !== DATA_CACHE
          ) {
            console.log('[SW] Suppression ancien cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================
// FETCH — STRATÉGIES
// ============================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // ❗ index.html TOUJOURS depuis le réseau
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  // Ressources statiques
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Données SIG
  if (isDataRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tuiles de carte
  if (isTileRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Fallback
  event.respondWith(fetch(request));
});

// ============================================
// HELPERS
// ============================================
function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2')
  );
}

function isDataRequest(url) {
  return url.pathname.includes('/data/') || url.pathname.endsWith('.geojson');
}

function isTileRequest(url) {
  return (
    url.hostname.includes('tile') ||
    url.hostname.includes('openstreetmap') ||
    url.hostname.includes('google') ||
    url.hostname.includes('cartocdn')
  );
}

// ============================================
// STRATÉGIES CACHE
// ============================================
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Offline et pas de cache');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || networkFetch;
}

// ============================================
// MESSAGES (OPTIONNEL)
// ============================================
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

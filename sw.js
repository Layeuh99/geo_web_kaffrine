// ============================================
// SERVICE WORKER - Web GIS Kaffrine PWA
// Version: 1.0.0
// ============================================

const CACHE_NAME = 'web-gis-kaffrine-v1';
const STATIC_CACHE = 'static-v1';
const DATA_CACHE = 'data-v1';

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/leaflet.css',
  '/css/app-modern.css',
  '/css/qgis2web.css',
  '/js/app-modern.js',
  '/js/leaflet.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Mise en cache des ressources statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation terminée');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Erreur installation:', err);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('web-gis-') && name !== CACHE_NAME;
            })
            .map((name) => {
              console.log('[SW] Suppression ancien cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation terminée');
        return self.clients.claim();
      })
  );
});

// Stratégie de cache: Cache First, puis Network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Stratégie différente selon le type de requête
  if (isStaticAsset(url)) {
    // Cache First pour les ressources statiques
    event.respondWith(cacheFirst(request));
  } else if (isDataRequest(url)) {
    // Network First pour les données GeoJSON
    event.respondWith(networkFirst(request));
  } else if (isTileRequest(url)) {
    // Stale While Revalidate pour les tuiles
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Default: Cache First
    event.respondWith(cacheFirst(request));
  }
});

// Vérifier si c'est une ressource statique
function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.svg', '.json', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// Vérifier si c'est une requête de données
function isDataRequest(url) {
  return url.pathname.includes('/data/') || url.pathname.endsWith('.geojson');
}

// Vérifier si c'est une tuile de carte
function isTileRequest(url) {
  return url.hostname.includes('tile') || 
         url.hostname.includes('openstreetmap') || 
         url.hostname.includes('google') ||
         url.hostname.includes('cartocdn');
}

// Stratégie Cache First
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Erreur fetch:', error);
    // Retourner une réponse offline si disponible
    return new Response('Contenu non disponible offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stratégie Network First
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Fallback cache pour:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Stratégie Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  
  return cached || fetchPromise;
}

// Gestion des messages depuis l'application
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((name) => {
        caches.delete(name);
      });
    });
  }
});

// Sync en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[SW] Sync en arrière-plan');
  // Logique de synchronisation si nécessaire
}

// Push notifications (pour futures fonctionnalités)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'web-gis-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification('Web GIS Kaffrine', options)
  );
});

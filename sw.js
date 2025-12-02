const CACHE_NAME = 'reviverde-v2';
const STATIC_CACHE = 'reviverde-static-v2';
const IMAGE_CACHE = 'reviverde-images-v2';
const API_CACHE = 'reviverde-api-v2';

const urlsToCache = [
  '/',
  '/quem-somos',
  '/o-que-fazemos',
  '/projetos',
  '/como-participar',
  '/contato',
  '/styles.css',
  '/main.js',
  '/polyfills.js',
  '/runtime.js',
  '/ReviVerde_logo_transparent.png',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== IMAGE_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement different caching strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Cache-first strategy for static assets
  if (event.request.url.includes('/assets/') ||
      event.request.url.includes('.css') ||
      event.request.url.includes('.js') ||
      event.request.url.includes('.woff2')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Cache-first strategy for images
  if (event.request.destination === 'image' ||
      event.request.url.includes('.jpg') ||
      event.request.url.includes('.png') ||
      event.request.url.includes('.webp') ||
      event.request.url.includes('.avif')) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  // Network-first strategy for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Stale-while-revalidate for pages
  if (event.request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
    return;
  }

  // Default network-first for other requests
  event.respondWith(networkFirst(event.request, STATIC_CACHE));
});

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline fallback if available
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      return cache.match('/') || new Response('Offline', { status: 503 });
    }
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}
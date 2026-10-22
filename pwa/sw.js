/**
 * StudySynth — Offline Service Worker (v2)
 * Bulletproof offline caching for Android PWA and standalone web apps.
 */

const CACHE_NAME = 'studysynth-v2';
const CORE_ASSETS = [
  '/',
  '/?mode=standalone',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/sample_data.js',
  '/engine/generator.js',
  '/engine/pdfParser.js',
  '/engine/ocr.js',
  '/engine/storage.js',
  '/manifest.webmanifest',
  '/assets/logo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/favicon.png',
  '/assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Resilient caching: cache each asset individually so one redirect/failure does not abort SW
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('SW pre-cache item warning:', asset, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 1. Navigation Requests (Opening app from Android home screen or clicking links)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true })
        .then((cached) => {
          if (cached) return cached;
          return caches.match('/index.html') || caches.match('/') || caches.match('/?mode=standalone');
        })
        .then((response) => {
          if (response) return response;
          return fetch(event.request).catch(() => {
            return caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // 2. Static Assets (Cache-First strategy)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for image requests
        if (event.request.destination === 'image') {
          return caches.match('/assets/logo.png');
        }
        return caches.match('/index.html');
      });
    })
  );
});

/**
 * StudySynth - Offline Service Worker (v25)
 * Caches the complete local workspace so the installed app opens and works
 * without a network. All paths are scope-relative for sub-path hosting.
 */

const CACHE_NAME = 'studysynth-v26';
const CORE_ASSETS = [
  './',
  './?mode=standalone',
  './index.html',
  './styles.css',
  './app.js',
  './sample_data.js',
  './engine/generator.js',
  './engine/analyze.js',
  './engine/pdfParser.js',
  './engine/ocr.js',
  './engine/storage.js',
  './engine/jobs.js',
  './engine/worker.js',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon.png',
  './assets/apple-touch-icon.png',
  './assets/material/material-symbols-rounded-subset.woff2',
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/tesseract-core-simd-lstm.wasm',
  './vendor/tesseract/eng.traineddata',
  './vendor/pdfjs/pdf.mjs',
  './vendor/pdfjs/pdf.worker.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache independently so one optional asset cannot abort installation.
      await Promise.allSettled(
        CORE_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' })))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: always serve the app shell. The app is a single page and
  // must open instantly even when the device is in airplane mode.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request, { ignoreSearch: true })
        .then((cached) => cached || caches.match('./index.html') || caches.match('./'))
        .then((response) => response || fetch(request).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Static assets: cache-first for instant, zero-network startup.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, clone))
            .catch(() => { /* quota or private mode */ });
        }
        return networkResponse;
      }).catch(() => {
        if (request.destination === 'image') return caches.match('./assets/logo.png');
        if (request.destination === 'script' || request.destination === 'style') {
          return caches.match(request, { ignoreSearch: true }).then((hit) => hit || Response.error());
        }
        return caches.match('./index.html').then((hit) => hit || Response.error());
      });
    })
  );
});

const CACHE_NAME = 'debt-manager-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './123.png'
];

// Install Event: Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean old caches
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

// Fetch Event: Cache-First with Network fallback for offline support
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and Firebase RTDB / Google auth websocket / API calls
  if (req.method !== 'GET' || 
      url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('firebasedatabase.app') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (Stale-While-Revalidate)
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse.clone()));
          }
        }).catch(() => {
          // Offline, use existing cache silently
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store in cache
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // If network fails and request is for page navigation, return index.html
        if (req.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});

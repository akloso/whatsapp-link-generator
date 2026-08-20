const CACHE_PREFIX = 'splitzap-';
const CACHE = 'splitzap-v3';
const CORE = ['/splitzap', '/splitzap.webmanifest', '/splitzap-icon-192.png', '/splitzap-icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return (await caches.match(request)) || (fallbackPath ? await caches.match(fallbackPath) : undefined) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (response?.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  }).catch(() => undefined);
  return cached || await network || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/splitzap'));
    return;
  }

  if (url.pathname.startsWith('/assets/') || CORE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

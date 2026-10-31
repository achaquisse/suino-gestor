/* Porkflow service worker. Template: the build (vite.config.ts → pwaPlugin) fills in
   VERSION and PRECACHE and emits it as /sw.js. Not used in dev. */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const SHELL = `porkflow-shell-${VERSION}`
const RUNTIME = 'porkflow-runtime'
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
const HELP_IMAGES = 'porkflow-help-images'
const HELP_IMAGE_HOSTS = ['upload.wikimedia.org']
const HELP_IMAGE_MAX = 80

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('porkflow-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// The page asks a waiting worker to take over after the user accepts the update.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // SPA navigations: network first so deploys show up, cached shell when offline.
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html', { cacheName: SHELL, ignoreVary: true })))
    return
  }

  // Hashed build assets and public files: cache first. ignoreVary because hosts often send
  // `Vary: Origin`, and module scripts (crossorigin) carry an Origin header that addAll's didn't.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit || fetch(request)))
    return
  }

  // Google Fonts (Inter + Material Symbols): stale-while-revalidate so icons render offline.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(request, { ignoreVary: true })
        const net = fetch(request).then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(request, res.clone())
          return res
        }).catch(() => hit)
        return hit || net
      }),
    )
  }
  if (HELP_IMAGE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(HELP_IMAGES).then(async (cache) => {
        const hit = await cache.match(request, { ignoreVary: true })
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) {
          await cache.put(request, res.clone())
          const keys = await cache.keys()
          await Promise.all(keys.slice(0, Math.max(0, keys.length - HELP_IMAGE_MAX)).map((k) => cache.delete(k)))
        }
        return res
      }),
    )
    return
  }
  // Everything else (Supabase API, auth, storage) goes straight to the network;
  // offline data is handled by React Query, not the service worker.
})

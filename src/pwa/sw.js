/* Suino Gestor service worker. Template: the build (vite.config.ts → pwaPlugin) fills in
   VERSION and PRECACHE and emits it as /sw.js. Not used in dev. */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const SHELL = `suino-gestor-shell-${VERSION}`
const RUNTIME = 'suino-gestor-runtime'
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
const HELP_IMAGES = 'suino-gestor-help-images'
const HELP_IMAGE_HOSTS = ['upload.wikimedia.org']
const HELP_IMAGE_MAX = 80
const NAV_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('suino-gestor-shell-') && k !== SHELL) || k.startsWith('porkflow-')).map((k) => caches.delete(k))))
      .then(() => self.registration.navigationPreload?.enable())
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

  // SPA navigations: network first so deploys show up, cached shell when offline or on a
  // stalled connection (after NAV_TIMEOUT_MS). Uses navigation preload when available.
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const shell = () => caches.match('/index.html', { cacheName: SHELL, ignoreVary: true })
      const network = Promise.resolve(event.preloadResponse).then((pre) => pre || fetch(request))
      event.waitUntil(network.catch(() => {}))
      const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS))
      try {
        return await Promise.race([network, timeout.then(async () => (await shell()) || network)])
      } catch {
        return (await shell()) || Response.error()
      }
    })())
    return
  }

  // Runtime config written at container start: network first, last copy when offline.
  if (url.origin === self.location.origin && url.pathname === '/config.js') {
    event.respondWith(
      fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          event.waitUntil(caches.open(RUNTIME).then((c) => c.put(request, copy)))
        }
        return res
      }).catch(async () => (await caches.match(request, { cacheName: RUNTIME, ignoreVary: true })) || Response.error()),
    )
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

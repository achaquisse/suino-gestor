import { useSyncExternalStore } from 'react'

// Registers /sw.js in production builds and exposes a waiting update to React.
let applyUpdate: (() => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const offer = (worker: ServiceWorker) => {
        applyUpdate = () => {
          navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
          worker.postMessage('skipWaiting')
        }
        emit()
      }

      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        worker?.addEventListener('statechange', () => {
          // Only an update if a previous worker already controls the page.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker)
        })
      })
      // Long-lived installed apps: check for a new deploy hourly.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    } catch (e) {
      console.warn('Service worker registration failed', e)
    }
  })
}

export function useSwUpdate() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => applyUpdate,
  )
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
    },
    () => navigator.onLine,
  )
}

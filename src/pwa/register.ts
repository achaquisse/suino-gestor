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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = {
  standalone: boolean
  ios: boolean
  canPrompt: boolean
}

const DISMISS_KEY = 'pf-install-dismissed'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000
let deferredPrompt: BeforeInstallPromptEvent | null = null
const installListeners = new Set<() => void>()
const emitInstall = () => { installState = readInstallState(); installListeners.forEach((l) => l()) }

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: fullscreen)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const readInstallState = (): InstallState => ({
  standalone: isStandalone(),
  ios: isIos(),
  canPrompt: deferredPrompt !== null,
})
let installState: InstallState = readInstallState()

export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    emitInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emitInstall()
  })
  window.matchMedia('(display-mode: standalone)').addEventListener('change', emitInstall)
}

export function useInstall() {
  return useSyncExternalStore(
    (cb) => { installListeners.add(cb); return () => installListeners.delete(cb) },
    () => installState,
  )
}

export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  deferredPrompt = null
  emitInstall()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

export function installDismissed() {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
  return Date.now() - at < DISMISS_MS
}

export function dismissInstall() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()))
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

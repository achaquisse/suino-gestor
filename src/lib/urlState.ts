import { useSyncExternalStore } from 'react'
import type { createBrowserRouter } from 'react-router'

type Router = ReturnType<typeof createBrowserRouter>
export type UrlPatch = Record<string, string | number | null | undefined>

const strip = (s: string) => s.replace(/^\?/, '')

let params = new URLSearchParams(window.location.search)
let router: Router | null = null
let lastSeen = strip(window.location.search)
let scheduled = false
const ours: string[] = []
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
const snapshot = () => params

function flush() {
  scheduled = false
  if (!router) return
  const s = params.toString()
  const loc = router.state.location
  if (strip(loc.search) === s) return
  ours.push(s)
  void router.navigate({ pathname: loc.pathname, search: s ? `?${s}` : '', hash: loc.hash }, { replace: true, preventScrollReset: true })
}

export function bindRouter(r: Router) {
  router = r
  lastSeen = strip(r.state.location.search)
  params = new URLSearchParams(lastSeen)
  r.subscribe(({ location }) => {
    const s = strip(location.search)
    if (s === lastSeen) return
    lastSeen = s
    const i = ours.indexOf(s)
    if (i >= 0) {
      ours.splice(0, i + 1)
      return
    }
    ours.length = 0
    if (s === params.toString()) return
    params = new URLSearchParams(s)
    emit()
  })
}

export function setUrlParams(patch: UrlPatch) {
  const next = new URLSearchParams(params)
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') next.delete(k)
    else next.set(k, String(v))
  }
  if (next.toString() === params.toString()) return
  params = next
  emit()
  if (!scheduled) {
    scheduled = true
    queueMicrotask(flush)
  }
}

export const useUrlParams = () => useSyncExternalStore(subscribe, snapshot)

export function useUrlState<T extends string = string>(key: string, def: NoInfer<T>, allowed?: readonly T[]): [T, (v: T) => void] {
  const raw = useUrlParams().get(key)
  const value = raw != null && (!allowed || allowed.includes(raw as T)) ? (raw as T) : def
  return [value, (v: T) => setUrlParams({ [key]: v === def ? null : v })]
}

export function useUrlNumber(key: string, def: number): [number, (v: number) => void] {
  const n = Number(useUrlParams().get(key))
  const value = Number.isFinite(n) && n > 0 ? Math.floor(n) : def
  return [value, (v: number) => setUrlParams({ [key]: v === def ? null : v })]
}

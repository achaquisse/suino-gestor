import { useEffect, useSyncExternalStore } from 'react'
import { useMatches } from 'react-router'

export const APP_NAME = 'Suino Gestor'

export type RouteHandle = { title?: string }

let override: string | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

/** Sets a page-specific browser title (e.g. the animal tag) while the calling component is mounted. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    override = title
    emit()
    return () => {
      if (override === title) {
        override = null
        emit()
      }
    }
  }, [title])
}

/** Keeps document.title in sync: page override, else the deepest route `handle.title`. */
export function useDocumentTitle(fallback?: string) {
  const matches = useMatches()
  const page = useSyncExternalStore(subscribe, () => override)
  const route = [...matches].reverse().map((m) => (m.handle as RouteHandle | undefined)?.title).find(Boolean)
  const title = page ?? fallback ?? route
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}

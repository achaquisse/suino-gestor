import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const runtime = window.__SUINO_GESTOR_CONFIG__ ?? {}
const url = runtime.SUPABASE_URL || (import.meta.env.VITE_SUPABASE_URL as string | undefined)
const key = runtime.SUPABASE_PUBLISHABLE_KEY || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient<Database>(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

export function errorMessage(e: unknown): string {
  // fetch() rejects with a TypeError on network failure; supabase-js passes its message through.
  const offline = !navigator.onLine || /failed to fetch|load failed|networkerror/i.test(String((e as { message?: unknown })?.message ?? ''))
  if (offline) return 'Sem ligação à internet. Tente de novo quando estiver online.'
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return 'Ocorreu um erro. Tente novamente.'
}

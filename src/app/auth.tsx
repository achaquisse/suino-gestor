import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { clearCache } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  /** Error returned by the OAuth redirect (e.g. the user cancelled on Google). */
  error: string | null
  signInWithGoogle: () => Promise<void>
  /** Throws when the session could not be revoked (e.g. offline); the user stays signed in. */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
export const JUST_OUT_KEY = 'suino-gestor.justOut'
const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description']

/** Reads an OAuth error from the redirect URL and strips auth params so a reload doesn't replay them. */
function takeRedirectError() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const error = url.searchParams.get('error_description') ?? hash.get('error_description')
  if (AUTH_PARAMS.some((p) => url.searchParams.has(p))) {
    AUTH_PARAMS.forEach((p) => url.searchParams.delete(p))
    if (hash.has('error')) url.hash = ''
    window.history.replaceState(window.history.state, '', url)
  }
  return error
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    let active = true
    // INITIAL_SESSION fires once supabase-js has finished exchanging the ?code= from the redirect.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      if (event === 'INITIAL_SESSION') {
        const redirectError = takeRedirectError()
        if (!next && redirectError) setError(redirectError)
      }
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Cached farm data (also persisted for offline use) belongs to whoever was signed in:
  // wipe it once auth has settled with nobody signed in (sign-out, expired or revoked session).
  useEffect(() => {
    if (!loading && !userId) void clearCache()
  }, [loading, userId])

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    error,
    signInWithGoogle: async () => {
      setError(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // Farm devices are often shared: always let the user pick the Google account.
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
      })
      if (error) throw error
    },
    signOut: async () => {
      sessionStorage.setItem(JUST_OUT_KEY, '1')
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) {
        sessionStorage.removeItem(JUST_OUT_KEY)
        throw error
      }
    },
  }), [session, loading, error])

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

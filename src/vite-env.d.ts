/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __SUINO_GESTOR_CONFIG__?: {
    SUPABASE_URL?: string
    SUPABASE_PUBLISHABLE_KEY?: string
  }
}

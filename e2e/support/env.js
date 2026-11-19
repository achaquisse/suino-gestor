// Resolves the Supabase URL and keys for the local stack.
// Order: E2E_* env vars → VITE_* vars in the project .env → `supabase status -o json`.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))

function readDotEnv() {
  const file = `${root}.env`
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8').split('\n')
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^['"]|['"]$/g, '')]),
  )
}

let status
function supabaseStatus() {
  if (status) return status
  try {
    const out = execSync('npx supabase status -o json', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    status = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1))
  } catch {
    status = {}
  }
  return status
}

export function supabaseEnv() {
  const dot = readDotEnv()
  const url = process.env.E2E_SUPABASE_URL || dot.VITE_SUPABASE_URL || supabaseStatus().API_URL
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY || dot.VITE_SUPABASE_PUBLISHABLE_KEY || supabaseStatus().PUBLISHABLE_KEY
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_KEY || supabaseStatus().SECRET_KEY || supabaseStatus().SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) {
    throw new Error('E2E: Supabase is not configured. Start it with `npm run db:start` or set E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY / E2E_SUPABASE_SERVICE_KEY.')
  }
  return { url, anonKey, serviceKey }
}

/** The localStorage key supabase-js uses for the session (`sb-<first host label>-auth-token`). */
export const storageKey = (url) => `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

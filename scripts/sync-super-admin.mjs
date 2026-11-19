// Copies SUPER_ADMIN_EMAIL into the database (private.platform_admins), which is what the RLS
// policies and RPCs check. Run it after migrations on every deploy, and whenever the variable
// changes. An empty value removes the super admin.
//
//   SUPER_ADMIN_EMAIL=ana@example.com SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run admin:sync
//
// Locally the values default to .env and `supabase status`.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const dotEnv = existsSync('.env')
  ? Object.fromEntries(readFileSync('.env', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^['"]|['"]$/g, '')]))
  : {}
const env = (k) => process.env[k] ?? dotEnv[k]

let status
const local = (k) => {
  if (status === undefined) {
    try {
      const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
      status = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1))
    } catch {
      status = {}
    }
  }
  return status[k]
}

const email = (env('SUPER_ADMIN_EMAIL') ?? '').trim().toLowerCase()
const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || local('API_URL')
const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY') || local('SECRET_KEY') || local('SERVICE_ROLE_KEY')

if (!url || !key) {
  console.error('admin:sync: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or start the local stack).')
  process.exit(1)
}
if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`admin:sync: SUPER_ADMIN_EMAIL is not a valid email: "${email}"`)
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { error } = await admin.rpc('set_super_admins', { p_emails: email ? [email] : [], p_source: 'env' })
if (error) {
  console.error(`admin:sync: ${error.message}`)
  process.exit(1)
}
console.log(email ? `admin:sync: super admin is ${email}` : 'admin:sync: SUPER_ADMIN_EMAIL is empty; no super admin')

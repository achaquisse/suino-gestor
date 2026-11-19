// Creates an isolated, throw-away tenant for the run and removes it afterwards,
// so the suite never reads or writes the developer's own seed data.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { supabaseEnv } from './env.js'

const STATE_FILE = fileURLToPath(new URL('../output/e2e-state.json', import.meta.url))
export const PASSWORD = 'e2e-Pass-123!'

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }

export async function setup() {
  const { url, anonKey, serviceKey } = supabaseEnv()
  const admin = createClient(url, serviceKey, noPersist)
  const run = Date.now().toString(36)

  const people = {
    owner: { name: 'Olga Owner', role: 'owner' },
    caretaker: { name: 'Tomás Tratador', role: 'caretaker' },
    investor: { name: 'Inês Investidora', role: 'investor' },
    newcomer: { name: 'Nuno Novo', role: null },
    // Disposable account for the admin user-management scenarios (disabled, then removed).
    spare: { name: 'Sara Sobra', role: null },
    // Platform super admin, registered with source 'e2e' so `npm run admin:sync` and the
    // developer's own SUPER_ADMIN_EMAIL are left untouched.
    admin: { name: 'Ana Admin', role: null },
  }
  const users = {}
  for (const [key, p] of Object.entries(people)) {
    const email = `e2e-${key}-${run}@suinogestor.test`
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: p.name },
    })
    if (error) throw new Error(`E2E setup: could not create ${key}: ${error.message}`)
    users[key] = { id: data.user.id, email, name: p.name, role: p.role }
  }

  const { error: saErr } = await admin.rpc('set_super_admins', { p_emails: [users.admin.email], p_source: 'e2e' })
  if (saErr) throw new Error(`E2E setup: set_super_admins failed: ${saErr.message}`)

  // Only the super admin creates farms: one demo farm and one empty farm, both owned by the owner.
  const adminClient = createClient(url, anonKey, noPersist)
  const { error: signErr } = await adminClient.auth.signInWithPassword({ email: users.admin.email, password: PASSWORD })
  if (signErr) throw new Error(`E2E setup: admin sign-in failed: ${signErr.message}`)
  const farmName = `Granja E2E ${run}`
  const secondFarmName = `Quinta E2E ${run}`
  const { data: farmId, error: farmErr } = await adminClient.rpc('admin_create_farm', { p_name: farmName, p_owner_email: users.owner.email, p_demo: true })
  if (farmErr) throw new Error(`E2E setup: admin_create_farm failed: ${farmErr.message}`)
  const { data: secondFarmId, error: farm2Err } = await adminClient.rpc('admin_create_farm', { p_name: secondFarmName, p_owner_email: users.owner.email, p_demo: false })
  if (farm2Err) throw new Error(`E2E setup: admin_create_farm (2) failed: ${farm2Err.message}`)

  const { error: memErr } = await admin.from('farm_members').insert(
    ['caretaker', 'investor'].map((k) => ({ farm_id: farmId, user_id: users[k].id, role: users[k].role, display_name: users[k].name })),
  )
  if (memErr) throw new Error(`E2E setup: adding members failed: ${memErr.message}`)

  const state = { run, users, invitee: `e2e-invitee-${run}@suinogestor.test`, farm: { id: farmId, name: farmName }, secondFarm: { id: secondFarmId, name: secondFarmName } }
  mkdirSync(fileURLToPath(new URL('../output/', import.meta.url)), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  console.log(`  E2E fixtures ready: ${farmName} (run ${run})`)
  return state
}

export async function teardown() {
  if (process.env.E2E_KEEP_DATA) return console.log('  E2E_KEEP_DATA set: keeping test tenant')
  const state = readState(false)
  if (!state) return
  const { url, serviceKey } = supabaseEnv()
  const admin = createClient(url, serviceKey, noPersist)
  const ids = Object.values(state.users).map((u) => u.id)
  const { error: saErr } = await admin.rpc('set_super_admins', { p_emails: [], p_source: 'e2e' })
  if (saErr) console.warn(`  E2E teardown: super admin not removed: ${saErr.message}`)
  // Includes the farms the super admin created during the run.
  const { error: fErr } = await admin.from('farms').delete().in('created_by', ids)
  if (fErr) console.warn(`  E2E teardown: farms not deleted: ${fErr.message}`)
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id)
    // The spare account is removed by the admin scenarios themselves.
    if (error && !/not found/i.test(error.message)) console.warn(`  E2E teardown: user ${id} not deleted: ${error.message}`)
  }
  rmSync(STATE_FILE, { force: true })
  console.log(`  E2E fixtures removed (run ${state.run})`)
}

let cached
export function readState(required = true) {
  if (cached) return cached
  if (!existsSync(STATE_FILE)) {
    if (required) throw new Error('E2E: fixture state missing; bootstrap did not run.')
    return null
  }
  cached = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  return cached
}

/** Password sign-in for a fixture user; returns the session object supabase-js stores. */
export async function sessionFor(roleKey) {
  const { url, anonKey } = supabaseEnv()
  const user = readState().users[roleKey]
  if (!user) throw new Error(`E2E: unknown role "${roleKey}"`)
  const client = createClient(url, anonKey, noPersist)
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD })
  if (error) throw new Error(`E2E: sign-in as ${roleKey} failed: ${error.message}`)
  return data.session
}

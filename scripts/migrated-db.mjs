import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

/** In-memory Postgres with minimal Supabase auth/storage stubs and every migration applied. */
export async function migratedDb({ log = false } = {}) {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz default now(), last_sign_in_at timestamptz, banned_until timestamptz);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
`);
  const dir = 'supabase/migrations';
  for (const f of readdirSync(dir).sort()) {
    try { await db.exec(readFileSync(`${dir}/${f}`, 'utf8').replace('create extension if not exists pgcrypto;', '')); if (log) console.log('ok', f); }
    catch (e) { console.error('FAIL', f, e.message, e.position ?? ''); process.exit(1); }
  }
  return db;
}

-- Super admin: a platform-wide role, outside any farm.
--
-- The super admin email comes from the SUPER_ADMIN_EMAIL environment variable; the database
-- cannot read env vars, so `npm run admin:sync` (scripts/sync-super-admin.mjs) copies it into
-- private.platform_admins with the service role key. Run it after migrations on every deploy.
--
-- The super admin:
--   * is the only user who can create farms;
--   * can read and act in every farm with owner rights (is_member / has_role say yes);
--   * gets admin_* RPCs to list farms and users.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.platform_admins (
  email text primary key check (email = lower(trim(email)) and email <> ''),
  -- 'env' rows are owned by admin:sync; other sources (e.g. 'e2e') are left alone by it.
  source text not null default 'env',
  created_at timestamptz not null default now()
);

-- Matched against the account's confirmed email (auth.users), not a client-supplied claim.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join private.platform_admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

-- Replaces the admin emails of one source. Service role only (used by admin:sync and the e2e suite).
create or replace function public.set_super_admins(p_emails text[], p_source text default 'env')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  delete from private.platform_admins where source = p_source;
  insert into private.platform_admins (email, source)
  select distinct lower(trim(e)), p_source
  from unnest(coalesce(p_emails, '{}')) e
  where length(trim(coalesce(e, ''))) > 0
  on conflict (email) do update set source = excluded.source;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.set_super_admins(text[], text) from public, anon, authenticated;
grant execute on function public.set_super_admins(text[], text) to service_role;

-- ---------------------------------------------------------------------------
-- Farm access: the super admin counts as an owner of every farm.
-- ---------------------------------------------------------------------------
create or replace function public.is_member(p_farm uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from farm_members where farm_id = p_farm and user_id = auth.uid())
      or public.is_super_admin();
$$;

create or replace function public.has_role(p_farm uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from farm_members
    where farm_id = p_farm and user_id = auth.uid() and role = any (p_roles)
  ) or public.is_super_admin();
$$;

-- Names stamped on records: fall back to the profile when acting without a membership.
create or replace function public.my_name(p_farm uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(nullif(fm.display_name, ''), nullif(p.full_name, ''), p.email, '')
     from farm_members fm left join profiles p on p.id = fm.user_id
     where fm.farm_id = p_farm and fm.user_id = auth.uid()),
    (select coalesce(nullif(full_name, ''), email, '') from profiles where id = auth.uid()),
    ''
  );
$$;

-- Farm details (name) are managed from the admin area: owners no longer update farms.
drop policy if exists "farms: owners update" on public.farms;
create policy "farms: super admin update" on public.farms for update using (public.is_super_admin());

create policy "profiles: super admin read" on public.profiles for select using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Farm creation: super admin only.
-- ---------------------------------------------------------------------------
create or replace function public.require_super_admin()
returns void
language plpgsql
stable
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Apenas o administrador da plataforma pode fazer isto.' using errcode = '42501';
  end if;
end;
$$;

-- Creates a farm. Its owner is p_owner_email: added straight away when that person already has
-- an account, otherwise invited (they join on first sign-in). Without an owner email, the
-- super admin becomes the owner.
create or replace function public.admin_create_farm(p_name text, p_owner_email text default null, p_demo boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_owner_email, '')));
  v_owner uuid;
  v_owner_name text;
  v_farm uuid;
begin
  perform require_super_admin();
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Indique o nome da granja.';
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Indique um email válido para o proprietário.';
  end if;

  if v_email = '' then
    v_owner := v_uid;
  else
    select id into v_owner from profiles where lower(email) = v_email limit 1;
  end if;
  if v_owner is not null then
    select coalesce(nullif(full_name, ''), email) into v_owner_name from profiles where id = v_owner;
  end if;

  insert into farms (name, created_by) values (trim(p_name), v_uid) returning id into v_farm;
  if v_owner is not null then
    insert into farm_members (farm_id, user_id, role, display_name) values (v_farm, v_owner, 'owner', coalesce(v_owner_name, ''));
  else
    insert into farm_invites (farm_id, email, role) values (v_farm, v_email, 'owner');
  end if;

  perform seed_defaults(v_farm);
  if p_demo then
    perform seed_demo(v_farm, coalesce(v_owner_name, 'Proprietário'));
  end if;
  return v_farm;
end;
$$;

create or replace function public.create_farm(p_name text, p_demo boolean default false)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.admin_create_farm(p_name, null, p_demo);
$$;

-- ---------------------------------------------------------------------------
-- Admin overview
-- ---------------------------------------------------------------------------
create or replace function public.admin_farms()
returns table (
  id uuid, name text, created_at timestamptz, created_by_name text,
  owners text, members int, pending_invites int, pens int, animals int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_super_admin();
  return query
  select f.id, f.name, f.created_at,
    coalesce(nullif(cp.full_name, ''), cp.email, '')::text,
    coalesce((
      select string_agg(coalesce(nullif(m.display_name, ''), nullif(p.full_name, ''), p.email), ', ' order by m.created_at)
      from farm_members m left join profiles p on p.id = m.user_id
      where m.farm_id = f.id and m.role = 'owner'
    ), (
      select string_agg(i.email || ' (convite)', ', ')
      from farm_invites i where i.farm_id = f.id and i.role = 'owner' and i.accepted_at is null
    ), '')::text,
    (select count(*) from farm_members m where m.farm_id = f.id)::int,
    (select count(*) from farm_invites i where i.farm_id = f.id and i.accepted_at is null)::int,
    (select count(*) from pens pn where pn.farm_id = f.id)::int,
    (select count(*) from animals a where a.farm_id = f.id and a.removed_at is null)::int
  from farms f
  left join profiles cp on cp.id = f.created_by
  order by f.created_at desc;
end;
$$;

create or replace function public.admin_users()
returns table (
  id uuid, name text, email text, created_at timestamptz, last_sign_in_at timestamptz,
  is_super_admin boolean, farms jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_super_admin();
  return query
  select p.id, p.full_name, p.email, p.created_at, u.last_sign_in_at,
    exists (select 1 from private.platform_admins a where a.email = lower(p.email)),
    coalesce((
      select jsonb_agg(jsonb_build_object('farm_id', m.farm_id, 'name', f.name, 'role', m.role) order by f.name)
      from farm_members m join farms f on f.id = m.farm_id
      where m.user_id = p.id
    ), '[]'::jsonb)
  from profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

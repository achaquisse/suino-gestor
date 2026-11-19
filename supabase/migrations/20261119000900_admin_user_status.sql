-- The super admin can deactivate, reactivate and remove user accounts.
--
-- Deactivating:
--   * bans the account in Supabase Auth (banned_until), so it cannot sign in or refresh a token;
--   * ends its sessions;
--   * and, because an access token stays valid until it expires, the farm access checks
--     (is_member / has_role) refuse a deactivated account straight away.
-- Removing deletes the account; its memberships and personal data go with it. It is refused while
-- the person is the only owner of a farm, so no farm is left without an owner.
-- The super admin cannot deactivate or remove themselves or another super admin.

alter table public.profiles add column disabled_at timestamptz;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from profiles where id = auth.uid() and disabled_at is not null);
$$;

create or replace function public.is_member(p_farm uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and (
    exists (select 1 from farm_members where farm_id = p_farm and user_id = auth.uid())
    or public.is_super_admin());
$$;

create or replace function public.has_role(p_farm uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and (
    exists (select 1 from farm_members where farm_id = p_farm and user_id = auth.uid() and role = any (p_roles))
    or public.is_super_admin());
$$;

-- Shared guard for the two actions below.
create or replace function public.admin_target_user(p_user uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
begin
  perform require_super_admin();
  if p_user = auth.uid() then
    raise exception 'Não pode alterar a sua própria conta de administrador.';
  end if;
  select * into v_profile from profiles where id = p_user;
  if v_profile.id is null then
    raise exception 'Utilizador não encontrado.';
  end if;
  if exists (select 1 from private.platform_admins a where a.email = lower(v_profile.email)) then
    raise exception 'Não pode alterar a conta de um administrador da plataforma.';
  end if;
  return v_profile;
end;
$$;
revoke execute on function public.admin_target_user(uuid) from public, anon, authenticated;

create or replace function public.admin_set_user_active(p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_target_user(p_user);
  update profiles set disabled_at = case when p_active then null else coalesce(disabled_at, now()) end where id = p_user;
  update auth.users set banned_until = case when p_active then null else 'infinity'::timestamptz end where id = p_user;
  if not p_active then
    delete from auth.sessions where user_id = p_user;
  end if;
end;
$$;
revoke execute on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farms text;
begin
  perform admin_target_user(p_user);
  select string_agg(f.name, ', ' order by f.name) into v_farms
  from farm_members m join farms f on f.id = m.farm_id
  where m.user_id = p_user and m.role = 'owner'
    and not exists (select 1 from farm_members o where o.farm_id = m.farm_id and o.role = 'owner' and o.user_id <> p_user);
  if v_farms is not null then
    raise exception 'É o único proprietário de: %. Atribua outro proprietário ou elimine a granja antes de remover a conta.', v_farms;
  end if;
  delete from auth.users where id = p_user;
end;
$$;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- The users list now says whether each account is deactivated.
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (
  id uuid, name text, email text, created_at timestamptz, last_sign_in_at timestamptz,
  is_super_admin boolean, disabled_at timestamptz, farms jsonb
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
    p.disabled_at,
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

-- Users may edit their own profile, but only the super admin changes whether it is deactivated.
create or replace function public.guard_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.disabled_at is distinct from old.disabled_at and auth.uid() is not null and not public.is_super_admin() then
    raise exception 'Só o administrador da plataforma pode activar ou desactivar contas.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_status() from public, anon, authenticated;

create trigger guard_profile_status before update on public.profiles
for each row execute function public.guard_profile_status();

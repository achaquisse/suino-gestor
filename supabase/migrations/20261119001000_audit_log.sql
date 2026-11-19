-- Activity log: every change a signed-in user makes to farm data is recorded (who, when, which
-- farm, what changed). The super admin reads it per user in the admin area; nobody can edit it.
-- Rows are written by a trigger on each audited table, so operations done through RPCs
-- (treatments, sales, purchases...) are captured as the row changes they make.

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,                      -- no FK: the log outlives removed accounts
  user_email text not null default '',
  user_name text not null default '',
  farm_id uuid,
  farm_name text not null default '',
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,              -- table name
  row_id text,
  label text not null default '',    -- a human name for the row (name, title, tag...)
  changes jsonb not null default '{}'::jsonb
);
create index audit_log_user_idx on public.audit_log (user_id, at desc);
create index audit_log_farm_idx on public.audit_log (farm_id, at desc);

alter table public.audit_log enable row level security;
create policy "audit_log: super admin read" on public.audit_log for select using (public.is_super_admin());

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_farm uuid;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
begin
  -- Only operations by a signed-in user; system work (seeding, cron, service role) is skipped.
  if v_uid is null or coalesce(current_setting('app.audit_skip', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  v_farm := case when tg_table_name = 'farms' then (v_row->>'id')::uuid else (v_row->>'farm_id')::uuid end;
  -- Rows removed because their farm was deleted: the farm deletion itself is the record.
  if tg_op = 'DELETE' and tg_table_name <> 'farms' and v_farm is not null and not exists (select 1 from farms where id = v_farm) then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'search_text') and v_new->v_key is distinct from v_old->v_key then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_array(v_old->v_key, v_new->v_key));
      end if;
    end loop;
    -- Quantity changes on stock items are already recorded as stock movements.
    if v_changes = '{}'::jsonb or (tg_table_name = 'stock_items' and v_changes - 'qty' - 'expires_on' = '{}'::jsonb) then
      return new;
    end if;
  else
    v_changes := v_row - 'farm_id' - 'search_text';
  end if;

  insert into audit_log (user_id, user_email, user_name, farm_id, farm_name, action, entity, row_id, label, changes)
  select v_uid, coalesce(p.email, ''), coalesce(nullif(p.full_name, ''), p.email, ''),
    v_farm, coalesce((select name from farms where id = v_farm), case when tg_table_name = 'farms' then v_row->>'name' end, ''),
    lower(tg_op), tg_table_name, coalesce(v_row->>'id', v_row->>'alert_key'),
    left(coalesce(v_row->>'name', v_row->>'title', v_row->>'tag', v_row->>'display_name', v_row->>'email', v_row->>'code', v_row->>'reason', ''), 120),
    v_changes
  from (select 1) one left join profiles p on p.id = v_uid;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'farms', 'farm_members', 'farm_invites', 'pens', 'animals', 'events', 'weights', 'tasks',
    'stock_items', 'stock_movements', 'accounts', 'categories', 'batches', 'transactions', 'transaction_files',
    'recurring_expenses', 'debts', 'parameters', 'treatment_products', 'breeds', 'symptoms'
  ] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- Profile changes are kept too (name, and deactivation by the admin); they carry no farm.
create trigger audit_profiles after update on public.profiles for each row execute function public.audit_row();

-- One user's activity: search (label, farm, record type, values), filter by operation and by record
-- type, sort ('new', 'old', 'entity') and page. Each row carries the total for the pager.
create or replace function public.admin_user_activity(
  p_user uuid, p_query text default '', p_action text default null, p_entity text default null,
  p_sort text default 'new', p_offset int default 0, p_limit int default 25
)
returns table (
  id bigint, at timestamptz, farm_id uuid, farm_name text, action text, entity text, row_id text, label text, changes jsonb,
  total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := '%' || replace(replace(replace(trim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform require_super_admin();
  return query
  select l.id, l.at, l.farm_id, l.farm_name, l.action, l.entity, l.row_id, l.label, l.changes, count(*) over ()
  from audit_log l
  where l.user_id = p_user
    and (p_action is null or l.action = p_action)
    and (p_entity is null or l.entity = p_entity)
    and (trim(coalesce(p_query, '')) = '' or concat_ws(' ', l.label, l.farm_name, l.entity, l.changes::text) ilike v_q)
  order by
    case when p_sort = 'entity' then l.entity end asc,
    case when p_sort = 'old' then l.id end asc,
    l.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;
revoke execute on function public.admin_user_activity(uuid, text, text, text, text, int, int) from public, anon;
grant execute on function public.admin_user_activity(uuid, text, text, text, text, int, int) to authenticated;

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

  -- The default and demo data are not the admin's own operations: leave them out of the log.
  perform set_config('app.audit_skip', 'on', true);
  perform seed_defaults(v_farm);
  if p_demo then
    perform seed_demo(v_farm, coalesce(v_owner_name, 'Proprietário'));
  end if;
  perform set_config('app.audit_skip', '', true);
  return v_farm;
end;
$$;

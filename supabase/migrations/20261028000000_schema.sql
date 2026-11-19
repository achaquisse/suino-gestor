-- Suino Gestor schema: multi-farm, role-based access, herd + finance.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Farms & membership
-- ---------------------------------------------------------------------------
create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  currency text not null default 'MZN',
  units text not null default 'kg',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.farm_members (
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'caretaker', 'vet', 'investor')),
  display_name text not null default '',
  prefs jsonb not null default '{"lang":"pt","notif":{"tasks":true,"stock":true,"weekly":false}}',
  created_at timestamptz not null default now(),
  primary key (farm_id, user_id)
);
create index farm_members_user_idx on public.farm_members (user_id);

create table public.farm_invites (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null check (role in ('owner', 'caretaker', 'vet', 'investor')),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (farm_id, email)
);

create or replace function public.is_member(p_farm uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from farm_members where farm_id = p_farm and user_id = auth.uid());
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
  );
$$;

-- ---------------------------------------------------------------------------
-- Herd
-- ---------------------------------------------------------------------------
create table public.pens (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  kind text not null default '',
  capacity int not null default 10 check (capacity >= 0),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (farm_id, name)
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  tag text not null check (tag ~ '^[A-Z0-9][A-Z0-9-]*$'),
  pen_id uuid references public.pens (id) on delete set null,
  sex text not null default 'Fêmea' check (sex in ('Fêmea', 'Macho')),
  stage text not null check (stage in ('Leitão', 'Desmamado', 'Recria', 'Engorda', 'Leitoa', 'Porca', 'Varrasco')),
  breed text not null default '',
  born_on date,
  weight_kg numeric(7, 2) not null default 0,
  status text not null default 'Saudável',
  tone text not null default 'neutral' check (tone in ('neutral', 'accent', 'red', 'amber')),
  parents text not null default '—',
  notes text not null default '',
  photo_path text,
  withdrawal_until date,
  removed_at date,
  removed_reason text check (removed_reason in ('death', 'sale')),
  created_at timestamptz not null default now(),
  unique (farm_id, tag)
);
create index animals_farm_pen_idx on public.animals (farm_id, pen_id) where removed_at is null;

-- Timeline + calendar entries. Animal timeline = rows with animal_id.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  event_date date not null,
  kind text not null check (kind in ('task', 'health', 'breeding', 'money')),
  title text not null,
  detail text not null default '',
  animal_id uuid references public.animals (id) on delete cascade,
  pen_id uuid references public.pens (id) on delete set null,
  meta jsonb not null default '{}',
  show_in_calendar boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index events_farm_date_idx on public.events (farm_id, event_date);
create index events_animal_idx on public.events (animal_id, event_date desc);

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  measured_on date not null,
  kg numeric(7, 2) not null check (kg > 0),
  created_at timestamptz not null default now()
);
create index weights_animal_idx on public.weights (animal_id, measured_on);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  title text not null,
  location text not null default '',
  pen_id uuid references public.pens (id) on delete set null,
  due_date date not null,
  due_time time,
  assignee text not null default '',
  action text,
  done_at timestamptz,
  done_by text,
  created_at timestamptz not null default now()
);
create index tasks_farm_due_idx on public.tasks (farm_id, due_date);

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  code text not null,
  name text not null,
  unit text not null default 'unidades',
  qty numeric(10, 2) not null default 0 check (qty >= 0),
  max_qty numeric(10, 2) not null default 10,
  low_qty numeric(10, 2) not null default 1,
  note text not null default '',
  expires_on date,
  category text not null default 'Materiais',
  unit_price numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (farm_id, code)
);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('Operacional', 'Investimento', 'Caixa')),
  holder text not null default '',
  initial_balance numeric(14, 2) not null default 0,
  color text not null default '#9A9AAE',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (farm_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  grp text not null check (grp in ('Investimento', 'Operacional', 'Receita', 'Dívida')),
  color text not null default '#9A9AAE',
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (farm_id, name)
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  code text not null,
  phase text not null default '',
  head_count int not null default 0,
  active boolean not null default true,
  opening_cost numeric(14, 2) not null default 0,
  opening_revenue numeric(14, 2) not null default 0,
  started_on date,
  created_at timestamptz not null default now(),
  unique (farm_id, code)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  tx_date date not null,
  title text not null,
  account_id uuid not null references public.accounts (id) on delete restrict,
  kind text not null check (kind in ('Venda', 'Aporte', 'Investimento', 'Recorrente', 'Pontual', 'Receita', 'Dívida')),
  category text not null,
  amount numeric(14, 2) not null check (amount <> 0),
  batch_id uuid references public.batches (id) on delete set null,
  notes text not null default '',
  source text,
  source_id uuid,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index transactions_farm_date_idx on public.transactions (farm_id, tx_date desc);

create table public.transaction_files (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  path text not null,
  name text not null,
  size_bytes bigint not null default 0,
  mime text not null default 'application/octet-stream',
  created_at timestamptz not null default now()
);

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  cost_type text not null default 'Fixo' check (cost_type in ('Fixo', 'Variável')),
  category text not null,
  account_id uuid not null references public.accounts (id) on delete restrict,
  splits jsonb not null default '[]',
  amount numeric(14, 2) not null check (amount > 0),
  frequency text not null check (frequency in ('Semanal', 'Mensal', 'Trimestral', 'Anual')),
  next_due date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  creditor text not null,
  description text not null default '',
  total numeric(14, 2) not null check (total > 0),
  paid numeric(14, 2) not null default 0 check (paid >= 0),
  installment numeric(14, 2) not null check (installment > 0),
  next_due date,
  account_id uuid not null references public.accounts (id) on delete restrict,
  splits jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.parameters (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  key text not null,
  name text not null,
  grp text not null check (grp in ('Reprodução', 'Crescimento', 'Vendas', 'Stock', 'Saúde', 'Finanças')),
  value numeric(14, 4) not null,
  unit text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (farm_id, key)
);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create view public.account_balances with (security_invoker = true) as
select
  a.id,
  a.farm_id,
  a.name,
  a.initial_balance,
  a.initial_balance + coalesce(sum(t.amount), 0) as balance,
  count(t.id)::int as tx_count
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

create view public.batch_results with (security_invoker = true) as
select
  b.id,
  b.farm_id,
  b.code,
  b.phase,
  b.head_count,
  b.active,
  b.opening_cost + coalesce(sum(-t.amount) filter (where t.amount < 0), 0) as cost,
  b.opening_revenue + coalesce(sum(t.amount) filter (where t.amount > 0 and t.kind = 'Venda'), 0) as revenue
from public.batches b
left join public.transactions t on t.batch_id = b.id
group by b.id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.farm_invites enable row level security;
alter table public.pens enable row level security;
alter table public.animals enable row level security;
alter table public.events enable row level security;
alter table public.weights enable row level security;
alter table public.tasks enable row level security;
alter table public.stock_items enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.batches enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_files enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.debts enable row level security;
alter table public.parameters enable row level security;

create policy "profiles: self or co-member read" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.farm_members me
      join public.farm_members other on other.farm_id = me.farm_id
      where me.user_id = auth.uid() and other.user_id = profiles.id
    )
  );
create policy "profiles: self update" on public.profiles for update using (id = auth.uid());

create policy "farms: members read" on public.farms for select using (public.is_member(id));
create policy "farms: owners update" on public.farms for update using (public.has_role(id, array['owner']));
create policy "farms: owners delete" on public.farms for delete using (public.has_role(id, array['owner']));

create policy "members: co-members read" on public.farm_members for select using (public.is_member(farm_id));
create policy "members: owners manage" on public.farm_members for all
  using (public.has_role(farm_id, array['owner'])) with check (public.has_role(farm_id, array['owner']));

create policy "invites: members read" on public.farm_invites for select using (public.is_member(farm_id));
create policy "invites: owners manage" on public.farm_invites for all
  using (public.has_role(farm_id, array['owner'])) with check (public.has_role(farm_id, array['owner']));

-- Herd tables: everyone reads, owner/caretaker/vet write, owner deletes.
do $$
declare t text;
begin
  foreach t in array array['pens', 'animals', 'events', 'weights', 'tasks', 'stock_items'] loop
    execute format('create policy "%1$s: members read" on public.%1$I for select using (public.is_member(farm_id))', t);
    execute format('create policy "%1$s: staff insert" on public.%1$I for insert with check (public.has_role(farm_id, array[''owner'',''caretaker'',''vet'']))', t);
    execute format('create policy "%1$s: staff update" on public.%1$I for update using (public.has_role(farm_id, array[''owner'',''caretaker'',''vet''])) with check (public.has_role(farm_id, array[''owner'',''caretaker'',''vet'']))', t);
    execute format('create policy "%1$s: owners delete" on public.%1$I for delete using (public.has_role(farm_id, array[''owner'']))', t);
  end loop;
end $$;

-- Finance tables: owner + investor read, owner writes.
do $$
declare t text;
begin
  foreach t in array array['transactions', 'transaction_files', 'recurring_expenses', 'debts', 'batches'] loop
    execute format('create policy "%1$s: finance read" on public.%1$I for select using (public.has_role(farm_id, array[''owner'',''investor'']))', t);
    execute format('create policy "%1$s: owners write" on public.%1$I for all using (public.has_role(farm_id, array[''owner''])) with check (public.has_role(farm_id, array[''owner'']))', t);
  end loop;
end $$;

-- Configuration tables: every member reads (needed for forms), owner writes.
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'parameters'] loop
    execute format('create policy "%1$s: members read" on public.%1$I for select using (public.is_member(farm_id))', t);
    execute format('create policy "%1$s: owners write" on public.%1$I for all using (public.has_role(farm_id, array[''owner''])) with check (public.has_role(farm_id, array[''owner'']))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: files live under "<farm_id>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false), ('animal-photos', 'animal-photos', false)
on conflict (id) do nothing;

create policy "storage: members read farm files" on storage.objects for select
  using (bucket_id in ('attachments', 'animal-photos') and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "storage: members upload farm files" on storage.objects for insert
  with check (bucket_id in ('attachments', 'animal-photos') and public.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'caretaker', 'vet']));
create policy "storage: members update farm files" on storage.objects for update
  using (bucket_id in ('attachments', 'animal-photos') and public.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'caretaker', 'vet']));
create policy "storage: owners delete farm files" on storage.objects for delete
  using (bucket_id in ('attachments', 'animal-photos') and public.has_role(((storage.foldername(name))[1])::uuid, array['owner']));

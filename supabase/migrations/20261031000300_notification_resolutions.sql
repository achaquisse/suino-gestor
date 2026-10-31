create table public.notification_resolutions (
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  alert_key text not null,
  resolved_at timestamptz not null default now(),
  primary key (farm_id, user_id, alert_key)
);

alter table public.notification_resolutions enable row level security;

create policy "notification_resolutions: own read" on public.notification_resolutions for select
  using (user_id = (select auth.uid()) and public.is_member(farm_id));

create policy "notification_resolutions: own insert" on public.notification_resolutions for insert
  with check (user_id = (select auth.uid()) and public.is_member(farm_id));

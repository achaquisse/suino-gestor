alter table public.stock_items add column active boolean not null default true;

insert into public.categories (farm_id, name, grp)
select distinct s.farm_id, s.category, 'Operacional' from public.stock_items s
where not exists (select 1 from public.categories c where c.farm_id = s.farm_id and c.name = s.category);

alter table public.stock_items add constraint stock_category_farm_fk
  foreign key (farm_id, category) references public.categories (farm_id, name) on update cascade on delete restrict;

create table public.treatment_products (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  code text not null,
  name text not null,
  dose_ml numeric(10, 3) check (dose_ml > 0),
  per_kg numeric(10, 3) check (per_kg > 0),
  dose_text text not null default '',
  route text not null default '',
  withdrawal_days integer not null default 0 check (withdrawal_days >= 0),
  stock_code text,
  help_kind text not null default 'art' check (help_kind in ('art', 'pb')),
  help_slug text not null default 'vacinas',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (farm_id, code),
  foreign key (farm_id, stock_code) references public.stock_items (farm_id, code) on update cascade on delete restrict
);

create table public.breeds (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (farm_id, name)
);

create table public.symptoms (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  icon text not null default 'healing',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (farm_id, name)
);

alter table public.treatment_products enable row level security;
alter table public.breeds enable row level security;
alter table public.symptoms enable row level security;
create policy treatment_products_read on public.treatment_products for select using (public.has_role(farm_id, array['owner', 'caretaker', 'vet', 'investor']));
create policy treatment_products_write on public.treatment_products for all using (public.has_role(farm_id, array['owner'])) with check (public.has_role(farm_id, array['owner']));
create policy breeds_read on public.breeds for select using (public.has_role(farm_id, array['owner', 'caretaker', 'vet', 'investor']));
create policy breeds_write on public.breeds for all using (public.has_role(farm_id, array['owner'])) with check (public.has_role(farm_id, array['owner']));
create policy symptoms_read on public.symptoms for select using (public.has_role(farm_id, array['owner', 'caretaker', 'vet', 'investor']));
create policy symptoms_write on public.symptoms for all using (public.has_role(farm_id, array['owner'])) with check (public.has_role(farm_id, array['owner']));

create or replace function public.seed_catalogs(p_farm uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into treatment_products (farm_id, code, name, dose_ml, per_kg, dose_text, route, withdrawal_days, stock_code, help_kind, help_slug) values
    (p_farm, 'ferro', 'Ferro dextrano 200 mg', 2, null, '', 'Intramuscular · pescoço', 0, (select code from stock_items where farm_id = p_farm and code = 'iron'), 'art', 'vacinas'),
    (p_farm, 'oxi', 'Oxitetraciclina LA 20%', 1, 10, '', 'Intramuscular', 28, null, 'art', 'carencia'),
    (p_farm, 'iver', 'Ivermectina 1%', 1, 33, '', 'Subcutânea', 28, (select code from stock_items where farm_id = p_farm and code = 'iver'), 'art', 'carencia'),
    (p_farm, 'parvo', 'Vacina Parvovirose + Erisipela', 2, null, '', 'Intramuscular', 0, (select code from stock_items where farm_id = p_farm and code = 'parvo'), 'art', 'vacinas'),
    (p_farm, 'myco', 'Vacina Mycoplasma', 2, null, '', 'Intramuscular', 0, null, 'art', 'vacinas'),
    (p_farm, 'b12', 'Vitamina B12', 1, null, '', 'Intramuscular', 0, null, 'art', 'vacinas'),
    (p_farm, 'elec', 'Electrólitos orais', null, null, '1 saqueta / 2 L de água', 'Oral · na água', 0, null, 'pb', 'diar')
  on conflict do nothing;
  insert into breeds (farm_id, name) select p_farm, name from (values
    ('Landrace'), ('Large White'), ('Duroc'), ('Pietrain'), ('Landrace × Large White'),
    ('Landrace × Duroc'), ('Large White × Duroc')
  ) b(name) on conflict do nothing;
  insert into symptoms (farm_id, name, icon) select p_farm, name, icon from (values
    ('Tosse', 'air'), ('Febre', 'thermostat'), ('Diarreia', 'water_drop'),
    ('Falta de apetite', 'no_meals'), ('Coxeira', 'accessible'),
    ('Ferida', 'healing'), ('Prostração', 'bedtime')
  ) s(name, icon) on conflict do nothing;
  update treatment_products p set stock_code = s.code
  from stock_items s
  where p.farm_id = p_farm and s.farm_id = p_farm and p.stock_code is null
    and (p.code = s.code and p.code in ('iver', 'parvo') or p.code = 'ferro' and s.code = 'iron');
end;
$$;

create or replace function public.seed_new_catalogs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_catalogs(new.id);
  return new;
end;
$$;
create trigger seed_new_catalogs after insert on public.farms for each row execute function public.seed_new_catalogs();

create or replace function public.link_default_treatment_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update treatment_products set stock_code = new.code
  where farm_id = new.farm_id and stock_code is null
    and (code = new.code and code in ('iver', 'parvo') or code = 'ferro' and new.code = 'iron');
  return new;
end;
$$;
create trigger link_default_treatment_stock after insert on public.stock_items
for each row execute function public.link_default_treatment_stock();

revoke execute on function public.seed_catalogs(uuid) from public, anon, authenticated;
revoke execute on function public.seed_new_catalogs() from public, anon, authenticated;
revoke execute on function public.link_default_treatment_stock() from public, anon, authenticated;

do $$ declare f record; begin
  for f in select id from public.farms loop
    perform public.seed_catalogs(f.id);
  end loop;
end $$;

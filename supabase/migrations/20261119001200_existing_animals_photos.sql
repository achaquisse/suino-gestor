-- 1. Registering animals that are already on the farm (no purchase, no expense).
-- 2. Animal photos: several per animal, each with the date it was taken. The animal's main photo
--    (animals.photo_path) is kept as the most recent one.

-- ---------------------------------------------------------------------------
-- Existing animals
-- ---------------------------------------------------------------------------
-- p_animals: [{tag, sex, stage, breed?, born_on?, weight_kg?}]. Returns the tags created.
create or replace function public.register_animals(
  p_farm uuid, p_pen uuid, p_animals jsonb, p_date date default current_date, p_by text default null
)
returns text[]
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_pen public.pens;
  v_n int := coalesce(jsonb_array_length(p_animals), 0);
  v_free int;
  v_dup text;
  v_tags text[];
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if jsonb_typeof(p_animals) <> 'array' or v_n = 0 then
    raise exception 'Indique pelo menos um animal.';
  end if;
  select * into v_pen from public.pens where id = p_pen and farm_id = p_farm;
  if v_pen.id is null then
    raise exception 'Curral não encontrado.';
  end if;
  if v_pen.blocked then
    raise exception 'O curral % está vedado e não pode receber animais.', v_pen.name;
  end if;
  v_free := v_pen.capacity - (select count(*) from public.animals a where a.pen_id = p_pen and a.removed_at is null);
  if v_free is not null and v_n > v_free then
    raise exception '% só tem % lugares livres.', v_pen.name, v_free;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_animals) e
    where coalesce(trim(e->>'tag'), '') = ''
       or coalesce(e->>'sex', '') not in ('Macho', 'Fêmea')
       or coalesce(e->>'stage', '') not in ('Leitão', 'Desmamado', 'Recria', 'Engorda', 'Leitoa', 'Porca', 'Varrasco')
       or (e->>'born_on' is not null and (e->>'born_on')::date > current_date)
       or (e->>'weight_kg' is not null and (e->>'weight_kg')::numeric <= 0)
  ) then
    raise exception 'Verifique o brinco, o sexo, a fase, a data de nascimento e o peso de cada animal.';
  end if;
  select t into v_dup from (
    select upper(trim(e->>'tag')) t from jsonb_array_elements(p_animals) e
  ) x
  where t in (select tag from public.animals where farm_id = p_farm)
     or t in (select upper(trim(e2->>'tag')) from jsonb_array_elements(p_animals) e2 group by 1 having count(*) > 1)
  limit 1;
  if v_dup is not null then
    raise exception 'O brinco % já existe ou está repetido.', v_dup;
  end if;

  with ins as (
    insert into public.animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone)
    select p_farm, upper(trim(e->>'tag')), p_pen, e->>'sex', e->>'stage', coalesce(trim(e->>'breed'), ''),
      (e->>'born_on')::date, coalesce((e->>'weight_kg')::numeric, 0), 'Saudável', 'neutral'
    from jsonb_array_elements(p_animals) e
    returning id, tag, weight_kg
  ), w as (
    insert into public.weights (farm_id, animal_id, measured_on, kg)
    select p_farm, id, p_date, weight_kg from ins where weight_kg > 0
    returning 1
  ), ev as (
    insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, show_in_calendar, created_by_name)
    select p_farm, p_date, 'task', 'Registado na granja', 'Animal existente · ' || v_pen.name, ins.id, p_pen,
      jsonb_build_object('type', 'register'), false, v_by
    from ins
    returning 1
  )
  select array_agg(tag order by tag) into v_tags from ins;

  insert into public.events (farm_id, event_date, kind, title, detail, pen_id, meta, created_by_name)
  values (p_farm, p_date, 'task', 'Animais registados · ' || v_pen.name,
    v_n || case when v_n = 1 then ' animal existente' else ' animais existentes' end, p_pen,
    jsonb_build_object('type', 'register', 'count', v_n), v_by);
  return v_tags;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------
create table public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  path text not null,
  taken_on date not null default current_date check (taken_on <= current_date + 1),
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index animal_photos_animal_idx on public.animal_photos (animal_id, taken_on desc, created_at desc);

alter table public.animal_photos enable row level security;
create policy "animal_photos: members read" on public.animal_photos for select using (public.is_member(farm_id));
create policy "animal_photos: staff insert" on public.animal_photos for insert
  with check (public.has_role(farm_id, array['owner', 'caretaker', 'vet'])
    and exists (select 1 from public.animals a where a.id = animal_id and a.farm_id = animal_photos.farm_id));
create policy "animal_photos: staff update" on public.animal_photos for update
  using (public.has_role(farm_id, array['owner', 'caretaker', 'vet'])) with check (public.has_role(farm_id, array['owner', 'caretaker', 'vet']));
create policy "animal_photos: staff delete" on public.animal_photos for delete
  using (public.has_role(farm_id, array['owner', 'caretaker', 'vet']));

-- Existing main photos become the first photo of each animal.
insert into public.animal_photos (farm_id, animal_id, path, taken_on, created_by)
select farm_id, id, photo_path, least(created_at::date, current_date), null from public.animals where photo_path is not null;

-- The main photo is the most recent one.
create or replace function public.sync_animal_cover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal uuid := coalesce(new.animal_id, old.animal_id);
begin
  update animals set photo_path = (
    select path from animal_photos where animal_id = v_animal order by taken_on desc, created_at desc limit 1
  ) where id = v_animal;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.sync_animal_cover() from public, anon, authenticated;
create trigger sync_animal_cover after insert or update of taken_on, path or delete on public.animal_photos
for each row execute function public.sync_animal_cover();

-- Staff may delete photo files (they could already upload them).
drop policy if exists "storage: owners delete farm files" on storage.objects;
create policy "storage: owners delete farm files" on storage.objects for delete
  using (
    (bucket_id = 'attachments' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner']))
    or (bucket_id = 'animal-photos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'caretaker', 'vet']))
  );

create trigger audit_animal_photos after insert or update or delete on public.animal_photos
for each row execute function public.audit_row();

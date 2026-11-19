-- Transfers take an explicit list of animals (p_animals), chosen in the form; the whole-pen and
-- single-animal forms still work.
drop function if exists public.log_transfer(uuid, uuid, uuid, uuid, date, text);
create or replace function public.log_transfer(
  p_farm uuid,
  p_animal uuid,
  p_from uuid,
  p_to uuid,
  p_date date default current_date,
  p_by text default null,
  p_animals uuid[] default null
)
returns int
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_ids uuid[];
  v_free int;
  v_from_name text;
  v_to_name text;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if p_from = p_to then
    raise exception 'Escolha um curral de destino diferente.';
  end if;
  select array_agg(id) into v_ids from public.animals
  where farm_id = p_farm and removed_at is null
    and (case
      when p_animals is not null then id = any (p_animals) and (p_from is null or pen_id = p_from)
      when p_animal is not null then id = p_animal
      else pen_id = p_from end);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Não há animais para transferir.';
  end if;

  select pn.capacity - (select count(*) from public.animals a where a.pen_id = pn.id and a.removed_at is null), pn.name
  into v_free, v_to_name
  from public.pens pn where pn.id = p_to and pn.farm_id = p_farm;
  if v_to_name is null then
    raise exception 'Curral de destino não encontrado.';
  end if;
  if v_free < array_length(v_ids, 1) then
    raise exception 'O curral de destino não tem lugares suficientes.';
  end if;
  select name into v_from_name from public.pens where id = coalesce(p_from, (select pen_id from public.animals where id = p_animal));

  update public.animals set pen_id = p_to where id = any (v_ids);

  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, show_in_calendar, created_by_name)
  select p_farm, p_date, 'task', 'Transferido para ' || v_to_name, 'Vindo de ' || coalesce(v_from_name, '—'), id, p_to,
    jsonb_build_object('type', 'transfer'), false, v_by
  from unnest(v_ids) as id;

  insert into public.events (farm_id, event_date, kind, title, detail, pen_id, meta, created_by_name)
  values (p_farm, p_date, 'task',
    case when p_animal is not null then 'Transferir ' || (select tag from public.animals where id = p_animal) || ' para ' || v_to_name
      else 'Transferência · ' || array_length(v_ids, 1) || ' animais' end,
    coalesce(v_from_name, '—') || ' → ' || v_to_name, p_to, jsonb_build_object('type', 'transfer'), v_by);

  return array_length(v_ids, 1);
end;
$$;

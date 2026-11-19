-- Pens: a role (maternidade, creche, engorda...) with its colour and icon, a place and size on the
-- farm layout (grid units), an optional capacity, and a "vedado" state (not available for use).

alter table public.pens
  add column role text not null default 'outro'
    check (role in ('maternidade', 'gestacao', 'creche', 'recria', 'engorda', 'varrasco', 'quarentena', 'enfermaria', 'outro')),
  add column color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  add column icon text check (icon is null or icon ~ '^[a-z0-9_]{1,40}$'),
  add column x int not null default 0 check (x >= 0),
  add column y int not null default 0 check (y >= 0),
  add column w int not null default 4 check (w between 1 and 24),
  add column h int not null default 3 check (h between 1 and 24),
  add column blocked boolean not null default false,
  add column blocked_reason text not null default '';

-- Capacity is optional: empty means no limit (the transfer and purchase checks already treat
-- a null capacity as unlimited).
alter table public.pens alter column capacity drop not null, alter column capacity drop default;

-- Role guessed from a pen's name/description (used for existing pens and for new pens without one).
create or replace function public.pen_role_of(p_name text, p_kind text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'matern|parto|lacta' then 'maternidade'
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'gesta' then 'gestacao'
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'creche|desmam' then 'creche'
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'recria' then 'recria'
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'engorda|acab' then 'engorda'
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'varrasco' then 'varrasco'
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'quarent' then 'quarentena'
    when lower(coalesce(p_name, '') || ' ' || coalesce(p_kind, '')) ~ 'enferm|isola' then 'enfermaria'
    else 'outro' end;
$$;

-- Existing pens: role from their name/description, laid out four per row in sort order.
update public.pens set role = public.pen_role_of(name, kind);
update public.pens p set x = (o.n % 4) * 4, y = (o.n / 4) * 3
from (select id, (row_number() over (partition by farm_id order by sort, created_at) - 1)::int as n from public.pens) o
where o.id = p.id;

-- New pens: role from the name when none is given, and, without a position, the first free
-- slot of a four-per-row grid that does not overlap another pen.
create or replace function public.place_new_pen()
returns trigger
language plpgsql
as $$
declare
  v_n int := 0;
begin
  if new.role = 'outro' then
    new.role := public.pen_role_of(new.name, new.kind);
  end if;
  if new.x = 0 and new.y = 0 then
    loop
      new.x := (v_n % 4) * 4;
      new.y := (v_n / 4) * 3;
      exit when not exists (
        select 1 from public.pens o
        where o.farm_id = new.farm_id
          and o.x < new.x + new.w and new.x < o.x + o.w
          and o.y < new.y + new.h and new.y < o.y + o.h
      );
      v_n := v_n + 1;
    end loop;
  end if;
  return new;
end;
$$;
create trigger place_new_pen before insert on public.pens for each row execute function public.place_new_pen();

-- A blocked pen takes no animals: no transfers or purchases into it. Piglets born there to a sow
-- already in the pen are still recorded.
create or replace function public.guard_blocked_pen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pen pens;
begin
  if new.pen_id is null or new.removed_at is not null or (tg_op = 'UPDATE' and new.pen_id is not distinct from old.pen_id) then
    return new;
  end if;
  select * into v_pen from pens where id = new.pen_id;
  if v_pen.blocked and (tg_op = 'UPDATE' or not exists (
    select 1 from animals where pen_id = new.pen_id and removed_at is null and tag = new.parents
  )) then
    raise exception 'O curral % está vedado e não pode receber animais.', v_pen.name;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_blocked_pen() from public, anon, authenticated;
create trigger guard_blocked_pen before insert or update of pen_id on public.animals
for each row execute function public.guard_blocked_pen();

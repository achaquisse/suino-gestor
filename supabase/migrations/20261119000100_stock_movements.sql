-- Stock ledger: every change to stock_items.qty is recorded in stock_movements by a trigger, so
-- the history is complete whatever changed the quantity (manual entries/exits, counts, purchases,
-- treatments, direct edits). Callers label the change with stock_context(); unlabelled changes
-- are recorded as "Stock inicial" (new item) or "Ajuste".

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  item_id uuid not null references public.stock_items (id) on delete cascade,
  moved_on date not null default current_date,
  reason text not null,
  delta numeric(12, 2) not null check (delta <> 0),
  qty_after numeric(10, 2) not null,
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index stock_movements_item_idx on public.stock_movements (item_id, moved_on desc, created_at desc);
create index stock_movements_farm_idx on public.stock_movements (farm_id, moved_on desc, created_at desc);

-- Read-only for members: rows are written only by the trigger below.
alter table public.stock_movements enable row level security;
create policy "stock_movements: members read" on public.stock_movements for select using (public.is_member(farm_id));

-- Existing quantities become the opening balance of each item.
insert into public.stock_movements (farm_id, item_id, moved_on, reason, delta, qty_after, created_by, created_at)
select farm_id, id, created_at::date, 'Stock inicial', qty, qty, null, created_at
from public.stock_items where qty > 0;

-- Labels the next stock changes in this transaction.
create or replace function public.stock_context(p_reason text, p_note text default '', p_date date default current_date, p_by text default null)
returns void
language sql
as $$
  select set_config('app.stock_reason', coalesce(p_reason, ''), true),
         set_config('app.stock_note', coalesce(p_note, ''), true),
         set_config('app.stock_date', coalesce(p_date, current_date)::text, true),
         set_config('app.stock_by', coalesce(p_by, ''), true);
$$;

create or replace function public.log_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric := new.qty - case when tg_op = 'INSERT' then 0 else old.qty end;
  v_reason text := nullif(current_setting('app.stock_reason', true), '');
  v_date text := nullif(current_setting('app.stock_date', true), '');
begin
  if v_delta = 0 then
    return new;
  end if;
  insert into stock_movements (farm_id, item_id, moved_on, reason, delta, qty_after, note, created_by_name)
  values (new.farm_id, new.id, coalesce(v_date::date, current_date),
    coalesce(v_reason, case when tg_op = 'INSERT' then 'Stock inicial' else 'Ajuste' end),
    v_delta, new.qty, coalesce(current_setting('app.stock_note', true), ''),
    coalesce(nullif(current_setting('app.stock_by', true), ''), public.my_name(new.farm_id), ''));
  return new;
end;
$$;
revoke execute on function public.log_stock_movement() from public, anon, authenticated;

create trigger stock_movement after insert or update of qty on public.stock_items
for each row execute function public.log_stock_movement();

-- ---------------------------------------------------------------------------
-- Manual entries and exits
-- ---------------------------------------------------------------------------
create or replace function public.stock_reasons(p_kind text)
returns text[]
language sql
immutable
as $$
  select case p_kind
    when 'in' then array['Entrada', 'Doação', 'Devolução']
    when 'out' then array['Consumo', 'Perda ou dano', 'Expirado', 'Oferta', 'Outra saída']
  end;
$$;

-- p_kind: 'in' adds p_qty, 'out' removes it. Returns the new quantity.
create or replace function public.move_stock(
  p_farm uuid, p_item uuid, p_kind text, p_qty numeric, p_reason text, p_note text default '',
  p_date date default current_date, p_by text default null
)
returns numeric
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_item public.stock_items;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if p_kind not in ('in', 'out') then
    raise exception 'Indique se é uma entrada ou uma saída.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Indique uma quantidade maior que zero.';
  end if;
  if not coalesce(p_reason = any (public.stock_reasons(p_kind)), false) then
    raise exception 'Escolha um motivo válido.';
  end if;
  if p_date is null or p_date > current_date then
    raise exception 'A data não pode ser no futuro.';
  end if;
  select * into v_item from public.stock_items where id = p_item and farm_id = p_farm for update;
  if v_item.id is null then
    raise exception 'Artigo não encontrado.';
  end if;
  if not v_item.active then
    raise exception 'Este artigo está desactivado.';
  end if;
  if p_kind = 'out' and p_qty > v_item.qty then
    raise exception 'Quantidade insuficiente: há apenas % % em stock.', trim(to_char(v_item.qty, 'FM999999990.##')), v_item.unit;
  end if;
  perform public.stock_context(p_reason, trim(coalesce(p_note, '')), p_date, v_by);
  update public.stock_items set qty = qty + case when p_kind = 'in' then p_qty else -p_qty end
  where id = p_item returning * into v_item;
  return v_item.qty;
end;
$$;

-- Physical count: sets the quantity to what was counted and records the difference.
create or replace function public.count_stock(
  p_farm uuid, p_item uuid, p_count numeric, p_note text default '',
  p_date date default current_date, p_by text default null
)
returns numeric
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_item public.stock_items;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if p_count is null or p_count < 0 then
    raise exception 'Indique a quantidade contada.';
  end if;
  if p_date is null or p_date > current_date then
    raise exception 'A data não pode ser no futuro.';
  end if;
  select * into v_item from public.stock_items where id = p_item and farm_id = p_farm for update;
  if v_item.id is null then
    raise exception 'Artigo não encontrado.';
  end if;
  if v_item.qty = round(p_count, 2) then
    raise exception 'A contagem coincide com o stock actual.';
  end if;
  perform public.stock_context('Contagem', trim(coalesce(p_note, '')), p_date, v_by);
  update public.stock_items set qty = round(p_count, 2) where id = p_item returning * into v_item;
  return v_item.qty;
end;
$$;

-- ---------------------------------------------------------------------------
-- Label the existing paths that change stock
-- ---------------------------------------------------------------------------
create or replace function public.apply_manual_stock_purchase()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.stock_quantity is not null then
    if new.source <> 'stock' or new.source_id is null or new.quantity is null or new.amount >= 0 then
      raise exception 'Indique uma compra válida para este artigo de stock.';
    end if;
    perform public.stock_context('Compra', new.title, new.tx_date, new.created_by_name);
    update public.stock_items set qty = qty + new.stock_quantity
    where id = new.source_id and farm_id = new.farm_id and category = new.category and unit = new.quantity_unit;
    if not found then
      raise exception 'Artigo de stock não encontrado ou unidade incompatível.';
    end if;
  elsif tg_op = 'DELETE' and old.stock_quantity is not null then
    perform public.stock_context('Compra anulada', old.title, current_date, null);
    update public.stock_items set qty = qty - old.stock_quantity
    where id = old.source_id and farm_id = old.farm_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.log_treatment(
  p_farm uuid,
  p_animal_ids uuid[],
  p_product text,
  p_product_name text,
  p_withdrawal_days int default 0,
  p_stock_code text default null,
  p_date date default current_date,
  p_by text default null
)
returns int
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_until date := case when coalesce(p_withdrawal_days, 0) > 0 then p_date + p_withdrawal_days end;
  v_n int;
  v_pen_names text;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if coalesce(array_length(p_animal_ids, 1), 0) = 0 then
    raise exception 'Seleccione pelo menos um animal.';
  end if;

  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, show_in_calendar, created_by_name)
  select p_farm, p_date, 'health', 'Tratado · ' || p_product_name,
    case when v_until is null then 'Sem carência' else 'Carência até ' || public.pt_short(v_until) end,
    a.id, a.pen_id, jsonb_build_object('type', 'treatment', 'product', p_product), false, v_by
  from public.animals a
  where a.farm_id = p_farm and a.id = any (p_animal_ids) and a.removed_at is null;
  get diagnostics v_n = row_count;

  select string_agg(distinct pn.name, ', ') into v_pen_names
  from public.animals a join public.pens pn on pn.id = a.pen_id
  where a.id = any (p_animal_ids);

  insert into public.events (farm_id, event_date, kind, title, detail, meta, created_by_name)
  values (p_farm, p_date, 'health', p_product_name,
    coalesce(v_pen_names || ' · ', '') || v_n || case when v_n = 1 then ' animal' else ' animais' end,
    jsonb_build_object('type', 'treatment', 'product', p_product), v_by);

  if v_until is not null then
    update public.animals
    set status = 'Carência até ' || public.pt_short(greatest(coalesce(withdrawal_until, v_until), v_until)),
        tone = 'amber',
        withdrawal_until = greatest(coalesce(withdrawal_until, v_until), v_until)
    where farm_id = p_farm and id = any (p_animal_ids);
  else
    update public.animals
    set status = 'Saudável', tone = 'neutral'
    where farm_id = p_farm and id = any (p_animal_ids) and status ilike '%em atraso%';
  end if;

  if p_stock_code is not null then
    perform public.stock_context('Tratamento', p_product_name, p_date, v_by);
    update public.stock_items set qty = greatest(0, qty - 1) where farm_id = p_farm and code = p_stock_code and qty > 0;
  end if;

  update public.tasks
  set done_at = now(), done_by = v_by
  where farm_id = p_farm
    and done_at is null
    and action = 'treatment:' || p_product
    and (pen_id is null or pen_id in (select pen_id from public.animals where id = any (p_animal_ids)));

  return v_n;
end;
$$;

create or replace function public.log_stock_purchase(
  p_farm uuid, p_item uuid, p_qty numeric, p_price numeric, p_supplier text, p_account uuid,
  p_date date default current_date, p_by text default null
)
returns numeric
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_item public.stock_items;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker']);
  if p_qty is null or p_qty <= 0 then
    raise exception 'Indique a quantidade.';
  end if;
  perform public.stock_context('Compra', coalesce(nullif(trim(p_supplier), ''), ''), p_date, v_by);
  update public.stock_items set qty = qty + p_qty where id = p_item and farm_id = p_farm returning * into v_item;
  if v_item.id is null then
    raise exception 'Artigo não encontrado.';
  end if;
  if coalesce(p_price, 0) > 0 then
    if not public.has_role(p_farm, array['owner']) then
      raise exception 'Só o proprietário pode lançar despesas.' using errcode = '42501';
    end if;
    insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, source, source_id, notes, created_by_name, quantity, quantity_unit, unit_price)
    values (p_farm, p_date, v_item.name || ' · ' || trim(to_char(p_qty, 'FM999999990.##')) || ' ' || v_item.unit,
      p_account, 'Pontual', v_item.category, -p_price, 'stock', p_item, coalesce(p_supplier, ''), v_by,
      p_qty, v_item.unit, round(p_price / p_qty, 2));
  end if;
  return v_item.qty;
end;
$$;

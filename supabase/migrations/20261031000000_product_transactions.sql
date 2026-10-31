alter table public.categories
  add column item_type text not null default 'Serviço' check (item_type in ('Serviço', 'Produto')),
  add column quantity_unit text not null default '',
  add column baseline_price numeric(14, 2) check (baseline_price >= 0),
  add constraint category_product_unit check (item_type = 'Serviço' or (length(trim(coalesce(quantity_unit, ''))) > 0 and coalesce(baseline_price, 0) > 0));

alter table public.transactions
  add column quantity numeric(14, 3) check (quantity > 0),
  add column quantity_unit text,
  add column unit_price numeric(14, 2) check (unit_price >= 0),
  add constraint transaction_product_fields check (
    (quantity is null and quantity_unit is null and unit_price is null)
    or (quantity is not null and length(trim(coalesce(quantity_unit, ''))) > 0 and unit_price is not null)
  );

create or replace function public.log_sale(
  p_farm uuid, p_animal uuid, p_kg numeric, p_price_per_kg numeric, p_buyer text, p_account uuid,
  p_date date default current_date, p_by text default null, p_batch uuid default null
)
returns numeric
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_a public.animals;
  v_amount numeric;
begin
  perform public.require_role(p_farm, array['owner']);
  if p_kg is null or p_kg <= 0 then
    raise exception 'Indique o peso vivo.';
  end if;
  if p_price_per_kg is null or p_price_per_kg <= 0 then
    raise exception 'Indique o preço por kg.';
  end if;
  select * into v_a from public.animals where id = p_animal and farm_id = p_farm and removed_at is null;
  if v_a.id is null then
    raise exception 'Animal não encontrado.';
  end if;
  if v_a.withdrawal_until is not null and v_a.withdrawal_until >= p_date then
    raise exception 'Animal em período de carência · venda bloqueada.';
  end if;
  v_amount := round(p_kg * p_price_per_kg);

  insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, batch_id, source, source_id, created_by_name, quantity, quantity_unit, unit_price)
  values (p_farm, p_date,
    'Venda · ' || v_a.tag || ', ' || replace(round(p_kg, 1)::text, '.', ',') || ' kg'
      || case when coalesce(trim(p_buyer), '') <> '' then ' · ' || trim(p_buyer) else '' end,
    p_account, 'Venda', 'Venda de animais', v_amount, p_batch, 'sale', p_animal, v_by, p_kg, 'kg', p_price_per_kg);

  update public.animals set removed_at = p_date, removed_reason = 'sale', status = 'Vendido', tone = 'neutral', weight_kg = p_kg
  where id = p_animal;

  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, created_by_name)
  values (p_farm, p_date, 'money', 'Venda · ' || v_a.tag, '+' || public.fmt_mt(v_amount) || ' MT', p_animal, v_a.pen_id,
    jsonb_build_object('type', 'sale', 'amount', v_amount), v_by);
  return v_amount;
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

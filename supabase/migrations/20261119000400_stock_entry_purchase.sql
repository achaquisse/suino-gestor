-- A stock entry of type "Compra" also records the purchase expense in Finanças.
-- The expense row carries stock_quantity, so the existing transactions trigger adds the stock
-- (and removes it again if the expense is deleted), keeping the ledger and the finances in step.
-- Entries without a cost are "Doação" or "Devolução"; the cost-free "Entrada" is no longer offered.

create or replace function public.stock_reasons(p_kind text)
returns text[]
language sql
immutable
as $$
  select case p_kind
    when 'in' then array['Compra', 'Doação', 'Devolução']
    when 'out' then array['Consumo', 'Perda ou dano', 'Expirado', 'Oferta', 'Outra saída']
  end;
$$;

drop function if exists public.move_stock(uuid, uuid, text, numeric, text, text, date, text);

-- p_kind: 'in' adds p_qty, 'out' removes it. A purchase ('in' + 'Compra') needs p_price (total, MT)
-- and p_account, and creates the expense. Returns the new quantity.
create or replace function public.move_stock(
  p_farm uuid, p_item uuid, p_kind text, p_qty numeric, p_reason text, p_note text default '',
  p_date date default current_date, p_by text default null,
  p_price numeric default null, p_account uuid default null, p_supplier text default ''
)
returns numeric
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_item public.stock_items;
  v_note text := trim(coalesce(p_note, ''));
  v_supplier text := trim(coalesce(p_supplier, ''));
  v_purchase boolean := p_kind = 'in' and p_reason = 'Compra';
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

  if v_purchase then
    if not public.has_role(p_farm, array['owner']) then
      raise exception 'Só o proprietário pode registar compras, porque geram uma despesa.' using errcode = '42501';
    end if;
    if p_price is null or round(p_price, 2) <= 0 then
      raise exception 'Indique o preço total da compra.';
    end if;
    if not exists (select 1 from public.accounts where id = p_account and farm_id = p_farm and active) then
      raise exception 'Escolha a conta que paga a compra.';
    end if;
    -- The stock is added by the manual_stock_purchase trigger on this row.
    insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, source, source_id,
      notes, created_by_name, quantity, quantity_unit, unit_price, stock_quantity)
    values (p_farm, p_date,
      v_item.name || ' · ' || trim(to_char(p_qty, 'FM999999990.##')) || ' ' || v_item.unit
        || case when v_supplier <> '' then ' · ' || v_supplier else '' end,
      p_account, 'Pontual', v_item.category, -round(p_price, 2), 'stock', v_item.id,
      v_note, v_by, p_qty, v_item.unit, round(p_price / p_qty, 2), p_qty);
  else
    perform public.stock_context(p_reason, v_note, p_date, v_by);
    update public.stock_items set qty = qty + case when p_kind = 'in' then p_qty else -p_qty end where id = p_item;
  end if;

  select qty into v_item.qty from public.stock_items where id = p_item;
  return v_item.qty;
end;
$$;

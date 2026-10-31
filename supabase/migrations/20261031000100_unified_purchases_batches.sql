alter table public.transactions
  add column batch_ids uuid[] not null default '{}',
  add column batch_allocations jsonb not null default '[]'::jsonb,
  add column stock_quantity numeric(14, 3) check (stock_quantity > 0),
  add constraint valid_batch_allocations check (jsonb_typeof(batch_allocations) = 'array');

create or replace function public.validate_transaction_batches()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from unnest(new.batch_ids) id
    where not exists (select 1 from public.batches b where b.id = id and b.farm_id = new.farm_id)
  ) then
    raise exception 'Lote não pertence à exploração.';
  end if;
  if jsonb_array_length(new.batch_allocations) > 0 and (
    exists (
      select 1 from jsonb_array_elements(new.batch_allocations) a
      where not exists (select 1 from public.batches b where b.id::text = a->>'batch_id' and b.farm_id = new.farm_id)
        or not (a->>'batch_id')::uuid = any(new.batch_ids)
        or jsonb_typeof(a->'amount') <> 'number'
    ) or (select sum((a->>'amount')::numeric) from jsonb_array_elements(new.batch_allocations) a) <> new.amount
    or (select count(distinct a->>'batch_id') from jsonb_array_elements(new.batch_allocations) a) <> jsonb_array_length(new.batch_allocations)
  ) then
    raise exception 'A distribuição por lote deve corresponder ao movimento e aos lotes seleccionados.';
  end if;
  return new;
end;
$$;

create trigger validate_transaction_batches before insert or update on public.transactions
for each row execute function public.validate_transaction_batches();

create or replace function public.apply_manual_stock_purchase()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.stock_quantity is not null then
    if new.source <> 'stock' or new.source_id is null or new.quantity is null or new.amount >= 0 then
      raise exception 'Indique uma compra válida para este artigo de stock.';
    end if;
    update public.stock_items set qty = qty + new.stock_quantity
    where id = new.source_id and farm_id = new.farm_id and category = new.category and unit = new.quantity_unit;
    if not found then
      raise exception 'Artigo de stock não encontrado ou unidade incompatível.';
    end if;
  elsif tg_op = 'DELETE' and old.stock_quantity is not null then
    update public.stock_items set qty = qty - old.stock_quantity
    where id = old.source_id and farm_id = old.farm_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger manual_stock_purchase after insert or delete on public.transactions
for each row execute function public.apply_manual_stock_purchase();

create or replace view public.batch_results with (security_invoker = true) as
select
  b.id, b.farm_id, b.code, b.phase, b.head_count, b.active,
  b.opening_cost
    + coalesce((select sum(-t.amount) from public.transactions t where t.batch_id = b.id and t.amount < 0), 0)
    + coalesce((select sum(-((allocation.value->>'amount')::numeric))
      from public.transactions t, jsonb_array_elements(t.batch_allocations) allocation(value)
      where t.farm_id = b.farm_id and allocation.value->>'batch_id' = b.id::text
        and (allocation.value->>'amount')::numeric < 0), 0) as cost,
  b.opening_revenue
    + coalesce((select sum(t.amount) from public.transactions t where t.batch_id = b.id and t.amount > 0 and t.kind = 'Venda'), 0)
    + coalesce((select sum((allocation.value->>'amount')::numeric)
      from public.transactions t, jsonb_array_elements(t.batch_allocations) allocation(value)
      where t.farm_id = b.farm_id and allocation.value->>'batch_id' = b.id::text
        and (allocation.value->>'amount')::numeric > 0), 0) as revenue
from public.batches b;

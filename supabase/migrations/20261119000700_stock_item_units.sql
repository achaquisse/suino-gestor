-- Stock items, simplified:
--   * the code is generated from the name (unique per farm) when none is given;
--   * the unit (singular + plural) comes from the item's category, set by the super admin
--     in the cost types; items follow their category's unit;
--   * validity is a number of days after each purchase (shelf_life_days); expires_on is derived.

-- ---------------------------------------------------------------------------
-- Units per category: quantity_unit is the plural, quantity_unit_singular the singular.
-- ---------------------------------------------------------------------------
alter table public.categories add column quantity_unit_singular text not null default '';
alter table public.stock_items add column unit_singular text not null default '';
alter table public.stock_items add column shelf_life_days int check (shelf_life_days > 0);
alter table public.stock_items alter column unit set default '';

-- "sacos" → "saco", "doses" → "dose", "L" → "L".
create or replace function public.unit_singular_of(p_plural text)
returns text
language sql
immutable
as $$
  select case when length(p_plural) > 2 and right(p_plural, 1) = 's' then left(p_plural, -1) else coalesce(p_plural, '') end;
$$;

update public.stock_items set unit_singular = public.unit_singular_of(unit);

-- Categories used by stock take the most common unit of their items.
update public.categories c
set quantity_unit = u.unit
from (
  select distinct on (farm_id, category) farm_id, category, unit
  from public.stock_items
  where unit <> ''
  group by farm_id, category, unit
  order by farm_id, category, count(*) desc, unit
) u
where c.farm_id = u.farm_id and c.name = u.category and c.quantity_unit = '';
update public.categories set quantity_unit_singular = public.unit_singular_of(quantity_unit)
where quantity_unit <> '' and quantity_unit_singular = '';

-- ---------------------------------------------------------------------------
-- Code from the name
-- ---------------------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_text, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Before insert/update: code, unit from the category, expiry from the shelf life.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_stock_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_code text;
  v_n int := 1;
  v_plural text;
  v_singular text;
  v_reason text := nullif(current_setting('app.stock_reason', true), '');
  v_date date := coalesce(nullif(current_setting('app.stock_date', true), '')::date, current_date);
begin
  if tg_op = 'INSERT' and coalesce(trim(new.code), '') = '' then
    v_base := coalesce(nullif(left(public.slugify(new.name), 40), ''), 'artigo');
    v_code := v_base;
    while exists (select 1 from stock_items where farm_id = new.farm_id and code = v_code) loop
      v_n := v_n + 1;
      v_code := v_base || '-' || v_n;
    end loop;
    new.code := v_code;
  end if;

  -- The unit follows the category: on insert when none is given, and when the category changes.
  if (tg_op = 'INSERT' and coalesce(new.unit, '') = '') or (tg_op = 'UPDATE' and new.category is distinct from old.category) then
    select nullif(quantity_unit, ''), nullif(quantity_unit_singular, '') into v_plural, v_singular
    from categories where farm_id = new.farm_id and name = new.category;
    if v_plural is not null then
      new.unit := v_plural;
      new.unit_singular := coalesce(v_singular, public.unit_singular_of(v_plural));
    elsif coalesce(new.unit, '') = '' then
      raise exception 'A categoria % não tem unidade definida. Peça ao administrador para a definir nos tipos de custo.', new.category;
    elsif coalesce(new.unit_singular, '') = '' then
      new.unit_singular := public.unit_singular_of(new.unit);
    end if;
  elsif coalesce(new.unit_singular, '') = '' then
    new.unit_singular := public.unit_singular_of(new.unit);
  end if;

  -- Expiry: days after the purchase. A new lot sets it when the stock was empty; otherwise the
  -- earliest date is kept, so the alert errs on the early side.
  if new.shelf_life_days is not null then
    if tg_op = 'INSERT' and new.qty > 0 and new.expires_on is null then
      new.expires_on := v_date + new.shelf_life_days;
    elsif tg_op = 'UPDATE' and new.qty > old.qty and coalesce(v_reason, '') in ('Compra', 'Doação') then
      new.expires_on := case when old.qty <= 0 or old.expires_on is null then v_date + new.shelf_life_days
                             else least(old.expires_on, v_date + new.shelf_life_days) end;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.qty <= 0 and old.qty > 0 and new.shelf_life_days is not null then
    new.expires_on := null; -- nothing left to expire
  end if;
  return new;
end;
$$;
revoke execute on function public.prepare_stock_item() from public, anon, authenticated;

create trigger prepare_stock_item before insert or update on public.stock_items
for each row execute function public.prepare_stock_item();

-- Changing a category's unit updates the items that used it.
create or replace function public.sync_category_stock_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quantity_unit is distinct from old.quantity_unit or new.quantity_unit_singular is distinct from old.quantity_unit_singular then
    if new.quantity_unit <> '' then
      update stock_items set unit = new.quantity_unit,
        unit_singular = coalesce(nullif(new.quantity_unit_singular, ''), public.unit_singular_of(new.quantity_unit))
      where farm_id = new.farm_id and category = new.name and (unit = old.quantity_unit or old.quantity_unit = '');
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_category_stock_unit() from public, anon, authenticated;

create trigger sync_category_stock_unit after update on public.categories
for each row execute function public.sync_category_stock_unit();

-- New farms get units on their stock categories.
create or replace function public.seed_defaults(p_farm uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into categories (farm_id, name, grp, color, description) values
    (p_farm, 'Ração', 'Investimento', '#5B4CF0', 'Inicial, crescimento, acabamento e porcas'),
    (p_farm, 'Medicamentos', 'Investimento', '#3BA9C7', 'Vacinas, desparasitantes, ferro'),
    (p_farm, 'Veterinário', 'Investimento', '#E0607A', 'Consultas e assistência'),
    (p_farm, 'Animais', 'Investimento', '#C1579B', 'Compra de leitões e reprodutores'),
    (p_farm, 'Infra-estrutura', 'Investimento', '#2FA684', 'Obras e equipamentos · fora do resultado'),
    (p_farm, 'Mão-de-obra', 'Operacional', '#E8A23A', 'Salários e diárias'),
    (p_farm, 'Materiais', 'Operacional', '#9A9AAE', 'Desinfectante, ferramentas, consumíveis'),
    (p_farm, 'Transporte', 'Operacional', '#A88BF2', 'Fretes de ração e animais'),
    (p_farm, 'Energia e água', 'Operacional', '#4DB6D0', 'Electricidade, bomba de água'),
    (p_farm, 'Venda de animais', 'Receita', '#15A05A', 'Vendas de porcos e leitões'),
    (p_farm, 'Injeção de capital', 'Receita', '#6FCF9F', 'Capital injetado por investidores'),
    (p_farm, 'Outras receitas', 'Receita', '#7BC6B0', 'Estrume, aluguer de varrasco, outros'),
    (p_farm, 'Pagamento de dívida', 'Dívida', '#7A7A90', 'Prestações de empréstimos e créditos')
  on conflict do nothing;

  insert into parameters (farm_id, key, name, grp, value, unit, description) values
    (p_farm, 'gestation_days', 'Duração da gestação', 'Reprodução', 114, 'dias', 'Usado para prever partos'),
    (p_farm, 'weaning_age_days', 'Idade ao desmame', 'Reprodução', 21, 'dias', 'Lembrete de desmame da ninhada'),
    (p_farm, 'wean_to_heat_days', 'Intervalo desmame–cio', 'Reprodução', 5, 'dias', 'Alerta para observar cio'),
    (p_farm, 'target_sale_kg', 'Peso alvo de venda', 'Crescimento', 100, 'kg', 'Animais acima deste peso ficam prontos'),
    (p_farm, 'adg_kg', 'Ganho médio diário esperado', 'Crescimento', 0.75, 'kg/dia', 'Referência para alertas de crescimento'),
    (p_farm, 'price_per_kg', 'Preço por kg vivo', 'Vendas', 70, 'MT/kg', 'Sugerido ao registar vendas'),
    (p_farm, 'piglet_price', 'Preço por leitão', 'Vendas', 2500, 'MT', 'Sugerido ao vender leitões'),
    (p_farm, 'feed_min_bags', 'Stock mínimo de ração', 'Stock', 5, 'sacos', 'Abaixo disto gera alerta'),
    (p_farm, 'expiry_notice_days', 'Antecedência de validade', 'Stock', 30, 'dias', 'Aviso antes de expirar'),
    (p_farm, 'mortality_alert_pct', 'Mortalidade de alerta', 'Saúde', 5, '%', 'Por lote, no período'),
    (p_farm, 'parvo_revax_days', 'Revacinação parvovirose', 'Saúde', 180, 'dias', 'Intervalo entre doses'),
    (p_farm, 'vat_pct', 'IVA', 'Finanças', 16, '%', 'Aplicado em facturas')
  on conflict do nothing;

  insert into accounts (farm_id, name, kind, holder, initial_balance, color)
  values (p_farm, 'Vendas', 'Operacional', 'Conta operacional', 0, '#5B4CF0')
  on conflict do nothing;
  -- Units for the categories that stock items use.
  update categories c set quantity_unit = u.plural, quantity_unit_singular = u.singular
  from (values ('Ração', 'saco', 'sacos'), ('Medicamentos', 'frasco', 'frascos'), ('Materiais', 'unidade', 'unidades')) as u(name, singular, plural)
  where c.farm_id = p_farm and c.name = u.name and c.quantity_unit = '';
end;
$$;

-- Existing farms: the same defaults where the category still has no unit.
update public.categories c set quantity_unit = u.plural, quantity_unit_singular = u.singular
from (values ('Ração', 'saco', 'sacos'), ('Medicamentos', 'frasco', 'frascos'), ('Materiais', 'unidade', 'unidades')) as u(name, singular, plural)
where c.name = u.name and c.quantity_unit = '';

-- Suino Gestor RPCs: farm lifecycle + atomic farm operations.

create or replace function public.pt_short(d date)
returns text
language sql
immutable
as $$
  select extract(day from d)::int || ' '
    || (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from d)::int];
$$;

create or replace function public.fmt_mt(v numeric)
returns text
language sql
immutable
as $$
  select replace(to_char(round(abs(v)), 'FM999G999G999G990'), ',', ' ');
$$;

create or replace function public.my_name(p_farm uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(fm.display_name, ''), nullif(p.full_name, ''), p.email, '')
  from farm_members fm
  left join profiles p on p.id = fm.user_id
  where fm.farm_id = p_farm and fm.user_id = auth.uid();
$$;

create or replace function public.param(p_farm uuid, p_key text, p_default numeric)
returns numeric
language sql
stable
as $$
  select coalesce((select value from public.parameters where farm_id = p_farm and key = p_key), p_default);
$$;

create or replace function public.require_role(p_farm uuid, p_roles text[])
returns void
language plpgsql
stable
as $$
begin
  if not public.has_role(p_farm, p_roles) then
    raise exception 'Não tem permissão para esta acção.' using errcode = '42501';
  end if;
end;
$$;

-- Split an amount across [{account_id, pct}] rows; the last row takes the remainder.
create or replace function public.split_amounts(p_splits jsonb, p_default_account uuid, p_amount numeric)
returns table (account_id uuid, amount numeric)
language plpgsql
immutable
as $$
declare
  v_left numeric := p_amount;
  v_n int := coalesce(jsonb_array_length(p_splits), 0);
  v_i int := 0;
  v_row jsonb;
  v_amt numeric;
begin
  if v_n <= 1 then
    account_id := coalesce((p_splits -> 0 ->> 'account_id')::uuid, p_default_account);
    amount := p_amount;
    return next;
    return;
  end if;
  for v_row in select * from jsonb_array_elements(p_splits) loop
    v_i := v_i + 1;
    if v_i = v_n then
      v_amt := v_left;
    else
      v_amt := round(p_amount * (v_row ->> 'pct')::numeric / 100, 2);
      v_left := v_left - v_amt;
    end if;
    account_id := (v_row ->> 'account_id')::uuid;
    amount := v_amt;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Defaults shared by new farms and the demo farm
-- ---------------------------------------------------------------------------
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
    (p_farm, 'Aporte', 'Receita', '#6FCF9F', 'Capital aportado por investidores'),
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
end;
$$;

-- ---------------------------------------------------------------------------
-- Farm lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.create_farm(p_name text, p_demo boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_farm uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Indique o nome da granja.';
  end if;
  select coalesce(nullif(full_name, ''), email) into v_name from profiles where id = v_uid;

  insert into farms (name, created_by) values (trim(p_name), v_uid) returning id into v_farm;
  insert into farm_members (farm_id, user_id, role, display_name) values (v_farm, v_uid, 'owner', coalesce(v_name, ''));
  perform seed_defaults(v_farm);
  if p_demo then
    perform seed_demo(v_farm, coalesce(v_name, 'Proprietário'));
  end if;
  return v_farm;
end;
$$;

create or replace function public.accept_invites()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name text;
  v_n int;
begin
  if v_uid is null or v_email = '' then
    return 0;
  end if;
  select coalesce(nullif(full_name, ''), email) into v_name from profiles where id = v_uid;
  insert into farm_members (farm_id, user_id, role, display_name)
  select i.farm_id, v_uid, i.role, coalesce(nullif(i.name, ''), v_name, '')
  from farm_invites i
  where lower(i.email) = v_email and i.accepted_at is null
  on conflict (farm_id, user_id) do nothing;
  get diagnostics v_n = row_count;
  update farm_invites set accepted_at = now() where lower(email) = v_email and accepted_at is null;
  return v_n;
end;
$$;

create or replace function public.update_my_membership(p_farm uuid, p_prefs jsonb default null, p_display_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update farm_members
  set prefs = coalesce(p_prefs, prefs),
      display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where farm_id = p_farm and user_id = auth.uid();
  if not found then
    raise exception 'Não é membro desta granja.' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Herd operations
-- ---------------------------------------------------------------------------
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
    update public.stock_items set qty = greatest(0, qty - 1) where farm_id = p_farm and code = p_stock_code;
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

create or replace function public.log_illness(
  p_farm uuid,
  p_animal uuid,
  p_symptoms text[],
  p_severity text default 'Ligeira',
  p_isolate boolean default false,
  p_notes text default '',
  p_date date default current_date,
  p_by text default null
)
returns void
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_status text;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if coalesce(array_length(p_symptoms, 1), 0) = 0 then
    raise exception 'Seleccione pelo menos um sintoma.';
  end if;
  v_status := array_to_string(p_symptoms, ', ') || case when p_isolate then ' · isolado' else '' end;

  update public.animals set status = v_status, tone = 'red'
  where farm_id = p_farm and id = p_animal and removed_at is null;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;

  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, created_by_name)
  select p_farm, p_date, 'health', 'Episódio de doença · ' || a.tag,
    lower(array_to_string(p_symptoms, ', ')) || ' · ' || lower(p_severity)
      || case when p_isolate then ' · isolado' else '' end
      || case when coalesce(trim(p_notes), '') <> '' then ' · ' || trim(p_notes) else '' end,
    a.id, a.pen_id,
    jsonb_build_object('type', 'illness', 'symptoms', p_symptoms, 'severity', p_severity, 'isolated', p_isolate),
    v_by
  from public.animals a where a.id = p_animal;
end;
$$;

create or replace function public.log_weight(
  p_farm uuid,
  p_animal uuid,
  p_kg numeric,
  p_date date default current_date,
  p_by text default null
)
returns void
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if p_kg is null or p_kg <= 0 then
    raise exception 'Indique um peso válido, ex. 42,5.';
  end if;
  insert into public.weights (farm_id, animal_id, measured_on, kg) values (p_farm, p_animal, p_date, p_kg);
  update public.animals set weight_kg = p_kg where farm_id = p_farm and id = p_animal;
  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, show_in_calendar, created_by_name)
  select p_farm, p_date, 'task', 'Pesado', replace(round(p_kg, 1)::text, '.', ',') || ' kg', a.id, a.pen_id,
    jsonb_build_object('type', 'weight', 'kg', p_kg), false, v_by
  from public.animals a where a.id = p_animal;
end;
$$;

create or replace function public.log_transfer(
  p_farm uuid,
  p_animal uuid,
  p_from uuid,
  p_to uuid,
  p_date date default current_date,
  p_by text default null
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
    and (case when p_animal is not null then id = p_animal else pen_id = p_from end);
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

create or replace function public.log_birth(
  p_farm uuid,
  p_sow uuid,
  p_live int,
  p_dead int default 0,
  p_date date default current_date,
  p_by text default null
)
returns int
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_sow public.animals;
  v_pen_name text;
  v_prefix text;
  v_start int;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  if p_live is null or p_live < 0 or coalesce(p_dead, 0) < 0 then
    raise exception 'Número inválido.';
  end if;
  select * into v_sow from public.animals where id = p_sow and farm_id = p_farm and removed_at is null;
  if v_sow.id is null or v_sow.stage not in ('Porca', 'Leitoa') then
    raise exception 'Escolha uma porca.';
  end if;
  select name into v_pen_name from public.pens where id = v_sow.pen_id;

  v_prefix := 'L' || coalesce(nullif(ltrim(regexp_replace(v_sow.tag, '\D', '', 'g'), '0'), ''), '0') || '-';
  select coalesce(max(substring(tag from length(v_prefix) + 1)::int), 0) + 1 into v_start
  from public.animals where farm_id = p_farm and tag ~ ('^' || v_prefix || '\d+$');

  insert into public.animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone, parents)
  select p_farm, v_prefix || lpad((v_start + g - 1)::text, 2, '0'), v_sow.pen_id,
    case when g % 2 = 1 then 'Fêmea' else 'Macho' end, 'Leitão', v_sow.breed, p_date, 1.4,
    'Ferro a ' || public.pt_short(p_date + 2), 'neutral', v_sow.tag
  from generate_series(1, p_live) g;

  update public.animals set stage = 'Porca', status = 'Em lactação', tone = 'accent' where id = p_sow;

  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, created_by_name)
  values (p_farm, p_date, 'breeding', v_sow.tag || ' pariu',
    (p_live + coalesce(p_dead, 0)) || ' nascidos · ' || p_live || ' vivos'
      || case when coalesce(p_dead, 0) > 0 then ' · ' || p_dead || ' nados-mortos' else '' end,
    p_sow, v_sow.pen_id, jsonb_build_object('type', 'birth', 'live', p_live, 'dead', coalesce(p_dead, 0)), v_by);

  if p_live > 0 then
    insert into public.tasks (farm_id, title, location, pen_id, due_date, assignee, action)
    values (p_farm, 'Injecção de ferro · ninhada da ' || v_sow.tag,
      coalesce(v_pen_name, '') || ' · ' || p_live || ' leitões', v_sow.pen_id, p_date + 2, v_by, 'treatment:ferro');
  end if;
  return p_live;
end;
$$;

create or replace function public.log_mating(
  p_farm uuid,
  p_sow uuid,
  p_method text default 'Monta natural',
  p_boar text default null,
  p_date date default current_date,
  p_by text default null
)
returns date
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_sow public.animals;
  v_due date;
  v_mat uuid;
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  select * into v_sow from public.animals where id = p_sow and farm_id = p_farm and removed_at is null;
  if v_sow.id is null or v_sow.stage not in ('Porca', 'Leitoa') then
    raise exception 'Escolha uma porca.';
  end if;
  v_due := p_date + public.param(p_farm, 'gestation_days', 114)::int;

  update public.animals set status = 'Gestante · parto ' || public.pt_short(v_due), tone = 'neutral' where id = p_sow;

  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, created_by_name) values
    (p_farm, p_date, 'breeding', 'Coberta · ' || v_sow.tag,
      case when p_method = 'Monta natural' then 'Com ' || coalesce(p_boar, '—') || ' · monta natural' else 'Inseminação artificial' end,
      p_sow, v_sow.pen_id, jsonb_build_object('type', 'mating', 'method', p_method, 'boar', p_boar, 'due', v_due), v_by),
    (p_farm, p_date + 21, 'breeding', 'Verificar repetição de cio · ' || v_sow.tag, '21 dias após a cobrição',
      p_sow, v_sow.pen_id, jsonb_build_object('type', 'return_check'), v_by),
    (p_farm, v_due, 'breeding', v_sow.tag || ' com parto previsto', 'Gestação de ' || (v_due - p_date) || ' dias',
      p_sow, v_sow.pen_id, jsonb_build_object('type', 'due'), v_by);

  select id into v_mat from public.pens where farm_id = p_farm and kind ilike '%parto%' order by sort limit 1;
  insert into public.tasks (farm_id, title, location, pen_id, due_date, assignee, action)
  values (p_farm, 'Transferir ' || v_sow.tag || ' para a maternidade', coalesce((select name from public.pens where id = v_mat), 'Maternidade'),
    v_mat, v_due - 7, v_by, 'transfer');
  return v_due;
end;
$$;

create or replace function public.log_death(
  p_farm uuid,
  p_animal uuid,
  p_cause text default 'Desconhecida',
  p_date date default current_date,
  p_by text default null
)
returns void
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
begin
  perform public.require_role(p_farm, array['owner', 'caretaker', 'vet']);
  update public.animals set removed_at = p_date, removed_reason = 'death', status = 'Morto · ' || coalesce(nullif(p_cause, ''), 'Desconhecida'), tone = 'neutral'
  where farm_id = p_farm and id = p_animal and removed_at is null;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;
  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, created_by_name)
  select p_farm, p_date, 'health', 'Morte · ' || a.tag, 'Causa: ' || coalesce(nullif(p_cause, ''), 'Desconhecida'), a.id, a.pen_id,
    jsonb_build_object('type', 'death', 'cause', p_cause), v_by
  from public.animals a where a.id = p_animal;
end;
$$;

create or replace function public.log_sale(
  p_farm uuid,
  p_animal uuid,
  p_kg numeric,
  p_price_per_kg numeric,
  p_buyer text,
  p_account uuid,
  p_date date default current_date,
  p_by text default null,
  p_batch uuid default null
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

  insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, batch_id, source, source_id, created_by_name)
  values (p_farm, p_date,
    'Venda · ' || v_a.tag || ', ' || replace(round(p_kg, 1)::text, '.', ',') || ' kg'
      || case when coalesce(trim(p_buyer), '') <> '' then ' · ' || trim(p_buyer) else '' end,
    p_account, 'Venda', 'Venda de animais', v_amount, p_batch, 'sale', p_animal, v_by);

  update public.animals set removed_at = p_date, removed_reason = 'sale', status = 'Vendido', tone = 'neutral', weight_kg = p_kg
  where id = p_animal;

  insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, created_by_name)
  values (p_farm, p_date, 'money', 'Venda · ' || v_a.tag, '+' || public.fmt_mt(v_amount) || ' MT', p_animal, v_a.pen_id,
    jsonb_build_object('type', 'sale', 'amount', v_amount), v_by);
  return v_amount;
end;
$$;

create or replace function public.buy_animals(
  p_farm uuid,
  p_qty int,
  p_stage text,
  p_sex text,
  p_breed text,
  p_kg numeric,
  p_pen uuid,
  p_born date,
  p_supplier text,
  p_price numeric,
  p_account uuid,
  p_date date default current_date,
  p_by text default null
)
returns text[]
language plpgsql
as $$
declare
  v_by text := coalesce(nullif(p_by, ''), public.my_name(p_farm));
  v_free int;
  v_pen_name text;
  v_start int;
  v_born date;
  v_q date := p_date + 21;
  v_tags text[];
  v_sup text := coalesce(trim(p_supplier), '');
begin
  perform public.require_role(p_farm, array['owner']);
  if p_qty is null or p_qty < 1 then
    raise exception 'Indique a quantidade de animais.';
  end if;
  if p_kg is null or p_kg <= 0 then
    raise exception 'Indique o peso médio.';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'Indique o valor total da compra.';
  end if;
  if p_born is not null and p_born > current_date then
    raise exception 'A data de nascimento não pode ser no futuro.';
  end if;
  select pn.capacity - (select count(*) from public.animals a where a.pen_id = pn.id and a.removed_at is null), pn.name
  into v_free, v_pen_name
  from public.pens pn where pn.id = p_pen and pn.farm_id = p_farm;
  if v_pen_name is null then
    raise exception 'Curral não encontrado.';
  end if;
  if p_qty > v_free then
    raise exception '% só tem % lugares livres.', v_pen_name, v_free;
  end if;

  v_born := coalesce(p_born, p_date - case p_stage
    when 'Leitão' then 10 when 'Desmamado' then 42 when 'Recria' then 84 when 'Engorda' then 150
    when 'Leitoa' then 240 when 'Porca' then 600 else 700 end);

  select coalesce(max(substring(tag from 3)::int), 300) + 1 into v_start
  from public.animals where farm_id = p_farm and tag ~ '^C-\d+$';

  with ins as (
    insert into public.animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone, parents)
    select p_farm, 'C-' || (v_start + g - 1), p_pen,
      case when p_sex = 'Misto' then case when g % 2 = 0 then 'Macho' else 'Fêmea' end else p_sex end,
      p_stage, coalesce(p_breed, ''), v_born, p_kg, 'Quarentena até ' || public.pt_short(v_q), 'amber',
      'Compra' || case when v_sup <> '' then ' · ' || v_sup else '' end
    from generate_series(1, p_qty) g
    returning id, tag
  ), ev as (
    insert into public.events (farm_id, event_date, kind, title, detail, animal_id, pen_id, meta, show_in_calendar, created_by_name)
    select p_farm, p_date, 'task', 'Comprado', coalesce(nullif(v_sup, ''), 'Compra') || ' · quarentena até ' || public.pt_short(v_q),
      ins.id, p_pen, jsonb_build_object('type', 'purchase'), false, v_by
    from ins
    returning 1
  )
  select array_agg(tag order by tag) into v_tags from ins;

  insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, source, created_by_name)
  values (p_farm, p_date,
    'Compra de ' || p_qty || case when p_qty = 1 then ' animal' else ' animais' end || ' · ' || p_stage
      || case when v_sup <> '' then ' · ' || v_sup else '' end,
    p_account, 'Investimento', 'Animais', -p_price, 'buy_animals', v_by);

  insert into public.events (farm_id, event_date, kind, title, detail, pen_id, meta, created_by_name)
  values (p_farm, v_q, 'health', 'Fim da quarentena · ' || p_qty || ' animais', v_pen_name, p_pen, jsonb_build_object('type', 'quarantine'), v_by);

  return v_tags;
end;
$$;

create or replace function public.log_stock_purchase(
  p_farm uuid,
  p_item uuid,
  p_qty numeric,
  p_price numeric,
  p_supplier text,
  p_account uuid,
  p_date date default current_date,
  p_by text default null
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
    insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, source, source_id, notes, created_by_name)
    values (p_farm, p_date, v_item.name || ' · ' || trim(to_char(p_qty, 'FM999999990.##')) || ' ' || v_item.unit,
      p_account, 'Pontual', v_item.category, -p_price, 'stock', p_item, coalesce(p_supplier, ''), v_by);
  end if;
  return v_item.qty;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finance operations
-- ---------------------------------------------------------------------------
create or replace function public.pay_recurring(p_id uuid, p_date date default current_date)
returns date
language plpgsql
as $$
declare
  v_r public.recurring_expenses;
  v_next date;
  v_by text;
begin
  select * into v_r from public.recurring_expenses where id = p_id;
  if v_r.id is null then
    raise exception 'Despesa recorrente não encontrada.';
  end if;
  perform public.require_role(v_r.farm_id, array['owner']);
  v_by := public.my_name(v_r.farm_id);

  insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, source, source_id, created_by_name)
  select v_r.farm_id, p_date, v_r.name, s.account_id, 'Recorrente', v_r.category, -s.amount, 'recurring', v_r.id, v_by
  from public.split_amounts(v_r.splits, v_r.account_id, v_r.amount) s;

  v_next := case v_r.frequency
    when 'Semanal' then v_r.next_due + 7
    when 'Mensal' then (v_r.next_due + interval '1 month')::date
    when 'Trimestral' then (v_r.next_due + interval '3 months')::date
    else (v_r.next_due + interval '1 year')::date end;
  update public.recurring_expenses set next_due = v_next where id = p_id;
  return v_next;
end;
$$;

create or replace function public.pay_debt(p_id uuid, p_amount numeric default null, p_date date default current_date)
returns numeric
language plpgsql
as $$
declare
  v_d public.debts;
  v_amt numeric;
  v_by text;
begin
  select * into v_d from public.debts where id = p_id;
  if v_d.id is null then
    raise exception 'Dívida não encontrada.';
  end if;
  perform public.require_role(v_d.farm_id, array['owner']);
  if v_d.paid >= v_d.total then
    raise exception 'Esta dívida já está liquidada.';
  end if;
  v_amt := least(coalesce(p_amount, v_d.installment), v_d.total - v_d.paid);
  if v_amt <= 0 then
    raise exception 'Indique um valor válido.';
  end if;
  v_by := public.my_name(v_d.farm_id);

  insert into public.transactions (farm_id, tx_date, title, account_id, kind, category, amount, source, source_id, created_by_name)
  select v_d.farm_id, p_date, 'Prestação · ' || v_d.creditor, s.account_id, 'Dívida', 'Pagamento de dívida', -s.amount, 'debt', v_d.id, v_by
  from public.split_amounts(v_d.splits, v_d.account_id, v_amt) s;

  update public.debts
  set paid = paid + v_amt,
      next_due = case when paid + v_amt >= total then null else (coalesce(next_due, p_date) + interval '1 month')::date end
  where id = p_id;
  return v_d.total - v_d.paid - v_amt;
end;
$$;

grant execute on all functions in schema public to authenticated;
revoke execute on function public.seed_defaults(uuid) from authenticated, anon, public;

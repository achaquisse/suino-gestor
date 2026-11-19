-- "Aporte" is now called "Injeção de capital": the income category, the transaction kind,
-- existing rows, the farm seeding functions and the help text.

alter table public.transactions drop constraint if exists transactions_kind_check;
update public.transactions set kind = 'Injeção de capital' where kind = 'Aporte';
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('Venda', 'Injeção de capital', 'Investimento', 'Recorrente', 'Pontual', 'Receita', 'Dívida'));

-- Renaming the category cascades to stock_items; transactions and recurring expenses
-- store the name as text and are updated explicitly.
update public.categories set name = 'Injeção de capital', description = 'Capital injetado por investidores'
where name = 'Aporte';
update public.transactions set category = 'Injeção de capital' where category = 'Aporte';
update public.recurring_expenses set category = 'Injeção de capital' where category = 'Aporte';
update public.transactions set title = 'Injeção de capital' || substr(title, 7) where title like 'Aporte%';

update public.help_docs
set lead = replace(lead, 'do que aportou', 'do capital que injetou')
where lead like '%do que aportou%';

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
end;
$$;

create or replace function public.seed_demo(p_farm uuid, p_owner text default 'Proprietário')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s int := current_date - date '2026-10-27';
  t date := current_date;
  fa uuid; fb uuid; nu uuid; gr uuid; f1 uuid; f2 uuid; ge uuid; bo uuid;
  a_vendas uuid; a_inv_a uuid; a_inv_b uuid; a_caixa uuid;
  v_s014 uuid; v_g108 uuid; v_f066 uuid;
begin
  -- Pens ------------------------------------------------------------------
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Maternidade A', 'Partos', 24, 1) returning id into fa;
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Maternidade B', 'Partos', 24, 2) returning id into fb;
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Creche', 'Desmamados · 6 semanas', 30, 3) returning id into nu;
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Recria', 'Recria · 12 semanas', 20, 4) returning id into gr;
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Engorda A', 'Engorda · 22 semanas', 15, 5) returning id into f1;
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Engorda B', 'Engorda', 15, 6) returning id into f2;
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Gestação', 'Porcas gestantes e vazias', 8, 7) returning id into ge;
  insert into pens (farm_id, name, kind, capacity, sort) values (p_farm, 'Varrasco', 'Varrasco reprodutor', 2, 8) returning id into bo;

  -- Animals ---------------------------------------------------------------
  insert into animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone, parents) values
    (p_farm, 'S-014', fa, 'Fêmea', 'Porca', 'Landrace × Large White', date '2024-03-12' + s, 186, 'Em lactação', 'accent', 'S-002 × B-001'),
    (p_farm, 'S-009', fa, 'Fêmea', 'Porca', 'Large White', date '2024-01-03' + s, 192, 'Parto ' || pt_short(date '2026-10-29' + s), 'accent', '—'),
    (p_farm, 'S-017', fa, 'Fêmea', 'Porca', 'Landrace × Large White', date '2024-06-20' + s, 174, 'Parto ' || pt_short(date '2026-11-03' + s), 'neutral', '—'),
    (p_farm, 'S-011', fb, 'Fêmea', 'Porca', 'Large White', date '2024-02-08' + s, 181, 'Parto ' || pt_short(date '2026-11-12' + s), 'neutral', '—'),
    (p_farm, 'S-019', fb, 'Fêmea', 'Porca', 'Landrace', date '2024-08-02' + s, 168, 'Parto ' || pt_short(date '2026-11-18' + s), 'neutral', '—'),
    (p_farm, 'S-021', ge, 'Fêmea', 'Porca', 'Landrace', date '2024-10-05' + s, 162, 'Verificar cio hoje', 'accent', '—'),
    (p_farm, 'S-022', ge, 'Fêmea', 'Leitoa', 'Large White', date '2026-02-11' + s, 128, 'Verificar cio hoje', 'accent', '—'),
    (p_farm, 'S-023', ge, 'Fêmea', 'Porca', 'Landrace × Large White', date '2024-11-09' + s, 170, 'Gestante · dia 41', 'neutral', '—'),
    (p_farm, 'S-024', ge, 'Fêmea', 'Porca', 'Large White', date '2024-12-14' + s, 166, 'Gestante · dia 63', 'neutral', '—'),
    (p_farm, 'B-001', bo, 'Macho', 'Varrasco', 'Duroc', date '2023-04-01' + s, 238, 'Activo', 'neutral', '—');

  insert into animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone, parents)
  select p_farm, 'L14-' || lpad(i::text, 2, '0'), fa, case when i % 2 = 1 then 'Fêmea' else 'Macho' end, 'Leitão', 'Landrace × Duroc',
    date '2026-10-24' + s, round(1.5 + ((i * 7) % 5) * 0.1, 1), 'Ferro em atraso', 'red', 'S-014 × B-001'
  from generate_series(1, 10) i;

  insert into animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone, parents)
  select p_farm, 'N-2' || lpad(i::text, 2, '0'), nu, case when i % 2 = 1 then 'Macho' else 'Fêmea' end, 'Desmamado', 'Landrace × Duroc',
    date '2026-09-15' + s, round(10 + ((i * 3) % 7) * 0.4, 1),
    case when i in (5, 12) then 'Vitamina B12 em atraso' else 'Saudável' end,
    case when i in (5, 12) then 'amber' else 'neutral' end, 'S-011 × B-001'
  from generate_series(1, 18) i;

  insert into animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone, parents)
  select p_farm, 'G-1' || lpad(i::text, 2, '0'), gr, case when i % 2 = 1 then 'Macho' else 'Fêmea' end, 'Recria', 'Landrace × Duroc',
    date '2026-08-04' + s, 34 + ((i * 5) % 9),
    case i when 8 then 'Tosse · isolado' when 3 then 'Diarreia ligeira' else 'Saudável' end,
    case when i in (3, 8) then 'red' else 'neutral' end, 'S-009 × B-001'
  from generate_series(1, 14) i;

  insert into animals (farm_id, tag, pen_id, sex, stage, breed, born_on, weight_kg, status, tone, parents, withdrawal_until)
  select p_farm, 'F-0' || i, f1, case when i % 2 = 1 then 'Macho' else 'Fêmea' end, 'Engorda', 'Large White × Duroc',
    date '2026-05-26' + s, 88 + ((i * 7) % 11),
    case when i = 66 then 'Carência até ' || pt_short(date '2026-11-02' + s) else 'Pronto em ' || (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from date '2026-11-15' + s)::int] end,
    case when i = 66 then 'amber' else 'neutral' end, 'S-017 × B-001',
    case when i = 66 then date '2026-11-02' + s end
  from generate_series(61, 72) i;

  select id into v_s014 from animals where farm_id = p_farm and tag = 'S-014';
  select id into v_g108 from animals where farm_id = p_farm and tag = 'G-108';
  select id into v_f066 from animals where farm_id = p_farm and tag = 'F-066';

  -- Weights ---------------------------------------------------------------
  insert into weights (farm_id, animal_id, measured_on, kg) values
    (p_farm, v_s014, date '2026-06-01' + s, 171), (p_farm, v_s014, date '2026-07-01' + s, 175),
    (p_farm, v_s014, date '2026-08-01' + s, 180), (p_farm, v_s014, date '2026-09-01' + s, 184),
    (p_farm, v_s014, date '2026-10-01' + s, 186);

  insert into weights (farm_id, animal_id, measured_on, kg)
  select p_farm, a.id, t - (k * 30), round(a.weight_kg * (1 - k * 0.1), 1)
  from animals a cross join generate_series(1, 4) k
  where a.farm_id = p_farm and a.stage in ('Desmamado', 'Recria', 'Engorda');

  insert into weights (farm_id, animal_id, measured_on, kg)
  select p_farm, a.id, t, a.weight_kg from animals a
  where a.farm_id = p_farm and a.stage in ('Desmamado', 'Recria', 'Engorda');

  -- Animal timelines -----------------------------------------------------
  insert into events (farm_id, event_date, kind, title, detail, animal_id, pen_id, show_in_calendar, created_by_name) values
    (p_farm, date '2026-10-24' + s, 'breeding', 'Pariu', '11 nascidos · 10 vivos · 1 nado-morto', v_s014, fa, false, 'Marta Sitoe'),
    (p_farm, date '2026-10-20' + s, 'task', 'Transferida para Maternidade A', 'Vinda da Gestação', v_s014, fa, false, 'João Mabunda'),
    (p_farm, date '2026-10-02' + s, 'health', 'Vacinada', 'Parvovirose + Erisipela', v_s014, ge, false, 'João Mabunda'),
    (p_farm, date '2026-10-01' + s, 'task', 'Pesada', '186 kg', v_s014, ge, false, 'Marta Sitoe'),
    (p_farm, date '2026-07-03' + s, 'breeding', 'Coberta', 'Com B-001 · monta natural', v_s014, ge, false, 'João Mabunda'),
    (p_farm, date '2026-07-02' + s, 'breeding', 'Cio detectado', 'Cio firme · por João', v_s014, ge, false, 'João Mabunda'),
    (p_farm, date '2026-10-26' + s, 'health', 'Episódio de doença', 'Tosse, febre ligeira · isolado · Dr. Sitoe avisado', v_g108, gr, false, 'João Mabunda'),
    (p_farm, date '2026-10-19' + s, 'health', 'Tratado · Oxitetraciclina', 'Carência até ' || pt_short(date '2026-11-02' + s), v_f066, f1, false, 'Dr. Sitoe');

  insert into events (farm_id, event_date, kind, title, detail, animal_id, pen_id, show_in_calendar, created_by_name)
  select p_farm, date '2026-09-10' + s, 'task', 'Transferido para Engorda A', 'Vindo da Recria', a.id, f1, false, 'João Mabunda'
  from animals a where a.farm_id = p_farm and a.stage = 'Engorda';
  insert into events (farm_id, event_date, kind, title, detail, animal_id, pen_id, show_in_calendar, created_by_name)
  select p_farm, date '2026-10-19' + s, 'health', 'Desparasitado', 'Ivermectina', a.id, a.pen_id, false, 'João Mabunda'
  from animals a where a.farm_id = p_farm and a.stage in ('Recria', 'Engorda');
  insert into events (farm_id, event_date, kind, title, detail, animal_id, pen_id, show_in_calendar, created_by_name)
  select p_farm, date '2026-09-27' + s, 'task', 'Transferido para Recria', 'Vindo da Creche', a.id, gr, false, 'Marta Sitoe'
  from animals a where a.farm_id = p_farm and a.stage = 'Recria';
  insert into events (farm_id, event_date, kind, title, detail, animal_id, pen_id, show_in_calendar, created_by_name)
  select p_farm, date '2026-10-13' + s, 'task', 'Desmamado', 'Transferido para a Creche', a.id, nu, false, 'Marta Sitoe'
  from animals a where a.farm_id = p_farm and a.stage = 'Desmamado';
  insert into events (farm_id, event_date, kind, title, detail, animal_id, pen_id, show_in_calendar, created_by_name)
  select p_farm, date '2026-10-02' + s, 'health', 'Vacinada', 'Parvovirose + Erisipela', a.id, a.pen_id, false, 'João Mabunda'
  from animals a where a.farm_id = p_farm and a.stage in ('Porca', 'Leitoa') and a.tag <> 'S-014';
  insert into events (farm_id, event_date, kind, title, detail, animal_id, pen_id, show_in_calendar, created_by_name)
  select p_farm, a.born_on, 'task', 'Nascimento', 'Granja Boane · ' || a.parents, a.id, a.pen_id, false, ''
  from animals a where a.farm_id = p_farm;

  -- Calendar --------------------------------------------------------------
  insert into events (farm_id, event_date, kind, title, detail, created_by_name) values
    (p_farm, date '2026-10-02' + s, 'health', 'Vacina Parvovirose + Erisipela', 'Gestação · 4 porcas', 'João Mabunda'),
    (p_farm, date '2026-10-08' + s, 'task', 'Pesar creche', 'Creche · 18', 'Marta Sitoe'),
    (p_farm, date '2026-10-14' + s, 'money', 'Venda · 4 porcos de engorda', '+26 000 MZN', p_owner),
    (p_farm, date '2026-10-19' + s, 'health', 'Desparasitar recria', 'Recria · 14', 'João Mabunda'),
    (p_farm, date '2026-10-20' + s, 'task', 'Transferir S-014 para maternidade', 'Gestação → Maternidade A', 'João Mabunda'),
    (p_farm, date '2026-10-24' + s, 'breeding', 'S-014 pariu', '11 nascidos · 10 vivos', 'Marta Sitoe'),
    (p_farm, date '2026-10-26' + s, 'health', 'Injecção de ferro · ninhada S-014', '10 leitões', 'João Mabunda'),
    (p_farm, date '2026-10-26' + s, 'money', 'Compra de ração inicial', '−6 500 MZN', p_owner),
    (p_farm, date '2026-10-27' + s, 'breeding', 'Verificar cio S-021, S-022', 'Gestação', p_owner),
    (p_farm, date '2026-10-27' + s, 'task', 'Pesar recria', 'Recria · 14', 'Marta Sitoe'),
    (p_farm, date '2026-10-27' + s, 'task', 'Limpar Engorda B', 'Engorda B', 'João Mabunda'),
    (p_farm, date '2026-10-29' + s, 'breeding', 'S-009 com parto previsto', 'Maternidade A', ''),
    (p_farm, date '2026-11-02' + s, 'health', 'Fim da carência · F-066', 'Pode ser vendido', ''),
    (p_farm, date '2026-11-03' + s, 'breeding', 'S-017 com parto previsto', 'Maternidade A', ''),
    (p_farm, date '2026-11-04' + s, 'health', 'Desparasitar creche', 'Creche · 18', ''),
    (p_farm, date '2026-11-09' + s, 'health', 'Ivermectina expira', '2 frascos', ''),
    (p_farm, date '2026-11-12' + s, 'breeding', 'S-011 com parto previsto', 'Maternidade B', ''),
    (p_farm, date '2026-11-16' + s, 'health', 'Vacina Mycoplasma', 'Ninhada S-014', ''),
    (p_farm, date '2026-11-18' + s, 'breeding', 'S-019 com parto previsto', 'Maternidade B', ''),
    (p_farm, date '2026-11-20' + s, 'task', 'Pesar engorda', 'Engorda A', ''),
    (p_farm, date '2026-11-25' + s, 'money', 'Venda prevista · 8 porcos', '≈ 52 000 MZN', '');

  -- Tasks -----------------------------------------------------------------
  insert into tasks (farm_id, title, location, pen_id, due_date, due_time, assignee, action, done_at, done_by) values
    (p_farm, 'Injecção de ferro · ninhada da S-014', 'Maternidade A · 10 leitões', fa, t - 1, null, 'João Mabunda', 'treatment:ferro', null, null),
    (p_farm, 'Verificar cio · S-021, S-022', 'Gestação', ge, t, '08:00', p_owner, 'heat', now(), p_owner),
    (p_farm, 'Pesar recria', 'Recria · 14 porcos', gr, t, '10:00', 'Marta Sitoe', 'weight', null, null),
    (p_farm, 'Limpar e desinfectar', 'Engorda B', f2, t, '14:00', 'João Mabunda', 'cleaning', null, null),
    (p_farm, 'Desparasitar creche', 'Creche · 18', nu, date '2026-11-04' + s, '09:00', 'João Mabunda', 'treatment:iver', null, null),
    (p_farm, 'Pesar engorda', 'Engorda A · 12', f1, date '2026-11-20' + s, '10:00', 'Marta Sitoe', 'weight', null, null);

  -- Stock -----------------------------------------------------------------
  insert into stock_items (farm_id, code, name, unit, qty, max_qty, low_qty, note, expires_on, category, unit_price) values
    (p_farm, 'starter', 'Ração inicial', 'sacos', 3, 20, 5, 'Saco de 25 kg', null, 'Ração', 650),
    (p_farm, 'grower', 'Ração de crescimento', 'sacos', 22, 40, 5, 'Saco de 25 kg', null, 'Ração', 595),
    (p_farm, 'finisher', 'Ração de acabamento', 'sacos', 18, 40, 5, 'Saco de 25 kg', null, 'Ração', 650),
    (p_farm, 'sow', 'Ração de porcas', 'sacos', 9, 20, 4, 'Saco de 25 kg', null, 'Ração', 620),
    (p_farm, 'iron', 'Ferro dextrano', 'frascos', 6, 12, 3, 'Validade ' || pt_short(date '2027-03-01' + s), date '2027-03-31' + s, 'Medicamentos', 120),
    (p_farm, 'iver', 'Ivermectina', 'frascos', 2, 6, 1, 'Expira a ' || pt_short(date '2026-11-09' + s), date '2026-11-09' + s, 'Medicamentos', 450),
    (p_farm, 'parvo', 'Vacina Parvovirose', 'doses', 10, 20, 4, 'Manter refrigerada', null, 'Medicamentos', 120),
    (p_farm, 'disin', 'Desinfectante', 'L', 4, 10, 2, 'Diluir 1:200', null, 'Materiais', 150);

  -- Accounts --------------------------------------------------------------
  update accounts set initial_balance = 0, color = '#5B4CF0' where farm_id = p_farm and name = 'Vendas' returning id into a_vendas;
  insert into accounts (farm_id, name, kind, holder, initial_balance, color) values (p_farm, 'Investidor A', 'Investimento', 'Ana Macuácua', 100000, '#3BA9C7') returning id into a_inv_a;
  insert into accounts (farm_id, name, kind, holder, initial_balance, color) values (p_farm, 'Investidor B', 'Investimento', 'Carlos Nhantumbo', 40000, '#E8A23A') returning id into a_inv_b;
  insert into accounts (farm_id, name, kind, holder, initial_balance, color) values (p_farm, 'Caixa pequena', 'Caixa', p_owner, 3000, '#9A9AAE') returning id into a_caixa;

  -- Batches ---------------------------------------------------------------
  insert into batches (farm_id, code, phase, head_count, active, opening_cost, opening_revenue, started_on) values
    (p_farm, 'Lote Out-26', 'Maternidade A', 10, true, 0, 0, date '2026-10-24' + s),
    (p_farm, 'Lote Set-26', 'Creche', 18, true, 0, 0, date '2026-09-15' + s),
    (p_farm, 'Lote Ago-26', 'Recria', 14, true, 0, 0, date '2026-08-04' + s),
    (p_farm, 'Lote Mai-26', 'Engorda A', 16, true, 23750, 0, date '2026-05-26' + s),
    (p_farm, 'Lote Abr-26', 'Vendido', 6, false, 24900, 0, date '2026-04-10' + s),
    (p_farm, 'Lote Mar-26', 'Vendido', 9, false, 27900, 0, date '2026-03-10' + s),
    (p_farm, 'Lote Fev-26', 'Vendido', 8, false, 30100, 49800, date '2026-02-10' + s),
    (p_farm, 'Lote Jan-26', 'Vendido', 7, false, 27300, 41200, date '2026-01-10' + s),
    (p_farm, 'Lote Dez-25', 'Vendido', 6, false, 24800, 33900, date '2025-12-10' + s),
    (p_farm, 'Lote Nov-25', 'Vendido', 8, false, 33500, 45100, date '2025-11-10' + s),
    (p_farm, 'Lote Out-25', 'Vendido', 5, false, 22100, 19400, date '2025-10-10' + s);

  -- Transactions ----------------------------------------------------------
  insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, batch_id, created_by_name)
  select p_farm, x.d + s, x.title,
    case x.acct when 'Vendas' then a_vendas when 'Investidor A' then a_inv_a else a_inv_b end,
    x.kind, x.cat, x.amt, (select id from batches b where b.farm_id = p_farm and b.code = x.batch), x.who
  from (values
    (date '2026-10-26', 'Ração inicial · 10 sacos', 'Investidor A', 'Recorrente', 'Ração', -6500, 'Lote Set-26', p_owner),
    (date '2026-10-24', 'Ferro dextrano · 10 frascos', 'Vendas', 'Pontual', 'Medicamentos', -1200, 'Lote Out-26', 'João Mabunda'),
    (date '2026-10-20', 'Salários · João, Marta', 'Vendas', 'Recorrente', 'Mão-de-obra', -6000, null, 'Marta Sitoe'),
    (date '2026-10-18', 'Ração de crescimento · 20 sacos', 'Investidor A', 'Recorrente', 'Ração', -11900, 'Lote Ago-26', 'João Mabunda'),
    (date '2026-10-14', 'Venda · 4 porcos, 372 kg', 'Vendas', 'Venda', 'Venda de animais', 26000, 'Lote Mai-26', p_owner),
    (date '2026-10-12', 'Ração de acabamento · 15 sacos', 'Investidor A', 'Recorrente', 'Ração', -9750, 'Lote Mai-26', p_owner),
    (date '2026-10-10', 'Lâmpadas de aquecimento', 'Investidor B', 'Investimento', 'Infra-estrutura', -1900, null, p_owner),
    (date '2026-10-06', 'Visita do veterinário · Dr. Sitoe', 'Vendas', 'Pontual', 'Veterinário', -3700, null, 'João Mabunda'),
    (date '2026-10-03', 'Transporte de ração', 'Vendas', 'Pontual', 'Transporte', -800, null, 'João Mabunda'),
    (date '2026-10-01', 'Injeção de capital · Ana Macuácua', 'Investidor A', 'Injeção de capital', 'Injeção de capital', 20000, null, p_owner),
    (date '2026-09-28', 'Venda · 6 porcos, 540 kg', 'Vendas', 'Venda', 'Venda de animais', 37800, 'Lote Abr-26', p_owner),
    (date '2026-09-26', 'Ração de crescimento · 18 sacos', 'Investidor A', 'Recorrente', 'Ração', -10700, 'Lote Ago-26', 'Marta Sitoe'),
    (date '2026-09-20', 'Salários · João, Marta', 'Vendas', 'Recorrente', 'Mão-de-obra', -6000, null, 'João Mabunda'),
    (date '2026-09-17', 'Vacina Parvovirose · 20 doses', 'Vendas', 'Pontual', 'Medicamentos', -2400, null, 'João Mabunda'),
    (date '2026-09-15', 'Ração inicial · 12 sacos', 'Investidor A', 'Recorrente', 'Ração', -7800, 'Lote Set-26', 'João Mabunda'),
    (date '2026-09-10', 'Bebedouros · 6 unidades', 'Investidor B', 'Investimento', 'Infra-estrutura', -4800, null, p_owner),
    (date '2026-09-08', 'Ração de acabamento · 20 sacos', 'Investidor A', 'Recorrente', 'Ração', -13000, 'Lote Mai-26', 'João Mabunda'),
    (date '2026-09-04', 'Desinfectante · 10 L', 'Vendas', 'Pontual', 'Materiais', -1500, null, 'Marta Sitoe'),
    (date '2026-09-02', 'Venda · 2 leitões', 'Vendas', 'Venda', 'Venda de animais', 5000, null, p_owner),
    (date '2026-08-29', 'Venda · 5 porcos, 455 kg', 'Vendas', 'Venda', 'Venda de animais', 31800, 'Lote Mar-26', p_owner),
    (date '2026-08-25', 'Ração de porcas · 10 sacos', 'Investidor A', 'Recorrente', 'Ração', -6200, null, 'Marta Sitoe'),
    (date '2026-08-20', 'Salários · João, Marta', 'Vendas', 'Recorrente', 'Mão-de-obra', -6000, null, 'Marta Sitoe'),
    (date '2026-08-18', 'Reparação do telhado · Engorda B', 'Investidor B', 'Investimento', 'Infra-estrutura', -14200, null, p_owner),
    (date '2026-08-14', 'Ração de crescimento · 20 sacos', 'Investidor A', 'Recorrente', 'Ração', -11900, 'Lote Mai-26', p_owner),
    (date '2026-08-11', 'Ivermectina · 4 frascos', 'Vendas', 'Pontual', 'Medicamentos', -1800, null, 'João Mabunda'),
    (date '2026-08-06', 'Compra de 14 leitões', 'Investidor B', 'Investimento', 'Animais', -25000, 'Lote Ago-26', p_owner),
    (date '2026-08-04', 'Transporte · leitões', 'Vendas', 'Pontual', 'Transporte', -1200, 'Lote Ago-26', p_owner),
    (date '2026-08-01', 'Injeção de capital · Carlos Nhantumbo', 'Investidor B', 'Injeção de capital', 'Injeção de capital', 40000, null, p_owner),
    (date '2026-07-28', 'Venda · 4 porcos, 360 kg', 'Vendas', 'Venda', 'Venda de animais', 24400, 'Lote Mar-26', p_owner),
    (date '2026-07-20', 'Salários · João, Marta', 'Vendas', 'Recorrente', 'Mão-de-obra', -6000, null, 'João Mabunda'),
    (date '2026-07-15', 'Ração de acabamento · 18 sacos', 'Investidor A', 'Recorrente', 'Ração', -11700, 'Lote Mar-26', p_owner),
    (date '2026-07-09', 'Vacina Mycoplasma', 'Vendas', 'Pontual', 'Medicamentos', -2900, null, 'João Mabunda')
  ) as x (d, title, acct, kind, cat, amt, batch, who);

  -- Recurring expenses & debts -------------------------------------------
  insert into recurring_expenses (farm_id, name, cost_type, category, account_id, amount, frequency, next_due) values
    (p_farm, 'Salários · João, Marta', 'Fixo', 'Mão-de-obra', a_vendas, 6000, 'Mensal', date '2026-11-20' + s),
    (p_farm, 'Electricidade · EDM', 'Variável', 'Energia e água', a_vendas, 2200, 'Mensal', date '2026-10-25' + s),
    (p_farm, 'Água · FIPAG', 'Variável', 'Energia e água', a_vendas, 850, 'Mensal', date '2026-10-30' + s),
    (p_farm, 'Renda do terreno', 'Fixo', 'Infra-estrutura', a_inv_b, 4500, 'Mensal', date '2026-11-01' + s),
    (p_farm, 'Combustível do gerador', 'Variável', 'Transporte', a_caixa, 1200, 'Semanal', date '2026-10-29' + s),
    (p_farm, 'Visita veterinária de rotina', 'Fixo', 'Veterinário', a_vendas, 3700, 'Trimestral', date '2027-01-06' + s);

  insert into debts (farm_id, creditor, description, total, paid, installment, next_due, account_id, splits) values
    (p_farm, 'BCI · Crédito agrícola', 'Construção da maternidade', 180000, 72000, 7500, date '2026-11-05' + s, a_vendas,
      jsonb_build_array(jsonb_build_object('account_id', a_vendas, 'pct', 50), jsonb_build_object('account_id', a_inv_b, 'pct', 50))),
    (p_farm, 'Agro-Moz Rações', 'Ração a crédito · Setembro', 18500, 6000, 6250, date '2026-10-24' + s, a_inv_a, '[]'),
    (p_farm, 'Sr. Matsinhe', 'Empréstimo pessoal', 25000, 25000, 5000, null, a_vendas, '[]');

  -- Team (pending invites so names are available in forms) ---------------
  insert into farm_invites (farm_id, email, name, role) values
    (p_farm, 'joao.mabunda@example.com', 'João Mabunda', 'caretaker'),
    (p_farm, 'marta.sitoe@example.com', 'Marta Sitoe', 'caretaker'),
    (p_farm, 'dr.sitoe@example.com', 'Dr. Sitoe', 'vet'),
    (p_farm, 'ana.macuacua@example.com', 'Ana Macuácua', 'investor')
  on conflict do nothing;
end;
$$;

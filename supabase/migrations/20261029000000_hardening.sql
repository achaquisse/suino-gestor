-- Hardening: invite takeover, ownerless farms, double payments, missing FK indexes.

-- ---------------------------------------------------------------------------
-- Invites are matched by email, so only accept them for a confirmed address.
-- Google sign-ins are always confirmed; this matters if email/password or
-- magic-link sign-up is ever enabled with confirmations off.
-- ---------------------------------------------------------------------------
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
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
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

-- ---------------------------------------------------------------------------
-- A farm must always keep at least one owner (owners can manage farm_members,
-- including themselves). Cascades from deleting the farm or the account pass.
-- ---------------------------------------------------------------------------
create or replace function public.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> 'owner' or (tg_op = 'UPDATE' and new.role = 'owner') then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from farms where id = old.farm_id)
     or not exists (select 1 from auth.users where id = old.user_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from farm_members
    where farm_id = old.farm_id and role = 'owner' and user_id <> old.user_id
  ) then
    raise exception 'A granja precisa de pelo menos um proprietário.' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger farm_members_keep_owner
  before update of role or delete on public.farm_members
  for each row execute function public.keep_one_owner();

-- ---------------------------------------------------------------------------
-- Payments: lock the row so a double tap (or two devices) can't pay twice.
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
  select * into v_r from public.recurring_expenses where id = p_id for update;
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
  select * into v_d from public.debts where id = p_id for update;
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

revoke execute on function public.keep_one_owner() from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- Indexes for foreign keys used by the views, RLS-filtered lists and invites.
-- ---------------------------------------------------------------------------
create index if not exists transactions_account_idx on public.transactions (account_id);
create index if not exists transactions_batch_idx on public.transactions (batch_id) where batch_id is not null;
create index if not exists transaction_files_tx_idx on public.transaction_files (transaction_id);
create index if not exists recurring_expenses_farm_idx on public.recurring_expenses (farm_id, next_due);
create index if not exists debts_farm_idx on public.debts (farm_id);
create index if not exists weights_farm_idx on public.weights (farm_id);
create index if not exists farm_invites_email_idx on public.farm_invites (lower(email)) where accepted_at is null;

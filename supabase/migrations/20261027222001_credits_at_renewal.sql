-- Her credits come back at each paid renewal of her subscription (the date she subscribed), not on
-- the 1st of the calendar month: subscribed on the 28th, she no longer got her credits twice in four
-- days. And a credit pack (« 1 Reel de plus », paid once by card) adds credits that carry over once.

-- The paid period her credits belong to (« period:<start> », read from Stripe) and when it ends.
alter table public.studios add column if not exists credits_period text;
alter table public.studios add column if not exists period_ends_at timestamptz;

-- A pack's Stripe Checkout session is credited once.
create unique index if not exists credit_ledger_stripe_session_once
  on public.credit_ledger ((ref ->> 'stripe_session')) where ref ? 'stripe_session';

-- Brings the balance back up to the allowance once per period (p_period, or the calendar month in
-- Paris when null: not subscribed yet, or billing off) and returns the balance. Unused credits of the
-- offer do not pile up; credits from packs bought since the last top-up still left are kept on top.
create or replace function public.ensure_period_credits(p_studio uuid, p_allowance integer, p_period text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  period text := coalesce(p_period, to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'));
  balance integer;
  packs integer;
  since timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || p_studio::text));
  if not exists (
    select 1 from public.credit_ledger
    where studio_id = p_studio and reason = 'monthly' and month = period
  ) then
    select coalesce(sum(delta), 0) into balance from public.credit_ledger where studio_id = p_studio;
    select max(created_at) into since from public.credit_ledger where studio_id = p_studio and reason = 'monthly';
    select coalesce(sum(delta), 0) into packs from public.credit_ledger
      where studio_id = p_studio and ref ? 'stripe_session' and (since is null or created_at > since);
    insert into public.credit_ledger (studio_id, delta, reason, label, month)
    values (p_studio, greatest(0, p_allowance + least(greatest(balance, 0), packs) - balance), 'monthly', 'Crédits du mois', period);
  end if;
  select coalesce(sum(delta), 0) into balance from public.credit_ledger where studio_id = p_studio;
  return balance;
end;
$$;

revoke execute on function public.ensure_period_credits(uuid, integer, text) from public, anon, authenticated;

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
    new.plan is distinct from old.plan
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.subscription_synced_at is distinct from old.subscription_synced_at
    or new.credits_period is distinct from old.credits_period
    or new.period_ends_at is distinct from old.period_ends_at
    or new.team is distinct from old.team
  ) then
    raise exception 'billing fields are set by the server only';
  end if;
  return new;
end;
$fn$;

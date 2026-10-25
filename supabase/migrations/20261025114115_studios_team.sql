-- The team's own studio (Simone's own account): no daily cap on Simone's turns, and the alerts go
-- to it (apps/web/src/lib/reply-cap.ts). Set by the server only, like the billing fields: an owner
-- could otherwise lift her own studio's cap from the browser.
alter table public.studios add column if not exists team boolean not null default false;

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
    or new.team is distinct from old.team
  ) then
    raise exception 'billing fields are set by the server only';
  end if;
  return new;
end;
$fn$;

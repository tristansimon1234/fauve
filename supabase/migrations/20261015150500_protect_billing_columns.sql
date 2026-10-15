-- Owners may update their studio from the browser (RLS), but never its offer or
-- subscription: those come from Stripe through the server (service role).
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
  ) then
    raise exception 'billing fields are set by the server only';
  end if;
  return new;
end;
$fn$;
create trigger studios_protect_billing before update on public.studios
  for each row execute function public.protect_billing_columns();

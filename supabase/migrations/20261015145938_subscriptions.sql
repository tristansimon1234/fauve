-- Her subscription (Stripe): 3 days of trial with a card, then Essentiel or Pro.
-- Synced from Stripe on her return from Checkout, lazily and once a day (lib/billing).
alter table public.studios
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_synced_at timestamptz;

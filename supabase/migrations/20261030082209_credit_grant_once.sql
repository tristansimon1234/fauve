-- A subscription's credits are granted once per subscription, period and offer change: the
-- Stripe webhook and her return from Checkout may both read the same new subscription at once.
create unique index if not exists credit_ledger_grant_once on public.credit_ledger ((ref ->> 'grant')) where ref ? 'grant';

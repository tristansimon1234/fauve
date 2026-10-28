-- Her words on the page Tendances: 3 changes a month for free (each is a whole new search), then a
-- credit each (reason 'trends').
alter table public.studios add column trend_query_month text, add column trend_query_changes integer not null default 0;

alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('monthly', 'montage', 'correction', 'variant', 'moodboard', 'text_layer', 'image', 'carousel', 'trends', 'adjustment'));

-- Variants: the same montage with another template and another hook (render only).
alter table public.credit_quotes drop constraint credit_quotes_kind_check;
alter table public.credit_quotes add constraint credit_quotes_kind_check check (kind in ('montage', 'correction', 'variant'));
alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('monthly', 'montage', 'correction', 'variant', 'moodboard', 'adjustment'));

-- Credits: a new text layer designed by Fauve.
alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('monthly', 'montage', 'correction', 'variant', 'moodboard', 'text_layer', 'adjustment'));

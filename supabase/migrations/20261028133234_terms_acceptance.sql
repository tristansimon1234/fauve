-- Proof that she accepted the terms: which version, when they were shown (under Edith's first
-- WhatsApp message, on the QR page, before paying) and when she went on after seeing them.
alter table public.studios
  add column if not exists terms_version text,
  add column if not exists terms_shown_at timestamptz,
  add column if not exists terms_accepted_at timestamptz;

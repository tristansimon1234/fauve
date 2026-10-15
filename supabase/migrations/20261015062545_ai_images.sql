-- Images made with Simone's image model: a real photo improved (its original kept)
-- or an ambiance image (never her place, her products or people).
alter type public.media_source add value if not exists 'ai';

alter table public.media_assets add column if not exists ai jsonb;
comment on column public.media_assets.ai is 'Made by the image model: { mode: improve|ambiance, instruction, from_media_id, format, model }';

-- Credits: one per image.
alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('monthly', 'montage', 'correction', 'variant', 'moodboard', 'text_layer', 'image', 'adjustment'));

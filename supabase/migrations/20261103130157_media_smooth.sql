-- Slow motion made smooth on the rented card (apps/render/rife.py): by passage of the clip (its file, frame and length,
-- lib/render/smooth.ts), the file at 60 images a second in Storage ({studio}/smooth/…) or why it failed. Removed with the clip.
alter table public.media_assets add column if not exists smooth jsonb not null default '{}'::jsonb;
comment on column public.media_assets.smooth is 'Passages of this clip made at 60 i/s by RIFE on the card (key → { path, frames, made, at } or { failed_at, error }).';

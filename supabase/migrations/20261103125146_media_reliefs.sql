-- A moving photo in relief, its depth read on the rented card (apps/render/relief.py): by shot (its move, length and
-- framing, lib/render/relief.ts), the video of every pixel moved by its depth in Storage ({studio}/reliefs/…) or why
-- it failed. Removed with the photo.
alter table public.media_assets add column if not exists reliefs jsonb not null default '{}'::jsonb;
comment on column public.media_assets.reliefs is 'Shots of this photo drawn in relief by its depth (reliefJobs key → { path, frames, w, h, near, at } or { failed_at, error }).';

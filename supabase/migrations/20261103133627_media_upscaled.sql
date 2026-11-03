-- A photo or a video too small for a Reel, enlarged once on the rented card (apps/render/upscale.py, Real-ESRGAN): its
-- size before and after, the model and when; the larger copy is in storage_path, the file as sent in original_path.
alter table public.media_assets add column if not exists upscaled jsonb;
comment on column public.media_assets.upscaled is 'Enlarged on the card ({ from: [w, h], to: [w, h], model, at }): the larger copy is storage_path, the original original_path.';

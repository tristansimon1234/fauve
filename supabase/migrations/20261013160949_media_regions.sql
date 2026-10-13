-- What Gemini saw in a photo or a clip, read once and reused: zones to blur
-- (faces, plates, screens), suggested retouch, source size.
alter table public.media_assets
  add column regions jsonb,
  add column regions_at timestamptz;

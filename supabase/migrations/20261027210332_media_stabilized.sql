-- A shaky video steadied once after its analysis (lib/video/stabilize.ts): the steady
-- copy takes storage_path, the original is kept in original_path and goes with the media.
alter table public.media_assets add column original_path text;
alter table public.media_assets add column stabilized jsonb;

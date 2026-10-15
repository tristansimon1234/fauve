-- The strip of scenes under a Reel: one small image per scene of a render, side by side in one JPEG.
alter table public.renders add column if not exists scenes_path text;
comment on column public.renders.scenes_path is 'One image per scene (middle of each segment), side by side in a single JPEG, for the strip under the Reel.';

-- What moves in her videos: hands, faces and bodies image by image, read once per clip
-- (apps/render/track.py in the cut-out sandbox), its file in Storage ({studio}/tracks/{media}.json,
-- removed with the clip by the retention), and what was found, or why it failed.
alter table public.media_assets add column if not exists tracks jsonb;
comment on column public.media_assets.tracks is 'What was tracked in a video for the animations that follow it (packages/agent/src/tracking.ts, mediaTracksSchema).';

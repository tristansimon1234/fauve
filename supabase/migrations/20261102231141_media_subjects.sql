-- Her subject cut out at every image of the passages a composition draws it on (apps/render/matte.py):
-- by passage (clip, in, out), the file in Storage ({studio}/subjects/…) or why it failed. Removed with the clip.
alter table public.media_assets add column if not exists subjects jsonb not null default '{}'::jsonb;
comment on column public.media_assets.subjects is 'Passages of this video cut out at every image (subjectKey → { path, still, at } or { failed_at, error }), for compositions that draw Subject.';

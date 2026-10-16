-- Collages: the subject of a photo cut out once (its image with transparency in
-- Storage, {studio}/cutouts/{media}.webp, and what it is like: coverage, pieces,
-- box, edges it runs into, whether it makes a sticker).
alter table public.media_assets add column if not exists cutout jsonb;
comment on column public.media_assets.cutout is 'Cut-out of a photo''s subject for collages (packages/agent/src/cutout.ts, cutoutSchema).';

-- Her latest Reels and videos as her public profile shows them (read from her @ each day through
-- Treg, lib/social/public-stats.ts): each with its views, likes and comments, the publication Edith
-- made when it is one of hers. Résultats lists them all, Edith's or not (Tristan: « où tu vois tes
-- vues par réel, tes ratios »). Read by her studio's members, written by the server only.
create table public.public_videos (
  studio_id uuid not null references public.studios(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  video_id text not null,
  url text,
  caption text not null default '',
  published_at timestamptz not null,
  seconds numeric,
  views integer,
  likes integer,
  comments integer,
  saves integer,
  post_id uuid references public.posts(id) on delete set null,
  captured_at timestamptz not null default now(),
  primary key (studio_id, platform, video_id)
);
create index public_videos_studio_published on public.public_videos (studio_id, published_at desc);
create index public_videos_post on public.public_videos (post_id) where post_id is not null;
alter table public.public_videos enable row level security;
create policy "members read public videos" on public.public_videos for select to authenticated using (public.is_studio_member(studio_id));

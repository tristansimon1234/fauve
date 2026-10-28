-- What works right now in each trade (page Tendances): a weekly keyword search of TikTok and
-- Instagram through Treg, the most watched videos kept with their numbers and a copy of their cover.
create table public.trend_searches (
  key text not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  query text not null,
  fetched_at timestamptz not null default now(),
  found integer not null default 0,
  cost_usd numeric not null default 0,
  primary key (key, platform)
);

create table public.trend_videos (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  external_id text not null,
  url text not null,
  caption text not null default '',
  author text,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  sound text,
  duration numeric,
  posted_at timestamptz,
  cover_path text,
  rank integer not null default 0,
  fetched_at timestamptz not null default now(),
  unique (key, platform, external_id)
);
create index trend_videos_key on public.trend_videos (key, platform, rank);

-- Public videos of a trade, the same for every studio: any signed-in member reads them, only the
-- server writes them.
alter table public.trend_searches enable row level security;
alter table public.trend_videos enable row level security;
create policy "members read trend searches" on public.trend_searches for select to authenticated using (true);
create policy "members read trend videos" on public.trend_videos for select to authenticated using (true);

-- The words searched for her trade, when she changed them (else her activity).
alter table public.studios add column trend_query text;

-- Each Monday at 5:23 UTC: every trade searched again (/api/cron/trends).
select cron.schedule('fauve-trends', '23 5 * * 1', $$select public.call_app('/api/cron/trends')$$);

-- The trending sounds (docs/son.md, « Sons tendance »): the songs of TikTok's charts found among Instagram's music, and
-- the sounds a studio searched by name. The same for every studio (nothing of theirs: a title, an artist, the id of
-- its page in Instagram): any signed-in member reads them, only the server writes them.
create table public.trend_sounds (
  id uuid primary key default gen_random_uuid(),
  -- Its page in Instagram: instagram.com/reels/audio/{audio_id}/
  audio_id text not null unique,
  title text not null,
  artist text,
  -- Its cover on Instagram's CDN (its link expires: the page shows none then).
  cover_url text,
  seconds integer,
  explicit boolean not null default false,
  -- In this week's list: from which chart, at which rank; null for a sound only searched.
  chart text check (chart in ('top', 'viral')),
  rank integer,
  tiktok_users bigint,
  -- A chart's song as compared (soundWords of its title and artist): a song found once is not searched again.
  match_key text,
  -- A few Reels that use it ({ code, plays, video }), their video links valid until reels_until.
  reels jsonb not null default '[]'::jsonb,
  reels_until timestamptz,
  charted_at timestamptz,
  fetched_at timestamptz not null default now()
);
create index trend_sounds_chart on public.trend_sounds (chart, rank) where chart is not null;
create index trend_sounds_match on public.trend_sounds (match_key) where match_key is not null;
alter table public.trend_sounds enable row level security;
create policy "members read trend sounds" on public.trend_sounds for select to authenticated using (true);

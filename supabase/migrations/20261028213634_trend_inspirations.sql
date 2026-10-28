-- Each video's cover read by Sonnet: its beauty, the hook written on it and its form, what makes it inspiring.
alter table public.trend_videos
  add column beauty smallint,
  add column hook text,
  add column hook_form text,
  add column tags text[] not null default '{}';

-- The hashtags « Les plus belles » learned from its most beautiful posts, searched again the next weeks
-- while they keep bringing beautiful ones (server only).
create table public.trend_tags (
  key text not null,
  hashtag text not null,
  seen integer not null default 1,
  score real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, hashtag)
);
alter table public.trend_tags enable row level security;

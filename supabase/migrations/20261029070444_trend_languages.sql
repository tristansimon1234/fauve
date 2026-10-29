-- The language of the videos on the page Tendances (French by default), and what Sonnet reads of
-- each video's hook: its strength out of 10, why it works, and the language of its words.
alter table public.studios
  add column if not exists trend_lang text not null default 'fr'
    check (trend_lang in ('fr', 'en', 'es', 'it', 'de', 'pt', 'all'));

alter table public.trend_videos
  add column if not exists lang text,
  add column if not exists hook_score smallint check (hook_score between 1 and 10),
  add column if not exists hook_why text;

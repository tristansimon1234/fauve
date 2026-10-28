-- Tendances in two lists (« trend:… » her trade worldwide, « local:… » with her city): the lists of
-- before, kept under the bare words, are forgotten by the weekly run (forgetOldTrends).
-- The number of posts on her trade's Instagram hashtags, counted each week, to show how many were
-- added (a subject people post about now).
create table public.trend_hashtags (
  hashtag text not null,
  counted_on date not null,
  posts bigint not null,
  primary key (hashtag, counted_on)
);

alter table public.trend_hashtags enable row level security;
create policy "members read trend hashtags" on public.trend_hashtags for select to authenticated using (true);

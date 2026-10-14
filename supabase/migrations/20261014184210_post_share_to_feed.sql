-- A Reel also shows in the profile grid (Instagram's share_to_feed), or only in the Reels tab.
alter table public.posts add column if not exists share_to_feed boolean not null default true;
comment on column public.posts.share_to_feed is 'A Reel also shows in the profile grid (true) or only in the Reels tab (false).';

-- The account itself, day by day (Instagram insights, TikTok counters): new
-- followers, unfollows, reach, views, profile visits, link taps. One row per
-- studio, platform and day, filled by the publish cron.
create table if not exists public.account_daily (
  studio_id uuid not null references public.studios (id) on delete cascade,
  platform public.social_platform not null,
  day date not null,
  followers integer,
  new_followers integer,
  unfollows integer,
  reach integer,
  views integer,
  profile_views integer,
  link_taps integer,
  interactions integer,
  accounts_engaged integer,
  likes_total integer,
  captured_at timestamptz not null default now(),
  primary key (studio_id, platform, day)
);
alter table public.account_daily enable row level security;
create policy "members read account stats" on public.account_daily for select to authenticated using (public.is_studio_member(studio_id));

-- Who follows the account (cities, countries, ages, genders), read about once a week.
create table if not exists public.account_audience (
  studio_id uuid not null references public.studios (id) on delete cascade,
  platform public.social_platform not null,
  captured_on date not null,
  data jsonb not null,
  primary key (studio_id, platform, captured_on)
);
alter table public.account_audience enable row level security;
create policy "members read account audience" on public.account_audience for select to authenticated using (public.is_studio_member(studio_id));

-- Each video of her public profile, its views each day (read from her @, public-stats.ts): the views
-- her videos gained in a week, compared with the week before in the Sunday report (Tristan: « vs la
-- semaine précédente hein ? »). A video's total alone cannot say it: last week's Reel has more views
-- than Tuesday's only for being older. Kept 10 weeks. Read by her studio's members, written by the server.
create table public.public_video_days (
  studio_id uuid not null references public.studios(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  video_id text not null,
  day date not null,
  views integer,
  primary key (studio_id, platform, video_id, day)
);
create index public_video_days_studio_day on public.public_video_days (studio_id, day);
alter table public.public_video_days enable row level security;
create policy "members read public video days" on public.public_video_days for select to authenticated using (public.is_studio_member(studio_id));

-- What was already read becomes the first day of the history.
insert into public.public_video_days (studio_id, platform, video_id, day, views)
select studio_id, platform, video_id, (captured_at at time zone 'UTC')::date, views
from public.public_videos
on conflict do nothing;

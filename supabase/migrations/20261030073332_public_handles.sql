-- Her @ on Instagram and TikTok, for her public numbers without connecting her accounts
-- (followers, and views, likes, comments of her Reels, read through Treg: lib/social/public-stats.ts).
alter table public.studios
  add column if not exists instagram_handle text check (instagram_handle ~ '^[a-z0-9._]{1,30}$'),
  add column if not exists tiktok_handle text check (tiktok_handle ~ '^[a-z0-9._]{2,24}$'),
  add column if not exists public_stats_at timestamptz;

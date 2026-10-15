-- TikTok: its access token lasts a day, renewed with a refresh token (a year).
alter table public.social_credentials
  add column if not exists refresh_token text,
  add column if not exists refresh_expires_at timestamptz;

-- The manager's choices for a direct post on TikTok (privacy, comments, duet, stitch).
alter table public.posts add column if not exists tiktok jsonb;

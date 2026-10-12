-- Direct Instagram connection: OAuth tokens live in a table no client can read
-- (RLS on, no policy), and posts get a claim column for the publish worker.
create table if not exists public.social_credentials (
  social_account_id uuid primary key references public.social_accounts (id) on delete cascade,
  access_token text not null,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.social_credentials enable row level security;
revoke all on public.social_credentials from anon, authenticated;

alter table public.social_accounts alter column provider set default 'instagram';
alter table public.social_accounts add column if not exists connected_at timestamptz;

alter table public.posts add column if not exists publish_started_at timestamptz;
alter table public.posts add column if not exists publish_error text;

-- Publish worker: every 5 minutes, pg_cron calls the app; the shared secret
-- stays in Vault (set once with vault.create_secret(..., 'fauve_cron_secret')).
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Applied separately (the secret must not live in the repo):
--   select vault.create_secret('<CRON_SECRET>', 'fauve_cron_secret', 'Bearer secret for /api/cron/publish');
--   select cron.schedule('fauve-publish', '*/5 * * * *', $$select net.http_post(
--     url := 'https://fauve-one.vercel.app/api/cron/publish',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fauve_cron_secret'), 'Content-Type', 'application/json'),
--     body := '{}'::jsonb, timeout_milliseconds := 5000)$$);

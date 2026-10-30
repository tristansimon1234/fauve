-- Settings the team changes from the admin page (/admin), read by the server only: the brakes of a rush (brakes.ts).
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values ('daily_signups', '10');

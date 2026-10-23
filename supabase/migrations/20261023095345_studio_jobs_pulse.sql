-- A montage step's pulse: what it needs to be sent again when it falls silent, and how many times it was.
alter table public.studio_jobs add column if not exists resume jsonb;
alter table public.studio_jobs add column if not exists revived int not null default 0;

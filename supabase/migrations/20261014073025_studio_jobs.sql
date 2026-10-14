-- What Fauve is working on (montages, text layers): shown live in the app and in her context,
-- so she never starts the same work twice nor says nothing was started.
create table public.studio_jobs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  kind text not null check (kind in ('montage', 'text_layer')),
  stage text not null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  failed boolean not null default false
);
create index studio_jobs_running_idx on public.studio_jobs (studio_id, finished_at, updated_at desc);
alter table public.studio_jobs enable row level security;
create policy "members read jobs" on public.studio_jobs for select to authenticated using (public.is_studio_member(studio_id));
alter publication supabase_realtime add table public.studio_jobs;

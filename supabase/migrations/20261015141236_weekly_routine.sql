-- The weekly routine: her posting days and hour, the week Simone proposes each
-- Sunday, the filming missions sent the morning they are due, the plan B the
-- day before a publication still without material.
alter table public.content_plans
  add column if not exists post_days smallint[],
  add column if not exists post_time text;

create table if not exists public.week_plans (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  week_start date not null,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'replaced')),
  intro text not null default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists week_plans_studio_week on public.week_plans (studio_id, week_start desc);
alter table public.week_plans enable row level security;
create policy "members read week plans" on public.week_plans
  for select to authenticated using (public.is_studio_member(studio_id));

alter table public.shot_requests add column if not exists reminded_at timestamptz;
alter table public.posts
  add column if not exists week_plan_id uuid references public.week_plans(id) on delete set null,
  add column if not exists plan_b_at timestamptz;

-- One place for the app's address: the scheduled jobs read it from Vault, so a
-- new domain is one update (select vault.update_secret(id, 'https://…')).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'fauve_app_url') then
    perform vault.create_secret('https://fauve-one.vercel.app', 'fauve_app_url', 'Base URL of the app, read by the scheduled jobs');
  end if;
end $$;

create or replace function public.call_app(path text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'fauve_app_url'), '/') || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fauve_cron_secret'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000);
$$;
revoke all on function public.call_app(text) from public, anon, authenticated;

select cron.schedule('fauve-publish', '*/5 * * * *', $$select public.call_app('/api/cron/publish')$$);
select cron.schedule('fauve-retention', '17 * * * *', $$select public.call_app('/api/cron/retention')$$);
select cron.schedule('fauve-weekly-report', '0 17 * * 0', $$select public.call_app('/api/cron/weekly-report')$$);
-- After the report: next week's proposal (Sunday evening), then each morning the day's tasks.
select cron.schedule('fauve-weekly-plan', '30 17 * * 0', $$select public.call_app('/api/cron/weekly-plan')$$);
select cron.schedule('fauve-daily-tasks', '0 7 * * *', $$select public.call_app('/api/cron/daily-tasks')$$);

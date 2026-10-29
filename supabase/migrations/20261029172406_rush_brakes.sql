-- Brakes for a rush (packages/agent/src/brakes.ts).

-- Numbers that wrote on a full day: their turn comes when there is room (lib/waitlist.ts).
create table public.waitlist (
  phone_e164 text primary key,
  -- Her WhatsApp id (the number without its +), to answer her.
  wa_id text not null,
  first_name text,
  -- What she wrote first, for the team.
  first_text text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- The local day she was last told she waits (once a day).
  told_on date,
  admitted_at timestamptz
);
alter table public.waitlist enable row level security;
create index waitlist_waiting_idx on public.waitlist (created_at) where admitted_at is null;

-- New numbers of the day, counted on every new number.
create index members_created_idx on public.members (created_at);

-- The day's spending of studios not subscribed (lib/spend-brake.ts).
create index cost_events_created_idx on public.cost_events (created_at);

-- Montages running or waiting, every studio together (lib/montage-queue.ts, montage-watchdog.ts).
create index studio_jobs_open_idx on public.studio_jobs (kind, started_at) where finished_at is null;

-- A montage waiting its turn in the queue.
alter table public.credit_quotes drop constraint credit_quotes_stage_check;
alter table public.credit_quotes add constraint credit_quotes_stage_check
  check (stage in ('waiting', 'design', 'effects', 'alternative', 'render', 'review', 'fix', 'delivered', 'superseded'));

-- What studios not subscribed (neither the team's nor a lab's) have cost since `since`, in euros.
create or replace function public.free_spend_since(since timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.cost_eur), 0)
  from public.cost_events c
  join public.studios s on s.id = c.studio_id
  where c.created_at >= since
    and not coalesce(s.team, false)
    and coalesce(s.website_url, '') not like 'lab://%'
    and coalesce(s.subscription_status, '') not in ('active', 'trialing');
$$;
revoke all on function public.free_spend_since(timestamptz) from public, anon, authenticated;

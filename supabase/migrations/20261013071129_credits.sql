-- Credits. Every grant and charge is a row of the ledger; the balance is their sum.
-- Costly work (montage, correction, moodboard reading) is quoted first
-- (credit_quotes), the manager says yes, and the real cost is charged once the
-- work is delivered, never above the quote.

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('monthly', 'montage', 'correction', 'moodboard', 'adjustment')),
  -- Shown to the manager in the history, e.g. « Montage « Cours du mardi » ».
  label text not null,
  ref jsonb not null default '{}'::jsonb,
  -- 'YYYY-MM' for the monthly top-up (once per month).
  month text,
  created_at timestamptz not null default now()
);

create index credit_ledger_studio_created_idx on public.credit_ledger (studio_id, created_at desc);
create unique index credit_ledger_monthly_once on public.credit_ledger (studio_id, month) where reason = 'monthly';

alter table public.credit_ledger enable row level security;
-- Read-only from the browser: rows are written by the server.
create policy "members read credit ledger" on public.credit_ledger
  for select to authenticated using (public.is_studio_member(studio_id));

create table public.credit_quotes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  kind text not null check (kind in ('montage', 'correction')),
  base integer not null,
  max integer not null,
  lines jsonb not null,
  -- What the work was quoted for (clips, brief, allowed new scenes).
  params jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  used_at timestamptz,
  charged_at timestamptz,
  created_at timestamptz not null default now()
);

create index credit_quotes_studio_created_idx on public.credit_quotes (studio_id, created_at desc);

alter table public.credit_quotes enable row level security; -- no policies: server only

-- Brings the balance back up to the monthly allowance, once per calendar month
-- (Paris time), and returns the balance. Unused credits do not pile up beyond it.
create function public.ensure_monthly_credits(p_studio uuid, p_allowance integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  this_month text := to_char(now() at time zone 'Europe/Paris', 'YYYY-MM');
  balance integer;
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || p_studio::text));
  if not exists (
    select 1 from public.credit_ledger
    where studio_id = p_studio and reason = 'monthly' and month = this_month
  ) then
    select coalesce(sum(delta), 0) into balance from public.credit_ledger where studio_id = p_studio;
    insert into public.credit_ledger (studio_id, delta, reason, label, month)
    values (p_studio, greatest(0, p_allowance - balance), 'monthly', 'Crédits du mois', this_month);
  end if;
  select coalesce(sum(delta), 0) into balance from public.credit_ledger where studio_id = p_studio;
  return balance;
end;
$$;

revoke execute on function public.ensure_monthly_credits(uuid, integer) from public, anon, authenticated;

-- What each provider has cost since `since`, every studio together, in euros (the admin page's budgets, budgets.ts).
create or replace function public.provider_spend(since timestamptz)
returns table (provider text, eur numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select c.provider, coalesce(sum(c.cost_eur), 0)
  from public.cost_events c
  where c.created_at >= since
  group by c.provider;
$$;
revoke all on function public.provider_spend(timestamptz) from public, anon, authenticated;

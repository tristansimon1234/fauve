-- Her first month at €9 (STARTER in packages/agent/src/plans.ts): it ends at her first
-- renewal; until then her balance is its credits, with no monthly top-up.
alter table public.studios add column starter_until timestamptz;

-- A studio's balance, without any top-up.
create function public.credit_balance(p_studio uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where studio_id = p_studio;
$$;
revoke execute on function public.credit_balance(uuid) from public, anon, authenticated;

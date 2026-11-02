-- The animations that may become tools (step 2 of Edith's own tools): a scene the motion designer wrote over her
-- footage, still in its Reel's current version, the Reel published or kept 48 hours, never one already tried as a
-- tool, never a lab studio's. Published first, then the most reused, then the newest. Server only.
create or replace function public.tool_candidates(max_count integer default 5)
returns table (template_id uuid, studio_id uuid, post_id uuid, post_status text, edit_plan_id uuid, plan_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.studio_id, p.id, p.status::text, ep.id, ep.created_at
  from motion_templates t
  join studios s on s.id = t.studio_id
  join posts p on p.studio_id = t.studio_id and p.edit_plan_id is not null and p.status::text <> 'skipped'
  join edit_plans ep on ep.id = p.edit_plan_id
  where t.kind = 'scene'
    and t.role = 'overlay'
    and t.archived_at is null
    and t.js is not null
    and t.code is not null
    and t.created_at > now() - interval '45 days'
    and coalesce(s.website_url, '') not like 'lab://%'
    and not exists (select 1 from tools x where x.origin->>'template_id' = t.id::text)
    and ep.plan::text like '%' || t.id::text || '%'
    and (p.status::text in ('published', 'measured') or ep.created_at < now() - interval '48 hours')
  order by (p.status::text in ('published', 'measured')) desc, t.uses desc, t.created_at desc
  limit greatest(1, least(max_count, 20))
$$;
revoke all on function public.tool_candidates(integer) from public, anon, authenticated;
grant execute on function public.tool_candidates(integer) to service_role;

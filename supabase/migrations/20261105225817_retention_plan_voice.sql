-- The voice a plan names (plan.voice.media_id) is kept while its publication needs it, like her clips: a model whose
-- voice says its words (« Celui-là, celui-là… ») lays them on a track only its plan names (never posts.voice_media_id).
create or replace function public.expired_media(max_rows integer default 200)
returns table(id uuid, studio_id uuid, storage_path text)
language sql
stable security definer
set search_path to ''
as $function$
  with uses as (
    select p.status, p.published_at, m.media_id
    from public.posts p
    cross join lateral (
      select unnest(p.media_ids) as media_id
      union select pm.media_id from public.post_media pm where pm.post_id = p.id
      union select (seg->>'clip_id')::uuid
        from public.edit_plans e, jsonb_array_elements(e.plan->'segments') seg
        where e.post_id = p.id and seg->>'clip_id' ~ '^[0-9a-f-]{36}$'
      union select (seg->'over'->>'clip_id')::uuid
        from public.edit_plans e, jsonb_array_elements(e.plan->'segments') seg
        where e.post_id = p.id and seg->'over'->>'clip_id' ~ '^[0-9a-f-]{36}$'
      union select (ph #>> '{}')::uuid
        from public.edit_plans e,
          jsonb_array_elements(coalesce(e.plan->'segments', '[]'::jsonb) || coalesce(e.plan->'layers', '[]'::jsonb)) anim,
          jsonb_array_elements(case when jsonb_typeof(anim->'motion'->'photos') = 'array' then anim->'motion'->'photos' else '[]'::jsonb end) ph
        where e.post_id = p.id and ph #>> '{}' ~ '^[0-9a-f-]{36}$'
      -- The photos she added on it, and those a copied Reel lays cut out.
      union select (o->>'media_id')::uuid
        from public.edit_plans e, jsonb_array_elements(case when jsonb_typeof(e.plan->'overlays') = 'array' then e.plan->'overlays' else '[]'::jsonb end) o
        where e.post_id = p.id and o->>'media_id' ~ '^[0-9a-f-]{36}$'
      union select (c->>'photo')::uuid
        from public.edit_plans e, jsonb_array_elements(case when jsonb_typeof(e.plan->'copy'->'cutouts') = 'array' then e.plan->'copy'->'cutouts' else '[]'::jsonb end) c
        where e.post_id = p.id and c->>'photo' ~ '^[0-9a-f-]{36}$'
      -- The voice its plan names (a model's words said by its voice, on their own track).
      union select (e.plan->'voice'->>'media_id')::uuid
        from public.edit_plans e
        where e.post_id = p.id and e.plan->'voice'->>'media_id' ~ '^[0-9a-f-]{36}$'
      union select (s->>'media_id')::uuid
        from jsonb_array_elements(coalesce(p.slides->'slides', '[]'::jsonb)) s
        where s->>'media_id' ~ '^[0-9a-f-]{36}$'
      -- The photos a designed carousel lays.
      union select (ph #>> '{}')::uuid
        from jsonb_array_elements(case when jsonb_typeof(p.slides->'design'->'photos') = 'array' then p.slides->'design'->'photos' else '[]'::jsonb end) ph
        where ph #>> '{}' ~ '^[0-9a-f-]{36}$'
      union select (p.cover->>'media_id')::uuid
        where p.cover->>'media_id' ~ '^[0-9a-f-]{36}$'
      union select p.voice_media_id where p.voice_media_id is not null
    ) m
    where m.media_id is not null
  ),
  banked as (
    -- Her bank: the 40 most recent good videos of each studio, for 180 days.
    select b.id from (
      select a.id, row_number() over (partition by a.studio_id order by a.created_at desc) as rank
      from public.media_assets a
      where a.bank and a.created_at > now() - interval '180 days'
    ) b
    where b.rank <= 40
  )
  select a.id, a.studio_id, a.storage_path
  from public.media_assets a
  where a.source::text <> 'website'
    and not exists (select 1 from banked k where k.id = a.id)
    and not exists (
      -- Still needed: a publication not online yet, or online for less than 24 h.
      select 1 from uses u where u.media_id = a.id
        and (u.status not in ('published', 'measured', 'skipped') or u.published_at > now() - interval '24 hours')
    )
    and (
      exists (select 1 from uses u where u.media_id = a.id and u.status in ('published', 'measured'))
      or a.created_at < now() - interval '7 days'
    )
  order by a.created_at
  limit max_rows
$function$;

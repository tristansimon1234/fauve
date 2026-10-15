-- Her own voice on a Reel: the voice note's transcript (words with their timings)
-- and the post's chosen voice note, kept by the retention while the post needs it.
alter table public.media_assets add column if not exists transcript jsonb;
alter table public.posts add column if not exists voice_media_id uuid references public.media_assets(id) on delete set null;

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
      union select (s->>'media_id')::uuid
        from jsonb_array_elements(coalesce(p.slides->'slides', '[]'::jsonb)) s
        where s->>'media_id' ~ '^[0-9a-f-]{36}$'
      union select (p.cover->>'media_id')::uuid
        where p.cover->>'media_id' ~ '^[0-9a-f-]{36}$'
      union select p.voice_media_id where p.voice_media_id is not null
    ) m
    where m.media_id is not null
  )
  select a.id, a.studio_id, a.storage_path
  from public.media_assets a
  where a.source::text <> 'website'
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

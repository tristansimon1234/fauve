-- Media retention: a photo or video is kept while a publication still needs it, deleted
-- 24 h after the last publication using it went online, and after 7 days when no
-- publication uses it. Final renders (renders, slides_render) are kept.

alter table public.posts add column published_at timestamptz;
update public.posts set published_at = coalesce(updated_at, scheduled_at, created_at) where status in ('published', 'measured') and published_at is null;

create or replace function public.set_published_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('published', 'measured') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

create trigger posts_published_at before insert or update of status on public.posts
  for each row execute function public.set_published_at();

-- The media whose time is up (server only: the cron route deletes the files, then the rows).
create or replace function public.expired_media(max_rows int default 200)
returns table (id uuid, studio_id uuid, storage_path text)
language sql stable security definer set search_path = '' as $$
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
    ) m
    where m.media_id is not null
  )
  select a.id, a.studio_id, a.storage_path
  from public.media_assets a
  where not exists (
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
$$;
revoke all on function public.expired_media(int) from public, anon, authenticated;

-- Applied separately (like fauve-publish, the secret stays in Vault):
--   select cron.schedule('fauve-retention', '17 * * * *', $$select net.http_post(
--     url := 'https://fauve-one.vercel.app/api/cron/retention',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fauve_cron_secret'), 'Content-Type', 'application/json'),
--     body := '{}'::jsonb, timeout_milliseconds := 5000)$$);

-- Scaling review (October 2026). Shared machines and providers take a few jobs at a time: the render
-- sandboxes (Chrome, 8 GB each), the cut-out model (6.5 GB of a 16 GB sandbox), ElevenLabs (2 musics,
-- 5 voices at once). Ten montages at once used to start forty Chrome tabs in one 8 GB sandbox. Each
-- job now takes a place (a slot) before it starts and frees it after; a place a dead function held
-- frees itself when its lease ends. Also a studio's credits checked under one lock (two launches could
-- count on the same credits), due reminders read in SQL, posts measured by when they were last measured.

-- One row per place (seat), taken and given back, kept for good: seats p_per_slot * i to
-- p_per_slot * (i + 1) - 1 are machine i's.
create table if not exists public.work_slots (
  kind text not null,
  seat integer not null,
  holder text,
  expires_at timestamptz not null default '-infinity',
  primary key (kind, seat)
);
alter table public.work_slots enable row level security; -- no policies: server only

-- Takes a place among p_slots machines of p_per_slot jobs each, the first machine filled first (the
-- others are only woken under load); a place whose lease ended is free again. p_force: all are full,
-- the job runs anyway on the least busy machine (no place taken). Returns the machine's index, or null.
create or replace function public.take_work_slot(p_kind text, p_slots integer, p_per_slot integer, p_holder text, p_seconds integer, p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen integer;
begin
  insert into public.work_slots (kind, seat)
  select p_kind, s from generate_series(0, p_slots * p_per_slot - 1) as s
  on conflict do nothing;
  update public.work_slots
  set holder = p_holder, expires_at = now() + make_interval(secs => p_seconds)
  where kind = p_kind and seat = (
    select seat from public.work_slots
    where kind = p_kind and seat < p_slots * p_per_slot and expires_at < now()
    order by seat
    limit 1
    for update skip locked
  )
  returning seat / p_per_slot into chosen;
  if chosen is null and p_force then
    select s.i into chosen
    from generate_series(0, p_slots - 1) as s(i)
    left join public.work_slots w
      on w.kind = p_kind and w.seat / p_per_slot = s.i and w.seat < p_slots * p_per_slot and w.expires_at >= now()
    group by s.i
    order by count(w.seat), s.i
    limit 1;
  end if;
  return chosen;
end;
$$;

create or replace function public.release_work_slot(p_kind text, p_holder text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.work_slots set holder = null, expires_at = '-infinity' where kind = p_kind and holder = p_holder;
$$;

revoke execute on function public.take_work_slot(text, integer, integer, text, integer, boolean) from public, anon, authenticated;
revoke execute on function public.release_work_slot(text, text) from public, anon, authenticated;

-- The posts whose moment to post has come and that were not reminded since (a moment moved after a
-- reminder is a new one): read in SQL, the column comparison included. Read 50 then filtered, the same
-- 50 could hold the batch forever while the others waited.
create or replace function public.due_reminders(p_grace_hours integer, p_limit integer)
returns setof public.posts
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.posts
  where status in ('draft', 'validated')
    and scheduled_at <= now()
    and scheduled_at > now() - make_interval(hours => p_grace_hours)
    and (reminded_at is null or reminded_at < scheduled_at)
  order by scheduled_at
  limit p_limit;
$$;
revoke execute on function public.due_reminders(integer, integer) from public, anon, authenticated;

-- When a post's Instagram numbers were last read: the posts read longest ago come first (ordered by
-- updated_at, which a capture never touched, the same 50 posts were read again and again).
alter table public.posts add column if not exists metrics_at timestamptz;
create index if not exists posts_metrics_due_idx on public.posts (metrics_at nulls first)
  where status in ('published', 'measured');

-- Foreign keys without an index (Supabase's advisor): cascades and the lookups by them.
create index if not exists clip_analyses_studio_id_idx on public.clip_analyses (studio_id);
create index if not exists conversations_post_id_idx on public.conversations (post_id);
create index if not exists credit_quotes_post_id_idx on public.credit_quotes (post_id);
create index if not exists edit_plans_studio_id_idx on public.edit_plans (studio_id);
create index if not exists login_tokens_user_id_idx on public.login_tokens (user_id);
create index if not exists media_assets_sorted_post_id_idx on public.media_assets (sorted_post_id);
create index if not exists post_media_media_id_idx on public.post_media (media_id);
create index if not exists post_media_studio_id_idx on public.post_media (studio_id);
create index if not exists posts_edit_plan_id_idx on public.posts (edit_plan_id);
create index if not exists posts_inspiration_id_idx on public.posts (inspiration_id);
create index if not exists posts_render_id_idx on public.posts (render_id);
create index if not exists posts_voice_media_id_idx on public.posts (voice_media_id);
create index if not exists renders_studio_id_idx on public.renders (studio_id);
create index if not exists shot_requests_post_id_idx on public.shot_requests (post_id);
create index if not exists studio_jobs_post_id_idx on public.studio_jobs (post_id);
create index if not exists whatsapp_messages_media_id_idx on public.whatsapp_messages (media_id);
create index if not exists bookings_attribution_post_id_idx on public.bookings_attribution (post_id);

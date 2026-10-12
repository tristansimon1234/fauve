-- Conversations: the web app lists past conversations and can start a new one.
-- Every message joins a conversation: the one given explicitly (a new chat
-- started in the web app), else the studio's latest one if it was active in the
-- last 6 hours, else a new one.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  title text,
  -- 'auto': opened by a message after 6 h of silence; 'web': the manager started a new chat.
  started_by text not null default 'auto' check (started_by in ('auto', 'web')),
  last_message_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index conversations_studio_last_idx on public.conversations (studio_id, last_message_at desc);

alter table public.conversations enable row level security;
-- Read-only from the browser: rows are written by the server.
create policy "members read conversations" on public.conversations
  for select to authenticated using (public.is_studio_member(studio_id));

alter table public.whatsapp_messages
  add column conversation_id uuid references public.conversations (id) on delete set null;
create index whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages (conversation_id, created_at);

-- Backfill: existing messages split into conversations at 6 h gaps.
create temporary table _grouped on commit drop as
with ordered as (
  select id, studio_id, created_at, direction, body,
    case
      when lag(created_at) over w is null or created_at - lag(created_at) over w > interval '6 hours' then 1
      else 0
    end as starts
  from public.whatsapp_messages
  where studio_id is not null
  window w as (partition by studio_id order by created_at)
)
select *, sum(starts) over (partition by studio_id order by created_at rows unbounded preceding) as grp
from ordered;

create temporary table _convs on commit drop as
select
  gen_random_uuid() as id,
  studio_id,
  grp,
  min(created_at) as first_at,
  max(created_at) as last_at,
  (array_agg(left(regexp_replace(body, '\s+', ' ', 'g'), 80) order by created_at)
    filter (where direction = 'inbound' and coalesce(trim(body), '') <> ''))[1] as title
from _grouped
group by studio_id, grp;

insert into public.conversations (id, studio_id, title, last_message_at, created_at)
select id, studio_id, title, last_at, first_at from _convs;

update public.whatsapp_messages m
set conversation_id = c.id
from _grouped g
join _convs c on c.studio_id = g.studio_id and c.grp = g.grp
where m.id = g.id;

create function public.assign_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg_at timestamptz := coalesce(new.created_at, now());
  label text;
  conv uuid;
begin
  if new.studio_id is null then
    return new;
  end if;
  if new.conversation_id is null then
    select c.id into conv
    from public.conversations c
    where c.studio_id = new.studio_id
      and c.archived_at is null
      and c.last_message_at > msg_at - interval '6 hours'
    order by c.last_message_at desc
    limit 1;
    if conv is null then
      insert into public.conversations (studio_id, last_message_at, created_at)
      values (new.studio_id, msg_at, msg_at)
      returning id into conv;
    end if;
    new.conversation_id := conv;
  end if;
  -- The title is the manager's first message.
  if new.direction = 'inbound' then
    label := coalesce(
      nullif(left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 80), ''),
      case new.type
        when 'video' then 'Vidéo envoyée'
        when 'image' then 'Photo envoyée'
        when 'audio' then 'Message vocal'
        when 'document' then 'Fichier envoyé'
      end
    );
  end if;
  update public.conversations
  set last_message_at = greatest(last_message_at, msg_at),
      title = coalesce(title, label)
  where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function public.assign_conversation() from public, anon, authenticated;

create trigger whatsapp_messages_assign_conversation
  before insert on public.whatsapp_messages
  for each row execute function public.assign_conversation();

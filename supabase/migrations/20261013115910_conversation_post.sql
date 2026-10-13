-- A conversation can be about one publication (the chat drawer of its page,
-- or of the calendar): Fauve then only sees that conversation, and WhatsApp
-- messages never join it.
alter table public.conversations add column post_id uuid references public.posts (id) on delete set null;
create index conversations_post_idx on public.conversations (studio_id, post_id) where post_id is not null;

create or replace function public.assign_conversation()
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
      and c.post_id is null
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

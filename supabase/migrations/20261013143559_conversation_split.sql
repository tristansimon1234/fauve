-- A WhatsApp (or Instagram) message joins the latest conversation only if it
-- moved in the last 3 hours AND started the same local day; otherwise a new
-- one opens, so the list reads like a diary instead of one endless thread.
-- Conversations opened in the app (started_by 'web') and those about one
-- publication are never joined automatically.
create or replace function public.assign_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg_at timestamptz := coalesce(new.created_at, now());
  tz text;
  label text;
  conv uuid;
begin
  if new.studio_id is null then
    return new;
  end if;
  if new.conversation_id is null then
    select coalesce(s.timezone, 'Europe/Paris') into tz from public.studios s where s.id = new.studio_id;
    tz := coalesce(tz, 'Europe/Paris');
    select c.id into conv
    from public.conversations c
    where c.studio_id = new.studio_id
      and c.archived_at is null
      and c.post_id is null
      and c.started_by = 'auto'
      and c.last_message_at > msg_at - interval '3 hours'
      and (c.created_at at time zone tz)::date = (msg_at at time zone tz)::date
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

-- Emoji reactions on a message, shown in the web chat whatever the channel:
-- { "fauve": "👍" } when Fauve reacted, { "me": "🔥" } when the manager did.
alter table public.whatsapp_messages
  add column reactions jsonb not null default '{}'::jsonb;

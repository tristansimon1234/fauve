-- What Fauve keeps about the business across conversations (offer, prices, hours, team,
-- audience, what the manager likes or not): a short list of facts, in her context on every turn.
alter table public.studios add column memory jsonb not null default '[]'::jsonb;

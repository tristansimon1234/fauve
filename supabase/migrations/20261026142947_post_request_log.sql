-- What she asked for a Reel, launch by launch, as it was said: her messages word for word and Simone's replies,
-- read by every agent of its montage (her words before Simone's reading of them).
alter table public.posts add column if not exists request_log jsonb not null default '[]'::jsonb;
comment on column public.posts.request_log is 'Each launch of the Reel''s montage: where it was asked (chat, create, page) and the exchange that led to it, her words verbatim.';

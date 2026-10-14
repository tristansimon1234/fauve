-- « Je publie moi-même » : at its time, Brigitte sends the Reel and its caption on
-- WhatsApp instead of publishing it (to add Instagram's music in the app); the
-- published Reel is then found on the account and linked to the post.
alter table public.posts add column publish_by_hand boolean not null default false;
-- When the video was handed over, and how: 'whatsapp' (video sent), 'template'
-- (outside the 24 h window: a template asked her to answer, the video follows her
-- next message), 'app' (no WhatsApp: the publication page has it).
alter table public.posts add column handoff_at timestamptz;
alter table public.posts add column handoff_via text check (handoff_via in ('whatsapp', 'template', 'app'));

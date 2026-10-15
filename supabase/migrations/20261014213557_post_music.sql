-- Simone's music on a Reel (ElevenLabs): on or off, and the piece composed for
-- the current cut (reused while the cut stays the same).
alter table public.posts add column music jsonb;

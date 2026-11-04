-- Where each of Edith's models comes from: the link of the Reel it was written on (its video is house/originals/<key>.mp4),
-- for the team on /admin only; Tristan pastes or corrects it there.
create table public.house_originals (
  key text primary key check (char_length(key) between 1 and 40),
  link text check (link ~ '^https?://' and char_length(link) <= 600),
  updated_at timestamptz not null default now()
);
alter table public.house_originals enable row level security;
-- Read and written by the server only (service role): no policy for the browser.
comment on table public.house_originals is 'The link of the Reel each house model was written on, for the team (/admin).';
-- Found again by their readings on the bench (same length and cuts, or the same reading for a passage of it).
insert into public.house_originals (key, link) values
  ('mots-meles', 'https://www.instagram.com/p/DZzPvO6CXt-/'),
  ('plans-fixes', 'https://www.instagram.com/reels/Dd3-NW8TOlv/'),
  ('mosaique', 'https://www.instagram.com/reel/DcN0AH-t8Ml/'),
  ('nike', 'https://www.instagram.com/reels/Deqx1wjE-fR/');

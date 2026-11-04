-- Tristan's review of each version of a montage skill (docs/modeles.md, « Validation des modèles »): a business plays
-- only a skill he added to the library; the team's studio and the lab's play the others, to look at them first.
create table public.skill_reviews (
  key text not null check (char_length(key) between 1 and 40),
  version integer not null check (version >= 1),
  status text not null check (status in ('approved', 'refused', 'revise')),
  note text check (char_length(note) <= 2000),
  reviewed_at timestamptz not null default now(),
  primary key (key, version)
);
alter table public.skill_reviews enable row level security;
-- Read and written by the server only (service role): no policy for the browser.
comment on table public.skill_reviews is 'Tristan''s review of each montage skill version: only an approved one plays for a business.';
-- The sixteen in the library before this page: already playing, kept so.
insert into public.skill_reviews (key, version, status, note) values
  ('cadre', 1, 'approved', 'en ligne avant la page de validation'),
  ('coulisses', 1, 'approved', 'en ligne avant la page de validation'),
  ('coups-de-fouet', 1, 'approved', 'en ligne avant la page de validation'),
  ('decode', 2, 'approved', 'en ligne avant la page de validation'),
  ('ecran-partage', 1, 'approved', 'en ligne avant la page de validation'),
  ('eventail', 1, 'approved', 'en ligne avant la page de validation'),
  ('frappe', 1, 'approved', 'en ligne avant la page de validation'),
  ('gaufre', 1, 'approved', 'en ligne avant la page de validation'),
  ('journee', 1, 'approved', 'en ligne avant la page de validation'),
  ('mosaique', 1, 'approved', 'en ligne avant la page de validation'),
  ('nike', 1, 'approved', 'en ligne avant la page de validation'),
  ('photo-dump', 1, 'approved', 'en ligne avant la page de validation'),
  ('pile', 1, 'approved', 'en ligne avant la page de validation'),
  ('pixel', 1, 'approved', 'en ligne avant la page de validation'),
  ('quatre-coins', 1, 'approved', 'en ligne avant la page de validation'),
  ('tourne', 1, 'approved', 'en ligne avant la page de validation');

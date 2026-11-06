-- The whole song of a sound, as Instagram's music search serves it (its link on Instagram's CDN, never a copy), where its
-- highlight starts, and until when the link works: the page plays it there (Tristan: « pq l'aperçu est si court ? »).
alter table public.trend_sounds
  add column track_url text,
  add column track_start real,
  add column track_until timestamptz;

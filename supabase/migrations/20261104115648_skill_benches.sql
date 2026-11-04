-- The bench Reel of each version of a montage skill, made by the lab on free rushes (/api/admin/lab, step=result):
-- kept under house/skill-benches/ (the lab case's own posts go when it is reset), shown on /admin for Tristan's review.
create table public.skill_benches (
  key text not null check (char_length(key) between 1 and 40),
  version integer not null check (version >= 1),
  path text not null check (path like 'house/skill-benches/%'),
  seconds numeric(6,2),
  cost_eur numeric(8,3),
  lab_case text,
  created_at timestamptz not null default now(),
  primary key (key, version)
);
alter table public.skill_benches enable row level security;
-- Read and written by the server only (service role): no policy for the browser.
comment on table public.skill_benches is 'The latest bench Reel of each montage skill version (free rushes), for Tristan''s review on /admin.';

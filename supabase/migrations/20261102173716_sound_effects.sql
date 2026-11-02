-- The library of light sound effects, shared by every business: each sound made once (ElevenLabs Sound Effects),
-- measured once (its loudest 400 ms, its peak, where its attack starts, is loudest and fades), kept in media/library/sfx/.
-- Only the server reads or writes it (RLS on, no policy).
create table public.sound_effects (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  sound text not null,
  seconds numeric not null,
  storage_path text not null,
  model text,
  lufs real,
  peak real,
  onset real not null default 0,
  hit real,
  sound_end real not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.sound_effects enable row level security;
revoke all on public.sound_effects from anon, authenticated;
create index sound_effects_last_used on public.sound_effects (last_used_at desc nulls last);
comment on table public.sound_effects is 'Light sound effects shared by every business (lib/render/sfx.ts): server only.';

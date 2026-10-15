-- Simone's voice over one Reel: its own choice ({mode: on|off, voice_id?, wish?}),
-- null when the studio's setting decides (brand_profiles.profile.voice).
alter table public.posts add column voice_over jsonb;
comment on column public.posts.voice_over is 'Simone''s voice over this Reel: {mode: on|off, voice_id?, wish?}; null = the studio''s setting (brand_profiles.profile.voice).';

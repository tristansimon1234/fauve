-- « Steal »: the style read on a Reel she likes (packages/agent/src/steal.ts, stolenStyleSchema):
-- Gemini's reading of its form, texts, look and movement, with what the sandbox measured (its
-- cuts, its tempo, its loudness). Her next Reels follow it once she says so (brand_profiles.profile.followed).
alter table public.inspirations add column if not exists style jsonb;
comment on column public.inspirations.style is 'The style read on this Reel (« Steal »): { look, measures }, stolenStyleSchema in packages/agent/src/steal.ts.';

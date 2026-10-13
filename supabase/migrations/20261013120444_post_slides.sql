-- Text over the photos of a carousel or photo post. `slides`: the plan (texts per
-- photo, packages/agent/src/slides.ts). `slides_render`: the rendered images
-- ({ key, paths: one storage path or null per photo, pending, pending_at }),
-- published instead of the raw photos while `key` matches the plan.
alter table public.posts add column slides jsonb;
alter table public.posts add column slides_render jsonb;

-- The layout bank: a layout is a standalone element the manager creates, renames and
-- iterates on. Each change keeps the previous version (versions, newest first), the
-- example it reproduces and the photo it is shown on stay with it.
alter table public.motion_templates
  add column versions jsonb not null default '[]'::jsonb,
  add column example_path text,
  add column backdrop_path text,
  add column updated_at timestamptz not null default now();

-- A job can work on a layout of the bank rather than a post.
alter table public.studio_jobs
  add column template_id uuid references public.motion_templates (id) on delete set null;

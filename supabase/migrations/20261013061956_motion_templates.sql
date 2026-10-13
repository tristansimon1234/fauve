-- Library of reusable motion-design scenes. Every free scene the motion designer
-- writes is saved here with its text slots; the editor reuses them with new
-- texts instead of ordering a new scene (no Opus call). studio_id null: Fauve's
-- house library, shared by every studio.

create table public.motion_templates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references public.studios (id) on delete cascade,
  name text not null,
  -- The brief the scene was made for: what the editor reads to decide whether it fits.
  description text not null,
  slots jsonb not null default '[]'::jsonb,
  code text not null,
  js text not null,
  duration_seconds numeric,
  uses integer not null default 0,
  last_used_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index motion_templates_studio_used_idx
  on public.motion_templates (studio_id, last_used_at desc nulls last);

alter table public.motion_templates enable row level security;
-- Read-only from the browser: rows are written by the server.
create policy "members read motion templates" on public.motion_templates
  for select to authenticated using (studio_id is null or public.is_studio_member(studio_id));

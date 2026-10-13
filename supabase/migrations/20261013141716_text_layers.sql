-- The library also keeps text layers (the text over a photo, designed as code).
alter table public.motion_templates
  add column kind text not null default 'scene' check (kind in ('scene', 'layer')),
  add column fonts text[] not null default '{}';

create index motion_templates_kind_idx on public.motion_templates (kind, studio_id);

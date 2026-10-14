-- Reusable components (kind 'element'): a title, a tag, a checklist… each lives on
-- its own in the studio's bank, drawn at its design width (base) and placed freely
-- on any photo. Components born from the same inspiration share a kit, and keep
-- where they sat on it (box) to lay the whole kit again.
alter table public.motion_templates
  add column role text,
  add column base integer,
  add column box jsonb,
  add column kit_id uuid,
  add column kit_name text;
alter table public.motion_templates drop constraint if exists motion_templates_kind_check;
alter table public.motion_templates
  add constraint motion_templates_kind_check check (kind in ('scene', 'layer', 'element'));
create index if not exists motion_templates_elements_idx on public.motion_templates (studio_id, kind) where archived_at is null;

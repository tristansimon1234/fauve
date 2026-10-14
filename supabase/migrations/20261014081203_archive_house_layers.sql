-- The house text layouts (studio_id null) are no longer offered: each studio only
-- sees the layouts Fauve designed from its own examples. Archived, not deleted, so
-- posts that already use one keep rendering.
update public.motion_templates
set archived_at = now()
where kind = 'layer' and studio_id is null and archived_at is null;

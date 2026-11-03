-- A video's cut-outs (her, the objects followed, its depth) are made by jobs that run at the same time on the same
-- clip: each one merges only its own passages into media_assets.subjects, in one statement, so none erases another's
-- (the Text Brush test: her cut-out, written a minute after the cup was followed, had erased the cup's).
create or replace function public.merge_media_subjects(p_media uuid, p_studio uuid, p_patch jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update media_assets
  set subjects = coalesce(subjects, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
  where id = p_media and studio_id = p_studio;
$$;

revoke all on function public.merge_media_subjects(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_media_subjects(uuid, uuid, jsonb) to service_role;

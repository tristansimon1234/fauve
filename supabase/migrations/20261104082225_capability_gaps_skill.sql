-- A request a montage skill does not serve (skills.ts) is noted like the copy's (lib/toolkit.ts).
alter table public.capability_gaps drop constraint capability_gaps_source_check;
alter table public.capability_gaps add constraint capability_gaps_source_check check (source in ('copy', 'effects', 'editor', 'chat', 'skill'));

-- Open screens refresh when the studio's photos and videos change (StudioLive).
alter publication supabase_realtime add table public.media_assets;

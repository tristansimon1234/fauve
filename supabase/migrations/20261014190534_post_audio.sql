-- Instagram music attached to a Reel when it is published (Instagram API with Facebook Login).
alter table public.posts add column if not exists audio jsonb;
comment on column public.posts.audio is 'Instagram music attached to a Reel when it is published (Instagram API with Facebook Login): {audio_id, title, artist, duration_ms, type, cover}.';

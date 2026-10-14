-- Instagram's music through the API is gone (Facebook Login removed).
alter table public.posts drop column if exists audio;

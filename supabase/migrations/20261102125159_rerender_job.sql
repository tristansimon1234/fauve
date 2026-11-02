-- A video made again from the chat (its music, its voice taken out, its text styles, a blur…): its own job of 800 s,
-- followed like a montage (lib/rerender.ts). Inside the chat's 300 s, a piano Tristan asked for was composed and
-- mixed, then cut off before the video was kept.
alter table public.studio_jobs drop constraint if exists studio_jobs_kind_check;
alter table public.studio_jobs add constraint studio_jobs_kind_check check (kind in ('montage', 'text_layer', 'elements', 'carousel', 'effect_words', 'rerender'));

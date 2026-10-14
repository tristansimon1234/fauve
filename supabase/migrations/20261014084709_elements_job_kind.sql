-- Designing or changing the studio's components is followed like the other work.
alter table public.studio_jobs drop constraint if exists studio_jobs_kind_check;
alter table public.studio_jobs add constraint studio_jobs_kind_check check (kind in ('montage', 'text_layer', 'elements'));

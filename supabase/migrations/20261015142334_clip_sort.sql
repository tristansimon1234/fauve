-- Videos sent without a word: the publication each one was put on, and why (lib/clip-sort.ts).
alter table public.media_assets
  add column if not exists sorted_post_id uuid references public.posts(id) on delete set null,
  add column if not exists sorted_why text;

-- The inspiration the manager picked for a post (a Reel she likes): the editor follows it first.
alter table public.posts add column inspiration_id uuid references public.inspirations (id) on delete set null;
-- Members may remove an inspiration they added.
create policy "members delete inspirations" on public.inspirations
  for delete to authenticated using (public.is_studio_member(studio_id));

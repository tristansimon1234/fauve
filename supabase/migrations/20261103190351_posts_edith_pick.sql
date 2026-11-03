-- Edith's art direction by default (house-pick.ts): the model of hers Edith picked as a Reel's form when it had none
-- (no model chosen, no Reel to copy, no form asked), dressed in the business's charter. The post follows it while its
-- inspiration is this one; another one set later (a Reel she sends, a model she chooses) is hers.
alter table public.posts add column if not exists edith_pick uuid references public.inspirations(id) on delete set null;
comment on column public.posts.edith_pick is 'The inspiration (one of Edith''s models) Edith picked as this Reel''s form by default, dressed in the charter; followed as such while inspiration_id is this one.';
create index if not exists posts_edith_pick_idx on public.posts (edith_pick);

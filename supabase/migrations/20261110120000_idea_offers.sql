-- « Regarde nos idées » (docs/modeles.md, « Nos modèles restent internes »; Tristan, 10 November): each time a business
-- is shown ideas of form for a new Reel (6 to 8 of Edith's validated models, by their plain names), the ideas shown,
-- her trade and her city (as the rotation reads them) and the month: an idea shown to a business of the same trade in
-- the same city this month goes to another only when nothing else is left. The page of her phone (/idees/<id>) reads
-- it, with the files of that Reel; her choice and the post it made are kept on it. Read by her studio's members,
-- written by the server only; gone with her studio.
create table public.idea_offers (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  -- The files she gave for this Reel, in order.
  media_ids uuid[] not null default '{}',
  -- The ideas shown, best first (house model keys).
  keys text[] not null check (cardinality(keys) between 1 and 8),
  trade text not null,
  city text,
  -- YYYY-MM in her time zone.
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  via text not null check (via in ('app', 'whatsapp')),
  chosen text,
  chosen_at timestamptz,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  check (chosen is null or chosen = any (keys))
);
create index idea_offers_rotation on public.idea_offers (trade, month);
create index idea_offers_studio on public.idea_offers (studio_id, created_at desc);
create index idea_offers_post on public.idea_offers (post_id) where post_id is not null;
alter table public.idea_offers enable row level security;
create policy "members read idea offers" on public.idea_offers for select to authenticated using (public.is_studio_member(studio_id));
comment on table public.idea_offers is 'Ideas of form shown to a business for a new Reel (« Regarde nos idées »): what was shown, for the rotation by trade and city, and what she chose.';

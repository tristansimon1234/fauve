-- Instagram DMs to Fauve's own account: managers share Reels they like
-- (inspirations) and can chat with Fauve there too.

alter type public.message_channel add value if not exists 'instagram';

-- Fauve's own Instagram account (server only).
create table public.platform_accounts (
  key text primary key,
  ig_user_id text not null,
  username text,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_accounts enable row level security; -- no policies: server only

-- Who writes to Fauve on Instagram: the Instagram-scoped id of the sender, linked to a studio by a code.
create table public.instagram_contacts (
  igsid text primary key,
  studio_id uuid not null references public.studios (id) on delete cascade,
  username text,
  linked_at timestamptz not null default now()
);
alter table public.instagram_contacts enable row level security;
create policy "members read instagram contacts" on public.instagram_contacts
  for select to authenticated using (public.is_studio_member(studio_id));

create table public.instagram_link_codes (
  code text primary key,
  studio_id uuid not null references public.studios (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.instagram_link_codes enable row level security; -- no policies: server only

-- Reels and posts a manager shared with Fauve, and what Fauve takes from them.
create table public.inspirations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  source text not null default 'instagram_dm',
  kind text not null,
  url text,
  title text,
  external_id text,
  storage_path text,
  analysis text,
  created_at timestamptz not null default now()
);
create index inspirations_studio_created_idx on public.inspirations (studio_id, created_at desc);
alter table public.inspirations enable row level security;
create policy "members read inspirations" on public.inspirations
  for select to authenticated using (public.is_studio_member(studio_id));

-- Edith's own tools (Tristan: « est-ce que notre système peut créer ses propres outils au fur et à mesure des
-- demandes ? », then « j'aimerais un système plus autonome », « est-ce possible qu'il mette à jour un outil ? »).
-- What the code cannot do yet is noted (capability_gaps); a missing piece that comes back becomes a tool, made
-- generic, proven on several charters, tried on real requests and kept or retired on what happens to them
-- (tools, tool_versions, tool_uses). A tool is versioned: a Reel keeps the version that made it, an update never
-- changes a delivered Reel. Read and written by the server only (service role): no client policy.

-- A request the code could not serve (the remade copy, the chain), or one that needed the effects workshop.
create table public.capability_gaps (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  source text not null check (source in ('copy', 'effects', 'editor', 'chat')),
  -- What was missing, in a few words (grouped by it).
  label text not null check (char_length(label) between 1 and 200),
  -- Her request, clipped.
  request text check (char_length(request) <= 1000),
  detail text check (char_length(detail) <= 1000),
  -- The tool that covers it now, once one does.
  tool_id uuid,
  created_at timestamptz not null default now()
);
create index capability_gaps_created on public.capability_gaps (created_at desc);
create index capability_gaps_label on public.capability_gaps (lower(label));
create index capability_gaps_studio on public.capability_gaps (studio_id);
alter table public.capability_gaps enable row level security;

-- A tool: a mechanism the code runs without an agent (a scene, an animation over several shots, a carousel
-- layout, an effect). Shared by every business (studio_id null), always dressed in each one's charter, or one
-- business's own.
create table public.tools (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  kind text not null check (kind in ('scene', 'layer', 'carousel', 'effect')),
  studio_id uuid references public.studios(id) on delete cascade,
  -- Its card for the call that decides: what it does, when to use it, what it takes.
  card jsonb not null,
  status text not null default 'trial' check (status in ('trial', 'active', 'retired')),
  -- The version used for new Reels (another one may be tried beside it).
  current_version integer,
  -- Where it came from: the gaps and the scenes it was made from.
  origin jsonb not null default '{}'::jsonb,
  retired_why text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz
);
create index tools_status on public.tools (status);
create index tools_studio on public.tools (studio_id);
alter table public.tools enable row level security;

alter table public.capability_gaps
  add constraint capability_gaps_tool_id_fkey foreign key (tool_id) references public.tools(id) on delete set null;
create index capability_gaps_tool on public.capability_gaps (tool_id);

-- Each version of a tool: its code, its inputs and their defaults (a new input left unset draws the version
-- before it exactly), its proof (renders on several charters, the scene check, the judge), why it was made.
create table public.tool_versions (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  version integer not null check (version >= 1),
  code text not null,
  js text not null,
  fonts text[] not null default '{}',
  params jsonb not null default '{}'::jsonb,
  defaults jsonb not null default '{}'::jsonb,
  proof jsonb,
  status text not null default 'candidate' check (status in ('candidate', 'trial', 'active', 'retired')),
  why text check (char_length(why) <= 1000),
  created_at timestamptz not null default now(),
  unique (tool_id, version)
);
alter table public.tool_versions enable row level security;

-- Each time a tool served a Reel, and what became of it (kept as it was, published, corrected, failed):
-- what promotes, updates or retires it.
create table public.tool_uses (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  version integer not null,
  studio_id uuid not null references public.studios(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  edit_plan_id uuid references public.edit_plans(id) on delete set null,
  inputs jsonb not null default '{}'::jsonb,
  outcome text not null default 'pending' check (outcome in ('pending', 'kept', 'published', 'corrected', 'failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index tool_uses_tool on public.tool_uses (tool_id, created_at desc);
create index tool_uses_studio on public.tool_uses (studio_id);
create index tool_uses_post on public.tool_uses (post_id);
create index tool_uses_plan on public.tool_uses (edit_plan_id);
alter table public.tool_uses enable row level security;

-- The switch and the budget of the tools' making: one row.
create table public.tool_settings (
  id boolean primary key default true check (id),
  -- Off: no tool is made, updated or tried (the active ones keep serving unless retired one by one).
  autonomy boolean not null default true,
  -- What making and proving tools may cost in a week (agents and renders).
  weekly_budget_eur numeric(8, 2) not null default 10 check (weekly_budget_eur >= 0),
  updated_at timestamptz not null default now()
);
insert into public.tool_settings (id) values (true);
alter table public.tool_settings enable row level security;
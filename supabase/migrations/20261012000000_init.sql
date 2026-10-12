-- Mila: initial schema.
-- Every studio-scoped table carries studio_id so RLS stays a single membership check.
-- The WhatsApp webhook and background jobs use the service role and bypass RLS.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'staff');

create type public.post_status as enum (
  'planned',
  'content_requested',
  'media_received',
  'draft',
  'validated',
  'scheduled',
  'published',
  'measured',
  'skipped',
  'failed'
);

create type public.post_kind as enum ('reel', 'post', 'carousel', 'story');

create type public.social_platform as enum ('instagram', 'tiktok');

create type public.message_direction as enum ('inbound', 'outbound');

create type public.message_channel as enum ('whatsapp', 'web');

create type public.media_kind as enum ('video', 'image', 'audio', 'document');

create type public.media_source as enum ('whatsapp', 'web_upload', 'render', 'library');

create type public.render_status as enum ('queued', 'rendering', 'done', 'failed');

create type public.social_account_status as enum ('pending', 'connected', 'expired', 'disconnected');

create type public.onboarding_step as enum ('studio_name', 'rhythm', 'examples', 'connect', 'done');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Studios & members
-- ---------------------------------------------------------------------------

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text,
  timezone text not null default 'Europe/Paris',
  plan text not null default 'trial',
  onboarding_step public.onboarding_step not null default 'studio_name',
  booking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger studios_updated_at before update on public.studios
  for each row execute function public.set_updated_at();

create table public.members (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  phone_e164 text not null,
  first_name text,
  role public.member_role not null default 'owner',
  created_at timestamptz not null default now(),
  constraint members_phone_e164_format check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

-- One phone number = one studio: the webhook resolves the studio from the sender.
create unique index members_phone_e164_key on public.members (phone_e164);
create index members_user_id_idx on public.members (user_id);
create index members_studio_id_idx on public.members (studio_id);

-- Security definer so RLS policies can check membership without recursing into
-- the members policies.
create or replace function public.is_studio_member(target_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.studio_id = target_studio_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_studio_owner(target_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.studio_id = target_studio_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- WhatsApp & web conversation
-- ---------------------------------------------------------------------------

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references public.studios (id) on delete cascade,
  wa_message_id text unique,
  channel public.message_channel not null default 'whatsapp',
  direction public.message_direction not null,
  phone_e164 text,
  type text not null,
  body text,
  media_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index whatsapp_messages_studio_created_idx
  on public.whatsapp_messages (studio_id, created_at desc);
create index whatsapp_messages_phone_created_idx
  on public.whatsapp_messages (phone_e164, created_at desc);

-- ---------------------------------------------------------------------------
-- Style & planning
-- ---------------------------------------------------------------------------

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  version integer not null,
  profile jsonb not null default '{}'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (studio_id, version)
);

create table public.content_plans (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null unique references public.studios (id) on delete cascade,
  posts_per_week smallint not null default 3 check (posts_per_week between 0 and 21),
  stories_per_week smallint not null default 4 check (stories_per_week between 0 and 50),
  platforms public.social_platform[] not null default array['instagram']::public.social_platform[],
  themes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger content_plans_updated_at before update on public.content_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  storage_path text not null,
  kind public.media_kind not null,
  source public.media_source not null,
  mime_type text,
  size_bytes bigint,
  duration numeric(8, 3),
  width integer,
  height integer,
  tags text[] not null default '{}',
  consent_ok boolean not null default false,
  created_at timestamptz not null default now()
);

create index media_assets_studio_created_idx on public.media_assets (studio_id, created_at desc);

alter table public.whatsapp_messages
  add constraint whatsapp_messages_media_id_fkey
  foreign key (media_id) references public.media_assets (id) on delete set null;

create table public.clip_analyses (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  analysis jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index clip_analyses_media_idx on public.clip_analyses (media_id);

-- ---------------------------------------------------------------------------
-- Posts, edit plans, renders
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  kind public.post_kind not null,
  platforms public.social_platform[] not null default array['instagram']::public.social_platform[],
  scheduled_at timestamptz,
  status public.post_status not null default 'planned',
  title text not null,
  theme text,
  caption text,
  hashtags text[] not null default '{}',
  template text,
  mila_note text,
  edit_plan_id uuid,
  render_id uuid,
  external_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_studio_scheduled_idx on public.posts (studio_id, scheduled_at);
create index posts_status_scheduled_idx on public.posts (status, scheduled_at);

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table public.edit_plans (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  version integer not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  unique (post_id, version)
);

create table public.renders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  edit_plan_id uuid not null references public.edit_plans (id) on delete cascade,
  status public.render_status not null default 'queued',
  storage_path text,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now()
);

create index renders_edit_plan_idx on public.renders (edit_plan_id);

alter table public.posts
  add constraint posts_edit_plan_id_fkey
  foreign key (edit_plan_id) references public.edit_plans (id) on delete set null;
alter table public.posts
  add constraint posts_render_id_fkey
  foreign key (render_id) references public.renders (id) on delete set null;

create table public.post_media (
  post_id uuid not null references public.posts (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  studio_id uuid not null references public.studios (id) on delete cascade,
  position smallint not null default 0,
  primary key (post_id, media_id)
);

-- Weekly shot list ("À filmer cette semaine").
create table public.shot_requests (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  label text not null,
  hint text,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index shot_requests_studio_due_idx on public.shot_requests (studio_id, due_date);

-- ---------------------------------------------------------------------------
-- Social accounts, metrics, attribution, reports
-- ---------------------------------------------------------------------------

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  platform public.social_platform not null,
  handle text,
  provider text not null default 'ayrshare',
  provider_ref text,
  status public.social_account_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (studio_id, platform)
);

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  platform public.social_platform not null,
  captured_at timestamptz not null default now(),
  views integer,
  reach integer,
  likes integer,
  saves integer,
  shares integer,
  comments integer,
  profile_visits integer
);

create index metrics_post_captured_idx on public.metrics (post_id, captured_at desc);
create index metrics_studio_captured_idx on public.metrics (studio_id, captured_at desc);

create table public.bookings_attribution (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  source text not null,
  post_id uuid references public.posts (id) on delete set null,
  utm jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index bookings_attribution_studio_created_idx
  on public.bookings_attribution (studio_id, created_at desc);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary text not null,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (studio_id, period_start, period_end)
);

-- ---------------------------------------------------------------------------
-- Auth helpers & cost tracking (server only)
-- ---------------------------------------------------------------------------

create table public.login_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  phone_e164 text not null,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cost_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references public.studios (id) on delete cascade,
  kind text not null,
  provider text not null,
  units numeric(14, 4) not null default 0,
  cost_eur numeric(12, 6) not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index cost_events_studio_created_idx on public.cost_events (studio_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.studios enable row level security;
alter table public.members enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.content_plans enable row level security;
alter table public.media_assets enable row level security;
alter table public.clip_analyses enable row level security;
alter table public.posts enable row level security;
alter table public.edit_plans enable row level security;
alter table public.renders enable row level security;
alter table public.post_media enable row level security;
alter table public.shot_requests enable row level security;
alter table public.social_accounts enable row level security;
alter table public.metrics enable row level security;
alter table public.bookings_attribution enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.login_tokens enable row level security; -- no policies: service role only
alter table public.cost_events enable row level security;

create policy "members read their studio" on public.studios
  for select to authenticated using (public.is_studio_member(id));
create policy "owners update their studio" on public.studios
  for update to authenticated
  using (public.is_studio_owner(id)) with check (public.is_studio_owner(id));

create policy "members read studio members" on public.members
  for select to authenticated using (public.is_studio_member(studio_id));

-- Read-only from the browser: these rows are written by the webhook and jobs.
create policy "members read messages" on public.whatsapp_messages
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read brand profiles" on public.brand_profiles
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read clip analyses" on public.clip_analyses
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read edit plans" on public.edit_plans
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read renders" on public.renders
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read social accounts" on public.social_accounts
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read metrics" on public.metrics
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read bookings" on public.bookings_attribution
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read reports" on public.weekly_reports
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read costs" on public.cost_events
  for select to authenticated using (public.is_studio_member(studio_id));

-- Editable from the web app.
create policy "members manage content plan" on public.content_plans
  for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy "members manage media" on public.media_assets
  for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy "members manage posts" on public.posts
  for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy "members manage post media" on public.post_media
  for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy "members manage shot requests" on public.shot_requests
  for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));

-- ---------------------------------------------------------------------------
-- Storage: private "media" bucket, objects stored under <studio_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "members read studio media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members upload studio media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members delete studio media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Realtime: the web app refreshes the calendar and the conversation live.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.whatsapp_messages;

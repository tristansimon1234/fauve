-- Starting (or signing in) on a computer: the screen shows a code that the manager
-- sends to Fauve on WhatsApp; the message proves her number. Service role only.
create table public.pairing_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  secret_hash text not null,
  phone_e164 text,
  claimed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.pairing_requests enable row level security;
create index pairing_requests_waiting_idx on public.pairing_requests (code) where claimed_at is null;

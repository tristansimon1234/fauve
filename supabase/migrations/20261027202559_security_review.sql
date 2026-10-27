-- Security review (October 2026), part 1: what the new code needs (it ships before part 2).

-- 1. Pairing a computer: her « Oui, c'est mon écran » on WhatsApp before the screen
--    opens her session (a message someone else wrote for her would open it on theirs).
alter table public.pairing_requests add column confirmed_at timestamptz;

-- 2. OAuth states (Instagram, TikTok) work once: the callback burns the nonce.
create table public.oauth_states (
  nonce text primary key,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security; -- no policies: server only
revoke all on public.oauth_states from anon, authenticated;

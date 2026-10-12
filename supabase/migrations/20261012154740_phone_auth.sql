-- Phone login: link auth users to members by phone number, and let the server
-- open a session from a one-time WhatsApp link.

-- Supabase Auth stores phones without the leading "+".
create or replace function public.link_member_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is not null and new.phone <> '' then
    update public.members
      set user_id = new.id
      where phone_e164 = '+' || ltrim(new.phone, '+')
        and user_id is null;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_phone_link_member
  after insert or update of phone on auth.users
  for each row execute function public.link_member_to_auth_user();

-- A member created after its auth user (e.g. re-onboarding) gets linked too.
create or replace function public.link_new_member_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    select u.id into new.user_id
      from auth.users u
      where '+' || ltrim(u.phone, '+') = new.phone_e164
      limit 1;
  end if;
  return new;
end;
$$;

create trigger members_link_auth_user
  before insert on public.members
  for each row execute function public.link_new_member_to_auth_user();

-- Server-initiated logins (magic link, QR code): the Send SMS hook stores the
-- code here instead of sending it, the server verifies it right away and deletes
-- the row. Service role only.
create table public.pending_server_logins (
  phone_e164 text primary key,
  otp text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.pending_server_logins enable row level security;

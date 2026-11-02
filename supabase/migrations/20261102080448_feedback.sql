-- What people say of Edith and the app (Tristan: « les feedbacks des users doivent être rangés
-- quelque part »): their words as written, the business, the publication when it is about one, and a
-- kind. Kept by Edith (log_feedback) and, without a turn, from an upset message or « Changer le plan ».
-- Read by the team only (its page and its morning message, with the service role): no client policy.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  kind text not null check (kind in ('bug', 'decu', 'idee', 'compliment', 'frustration', 'plan')),
  words text not null check (char_length(words) between 1 and 1000),
  source text not null check (source in ('whatsapp', 'web')),
  by_edith boolean not null default true,
  post_id uuid references public.posts(id) on delete set null,
  wa_message_id text,
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);
create index feedback_created on public.feedback (created_at desc);
create index feedback_status_created on public.feedback (status, created_at desc);
create index feedback_studio on public.feedback (studio_id);
alter table public.feedback enable row level security;

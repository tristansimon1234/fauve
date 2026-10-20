-- No more publishing on a schedule (Tristan : « la programmation sert à rien », « mais les rappels oui ») :
-- scheduled_at is the moment Simone suggests, when she reminds the manager to publish; reminded_at, when she did.
alter table public.posts add column if not exists reminded_at timestamptz;
comment on column public.posts.reminded_at is 'When Simone reminded the manager to publish it (at scheduled_at, the suggested moment).';

-- A Reel the effects agent makes: its session's stage (api/jobs/montage, step effects / effects_wait).
alter table public.credit_quotes drop constraint credit_quotes_stage_check;
alter table public.credit_quotes add constraint credit_quotes_stage_check
  check (stage in ('design', 'effects', 'alternative', 'render', 'review', 'fix', 'delivered'));

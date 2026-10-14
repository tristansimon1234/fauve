-- Getting started in a new order (website, style, rhythm, Instagram, first post):
-- the step becomes plain text with a check, old values mapped to their new step.
-- (The old enum type is left unused: dropping it waits on open sessions.)
set local lock_timeout = '8s';
alter table public.studios
  alter column onboarding_step type text
  using (case onboarding_step::text when 'studio_name' then 'website' when 'examples' then 'style' else onboarding_step::text end);
alter table public.studios alter column onboarding_step set default 'website';
alter table public.studios drop constraint if exists studios_onboarding_step_check;
alter table public.studios
  add constraint studios_onboarding_step_check check (onboarding_step in ('website', 'style', 'rhythm', 'connect', 'first_post', 'done'));

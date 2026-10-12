-- Studio website, read by Fauve during onboarding (read_website tool).
alter table public.studios add column if not exists website_url text;

-- Short sign-in links (/l/{token}): where a link points is kept with its token.
alter table public.login_tokens add column if not exists next text;

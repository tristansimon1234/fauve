-- Her words on an effect (lib/effect-words.ts): the replay of the agent's own render script is followed
-- like the other work, and chained from the database when Vercel refuses a chain of self-calls (508).
alter table public.studio_jobs drop constraint if exists studio_jobs_kind_check;
alter table public.studio_jobs add constraint studio_jobs_kind_check check (kind in ('montage', 'text_layer', 'elements', 'carousel', 'effect_words'));

create or replace function public.queue_job(app_url text, job text, payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if job not in ('montage', 'elements', 'steal', 'carousel', 'effect-words') then
    raise exception 'unknown job %', job;
  end if;
  return net.http_post(
    url := rtrim(app_url, '/') || '/api/jobs/' || job,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fauve_cron_secret'),
      'Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 10000);
end;
$$;
revoke all on function public.queue_job(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.queue_job(text, text, jsonb) to service_role;

-- A video made again from the chat or its page runs in /api/jobs/rerender: its step refused by Vercel (508) goes
-- through Postgres like the other jobs.
create or replace function public.queue_job(app_url text, job text, payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if job not in ('montage', 'elements', 'steal', 'carousel', 'effect-words', 'rerender') then
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

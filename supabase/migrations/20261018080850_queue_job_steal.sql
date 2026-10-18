-- « Steal »: the Reel she sends to copy is read in its own job (/api/jobs/steal), queued from
-- the database like the others when Vercel refuses a chain of self-calls (508).
create or replace function public.queue_job(app_url text, job text, payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if job not in ('montage', 'elements', 'steal') then
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

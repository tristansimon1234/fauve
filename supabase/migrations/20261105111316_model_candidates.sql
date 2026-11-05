-- The Reels that may become one of Edith's models (docs/modeles.md, « Modèles repérés », chantier 3). A Reel a business
-- sends Edith by its link to copy, once read for her copy (« Steal »), is judged on that reading: a montage form any
-- business could remake that none of Edith's models does? A link Tristan proposes on /admin is read and judged the same.
-- Kept: the Reel's public link, its reading, the judgement, how many times businesses sent it (a count, never who), and
-- Tristan's review. Read and written by the server only (service role): no policy for the browser.
create table public.model_candidates (
  id uuid primary key default gen_random_uuid(),
  -- The Reel, however its link was written (« instagram:<shortcode> », « tiktok:<id> », candidateKey): one row each.
  key text not null unique check (char_length(key) between 3 and 300),
  link text not null check (link ~ '^https://' and char_length(link) <= 600),
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube')),
  -- First sent by a business to copy (steal), or proposed by Tristan (admin); how many times businesses sent it.
  source text not null check (source in ('steal', 'admin')),
  requests integer not null default 0 check (requests >= 0),
  -- Its reading, as a Reel to copy is read (stolenStyleSchema), without the sheets of the business's copy.
  reading jsonb,
  -- The judgement: a form or content, the nearest of Edith's models and how close (0 to 10), the name of the model it
  -- would be, what is new in it, the trades it suits, what to film, a score, why; unreadable when it could not be read.
  verdict text check (verdict in ('new_form', 'known', 'content', 'weak', 'unreadable')),
  nearest text check (char_length(nearest) <= 40),
  closeness smallint check (closeness between 0 and 10),
  name text check (char_length(name) <= 60),
  novelty text check (char_length(novelty) <= 600),
  trades text[] not null default '{}',
  needs text check (char_length(needs) <= 300),
  score smallint check (score between 1 and 10),
  why text check (char_length(why) <= 400),
  -- What judging it cost the team (and reading it, for a link Tristan proposed): cost_events with meta.scout = its key.
  cost_eur numeric(8, 4) not null default 0,
  -- new: to look at; kept: « En faire un modèle » (its fiche and its model are written from this list); dropped: by
  -- Tristan or by the judgement; drafted: its model is written (model_key).
  status text not null default 'new' check (status in ('new', 'kept', 'dropped', 'drafted')),
  note text check (char_length(note) <= 2000),
  model_key text check (char_length(model_key) <= 40),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index model_candidates_status_updated on public.model_candidates (status, updated_at desc);
alter table public.model_candidates enable row level security;
comment on table public.model_candidates is 'Reels that may become one of Edith''s models (Reels businesses send to copy, Tristan''s links): public link, reading, judgement, a count of requests, never who. Server only (/admin).';

-- A business's request counted once on its Reel's candidate, marked on the request itself (deleted with it).
alter table public.inspirations add column if not exists scouted_at timestamptz;
comment on column public.inspirations.scouted_at is 'When this Reel to copy was counted (and judged, if new) as a possible model of Edith''s (lib/model-scout.ts).';

-- One more request for a Reel already judged, counted at once (two at the same moment both count); false when it has no row.
create or replace function public.count_model_candidate(candidate_key text)
returns boolean
language sql
set search_path = ''
as $$
  with counted as (
    update public.model_candidates set requests = requests + 1, updated_at = now() where key = candidate_key returning 1
  )
  select exists (select 1 from counted)
$$;
revoke all on function public.count_model_candidate(text) from public, anon, authenticated;
grant execute on function public.count_model_candidate(text) to service_role;

-- A link Tristan proposes is read and judged in its own job (/api/jobs/scout): its step refused by Vercel (508) goes
-- through Postgres like the other jobs.
create or replace function public.queue_job(app_url text, job text, payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if job not in ('montage', 'elements', 'steal', 'carousel', 'effect-words', 'rerender', 'scout') then
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

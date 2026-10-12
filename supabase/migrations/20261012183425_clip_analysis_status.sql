-- One Gemini analysis per clip: webhook invocations claim the clip before analysing it.
alter table public.media_assets
  add column if not exists analysis_status text check (analysis_status in ('running', 'done', 'failed')),
  add column if not exists analysis_started_at timestamptz;

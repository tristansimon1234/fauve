-- No planning imposed on her: the weekly proposal and the daily missions are
-- unscheduled (fauve-weekly-plan, fauve-daily-tasks); one short reminder when
-- nothing has gone out for a while replaces them (lib/nudge.ts). The columns of
-- the weekly routine (week_plans, posts.week_plan_id/plan_b_at,
-- content_plans.post_days/post_time, shot_requests.reminded_at) stay unused.
alter table public.studios add column if not exists nudged_at timestamptz;
-- Each morning (≈ 10 h in Paris).
select cron.schedule('fauve-nudge', '0 8 * * *', $$select public.call_app('/api/cron/nudge')$$);

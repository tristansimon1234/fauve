-- Keeps the start shared by every chat request (Simone's prompt and tools) in Anthropic's prompt cache during the
-- day: /api/cron/warm-chat reads it again 45 to 58 minutes after the last chat request, only when someone wrote to
-- Simone in the last 3 hours. Every 5 minutes from 6:02 to 21:57 UTC (7 h to 23 h in Paris in winter).
select cron.schedule('fauve-warm-chat', '2-59/5 6-21 * * *', $$select public.call_app('/api/cron/warm-chat')$$);

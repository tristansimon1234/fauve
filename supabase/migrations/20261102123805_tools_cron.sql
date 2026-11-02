-- Edith's own tools, once a day at 03:41 UTC: uses settled, tools promoted or retired, new ones made (lib/tool-maker.ts).
select cron.schedule('fauve-tools', '41 3 * * *', $$select public.call_app('/api/cron/tools')$$);

-- The chat cache warm-up is gone: its max_tokens 0 request never read the cache the chat wrote, it wrote its own.
select cron.unschedule(jobid) from cron.job where jobname = 'fauve-warm-chat';

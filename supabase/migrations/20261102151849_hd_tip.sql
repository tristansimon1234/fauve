-- When Edith told her, once, that her WhatsApp videos come compressed and how to send them in HD.
alter table public.studios add column if not exists hd_tip_at timestamptz;

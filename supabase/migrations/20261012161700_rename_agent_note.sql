-- The product is now called Fauve; keep the column name brand-neutral.
alter table public.posts rename column mila_note to agent_note;

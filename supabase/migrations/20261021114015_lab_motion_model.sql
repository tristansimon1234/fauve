-- The model that writes a lab studio's animations (a Gemini model id), to compare it with
-- Opus on the same case; null is Opus. Read only for a lab studio (website_url lab://…).
alter table public.studios add column if not exists motion_model text;

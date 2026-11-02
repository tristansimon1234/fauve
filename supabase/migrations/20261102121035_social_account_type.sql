-- The kind of Instagram account (BUSINESS, MEDIA_CREATOR…), read when it is linked: on a Business account, Instagram
-- offers fewer sounds, and « Utiliser l'audio » on the Reel she copies may not be there (« Garder le son du modèle »).
alter table public.social_accounts add column account_type text check (account_type is null or char_length(account_type) <= 40);

-- Instagram DMs to Edith's own account are retired: their tables stay (nothing reads them) but no
-- signed-in or anonymous client can reach them any more.
revoke all on table public.instagram_contacts from anon, authenticated;
revoke all on table public.instagram_link_codes from anon, authenticated;
revoke all on table public.platform_accounts from anon, authenticated;

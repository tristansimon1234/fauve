-- Security advisor fixes.

-- Pin search_path on the updated_at trigger function.
alter function public.set_updated_at() set search_path = '';

-- Trigger functions are never meant to be called through the API.
revoke execute on function public.link_member_to_auth_user() from public, anon, authenticated;
revoke execute on function public.link_new_member_to_auth_user() from public, anon, authenticated;

-- Membership helpers are used by RLS policies for signed-in users only.
revoke execute on function public.is_studio_member(uuid) from public, anon;
revoke execute on function public.is_studio_owner(uuid) from public, anon;
grant execute on function public.is_studio_member(uuid) to authenticated;
grant execute on function public.is_studio_owner(uuid) to authenticated;

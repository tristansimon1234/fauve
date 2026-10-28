-- Security review (October 2026), part 2. The browser never writes these tables: the app's server
-- actions do it with the service role, after checking the studio. Members kept a write policy on
-- every column (a carousel's code, then run in the render sandbox; file paths used with the service
-- role): they now only read them. The old write policies are moved to service_role (which bypasses
-- RLS anyway) instead of dropped, so they no longer apply to a signed-in member.
create policy "members read content plan" on public.content_plans
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read media" on public.media_assets
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read posts" on public.posts
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read post media" on public.post_media
  for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read shot requests" on public.shot_requests
  for select to authenticated using (public.is_studio_member(studio_id));

alter policy "members manage content plan" on public.content_plans to service_role;
alter policy "members manage media" on public.media_assets to service_role;
alter policy "members manage posts" on public.posts to service_role;
alter policy "members manage post media" on public.post_media to service_role;
alter policy "members manage shot requests" on public.shot_requests to service_role;

-- A studio row is written by the server only: an owner could set its website to lab://… (no daily
-- reply cap) or its onboarding step back (free readings).
alter policy "owners update their studio" on public.studios to service_role;

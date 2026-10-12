-- Local / preview-branch demo data: "Studio Lune", the studio from the mockup.
-- Never runs against production.

insert into public.studios (id, name, onboarding_step, booking_url)
values ('00000000-0000-4000-8000-000000000001', 'Studio Lune', 'done', 'https://example.com/reserver')
on conflict (id) do nothing;

insert into public.members (studio_id, phone_e164, first_name, role)
values ('00000000-0000-4000-8000-000000000001', '+33600000000', 'Camille', 'owner')
on conflict do nothing;

insert into public.content_plans (studio_id, posts_per_week, stories_per_week, platforms, themes)
values (
  '00000000-0000-4000-8000-000000000001', 3, 4,
  array['instagram', 'tiktok']::public.social_platform[],
  '["cours", "coulisses", "profs", "témoignages", "offres", "conseils"]'::jsonb
)
on conflict (studio_id) do nothing;

insert into public.social_accounts (studio_id, platform, handle, status)
values
  ('00000000-0000-4000-8000-000000000001', 'instagram', 'studio.lune', 'connected'),
  ('00000000-0000-4000-8000-000000000001', 'tiktok', 'studiolune', 'connected')
on conflict do nothing;

insert into public.posts (studio_id, kind, platforms, scheduled_at, status, title, caption, hashtags)
values
  ('00000000-0000-4000-8000-000000000001', 'story', '{instagram}', '2026-10-12 09:00+02', 'published', 'Le planning de la semaine', null, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'carousel', '{instagram}', '2026-10-13 12:30+02', 'published', 'Les 3 bienfaits du reformer', null, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'story', '{instagram}', '2026-10-14 18:30+02', 'validated', 'Dernières places jeudi 7 h', null, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'reel', '{instagram,tiktok}', '2026-10-15 18:00+02', 'draft', 'Le studio se réveille',
   '6 h 45, les premières à la barre. Il reste 2 places au cours de jeudi 7 h, on vous garde un reformer ? Réservation en bio.',
   '{pilatesreformer,paris5,pilatesparis,studiolune}'),
  ('00000000-0000-4000-8000-000000000001', 'post', '{instagram}', '2026-10-16 12:00+02', 'content_requested', 'Portrait : Inès, nouvelle prof', null, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'story', '{instagram}', '2026-10-17 10:00+02', 'planned', 'Atelier prénatal du 26/10', null, '{}'),
  ('00000000-0000-4000-8000-000000000001', 'story', '{instagram}', '2026-10-17 17:00+02', 'content_requested', 'Coulisses du samedi', null, '{}');

insert into public.shot_requests (studio_id, label, hint, due_date, done)
values
  ('00000000-0000-4000-8000-000000000001', 'Les mains sur la barre, en gros plan', 'Pour le Reel de jeudi · lumière du matin', '2026-10-14', true),
  ('00000000-0000-4000-8000-000000000001', 'Inès qui corrige une posture', 'Pour son portrait de vendredi · de profil', '2026-10-15', false),
  ('00000000-0000-4000-8000-000000000001', 'Le studio vide avant le premier cours', 'Pour les stories · 5 secondes suffisent', '2026-10-16', false);

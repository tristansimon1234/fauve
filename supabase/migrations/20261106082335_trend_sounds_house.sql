-- « Les sons de nos modèles » (docs/son.md): the sounds Tristan's reference Reels use, picked by him, kept apart from
-- TikTok's charts (chart house: never moved out of the list by the Monday refresh).
alter table public.trend_sounds drop constraint trend_sounds_chart_check;
alter table public.trend_sounds add constraint trend_sounds_chart_check check (chart in ('house', 'top', 'viral'));

-- Her place as coordinates (packages/agent/src/geo.ts, apps/web/src/lib/geo.ts): the postal address found in her facts or
-- on her site, geocoded once by OpenStreetMap's Nominatim, and its answer, found or not, so the same address is never
-- asked twice (its usage policy). A model whose labels show where she is (« Fenêtres et étiquettes ») writes them from it.
alter table public.studios add column if not exists place jsonb;
comment on column public.studios.place is 'Her address as geocoded once by OpenStreetMap Nominatim: { address, lat, lon } when her door was found, { address, none: true } when not, { address: null, site } when neither her facts nor her site gave one; at: when. Never a made-up value.';

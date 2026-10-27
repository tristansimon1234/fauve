-- What she launched from « Créer » before subscribing (or with no credits left): kept, then
-- launched on her return from Checkout or after a move up (launchPendingCreation).
alter table public.studios add column pending_creation jsonb;
